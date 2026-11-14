import { PrimaryPillButton } from "@/components/landing/Primitives";

export function AboutMapBand() {
  return (
    <section className="about-wrap" aria-labelledby="map-h">
      <div className="about-mapband">
        <h2 id="map-h" data-about-h2>
          Now hear it on a map.
        </h2>
        <PrimaryPillButton label="Explore the map →" href="/listen" />
      </div>
    </section>
  );
}
