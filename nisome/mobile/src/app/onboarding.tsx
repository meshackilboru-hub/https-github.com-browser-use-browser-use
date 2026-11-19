import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, type Profile, type Role } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { EXAMS, SPECIALTIES } from "@/lib/catalog";
import { radius, space, useTheme } from "@/lib/theme";
import { Button, ChipWrap, Field, Label } from "@/components/ui";
import { UniversityPicker } from "@/components/UniversityPicker";

const ROLES: { role: Role; title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: "student", title: "Medical student", body: "Tutoring, exam-style questions and cases matched to your year.", icon: "school-outline" },
  { role: "resident", title: "Resident", body: "Board-level prep and complex cases in your specialty.", icon: "medkit-outline" },
  { role: "practitioner", title: "Practitioner", body: "Guideline-based clinical reference and CME self-tests.", icon: "pulse-outline" },
];

export default function Onboarding() {
  const t = useTheme();
  const { user, profile, saveProfile } = useAuth();
  const editing = !!profile;
  const [p, setP] = useState<Profile>(
    profile ?? { role: "student", displayName: user?.displayName ?? "", yearOfStudy: 1 },
  );
  const [roleChosen, setRoleChosen] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Redirect href="/sign-in" />;

  const set = (patch: Partial<Profile>) => setP((cur) => ({ ...cur, ...patch }));
  const needsUniversity = p.role !== "practitioner";
  const needsSpecialty = p.role !== "student";
  const valid =
    (!needsUniversity || (p.university ?? "").trim().length >= 2) &&
    (!needsSpecialty || (p.specialty ?? "").trim().length >= 2) &&
    (p.displayName ?? "").trim().length >= 1;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveProfile(p);
      if (editing && router.canGoBack()) router.back();
      else router.replace("/library");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!roleChosen) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
        <Text style={{ color: t.ink, fontSize: 24, fontWeight: "800" }}>Which describes you?</Text>
        <Text style={{ color: t.muted, fontSize: 15 }}>This sets how deep explanations go and what kind of questions you get. You can change it later.</Text>
        {ROLES.map((r) => (
          <Pressable
            key={r.role}
            accessibilityRole="button"
            onPress={() => {
              set({ role: r.role });
              setRoleChosen(true);
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: space.md,
              padding: space.lg,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: pressed ? t.accent : t.line,
              backgroundColor: t.surface,
            })}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={r.icon} size={22} color={t.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.ink, fontSize: 17, fontWeight: "700" }}>{r.title}</Text>
              <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{r.body}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.muted} style={{ alignSelf: "center" }} />
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <View>
          <Label>I am a</Label>
          <ChipWrap
            options={ROLES.map((r) => r.title)}
            value={ROLES.find((r) => r.role === p.role)?.title}
            onChange={(title) => set({ role: ROLES.find((r) => r.title === title)!.role })}
          />
        </View>

        <View>
          <Label>Your name</Label>
          <Field value={p.displayName} onChangeText={(v) => set({ displayName: v })} placeholder="Name" autoComplete="name" />
        </View>

        {needsUniversity ? (
          <View>
            <Label hint={p.role === "resident" ? "Where you're doing your residency." : "Pick from the list or type your university's name."}>
              {p.role === "resident" ? "University or training institution" : "University"}
            </Label>
            <UniversityPicker
              value={p.university ?? ""}
              onChange={(name, country) => set(country ? { university: name, country } : { university: name })}
            />
          </View>
        ) : null}

        {p.role === "student" ? (
          <>
            <View>
              <Label>Year of study</Label>
              <ChipWrap
                options={["1", "2", "3", "4", "5", "6", "7"]}
                value={String(p.yearOfStudy ?? 1)}
                onChange={(v) => set({ yearOfStudy: Number(v) })}
              />
            </View>
            <View>
              <Label hint="Optional. Practice questions follow this exam's style.">Exam you're preparing for</Label>
              <ChipWrap options={EXAMS} value={p.exam} onChange={(v) => set({ exam: p.exam === v ? undefined : v })} />
            </View>
          </>
        ) : null}

        {needsSpecialty ? (
          <View>
            <Label hint="Pick one or type your own.">Specialty</Label>
            <Field value={p.specialty} onChangeText={(v) => set({ specialty: v })} placeholder="e.g. Internal Medicine" style={{ marginBottom: space.sm }} />
            <ChipWrap options={SPECIALTIES} value={p.specialty} onChange={(v) => set({ specialty: v })} />
          </View>
        ) : null}

        {p.role === "resident" ? (
          <View>
            <Label>Postgraduate year</Label>
            <ChipWrap
              options={["1", "2", "3", "4", "5", "6", "7", "8"].map((n) => `PGY-${n}`)}
              value={`PGY-${p.pgyYear ?? 1}`}
              onChange={(v) => set({ pgyYear: Number(v.slice(4)) })}
            />
          </View>
        ) : null}

        <View>
          <Label hint="Helps match guidelines and drug availability to where you work.">Country</Label>
          <Field value={p.country} onChangeText={(v) => set({ country: v })} placeholder="e.g. Tanzania" autoComplete="country" />
        </View>

        {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}
        <Button title={editing ? "Save changes" : "Start studying"} onPress={save} loading={saving} disabled={!valid} />
        {!valid ? (
          <Text style={{ color: t.muted, fontSize: 13, marginTop: -space.md }}>
            {needsUniversity && (p.university ?? "").trim().length < 2
              ? "Add your university to continue."
              : needsSpecialty && (p.specialty ?? "").trim().length < 2
                ? "Add your specialty to continue."
                : "Add your name to continue."}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
