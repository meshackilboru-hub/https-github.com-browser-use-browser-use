// The study library: people upload a PDF, book, paper, Word file or photo of notes;
// Nisome summarizes it, writes questions from it, grades answers, schedules reviews
// of weak spots, and answers questions about it.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { defineInt } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { toFile } from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import { z } from "zod";
import { ANTHROPIC_API_KEY, FALLBACK, MODEL, REFUSED, begin, callOpts, client, db, parse, rethrow } from "./common.js";
import { audience, type Profile } from "./prompts.js";

/* ---------------- limits ---------------- */

const MAX_UPLOAD_MB = defineInt("MAX_UPLOAD_MB", { default: 200 });
const MAX_PAGES = defineInt("MAX_PAGES", { default: 2000 });
const UPLOADS_PER_DAY = defineInt("UPLOADS_PER_DAY", { default: 10 });

/** Pages per part. A part is the unit Claude reads in one request. */
const CHUNK_PAGES = 50;
/** Keep each PDF part comfortably under the 32 MB request limit. */
const CHUNK_BYTES = 28 * 1024 * 1024;
/** Characters per part for Word and text files (roughly 30k tokens). */
const CHUNK_CHARS = 120_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Parts given to Claude when chatting or writing questions. */
const PARTS_PER_REQUEST = 2;

const MIME = {
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  text: ["text/plain", "text/markdown", "text/x-markdown"],
} as const;
type Kind = keyof typeof MIME;
const kindOf = (mime: string): Kind | null =>
  (Object.keys(MIME) as Kind[]).find((k) => (MIME[k] as readonly string[]).includes(mime)) ?? null;

/* ---------------- stored shapes ---------------- */

type Part = { fileId: string; kind: "document" | "image"; label: string; summary?: string; topics?: string[] };

type DocSummary = z.infer<typeof DocSummarySchema>;

type LibraryDoc = {
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  status: "uploading" | "processing" | "ready" | "error";
  error?: string;
  pageCount?: number;
  parts?: Part[];
  summary?: DocSummary;
  mastery?: Record<string, { right: number; wrong: number }>;
  questionCursor?: number;
  progress?: { done: number; total: number };
};

type StoredQuestion = {
  type: "mcq" | "short";
  question: string;
  choices: string[];
  answerIndex: number;
  modelAnswer: string;
  explanation: string;
  concept: string;
  source: string;
  box: number;
  dueAt: Timestamp;
  attempts: number;
};

/* ---------------- schemas for Claude's structured output ---------------- */

const PartSummarySchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  topics: z.array(z.string()),
});

const DocSummarySchema = z.object({
  title: z.string(),
  overview: z.string(),
  keyPoints: z.array(z.string()),
  sections: z.array(z.object({ heading: z.string(), summary: z.string(), pages: z.string() })),
  glossary: z.array(z.object({ term: z.string(), definition: z.string() })),
  videoQueries: z.array(z.string()),
});

const SingleDocSummarySchema = DocSummarySchema.extend({ topics: z.array(z.string()) });

const QuestionSetSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(["mcq", "short"]),
      question: z.string(),
      choices: z.array(z.string()),
      answerIndex: z.number().int(),
      modelAnswer: z.string(),
      explanation: z.string(),
      concept: z.string(),
      source: z.string(),
    }),
  ),
});

const GradeSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect"]),
  feedback: z.string(),
  correction: z.string(),
});

const RouteSchema = z.object({ parts: z.array(z.number().int()) });

/* ---------------- helpers ---------------- */

const docRef = (uid: string, docId: string) => db.doc(`users/${uid}/docs/${docId}`);

async function loadProfile(uid: string): Promise<Profile> {
  const snap = await db.doc(`users/${uid}`).get();
  return (snap.data() as Profile | undefined) ?? { role: "student" };
}

async function loadDoc(uid: string, docId: string): Promise<LibraryDoc> {
  const snap = await docRef(uid, docId).get();
  if (!snap.exists) throw new HttpsError("not-found", "That document no longer exists.");
  const d = snap.data() as LibraryDoc;
  if (d.status !== "ready" || !d.parts?.length) throw new HttpsError("failed-precondition", "This document is still being processed.");
  return d;
}

function partBlock(doc: { title: string }, p: Part, cache = false): BetaContentBlockParam {
  const cache_control = cache ? { type: "ephemeral" as const } : undefined;
  return p.kind === "image"
    ? { type: "image", source: { type: "file", file_id: p.fileId }, cache_control }
    : { type: "document", source: { type: "file", file_id: p.fileId }, title: `${doc.title} (${p.label})`, cache_control };
}

/** Runs `fn` over `items` with at most `limit` running at once. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

async function structured<T extends z.ZodType>(
  schema: T,
  content: BetaContentBlockParam[] | string,
  effort: "low" | "medium" = "medium",
  system?: string,
): Promise<z.infer<T>> {
  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    ...(system ? { system } : {}),
    messages: [{ role: "user", content }],
    ...FALLBACK,
  });
  if (res.stop_reason === "refusal") throw new HttpsError("failed-precondition", REFUSED);
  if (!res.parsed_output) throw new HttpsError("internal", "The AI's answer was incomplete. Try again.");
  return res.parsed_output as z.infer<T>;
}

/** Splits pages [from, to) into PDFs no larger than CHUNK_BYTES, halving ranges that are too big. */
async function splitPdf(src: PDFDocument, from: number, to: number): Promise<{ bytes: Uint8Array; first: number; last: number }[]> {
  const part = await PDFDocument.create();
  const pages = await part.copyPages(src, Array.from({ length: to - from }, (_, i) => from + i));
  pages.forEach((p) => part.addPage(p));
  const bytes = await part.save();
  if (bytes.length <= CHUNK_BYTES) return [{ bytes, first: from + 1, last: to }];
  if (to - from === 1) throw new HttpsError("invalid-argument", `Page ${from + 1} is larger than 28 MB. Try a compressed copy of the PDF.`);
  const mid = from + Math.floor((to - from) / 2);
  return [...(await splitPdf(src, from, mid)), ...(await splitPdf(src, mid, to))];
}

function splitText(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > CHUNK_CHARS) {
    let cut = rest.lastIndexOf("\n\n", CHUNK_CHARS);
    if (cut < CHUNK_CHARS * 0.5) cut = rest.lastIndexOf("\n", CHUNK_CHARS);
    if (cut < CHUNK_CHARS * 0.5) cut = CHUNK_CHARS;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/* ---------------- 1. reserve an upload ---------------- */

const CreateUploadInput = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(120),
  sizeBytes: z.number().int().positive(),
  title: z.string().max(160).optional(),
});

export const createUpload = onCall(callOpts, async (req) => {
  const input = parse(CreateUploadInput, req.data);
  const kind = kindOf(input.mimeType);
  if (!kind) throw new HttpsError("invalid-argument", "Upload a PDF, Word document, text file, or an image (JPG, PNG, WebP).");
  const maxBytes = MAX_UPLOAD_MB.value() * 1024 * 1024;
  if (input.sizeBytes > maxBytes) throw new HttpsError("invalid-argument", `Files can be up to ${MAX_UPLOAD_MB.value()} MB.`);
  if (kind === "image" && input.sizeBytes > MAX_IMAGE_BYTES) throw new HttpsError("invalid-argument", "Images can be up to 5 MB.");

  // Processing a book costs far more than a chat message, so an upload counts as 5 requests.
  const { uid } = await begin(req, 5);
  const day = new Date().toISOString().slice(0, 10);
  const usage = db.doc(`usage/${uid}/days/${day}`);
  const limit = UPLOADS_PER_DAY.value();
  await db.runTransaction(async (tx) => {
    const n = (await tx.get(usage)).data()?.uploads ?? 0;
    if (n >= limit) throw new HttpsError("resource-exhausted", `You can upload ${limit} files a day. Try again tomorrow.`);
    tx.set(usage, { uploads: FieldValue.increment(1) }, { merge: true });
  });

  const ref = db.collection(`users/${uid}/docs`).doc();
  const safeName = input.fileName.replace(/[^\w.\- ]+/g, "_").slice(-120) || "upload";
  const storagePath = `users/${uid}/uploads/${ref.id}/${safeName}`;
  const title = (input.title?.trim() || input.fileName.replace(/\.[^.]+$/, "")).slice(0, 160);
  await ref.set({
    title,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storagePath,
    status: "uploading",
    createdAt: FieldValue.serverTimestamp(),
  });
  return { docId: ref.id, storagePath };
});

/* ---------------- 2. process the file once it lands in Storage ---------------- */

export const onUploadFinalized = onObjectFinalized(
  { secrets: [ANTHROPIC_API_KEY], memory: "4GiB", timeoutSeconds: 540, cpu: 2 },
  async (event) => {
    const path = event.data.name;
    const m = /^users\/([^/]+)\/uploads\/([^/]+)\//.exec(path ?? "");
    if (!path || !m) return;
    const [, uid, docId] = m;
    const ref = docRef(uid, docId);
    const snap = await ref.get();
    const doc = snap.data() as LibraryDoc | undefined;
    if (!doc || doc.status !== "uploading" || doc.storagePath !== path) return;

    await ref.update({ status: "processing", progress: { done: 0, total: 1 } });
    try {
      await processDocument(uid, docId, doc);
    } catch (e) {
      logger.error("Processing failed", { uid, docId, e });
      const msg = e instanceof HttpsError ? e.message : "We couldn't read this file. If it's a scanned or password-protected PDF, try exporting a fresh copy.";
      await ref.update({ status: "error", error: msg }).catch(() => {});
    }
  },
);

async function processDocument(uid: string, docId: string, doc: LibraryDoc) {
  const ref = docRef(uid, docId);
  const [buf] = await getStorage().bucket().file(doc.storagePath).download();
  const kind = kindOf(doc.mimeType);
  const files = client().files;
  const profile = await loadProfile(uid);
  const who = audience(profile);

  // Split into parts and upload each to Anthropic once; later requests refer to them by ID.
  const parts: Part[] = [];
  let pageCount: number | undefined;
  const upload = async (bytes: Uint8Array | Buffer, name: string, type: string) =>
    (await files.upload({ file: await toFile(bytes, name, { type }) })).id;

  if (kind === "pdf") {
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
    pageCount = pdf.getPageCount();
    if (pageCount > MAX_PAGES.value()) throw new HttpsError("invalid-argument", `This PDF has ${pageCount} pages. The limit is ${MAX_PAGES.value()}; upload it in volumes.`);
    const pieces =
      pageCount <= CHUNK_PAGES && buf.length <= CHUNK_BYTES
        ? [{ bytes: buf, first: 1, last: pageCount }]
        : (await Promise.all(
            Array.from({ length: Math.ceil(pageCount / CHUNK_PAGES) }, (_, i) =>
              splitPdf(pdf, i * CHUNK_PAGES, Math.min(pageCount!, (i + 1) * CHUNK_PAGES)),
            ),
          )).flat();
    await ref.update({ pageCount, progress: { done: 0, total: pieces.length + 1 } });
    const ids = await pool(pieces, 4, (p, i) => upload(p.bytes, `${docId}-${i + 1}.pdf`, "application/pdf"));
    pieces.forEach((p, i) => parts.push({ fileId: ids[i], kind: "document", label: p.first === p.last ? `p. ${p.first}` : `pp. ${p.first}-${p.last}` }));
  } else if (kind === "image") {
    if (buf.length > MAX_IMAGE_BYTES) throw new HttpsError("invalid-argument", "Images can be up to 5 MB.");
    parts.push({ fileId: await upload(buf, `${docId}.img`, doc.mimeType), kind: "image", label: "image" });
  } else if (kind === "docx" || kind === "text") {
    const text = kind === "docx" ? (await mammoth.extractRawText({ buffer: buf })).value : buf.toString("utf8");
    if (!text.trim()) throw new HttpsError("invalid-argument", "This file has no readable text.");
    const pieces = splitText(text);
    const ids = await pool(pieces, 4, (t, i) => upload(Buffer.from(t, "utf8"), `${docId}-${i + 1}.txt`, "text/plain"));
    pieces.forEach((_, i) => parts.push({ fileId: ids[i], kind: "document", label: pieces.length === 1 ? "full text" : `part ${i + 1} of ${pieces.length}` }));
  } else {
    throw new HttpsError("invalid-argument", "This file type isn't supported.");
  }

  const total = parts.length + 1;
  await ref.update({ progress: { done: 0, total } });
  const summaryGuide = `The reader is ${who}. Summarize for studying: accurate, specific, using the material's own terms, numbers and page references.
"videoQueries" are 3-5 short YouTube search phrases for tutorial videos that teach this material's main topics (for example "renal tubular acidosis types explained").
"topics" are 4-10 short concept names the material covers, usable as quiz categories.`;

  let summary: DocSummary;
  if (parts.length === 1) {
    const s = await structured(SingleDocSummarySchema, [
      partBlock(doc, parts[0]),
      { type: "text", text: `Summarize this ${kind === "image" ? "image of study material" : "material"}, titled "${doc.title}".\n${summaryGuide}\nFor "sections", follow the material's own structure; "pages" gives page numbers when visible, otherwise "".` },
    ]);
    const { topics, ...rest } = s;
    parts[0].summary = rest.overview;
    parts[0].topics = topics;
    summary = rest;
  } else {
    let done = 0;
    const partSummaries = await pool(parts, 4, async (p) => {
      const s = await structured(
        PartSummarySchema,
        [
          partBlock(doc, p),
          { type: "text", text: `This is ${p.label} of "${doc.title}". Summarize just this part in 150-250 words, list its key points, and name 3-8 topics it covers.\nThe reader is ${who}.` },
        ],
        "low",
      );
      done++;
      await ref.update({ progress: { done, total } });
      return s;
    });
    parts.forEach((p, i) => {
      p.summary = partSummaries[i].summary;
      p.topics = partSummaries[i].topics;
    });
    const digest = parts
      .map((p, i) => `## ${p.label}\n${partSummaries[i].summary}\nKey points:\n- ${partSummaries[i].keyPoints.join("\n- ")}`)
      .join("\n\n");
    summary = await structured(
      DocSummarySchema,
      `Below are summaries of each part of "${doc.title}" (${pageCount ? pageCount + " pages" : parts.length + " parts"}). Write one summary of the whole work.\n${summaryGuide}\nFor "sections", give one entry per chapter or major theme with its page range in "pages".\n\n${digest}`,
    );
  }

  await ref.update({ parts, summary, progress: { done: total, total } });
  // Have a first set of questions waiting when the summary appears.
  await writeQuestions(uid, docId, { ...doc, parts, summary }, profile, 5, false).catch((e) => logger.warn("First questions failed", e));
  await ref.update({ status: "ready", readyAt: FieldValue.serverTimestamp() });
}

/* ---------------- 3. questions from the material ---------------- */

async function writeQuestions(uid: string, docId: string, doc: LibraryDoc, profile: Profile, count: number, weakOnly: boolean) {
  const parts = doc.parts ?? [];
  const mastery = doc.mastery ?? {};
  const weak = Object.entries(mastery)
    .filter(([, m]) => m.wrong > 0 && m.wrong >= m.right)
    .sort((a, b) => b[1].wrong - b[1].right - (a[1].wrong - a[1].right))
    .map(([c]) => c)
    .slice(0, 5);

  // Pick which parts to read: those covering weak concepts, or the next part in rotation.
  let chosen: number[] = [];
  if (weakOnly && weak.length) {
    const lower = weak.map((w) => w.toLowerCase());
    chosen = parts
      .map((p, i) => ({ i, hits: (p.topics ?? []).filter((t) => lower.some((w) => t.toLowerCase().includes(w) || w.includes(t.toLowerCase()))).length }))
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, PARTS_PER_REQUEST)
      .map((x) => x.i);
  }
  const cursor = doc.questionCursor ?? 0;
  if (!chosen.length) chosen = [cursor % parts.length];

  const recent = await db.collection(`users/${uid}/docs/${docId}/questions`).orderBy("createdAt", "desc").limit(20).get();
  const avoid = recent.docs.map((d) => `- ${(d.data().question as string).slice(0, 140)}`).join("\n");
  const topics = Array.from(new Set(parts.flatMap((p) => p.topics ?? []))).slice(0, 40);

  const set = await structured(QuestionSetSchema, [
    ...chosen.map((i, k) => partBlock(doc, parts[i], k === chosen.length - 1)),
    {
      type: "text",
      text: `Write ${count} study questions for ${audience(profile)}, based strictly on the attached material ("${doc.title}", ${chosen.map((i) => parts[i].label).join(" and ")}).
Mix about 70% multiple choice and 30% short answer. Test understanding and application, not trivia. Use clinical vignettes where the material allows.
Multiple choice: "type" "mcq", exactly 5 "choices", "answerIndex" 0-4 for the single best answer.
Short answer: "type" "short", "choices" [], "answerIndex" -1, answerable in 1-3 sentences.
"modelAnswer": the ideal answer. "explanation": why it's right${count > 1 ? " and why tempting wrong options are wrong" : ""}, 2-4 sentences.
"source": where in the material the answer is (page number like "p. 42", or the section heading).
"concept": one short concept name; reuse one of these when it fits: ${topics.join("; ")}.
${weakOnly && weak.length ? `The learner keeps getting these wrong, so target them from new angles: ${weak.join("; ")}.` : ""}
${avoid ? `Don't repeat these earlier questions:\n${avoid}` : ""}`,
    },
  ]);

  const now = Timestamp.now();
  const batch = db.batch();
  for (const q of set.questions) {
    if (q.type === "mcq" && (q.choices.length !== 5 || q.answerIndex < 0 || q.answerIndex > 4)) continue;
    const ref = db.collection(`users/${uid}/docs/${docId}/questions`).doc();
    batch.set(ref, {
      ...q,
      choices: q.type === "mcq" ? q.choices : [],
      answerIndex: q.type === "mcq" ? q.answerIndex : -1,
      box: 0,
      dueAt: now,
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(docRef(uid, docId), { questionCursor: chosen.length === 1 && !weakOnly ? cursor + 1 : cursor });
  await batch.commit();
  return set.questions.length;
}

const MoreQuestionsInput = z.object({
  docId: z.string().min(1).max(64),
  count: z.number().int().min(1).max(10).default(5),
  focus: z.enum(["next", "weak"]).default("next"),
});

export const docQuestions = onCall(callOpts, async (req) => {
  const input = parse(MoreQuestionsInput, req.data);
  const { uid, profile } = await begin(req);
  const doc = await loadDoc(uid, input.docId);
  try {
    const n = await writeQuestions(uid, input.docId, doc, profile, input.count, input.focus === "weak");
    return { added: n };
  } catch (e) {
    rethrow(e);
  }
});

/* ---------------- 4. grade an answer and schedule the next review ---------------- */

/** Days until the next review for each Leitner box (box 0 = just missed). */
const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35];

const AnswerInput = z.object({
  docId: z.string().min(1).max(64),
  questionId: z.string().min(1).max(64),
  answer: z.union([z.number().int().min(0).max(4), z.string().min(1).max(4000)]),
});

export const answerQuestion = onCall(callOpts, async (req) => {
  const input = parse(AnswerInput, req.data);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const qRef = db.doc(`users/${uid}/docs/${input.docId}/questions/${input.questionId}`);
  const qSnap = await qRef.get();
  if (!qSnap.exists) throw new HttpsError("not-found", "That question no longer exists.");
  const q = qSnap.data() as StoredQuestion;

  let verdict: "correct" | "partial" | "incorrect";
  let feedback: string;
  let correction = "";
  if (q.type === "mcq") {
    if (typeof input.answer !== "number") throw new HttpsError("invalid-argument", "Pick one of the choices.");
    verdict = input.answer === q.answerIndex ? "correct" : "incorrect";
    feedback = q.explanation;
    if (verdict === "incorrect") correction = `The correct answer is ${"ABCDE"[q.answerIndex]}: ${q.choices[q.answerIndex]}.`;
  } else {
    if (typeof input.answer !== "string") throw new HttpsError("invalid-argument", "Type your answer.");
    // Grading a written answer uses Claude, so it counts toward the daily limit.
    const { profile } = await begin(req);
    try {
      const g = await structured(
        GradeSchema,
        `Grade a ${audience(profile)}'s answer to a study question. Be fair: accept correct answers in different words; mark "partial" when the core idea is right but something important is missing or slightly wrong.
"feedback": 1-3 sentences to the learner, starting with what they got right. "correction": if not fully correct, state the correct answer plainly and fix any misconception; otherwise "".

Question: ${q.question}
Model answer: ${q.modelAnswer}
Explanation: ${q.explanation}
Learner's answer: ${input.answer}`,
        "low",
      );
      verdict = g.verdict;
      feedback = g.feedback;
      correction = g.correction;
    } catch (e) {
      rethrow(e);
    }
  }

  const box = verdict === "correct" ? Math.min(q.box + 1, INTERVAL_DAYS.length - 1) : verdict === "partial" ? q.box : 0;
  const delayMs = verdict === "incorrect" ? 10 * 60 * 1000 : Math.max(1, INTERVAL_DAYS[box]) * 86_400_000;
  const dRef = docRef(uid, input.docId);
  await db.runTransaction(async (tx) => {
    const d = (await tx.get(dRef)).data() as LibraryDoc | undefined;
    const mastery = { ...(d?.mastery ?? {}) };
    const concept = (q.concept ?? "").trim().slice(0, 80) || "General";
    const m = mastery[concept] ?? { right: 0, wrong: 0 };
    if (verdict === "correct") m.right++;
    else m.wrong++;
    mastery[concept] = m;
    tx.update(dRef, { mastery });
    tx.update(qRef, {
      box,
      dueAt: Timestamp.fromMillis(Date.now() + delayMs),
      attempts: FieldValue.increment(1),
      lastAnswer: input.answer,
      lastVerdict: verdict,
      lastFeedback: feedback,
      lastCorrection: correction,
      answeredAt: FieldValue.serverTimestamp(),
    });
  });

  return { verdict, feedback, correction, explanation: q.explanation, answerIndex: q.answerIndex, modelAnswer: q.modelAnswer };
});

/* ---------------- 5. chat about the material ---------------- */

const Turn = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(12000) });
const DocChatInput = z.object({
  docId: z.string().min(1).max(64),
  messages: z
    .array(Turn)
    .min(1)
    .max(40)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user", "Conversation must start and end with the user")
    .refine((m) => m.every((t, i) => i === 0 || t.role !== m[i - 1].role), "Turns must alternate"),
});

export const docChat = onCall(callOpts, async (req) => {
  const input = parse(DocChatInput, req.data);
  const { uid, profile } = await begin(req);
  const doc = await loadDoc(uid, input.docId);
  const parts = doc.parts!;
  const lastUser = input.messages[input.messages.length - 1].content;

  try {
    // For long works, find the parts most relevant to the question first.
    let chosen = parts.map((_, i) => i);
    if (parts.length > PARTS_PER_REQUEST) {
      const prevUser = input.messages.length >= 3 ? input.messages[input.messages.length - 3].content : "";
      const r = await structured(
        RouteSchema,
        `A learner is asking about "${doc.title}". Which parts most likely contain the answer? Return up to ${PARTS_PER_REQUEST} part numbers, most relevant first; [] if none.
${prevUser ? `Earlier question: ${prevUser.slice(0, 600)}\n` : ""}Question: ${lastUser.slice(0, 1500)}

${parts.map((p, i) => `[${i}] ${p.label}. Topics: ${(p.topics ?? []).join(", ")}. ${p.summary ?? ""}`).join("\n")}`,
        "low",
      );
      chosen = r.parts.filter((i) => i >= 0 && i < parts.length).slice(0, PARTS_PER_REQUEST);
      if (!chosen.length) chosen = [0];
    }

    const s = doc.summary;
    const context = `Overview of the whole work:\n${s?.overview ?? ""}\nSections:\n${(s?.sections ?? []).map((x) => `- ${x.heading} (${x.pages}): ${x.summary}`).join("\n")}`;
    const system = `You are Nisome, a study companion for ${audience(profile)}. You are discussing their uploaded material, "${doc.title}". The attached excerpts (${chosen.map((i) => parts[i].label).join(", ")}) and the overview are your main source.
Ground answers in the material and cite where you found things, like (p. 42) or (section: Renal physiology). If the material doesn't cover something, say so, then answer from general medical knowledge and label that part clearly.
Whenever the learner answers a question or states something as fact, check it. If it's wrong or partly wrong, say so plainly, give the correct version, and explain why, kindly and without hedging.
Use Markdown. Keep answers focused, and end with one short follow-up question that checks understanding when it helps.`;

    let messages: BetaMessageParam[] = input.messages.slice(-25);
    if (messages[0].role !== "user") messages = messages.slice(1);
    const first = messages[0];
    messages = [
      {
        role: "user",
        content: [
          ...chosen.map((i, k) => partBlock(doc, parts[i], k === chosen.length - 1)),
          { type: "text", text: context },
          { type: "text", text: first.content as string },
        ],
      },
      ...messages.slice(1),
    ];

    const res = await client().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system,
      messages,
      ...FALLBACK,
    });
    if (res.stop_reason === "refusal") return { text: REFUSED, sources: [] };
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return { text: text || REFUSED, sources: chosen.map((i) => parts[i].label) };
  } catch (e) {
    rethrow(e);
  }
});

/* ---------------- 6. clean up when a document is deleted ---------------- */

export const onLibraryDocDeleted = onDocumentDeleted(
  { document: "users/{uid}/docs/{docId}", secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300 },
  async (event) => {
    const { uid, docId } = event.params;
    const doc = event.data?.data() as LibraryDoc | undefined;
    const files = client().files;
    await Promise.all(
      (doc?.parts ?? []).map((p) => files.delete(p.fileId).catch((e) => logger.warn("Couldn't delete file at Anthropic", p.fileId, e?.status))),
    );
    await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/uploads/${docId}/` }).catch(() => {});
    await db.recursiveDelete(db.collection(`users/${uid}/docs/${docId}/questions`));
  },
);
