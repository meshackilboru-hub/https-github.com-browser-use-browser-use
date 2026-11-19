import { useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import YoutubePlayer from "react-native-youtube-iframe";
import { space, useTheme } from "@/lib/theme";
import { Banner, Button } from "@/components/ui";
import { VideoList, openSite } from "@/components/VideoList";

/** Plays a YouTube tutorial inside the app. */
export default function VideoScreen() {
  const t = useTheme();
  const { id, title, channel } = useLocalSearchParams<{ id: string; title?: string; channel?: string }>();
  const { width } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  const watchUrl = `https://m.youtube.com/watch?v=${encodeURIComponent(id)}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingBottom: space.xl }}>
      <Stack.Screen options={{ headerShown: true, title: "Video" }} />
      <View style={{ backgroundColor: "#000" }}>
        <YoutubePlayer height={(width * 9) / 16} width={width} videoId={id} play onError={() => setFailed(true)} initialPlayerParams={{ modestbranding: true, rel: false }} />
      </View>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text style={{ color: t.ink, fontSize: 18, fontWeight: "700" }}>{title}</Text>
        {channel ? <Text style={{ color: t.muted }}>{channel}</Text> : null}
        {failed ? (
          <>
            <Banner>This video can't play in the embedded player. Watch it on YouTube's page instead, still inside Nisome.</Banner>
            <Button title="Watch on YouTube page" onPress={() => openSite(watchUrl, "YouTube")} />
          </>
        ) : null}
        {title ? (
          <View style={{ gap: space.md, marginTop: space.md }}>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" }}>Related videos</Text>
            <VideoList query={title.split(/[|\-–:(]/)[0].trim().slice(0, 80)} limit={5} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
