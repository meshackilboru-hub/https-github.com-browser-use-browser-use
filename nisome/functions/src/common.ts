import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineInt } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Profile } from "./prompts.js";

initializeApp();
export const db = getFirestore();

// Set with: firebase functions:secrets:set ANTHROPIC_API_KEY
export const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
// Requests per user per day (UTC). Override in functions/.env: DAILY_LIMIT=200
export const DAILY_LIMIT = defineInt("DAILY_LIMIT", { default: 150 });

export const MODEL = "claude-opus-5-5";
// On a safety decline the API retries the request on a fallback model it picks.
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export const callOpts = { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: "512MiB" as const, enforceAppCheck: false };

export function client() {
  return new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
}

/** Returns the caller's uid and server-side profile, after checking the daily quota. */
export async function begin(req: CallableRequest<unknown>, cost = 1): Promise<{ uid: string; profile: Profile }> {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Finish setting up your profile first.");
  const profile = snap.data() as Profile;

  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`usage/${uid}/days/${day}`);
  const limit = DAILY_LIMIT.value();
  await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data()?.count ?? 0;
    if (cur + cost > limit) throw new HttpsError("resource-exhausted", `You've reached today's limit of ${limit} requests. It resets at midnight UTC.`);
    tx.set(ref, { count: FieldValue.increment(cost), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { uid, profile };
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpsError("invalid-argument", "The request was malformed.");
  return r.data;
}

export function rethrow(e: unknown): never {
  if (e instanceof HttpsError) throw e;
  if (e instanceof Anthropic.RateLimitError) throw new HttpsError("unavailable", "The AI service is busy. Try again in a minute.");
  if (e instanceof Anthropic.BadRequestError) {
    logger.error("Claude rejected the request", e.message);
    throw new HttpsError("invalid-argument", "That request couldn't be processed. Try shortening the conversation.");
  }
  if (e instanceof Anthropic.APIError) {
    logger.error("Claude API error", e.status, e.message);
    throw new HttpsError("unavailable", "The AI service had a problem. Try again shortly.");
  }
  logger.error("Unexpected error", e);
  throw new HttpsError("internal", "Something went wrong. Try again.");
}

export const REFUSED = "I can't help with that request. Try rephrasing it as a study or clinical question.";

