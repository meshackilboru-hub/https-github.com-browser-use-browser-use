import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "@firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { auth, db } from "./firebase";
import { api } from "./api";

export type Role = "student" | "resident" | "practitioner";

export type Profile = {
  role: Role;
  displayName?: string;
  university?: string;
  yearOfStudy?: number;
  specialty?: string;
  pgyYear?: number;
  country?: string;
  exam?: string;
};

type AuthState = {
  user: User | null;
  profile: Profile | null;
  /** True until both the auth state and the profile have loaded. */
  loading: boolean;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  saveProfile(p: Profile): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

/** Thrown when the person closes a sign-in sheet; screens should ignore it. */
export class SignInCancelled extends Error {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
        if (!u) {
          setProfile(null);
          setProfileReady(true);
        } else setProfileReady(false);
      }),
    [],
  );

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as Profile) : null);
        setProfileReady(true);
      },
      () => setProfileReady(true),
    );
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading: !authReady || !profileReady,

      async signInWithGoogle() {
        if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const res = await GoogleSignin.signIn();
        if (res.type !== "success") throw new SignInCancelled();
        const idToken = res.data.idToken;
        if (!idToken) throw new Error("Google didn't return a sign-in token. Check the web client ID in your configuration.");
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      },

      async signInWithApple() {
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
        let cred: AppleAuthentication.AppleAuthenticationCredential;
        try {
          cred = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
          });
        } catch (e: any) {
          if (e?.code === "ERR_REQUEST_CANCELED") throw new SignInCancelled();
          throw e;
        }
        if (!cred.identityToken) throw new Error("Apple didn't return a sign-in token.");
        const provider = new OAuthProvider("apple.com");
        await signInWithCredential(auth, provider.credential({ idToken: cred.identityToken, rawNonce }));
      },

      async signInWithEmail(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      async signUpWithEmail(email, password) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim());
      },

      async saveProfile(p) {
        if (!auth.currentUser) throw new Error("Not signed in");
        // Drop empty and role-irrelevant fields so the stored profile matches the role.
        const keep: Record<Role, (keyof Profile)[]> = {
          student: ["role", "displayName", "university", "yearOfStudy", "country", "exam"],
          resident: ["role", "displayName", "university", "specialty", "pgyYear", "country"],
          practitioner: ["role", "displayName", "specialty", "country"],
        };
        const clean: Record<string, unknown> = {};
        for (const k of keep[p.role]) {
          const v = p[k];
          if (v !== undefined && v !== "") clean[k] = typeof v === "string" ? v.trim() : v;
        }
        clean.updatedAt = serverTimestamp();
        // setDoc without merge replaces fields from a previous role.
        await setDoc(doc(db, "users", auth.currentUser.uid), clean);
      },

      async signOut() {
        try {
          await GoogleSignin.signOut();
        } catch {}
        await fbSignOut(auth);
      },

      async deleteAccount() {
        await api.deleteAccount();
        try {
          await GoogleSignin.revokeAccess();
        } catch {}
        await fbSignOut(auth);
      },
    }),
    [user, profile, authReady, profileReady],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
