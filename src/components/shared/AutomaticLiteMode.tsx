"use client";

import { useEffect } from "react";
import {
  applyLiteMode,
  readLiteSignals,
  readStoredLite,
  resolveLiteMode,
} from "@/lib/liteMode";

export function AutomaticLiteMode() {
  useEffect(() => {
    const sync = () => {
      const next = resolveLiteMode(readStoredLite(), readLiteSignals());
      applyLiteMode(next);
    };
    sync();
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    connection?.addEventListener?.("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      connection?.removeEventListener?.("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return null;
}
