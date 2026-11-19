import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Share, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView as RNWebView } from "react-native-webview";
import type { ComponentType, Ref } from "react";

// react-native-webview 14's iOS/Android/Windows prop types intersect to `never` under
// React Native 0.88's types, so describe the props this screen uses.
type NavState = { canGoBack: boolean; canGoForward: boolean; loading: boolean; url: string };
type WebViewHandle = { goBack(): void; goForward(): void; reload(): void };
const WebView = RNWebView as unknown as ComponentType<{
  ref?: Ref<WebViewHandle>;
  source: { uri: string };
  style?: object;
  allowsInlineMediaPlayback?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  allowsFullscreenVideo?: boolean;
  startInLoadingState?: boolean;
  renderLoading?: () => React.ReactElement;
  onNavigationStateChange?: (s: NavState) => void;
}>;
import { Ionicons } from "@expo/vector-icons";
import { space, useTheme } from "@/lib/theme";

/** An in-app browser for learning websites and YouTube pages. */
export default function Browser() {
  const t = useTheme();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const web = useRef<WebViewHandle>(null);
  const [nav, setNav] = useState({ back: false, forward: false, loading: true, url: url ?? "" });
  const safe = typeof url === "string" && /^https:\/\//.test(url) ? url : "https://www.khanacademy.org";

  const btn = (icon: keyof typeof Ionicons.glyphMap, onPress: () => void, enabled: boolean, label: string) => (
    <Pressable onPress={onPress} disabled={!enabled} accessibilityRole="button" accessibilityLabel={label} style={{ padding: space.sm, opacity: enabled ? 1 : 0.35 }}>
      <Ionicons name={icon} size={22} color={t.ink} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: title ?? "Browser" }} />
      <WebView
        ref={web}
        source={{ uri: safe }}
        style={{ flex: 1 }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        onNavigationStateChange={(s) => setNav({ back: s.canGoBack, forward: s.canGoForward, loading: s.loading, url: s.url })}
        startInLoadingState
        renderLoading={() => (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={t.accent} />
          </View>
        )}
      />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.surface, paddingVertical: space.xs }}>
        {btn("chevron-back", () => web.current?.goBack(), nav.back, "Back")}
        {btn("chevron-forward", () => web.current?.goForward(), nav.forward, "Forward")}
        {btn("refresh", () => web.current?.reload(), true, "Reload")}
        {btn("share-outline", () => Share.share({ message: nav.url }).catch(() => {}), true, "Share link")}
        {nav.loading ? <ActivityIndicator color={t.accent} /> : <Text style={{ width: 22 }} />}
      </View>
    </View>
  );
}
