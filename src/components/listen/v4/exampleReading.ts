export type ProbeState = "matched" | "image" | "empty" | "loading";

/** Sea-ice example copy. There is no hard-coded extent. */
export function seaIceExample(when: string): { readonly value: string; readonly detail: string } {
  return {
    value: "EXAMPLE",
    detail: `EXAMPLE DATA · ${when} · NOT A MEASUREMENT`,
  };
}

/** Hearing-panel label. Example data stays labeled example; a real match does not. */
export function dataAtProbeLabel(state: ProbeState, example: boolean): string {
  if (state === "matched" && example) return "EXAMPLE DATA";
  if (state === "matched") return "MATCHED";
  if (state === "image") return "IMAGE-DERIVED";
  if (state === "loading") return "LOADING";
  return "NO DATA";
}
