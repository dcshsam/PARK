"use client";

import { createContext, useContext, useSyncExternalStore, useCallback } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) || "system";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

function subscribeTheme(callback: () => void) {
  const handler = () => callback();
  window.addEventListener("storage", handler);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", handler);
  return () => {
    window.removeEventListener("storage", handler);
    media.removeEventListener("change", handler);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    getStoredTheme,
    () => "system"
  );
  const resolvedTheme = resolveTheme(theme);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem("theme", next);
    applyTheme(next);
    window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
