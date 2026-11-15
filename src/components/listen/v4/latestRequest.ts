export interface LatestTicket {
  readonly id: number;
  readonly signal: AbortSignal;
}

export interface LatestRequest {
  start(): LatestTicket;
  isCurrent(id: number): boolean;
  abort(): void;
}

/** Aborts the previous request and ignores any response that is no longer the latest. */
export function createLatestRequest(): LatestRequest {
  let latest = 0;
  let controller: AbortController | null = null;
  return {
    start() {
      latest += 1;
      controller?.abort();
      controller = new AbortController();
      return { id: latest, signal: controller.signal };
    },
    isCurrent(id: number) {
      return id === latest;
    },
    abort() {
      latest += 1;
      controller?.abort();
      controller = null;
    },
  };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Keeps a completed response only when its ticket is still the latest request. */
export function takeIfCurrent<T>(guard: LatestRequest, id: number, value: T): T | null {
  return guard.isCurrent(id) ? value : null;
}
