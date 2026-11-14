export function setSignalLive(live: boolean): void {
  if (typeof document === "undefined") return;
  if (live) document.documentElement.dataset.signalLive = "1";
  else delete document.documentElement.dataset.signalLive;
}
