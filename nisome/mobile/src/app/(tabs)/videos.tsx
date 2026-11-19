import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLibrary } from "@/lib/library";
import { SOURCES } from "@/lib/catalog";
import { radius, space, useTheme } from "@/lib/theme";
import { Chip, Field } from "@/components/ui";
import { VideoList, openSite } from "@/components/VideoList";

const DEFAULTS = ["Cardiac cycle", "Acid-base interpretation", "Brachial plexus", "Antibiotics classes", "ECG basics"];

/** Tutorial videos and learning websites, all opened inside the app. */
export default function Videos() {
  const t = useTheme();
  const docs = useLibrary();
  const fromLibrary = (docs ?? []).flatMap((d) => d.summary?.videoQueries?.slice(0, 2) ?? []).slice(0, 6);
  const suggestions = Array.from(new Set([...fromLibrary, ...DEFAULTS])).slice(0, 8);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState(suggestions[0]);
  const h = { color: t.muted, fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.8, textTransform: "uppercase" as const };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <Field
        value={draft}
        onChangeText={setDraft}
        placeholder="Search tutorial videos, e.g. nephron physiology"
        returnKeyType="search"
        onSubmitEditing={() => draft.trim().length > 1 && setQuery(draft.trim())}
        accessibilityLabel="Search videos"
      />
      <View style={{ gap: space.sm }}>
        <Text style={h}>{fromLibrary.length ? "From your library" : "Popular topics"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} selected={s === query} onPress={() => setQuery(s)} />
          ))}
        </ScrollView>
      </View>
      <VideoList query={query} />

      <View style={{ gap: space.sm }}>
        <Text style={h}>Learning websites</Text>
        {SOURCES.map((src) => (
          <Pressable
            key={src.name}
            onPress={() => openSite(src.search && query ? src.search(query) : src.home, src.name)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: pressed ? t.accent : t.line, backgroundColor: t.surface })}
          >
            <Ionicons name="globe-outline" size={20} color={t.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>{src.name}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>{src.search ? `Search "${query}" · ` : ""}{src.about}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.muted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
