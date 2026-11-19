import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { api, errorMessage, type Deck } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { radius, space, useTheme } from "@/lib/theme";
import { Button, Field, Tag } from "@/components/ui";

const EXAMPLE: Deck = {
  title: "Diuretics: sites and side effects",
  cards: [
    { front: "Site of action of furosemide?", back: "Thick ascending limb; blocks NKCC2 (Na⁺/K⁺/2Cl⁻)." },
    { front: "Thiazides: effect on serum calcium?", back: "Raises it (more distal Ca²⁺ reabsorption). Useful in calcium stones." },
    { front: "Acetazolamide causes which acid–base disorder?", back: "Normal anion gap (hyperchloremic) metabolic acidosis." },
    { front: "Spironolactone: two classic adverse effects?", back: "Hyperkalemia and gynecomastia." },
  ],
};

export function Cards() {
  const t = useTheme();
  const { subject } = usePrefs();
  const [topic, setTopic] = useState("");
  const [deck, setDeck] = useState<Deck>(EXAMPLE);
  const [isExample, setIsExample] = useState(true);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function make() {
    const tp = topic.trim() || (subject !== "Any" ? `high-yield ${subject}` : "high-yield clinical facts");
    setLoading(true);
    setError(null);
    try {
      const d = await api.flashcards({ topic: tp });
      setDeck(d);
      setIsExample(false);
      setFlipped(new Set());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const toggle = (i: number) =>
    setFlipped((cur) => {
      const n = new Set(cur);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: space.sm }}>
        <Field value={topic} onChangeText={setTopic} placeholder="Topic, e.g. Antiarrhythmics by class" returnKeyType="go" onSubmitEditing={make} />
        <Button title="Make 8 cards" onPress={make} loading={loading} />
        {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}
      </View>

      {loading ? (
        <View style={{ alignItems: "center", gap: space.md, paddingVertical: space.xl }}>
          <ActivityIndicator color={t.accent} />
          <Text style={{ color: t.muted }}>Making your cards…</Text>
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            {isExample ? <Tag>Example deck</Tag> : null}
            <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>{deck.title}</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>Tap a card to flip it.</Text>
          </View>
          {deck.cards.map((c, i) => {
            const back = flipped.has(i);
            return (
              <Pressable
                key={i}
                onPress={() => toggle(i)}
                accessibilityRole="button"
                accessibilityHint="Flips the card"
                style={{
                  minHeight: 120,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: back ? "transparent" : t.line,
                  backgroundColor: back ? t.accentSoft : t.surface,
                  padding: space.lg,
                  gap: space.sm,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>{back ? "Answer" : `Card ${i + 1}`}</Text>
                <Text style={{ color: t.ink, fontSize: 17, fontWeight: back ? "400" : "600", lineHeight: 24 }}>{back ? c.back : c.front}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
