import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, errorMessage, type DocQuestion, type Grade, type Verdict } from "@/lib/api";
import { radius, space, useTheme } from "@/lib/theme";
import { Markdown } from "./Markdown";
import { Button } from "./ui";

const LETTERS = "ABCDE";

type Props = {
  docId: string;
  q: DocQuestion;
  /** Hands the question to the document chat for a deeper explanation. */
  onDiscuss(text: string): void;
};

/**
 * One question from the uploaded material. Multiple choice is marked instantly on the phone
 * and recorded on the server; written answers are graded by Nisome, which corrects mistakes.
 */
export function QuestionCard({ docId, q, onDiscuss }: Props) {
  const t = useTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Questions due again start fresh; others show the last attempt.
  const due = (q.dueAt?.toMillis() ?? 0) <= Date.now();
  const shown: { verdict: Verdict; feedback?: string; correction?: string } | null = grade
    ? grade
    : !due && q.lastVerdict
      ? { verdict: q.lastVerdict, feedback: q.lastFeedback, correction: q.lastCorrection }
      : null;
  const pickedIndex = picked ?? (shown && typeof q.lastAnswer === "number" ? q.lastAnswer : null);

  async function submit(answer: number | string) {
    setBusy(true);
    setError(null);
    try {
      setGrade(await api.answerQuestion({ docId, questionId: q.id, answer }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function chooseMcq(i: number) {
    if (picked !== null || shown) return;
    setPicked(i);
    // Mark it on the spot; the server records it and schedules the next review.
    const verdict: Verdict = i === q.answerIndex ? "correct" : "incorrect";
    setGrade({
      verdict,
      feedback: q.explanation,
      correction: verdict === "incorrect" ? `The correct answer is ${LETTERS[q.answerIndex]}: ${q.choices[q.answerIndex]}.` : "",
      explanation: q.explanation,
      answerIndex: q.answerIndex,
      modelAnswer: q.modelAnswer,
    });
    api.answerQuestion({ docId, questionId: q.id, answer: i }).catch((e) => setError(errorMessage(e)));
  }

  const tone = shown?.verdict === "correct" ? t.good : shown?.verdict === "partial" ? t.accent : t.bad;
  const verdictText = shown?.verdict === "correct" ? "Correct" : shown?.verdict === "partial" ? "Partly right" : "Not quite";

  return (
    <View style={{ borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
        <Text style={{ color: t.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>{q.concept}</Text>
        {q.source ? <Text style={{ color: t.muted, fontSize: 12 }}>· {q.source}</Text> : null}
        {due && q.attempts > 0 ? <Text style={{ color: t.bad, fontSize: 12, fontWeight: "600" }}>· Due for review</Text> : null}
      </View>
      <Text selectable style={{ color: t.ink, fontSize: 16, lineHeight: 23, fontWeight: "500" }}>{q.question}</Text>

      {q.type === "mcq" ? (
        <View style={{ gap: space.sm }}>
          {q.choices.map((c, i) => {
            const done = !!shown;
            const right = done && i === q.answerIndex;
            const wrong = done && i === pickedIndex && i !== q.answerIndex;
            return (
              <Pressable
                key={i}
                onPress={() => chooseMcq(i)}
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
                <Text style={{ color: right ? t.good : wrong ? t.bad : t.muted, fontWeight: "700", width: 18 }}>{LETTERS[i]}</Text>
                <Text style={{ color: t.ink, fontSize: 15.5, flex: 1 }}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : !shown ? (
        <View style={{ gap: space.sm }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type your answer"
            placeholderTextColor={t.muted}
            multiline
            style={{ borderWidth: 1, borderColor: t.line, borderRadius: radius.md, padding: space.md, minHeight: 80, color: t.ink, backgroundColor: t.bg, fontSize: 16, textAlignVertical: "top" }}
            accessibilityLabel="Your answer"
          />
          <Button title="Check my answer" onPress={() => submit(text)} loading={busy} disabled={!text.trim()} />
        </View>
      ) : typeof q.lastAnswer === "string" || text ? (
        <Text style={{ color: t.muted, fontStyle: "italic" }}>Your answer: {text || String(q.lastAnswer)}</Text>
      ) : null}

      {busy && q.type === "mcq" ? <ActivityIndicator color={t.accent} /> : null}
      {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}

      {shown ? (
        <View style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: t.line, paddingTop: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Ionicons name={shown.verdict === "correct" ? "checkmark-circle" : shown.verdict === "partial" ? "remove-circle" : "close-circle"} size={20} color={tone} />
            <Text style={{ color: tone, fontWeight: "700", fontSize: 16 }}>{verdictText}</Text>
          </View>
          {shown.correction ? (
            <View style={{ backgroundColor: t.badSoft, borderRadius: radius.md, padding: space.md }}>
              <Text style={{ color: t.ink, fontSize: 15 }}>
                <Text style={{ fontWeight: "700" }}>Correction: </Text>
                {shown.correction}
              </Text>
            </View>
          ) : null}
          {shown.feedback && shown.feedback !== q.explanation ? <Text style={{ color: t.ink, fontSize: 15, lineHeight: 21 }}>{shown.feedback}</Text> : null}
          <Markdown>{q.explanation}</Markdown>
          {q.type === "short" ? (
            <Text style={{ color: t.muted, fontSize: 14 }}>
              <Text style={{ fontWeight: "700" }}>Model answer: </Text>
              {q.modelAnswer}
            </Text>
          ) : null}
          <Text style={{ color: t.muted, fontSize: 12.5 }}>
            {shown.verdict === "incorrect" ? "Nisome will ask this again soon." : shown.verdict === "partial" ? "You'll see this again tomorrow." : "Next review is scheduled further out."}
          </Text>
          <Button
            title="Ask Nisome about this"
            variant="ghost"
            onPress={() =>
              onDiscuss(
                `Help me understand this question from my material.\n\n${q.question}${
                  q.type === "mcq" ? "\n" + q.choices.map((c, i) => `${LETTERS[i]}. ${c}`).join("\n") : ""
                }\n\nMy answer: ${q.type === "mcq" ? (pickedIndex !== null ? LETTERS[pickedIndex] : "?") : text || String(q.lastAnswer ?? "")}`,
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}
