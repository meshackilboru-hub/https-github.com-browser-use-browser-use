import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Prefs = {
  subject: string;
  setSubject(s: string): void;
  socratic: boolean;
  setSocratic(v: boolean): void;
};

const Ctx = createContext<Prefs | null>(null);
const KEY = "nisome-prefs";

/** Study settings shared across tabs and remembered on this device. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [subject, setSubject] = useState("Any");
  const [socratic, setSocratic] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw);
        if (typeof p.subject === "string") setSubject(p.subject);
        if (typeof p.socratic === "boolean") setSocratic(p.socratic);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify({ subject, socratic })).catch(() => {});
  }, [subject, socratic, loaded]);

  return <Ctx.Provider value={{ subject, setSubject, socratic, setSocratic }}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs must be used inside PrefsProvider");
  return v;
}
