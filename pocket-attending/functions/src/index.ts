import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineInt } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { caseSystem, flashcardPrompt, quizPrompt, tutorSystem, type Profile } from "./prompts.js";

initializeApp();
const db = getFirestore();

// Set with: firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
// Requests per user per day (UTC). Override in functions/.env: DAILY_LIMIT=200
const DAILY_LIMIT = defineInt("DAILY_LIMIT", { default: 150 });

const MODEL = "claude-opus-5-5";
// On a safety decline the API retries the request on a fallback model it picks.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

const callOpts = { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: "512MiB" as const, enforceAppCheck: false };

function client() {
  return new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
}

/** Returns the caller's uid and server-side profile, after checking the daily quota. */
async function begin(req: CallableRequest<unknown>): Promise<{ uid: string; profile: Profile }> {
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
    if (cur >= limit) throw new HttpsError("resource-exhausted", `You've reached today's limit of ${limit} requests. It resets at midnight UTC.`);
    tx.set(ref, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { uid, profile };
}

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpsError("invalid-argument", "The request was malformed.");
  return r.data;
}

function rethrow(e: unknown): never {
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

const REFUSED = "I can't help with that request. Try rephrasing it as a study or clinical question.";

/* ---------------- chat: tutor and case simulation ---------------- */

const Turn = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(12000) });
const ChatInput = z.object({
  mode: z.enum(["tutor", "case"]),
  subject: z.string().max(60).optional(),
  socratic: z.boolean().optional(),
  messages: z
    .array(Turn)
    .min(1)
    .max(60)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user", "Conversation must start and end with the user")
    .refine((m) => m.every((t, i) => i === 0 || t.role !== m[i - 1].role), "Turns must alternate"),
});

export const chat = onCall(callOpts, async (req) => {
  const input = parse(ChatInput, req.data);
  const { profile } = await begin(req);
  const system = input.mode === "tutor" ? tutorSystem(profile, input) : caseSystem(profile, input.subject);
  // Keep the most recent turns, starting on a user turn.
  let messages = input.messages.slice(-31);
  if (messages[0].role !== "user") messages = messages.slice(1);
  try {
    const res = await client().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system,
      messages,
      ...FALLBACK,
    });
    if (res.stop_reason === "refusal") return { text: REFUSED };
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return { text: text || REFUSED, truncated: res.stop_reason === "max_tokens" };
  } catch (e) {
    rethrow(e);
  }
});

/* ---------------- question bank ---------------- */

const Question = z.object({
  topic: z.string(),
  stem: z.string(),
  question: z.string(),
  choices: z.array(z.string()),
  answer: z.number().int(),
  explanation: z.string(),
  whyNot: z.array(z.string()),
  pearl: z.string(),
});
const QuizInput = z.object({
  subject: z.string().max(60).optional(),
  exam: z.string().max(60).optional(),
  avoid: z.array(z.string().max(80)).max(15).default([]),
});

export const quiz = onCall(callOpts, async (req) => {
  const input = parse(QuizInput, req.data);
  const { profile } = await begin(req);
  try {
    const res = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(Question) },
      messages: [{ role: "user", content: quizPrompt(profile, input) }],
      ...FALLBACK,
    });
    if (res.stop_reason === "refusal") throw new HttpsError("failed-precondition", REFUSED);
    const q = res.parsed_output;
    if (!q || q.choices.length !== 5 || q.answer < 0 || q.answer > 4) {
      throw new HttpsError("internal", "The generated question was incomplete. Try again.");
    }
    return q;
  } catch (e) {
    rethrow(e);
  }
});

/* ---------------- flashcards ---------------- */

const Deck = z.object({
  title: z.string(),
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
});
const CardsInput = z.object({ topic: z.string().min(2).max(200) });

export const flashcards = onCall(callOpts, async (req) => {
  const input = parse(CardsInput, req.data);
  const { profile } = await begin(req);
  try {
    const res = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(Deck) },
      messages: [{ role: "user", content: flashcardPrompt(profile, input.topic) }],
      ...FALLBACK,
    });
    if (res.stop_reason === "refusal") throw new HttpsError("failed-precondition", REFUSED);
    const d = res.parsed_output;
    if (!d || !d.cards.length) throw new HttpsError("internal", "The generated deck was empty. Try again.");
    return d;
  } catch (e) {
    rethrow(e);
  }
});

/* ---------------- account deletion (required by the App Store and Google Play) ---------------- */

export const deleteAccount = onCall({ timeoutSeconds: 60 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  await db.recursiveDelete(db.doc(`usage/${uid}`));
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getAuth().deleteUser(uid);
  return { ok: true };
});
