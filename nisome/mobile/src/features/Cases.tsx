import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { usePrefs } from "@/lib/prefs";
import { SUBJECTS } from "@/lib/catalog";
import { space, useTheme } from "@/lib/theme";
import { ChatView, type ChatHandle } from "@/components/ChatView";
import { Button, ChipScroller, Tag } from "@/components/ui";

export function Cases() {
  const t = useTheme();
  const { profile } = useAuth();
  const { subject, setSubject } = usePrefs();
  const chat = useRef<ChatHandle>(null);
  const [started, setStarted] = useState(false);

  const start = () => {
    setStarted(true);
    chat.current?.reset("Start a new case now.");
  };

  const focus = subject !== "Any" ? subject : profile?.role === "student" ? "mixed specialties" : (profile?.specialty ?? "your specialty");

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.line, backgroundColor: t.surface }}>
        <ChipScroller options={SUBJECTS} value={subject} onChange={setSubject} />
      </View>
      <ChatView
        ref={chat}
        mode="case"
        subject={subject}
        hiddenTurns={1}
        locked={!started}
        placeholder={started ? "Take a history, examine, or order tests…" : "Press Start a case first"}
        footer={
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button title={started ? "New case" : "Start a case"} onPress={start} style={{ flex: 1 }} />
            <Button title="Submit diagnosis" variant="ghost" disabled={!started} onPress={() => chat.current?.setDraft("DIAGNOSIS: ")} style={{ flex: 1 }} />
          </View>
        }
        empty={
          <View style={{ gap: space.md }}>
            <Text style={{ color: t.ink, fontSize: 22, fontWeight: "800" }}>Simulated patients</Text>
            <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>
              You'll meet a patient in {focus}. Take a history, examine, order tests, then submit your diagnosis for feedback and a score.
            </Text>
            <View style={{ borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 16, padding: space.lg, gap: space.sm }}>
              <Tag>Example opening</Tag>
              <Text style={{ color: t.ink, fontSize: 15 }}>
                <Text style={{ fontWeight: "700" }}>Emergency department, 02:10.</Text> Daniel, 58 M, "crushing" chest pain for 40 minutes.
              </Text>
              <Text style={{ color: t.muted, fontFamily: "monospace", fontSize: 13 }}>HR 104 · BP 148/92 · RR 22 · T 36.9 °C · SpO₂ 94%</Text>
            </View>
          </View>
        }
      />
    </View>
  );
}
