const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** The Listen timeline requests 15 September at 12:00 UTC of the selected year. */
export function probeInstantForYear(year: number): string {
  if (!Number.isInteger(year)) return "";
  return `${year}-09-15T12:00:00.000Z`;
}

/** Exact UTC instant, for example "15 Sep 2024 12:00 UTC". */
export function formatUtcInstantLabel(time: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{3}Z$/.exec(time);
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || day < 1 || day > 31) return "";
  return `${day} ${month} ${match[1]} ${match[4]}:${match[5]} UTC`;
}

export function dateLabel(year: number): string {
  return formatUtcInstantLabel(probeInstantForYear(year));
}

export function noDataForDate(year: number): string {
  const when = dateLabel(year);
  return when ? `No data for ${when}` : "No data for this date";
}
