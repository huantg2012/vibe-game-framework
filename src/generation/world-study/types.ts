/** Independent 2D map specimens. No production Rift state or game rules. */
export type WorldProfileId = 'ash-strata' | 'crystal-fibre' | 'ivory-basin';
export type WorldTopologyId = 'loops' | 'channels';
export type WorldMaterial = 'strata' | 'crystal' | 'glaze';

export interface WorldPalette {
  readonly void: number;
  readonly shadow: number;
  readonly floorDeep: number;
  readonly floor: number;
  readonly floorLight: number;
  readonly materialDark: number;
  readonly materialMid: number;
  readonly materialLight: number;
  readonly faceLight: number;
  readonly accentDim: number;
  readonly peak: number;
  readonly actorDark: number;
  readonly actorMid: number;
  readonly actorLight: number;
  /** Convenient rendering aliases derived from the same CSV role colors. */
  readonly ground: number;
  readonly groundLight: number;
  readonly groundDark: number;
  readonly wall: number;
  readonly wallLight: number;
  readonly wallDark: number;
  readonly accent: number;
  readonly accentLight: number;
}

export interface WorldProfile {
  readonly id: WorldProfileId;
  readonly label: string;
  readonly description: string;
  readonly material: WorldMaterial;
  readonly palette: WorldPalette;
}

export interface WorldFormation {
  readonly id: number;
  /** Actual connected obstacle cells, not decorative collision proxies. */
  readonly cells: readonly number[];
  readonly center: { readonly x: number; readonly y: number };
  readonly angle: number;
}

export interface WorldSample {
  readonly profile: WorldProfile;
  readonly topologyId: WorldTopologyId;
  readonly seed: number;
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  /** Row-major support membership, including obstacles. */
  readonly land: Uint8Array;
  readonly walls: Uint8Array;
  readonly spawn: { readonly x: number; readonly y: number };
  readonly exit: { readonly x: number; readonly y: number };
  readonly formations: readonly WorldFormation[];
  /** Shared spatial organization, independent from visual profile. */
  readonly flowAngle: Float32Array;
  readonly deposition: Float32Array;
}
