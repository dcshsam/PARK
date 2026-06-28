// Global default review strictness for the AI Enabled Review, persisted in
// localStorage (mirrors the SPR app-settings `review-strictness`). Per-run the
// review page can still override it.

import type { Strictness } from "./types";
import { DEFAULT_STRICTNESS } from "./sections";

const STORAGE_KEY = "prop-review:default-strictness";

export function getDefaultStrictness(): Strictness {
  if (typeof window === "undefined") return DEFAULT_STRICTNESS;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "low" || v === "medium" || v === "high" ? v : DEFAULT_STRICTNESS;
}

export function setDefaultStrictness(value: Strictness): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
}
