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

function call<I, O>(name: string) {
  const fn = httpsCallable<I, O>(functions, name, { timeout: 300_000 });
  return async (input: I): Promise<O> => (await fn(input)).data;
}

export const api = {
  chat: call<{ mode: "tutor" | "case"; messages: Turn[]; subject?: string; socratic?: boolean }, { text: string; truncated?: boolean }>("chat"),
  quiz: call<{ subject?: string; exam?: string; avoid: string[] }, Question>("quiz"),
  flashcards: call<{ topic: string }, Deck>("flashcards"),
  deleteAccount: call<void, { ok: boolean }>("deleteAccount"),
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
