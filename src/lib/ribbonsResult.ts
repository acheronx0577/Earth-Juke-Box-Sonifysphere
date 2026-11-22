/**
 * Challenge 03 · Waveform Ribbons.
 * Round data, scoring, and the shared-result codec live here so a link
 * cannot invent a total that the rounds do not add up to.
 */

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;
export type SeasonName = (typeof SEASONS)[number];

export const CHALLENGE_NAME = "Waveform Ribbons";
export const CHALLENGE_EYEBROW = "Challenge 03 · Waveform Ribbons";

export const SEASON_OF: Record<string, SeasonName> = {
  Jan: "Winter",
  Feb: "Winter",
  Mar: "Spring",
  Apr: "Spring",
  May: "Spring",
  Jun: "Summer",
  Jul: "Summer",
  Aug: "Summer",
  Sep: "Autumn",
  Oct: "Autumn",
  Nov: "Autumn",
  Dec: "Winter",
};

export interface RibbonPattern {
  readonly id: string;
  readonly shortTitle: string;
  readonly resultLabel: string;
  readonly defaultSeason: string;
  readonly turnIndex: number;
  readonly points: readonly [number, number][];
  readonly months: readonly string[];
  readonly turnReason: string;
  readonly missHint: string;
  readonly infoFact: string;
}

export const HOW =
  "Play the curve and leave it running. Pitch follows the line, higher where the curve is higher, and the phrase loops until you pause. Choose the season where it turns, then Check.";

export const PATTERNS: readonly RibbonPattern[] = [
  {
    id: "co2-keeling",
    shortTitle: "CO₂ Cycle",
    resultLabel: "CO₂ · MAY",
    defaultSeason: "Spring",
    turnIndex: 3,
    points: [
      [0, 185],
      [100, 160],
      [200, 105],
      [300, 70],
      [400, 90],
      [500, 145],
      [600, 190],
    ],
    months: ["Nov", "Jan", "Mar", "May", "Jul", "Sep", "Nov"],
    turnReason: "Yes. The line turns in spring, in May, where atmospheric CO₂ crests.",
    missHint: "Listen for the crest, where the line stops rising and turns down into the summer drawdown.",
    infoFact: "CO₂ peaks each May, before northern forests leaf out. Keeling first measured this “inhale” on Mauna Loa in 1958.",
  },
  {
    id: "sea-ice-minimum",
    shortTitle: "Sea Ice",
    resultLabel: "SEA ICE · SEP",
    defaultSeason: "Autumn",
    turnIndex: 3,
    points: [
      [0, 80],
      [100, 115],
      [200, 160],
      [300, 205],
      [400, 175],
      [500, 125],
      [600, 85],
    ],
    months: ["Mar", "May", "Jul", "Sep", "Nov", "Jan", "Mar"],
    turnReason: "Correct. The line turns in autumn, in Sep, at the annual minimum.",
    missHint: "Listen for the trough, where the summer melt stops and the line turns back up.",
    infoFact: "The September minimum is the turn, after which the pack freezes again. NASA has tracked it since 1979.",
  },
  {
    id: "ocean-heat-content",
    shortTitle: "Ocean Heat",
    resultLabel: "OCEAN HEAT · AUG",
    defaultSeason: "Summer",
    turnIndex: 3,
    points: [
      [0, 180],
      [100, 150],
      [200, 100],
      [300, 65],
      [400, 85],
      [500, 140],
      [600, 185],
    ],
    months: ["Feb", "Apr", "Jun", "Aug", "Oct", "Dec", "Feb"],
    turnReason: "Spot on. The line turns in summer, in Aug, at the late-summer crest.",
    missHint: "Listen for the thermal crest, where the line stops rising and turns down.",
    infoFact: "Upper-ocean heat crests in late summer, then releases to the air. Most of Earth's extra heat is stored in the ocean.",
  },
];

const SEASON_CODE: Record<SeasonName, string> = {
  Spring: "S",
  Summer: "U",
  Autumn: "A",
  Winter: "W",
};

const CODE_SEASON: Record<string, SeasonName> = {
  S: "Spring",
  U: "Summer",
  A: "Autumn",
  W: "Winter",
};

export type LineWord = "RISING" | "FALLING" | "LEVEL";
export type RoundScore = 0 | 30 | 60 | 100;
export type RoundOutcome = "solved" | "reveal" | "skip";

export interface RoundRecord {
  readonly guesses: readonly SeasonName[];
  readonly outcome: RoundOutcome;
  readonly score: RoundScore;
}

export interface SharedRibbonsResult {
  readonly rounds: readonly RoundRecord[];
  readonly patternsSolved: number;
  readonly totalScore: number;
  readonly firstTries: number;
}

export function answerSeason(pattern: RibbonPattern): SeasonName {
  return SEASON_OF[pattern.months[pattern.turnIndex]] ?? (pattern.defaultSeason as SeasonName);
}

export function turnMonth(pattern: RibbonPattern): string {
  return pattern.months[pattern.turnIndex] ?? "";
}

/** Slope of the stored curve. Larger y sits lower on the chart, so a rise in y is the line falling. */
export function lineDirection(points: readonly [number, number][], index: number): LineWord {
  const y = points[index]?.[1];
  if (y === undefined) return "LEVEL";
  const prev = index > 0 ? y - points[index - 1][1] : null;
  const next = index < points.length - 1 ? points[index + 1][1] - y : null;
  if (prev !== null && next !== null && prev * next < 0) return "LEVEL";
  const slope = prev ?? next ?? 0;
  if (slope > 0) return "FALLING";
  if (slope < 0) return "RISING";
  return "LEVEL";
}

export function scoreForTry(tryNumber: number): RoundScore {
  if (tryNumber === 1) return 100;
  if (tryNumber === 2) return 60;
  if (tryNumber === 3) return 30;
  return 0;
}

export function wrongCopy(season: SeasonName, pattern: RibbonPattern, misses: number): string {
  const base = `${season} is not where it turns.`;
  if (misses >= 2) return `${base} ${pattern.missHint}`;
  return base;
}

export function revealCopy(pattern: RibbonPattern): string {
  return `The line turns in ${answerSeason(pattern).toLowerCase()}, in ${turnMonth(pattern)}.`;
}

export function skipCopy(pattern: RibbonPattern): string {
  return `Skipped. ${revealCopy(pattern)}`;
}

const LADDER: readonly RoundScore[] = [0, 30, 60, 100];

/** Pull an out-of-range round score onto the legal ladder. Ties go to the lower step. */
export function clampRoundScore(value: number): RoundScore {
  if (!Number.isFinite(value)) return 0;
  const capped = Math.min(100, Math.max(0, value));
  let best: RoundScore = 0;
  let bestDist = Infinity;
  for (const step of LADDER) {
    const dist = Math.abs(step - capped);
    if (dist < bestDist || (dist === bestDist && step < best)) {
      best = step;
      bestDist = dist;
    }
  }
  return best;
}

function summarize(rounds: readonly RoundRecord[]): SharedRibbonsResult {
  const totalScore = rounds.reduce((sum, round) => sum + round.score, 0);
  const patternsSolved = rounds.filter((round) => round.outcome === "solved").length;
  const firstTries = rounds.filter((round) => round.outcome === "solved" && round.score === 100).length;
  return { rounds, patternsSolved, totalScore, firstTries };
}

function encodeRound(round: RoundRecord): string {
  const letters = round.guesses.map((season) => SEASON_CODE[season]).join("");
  if (round.outcome === "reveal") return `r${letters}`;
  if (round.outcome === "skip") return `s${letters}`;
  return `${round.guesses.length}${letters}`;
}

function tokenPreserves(round: RoundRecord): boolean {
  if (round.outcome === "reveal") return round.score === 0 && round.guesses.length === 3;
  if (round.outcome === "skip") return round.score === 0 && round.guesses.length <= 2;
  return round.score === scoreForTry(round.guesses.length);
}

export function encodeRibbonsResult(result: { readonly rounds: readonly RoundRecord[] }): string {
  if (result.rounds.every(tokenPreserves)) return `v2.${result.rounds.map(encodeRound).join(".")}`;
  return `v2.${result.rounds.map((round) => round.score).join(".")}`;
}

function parseGuesses(letters: string): SeasonName[] | null {
  const guesses: SeasonName[] = [];
  for (const letter of letters) {
    const season = CODE_SEASON[letter];
    if (!season) return null;
    guesses.push(season);
  }
  if (new Set(guesses).size !== guesses.length) return null;
  return guesses;
}

function parseRoundToken(token: string, index: number): RoundRecord | null {
  const pattern = PATTERNS[index];
  if (!pattern) return null;
  const answer = answerSeason(pattern);
  const head = token[0];
  const guesses = parseGuesses(token.slice(1));
  if (!head || !guesses) return null;
  if (head === "r") {
    if (guesses.length !== 3 || guesses.includes(answer)) return null;
    return { guesses, outcome: "reveal", score: 0 };
  }
  if (head === "s") {
    if (guesses.length > 2 || guesses.includes(answer)) return null;
    return { guesses, outcome: "skip", score: 0 };
  }
  const tryN = Number(head);
  if (tryN !== guesses.length || tryN < 1 || tryN > 3) return null;
  if (guesses[guesses.length - 1] !== answer) return null;
  if (guesses.slice(0, -1).includes(answer)) return null;
  return { guesses, outcome: "solved", score: scoreForTry(tryN) };
}

function numericRounds(scores: readonly number[]): SharedRibbonsResult {
  const rounds = scores.map((raw, index): RoundRecord => {
    const score = clampRoundScore(raw);
    const answer = answerSeason(PATTERNS[index]);
    if (score === 0) return { guesses: [], outcome: "skip", score: 0 };
    return { guesses: [answer], outcome: "solved", score };
  });
  return summarize(rounds);
}

/**
 * Decode a shared result.
 * Token form (`v2.1S.2UA.s`) is checked against the real answers and the total is the sum of those rounds.
 * Numeric form (`v2.100.60.900`) clamps each round onto 0/30/60/100 and recomputes the total.
 * Anything else, including the old `v1.solved.score` links, is rejected.
 */
export function parseRibbonsResult(value: string | undefined): SharedRibbonsResult | null {
  if (!value || value.length > 64) return null;
  const numeric = /^v2\.(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/.exec(value);
  if (numeric) return numericRounds(numeric.slice(1).map(Number));
  const token = /^v2\.([1-3rs][SUAW]{0,3})\.([1-3rs][SUAW]{0,3})\.([1-3rs][SUAW]{0,3})$/.exec(value);
  if (!token) return null;
  const rounds: RoundRecord[] = [];
  for (let index = 0; index < 3; index += 1) {
    const round = parseRoundToken(token[index + 1] ?? "", index);
    if (!round) return null;
    rounds.push(round);
  }
  return summarize(rounds);
}

export function tryLabel(round: RoundRecord): { readonly text: string; readonly first: boolean } {
  if (round.outcome === "reveal") return { text: "Revealed", first: false };
  if (round.outcome === "skip") return { text: "Skipped", first: false };
  const count = round.score === 100 ? 1 : round.score === 60 ? 2 : round.score === 30 ? 3 : Math.max(1, round.guesses.length);
  const word = count === 1 ? "1st" : count === 2 ? "2nd" : "3rd";
  return { text: `${word} try`, first: count === 1 && round.outcome === "solved" };
}

export function saidParts(round: RoundRecord, pattern: RibbonPattern): { readonly misses: readonly SeasonName[]; readonly turn: string } {
  const turn = `${answerSeason(pattern)} · ${turnMonth(pattern)}`;
  if (round.outcome === "solved") {
    return { misses: round.guesses.slice(0, -1), turn };
  }
  return { misses: round.guesses, turn };
}
