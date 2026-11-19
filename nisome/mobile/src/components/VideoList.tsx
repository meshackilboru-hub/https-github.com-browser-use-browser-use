import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, errorMessage, type Video } from "@/lib/api";
import { SOURCES } from "@/lib/catalog";
import { radius, space, useTheme } from "@/lib/theme";
import { Button } from "./ui";

export function openVideo(v: Pick<Video, "id" | "title" | "channel">) {
  router.push({ pathname: "/video/[id]", params: { id: v.id, title: v.title, channel: v.channel } });
}

export function openSite(url: string, title: string) {
  router.push({ pathname: "/browser", params: { url, title } });
}

/** Tutorial videos for a search, playable inside the app. */
export function VideoList({ query, limit = 8 }: { query: string; limit?: number }) {
  const t = useTheme();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let live = true;
    setVideos(null);
    setError(null);
    api
      .findVideos({ query })
      .then((r) => {
        if (!live) return;
        setVideos(r.videos);
        setFallback(r.fallback);
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [query]);

  const youtube = SOURCES[0].search!(query);
  if (error) return <Text style={{ color: t.bad }}>{error}</Text>;
  if (!videos) return <ActivityIndicator color={t.accent} style={{ marginVertical: space.lg }} />;
  if (fallback || !videos.length)
    return <Button title={`Search YouTube for "${query}"`} variant="ghost" onPress={() => openSite(youtube, "YouTube")} />;

  return (
    <View style={{ gap: space.md }}>
      {videos.slice(0, limit).map((v) => (
        <Pressable
          key={v.id}
          onPress={() => openVideo(v)}
          accessibilityRole="button"
          accessibilityLabel={`Play ${v.title} by ${v.channel}`}
          style={({ pressed }) => ({ flexDirection: "row", gap: space.md, opacity: pressed ? 0.7 : 1 })}
        >
          <View>
            <Image source={{ uri: v.thumbnail }} style={{ width: 132, height: 74, borderRadius: radius.sm, backgroundColor: t.sunk }} />
            <View style={{ position: "absolute", right: 6, bottom: 6, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 12, padding: 3 }}>
              <Ionicons name="play" size={14} color="#fff" />
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={2} style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>{v.title}</Text>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>{v.channel}</Text>
            {v.trusted ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="shield-checkmark" size={13} color={t.good} />
                <Text style={{ color: t.good, fontSize: 12, fontWeight: "600" }}>Medical educator</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ))}
      <Button title="More on YouTube" variant="quiet" onPress={() => openSite(youtube, "YouTube")} />
    </View>
  );
}
