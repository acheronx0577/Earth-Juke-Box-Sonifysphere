export const LITE_STORAGE_KEY = "sonifysphere-lite";

export type LiteChoice = "on" | "off" | null;

export type LiteSignals = {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
  readonly deviceMemory?: number;
  readonly hardwareConcurrency?: number;
};

const SLOW_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

/** Automatic lite mode. A stored choice always wins, and the default with no signal is off. */
export function resolveLiteMode(stored: LiteChoice, signals: LiteSignals): boolean {
  if (stored === "on") return true;
  if (stored === "off") return false;
  if (signals.saveData) return true;
  if (signals.effectiveType && SLOW_CONNECTIONS.has(signals.effectiveType)) return true;
  if (typeof signals.deviceMemory === "number" && signals.deviceMemory <= 2) return true;
  if (typeof signals.hardwareConcurrency === "number" && signals.hardwareConcurrency <= 2) return true;
  return false;
}

export function readLiteSignals(): LiteSignals {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  return {
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
  };
}

export function readStoredLite(): LiteChoice {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(LITE_STORAGE_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLite(on: boolean): void {
  try {
    localStorage.setItem(LITE_STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private mode can block storage. The in-memory flag still applies.
  }
}

export function isLiteMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.lite === "on";
}

export function applyLiteMode(on: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.lite = on ? "on" : "off";
  window.dispatchEvent(new Event("sonifysphere-lite"));
}
