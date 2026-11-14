let allowed = true;
const stoppers = new Set<() => void>();

export function playbackAllowed(): boolean {
  return allowed;
}

export function onPlaybackStopped(stop: () => void): () => void {
  stoppers.add(stop);
  return () => {
    stoppers.delete(stop);
  };
}

/** Flip the shared gate. Turning it off runs every registered stopper immediately. */
export function setPlaybackAllowed(next: boolean): void {
  allowed = next;
  if (next) return;
  stoppers.forEach((stop) => stop());
}
