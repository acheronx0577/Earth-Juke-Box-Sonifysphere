/** How long to wait before the next draw. Zero means the next animation frame is due. */
export function frameWait(now: number, previous: number, interval: number): number {
  if (!previous || interval <= 0) return 0;
  const left = interval - (now - previous);
  return left > 1 ? left : 0;
}
