import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, errorMessage, type Question } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePrefs } from "@/lib/prefs";
import { SUBJECTS } from "@/lib/catalog";
import { radius, space, useTheme } from "@/lib/theme";
import { Markdown } from "@/components/Markdown";
import { Button, Card, ChipScroller, Tag } from "@/components/ui";

const LETTERS = "ABCDE";

const EXAMPLE: Question = {
  topic: "Hyponatremia in a smoker",
  stem: "A 62-year-old man is brought in for 3 days of worsening confusion. He has a 45 pack-year smoking history and 2 months of cough and 6-kg weight loss. BP 132/78 mm Hg, HR 84/min. Mucous membranes are moist, with no edema. Labs: Na⁺ 124 mEq/L, K⁺ 4.1 mEq/L, serum osmolality 258 mOsm/kg, urine osmolality 480 mOsm/kg, urine Na⁺ 52 mEq/L, TSH 2.1 µU/mL, morning cortisol 18 µg/dL.",
  question: "Which of the following is the most likely underlying cause of this patient's condition?",
  choices: ["Small cell carcinoma of the lung", "Squamous cell carcinoma of the lung", "Primary polydipsia", "Primary adrenal insufficiency", "Hypothyroidism"],
  answer: 0,
  explanation:
    "Euvolemic hypotonic hyponatremia with inappropriately concentrated urine and high urine Na⁺ is **SIADH**. In a heavy smoker with cough and weight loss, the classic cause is ectopic ADH from **small cell lung carcinoma**.",
  whyNot: [
    "Correct: SCLC secretes ADH (and ACTH) ectopically.",
    "Squamous cell carcinoma classically secretes PTHrP, causing hypercalcemia.",
    "Primary polydipsia gives maximally dilute urine (< 100 mOsm/kg).",
    "Adrenal insufficiency brings hyperkalemia and hypotension; cortisol here is normal.",
    "Hypothyroidism can cause hyponatremia, but TSH is normal.",
  ],
  pearl: "SCLC: ADH (SIADH), ACTH (Cushing), Lambert–Eaton. Squamous: PTHrP and hypercalcemia.",
};

const SCORE_KEY = "nisome-score";

export function Quiz() {
  const t = useTheme();
  const { profile } = useAuth();
  const { subject, setSubject } = usePrefs();
  const [q, setQ] = useState<Question>(EXAMPLE);
  const [isExample, setIsExample] = useState(true);
  const [picked, setPicked] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const recent = useRef<string[]>([]);
  const scroller = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    AsyncStorage.getItem(SCORE_KEY)
      .then((raw) => raw && setScore(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  function saveScore(s: { right: number; total: number }) {
    setScore(s);
    AsyncStorage.setItem(SCORE_KEY, JSON.stringify(s)).catch(() => {});
  }

  async function next() {
    setLoading(true);
    setError(null);
    try {
      const nq = await api.quiz({ subject, exam: profile?.exam, avoid: recent.current.slice(-10) });
      recent.current.push(nq.topic);
      setQ(nq);
      setIsExample(false);
      setPicked(null);
      scroller.current?.scrollTo({ y: 0, animated: false });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (!isExample) saveScore({ right: score.right + (i === q.answer ? 1 : 0), total: score.total + 1 });
  }

  function askTutor() {
    const ask = `I just did this practice question:\n\n${q.stem}\n${q.question}\n${q.choices
      .map((c, i) => `${LETTERS[i]}. ${c}`)
      .join("\n")}\n\nThe answer is ${LETTERS[q.answer]}. I chose ${LETTERS[picked ?? 0]}. Help me understand the reasoning and the concept behind it.`;
    router.navigate({ pathname: "/tutor", params: { ask } });
  }

  const pct = score.total ? Math.round((score.right / score.total) * 100) : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.line, backgroundColor: t.surface }}>
        <ChipScroller options={SUBJECTS} value={subject} onChange={setSubject} />
      </View>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: t.muted, fontVariant: ["tabular-nums"] }}>
            Score <Text style={{ color: t.ink, fontWeight: "600" }}>{score.right}/{score.total}</Text>
            {pct !== null ? ` · ${pct}%` : ""}
          </Text>
          <Pressable onPress={() => saveScore({ right: 0, total: 0 })}>
            <Text style={{ color: t.muted, fontSize: 13 }}>Reset score</Text>
          </Pressable>
        </View>

        {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}

        {loading ? (
          <Card style={{ alignItems: "center", gap: space.md, paddingVertical: space.xl * 2 }}>
            <ActivityIndicator color={t.accent} />
            <Text style={{ color: t.muted }}>Writing a question{subject !== "Any" ? ` on ${subject}` : ""}…</Text>
          </Card>
        ) : (
          <Card style={{ gap: space.md }}>
            {isExample ? <Tag>Example question</Tag> : null}
            <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>{q.topic}</Text>
            <Text selectable style={{ color: t.ink, fontSize: 16, lineHeight: 23 }}>{q.stem}</Text>
            <Text style={{ color: t.ink, fontSize: 16, fontWeight: "700" }}>{q.question}</Text>
            <View style={{ gap: space.sm }}>
              {q.choices.map((c, i) => {
                const done = picked !== null;
                const right = done && i === q.answer;
                const wrong = done && i === picked && i !== q.answer;
                return (
                  <Pressable
                    key={i}
                    onPress={() => choose(i)}
                    disabled={done}
                    accessibilityRole="button"
                    accessibilityLabel={`Choice ${LETTERS[i]}: ${c}`}
                    style={{
                      flexDirection: "row",
                      gap: space.md,
                      padding: space.md,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: right ? t.good : wrong ? t.bad : t.line,
                      backgroundColor: right ? t.goodSoft : wrong ? t.badSoft : t.bg,
                    }}
                  >
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: right ? t.good : wrong ? t.bad : t.surface,
                        borderWidth: 1,
                        borderColor: right ? t.good : wrong ? t.bad : t.line,
                      }}
                    >
                      <Text style={{ color: right || wrong ? t.surface : t.ink, fontWeight: "700", fontSize: 13 }}>{LETTERS[i]}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: t.ink, fontSize: 15.5 }}>{c}</Text>
                      {done && q.whyNot[i] ? <Text style={{ color: t.muted, fontSize: 13.5 }}>{q.whyNot[i]}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {picked !== null ? (
              <View style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: t.line, paddingTop: space.md }}>
                <Text style={{ color: picked === q.answer ? t.good : t.bad, fontWeight: "700", fontSize: 16 }}>
                  {picked === q.answer ? "Correct." : `Not quite. The answer is ${LETTERS[q.answer]}.`}
                </Text>
                <Markdown>{q.explanation}</Markdown>
                <View style={{ backgroundColor: t.accentSoft, borderRadius: radius.md, padding: space.md }}>
                  <Text style={{ color: t.ink, fontSize: 14.5 }}>
                    <Text style={{ fontWeight: "700" }}>Pearl: </Text>
                    {q.pearl}
                  </Text>
                </View>
                <Button title="Ask the tutor about this" variant="ghost" onPress={askTutor} />
              </View>
            ) : null}
          </Card>
        )}

        <Button title={isExample ? "Get a question" : "Next question"} onPress={next} loading={loading} />
      </ScrollView>
    </View>
  );
}
