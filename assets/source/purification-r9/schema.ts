/** R9 native-pixel material and face contract; all coordinates use the 640×400 author canvas. */
export type Point = readonly [number, number];
export type Layer = 'far' | 'middle' | 'near' | 'architecture' | 'floor' | 'foreground';
export interface Plane {
  normal: readonly [number, number, number]; elevation: number;
  originX?: number; originY?: number; riseX?: number; riseY?: number;
  occlusion?: number; roughness?: number;
}
export interface Face { id: string; layer: Layer; color: string; points: readonly Point[]; plane: Plane | null }

/** DEC-180 material colours: painted mineral grey, lime plaster, oxidised binder.
 * Warm material is matte; it does not emit. Teal stays inside exterior contact seams. */
export const MATERIAL = {
  void: '#080b10', far: '#111922', farTop: '#19212c', farReturn: '#0d121a',
  distant: '#202b37', distantTop: '#303f4b', distantSide: '#141e29',
  outer: '#293440', outerTop: '#44515b', outerShade: '#1a2330',
  cavity: '#151b23', deep: '#10161d', underside: '#1c202b',
  concrete: '#454b50', concreteDark: '#303941', cap: '#4e575e', capWorn: '#60696d',
  slate: '#3d4b55', slateShade: '#303c47', slateWorn: '#4a585f',
  plaster: '#65605a', plasterShade: '#4e4a47', plasterWorn: '#80796b',
  binder: '#665347', binderShade: '#443a35', lime: '#a19482',
  floor: '#343d43', floorOld: '#3b4346', floorWear: '#434b4d', floorShade: '#293238',
  upper: '#424a4e', upperWear: '#4b5252', upperOld: '#4b4c48',
  steel: '#343b43', steelEdge: '#626d77', steelSide: '#252c35',
  intrusion: '#15473f', intrusionDim: '#12302f',
} as const;


export const top = (z: number, occlusion = .96): Plane => ({ normal: [0,0,1], elevation: z, occlusion, roughness: .96 });
export const front = (foot: number, z = 0, occlusion = .9): Plane => ({ normal: [0,1,0], elevation: z, originY: foot, riseY: -1, occlusion, roughness: .95 });
export const side = (foot: number, sign: number, z = 0, occlusion = .8): Plane => ({ normal: [sign,0,0], elevation: z, originY: foot, riseY: -1, occlusion, roughness: .96 });
