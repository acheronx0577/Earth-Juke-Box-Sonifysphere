const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Formats an exact UTC instant as "15 Sep 2024 12:00 UTC". Invalid instants return null. */
export function formatUtcInstant(instant: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(instant);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number(match[7]);
  if (month < 1 || month > 12) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }
  const monthName = MONTHS[month - 1];
  if (!monthName) return null;
  return `${day} ${monthName} ${year} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} UTC`;
}

/** True when the measurement route is reporting an empty provider value, not an outage. */
export function isNoDataResponse(status: number, error: string | undefined): boolean {
  if (status === 404) return true;
  return status === 502 && typeof error === "string" && /no (?:matched|valid) reading/i.test(error);
}
