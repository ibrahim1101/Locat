export type Theme = "dark" | "light" | "system";
export type Accent = "olive" | "teal" | "blue" | "violet" | "rose";
export type Appearance = { theme: Theme; accent: Accent };
export const appearanceEvent = "locat-appearance-changed";
export function parseAppearance(theme: string | null, accent: string | null): Appearance {
  return { theme: theme === "light" || theme === "system" ? theme : "dark",
    accent: accent === "olive" || accent === "teal" || accent === "blue" || accent === "violet" || accent === "rose" ? accent : "olive" };
}
let current: Appearance = { theme: "dark", accent: "olive" };
function readAppearance(): Appearance {
  try { return parseAppearance(localStorage.getItem("locat-theme"), localStorage.getItem("locat-accent")); }
  catch { return current; }
}
export function getAppearance(): Appearance { return current; }
function applyAppearance(): void {
  const theme = current.theme === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : current.theme;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.accent = current.accent;
  root.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#10120f" : "#f9fafb");
}
export function setAppearance(next: Appearance): boolean {
  current = parseAppearance(next.theme, next.accent);
  applyAppearance();
  let saved = true;
  try { localStorage.setItem("locat-theme", current.theme); localStorage.setItem("locat-accent", current.accent); }
  catch { saved = false; }
  window.dispatchEvent(new Event(appearanceEvent));
  return saved;
}
/** Runs for the entire app lifetime, including login and closed Settings. */
export function startAppearance(): () => void {
  current = readAppearance();
  applyAppearance();
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const changed = () => { if (current.theme === "system") applyAppearance(); };
  const storage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== "locat-theme" && event.key !== "locat-accent") return;
    current = readAppearance(); applyAppearance(); window.dispatchEvent(new Event(appearanceEvent));
  };
  media.addEventListener("change", changed);
  window.addEventListener("storage", storage);
  return () => { media.removeEventListener("change", changed); window.removeEventListener("storage", storage); };
}
