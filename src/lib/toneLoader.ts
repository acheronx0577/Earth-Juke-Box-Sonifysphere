type ToneModule = typeof import("tone");

let loading: Promise<ToneModule> | null = null;
let loaded: ToneModule | null = null;

/** One dynamic import for every player. The module stays out of the first paint. */
export function loadTone(): Promise<ToneModule> {
  loading ??= import("tone").then((mod) => {
    loaded = mod;
    return mod;
  });
  return loading;
}

export function toneModule(): ToneModule | null {
  return loaded;
}

/** Suspend only a context this page already created. Do not import Tone just to pause it. */
export async function suspendToneIfLoaded(): Promise<void> {
  if (!loaded) return;
  try {
    const raw = loaded.getContext().rawContext as AudioContext;
    if (raw.state === "running") await raw.suspend();
  } catch {
    // The context may already be closing.
  }
}
