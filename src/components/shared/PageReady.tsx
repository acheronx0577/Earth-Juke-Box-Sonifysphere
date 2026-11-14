"use client";

import { useEffect } from "react";

/** Marks the document after hydration so skip-link focus can wait for a stable main. */
export function PageReady() {
  useEffect(() => {
    document.documentElement.dataset.sonifyReady = "1";
    return () => {
      delete document.documentElement.dataset.sonifyReady;
    };
  }, []);
  return null;
}
