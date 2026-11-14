import type { LayerId, SeasonId, WeatherId } from "@/data/exploreMap";

export const GUESS_RUN_KEY = "sonifysphere-guess-run";

export interface GuessHistoryEntry {
  readonly kind: "region" | "layer";
  readonly answerId: string;
  readonly pickedId: string;
  readonly regionId: string;
  readonly layer: LayerId;
  readonly season: SeasonId;
  readonly weather: WeatherId;
  readonly answerLabel: string;
  readonly pickedLabel: string;
  readonly correct: boolean;
}

export interface StoredGuessRun {
  readonly seed: number;
  readonly session: number;
  readonly index: number;
  readonly phase: "ready" | "listening" | "answered" | "result";
  readonly score: number;
  readonly streak: number;
  readonly best: number;
  readonly correctCount: number;
  readonly pickedId: string | null;
  readonly history: readonly GuessHistoryEntry[];
}

export function isResumableGuessRun(run: StoredGuessRun | null, roundCount = 5): run is StoredGuessRun {
  if (!run || run.phase === "result") return false;
  if (!Number.isInteger(run.seed) || !Number.isInteger(run.index) || !Number.isInteger(run.score)) return false;
  if (run.index < 0 || run.index >= roundCount) return false;
  if (run.history.length < run.index) return false;
  return true;
}

export function readGuessRun(): StoredGuessRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(GUESS_RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuessRun;
    if (!parsed || typeof parsed.seed !== "number" || !Array.isArray(parsed.history)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGuessRun(run: StoredGuessRun | null): void {
  if (typeof window === "undefined") return;
  if (!run) {
    window.sessionStorage.removeItem(GUESS_RUN_KEY);
    return;
  }
  window.sessionStorage.setItem(GUESS_RUN_KEY, JSON.stringify(run));
}
