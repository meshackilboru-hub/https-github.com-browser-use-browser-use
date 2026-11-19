import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { SignInCancelled, useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { space, useTheme } from "@/lib/theme";
import { Button, Field } from "@/components/ui";

type EmailMode = "signin" | "signup" | "reset";

export default function SignIn() {
  const t = useTheme();
  const auth = useAuth();
  const scheme = useColorScheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [mode, setMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  if (auth.user) return <Redirect href="/" />;

  async function attempt(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof SignInCancelled)) setError(e instanceof Error && !("code" in e) ? e.message : errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function submitEmail() {
    if (mode === "reset") {
      attempt("email", async () => {
        await auth.resetPassword(email);
        setNotice("Check your inbox for a link to reset your password.");
        setMode("signin");
      });
    } else if (mode === "signup") {
      if (password.length < 8) return setError("Use a password of at least 8 characters.");
      attempt("email", () => auth.signUpWithEmail(email, password));
    } else attempt("email", () => auth.signInWithEmail(email, password));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={{ gap: space.md }}>
            <View style={[styles.mark, { backgroundColor: t.accent }]}>
              <Ionicons name="pulse" size={30} color={t.accentInk} />
            </View>
            <Text style={[styles.title, { color: t.ink }]}>Nisome</Text>
            <Text style={{ color: t.muted, fontSize: 16, lineHeight: 23 }}>
              Study and clinical reference for medical students, residents and practitioners. A tutor, practice questions, simulated cases and flashcards, all tuned to your level.
            </Text>
          </View>

          <View style={{ gap: space.md }}>
            <Button
              title="Continue with Google"
              variant="quiet"
              icon={<Ionicons name="logo-google" size={18} color={t.ink} />}
              loading={busy === "google"}
              disabled={!!busy}
              onPress={() => attempt("google", auth.signInWithGoogle)}
            />
            {appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={scheme === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={{ height: 46 }}
                onPress={() => attempt("apple", auth.signInWithApple)}
              />
            ) : null}

            {!emailOpen ? (
              <Button title="Continue with email" variant="ghost" disabled={!!busy} onPress={() => setEmailOpen(true)} />
            ) : (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <Field value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
                {mode !== "reset" ? (
                  <Field
                    value={password}
                    onChangeText={setPassword}
                    placeholder={mode === "signup" ? "Create a password (8+ characters)" : "Password"}
                    secureTextEntry
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    textContentType={mode === "signup" ? "newPassword" : "password"}
                    onSubmitEditing={submitEmail}
                  />
                ) : null}
                <Button
                  title={mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
                  loading={busy === "email"}
                  disabled={!!busy || !email.trim() || (mode !== "reset" && !password)}
                  onPress={submitEmail}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: space.sm }}>
                  <Pressable onPress={() => setMode(mode === "signup" ? "signin" : "signup")}>
                    <Text style={{ color: t.accent, fontWeight: "600" }}>{mode === "signup" ? "I already have an account" : "Create an account"}</Text>
                  </Pressable>
                  {mode !== "reset" ? (
                    <Pressable onPress={() => setMode("reset")}>
                      <Text style={{ color: t.muted }}>Forgot password?</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )}

            {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}
            {notice ? <Text style={{ color: t.good }}>{notice}</Text> : null}
          </View>

          <Text style={{ color: t.muted, fontSize: 12.5, lineHeight: 18 }}>
            For education and clinical decision support only. Answers can be wrong; verify them, and never rely on them in place of your own judgment or your supervisors.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: space.xl, gap: space.xl * 1.5, justifyContent: "center" },
  mark: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
});
