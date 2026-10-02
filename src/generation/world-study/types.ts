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
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Legacy CSV label; rendering uses the composable surface recipe below. */
  readonly material: WorldMaterial;
  readonly palette: WorldPalette;
  readonly surface: SurfaceRecipe;
}

/** Composable material operations; independent of world names and palettes. */
export interface SurfaceRecipe {
  readonly substrate: WorldMaterial;
  readonly coating: WorldMaterial;
  readonly coverage: number;
  readonly wear: number;
  readonly deposits: number;
  readonly scale: number;
  readonly relief: number;
  readonly contrast: number;
  /** Optional for older/anonymous recipes; shared defaults are resolved by the field. */
  readonly organization?: 'patches' | 'bands' | 'clusters';
  readonly regionScale?: number;
  readonly quietness?: number;
  readonly formScale?: number;
  readonly fragmentation?: number;
  readonly accentCoverage?: number;
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
  /** V2 visual stream; absent retains the original v1 material pixels. */
  readonly materialSeed?: number;
  /** Ground-plane relief only: no invisible new blockers or free emission. */
  readonly scenery?: readonly WorldScenery[];
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

export interface WorldScenery {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly radius: number;
  readonly seed: number;
  readonly kind: 'strata-fold' | 'crystal-fan' | 'glaze-basin';
  readonly density: number;
  readonly motion: { readonly kind: 'settle' | 'shear' | 'pulse'; readonly amplitude: number; readonly periodSeconds: number };
}
