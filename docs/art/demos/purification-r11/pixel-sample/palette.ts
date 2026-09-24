import type { Material } from './raster';

/** Authored ramps: index is a paint tone, never inferred from RGB. */
export const PALETTE: Record<Material, readonly string[]> = {
  void: ['#0B1016', '#11141A', '#191E26', '#242932', '#303039', '#3D434B', '#4B555D', '#5F6A71'],
  concrete: ['#1A2026', '#303039', '#454D49', '#626961', '#747C6C', '#90937D', '#ABA58F', '#C2B99E'],
  chalk: ['#20242C', '#393D42', '#555C56', '#787D70', '#9C9E89', '#BBB69D', '#D1C6AC', '#E0D3B8'],
  steel: ['#11141A', '#222A31', '#354149', '#4C595B', '#697574', '#92988B', '#B3B5A3', '#D2CDB6'],
  paint: ['#17272B', '#253B3C', '#354E49', '#4E6F66', '#718C7A', '#96A58C', '#B7BEA0', '#CDD0AD'],
  rust: ['#291F25', '#3B2B2F', '#603E39', '#8A574A', '#A27158', '#B99370', '#C5AA87', '#D9C7A5'],
  glass: ['#111C23', '#1D3235', '#2D4544', '#435D54', '#62796A', '#859887', '#B6BFA6', '#DFD9BD'],
  light: ['#343737', '#555E58', '#7D8672', '#A3AA8A', '#C2C4A0', '#D8D3AB', '#E8DCB7', '#F3EACB'],
  alien: ['#15252B', '#233E43', '#345D61', '#527E80', '#77A5A0', '#9ABFB0', '#B9D4BD', '#D5E3CA'],
};

function colors(material: Material): readonly (readonly [number, number, number])[] {
  return PALETTE[material].map(hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const);
}

export const RGB: Record<Material, readonly (readonly [number, number, number])[]> = {
  void: colors('void'), concrete: colors('concrete'), chalk: colors('chalk'),
  steel: colors('steel'), paint: colors('paint'), rust: colors('rust'),
  glass: colors('glass'), light: colors('light'), alien: colors('alien'),
};

/** Four fixed light samples between authored paint tones; evaluated once, never RGB-additive. */
function lightColors(material: Material): readonly (readonly number[])[] {
  const ramp = RGB[material];
  return Array.from({ length: 29 }, (_, i) => {
    const a = ramp[Math.floor(i / 4)]!;
    const b = ramp[Math.min(7, Math.floor(i / 4) + 1)]!;
    const t = (i % 4) / 4;
    return a.map((channel, c) => Math.round(channel + (b[c]! - channel) * t));
  });
}

export const LIGHT_RGB: Record<Material, readonly (readonly number[])[]> = {
  void: lightColors('void'), concrete: lightColors('concrete'), chalk: lightColors('chalk'),
  steel: lightColors('steel'), paint: lightColors('paint'), rust: lightColors('rust'),
  glass: lightColors('glass'), light: lightColors('light'), alien: lightColors('alien'),
};
