export function chamferClip(px: number): string {
  return `polygon(${px}px 0, calc(100% - ${px}px) 0, 100% ${px}px, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, ${px}px 100%, 0 calc(100% - ${px}px), 0 ${px}px)`;
}
