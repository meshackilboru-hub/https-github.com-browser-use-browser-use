import { useEffect, useRef } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth";
import { usePrefs } from "@/lib/prefs";
import { SUBJECTS } from "@/lib/catalog";
import { space, useTheme } from "@/lib/theme";
import { ChatView, type ChatHandle } from "@/components/ChatView";
import { Banner, ChipScroller } from "@/components/ui";

const STUDENT_STARTERS = [
  "Why does furosemide cause hypokalemia?",
  "Nephritic vs nephrotic syndrome: key differences in a table",
  "Walk me through reading an ABG step by step",
  "Explain the brachial plexus and the classic injuries",
];
const RESIDENT_STARTERS = [
  "Approach to undifferentiated hyponatremia on the ward",
  "Sepsis: current fluid and vasopressor strategy",
  "Which board-favorite drug interactions should I know cold?",
];
const PRO_STARTERS = [
  "First-line management of uncomplicated malaria in adults",
  "Antihypertensive choice in pregnancy",
  "When to start anticoagulation after an ischemic stroke with AF",
];

export default function Tutor() {
  const t = useTheme();
  const { profile } = useAuth();
  const { subject, setSubject, socratic, setSocratic } = usePrefs();
  const chat = useRef<ChatHandle>(null);
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  const pro = profile?.role === "practitioner";

  // Another tab can hand over a question, e.g. "Ask the tutor about this".
  useEffect(() => {
    if (ask) {
      chat.current?.reset(ask);
      router.setParams({ ask: undefined });
    }
  }, [ask]);

  const starters = pro ? PRO_STARTERS : profile?.role === "resident" ? RESIDENT_STARTERS : STUDENT_STARTERS;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderBottomColor: t.line, backgroundColor: t.surface }}>
        <ChipScroller options={SUBJECTS} value={subject} onChange={setSubject} />
        {!pro ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg }}>
            <Text style={{ color: t.ink, fontWeight: "500" }}>Socratic mode</Text>
            <Switch value={socratic} onValueChange={setSocratic} trackColor={{ true: t.accent }} accessibilityLabel="Socratic mode" />
          </View>
        ) : null}
      </View>
      <ChatView
        ref={chat}
        mode="tutor"
        subject={subject}
        socratic={!pro && socratic}
        placeholder={pro ? "Ask a clinical question…" : "Ask about a mechanism, drug or concept…"}
        footer={
          <Pressable onPress={() => chat.current?.reset()}>
            <Text style={{ color: t.muted, fontSize: 13 }}>Start a new conversation</Text>
          </Pressable>
        }
        empty={
          <View style={{ gap: space.md }}>
            <Text style={{ color: t.ink, fontSize: 22, fontWeight: "800" }}>
              {pro ? "Clinical reference" : `Hi${profile?.displayName ? ", " + profile.displayName.split(" ")[0] : ""}. What are we studying?`}
            </Text>
            {pro ? (
              <Banner>Don't enter patient names or other identifying details. Answers support your judgment and need checking against local guidelines.</Banner>
            ) : (
              <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>
                {socratic ? "Socratic mode is on, so I'll guide you with questions instead of giving answers straight away." : "Ask anything. Every answer ends with high-yield points and a quick check question."}
              </Text>
            )}
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginTop: space.sm }}>Try asking</Text>
            {starters.map((s) => (
              <Pressable
                key={s}
                onPress={() => chat.current?.send(s)}
                style={({ pressed }) => ({ borderWidth: 1, borderColor: pressed ? t.accent : t.line, backgroundColor: t.surface, borderRadius: 12, padding: space.md })}
              >
                <Text style={{ color: t.ink, fontSize: 15 }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        }
      />
    </View>
  );
}
