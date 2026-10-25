import { fileURLToPath } from "node:url";
import type { Theme } from "@earendil-works/pi-coding-agent";

// Pi exports Theme, but not its built-in theme loader. Resolve from the pinned
// package entry (also works in a packed install), never from a sibling checkout.
// Keep this compatibility seam isolated and covered by package tests.
const themeDirectory = new URL("modes/interactive/theme/", import.meta.resolve("@earendil-works/pi-coding-agent"));
const { loadThemeFromPath } = await import(new URL("theme.js", themeDirectory).href) as {
  loadThemeFromPath(path: string, mode: "truecolor"): Theme;
};

/** Fixed palette and color mode; no terminal queries, global init or watcher. */
export const headlessTheme = loadThemeFromPath(fileURLToPath(new URL("dark.json", themeDirectory)), "truecolor");

// Pi's convenience decorations use auto-detected Chalk, which disables styling
// on headless hosts. Its style() API emits ANSI independently of TTY detection.
headlessTheme.bold = (text) => headlessTheme.style(text, { bold: true });
headlessTheme.italic = (text) => headlessTheme.style(text, { italic: true });
headlessTheme.underline = (text) => headlessTheme.style(text, { underline: true });
headlessTheme.inverse = (text) => headlessTheme.style(text, { inverse: true });
headlessTheme.strikethrough = (text) => headlessTheme.style(text, { strikethrough: true });
