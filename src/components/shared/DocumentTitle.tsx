"use client";

import { useEffect } from "react";

export function DocumentTitle({ title }: { readonly title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
