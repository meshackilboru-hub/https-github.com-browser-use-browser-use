import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { PrefsProvider } from "@/lib/prefs";
import { useTheme } from "@/lib/theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PrefsProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: t.bg },
              headerStyle: { backgroundColor: t.surface },
              headerTintColor: t.ink,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="onboarding" options={{ headerShown: true, title: "Your profile" }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="doc/[id]" options={{ headerShown: true, title: "" }} />
            <Stack.Screen name="video/[id]" options={{ headerShown: true, title: "Video" }} />
            <Stack.Screen name="browser" options={{ headerShown: true, title: "" }} />
          </Stack>
        </PrefsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
