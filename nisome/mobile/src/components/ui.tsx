import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { radius, space, useTheme } from "@/lib/theme";

type ButtonProps = {
  title: string;
  onPress(): void;
  variant?: "primary" | "ghost" | "quiet" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
};

export function Button({ title, onPress, variant = "primary", disabled, loading, style, icon }: ButtonProps) {
  const t = useTheme();
  const palette = {
    primary: { bg: t.accent, fg: t.accentInk, border: t.accent },
    ghost: { bg: "transparent", fg: t.accent, border: t.accent },
    quiet: { bg: "transparent", fg: t.ink, border: t.line },
    danger: { bg: "transparent", fg: t.bad, border: t.bad },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon}
      <Text style={[styles.btnText, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress(): void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? t.accent : t.line, backgroundColor: selected ? t.accent : "transparent" },
      ]}
    >
      <Text style={{ color: selected ? t.accentInk : t.ink, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** A horizontally scrolling row of chips (single choice). */
export function ChipScroller({ options, value, onChange }: { options: string[]; value: string; onChange(v: string): void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
      {options.map((o) => (
        <Chip key={o} label={o} selected={o === value} onPress={() => onChange(o)} />
      ))}
    </ScrollView>
  );
}

export function ChipWrap({ options, value, onChange }: { options: string[]; value?: string; onChange(v: string): void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {options.map((o) => (
        <Chip key={o} label={o} selected={o === value} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2, marginBottom: space.sm }}>
      <Text style={[styles.label, { color: t.muted }]}>{children}</Text>
      {hint ? <Text style={{ color: t.muted, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

export function Field(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[styles.field, { borderColor: t.line, backgroundColor: t.surface, color: t.ink }, props.style]}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }, style]}>{children}</View>;
}

export function Banner({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "bad" | "info" }) {
  const t = useTheme();
  const bg = tone === "bad" ? t.badSoft : tone === "info" ? t.accentSoft : t.warnSoft;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: t.ink, fontSize: 13.5, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.tag, { borderColor: t.line }]}>
      <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  btnText: { fontSize: 16, fontWeight: "600" },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  field: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  banner: { borderRadius: radius.md, padding: space.md },
  tag: { alignSelf: "flex-start", borderWidth: 1, borderStyle: "dashed", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
});

/** A row of equal-width tabs for switching views within a screen. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange(v: T): void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.sunk, borderRadius: radius.pill, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: on ? t.surface : "transparent", alignItems: "center" }}
          >
            <Text style={{ color: on ? t.ink : t.muted, fontWeight: on ? "700" : "500", fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const t = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.sunk, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, height: 6, backgroundColor: t.accent }} />
    </View>
  );
}
