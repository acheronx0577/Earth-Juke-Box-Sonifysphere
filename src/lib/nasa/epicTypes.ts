/** Public EPIC shapes. No credentials and no server state. */

export interface EpicCentroid {
  readonly lat: number;
  readonly lon: number;
}

export interface EpicFrame {
  readonly id: string;
  readonly caption: string;
  readonly time: string;
  readonly centroid: EpicCentroid | null;
  readonly image: string;
}

export interface EpicFramesResult {
  readonly source: "NASA EPIC";
  readonly layer: "epic-natural";
  readonly date: string;
  readonly quality: "image-derived";
  readonly cached: boolean;
  readonly stale: boolean;
  readonly attribution: string;
  readonly license: string;
  readonly frames: readonly EpicFrame[];
}

export interface EpicDatesResult {
  readonly source: "NASA EPIC";
  readonly cached: boolean;
  readonly stale: boolean;
  readonly dates: readonly string[];
}

export interface EpicImageResult {
  readonly bytes: Uint8Array;
  readonly type: string;
  readonly cached: boolean;
  readonly stale: boolean;
}
