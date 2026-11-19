import type { ExpoConfig } from "expo/config";

// Values come from mobile/.env (see .env.example). EXPO_PUBLIC_* values are bundled into
// the app; they identify your Firebase project and OAuth clients and are not secrets.
const bundleId = process.env.APP_BUNDLE_ID ?? "com.pocketattending.app";
const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME ?? "com.googleusercontent.apps.REPLACE_WITH_IOS_CLIENT_ID";

const config: ExpoConfig = {
  name: "Pocket Attending",
  slug: "pocket-attending",
  scheme: "pocketattending",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: "#0F6E66",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-apple-authentication",
    ["@react-native-google-signin/google-signin", { iosUrlScheme }],
    "expo-build-properties",
    "expo-web-browser",
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
