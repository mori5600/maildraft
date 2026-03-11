export type AppTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "maildraft.theme";

export function resolveInitialTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: AppTheme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
