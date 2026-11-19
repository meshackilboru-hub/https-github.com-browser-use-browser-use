// Tutorial video search through the YouTube Data API. The free quota allows about
// 100 searches a day per project, so results are cached in Firestore for a week.
// Without a key the app falls back to YouTube's own search page inside the app.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db, parse } from "./common.js";

// A Google Cloud API key restricted to "YouTube Data API v3". Put it in functions/.env.
const YOUTUBE_API_KEY = defineString("YOUTUBE_API_KEY", { default: "" });

/** Medical education channels shown first and marked as trusted. */
const TRUSTED = [
  "osmosis",
  "ninja nerd",
  "armando hasudungan",
  "khan academy medicine",
  "medcram",
  "lecturio medical",
  "geeky medics",
  "zero to finals",
  "strong medicine",
  "dirty medicine",
  "speedy pathology",
  "medicosis perfectionalis",
  "rhesus medicine",
  "radiopaedia",
  "who",
];

const isTrusted = (channel: string) => {
  const c = channel.toLowerCase();
  return TRUSTED.some((t) => c === t || c.startsWith(t + " ") || c.includes(t + " "));
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export type Video = { id: string; title: string; channel: string; thumbnail: string; publishedAt: string; trusted: boolean };

const Input = z.object({ query: z.string().min(2).max(120) });

export const findVideos = onCall({ timeoutSeconds: 30 }, async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const { query } = parse(Input, req.data);
  const key = YOUTUBE_API_KEY.value();
  if (!key) return { videos: [] as Video[], fallback: true };

  const q = query.trim().toLowerCase();
  const cacheRef = db.doc(`videoCache/${createHash("sha256").update(q).digest("hex").slice(0, 40)}`);
  const cached = await cacheRef.get();
  if (cached.exists && (cached.data()!.expiresAt as Timestamp).toMillis() > Date.now()) {
    return { videos: cached.data()!.videos as Video[], fallback: false };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "15",
    q: `${query} medical lecture`,
    videoEmbeddable: "true",
    safeSearch: "strict",
    relevanceLanguage: "en",
    key,
  }).toString();

  const res = await fetch(url);
  if (!res.ok) {
    logger.warn("YouTube search failed", res.status, await res.text().catch(() => ""));
    // Quota used up or key problem: let the app use YouTube's search page instead.
    return { videos: [] as Video[], fallback: true };
  }
  const body = (await res.json()) as { items?: any[] };
  const videos: Video[] = (body.items ?? [])
    .filter((it) => it?.id?.videoId)
    .map((it) => ({
      id: it.id.videoId as string,
      title: decode(it.snippet?.title ?? ""),
      channel: decode(it.snippet?.channelTitle ?? ""),
      thumbnail: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? "",
      publishedAt: it.snippet?.publishedAt ?? "",
      trusted: isTrusted(it.snippet?.channelTitle ?? ""),
    }))
    .sort((a, b) => Number(b.trusted) - Number(a.trusted));

  await cacheRef.set({ query: q, videos, expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86_400_000), updatedAt: FieldValue.serverTimestamp() });
  return { videos, fallback: false };
});
