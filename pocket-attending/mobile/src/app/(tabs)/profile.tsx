import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { space, useTheme } from "@/lib/theme";
import { Button, Card } from "@/components/ui";

const ROLE_NAME = { student: "Medical student", resident: "Resident", practitioner: "Practitioner" } as const;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

export default function ProfileScreen() {
  const t = useTheme();
  const { user, profile, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState<"out" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  const rows: [string, string | undefined][] = [
    ["Role", ROLE_NAME[profile.role]],
    ["Name", profile.displayName],
    [profile.role === "resident" ? "Institution" : "University", profile.university],
    ["Year of study", profile.yearOfStudy ? `Year ${profile.yearOfStudy}` : undefined],
    ["Specialty", profile.specialty],
    ["Postgraduate year", profile.pgyYear ? `PGY-${profile.pgyYear}` : undefined],
    ["Exam", profile.exam],
    ["Country", profile.country],
    ["Signed in as", user?.email ?? undefined],
  ];

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile and sign-in. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setBusy("delete");
            setError(null);
            try {
              await deleteAccount();
              router.replace("/sign-in");
            } catch (e) {
              setError(errorMessage(e));
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Card style={{ gap: space.md }}>
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.lg }}>
              <Text style={{ color: t.muted, fontSize: 15 }}>{k}</Text>
              <Text style={{ color: t.ink, fontSize: 15, flexShrink: 1, textAlign: "right" }}>{v}</Text>
            </View>
          ))}
      </Card>
      <Button title="Edit profile" variant="quiet" onPress={() => router.push("/onboarding")} />
      {PRIVACY_URL ? <Button title="Privacy policy" variant="quiet" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} /> : null}
      <Button
        title="Sign out"
        variant="quiet"
        loading={busy === "out"}
        disabled={!!busy}
        onPress={async () => {
          setBusy("out");
          await signOut();
          router.replace("/sign-in");
        }}
      />
      <Button title="Delete account" variant="danger" loading={busy === "delete"} disabled={!!busy} onPress={confirmDelete} />
      {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}
      <Text style={{ color: t.muted, fontSize: 12.5, lineHeight: 18 }}>
        Pocket Attending is for education and clinical decision support. AI answers can be wrong or out of date. Verify them, follow local protocols, and never use the app as the only basis for patient care.
      </Text>
    </ScrollView>
  );
}
