/**
 * 24 baked stamp textures. Identity is which of these is shown, not a density knob.
 */

import Phaser from 'phaser';
import { INK, rgbFromHex } from '@/gym/form-renderers/c/palette';

export const STAMP_KEY = {
  occFloor: 'gym-c-occ-floor',
  occWall: 'gym-c-occ-wall',
  occPaint: 'gym-c-occ-paint',
  occVolume: 'gym-c-occ-volume',
  subOrganic: 'gym-c-sub-organic',
  subLamp: 'gym-c-sub-lamp',
  subDoor: 'gym-c-sub-door',
  subRust: 'gym-c-sub-rust',
  subFungal: 'gym-c-sub-fungal',
  subOil: 'gym-c-sub-oil',
  veilThin: 'gym-c-veil-thin',
  veilHalf: 'gym-c-veil-half',
  veilThick: 'gym-c-veil-thick',
  contSat: 'gym-c-cont-sat',
  senseSeam: 'gym-c-sense-seam',
  senseCavity: 'gym-c-sense-cavity',
  senseTouch: 'gym-c-sense-touch',
  contactDust: 'gym-c-contact-dust',
  contactStain: 'gym-c-contact-stain',
  contactStrike: 'gym-c-contact-strike',
  uttOpen: 'gym-c-utt-open',
  uttSeam: 'gym-c-utt-seam',
  uttBreath: 'gym-c-utt-breath',
  uttWatch: 'gym-c-utt-watch',
} as const;

export type StampKey = (typeof STAMP_KEY)[keyof typeof STAMP_KEY];

type Cmd =
  | readonly ['p', number, number, string]
  | readonly ['r', number, number, number, number, string];

interface StampDef {
  readonly key: StampKey;
  readonly w: number;
  readonly h: number;
  readonly cmds: readonly Cmd[];
}

class Sheet {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  p(x: number, y: number, hex: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = rgbFromHex(hex);
    const i = (y * this.w + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = 255;
  }

  fill(x: number, y: number, w: number, h: number, hex: string): void {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) this.p(x + xx, y + yy, hex);
    }
  }

  run(cmds: readonly Cmd[]): void {
    for (const cmd of cmds) {
      if (cmd[0] === 'p') this.p(cmd[1], cmd[2], cmd[3]);
      else this.fill(cmd[1], cmd[2], cmd[3], cmd[4], cmd[5]);
    }
  }
}

const STAMPS: readonly StampDef[] = [
  {
    key: STAMP_KEY.occFloor,
    w: 16,
    h: 16,
    cmds: [
      ['r', 6, 1, 4, 3, INK.flesh],
      ['r', 3, 4, 10, 10, INK.cloth],
      ['r', 4, 5, 8, 8, INK.flesh],
      ['p', 3, 4, INK.bone],
      ['p', 12, 6, INK.bone],
      ['p', 5, 13, INK.ambient],
    ],
  },
  {
    key: STAMP_KEY.occWall,
    w: 8,
    h: 24,
    cmds: [
      ['r', 2, 0, 3, 24, INK.shadow],
      ['r', 3, 1, 1, 22, INK.concrete],
      ['r', 3, 10, 2, 2, INK.glow],
      ['p', 2, 5, INK.brick],
      ['p', 4, 18, INK.brick],
    ],
  },
  {
    key: STAMP_KEY.occPaint,
    w: 20,
    h: 16,
    cmds: [
      ['r', 4, 4, 12, 8, INK.earth],
      ['r', 2, 6, 4, 4, INK.deep],
      ['r', 14, 5, 5, 6, INK.deep],
      ['r', 7, 2, 6, 3, INK.earth],
      ['r', 9, 7, 2, 2, INK.glow],
    ],
  },
  {
    key: STAMP_KEY.occVolume,
    w: 32,
    h: 16,
    cmds: [
      ['r', 0, 4, 32, 8, INK.shadow],
      ['r', 0, 6, 32, 4, INK.ambient],
      ['r', 8, 5, 16, 6, INK.deep],
      ['p', 0, 7, INK.shadow],
      ['p', 31, 7, INK.shadow],
    ],
  },
  {
    key: STAMP_KEY.subOrganic,
    w: 16,
    h: 16,
    cmds: [
      ['r', 4, 3, 7, 5, INK.flesh],
      ['r', 2, 7, 6, 5, INK.cloth],
      ['r', 8, 8, 5, 4, INK.bone],
      ['p', 10, 4, INK.bone],
    ],
  },
  {
    key: STAMP_KEY.subLamp,
    w: 16,
    h: 16,
    cmds: [
      ['r', 7, 3, 2, 11, INK.metal],
      ['r', 6, 2, 4, 2, INK.metalMid],
      ['p', 7, 1, INK.core],
      ['p', 8, 1, INK.core],
      ['p', 7, 0, INK.glow],
    ],
  },
  {
    key: STAMP_KEY.subDoor,
    w: 16,
    h: 16,
    cmds: [
      ['r', 3, 2, 2, 12, INK.metalMid],
      ['r', 11, 2, 2, 12, INK.metalMid],
      ['r', 3, 2, 10, 2, INK.metal],
      ['r', 5, 4, 6, 1, INK.concrete],
    ],
  },
  {
    key: STAMP_KEY.subRust,
    w: 16,
    h: 16,
    cmds: [
      ['p', 2, 3, INK.brick],
      ['p', 3, 4, INK.shadow],
      ['p', 5, 2, INK.brick],
      ['p', 8, 5, INK.brick],
      ['p', 9, 6, INK.concrete],
      ['p', 11, 3, INK.brick],
      ['p', 4, 8, INK.shadow],
      ['p', 6, 10, INK.brick],
      ['p', 12, 9, INK.brick],
      ['p', 7, 12, INK.shadow],
      ['p', 13, 13, INK.brick],
      ['p', 1, 11, INK.concrete],
    ],
  },
  {
    key: STAMP_KEY.subFungal,
    w: 16,
    h: 16,
    cmds: [
      ['r', 2, 2, 2, 2, INK.deep],
      ['r', 7, 2, 2, 2, INK.mid],
      ['r', 12, 3, 2, 2, INK.deep],
      ['r', 3, 7, 2, 2, INK.mid],
      ['r', 8, 8, 2, 2, INK.deep],
      ['r', 12, 8, 2, 2, INK.mid],
      ['r', 2, 12, 2, 2, INK.deep],
      ['r', 7, 12, 2, 2, INK.deep],
      ['r', 11, 12, 2, 2, INK.mid],
    ],
  },
  {
    key: STAMP_KEY.subOil,
    w: 16,
    h: 16,
    cmds: [
      ['r', 1, 4, 14, 1, INK.mid],
      ['r', 2, 7, 12, 1, INK.deep],
      ['r', 0, 10, 15, 1, INK.mid],
      ['p', 4, 5, INK.core],
      ['p', 11, 8, INK.core],
    ],
  },
  {
    key: STAMP_KEY.veilThin,
    w: 16,
    h: 16,
    cmds: [
      ['p', 2, 3, INK.core],
      ['p', 8, 2, INK.mid],
      ['p', 13, 5, INK.core],
      ['p', 4, 8, INK.deep],
      ['p', 10, 9, INK.core],
      ['p', 6, 12, INK.mid],
      ['p', 14, 13, INK.core],
      ['p', 1, 14, INK.deep],
    ],
  },
  {
    key: STAMP_KEY.veilHalf,
    w: 16,
    h: 16,
    cmds: [
      ['r', 0, 0, 8, 16, INK.deep],
      ['r', 1, 1, 6, 14, INK.mid],
      ['p', 2, 3, INK.core],
      ['p', 5, 7, INK.glow],
      ['p', 3, 11, INK.core],
      ['p', 7, 4, INK.core],
      ['p', 9, 8, INK.core],
      ['p', 12, 12, INK.mid],
    ],
  },
  {
    key: STAMP_KEY.veilThick,
    w: 16,
    h: 16,
    cmds: [
      ['r', 1, 1, 14, 14, INK.deep],
      ['r', 3, 3, 10, 10, INK.mid],
      ['r', 6, 6, 4, 4, INK.core],
      ['r', 7, 7, 2, 2, INK.bright],
    ],
  },
  {
    key: STAMP_KEY.contSat,
    w: 6,
    h: 6,
    cmds: [
      ['r', 1, 1, 4, 4, INK.deep],
      ['r', 2, 2, 2, 2, INK.glow],
    ],
  },
  {
    key: STAMP_KEY.senseSeam,
    w: 3,
    h: 12,
    cmds: [
      ['r', 1, 0, 1, 12, INK.glow],
      ['p', 1, 5, INK.bright],
    ],
  },
  {
    key: STAMP_KEY.senseCavity,
    w: 8,
    h: 8,
    cmds: [
      ['r', 1, 1, 6, 6, INK.void],
      ['r', 2, 2, 4, 4, INK.ambient],
      ['p', 3, 3, INK.core],
    ],
  },
  {
    key: STAMP_KEY.senseTouch,
    w: 8,
    h: 8,
    cmds: [
      ['r', 1, 5, 6, 1, INK.earth],
      ['r', 3, 3, 2, 2, INK.glow],
    ],
  },
  {
    key: STAMP_KEY.contactDust,
    w: 8,
    h: 8,
    cmds: [
      ['p', 1, 2, INK.mid],
      ['p', 4, 1, INK.core],
      ['p', 6, 4, INK.deep],
      ['p', 2, 6, INK.mid],
    ],
  },
  {
    key: STAMP_KEY.contactStain,
    w: 12,
    h: 6,
    cmds: [
      ['r', 1, 1, 10, 3, INK.deep],
      ['r', 3, 2, 6, 2, INK.mid],
    ],
  },
  {
    key: STAMP_KEY.contactStrike,
    w: 5,
    h: 5,
    cmds: [
      ['r', 2, 0, 1, 5, INK.core],
      ['r', 0, 2, 5, 1, INK.core],
      ['p', 2, 2, INK.bright],
    ],
  },
  {
    key: STAMP_KEY.uttOpen,
    w: 10,
    h: 10,
    cmds: [
      ['r', 1, 1, 1, 8, INK.metal],
      ['r', 8, 1, 1, 8, INK.metal],
      ['r', 1, 1, 3, 1, INK.metalMid],
      ['r', 6, 1, 3, 1, INK.metalMid],
      ['p', 4, 5, INK.glow],
    ],
  },
  {
    key: STAMP_KEY.uttSeam,
    w: 3,
    h: 14,
    cmds: [
      ['r', 1, 0, 1, 14, INK.bright],
      ['p', 1, 6, INK.glow],
    ],
  },
  {
    key: STAMP_KEY.uttBreath,
    w: 10,
    h: 10,
    cmds: [
      ['r', 1, 1, 8, 1, INK.core],
      ['r', 1, 8, 8, 1, INK.core],
      ['r', 1, 1, 1, 8, INK.core],
      ['r', 8, 1, 1, 8, INK.core],
      ['p', 4, 4, INK.glow],
    ],
  },
  {
    key: STAMP_KEY.uttWatch,
    w: 10,
    h: 10,
    cmds: [
      ['p', 4, 1, INK.bright],
      ['p', 3, 2, INK.glow],
      ['p', 5, 2, INK.glow],
      ['p', 2, 3, INK.core],
      ['p', 6, 3, INK.core],
      ['p', 4, 4, INK.core],
    ],
  },
];

function upload(scene: Phaser.Scene, def: StampDef): void {
  const sheet = new Sheet(def.w, def.h);
  sheet.run(def.cmds);
  if (scene.textures.exists(def.key)) scene.textures.remove(def.key);
  const tex = scene.textures.createCanvas(def.key, def.w, def.h);
  if (!tex) return;
  const ctx = tex.getContext();
  const image = ctx.createImageData(def.w, def.h);
  image.data.set(sheet.data);
  ctx.putImageData(image, 0, 0);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  tex.refresh();
}

export function ensureCStamps(scene: Phaser.Scene): void {
  if (scene.textures.exists(STAMP_KEY.occFloor)) return;
  for (const def of STAMPS) upload(scene, def);
}
