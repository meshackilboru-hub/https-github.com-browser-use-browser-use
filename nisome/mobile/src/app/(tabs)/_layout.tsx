import { Redirect, Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const t = useTheme();
  const { user, profile, loading } = useAuth();
  if (!loading && !user) return <Redirect href="/sign-in" />;
  if (!loading && !profile) return <Redirect href="/onboarding" />;
  const pro = profile?.role === "practitioner";

  const icon =
    (name: keyof typeof Ionicons.glyphMap) =>
    ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        headerStyle: { backgroundColor: t.surface },
        headerTitleStyle: { color: t.ink, fontWeight: "700" },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="library" options={{ title: "Library", tabBarIcon: icon("library-outline") }} />
      <Tabs.Screen name="tutor" options={{ title: pro ? "Ask" : "Tutor", tabBarIcon: icon("chatbubbles-outline") }} />
      <Tabs.Screen name="practice" options={{ title: "Practice", tabBarIcon: icon("checkbox-outline") }} />
      <Tabs.Screen name="videos" options={{ title: "Videos", tabBarIcon: icon("play-circle-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person-circle-outline") }} />
    </Tabs>
  );
}
