import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { searchUniversities } from "@/lib/catalog";
import { radius, space, useTheme } from "@/lib/theme";
import { Field } from "./ui";

type Props = {
  value: string;
  onChange(name: string, country?: string): void;
  placeholder?: string;
};

/**
 * Search the built-in list, or keep whatever the person typed if their school isn't in it.
 * Uses a plain list (not a FlatList) so it can sit inside a ScrollView.
 */
export function UniversityPicker({ value, onChange, placeholder }: Props) {
  const t = useTheme();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => searchUniversities(query), [query]);
  const exact = hits.some((h) => h.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <View>
      <Field
        value={query}
        onChangeText={(q) => {
          setQuery(q);
          setOpen(true);
          onChange(q); // free text counts until they pick from the list
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? "Start typing, e.g. Muhimbili or Nairobi"}
        autoCorrect={false}
        accessibilityLabel="University"
      />
      {open && query.trim().length > 1 ? (
        <View style={{ marginTop: space.xs, borderWidth: 1, borderColor: t.line, borderRadius: radius.md, backgroundColor: t.surface, overflow: "hidden" }}>
          {hits.map((u) => (
            <Pressable
              key={u.name}
              onPress={() => {
                setQuery(u.name);
                setOpen(false);
                onChange(u.name, u.country);
              }}
              style={({ pressed }) => ({ padding: space.md, backgroundColor: pressed ? t.sunk : "transparent", borderBottomWidth: 1, borderBottomColor: t.line })}
            >
              <Text style={{ color: t.ink, fontSize: 15 }}>{u.name}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>{u.country}</Text>
            </Pressable>
          ))}
          {!exact ? (
            <Pressable onPress={() => setOpen(false)} style={({ pressed }) => ({ padding: space.md, backgroundColor: pressed ? t.sunk : "transparent" })}>
              <Text style={{ color: t.accent, fontSize: 15, fontWeight: "600" }}>Use "{query.trim()}"</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>{hits.length ? "Not listed above? Keep what you typed." : "Not in our list yet. Keep what you typed."}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
