/** Stage-only pigment relationships. Vista is frozen at the R4 checkpoint.
 * These are material/light art constants, not gameplay or content definitions. */
export const STAGE_PALETTE = {
  absence: 0x080a10,
  sea: [0x080e19, 0x101d2c, 0x172f3e, 0x234554, 0x365d69, 0x537980, 0x91aca6],
  ground: [0x34343b, 0x45444a, 0x58534f, 0x6a6053, 0x817565],
  section: 0x403e42,
  sediment: 0x786d60,
  reef: 0x777b7e,
  sky: 0xa0abba,
  bounce: 0x342d38,
  key: 0xc2c8d0,
  rim: 0x746c76,
  marker: 0x716b65,
  glass: 0xc9b88f,
} as const;

export function pigmentGlsl(hex: number): string {
  return `vec3(${hex >>> 16},${(hex >>> 8) & 255},${hex & 255})/255.`;
}
