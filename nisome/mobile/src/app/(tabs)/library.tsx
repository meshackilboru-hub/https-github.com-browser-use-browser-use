import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { deleteDoc, doc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { errorMessage, type LibraryDoc } from "@/lib/api";
import { masteryPercent, useLibrary } from "@/lib/library";
import { pickDocument, pickImage, uploadFile, type PickedFile } from "@/lib/upload";
import { radius, space, useTheme } from "@/lib/theme";
import { Banner, Button, Card, ProgressBar } from "@/components/ui";

function statusText(d: LibraryDoc): string {
  switch (d.status) {
    case "uploading":
      return "Uploading…";
    case "processing":
      return d.progress && d.progress.total > 1 ? `Reading part ${Math.min(d.progress.done + 1, d.progress.total)} of ${d.progress.total}…` : "Reading and summarizing…";
    case "error":
      return d.error ?? "Couldn't process this file.";
    case "ready": {
      const m = masteryPercent(d.mastery);
      return [d.pageCount ? `${d.pageCount} pages` : null, m !== null ? `${m}% correct so far` : "Ready to study"].filter(Boolean).join(" · ");
    }
  }
}

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = { pdf: "document-text-outline", image: "image-outline", other: "document-outline" };

export default function Library() {
  const t = useTheme();
  const { user } = useAuth();
  const docs = useLibrary();
  const [upload, setUpload] = useState<{ name: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(pick: () => Promise<PickedFile | null>) {
    setError(null);
    try {
      const file = await pick();
      if (!file) return;
      setUpload({ name: file.name, progress: 0 });
      const id = await uploadFile(file, (p) => setUpload({ name: file.name, progress: p }));
      setUpload(null);
      router.push({ pathname: "/doc/[id]", params: { id } });
    } catch (e) {
      setUpload(null);
      setError(e instanceof Error && !("code" in e) ? e.message : errorMessage(e));
    }
  }

  function remove(d: LibraryDoc) {
    Alert.alert(`Delete "${d.title}"?`, "Its summary, questions and your progress will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => user && deleteDoc(doc(db, "users", user.uid, "docs", d.id)).catch((e) => setError(errorMessage(e))) },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Card style={{ gap: space.md }}>
        <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>Study your own material</Text>
        <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>
          Upload a lecture PDF, paper, textbook, Word file or a photo of your notes. Nisome summarizes it, quizzes you on it, corrects your answers and brings back what you miss.
        </Text>
        {upload ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: t.ink }} numberOfLines={1}>Uploading {upload.name}… {Math.round(upload.progress * 100)}%</Text>
            <ProgressBar value={upload.progress} />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <Button title="Upload a file" icon={<Ionicons name="cloud-upload-outline" size={18} color={t.accentInk} />} onPress={() => start(pickDocument)} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button title="Take photo" variant="quiet" style={{ flex: 1 }} icon={<Ionicons name="camera-outline" size={18} color={t.ink} />} onPress={() => start(() => pickImage("camera"))} />
              <Button title="From photos" variant="quiet" style={{ flex: 1 }} icon={<Ionicons name="images-outline" size={18} color={t.ink} />} onPress={() => start(() => pickImage("library"))} />
            </View>
            <Text style={{ color: t.muted, fontSize: 12.5 }}>PDF, Word (.docx), text or image · up to 200 MB and 2,000 pages</Text>
          </View>
        )}
        {error ? <Banner tone="bad">{error}</Banner> : null}
      </Card>

      {docs === null ? null : docs.length === 0 ? (
        <Text style={{ color: t.muted, textAlign: "center", marginTop: space.lg }}>Your uploads will appear here.</Text>
      ) : (
        <View style={{ gap: space.sm }}>
          {docs.map((d) => {
            const icon = d.mimeType === "application/pdf" ? ICON.pdf : d.mimeType.startsWith("image/") ? ICON.image : ICON.other;
            return (
              <Pressable
                key={d.id}
                onPress={() => router.push({ pathname: "/doc/[id]", params: { id: d.id } })}
                onLongPress={() => remove(d)}
                accessibilityRole="button"
                accessibilityHint="Opens the document. Long-press to delete."
                style={({ pressed }) => ({ flexDirection: "row", gap: space.md, alignItems: "center", padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: pressed ? t.accent : t.line, backgroundColor: t.surface })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={icon} size={20} color={t.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: t.ink, fontSize: 16, fontWeight: "600" }}>{d.summary?.title || d.title}</Text>
                  <Text numberOfLines={2} style={{ color: d.status === "error" ? t.bad : t.muted, fontSize: 13 }}>{statusText(d)}</Text>
                  {d.status === "processing" && d.progress && d.progress.total > 1 ? <ProgressBar value={d.progress.done / d.progress.total} /> : null}
                </View>
                <Pressable onPress={() => remove(d)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete ${d.title}`}>
                  <Ionicons name="trash-outline" size={18} color={t.muted} />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
