"use client";

import { useEffect, useState } from "react";
import {
  applyLiteMode,
  isLiteMode,
  readLiteSignals,
  readStoredLite,
  resolveLiteMode,
  writeStoredLite,
} from "@/lib/liteMode";

export function LiteToggle({ className = "" }: { readonly className?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = resolveLiteMode(readStoredLite(), readLiteSignals());
      applyLiteMode(next);
      setOn(next);
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

  return (
    <button
      type="button"
      className={`lite-toggle ${className}`.trim()}
      aria-pressed={on}
      aria-label={on ? "Lite mode on" : "Lite mode off"}
      onClick={() => {
        const next = !isLiteMode();
        writeStoredLite(next);
        applyLiteMode(next);
        setOn(next);
      }}
    >
      <span>Lite</span>
    </button>
  );
}
