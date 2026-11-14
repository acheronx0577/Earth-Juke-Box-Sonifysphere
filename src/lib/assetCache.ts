const images = new Map<string, Promise<void>>();

export function canWarmAssets() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !connection?.saveData && !/(^|-)2g$/.test(connection?.effectiveType ?? "");
}

/** Bounded, shared decode requests; the browser owns HTTP cache validation and eviction. */
export function warmImages(urls: readonly string[]): Promise<void> {
  return Promise.all(urls.map((url) => {
    const cached = images.get(url);
    if (cached) return cached;
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = url;
    const ready = image.decode().catch(() => { images.delete(url); });
    images.set(url, ready);
    if (images.size > 24) images.delete(images.keys().next().value!);
    return ready;
  })).then(() => {});
}
