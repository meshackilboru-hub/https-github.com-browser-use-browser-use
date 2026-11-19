// @firebase/auth ships a React Native build that exports getReactNativePersistence, and
// Metro picks it through the package's "react-native" export condition. TypeScript sees
// the web typings first, so declare the RN-only export here.
import type { Persistence } from "@firebase/auth";

declare module "@firebase/auth" {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
