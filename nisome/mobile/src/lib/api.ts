import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { functions } from "./firebase";

export type Turn = { role: "user" | "assistant"; content: string };

export type Question = {
  topic: string;
  stem: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  whyNot: string[];
  pearl: string;
};

export type Deck = { title: string; cards: { front: string; back: string }[] };

export type DocSummary = {
  title: string;
  overview: string;
  keyPoints: string[];
  sections: { heading: string; summary: string; pages: string }[];
  glossary: { term: string; definition: string }[];
  videoQueries: string[];
};

export type LibraryDoc = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "uploading" | "processing" | "ready" | "error";
  error?: string;
  pageCount?: number;
  parts?: { label: string; topics?: string[] }[];
  summary?: DocSummary;
  mastery?: Record<string, { right: number; wrong: number }>;
  progress?: { done: number; total: number };
  createdAt?: { toMillis(): number };
};

export type DocQuestion = {
  id: string;
  type: "mcq" | "short";
  question: string;
  choices: string[];
  answerIndex: number;
  modelAnswer: string;
  explanation: string;
  concept: string;
  source: string;
  box: number;
  dueAt?: { toMillis(): number };
  attempts: number;
  lastAnswer?: number | string;
  lastVerdict?: Verdict;
  lastFeedback?: string;
  lastCorrection?: string;
};

export type Verdict = "correct" | "partial" | "incorrect";

export type Grade = { verdict: Verdict; feedback: string; correction: string; explanation: string; answerIndex: number; modelAnswer: string };

export type Video = { id: string; title: string; channel: string; thumbnail: string; publishedAt: string; trusted: boolean };

function call<I, O>(name: string) {
  const fn = httpsCallable<I, O>(functions, name, { timeout: 300_000 });
  return async (input: I): Promise<O> => (await fn(input)).data;
}

export const api = {
  chat: call<{ mode: "tutor" | "case"; messages: Turn[]; subject?: string; socratic?: boolean }, { text: string; truncated?: boolean }>("chat"),
  quiz: call<{ subject?: string; exam?: string; avoid: string[] }, Question>("quiz"),
  flashcards: call<{ topic: string }, Deck>("flashcards"),
  deleteAccount: call<void, { ok: boolean }>("deleteAccount"),
  createUpload: call<{ fileName: string; mimeType: string; sizeBytes: number; title?: string }, { docId: string; storagePath: string }>("createUpload"),
  docQuestions: call<{ docId: string; count?: number; focus?: "next" | "weak" }, { added: number }>("docQuestions"),
  answerQuestion: call<{ docId: string; questionId: string; answer: number | string }, Grade>("answerQuestion"),
  docChat: call<{ docId: string; messages: Turn[] }, { text: string; sources: string[] }>("docChat"),
  findVideos: call<{ query: string }, { videos: Video[]; fallback: boolean }>("findVideos"),
};

/** Plain-language message for any error thrown by the API or Firebase. */
export function errorMessage(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case "functions/unauthenticated":
        return "Your session expired. Sign in again.";
      case "functions/deadline-exceeded":
        return "That took too long. Try a shorter question.";
      case "functions/internal":
        return e.message && e.message !== "internal" ? e.message : "Something went wrong. Try again.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "That email and password don't match an account.";
      case "auth/email-already-in-use":
        return "An account with that email already exists. Sign in instead.";
      case "auth/weak-password":
        return "Use a password of at least 8 characters.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/network-request-failed":
        return "No internet connection. Check your network and try again.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a few minutes and try again.";
    }
    // HttpsError messages from our functions are written for people.
    if (e.code.startsWith("functions/") && e.message) return e.message;
  }
  return "Something went wrong. Try again.";
}
