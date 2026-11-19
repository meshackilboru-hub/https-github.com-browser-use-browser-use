import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getReactNativePersistence, initializeAuth, type Auth } from "@firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const firstInit = getApps().length === 0;
export const app = firstInit ? initializeApp(firebaseConfig) : getApp();

// Keeps people signed in between app launches.
export const auth: Auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
export const db = getFirestore(app);
export const functions = getFunctions(app, process.env.EXPO_PUBLIC_FUNCTIONS_REGION ?? "us-central1");

if (firstInit && process.env.EXPO_PUBLIC_USE_EMULATORS === "1") {
  // The Android emulator reaches the host machine at 10.0.2.2.
  const host = Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}
