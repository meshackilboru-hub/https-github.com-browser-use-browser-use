import MarkdownDisplay from "react-native-markdown-display";
import { useTheme } from "@/lib/theme";

/** Renders Claude's Markdown answers in the app's theme. */
export function Markdown({ children }: { children: string }) {
  const t = useTheme();
  return (
    <MarkdownDisplay
      style={{
        body: { color: t.ink, fontSize: 16, lineHeight: 23 },
        heading1: { fontSize: 20, fontWeight: "700", marginTop: 8, marginBottom: 4 },
        heading2: { fontSize: 18, fontWeight: "700", marginTop: 8, marginBottom: 4 },
        heading3: { fontSize: 16, fontWeight: "700", marginTop: 6, marginBottom: 2 },
        strong: { fontWeight: "700" },
        paragraph: { marginTop: 0, marginBottom: 8 },
        bullet_list: { marginBottom: 8 },
        ordered_list: { marginBottom: 8 },
        code_inline: { backgroundColor: t.sunk, color: t.ink, borderRadius: 4, paddingHorizontal: 4 },
        fence: { backgroundColor: t.sunk, color: t.ink, borderColor: t.line, borderRadius: 8 },
        code_block: { backgroundColor: t.sunk, color: t.ink, borderColor: t.line, borderRadius: 8 },
        blockquote: { backgroundColor: t.accentSoft, borderLeftColor: t.accent, borderLeftWidth: 3, paddingHorizontal: 10 },
        table: { borderColor: t.line, borderRadius: 6, marginBottom: 8 },
        th: { backgroundColor: t.sunk, padding: 6, borderColor: t.line },
        td: { padding: 6, borderColor: t.line },
        tr: { borderColor: t.line },
        hr: { backgroundColor: t.line },
        link: { color: t.accent },
      }}
    >
      {children}
    </MarkdownDisplay>
  );
}
