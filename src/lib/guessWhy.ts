import {
  MAP_REGIONS,
  regionById,
  type LayerId,
  type SeasonId,
  type WeatherId,
} from "@/data/exploreMap";

export interface GuessWhyInput {
  readonly kind: "region" | "layer";
  readonly layer: LayerId;
  readonly season: SeasonId;
  readonly weather: WeatherId;
  readonly answerId: string;
}

const RECORD_SHIFT: Record<LayerId, number> = {
  co2: 48,
  temperature: 0,
  "sea-ice": -24,
  methane: -36,
};

const RECORD_COPY: Record<LayerId, { readonly name: string; readonly tone: string; readonly place: string; readonly hollow: boolean }> = {
  co2: { name: "CO₂", tone: "smooth", place: "the highest", hollow: false },
  temperature: { name: "Temperature", tone: "smooth", place: "in the middle", hollow: false },
  "sea-ice": { name: "Sea ice", tone: "hollow", place: "a lower one", hollow: true },
  methane: { name: "Methane", tone: "hollow", place: "the lowest", hollow: true },
};

function placePhrase(note: number): string {
  const band = noteBand(note);
  if (band === "the highest") return "the highest note of the 12 places";
  if (band === "the lowest") return "the lowest note of the 12 places";
  if (band === "a high") return "a high note among the 12 places";
  if (band === "a low") return "a low note among the 12 places";
  return "a middle note among the 12 places";
}

function noteBand(note: number): "the highest" | "the lowest" | "a high" | "a middle" | "a low" {
  const sorted = MAP_REGIONS.map((region) => region.note).sort((left, right) => left - right);
  const max = sorted[sorted.length - 1] ?? note;
  const min = sorted[0] ?? note;
  if (note === max) return "the highest";
  if (note === min) return "the lowest";
  const index = sorted.indexOf(note);
  const third = Math.ceil(sorted.length / 3);
  if (index >= sorted.length - third) return "a high";
  if (index < third) return "a low";
  return "a middle";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function seasonBit(season: SeasonId): string | null {
  if (season === "summer") return "summer lifts it a little more";
  if (season === "winter") return "winter pulls it down a little";
  if (season === "fall") return "fall pulls it down slightly";
  return null;
}

function weatherBit(weather: WeatherId): string | null {
  if (weather === "heat") return "heat lifts it";
  if (weather === "storm") return "the storm lowers it and shortens the note";
  if (weather === "rain") return "rain shortens the note";
  return null;
}

function extraSentence(season: SeasonId, weather: WeatherId): string | null {
  const seasonText = seasonBit(season);
  const weatherText = weatherBit(weather);
  if (seasonText && weatherText) return `${capitalize(seasonText)}, and ${weatherText}.`;
  if (seasonText) return `${capitalize(seasonText)}.`;
  if (weatherText) return `${capitalize(weatherText)}.`;
  return null;
}

function midSentence(name: string): string {
  if (name === "CO₂") return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function regionWhy(round: GuessWhyInput, pickedId: string): string {
  const answer = regionById(round.answerId);
  const picked = regionById(pickedId);
  if (pickedId === round.answerId) {
    const extra = extraSentence(round.season, round.weather);
    return `${answer.name} is ${placePhrase(answer.note)}.${extra ? ` ${extra}` : ""}`;
  }
  const same = answer.note === picked.note;
  const higher = answer.note > picked.note;
  const relation = same ? "about the same as" : higher ? "higher than" : "lower than";
  const heard = same ? "about the same" : higher ? "higher" : "lower";
  return `You picked ${picked.name}. ${answer.name} is ${relation} that, so the phrase sounds ${heard}.`;
}

function recordWhy(round: GuessWhyInput, pickedId: string): string {
  const answer = RECORD_COPY[round.answerId as LayerId] ?? RECORD_COPY[round.layer];
  const picked = RECORD_COPY[pickedId as LayerId] ?? answer;
  if (pickedId === round.answerId) {
    return `${answer.name} sounds ${answer.tone}, and it is ${answer.place} of the four records.`;
  }
  if (answer.hollow === picked.hollow) {
    const answerShift = RECORD_SHIFT[round.answerId as LayerId] ?? 0;
    const pickedShift = RECORD_SHIFT[pickedId as LayerId] ?? 0;
    const direction = answerShift >= pickedShift ? "higher" : "lower";
    const others = answer.hollow
      ? "CO₂ and temperature sound smooth."
      : "Sea ice and methane sound hollow, and lower.";
    return `You picked ${picked.name}. Both sound ${answer.tone}, but ${midSentence(answer.name)} is a little ${direction}. ${others}`;
  }
  return `You picked ${picked.name}. ${answer.name} sounds ${answer.tone}, and it is ${answer.place} of the four records. ${picked.name} sounds ${picked.tone}.`;
}

/** Plain-language reason for a guess, drawn from the map's note and tone rules. Never mentions Hz. */
export function explainGuess(round: GuessWhyInput, pickedId: string): string {
  return round.kind === "region" ? regionWhy(round, pickedId) : recordWhy(round, pickedId);
}

export function recordDisplayName(id: string): string {
  return RECORD_COPY[id as LayerId]?.name ?? id;
}
