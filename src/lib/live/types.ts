/** Shared shapes for place-based live readings (server routes + Listen UI). */

export interface LivePlace {
  readonly kind: "region" | "area";
  readonly regionId?: string;
  readonly name: string;
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface WindStats {
  /** Scalar mean speed S̄ (m/s), cos(lat)-weighted. */
  readonly meanSpeed: number;
  /** Vector mean speed V = |(ū, v̄)| (m/s). */
  readonly vectorSpeed: number;
  /** Circular-mean direction the wind blows FROM, degrees (meteorological). */
  readonly directionFrom: number;
  /** Steadiness R = V / S̄ (0 = swirling, 1 = uniform). */
  readonly steadiness: number;
  /** Gustiness proxy: weighted std of speed / S̄ across the box's cells (spatial variability). */
  readonly gustiness: number;
  readonly maxSpeed: number;
  readonly validUtc: string;
  readonly sourceKind: string;
}
