import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { api, errorMessage, type LibraryDoc } from "@/lib/api";
import { masteryPercent, useDocQuestions, useLibraryDoc } from "@/lib/library";
import { radius, space, useTheme } from "@/lib/theme";
import { Markdown } from "@/components/Markdown";
import { ChatView, type ChatHandle } from "@/components/ChatView";
import { QuestionCard } from "@/components/QuestionCard";
import { VideoList } from "@/components/VideoList";
import { Banner, Button, Card, Chip, ProgressBar, Segmented } from "@/components/ui";

type Tab = "summary" | "questions" | "chat" | "videos";

export default function DocScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useLibraryDoc(id);
  const [tab, setTab] = useState<Tab>("summary");
  const chat = useRef<ChatHandle>(null);

  const title = d?.summary?.title || d?.title || "Document";
  const header = <Stack.Screen options={{ headerShown: true, title }} />;

  if (d === undefined)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {header}
        <ActivityIndicator color={t.accent} />
      </View>
    );
  if (d === null)
    return (
      <View style={{ flex: 1, padding: space.xl }}>
        {header}
        <Text style={{ color: t.muted }}>This document was deleted.</Text>
      </View>
    );
  if (d.status !== "ready") return <Processing d={d} header={header} />;

  return (
    <View style={{ flex: 1 }}>
      {header}
      <View style={{ padding: space.md, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.line }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "summary", label: "Summary" },
            { value: "questions", label: "Quiz" },
            { value: "chat", label: "Ask" },
            { value: "videos", label: "Videos" },
          ]}
        />
      </View>
      {tab === "summary" ? <Summary d={d} /> : null}
      {tab === "questions" ? (
        <Questions
          d={d}
          onDiscuss={(text) => {
            setTab("chat");
            // Let the chat mount before handing it the message.
            setTimeout(() => chat.current?.send(text), 50);
          }}
        />
      ) : null}
      <View style={{ flex: 1, display: tab === "chat" ? "flex" : "none" }}>
        <ChatView
          ref={chat}
          mode="tutor"
          placeholder={`Ask about "${title}"…`}
          respond={async (turns) => (await api.docChat({ docId: d.id, messages: turns })).text}
          empty={
            <View style={{ gap: space.md }}>
              <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>Ask about this material</Text>
              <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>
                Answers come from your file, with page references. Try explaining a concept in your own words: Nisome will tell you if anything is wrong and correct it.
              </Text>
              {(d.summary?.keyPoints ?? []).slice(0, 3).map((k) => (
                <Pressable key={k} onPress={() => chat.current?.send(`Explain this in more depth: ${k}`)} style={({ pressed }) => ({ borderWidth: 1, borderColor: pressed ? t.accent : t.line, backgroundColor: t.surface, borderRadius: 12, padding: space.md })}>
                  <Text style={{ color: t.ink, fontSize: 15 }} numberOfLines={3}>Explain: {k}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      </View>
      {tab === "videos" ? <Videos d={d} /> : null}
    </View>
  );
}

function Processing({ d, header }: { d: LibraryDoc; header: React.ReactNode }) {
  const t = useTheme();
  const p = d.progress;
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
      {header}
      {d.status === "error" ? (
        <Banner tone="bad">{d.error ?? "We couldn't process this file."}</Banner>
      ) : (
        <Card style={{ gap: space.md }}>
          <ActivityIndicator color={t.accent} />
          <Text style={{ color: t.ink, fontSize: 17, fontWeight: "700", textAlign: "center" }}>
            {d.status === "uploading" ? "Uploading…" : p && p.total > 1 ? `Reading part ${Math.min(p.done + 1, p.total)} of ${p.total}` : "Reading your file"}
          </Text>
          {p && p.total > 1 ? <ProgressBar value={p.done / p.total} /> : null}
          <Text style={{ color: t.muted, textAlign: "center", lineHeight: 20 }}>
            {d.pageCount ? `${d.pageCount} pages. ` : ""}A lecture takes under a minute; a full textbook can take several. You can leave this screen. Your summary and first questions will be waiting.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

function Summary({ d }: { d: LibraryDoc }) {
  const t = useTheme();
  const s = d.summary!;
  const pct = masteryPercent(d.mastery);
  const concepts = Object.entries(d.mastery ?? {}).sort((a, b) => b[1].wrong - b[1].right - (a[1].wrong - a[1].right));
  const h = { color: t.muted, fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.8, textTransform: "uppercase" as const };
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Text style={{ color: t.ink, fontSize: 22, fontWeight: "800" }}>{s.title}</Text>
      <Markdown>{s.overview}</Markdown>

      {pct !== null ? (
        <Card style={{ gap: space.sm }}>
          <Text style={h}>Your progress</Text>
          <Text style={{ color: t.ink, fontSize: 16 }}>{pct}% of answers correct</Text>
          <ProgressBar value={pct / 100} />
          {concepts.slice(0, 6).map(([c, m]) => (
            <View key={c} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
              <Text style={{ color: t.ink, flex: 1 }} numberOfLines={1}>{c}</Text>
              <Text style={{ color: m.wrong > m.right ? t.bad : t.good, fontVariant: ["tabular-nums"] }}>{m.right}/{m.right + m.wrong}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Text style={h}>Key points</Text>
        {s.keyPoints.map((k, i) => (
          <View key={i} style={{ flexDirection: "row", gap: space.sm }}>
            <Text style={{ color: t.accent, fontWeight: "700" }}>•</Text>
            <Text style={{ color: t.ink, fontSize: 15.5, lineHeight: 22, flex: 1 }}>{k}</Text>
          </View>
        ))}
      </View>

      {s.sections.length ? (
        <View style={{ gap: space.sm }}>
          <Text style={h}>Sections</Text>
          {s.sections.map((x, i) => (
            <Card key={i} style={{ gap: 4, padding: space.md }}>
              <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15.5 }}>
                {x.heading}
                {x.pages ? <Text style={{ color: t.muted, fontWeight: "400" }}>  {x.pages}</Text> : null}
              </Text>
              <Text style={{ color: t.ink, fontSize: 14.5, lineHeight: 21 }}>{x.summary}</Text>
            </Card>
          ))}
        </View>
      ) : null}

      {s.glossary.length ? (
        <View style={{ gap: space.sm }}>
          <Text style={h}>Glossary</Text>
          {s.glossary.map((g, i) => (
            <Text key={i} style={{ color: t.ink, fontSize: 14.5, lineHeight: 21 }}>
              <Text style={{ fontWeight: "700" }}>{g.term}: </Text>
              {g.definition}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Questions({ d, onDiscuss }: { d: LibraryDoc; onDiscuss(text: string): void }) {
  const t = useTheme();
  const qs = useDocQuestions(d.id);
  const [filter, setFilter] = useState<"due" | "all">("due");
  const [busy, setBusy] = useState<"next" | "weak" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Answering moves a question's review date forward; keep it on screen so the
  // correction stays readable until the person leaves this screen.
  const pinned = useRef(new Set<string>());
  const now = Date.now();
  const due = (qs ?? []).filter((q) => (q.dueAt?.toMillis() ?? 0) <= now || pinned.current.has(q.id));
  due.forEach((q) => pinned.current.add(q.id));
  const list = filter === "due" ? due : (qs ?? []);
  const hasWeak = Object.values(d.mastery ?? {}).some((m) => m.wrong > 0 && m.wrong >= m.right);

  async function more(focus: "next" | "weak") {
    setBusy(focus);
    setError(null);
    try {
      await api.docQuestions({ docId: d.id, count: 5, focus });
      setFilter("due");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Chip label={`To answer (${due.filter((q) => (q.dueAt?.toMillis() ?? 0) <= now).length})`} selected={filter === "due"} onPress={() => setFilter("due")} />
        <Chip label={`All (${qs?.length ?? 0})`} selected={filter === "all"} onPress={() => setFilter("all")} />
      </View>
      {qs === null ? <ActivityIndicator color={t.accent} /> : null}
      {qs && list.length === 0 ? (
        <Card style={{ gap: space.sm }}>
          <Text style={{ color: t.ink, fontSize: 16, fontWeight: "700" }}>{qs.length ? "All caught up" : "No questions yet"}</Text>
          <Text style={{ color: t.muted }}>
            {qs.length ? "Questions you miss come back here when they're due. Get new ones below." : "Generate questions from this material below."}
          </Text>
        </Card>
      ) : null}
      {list.map((q) => (
        <QuestionCard key={q.id} docId={d.id} q={q} onDiscuss={onDiscuss} />
      ))}
      {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}
      <Button title="5 new questions" onPress={() => more("next")} loading={busy === "next"} disabled={!!busy} />
      {hasWeak ? <Button title="Practice my weak spots" variant="ghost" onPress={() => more("weak")} loading={busy === "weak"} disabled={!!busy} /> : null}
      <Text style={{ color: t.muted, fontSize: 12.5, textAlign: "center" }}>New questions appear here as soon as they're written.</Text>
    </ScrollView>
  );
}

function Videos({ d }: { d: LibraryDoc }) {
  const t = useTheme();
  const queries = d.summary?.videoQueries?.length ? d.summary.videoQueries : [d.title];
  const [q, setQ] = useState(queries[0]);
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <Text style={{ color: t.muted, fontSize: 14 }}>Tutorial videos on the topics in this material. They play here in the app.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {queries.map((x) => (
          <Chip key={x} label={x} selected={x === q} onPress={() => setQ(x)} />
        ))}
      </ScrollView>
      <View style={{ borderRadius: radius.lg }}>
        <VideoList query={q} />
      </View>
    </ScrollView>
  );
}
