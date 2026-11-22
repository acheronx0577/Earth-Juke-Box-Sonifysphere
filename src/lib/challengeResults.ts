export type SharedGuessResult = Readonly<{
  correct: number;
  total: number;
  score: number;
  bestStreak: number;
}>;

export type SharedMatchResult = Readonly<{
  roundScores: readonly number[];
}>;

export function encodeGuessResult(result: SharedGuessResult): string {
  return `v1.${result.correct}.${result.total}.${result.score}.${result.bestStreak}`;
}

export function parseGuessResult(value: string | undefined): SharedGuessResult | null {
  if (!value || value.length > 40) return null;
  const match = /^v1\.(\d{1,2})\.(\d{1,2})\.(\d{1,6})\.(\d{1,2})$/.exec(value);
  if (!match) return null;

  const [, correctText, totalText, scoreText, streakText] = match;
  const result = {
    correct: Number(correctText),
    total: Number(totalText),
    score: Number(scoreText),
    bestStreak: Number(streakText),
  };
  if (result.total < 1 || result.total > 20 || result.correct > result.total || result.score > 100_000 || result.bestStreak > result.correct) return null;
  return result;
}

export function encodeMatchResult(result: SharedMatchResult): string {
  return `v1.${result.roundScores.map((score) => Math.round(score)).join(".")}`;
}

export function parseMatchResult(value: string | undefined): SharedMatchResult | null {
  if (!value || value.length > 40) return null;
  const match = /^v1\.(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/.exec(value);
  if (!match) return null;
  const roundScores = match.slice(1).map(Number);
  if (roundScores.some((score) => score < 880 || score > 1000)) return null;
  return { roundScores };
}

export { encodeRibbonsResult, parseRibbonsResult, type SharedRibbonsResult } from "./ribbonsResult";
