import type { Material } from './raster';

/** Authored ramps: index is a paint tone, never inferred from RGB. */
export const PALETTE: Record<Material, readonly string[]> = {
  void: ['#0B1016', '#11141A', '#191E26', '#242932', '#303039', '#3D434B', '#4B555D', '#5F6A71'],
  concrete: ['#191C25', '#302E37', '#4A4549', '#686162', '#81796F', '#9A9082', '#B7AA94', '#D6C7AB'],
  chalk: ['#24232B', '#3D3A40', '#595358', '#7C7573', '#9F9589', '#BDB09B', '#D4C4A8', '#E5D3B6'],
  steel: ['#11141D', '#232A38', '#374454', '#526574', '#81929F', '#ACB8BE', '#D0D2CE', '#E8DFCA'],
  paint: ['#1A1E2B', '#2A3345', '#404B5E', '#596779', '#7B8693', '#A0A7AE', '#C0C1BD', '#D9D6C8'],
  rust: ['#291F25', '#3B2B2F', '#603E39', '#8A574A', '#A27158', '#B99370', '#C5AA87', '#D9C7A5'],
  glass: ['#111C27', '#20303F', '#344756', '#4E6371', '#718897', '#98ACB5', '#C3CED0', '#E1E1D4'],
  light: ['#393036', '#605153', '#8A766A', '#AD9981', '#CAB99C', '#E0CFAC', '#EEE0BE', '#FFF5D8'],
  alien: ['#0B1F20', '#123B30', '#185B3C', '#228A4D', '#40B966', '#72E091', '#AEF2B7', '#E1FFD6'],
};

function colors(material: Material): readonly (readonly [number, number, number])[] {
  return PALETTE[material].map(hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const);
}

export const RGB: Record<Material, readonly (readonly [number, number, number])[]> = {
  void: colors('void'), concrete: colors('concrete'), chalk: colors('chalk'),
  steel: colors('steel'), paint: colors('paint'), rust: colors('rust'),
  glass: colors('glass'), light: colors('light'), alien: colors('alien'),
};

/** Material ramps remain authored; fine light sampling prevents contour bands on a flat floor. */
export const LIGHT_STEPS = 64;
function lightColors(material: Material): readonly (readonly number[])[] {
  const ramp = RGB[material];
  return Array.from({ length: 7 * LIGHT_STEPS + 1 }, (_, i) => {
    const a = ramp[Math.floor(i / LIGHT_STEPS)]!;
    const b = ramp[Math.min(7, Math.floor(i / LIGHT_STEPS) + 1)]!;
    const t = (i % LIGHT_STEPS) / LIGHT_STEPS;
    return a.map((channel, c) => Math.round(channel + (b[c]! - channel) * t));
  });
}

export const LIGHT_RGB: Record<Material, readonly (readonly number[])[]> = {
  void: lightColors('void'), concrete: lightColors('concrete'), chalk: lightColors('chalk'),
  steel: lightColors('steel'), paint: lightColors('paint'), rust: lightColors('rust'),
  glass: lightColors('glass'), light: lightColors('light'), alien: lightColors('alien'),
};

// Green is a source signature, not an ordinary construction pigment. Reflections use a
// separate bounded ramp and are spatially restricted to the containment cavity and its foot.
export const POLLUTION_STEPS = 16;
function pollutionColors(material: Material): readonly (readonly (readonly number[])[])[] {
  return Array.from({ length: POLLUTION_STEPS + 1 }, (_, step) => LIGHT_RGB[material].map(rgb => {
    const amount = step / POLLUTION_STEPS;
    return [
      Math.round(rgb[0]! * (1 - amount * .54)),
      Math.round(rgb[1]! + (255 - rgb[1]!) * amount * .29),
      Math.round(rgb[2]! * (1 - amount * .24)),
    ];
  }));
}

export const POLLUTION_RGB: Record<Material, readonly (readonly (readonly number[])[])[]> = {
  void: pollutionColors('void'), concrete: pollutionColors('concrete'), chalk: pollutionColors('chalk'),
  steel: pollutionColors('steel'), paint: pollutionColors('paint'), rust: pollutionColors('rust'),
  glass: pollutionColors('glass'), light: pollutionColors('light'), alien: pollutionColors('alien'),
};
