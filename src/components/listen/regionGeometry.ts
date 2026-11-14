import { MAP_REGIONS } from "@/data/exploreMap";
import landContinentData from "@/data/landContinents.json";
import oceanBasinData from "@/data/oceanBasins.json";

type LngLat = readonly [number, number];
type Ring = readonly LngLat[];

type PolygonGeom = { readonly type: "Polygon"; readonly coordinates: readonly (readonly (readonly number[])[])[] };
type MultiPolygonGeom = {
  readonly type: "MultiPolygon";
  readonly coordinates: readonly (readonly (readonly (readonly number[])[])[])[];
};
export type RegionGeom = PolygonGeom | MultiPolygonGeom;

export interface RegionShape {
  readonly id: string;
  readonly rings: readonly Ring[];
  /** Where the on-map label sits, inside the shape. */
  readonly label: LngLat;
  /** Real coastline when present; otherwise rings are drawn as simple polygons. */
  readonly geometry?: RegionGeom;
}

const LAND_GEOMS = landContinentData as Record<string, RegionGeom>;
/** Ocean basins clipped to the same Natural Earth coastlines (see oceanBasins.json). */
const OCEAN_GEOMS = oceanBasinData as Record<string, RegionGeom>;

function outersFromGeom(geom: RegionGeom): Ring[] {
  if (geom.type === "Polygon") return [geom.coordinates[0] as unknown as Ring];
  return geom.coordinates.map((polygon) => polygon[0] as unknown as Ring);
}

function landShape(id: string, label: LngLat): RegionShape {
  const geometry = LAND_GEOMS[id];
  if (!geometry) throw new Error(`missing land geometry for ${id}`);
  return { id, label, rings: outersFromGeom(geometry), geometry };
}

function oceanShape(id: string, label: LngLat): RegionShape {
  const geometry = OCEAN_GEOMS[id];
  if (!geometry) throw new Error(`missing ocean geometry for ${id}`);
  return { id, label, rings: outersFromGeom(geometry), geometry };
}

const HIT_PRIORITY = [
  "nino34",
  "north-america",
  "south-america",
  "europe",
  "africa",
  "asia",
  "oceania",
  "arctic",
  "antarctica",
  "atlantic",
  "indian",
  "pacific",
] as const;

function ring(pairs: readonly number[]): Ring {
  const points: LngLat[] = [];
  for (let index = 0; index < pairs.length; index += 2) {
    points.push([pairs[index], pairs[index + 1]]);
  }
  return points;
}

export const REGION_SHAPES: readonly RegionShape[] = [
  {
    id: "nino34",
    label: [-145, 8.2],
    rings: [ring([-170, 5, -120, 5, -120, -5, -170, -5])],
  },
  landShape("north-america", [-104, 46]),
  landShape("europe", [10, 50]),
  landShape("africa", [18, 6]),
  landShape("asia", [90, 46]),
  landShape("south-america", [-62, -16]),
  landShape("oceania", [134, -25]),
  // Continent only. The three ocean basins continue south of 60°S to this coast.
  landShape("antarctica", [15, -74]),
  oceanShape("arctic", [-40, 68]),
  oceanShape("atlantic", [-32, 22]),
  oceanShape("indian", [78, -18]),
  oceanShape("pacific", [-158, -18]),
];

const SHAPE_BY_ID = new Map(REGION_SHAPES.map((shape) => [shape.id, shape]));

export function wrapLng(lng: number): number {
  const wrapped = ((lng + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const crosses = yi > lat !== yj > lat;
    if (!crosses) continue;
    const xCross = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (lng < xCross) inside = !inside;
  }
  return inside;
}

export function regionIdAt(lng: number, lat: number): string | null {
  const x = wrapLng(lng);
  const y = Math.max(-85, Math.min(85, lat));
  for (const id of HIT_PRIORITY) {
    const shape = SHAPE_BY_ID.get(id);
    if (!shape) continue;
    if (shape.rings.some((item) => pointInRing(x, y, item))) return id;
  }
  return null;
}

/** True when the point is inside this one region's outline (ignores hit priority). */
export function pointInShape(id: string, lng: number, lat: number): boolean {
  const shape = SHAPE_BY_ID.get(id);
  if (!shape) return false;
  const x = wrapLng(lng);
  return shape.rings.some((item) => pointInRing(x, lat, item));
}

export function shapeById(id: string): RegionShape | undefined {
  return SHAPE_BY_ID.get(id);
}

export interface RegionFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: number;
    properties: {
      regionId: string;
      name: string;
      anomaly: number;
      lit: number;
    };
    geometry: RegionGeom;
  }>;
}

function closedRing(item: Ring): [number, number][] {
  const points: [number, number][] = item.map((point) => [point[0], point[1]]);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return points;
  if (first[0] !== last[0] || first[1] !== last[1]) points.push([first[0], first[1]]);
  return points;
}

function featureGeometry(shape: RegionShape): RegionGeom {
  if (shape.geometry) return shape.geometry;
  if (shape.rings.length === 1) {
    return { type: "Polygon", coordinates: [closedRing(shape.rings[0])] };
  }
  return { type: "MultiPolygon", coordinates: shape.rings.map((item) => [closedRing(item)]) };
}

export function regionFeatures(): RegionFeatureCollection {
  return {
    type: "FeatureCollection",
    features: REGION_SHAPES.map((shape) => {
      const region = MAP_REGIONS.find((item) => item.id === shape.id);
      return {
        type: "Feature",
        id: region?.index ?? 0,
        properties: {
          regionId: shape.id,
          name: region?.name ?? shape.id,
          anomaly: region?.anomaly ?? 0,
          lit: 1,
        },
        geometry: featureGeometry(shape),
      };
    }),
  };
}

export interface RegionOutlineCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: number;
    properties: { regionId: string };
    geometry: { type: "MultiLineString"; coordinates: [number, number][][] };
  }>;
}

const SEAM = 179.999;
/** Drop only a true polar closure (±90°). The Antarctic coast reaches about 85.6°S and must stay drawn. */
const POLE_EDGE = 89;

/**
 * Region outlines as lines, without the artificial edges where a shape is cut at the ±180° meridian or
 * closed near a pole, so a hover outline only traces coastlines and real basin limits.
 */
export function regionOutlineFeatures(): RegionOutlineCollection {
  const features = regionFeatures().features.map((feature) => {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const lines: [number, number][][] = [];
    for (const polygon of polygons) {
      for (const ringCoords of polygon) {
        let current: [number, number][] = [];
        for (let index = 0; index < ringCoords.length; index += 1) {
          const point: [number, number] = [ringCoords[index][0], ringCoords[index][1]];
          const previous = index > 0 ? ringCoords[index - 1] : null;
          const onSeam =
            previous &&
            ((Math.abs(previous[0]) >= SEAM && Math.abs(point[0]) >= SEAM) ||
              (Math.abs(previous[1]) >= POLE_EDGE && Math.abs(point[1]) >= POLE_EDGE));
          if (onSeam) {
            if (current.length > 1) lines.push(current);
            current = [point];
          } else {
            current.push(point);
          }
        }
        if (current.length > 1) lines.push(current);
      }
    }
    return {
      type: "Feature" as const,
      id: feature.id,
      properties: { regionId: feature.properties.regionId },
      geometry: { type: "MultiLineString" as const, coordinates: lines },
    };
  });
  return { type: "FeatureCollection", features };
}
