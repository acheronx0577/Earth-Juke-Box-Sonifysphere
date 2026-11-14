import { regionById } from "@/data/exploreMap";

export function SignalMap({ regionId, fill = false }: { readonly regionId: string; readonly fill?: boolean }) {
  const region = regionById(regionId);
  const markX = region.box ? region.hit.x + region.hit.w / 2 : region.x;
  const markY = region.box ? region.hit.y + region.hit.h / 2 : region.y;
  return (
    <div className={fill ? "sonify-map-fill" : "sonify-map-frame"} data-testid="signal-map">
      <img src="/assets/listen/map.svg" alt="" className="absolute inset-0 h-full w-full" />
      <span className="sonify-map-mark" style={{ left: `${markX}%`, top: `${markY}%` }} />
      <span className="sonify-map-label" style={{ left: `${markX}%`, top: `${markY}%` }}>
        {region.name}
      </span>
    </div>
  );
}
