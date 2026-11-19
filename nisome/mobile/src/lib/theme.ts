import { useColorScheme } from "react-native";

const light = {
  bg: "#F2F5F7",
  surface: "#FFFFFF",
  sunk: "#E8EDF0",
  ink: "#13212A",
  muted: "#5A6B76",
  line: "#D6DEE3",
  accent: "#0F6E66",
  accentInk: "#FFFFFF",
  accentSoft: "#DCEFEC",
  good: "#16803C",
  goodSoft: "#E1F3E7",
  bad: "#B42318",
  badSoft: "#FBE7E5",
  warnSoft: "#FFF4DB",
};

const dark: typeof light = {
  bg: "#0D1418",
  surface: "#141F25",
  sunk: "#0F181D",
  ink: "#E2EAEE",
  muted: "#8FA1AC",
  line: "#24343D",
  accent: "#3FC2AF",
  accentInk: "#06201C",
  accentSoft: "#123630",
  good: "#5AD48A",
  goodSoft: "#123222",
  bad: "#F2857A",
  badSoft: "#3A1A17",
  warnSoft: "#3A2E12",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
