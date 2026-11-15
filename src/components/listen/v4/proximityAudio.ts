/** Probe position in the visible container, rather than longitude on the globe. */
export interface ListeningFocus {
  readonly sourceId: string;
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

export interface ProximityMix {
  readonly detail: number;
  readonly gain: number;
  readonly pan: number;
}

/** Zoom narrows the audible field; offscreen readings fade out instead of following the camera. */
export function proximityMix(focus: ListeningFocus | null): ProximityMix {
  if (!focus) return { detail: 0, gain: 1, pan: 0 };
  const zoom = Number.isFinite(focus.zoom) ? Math.min(4, Math.max(1, focus.zoom)) : 1;
  const x = Number.isFinite(focus.x) ? focus.x : 0.5;
  const y = Number.isFinite(focus.y) ? focus.y : 0.5;
  const detail = Math.log2(zoom) / 2;
  const distance = Math.hypot((x - 0.5) * 2, (y - 0.5) * 2);
  const outside = Math.max(0, Math.abs(x - 0.5) * 2 - 1, Math.abs(y - 0.5) * 2 - 1);
  const visibility = Math.max(0, 1 - outside * 4);
  return {
    detail,
    gain: visibility * (0.78 + detail * 0.22) / (1 + distance * distance * (0.1 + detail * 0.65)),
    pan: Math.min(1, Math.max(-1, (x - 0.5) * 2)),
  };
}
