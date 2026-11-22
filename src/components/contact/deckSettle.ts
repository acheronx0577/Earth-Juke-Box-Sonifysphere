/** The deck can skip WebGL once the cards have stopped moving. Waves are separate. */
export function deckIsSettled(motion: {
  readonly intro: boolean;
  readonly drag: boolean;
  readonly spring: boolean;
  readonly speed: number;
  readonly swing: number;
  readonly c: number;
  readonly t: number;
}): boolean {
  return !motion.intro
    && !motion.drag
    && !motion.spring
    && Math.abs(motion.speed) < 0.001
    && Math.abs(motion.swing) < 0.0008
    && Math.abs(motion.c - motion.t) < 0.0015;
}
