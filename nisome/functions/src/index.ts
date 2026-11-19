import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { caseSystem, flashcardPrompt, quizPrompt, tutorSystem } from "./prompts.js";
import { FALLBACK, MODEL, REFUSED, begin, callOpts, client, db, parse, rethrow } from "./common.js";

export * from "./docs.js";
export * from "./videos.js";

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

export const deleteAccount = onCall({ timeoutSeconds: 300 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  await db.recursiveDelete(db.doc(`usage/${uid}`));
  // Deleting each document fires onLibraryDocDeleted, which removes its copies at Anthropic.
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` });
  await getAuth().deleteUser(uid);
  return { ok: true };
});
