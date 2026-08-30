/**
 * Production loot-search presentation (DEC-109).
 * Unified pile object + reveal particles. Progress lives on the HUD device bar.
 * Pile colour is a per-fragment wreckage-body lookup (DEC-110), not L1 quantize.
 */

import Phaser from 'phaser';
import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { PALETTE_HEX } from '@/generation/palette-quantize';
import type { ContaminantRarity, Vector2 } from '@/types/game-types';

export type SearchContentKind = 'kindling' | 'contaminant';

const NODE_DEPTH = 15;
const REVEAL_DEPTH = 17;
const VARIANT_COUNT = 3;
const PILE_W = 26;
const PILE_H = 18;
const REVEAL_POOL = 6;
const CHIP_POOL = 2;

const TEAL = 0x1aad96;
const TEAL_MID = 0x2ae6c8;
const TEAL_BRIGHT = 0x3cffd4;

const RARITY_TINT: Record<ContaminantRarity, number> = {
  common: 0x8a8f96,
  fine: TEAL,
  rare: TEAL_BRIGHT,
};

/** art-direction.md §2.2 name → hex. Membership asserted against palette.json. */
const ART_DIRECTION_HEX: Readonly<Record<string, string>> = {
  'shadow-grey': '#151a1e',
  'frag-library': '#2a2420',
  'frag-clinic': '#1e2228',
  'frag-metro': '#2a2018',
  'frag-residential': '#24221e',
  'frag-outdoor': '#1a1e18',
  'earth-dark': '#1a1c1f',
  'brick-dark': '#2a1f1c',
  'void-black': '#080a0c',
  'metal-grey': '#4a4e55',
  'metal-light': '#5a5f66',
  'debris-earth': '#50463c',
  'debris-rust': '#5d483e',
  'debris-wood': '#4f4835',
  'ui-text': '#8a8f96',
  'contam-core': '#1aad96',
  'contam-bright': '#3cffd4',
};

const PALETTE_HEX_SET: ReadonlySet<string> = new Set(PALETTE_HEX.map((h) => h.toLowerCase()));

/** Per-fragment wreckage body cell (DEC-110). Table-miss = spec gap; do not invent hex. */
const PILE_BODY_CELL: Readonly<Record<string, string>> = {
  'frag-outdoor': 'debris-earth',
  'frag-clinic': 'metal-grey',
  'frag-metro': 'debris-rust',
  'frag-library': 'debris-wood',
};

const TEX_CRYSTAL = '__loot_search_crystal';
const TEX_MOTE = '__loot_search_mote';
const TEX_CHIP = '__loot_search_chip';

export interface PileSlots {
  readonly shadow: number;
  readonly stain: number;
  readonly body: number;
  readonly highlight: number;
}

export interface SearchObjectVisual {
  readonly x: number;
  readonly y: number;
  setVisibility(vis: number): void;
  setRummaging(on: boolean): void;
  playReveal(args: {
    kind: SearchContentKind;
    rarity?: ContaminantRarity;
    playerPos: Readonly<Vector2>;
  }): void;
  update(deltaMs: number): void;
  destroy(): void;
}

export function pileTextureKey(fragmentTypeId: string, variant: number): string {
  return `__loot_search_pile_${fragmentTypeId}_${variant}`;
}

export function derivePileSlots(fragmentTypeId: string): PileSlots {
  const def = RIFT_FRAGMENT_DATA[fragmentTypeId];
  if (!def) {
    throw new Error(`loot-search: unknown fragment ${fragmentTypeId}`);
  }
  const bodyName = PILE_BODY_CELL[fragmentTypeId];
  if (!bodyName) {
    throw new Error(`loot-search: no debris body cell for ${fragmentTypeId}`);
  }
  const bodyHex = namedHex(bodyName);
  const stainNamed = namedHex(def.stainKey);
  const stainHex = stainNamed.toLowerCase() === bodyHex.toLowerCase()
    ? namedHex('earth-dark')
    : stainNamed;
  return {
    shadow: hexToPhaser(namedHex('void-black')),
    stain: hexToPhaser(stainHex),
    body: hexToPhaser(bodyHex),
    highlight: hexToPhaser(namedHex('metal-light')),
  };
}

export function ensureLootSearchTextures(scene: Phaser.Scene, fragmentTypeId: string): PileSlots {
  const slots = derivePileSlots(fragmentTypeId);
  for (let v = 0; v < VARIANT_COUNT; v++) {
    const key = pileTextureKey(fragmentTypeId, v);
    if (!scene.textures.exists(key)) bakePile(scene, key, fragmentTypeId, v, slots);
  }
  if (!scene.textures.exists(TEX_CRYSTAL)) bakeCrystal(scene);
  if (!scene.textures.exists(TEX_MOTE)) bakeMote(scene);
  if (!scene.textures.exists(TEX_CHIP)) bakeChip(scene);
  return slots;
}

export function createSearchObjectVisual(
  scene: Phaser.Scene,
  x: number,
  y: number,
  seed: number,
  fragmentTypeId: string,
  slots: PileSlots,
  getPlayerPos: () => Readonly<Vector2>,
): SearchObjectVisual {
  return new PileVisual(scene, x, y, seed, fragmentTypeId, slots, getPlayerPos);
}

function namedHex(name: string): string {
  const hex = ART_DIRECTION_HEX[name];
  if (!hex || !PALETTE_HEX_SET.has(hex.toLowerCase())) {
    throw new Error(`loot-search: ${name} is not a locked palette cell`);
  }
  return hex;
}

function hexToPhaser(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

class PileVisual implements SearchObjectVisual {
  readonly x: number;
  readonly y: number;
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly chips: Phaser.GameObjects.Image[];
  private readonly reveal: Phaser.GameObjects.Image[];
  private readonly getPlayerPos: () => Readonly<Vector2>;
  private readonly slots: PileSlots;
  private readonly idleMs: number;
  private readonly rummageMs: number;
  private readonly hz: number;
  private readonly phase: number;
  private vis = 1;
  private rummaging = false;
  private rummageClock = 0;
  private debrisAcc = 0;
  private chipIndex = 0;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    seed: number,
    fragmentTypeId: string,
    slots: PileSlots,
    getPlayerPos: () => Readonly<Vector2>,
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.slots = slots;
    this.getPlayerPos = getPlayerPos;
    const variant = seed % VARIANT_COUNT;
    this.idleMs = 3000 + (seed % 4001);
    this.rummageMs = 800 + ((seed >>> 8) % 701);
    this.hz = 8 + ((seed >>> 16) % 5);
    this.phase = ((seed >>> 4) % 1000) / 1000 * Math.PI * 2;

    this.sprite = scene.add.image(x, y, pileTextureKey(fragmentTypeId, variant));
    this.sprite.setDepth(NODE_DEPTH);
    this.sprite.setOrigin(0.5, 1);

    this.chips = [];
    for (let i = 0; i < CHIP_POOL; i++) {
      const img = scene.add.image(x, y, TEX_CHIP);
      img.setDepth(NODE_DEPTH + 1);
      img.setVisible(false);
      img.setActive(false);
      this.chips.push(img);
    }
    this.reveal = [];
    for (let i = 0; i < REVEAL_POOL; i++) {
      const img = scene.add.image(x, y, TEX_CRYSTAL);
      img.setDepth(REVEAL_DEPTH);
      img.setVisible(false);
      img.setActive(false);
      this.reveal.push(img);
    }
  }

  setVisibility(vis: number): void {
    this.vis = vis;
    if (this.sprite.visible) this.sprite.setAlpha(vis);
  }

  setRummaging(on: boolean): void {
    if (!on && this.rummaging) {
      this.sprite.setPosition(this.x, this.y);
      this.rummageClock = 0;
    }
    this.rummaging = on;
  }

  update(deltaMs: number): void {
    if (this.destroyed || !this.sprite.visible) return;
    const vis = this.vis;
    this.sprite.setAlpha(vis);
    if (this.rummaging) {
      this.rummageClock += deltaMs;
      const t = this.rummageClock * 0.001;
      const wobble =
        Math.sin(t * this.hz * Math.PI * 2 + this.phase) * 0.65
        + Math.sin(t * (this.hz * 1.37) + this.phase * 1.7) * 0.35;
      this.sprite.setX(this.x + wobble);
    }
    this.debrisAcc += deltaMs;
    const interval = this.rummaging ? this.rummageMs : this.idleMs;
    if (this.debrisAcc >= interval) {
      this.debrisAcc = 0;
      this.spawnDebris();
    }
  }

  playReveal(args: {
    kind: SearchContentKind;
    rarity?: ContaminantRarity;
    playerPos: Readonly<Vector2>;
  }): void {
    this.sprite.setVisible(false);
    this.rummaging = false;
    const bits = this.reveal;
    for (let i = 0; i < 4; i++) {
      const img = bits[i];
      if (!img) break;
      img.setTexture(TEX_CHIP);
      img.setTint(this.slots.body);
      img.setPosition(this.x, this.y - 6);
      img.setVisible(true);
      img.setActive(true);
      img.setAlpha(this.vis);
      img.setScale(1);
      const ang = (i / 4) * Math.PI * 2 - Math.PI / 2;
      this.scene.tweens.add({
        targets: img,
        x: this.x + Math.cos(ang) * 14,
        y: this.y + Math.sin(ang) * 10,
        alpha: 0,
        duration: 280,
        onComplete: () => {
          img.setVisible(false);
          img.setActive(false);
        },
      });
    }
    this.launchContent(args.kind, args.rarity, bits[4], bits[5]);
    void args.playerPos;
  }

  destroy(): void {
    this.destroyed = true;
    this.sprite.destroy();
    for (const img of this.chips) img.destroy();
    for (const img of this.reveal) img.destroy();
    this.chips.length = 0;
    this.reveal.length = 0;
  }

  private spawnDebris(): void {
    const img = this.chips[this.chipIndex % this.chips.length];
    if (!img) return;
    this.chipIndex += 1;
    const fall = 2 + (this.chipIndex & 1) * 2;
    img.setTint(this.slots.stain);
    img.setPosition(this.x + ((this.chipIndex & 2) === 0 ? -3 : 3), this.y - 12);
    img.setVisible(true);
    img.setActive(true);
    img.setAlpha(this.vis);
    this.scene.tweens.killTweensOf(img);
    this.scene.tweens.add({
      targets: img,
      y: this.y - 12 + fall,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        img.setVisible(false);
        img.setActive(false);
      },
    });
  }

  private launchContent(
    kind: SearchContentKind,
    rarity: ContaminantRarity | undefined,
    a?: Phaser.GameObjects.Image,
    b?: Phaser.GameObjects.Image,
  ): void {
    const lead = a;
    if (!lead) return;
    lead.setTexture(kind === 'kindling' ? TEX_CRYSTAL : TEX_MOTE);
    if (kind === 'contaminant') lead.setTint(rarityTint(rarity));
    else lead.clearTint();
    lead.setPosition(this.x, this.y - 8);
    lead.setVisible(true);
    lead.setActive(true);
    lead.setAlpha(this.vis);
    lead.setScale(kind === 'kindling' ? 1.15 : 1);
    const dest = this.getPlayerPos();
    this.scene.tweens.add({
      targets: lead,
      x: dest.x,
      y: dest.y,
      alpha: 0.15,
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        lead.setVisible(false);
        lead.setActive(false);
      },
    });
    if (b && kind === 'kindling') {
      b.setTexture(TEX_CRYSTAL);
      b.clearTint();
      b.setPosition(this.x, this.y - 10);
      b.setVisible(true);
      b.setActive(true);
      b.setAlpha(this.vis);
      this.scene.tweens.add({
        targets: b,
        y: this.y - 20,
        alpha: 0,
        duration: 280,
        onComplete: () => {
          b.setVisible(false);
          b.setActive(false);
        },
      });
    }
  }
}

function rarityTint(rarity: ContaminantRarity | undefined): number {
  return rarity ? RARITY_TINT[rarity] : TEAL;
}

function bakePile(
  scene: Phaser.Scene,
  key: string,
  fragmentTypeId: string,
  variant: number,
  slots: PileSlots,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const rnd = mulberry((hashStr(fragmentTypeId) ^ (variant + 1) * 0x9e3779b9) >>> 0);
  g.fillStyle(slots.shadow, 1);
  g.fillEllipse(13, 16, 18, 5);
  paintLanguage(g, fragmentTypeId, rnd, slots);
  paintScratches(g, fragmentTypeId, rnd, slots.stain);
  g.generateTexture(key, PILE_W, PILE_H);
  g.destroy();
}

function paintLanguage(
  g: Phaser.GameObjects.Graphics,
  fragmentTypeId: string,
  rnd: () => number,
  slots: PileSlots,
): void {
  if (fragmentTypeId === 'frag-clinic') paintClinic(g, rnd, slots);
  else if (fragmentTypeId === 'frag-metro') paintMetro(g, rnd, slots);
  else if (fragmentTypeId === 'frag-library') paintLibrary(g, rnd, slots);
  else paintOutdoor(g, rnd, slots);
}

function paintOutdoor(
  g: Phaser.GameObjects.Graphics,
  rnd: () => number,
  slots: PileSlots,
): void {
  const blobs = [
    { x: 8 + rnd() * 2, y: 12 + rnd(), r: 4.2 },
    { x: 14 + rnd() * 2, y: 10 + rnd(), r: 5.1 },
    { x: 18 + rnd(), y: 13 + rnd() * 0.8, r: 3.4 },
  ];
  for (const b of blobs) {
    g.fillStyle(slots.body, 1);
    g.fillCircle(b.x, b.y, b.r);
    g.fillStyle(slots.stain, 1);
    g.fillCircle(b.x - 1, b.y + 1, Math.max(1, b.r * 0.35));
    g.fillStyle(slots.highlight, 1);
    g.fillRect(Math.round(b.x - 1), Math.round(b.y - b.r + 1), 2, 1);
  }
  g.fillStyle(slots.body, 1);
  g.fillCircle(11 + rnd(), 14, 2);
  g.fillCircle(16 + rnd(), 15, 1.6);
}

function paintClinic(
  g: Phaser.GameObjects.Graphics,
  rnd: () => number,
  slots: PileSlots,
): void {
  const tiles = [
    { x: 5 + Math.floor(rnd() * 2), y: 8, w: 10, h: 4 },
    { x: 9 + Math.floor(rnd() * 2), y: 10, w: 9, h: 4 },
    { x: 7 + Math.floor(rnd() * 2), y: 12, w: 11, h: 3 },
  ];
  for (const t of tiles) {
    g.fillStyle(slots.body, 1);
    g.fillRect(t.x, t.y, t.w, t.h);
    g.fillStyle(slots.stain, 1);
    g.fillRect(t.x + 1, t.y + t.h - 1, t.w - 2, 1);
    g.fillStyle(slots.highlight, 1);
    g.fillRect(t.x, t.y, t.w, 1);
    g.fillStyle(slots.shadow, 1);
    g.fillRect(t.x + t.w - 2, t.y + 1, 2, t.h - 1);
  }
}

function paintMetro(
  g: Phaser.GameObjects.Graphics,
  rnd: () => number,
  slots: PileSlots,
): void {
  const lean = rnd() < 0.5 ? 1 : -1;
  g.fillStyle(slots.body, 1);
  g.fillPoints(
    [
      { x: 4, y: 14 },
      { x: 20, y: 11 + lean },
      { x: 21, y: 13 + lean },
      { x: 5, y: 16 },
    ],
    true,
  );
  g.fillPoints(
    [
      { x: 8, y: 10 },
      { x: 18, y: 7 },
      { x: 19, y: 9 },
      { x: 9, y: 12 },
    ],
    true,
  );
  g.fillStyle(slots.stain, 1);
  g.fillRect(10, 12, 6, 1);
  g.fillStyle(slots.highlight, 1);
  g.fillRect(8, 7, 10, 1);
  g.fillRect(4, 14, 8, 1);
}

function paintLibrary(
  g: Phaser.GameObjects.Graphics,
  rnd: () => number,
  slots: PileSlots,
): void {
  const shift = Math.floor(rnd() * 2);
  g.fillStyle(slots.body, 1);
  g.fillRect(7 + shift, 6, 3, 10);
  g.fillRect(12, 8, 3, 8);
  g.fillRect(16 - shift, 7, 2, 9);
  g.fillStyle(slots.stain, 1);
  g.fillRect(8 + shift, 11, 1, 4);
  g.fillRect(13, 12, 1, 3);
  g.fillStyle(slots.highlight, 1);
  g.fillRect(7 + shift, 6, 3, 1);
  g.fillRect(12, 8, 3, 1);
  g.fillRect(16 - shift, 7, 2, 1);
  g.fillStyle(slots.body, 1);
  g.fillRect(8 + shift, 5, 1, 1);
  g.fillRect(10 + shift, 5, 1, 1);
  g.fillRect(16 - shift, 6, 1, 1);
}

function paintScratches(
  g: Phaser.GameObjects.Graphics,
  fragmentTypeId: string,
  rnd: () => number,
  stain: number,
): void {
  g.fillStyle(stain, 1);
  const count = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const x = 6 + Math.floor(rnd() * 14);
    const y = 8 + Math.floor(rnd() * 7);
    if (fragmentTypeId === 'frag-clinic') {
      if (rnd() < 0.5) g.fillRect(x, y, 3, 1);
      else g.fillRect(x, y, 1, 3);
    } else if (fragmentTypeId === 'frag-metro' || fragmentTypeId === 'frag-library') {
      const len = 3 + Math.floor(rnd() * 3);
      g.fillRect(x, y, len, 1);
    } else {
      g.fillRect(x, y, 1 + Math.floor(rnd() * 2), 1);
    }
  }
}

function hashStr(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function bakeCrystal(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(TEAL, 1);
  g.fillPoints([{ x: 4, y: 1 }, { x: 7, y: 3 }, { x: 4, y: 8 }, { x: 1, y: 3 }], true);
  g.fillStyle(TEAL_MID, 1);
  g.fillPoints([{ x: 4, y: 2 }, { x: 6, y: 3 }, { x: 4, y: 5 }], true);
  g.generateTexture(TEX_CRYSTAL, 8, 8);
  g.destroy();
}

function bakeMote(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(TEAL, 1);
  g.fillCircle(4, 4, 3);
  g.fillStyle(0x0e4a3f, 1);
  g.fillCircle(4, 4, 1);
  g.generateTexture(TEX_MOTE, 8, 8);
  g.destroy();
}

function bakeChip(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 2, 2);
  g.generateTexture(TEX_CHIP, 2, 2);
  g.destroy();
}
