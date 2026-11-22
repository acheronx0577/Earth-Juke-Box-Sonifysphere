/** True when smooth scroll has nothing left to interpolate. */
export function scrollIsResting(velocity: number, scrolling: boolean | "native" | "smooth"): boolean {
  return scrolling === false && Math.abs(velocity) < 0.05;
}
