import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

/** Sends people to sign-in, profile setup, or the app, depending on where they are. */
export default function Gate() {
  const { user, profile, loading } = useAuth();
  const t = useTheme();
  if (loading)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} size="large" />
      </View>
    );
  if (!user) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/tutor" />;
}
