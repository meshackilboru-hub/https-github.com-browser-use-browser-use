import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, errorMessage, type Turn } from "@/lib/api";
import { radius, space, useTheme } from "@/lib/theme";
import { Markdown } from "./Markdown";

export type ChatHandle = {
  send(text: string): void;
  reset(firstUserMessage?: string): void;
  setDraft(text: string): void;
};

type Props = {
  mode: "tutor" | "case";
  subject?: string;
  socratic?: boolean;
  placeholder: string;
  /** Shown while the conversation is empty. */
  empty: ReactNode;
  /** Extra controls under the input. */
  footer?: ReactNode;
  /** Hide this many leading turns from the transcript (e.g. a "Start a case" kickoff). */
  hiddenTurns?: number;
  /** Block typing until the screen is ready (e.g. before a case starts). */
  locked?: boolean;
  /** Answers the conversation; defaults to the general tutor/case chat. */
  respond?: (turns: Turn[]) => Promise<string>;
};

export const ChatView = forwardRef<ChatHandle, Props>(function ChatView(
  { mode, subject, socratic, placeholder, empty, footer, hiddenTurns = 0, locked = false, respond },
  ref,
) {
  const t = useTheme();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  // Ignore replies to a conversation the person has since reset.
  const generation = useRef(0);

  async function run(next: Turn[]) {
    const gen = generation.current;
    setTurns(next);
    setBusy(true);
    setError(null);
    try {
      const text = respond ? await respond(next) : (await api.chat({ mode, messages: next, subject, socratic })).text;
      if (gen !== generation.current) return;
      setTurns([...next, { role: "assistant", content: text }]);
    } catch (e) {
      if (gen !== generation.current) return;
      setError(errorMessage(e));
      setTurns(next.slice(0, -1)); // drop the unanswered turn so it can be resent
      if (next.length > hiddenTurns) setDraft(next[next.length - 1].content);
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }

  function send(text: string) {
    const v = text.trim();
    if (!v || busy || locked) return;
    setDraft("");
    run([...turns, { role: "user", content: v }]);
  }

  useImperativeHandle(ref, () => ({
    send,
    setDraft,
    reset(first) {
      generation.current++;
      setBusy(false);
      setError(null);
      setDraft("");
      if (first) run([{ role: "user", content: first }]);
      else setTurns([]);
    },
  }));

  const visible = turns.slice(hiddenTurns);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {visible.length === 0 && !busy ? empty : null}
        {visible.map((m, i) =>
          m.role === "user" ? (
            <View key={i} style={[styles.user, { backgroundColor: t.accentSoft }]}>
              <Text selectable style={{ color: t.ink, fontSize: 16, lineHeight: 22 }}>{m.content}</Text>
            </View>
          ) : (
            <View key={i} style={styles.bot}>
              <View style={[styles.avatar, { backgroundColor: t.ink }]}>
                <Text style={{ color: t.bg, fontSize: 11, fontWeight: "700" }}>N</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Markdown>{m.content}</Markdown>
              </View>
            </View>
          ),
        )}
        {busy ? (
          <View style={[styles.bot, { alignItems: "center" }]}>
            <View style={[styles.avatar, { backgroundColor: t.ink }]}>
              <Text style={{ color: t.bg, fontSize: 11, fontWeight: "700" }}>N</Text>
            </View>
            <ActivityIndicator color={t.accent} />
            <Text style={{ color: t.muted, fontStyle: "italic" }}>Thinking…</Text>
          </View>
        ) : null}
        {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.composer, { borderTopColor: t.line, backgroundColor: t.surface }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={t.muted}
            multiline
            editable={!locked}
            style={[styles.input, { borderColor: t.line, backgroundColor: t.bg, color: t.ink }]}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={busy || locked || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.send, { backgroundColor: t.accent, opacity: busy || locked || !draft.trim() ? 0.4 : 1 }]}
          >
            <Ionicons name="arrow-up" size={22} color={t.accentInk} />
          </Pressable>
        </View>
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  user: { alignSelf: "flex-end", maxWidth: "88%", borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  bot: { flexDirection: "row", gap: space.md },
  avatar: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  composer: { borderTopWidth: 1, padding: space.md, gap: space.sm },
  input: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, fontSize: 16, maxHeight: 140 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
