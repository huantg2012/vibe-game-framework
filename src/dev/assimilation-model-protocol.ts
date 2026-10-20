/** DEV author-model worker contract. Coordinates are Y-up author metres.
 * A response is one complete frame; consumers must replace pixels and metadata
 * atomically, and discard stale request IDs. No gameplay/save data is accepted. */
export type AssimilationModelPoint = readonly [number, number, number];
export interface AssimilationModelRequest {
  readonly id: number;
  readonly amount: number;
  readonly fibre: number;
  /** Original gait phase in radians; null selects standing/breathing. */
  readonly phase: number | null;
  /** Stop recovery of the original gait: 0=walking, 1=fully settled. */
  readonly settle?: number;
  readonly yaw: number;
  readonly breath: number;
}
export interface AssimilationModelSocket {
  readonly world: AssimilationModelPoint;
  readonly screen: readonly [number, number];
}
export interface AssimilationModelMeta {
  readonly yaw: number;
  readonly phase: number | null;
  readonly settle?: number;
  readonly breath: number;
  readonly amount: number;
  readonly fibre: number;
  readonly anchor: readonly [32, 66];
  readonly lamp: AssimilationModelPoint;
  readonly wrist: AssimilationModelSocket;
  readonly shoulder: AssimilationModelSocket;
  /** [ax, ay, az, bx, by, bz, radius], yaw already applied. */
  readonly shadowCapsules: readonly (readonly number[])[];
}
export interface AssimilationModelFrame {
  readonly id: number;
  readonly width: 64;
  readonly height: 80;
  readonly albedo: Uint8Array;
  readonly normal: Uint8Array;
  /** Roughness, specular, AO, emission / 2. Alpha is not coverage. */
  readonly material: Uint8Array;
  /** RG big-endian uint16: depth = value / 256 - 80. B=4, A=coverage. */
  readonly depth: Uint8Array;
  readonly meta: AssimilationModelMeta;
  readonly buildMs: number;
  readonly bakeMs: number;
  readonly triangles: number;
}
export interface AssimilationModelError {
  readonly id: number;
  readonly error: string;
}
export type AssimilationModelResponse = AssimilationModelFrame | AssimilationModelError;
