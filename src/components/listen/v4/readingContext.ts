/** UTC instant the Listen probe requests for a timeline year. */
export function probeInstant(year: number): string {
  if (!Number.isInteger(year)) return "";
  return `${year}-09-15T12:00:00.000Z`;
}

/** Context that must match before a Listen reading is shown or played. */
export interface ReadingContext {
  readonly source: string;
  readonly layer: string;
  readonly lat: number;
  readonly lon: number;
  readonly time: string;
}

export interface TaggedReading {
  readonly context: ReadingContext;
  readonly value: string;
  readonly detail: string;
  /** Absent on a real reading. "no-data" is an honest empty for this date. "measuring" indicates processing. */
  readonly status?: "reading" | "no-data" | "measuring";
}

export function readingContextsMatch(
  current: ReadingContext | null | undefined,
  tagged: ReadingContext | null | undefined,
): boolean {
  if (!current || !tagged) return false;
  return (
    current.source === tagged.source &&
    current.layer === tagged.layer &&
    current.lat === tagged.lat &&
    current.lon === tagged.lon &&
    current.time === tagged.time
  );
}

/** Returns the reading only when every context field matches. Otherwise null. */
export function acceptReading<T extends { readonly context: ReadingContext }>(
  current: ReadingContext,
  reading: T | null | undefined,
): T | null {
  if (!reading || !readingContextsMatch(current, reading.context)) return null;
  return reading;
}
