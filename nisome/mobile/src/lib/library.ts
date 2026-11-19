import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./auth";
import type { DocQuestion, LibraryDoc } from "./api";

/** Live list of the signed-in person's uploaded documents, newest first. */
export function useLibrary(): LibraryDoc[] | null {
  const { user } = useAuth();
  const [docs, setDocs] = useState<LibraryDoc[] | null>(null);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "users", user.uid, "docs"), orderBy("createdAt", "desc")),
      (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LibraryDoc, "id">) }))),
      () => setDocs([]),
    );
  }, [user]);
  return docs;
}

export function useLibraryDoc(id: string): LibraryDoc | null | undefined {
  const { user } = useAuth();
  const [d, setD] = useState<LibraryDoc | null | undefined>(undefined);
  useEffect(() => {
    if (!user || !id) return;
    return onSnapshot(
      doc(db, "users", user.uid, "docs", id),
      (snap) => setD(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<LibraryDoc, "id">) } : null),
      () => setD(null),
    );
  }, [user, id]);
  return d;
}

/** Questions appear here the moment the server writes them. */
export function useDocQuestions(id: string): DocQuestion[] | null {
  const { user } = useAuth();
  const [qs, setQs] = useState<DocQuestion[] | null>(null);
  useEffect(() => {
    if (!user || !id) return;
    return onSnapshot(
      query(collection(db, "users", user.uid, "docs", id, "questions"), orderBy("createdAt", "desc")),
      (snap) => setQs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DocQuestion, "id">) }))),
      () => setQs([]),
    );
  }, [user, id]);
  return qs;
}

export function masteryPercent(m?: LibraryDoc["mastery"]): number | null {
  if (!m) return null;
  let right = 0;
  let total = 0;
  for (const v of Object.values(m)) {
    right += v.right;
    total += v.right + v.wrong;
  }
  return total ? Math.round((right / total) * 100) : null;
}
