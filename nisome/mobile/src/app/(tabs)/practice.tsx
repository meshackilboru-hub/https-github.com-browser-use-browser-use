import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/lib/auth";
import { space, useTheme } from "@/lib/theme";
import { Segmented } from "@/components/ui";
import { Quiz } from "@/features/Quiz";
import { Cases } from "@/features/Cases";
import { Cards } from "@/features/Cards";

type Mode = "questions" | "cases" | "cards";

/** General practice, not tied to an upload: exam-style questions, simulated patients and flashcards. */
export default function Practice() {
  const t = useTheme();
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>("questions");
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: space.md, backgroundColor: t.surface }}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "questions", label: profile?.role === "practitioner" ? "Self-test" : "Questions" },
            { value: "cases", label: "Cases" },
            { value: "cards", label: "Flashcards" },
          ]}
        />
      </View>
      {mode === "questions" ? <Quiz /> : mode === "cases" ? <Cases /> : <Cards />}
    </View>
  );
}
