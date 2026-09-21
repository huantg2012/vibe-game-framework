/**
 * PurificationModule entity - visual representation of a module in the purification scene.
 *
 * CORE = 32×40 v6 贴图（默认 B 仪式；`?core=a|b|c` 与键 1/2/3 可切对照）。
 * PURIFIER = B1 横卧过滤罐 8 帧图集（观察窗介质翻滚）。
 * STORAGE = C1 顶压观察井 8 帧图集（DEC-112）；贴图缺失回落橙色方块。
 * HP bar lives in the world; all readable copy lives in DOM overlays.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { ModuleType } from '@/managers/game-state';
import { gameState } from '@/managers/game-state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModuleEntityConfig {
  readonly id: string;
  readonly type: ModuleType;
  readonly x: number;
  readonly y: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTERACTION_RADIUS = GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;

// Module colours
const CORE_MAIN = 0x4488cc;
const CORE_EDGE = 0x6699dd;
const STORAGE_MAIN = 0xcc8844;
const STORAGE_EDGE = 0xddaa66;
const DANGER_COLOR = 0xcc3333;

const PURIFIER_FILL_OUTER = 0x1a6b5c; // contam-mid
const PURIFIER_FILL_INNER = 0x0e4a3f; // contam-deep
const PURIFIER_EDGE_OUTER = 0x1aad96; // contam-core
const PURIFIER_EDGE_INNER = 0x4a4e55; // metal-grey
const PURIFIER_LAMP = 0x1aad96;
const PURIFIER_BAR_SLOT = 0x0e4a3f;

const CORE_RADIUS = 16;
const STORAGE_HALF = 14; // half-side = 14 => 28px side
const PURIFIER_RADIUS = 18;

// ---------------------------------------------------------------------------
// 核心贴图（抽卡 v6：a=敬畏 b=仪式 c=封印）
// 32x40 像素，真等距投影（旋转45° + y压缩0.55）。接地点约在贴图 y=34/40，
// 故 originY 下移，让物体立在模块坐标上而不是浮空。
// ---------------------------------------------------------------------------

export const CORE_SPRITE_VARIANTS = ['a', 'b', 'c'] as const;
export type CoreSpriteVariant = (typeof CORE_SPRITE_VARIANTS)[number];
export const CORE_SPRITE_ORIGIN_Y = 34 / 40;
export const CORE_SPRITE_HEIGHT = 40;
/** 贴图模式下物体底部相对模块坐标的偏移：40 * (1 - 0.85) = 6 */
export const CORE_SPRITE_BOTTOM_OFFSET = CORE_SPRITE_HEIGHT * (1 - CORE_SPRITE_ORIGIN_Y);

export function coreSpriteKey(v: CoreSpriteVariant): string {
  return `module-core-v6-${v}`;
}

export function coreSpriteUrl(v: CoreSpriteVariant): string {
  return `assets/sprites/modules/core-v6-${v}.png`;
}

/** URL ?core=a|b|c 选方案便于实测；缺省为 'b'（B 仪式，人已选定为基础方案）。 */
export function resolveCoreVariant(): CoreSpriteVariant {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('core');
    if (q && (CORE_SPRITE_VARIANTS as readonly string[]).includes(q)) {
      return q as CoreSpriteVariant;
    }
  }
  return 'b';
}

// 光影纹理 key（运行时生成一次）
const CORE_GLOW_KEY = 'fx-core-glow';
const CORE_POOL_KEY = 'fx-core-light-pool';

// ---------------------------------------------------------------------------
// 净化器贴图（抽卡 B1 横卧过滤罐）
// 32x44 8 帧序列 —— 过滤器必须有动效（帧动画），所以是 spritesheet 不是单张。
// 接地点（支腿底部）约在贴图 y=37.9/44 => originY 取 0.86。
// ---------------------------------------------------------------------------

export const PURIFIER_SHEET_KEY = 'module-purifier-b1';
export const PURIFIER_ANIM_KEY = 'module-purifier-b1-run';
export const PURIFIER_FRAME_W = 32;
export const PURIFIER_FRAME_H = 44;
export const PURIFIER_FRAMES = 8;
export const PURIFIER_ORIGIN_Y = 37.9 / PURIFIER_FRAME_H;

// ---------------------------------------------------------------------------
// 储藏贴图（抽卡 C1 顶压观察井，DEC-112）
// 32×36 8 帧序列。接地点约在贴图 y=32/36。
// ---------------------------------------------------------------------------

export const STORAGE_SHEET_KEY = 'module-storage-c1';
export const STORAGE_ANIM_KEY = 'module-storage-c1-run';
export const STORAGE_FRAME_W = 32;
export const STORAGE_FRAME_H = 36;
export const STORAGE_FRAMES = 8;
export const STORAGE_ORIGIN_Y = 32 / STORAGE_FRAME_H;

const PURIFIER_OUTER: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 18 },
  { x: -16, y: -9 },
  { x: 16, y: -9 },
];
const PURIFIER_INNER: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 8 },
  { x: -7, y: -4 },
  { x: 7, y: -4 },
];

// HP bar (spec B2)
const HP_BAR_HEIGHT = 3;
const HP_BAR_GAP = 4; // px below module body
const HP_BAR_WIDTH = 28;
const HP_SHOW_DISTANCE = 80; // 2.5 tiles

// ---------------------------------------------------------------------------
// T6: 受损三态视觉 (docs/design-notes/ui-art-overhaul.md B3)
//
// 阈值：spec 未定义具体分界，按 Task Brief 取值 >60% 健康 / 30%-60% 受损 / <30% 严重受损。
// 登记进 docs/specs/system-purification-impact.md 由 B1 一并回填。
// ---------------------------------------------------------------------------

type ModuleHealthState = 'healthy' | 'damaged' | 'critical';

const MODULE_HEALTHY_HP_RATIO = 0.6; // > 此值 = 健康
const MODULE_CRITICAL_HP_RATIO = 0.3; // < 此值 = 严重受损；介于两者之间 = 受损

// 指示灯色值 (spec B3)
const INDICATOR_HEALTHY_COLOR = 0x44aa66;
const INDICATOR_DAMAGED_COLOR = 0xb89040;
const INDICATOR_OFF_COLOR = 0x2a2d32; // 严重受损时熄灭，同时用作受损闪烁的"灭"帧与灯座底色
const INDICATOR_SIZE = 3; // 3x3px 方点，避免圆形抗锯齿破坏像素风
const INDICATOR_BLINK_INTERVAL_MS = 500;

// Damage sits on a module's casing; it is never a radius around its feet.
const CRACK_COLOR = 0x151a1e;
const DAMAGE_SEAMS: Readonly<Record<ModuleType, ReadonlyArray<ReadonlyArray<readonly [number, number]>>>> = {
  CORE: [[[10,19],[11,22],[10,25]], [[21,21],[20,24],[21,28]], [[13,31],[16,32],[17,33]]],
  PURIFIER: [[[12,22],[16,23],[19,24]], [[11,27],[12,30],[11,34]], [[23,24],[24,28],[23,31]]],
  STORAGE: [[[21,22],[20,25],[22,28]], [[9,22],[11,23],[13,23]], [[24,30],[22,31],[21,32]]],
};

export interface ModuleDamageMask {
  readonly width: number;
  readonly height: number;
  /** Interior, opaque, non-teal material. Excludes the silhouette and floor shadow. */
  readonly material: Uint8Array;
}

export interface ModuleDamagePixel { readonly x: number; readonly y: number; readonly color: number }

/** Shared by the actual draw and its pixel audit. Coordinates are source-frame pixels. */
export function buildModuleDamagePixels(
  type: ModuleType,
  health: 'healthy' | 'damaged' | 'critical',
  mask: ModuleDamageMask,
): ModuleDamagePixel[] {
  if (health === 'healthy') return [];
  const pixels = new Map<number, ModuleDamagePixel>();
  const put = (x: number, y: number, color: number): void => {
    if (x < 0 || y < 0 || x >= mask.width || y >= mask.height || !mask.material[y*mask.width+x]) return;
    pixels.set(y*mask.width+x, {x,y,color});
  };
  for (const seam of DAMAGE_SEAMS[type]) {
    const points: Array<readonly [number, number]> = [];
    for (let i = 1; i < seam.length; i++) {
      const a = seam[i-1]!, b = seam[i]!;
      const steps = Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));
      for (let step = 0; step <= steps; step++) {
        const x = Math.round(a[0]+(b[0]-a[0])*step/steps);
        const y = Math.round(a[1]+(b[1]-a[1])*step/steps);
        points.push([x,y]); put(x,y,CRACK_COLOR);
        if (health === 'critical') put(x+1,y,CRACK_COLOR);
      }
    }
    if (health === 'critical') {
      // Intrusion follows the existing fracture. No surface glow or loose chips.
      const middle = points[Math.floor(points.length/2)]!;
      put(middle[0],middle[1],0x0e4a3f);
      put(middle[0],middle[1]+1,0x1a6b5c);
    }
  }
  return [...pixels.values()];
}

/** A material stencil, including a one-pixel guard against painting an outline. */
export function moduleDamageMaskFromRgba(width: number, height: number, rgba: Uint8ClampedArray): ModuleDamageMask {
  const material = new Uint8Array(width*height);
  for (let y = 1; y < height-1; y++) for (let x = 1; x < width-1; x++) {
    const i = (y*width+x)*4, r=rgba[i]!, g=rgba[i+1]!, b=rgba[i+2]!;
    if (rgba[i+3]! < 250 || (g > r+16 && b > r+7) || r*.299+g*.587+b*.114 < 30) continue;
    if ([i-4,i+4,i-width*4,i+width*4].some(j=>rgba[j+3]! < 250)) continue;
    material[y*width+x] = 1;
  }
  return {width,height,material};
}

function classifyModuleHealth(hpRatio: number): ModuleHealthState {
  if (hpRatio > MODULE_HEALTHY_HP_RATIO) return 'healthy';
  if (hpRatio >= MODULE_CRITICAL_HP_RATIO) return 'damaged';
  return 'critical';
}

/**
 * 生成核心的光影纹理：teal 径向渐变。
 * 世界规则「黑暗是底色、颜色是入侵」，核心烧薪柴 → 光与污染同源（teal），
 * 因此它应当是净化点内的主要光源，而不只是一块几何图形。
 */
function ensureCoreLightTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CORE_GLOW_KEY)) {
    const r = 40;
    const tex = scene.textures.createCanvas(CORE_GLOW_KEY, r * 2, r * 2);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      const g = ctx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0.0, 'rgba(47,150,143,0.50)');
      g.addColorStop(0.30, 'rgba(47,150,143,0.20)');
      g.addColorStop(0.65, 'rgba(29,94,90,0.07)');
      g.addColorStop(1.0, 'rgba(29,94,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, r * 2, r * 2);
      tex.refresh();
    }
  }
  if (!scene.textures.exists(CORE_POOL_KEY)) {
    const r = 56;
    const tex = scene.textures.createCanvas(CORE_POOL_KEY, r * 2, r * 2);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      const g = ctx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0.0, 'rgba(47,150,143,0.34)');
      g.addColorStop(0.40, 'rgba(29,94,90,0.13)');
      g.addColorStop(1.0, 'rgba(29,94,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, r * 2, r * 2);
      tex.refresh();
    }
  }
}

// ---------------------------------------------------------------------------
// PurificationModuleEntity
// ---------------------------------------------------------------------------

export class PurificationModuleEntity {
  private graphics!: Phaser.GameObjects.Graphics;
  private damageGraphics!: Phaser.GameObjects.Graphics;
  private damageMask: { key: string; mask: ModuleDamageMask } | null = null;
  private footing!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private indicatorLight!: Phaser.GameObjects.Graphics;

  // 核心贴图与光影（仅 CORE 使用）
  private coreSprite?: Phaser.GameObjects.Image;
  private coreGlow?: Phaser.GameObjects.Image;
  private coreFlicker?: Phaser.GameObjects.Image;
  private coreLightPool?: Phaser.GameObjects.Image;
  private coreFlickerTimer?: Phaser.Time.TimerEvent;

  // 净化器贴图与光影（仅 PURIFIER 使用）
  private purifierSprite?: Phaser.GameObjects.Sprite;
  private purifierGlow?: Phaser.GameObjects.Image;
  private purifierPool?: Phaser.GameObjects.Image;

  // 储藏贴图与光影（仅 STORAGE 使用）
  private storageSprite?: Phaser.GameObjects.Sprite;
  private storageGlow?: Phaser.GameObjects.Image;
  private storagePool?: Phaser.GameObjects.Image;
  private storageHpFactor = 1;

  private readonly config: ModuleEntityConfig;
  private inRange = false;
  private proximityGlow = false;
  private scene!: Phaser.Scene;

  // T6: 三态视觉状态
  private healthState: ModuleHealthState = 'healthy';
  // 核心光影强度系数（随 HP 变化；用于重建呼吸 tween）
  private coreHpFactor = 1;
  // 净化器光影强度系数（同上）
  private purifierHpFactor = 1;
  private blinkOn = true;
  private blinkTimer?: Phaser.Time.TimerEvent;

  constructor(config: ModuleEntityConfig) {
    this.config = config;
  }

  get id(): string {
    return this.config.id;
  }

  get type(): ModuleType {
    return this.config.type;
  }

  get x(): number {
    return this.config.x;
  }

  get y(): number {
    return this.config.y;
  }

  getBodyDepth(): number {
    return this.graphics.depth;
  }

  /** All surface light stays with this body; ground pools and readouts have separate bands. */
  setGroundDepth(base: number, floorDepth: number, readoutDepth: number): void {
    this.footing.setDepth(floorDepth - 0.1);
    this.graphics.setDepth(base);
    this.damageGraphics.setDepth(base + 0.12);
    for (const sprite of [this.coreSprite, this.purifierSprite, this.storageSprite]) sprite?.setDepth(base);
    this.indicatorLight.setDepth(base + 0.1);
    for (const glow of [this.coreGlow, this.purifierGlow, this.storageGlow]) glow?.setDepth(base + 0.2);
    this.coreFlicker?.setDepth(base + 0.3);
    for (const pool of [this.coreLightPool, this.purifierPool, this.storagePool]) pool?.setDepth(floorDepth);
    this.hpBarBg.setDepth(readoutDepth);
    this.hpBarFill.setDepth(readoutDepth + 0.1);
  }

  create(scene: Phaser.Scene): void {
    this.scene = scene;
    const depth = 20;
    this.footing = scene.add.graphics().setDepth(1);

    // Module shape
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(depth);
    this.damageGraphics = scene.add.graphics().setDepth(depth + .12);

    // HP bar background
    const barY = this.getHpBarY();
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.setDepth(depth + 1);
    this.hpBarBg.fillStyle(this.hpBarSlotColor(), 0.8);
    this.hpBarBg.fillRect(this.config.x - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    // HP bar fill
    this.hpBarFill = scene.add.graphics();
    this.hpBarFill.setDepth(depth + 2);

    // Indicator light (T6 三态视觉)
    this.indicatorLight = scene.add.graphics();
    this.indicatorLight.setDepth(depth + 1);

    // 核心：改用抽卡贴图 + 光影。贴图缺失时自动回落几何六边形，不会白屏。
    if (this.config.type === 'CORE' && scene.textures.exists(coreSpriteKey('a'))) {
      ensureCoreLightTextures(scene);
      const variant = resolveCoreVariant();

      // 地面光池：压扁成椭圆 —— 45° 地面上光斑本就是椭圆
      this.coreLightPool = scene.add.image(this.config.x, this.config.y + 4, CORE_POOL_KEY);
      this.coreLightPool.setDepth(depth - 1);
      this.coreLightPool.setBlendMode(Phaser.BlendModes.ADD);
      this.coreLightPool.setScale(1.25, 0.52);
      this.coreLightPool.setAlpha(0.72);

      // 本体
      this.coreSprite = scene.add.image(this.config.x, this.config.y, coreSpriteKey(variant));
      this.coreSprite.setOrigin(0.5, CORE_SPRITE_ORIGIN_Y);
      this.coreSprite.setDepth(depth);

      // 自发光：内核已大幅外露，光要配得上它的存在感
      this.coreGlow = scene.add.image(this.config.x, this.config.y - 11, CORE_GLOW_KEY);
      this.coreGlow.setDepth(depth + 3);
      this.coreGlow.setBlendMode(Phaser.BlendModes.ADD);
      this.coreGlow.setScale(1.45);
      this.coreGlow.setAlpha(0.66);

      // 不规则闪烁：独立一层，避免与呼吸 tween 争抢同一属性
      this.coreFlicker = scene.add.image(this.config.x, this.config.y - 11, CORE_GLOW_KEY);
      this.coreFlicker.setDepth(depth + 4);
      this.coreFlicker.setBlendMode(Phaser.BlendModes.ADD);
      this.coreFlicker.setScale(1.05);
      this.coreFlicker.setAlpha(0);

      this.applyCoreGlowTweens();

      // 闪烁：光偶尔抖一下，像随时会熄灭 —— 呼应"勉强维持"
      this.coreFlickerTimer = scene.time.addEvent({
        delay: 1400,
        loop: true,
        callback: () => {
          if (!this.coreFlicker || !this.coreFlicker.scene) return;
          this.coreFlicker.setAlpha(0.30 + Math.random() * 0.40);
          scene.tweens.add({
            targets: this.coreFlicker,
            alpha: 0,
            duration: 110 + Math.random() * 170,
            ease: 'Quad.easeOut',
          });
        },
      });
    }

    // 净化器：改用抽卡贴图（8 帧序列动画）。贴图缺失时回落几何三角。
    if (this.config.type === 'PURIFIER' && scene.textures.exists(PURIFIER_SHEET_KEY)) {
      ensureCoreLightTextures(scene);

      // 帧动画（全局注册一次）
      if (!scene.anims.exists(PURIFIER_ANIM_KEY)) {
        scene.anims.create({
          key: PURIFIER_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(PURIFIER_SHEET_KEY,
            { start: 0, end: PURIFIER_FRAMES - 1 }),
          frameRate: 8,
          repeat: -1,
        });
      }

      // 地面光池：压扁成椭圆 —— 45° 地面上光斑本就是椭圆
      this.purifierPool = scene.add.image(this.config.x, this.config.y + 4, CORE_POOL_KEY);
      this.purifierPool.setDepth(depth - 1);
      this.purifierPool.setBlendMode(Phaser.BlendModes.ADD);
      this.purifierPool.setScale(1.05, 0.44);
      this.purifierPool.setAlpha(0.44);

      // 本体（播放序列动画）
      this.purifierSprite = scene.add.sprite(this.config.x, this.config.y, PURIFIER_SHEET_KEY);
      this.purifierSprite.setOrigin(0.5, PURIFIER_ORIGIN_Y);
      this.purifierSprite.setDepth(depth);
      this.purifierSprite.play(PURIFIER_ANIM_KEY);

      // 自发光：比核心弱（净化器是辅助设备，不是主光源）
      this.purifierGlow = scene.add.image(this.config.x, this.config.y - 8, CORE_GLOW_KEY);
      this.purifierGlow.setDepth(depth + 3);
      this.purifierGlow.setBlendMode(Phaser.BlendModes.ADD);
      this.purifierGlow.setScale(0.95);
      this.purifierGlow.setAlpha(0.34);

      scene.tweens.add({
        targets: this.purifierGlow,
        alpha: { from: 0.26, to: 0.44 },
        duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      scene.tweens.add({
        targets: this.purifierPool,
        alpha: { from: 0.36, to: 0.54 },
        duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // 储藏：图集已加载则挂 C1；否则回落橙色方块。
    if (this.config.type === 'STORAGE' && scene.textures.exists(STORAGE_SHEET_KEY)) {
      ensureCoreLightTextures(scene);
      this.mountStorageSprite(scene, depth);
    }

    // Initial draw
    const mod = gameState.getModule(this.config.id);
    this.healthState = classifyModuleHealth(mod ? mod.hp / mod.maxHp : 1);
    this.drawModule();
    this.updateHpBar();
    this.setupIndicatorBlink();
  }

  /**
   * Call each frame with the player's position.
   * Returns true if the player is within interaction range.
   */
  update(playerX: number, playerY: number): boolean {
    const dx = playerX - this.config.x;
    const dy = playerY - this.config.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.inRange = dist <= INTERACTION_RADIUS;

    // Proximity glow: within HP_SHOW_DISTANCE
    const newGlow = dist <= HP_SHOW_DISTANCE;
    let needsRedraw = false;
    if (newGlow !== this.proximityGlow) {
      this.proximityGlow = newGlow;
      needsRedraw = true;
    }

    // T6: 三态实时迁移检测（每帧读取 hp，但只在状态桶变化时才重绘）
    const mod = gameState.getModule(this.config.id);
    if (mod) {
      const newState = classifyModuleHealth(mod.hp / mod.maxHp);
      if (newState !== this.healthState) {
        this.healthState = newState;
        needsRedraw = true;
        this.setupIndicatorBlink();
      }
    }

    if (needsRedraw) {
      this.drawModule();
    }

    this.updateHpBar(dist);
    return this.inRange;
  }

  isInRange(): boolean {
    return this.inRange;
  }

  /** The focused interaction supplies its own readout; leave world drawing intact. */
  setInteractionReadoutActive(active: boolean): void {
    this.hpBarBg.setVisible(!active);
    this.hpBarFill.setVisible(!active);
  }

  /** Set proximity glow state (called by scene for edge glow boost). */
  setProximityGlow(inRange: boolean): void {
    if (inRange !== this.proximityGlow) {
      this.proximityGlow = inRange;
      this.drawModule();
    }
  }

  /** Get module effect percentage for display in prompt bar. */
  getEffectPct(): number {
    const mod = gameState.getModule(this.config.id);
    if (!mod) return 0;
    const P = GAME_CONSTANTS.PURIFICATION;
    const ratio = Math.min(mod.hp, P.MODULE_EFFECT_HP_REF) / P.MODULE_EFFECT_HP_REF;
    if (this.config.type === 'CORE') {
      return Math.round(ratio * P.MAX_CORE_REDUCTION * 100);
    }
    if (this.config.type === 'STORAGE') {
      return Math.round(ratio * P.MAX_STORAGE_BONUS * 100);
    }
    return 0;
  }

  /** Get module HP data for prompt display. */
  getHpData(): { hp: number; maxHp: number } | null {
    const mod = gameState.getModule(this.config.id);
    if (!mod) return null;
    return { hp: mod.hp, maxHp: mod.maxHp };
  }

  /**
   * 重建核心光影的呼吸 tween。
   * 注意：不能直接对 glow/pool setAlpha —— 呼吸 tween 每帧都会覆盖它。
   * 所以 HP 变化时必须按新系数重建 tween。
   */
  private applyCoreGlowTweens(): void {
    if (!this.scene || !this.coreGlow || !this.coreLightPool) return;
    const f = this.coreHpFactor;
    this.scene.tweens.killTweensOf(this.coreGlow);
    this.scene.tweens.killTweensOf(this.coreLightPool);

    // alpha 与 scale 同时变化 —— 光在膨胀/收缩，不只是明暗
    this.scene.tweens.add({
      targets: this.coreGlow,
      alpha: { from: 0.50 * f, to: 0.88 * f },
      scale: { from: 1.28 * (0.78 + 0.22 * f), to: 1.62 * (0.78 + 0.22 * f) },
      duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: this.coreLightPool,
      alpha: { from: 0.58 * f, to: 0.92 * f },
      scaleX: { from: 1.15, to: 1.38 },
      scaleY: { from: 0.46, to: 0.58 },
      duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  /** 重建净化器光影的呼吸 tween（同核心：setAlpha 会被 tween 每帧覆盖）。 */
  private applyPurifierGlowTweens(): void {
    if (!this.scene || !this.purifierGlow || !this.purifierPool) return;
    const f = this.purifierHpFactor;
    this.scene.tweens.killTweensOf(this.purifierGlow);
    this.scene.tweens.killTweensOf(this.purifierPool);
    this.scene.tweens.add({
      targets: this.purifierGlow,
      alpha: { from: 0.26 * f, to: 0.44 * f },
      duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: this.purifierPool,
      alpha: { from: 0.36 * f, to: 0.54 * f },
      duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  /** 运行时切换核心贴图方案（抽卡实测用）。仅 CORE 生效，其他类型静默忽略。 */
  setCoreVariant(v: CoreSpriteVariant): void {
    if (this.config.type !== 'CORE' || !this.coreSprite) return;
    const key = coreSpriteKey(v);
    if (!this.scene?.textures.exists(key)) return;
    this.coreSprite.setTexture(key);
    this.damageMask = null;
    this.drawModule();
  }

  private mountStorageSprite(scene: Phaser.Scene, depth: number): void {
    this.ensureStorageAnim(scene);

    this.storagePool = scene.add.image(this.config.x, this.config.y + 4, CORE_POOL_KEY);
    this.storagePool.setDepth(depth - 1);
    this.storagePool.setBlendMode(Phaser.BlendModes.ADD);
    this.storagePool.setScale(0.95, 0.40);
    this.storagePool.setAlpha(0.36);

    this.storageSprite = scene.add.sprite(this.config.x, this.config.y, STORAGE_SHEET_KEY);
    this.storageSprite.setOrigin(0.5, STORAGE_ORIGIN_Y);
    this.storageSprite.setDepth(depth);
    this.storageSprite.play(STORAGE_ANIM_KEY);

    this.storageGlow = scene.add.image(this.config.x, this.config.y - 8, CORE_GLOW_KEY);
    this.storageGlow.setDepth(depth + 3);
    this.storageGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.storageGlow.setScale(0.88);
    this.storageGlow.setAlpha(0.28);

    this.applyStorageGlowTweens();
  }

  private ensureStorageAnim(scene: Phaser.Scene): void {
    if (scene.anims.exists(STORAGE_ANIM_KEY)) return;
    scene.anims.create({
      key: STORAGE_ANIM_KEY,
      frames: scene.anims.generateFrameNumbers(STORAGE_SHEET_KEY, {
        start: 0,
        end: STORAGE_FRAMES - 1,
      }),
      frameRate: 8,
      repeat: -1,
    });
  }

  private applyStorageGlowTweens(): void {
    if (!this.scene || !this.storageGlow || !this.storagePool) return;
    const f = this.storageHpFactor;
    this.scene.tweens.killTweensOf(this.storageGlow);
    this.scene.tweens.killTweensOf(this.storagePool);
    this.scene.tweens.add({
      targets: this.storageGlow,
      alpha: { from: 0.22 * f, to: 0.38 * f },
      duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: this.storagePool,
      alpha: { from: 0.28 * f, to: 0.44 * f },
      duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  destroy(): void {
    this.blinkTimer?.remove();
    this.blinkTimer = undefined;
    this.graphics?.destroy();
    this.damageGraphics?.destroy();
    this.damageMask = null;
    this.footing?.destroy();
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    this.indicatorLight?.destroy();
    this.coreFlickerTimer?.remove();
    this.coreFlickerTimer = undefined;
    if (this.coreGlow) this.scene?.tweens.killTweensOf(this.coreGlow);
    if (this.coreLightPool) this.scene?.tweens.killTweensOf(this.coreLightPool);
    this.coreSprite?.destroy();
    this.coreGlow?.destroy();
    this.coreFlicker?.destroy();
    this.coreLightPool?.destroy();
    this.coreSprite = undefined;
    this.coreGlow = undefined;
    this.coreFlicker = undefined;
    this.coreLightPool = undefined;
    if (this.purifierGlow) this.scene?.tweens.killTweensOf(this.purifierGlow);
    if (this.purifierPool) this.scene?.tweens.killTweensOf(this.purifierPool);
    this.purifierSprite?.destroy();
    this.purifierGlow?.destroy();
    this.purifierPool?.destroy();
    this.purifierSprite = undefined;
    this.purifierGlow = undefined;
    this.purifierPool = undefined;
    if (this.storageGlow) this.scene?.tweens.killTweensOf(this.storageGlow);
    if (this.storagePool) this.scene?.tweens.killTweensOf(this.storagePool);
    this.storageSprite?.destroy();
    this.storageGlow?.destroy();
    this.storagePool?.destroy();
    this.storageSprite = undefined;
    this.storageGlow = undefined;
    this.storagePool = undefined;
  }

  // ------------------------------------------------------------------ internal

  private drawModule(): void {
    const { x, y, type } = this.config;

    const mod = gameState.getModule(this.config.id);
    const hpRatio = mod ? mod.hp / mod.maxHp : 1;

    // Calculate alpha based on HP (spec B1)
    let fillAlpha: number;
    let edgeAlpha: number;
    if (hpRatio >= 0.75) {
      fillAlpha = 0.9;
      edgeAlpha = 0.7;
    } else if (hpRatio >= 0.5) {
      fillAlpha = 0.7;
      edgeAlpha = 0.5;
    } else if (hpRatio >= 0.25) {
      fillAlpha = 0.5;
      edgeAlpha = 0.3;
    } else {
      fillAlpha = 0.3;
      edgeAlpha = 0.15;
    }

    // Proximity glow boost
    if (this.proximityGlow) {
      edgeAlpha = Math.min(1.0, edgeAlpha + 0.2);
    }

    this.graphics.clear();
    this.damageGraphics.clear();
    this.drawFooting();

    if (type === 'CORE') {
      if (this.coreSprite) {
        // 贴图模式：HP 越低越黯淡，光也随之变弱（光 = 存续状态）
        const lit = 0.45 + 0.5 * hpRatio + (this.proximityGlow ? 0.1 : 0);
        this.coreSprite.setAlpha(Math.min(1, lit));
        // 光随 HP 变弱：不能 setAlpha（会被呼吸 tween 覆盖），改为重建 tween
        const f = 0.45 + 0.55 * hpRatio;
        if (Math.abs(f - this.coreHpFactor) > 0.05) {
          this.coreHpFactor = f;
          this.applyCoreGlowTweens();
        }
        this.graphics.clear();
        this.drawDamageDecoration(CORE_RADIUS);
      } else {
        const points: Phaser.Geom.Point[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          points.push(new Phaser.Geom.Point(
            x + CORE_RADIUS * Math.cos(angle),
            y + CORE_RADIUS * Math.sin(angle),
          ));
        }
        this.graphics.fillStyle(CORE_MAIN, fillAlpha);
        this.graphics.fillPoints(points, true);
        this.graphics.lineStyle(2, CORE_EDGE, edgeAlpha);
        this.graphics.strokePoints(points, true);
        this.drawDamageDecoration(CORE_RADIUS);
      }
    } else if (type === 'STORAGE') {
      if (this.storageSprite) {
        this.storageSprite.setAlpha(
          Math.min(1, 0.45 + 0.5 * hpRatio + (this.proximityGlow ? 0.1 : 0)),
        );
        const sf = 0.45 + 0.55 * hpRatio;
        if (Math.abs(sf - this.storageHpFactor) > 0.05) {
          this.storageHpFactor = sf;
          this.applyStorageGlowTweens();
        }
        this.graphics.clear();
        this.drawDamageDecoration(STORAGE_HALF);
      } else {
        this.graphics.fillStyle(STORAGE_MAIN, fillAlpha);
        this.graphics.fillRect(x - STORAGE_HALF, y - STORAGE_HALF, STORAGE_HALF * 2, STORAGE_HALF * 2);
        this.graphics.lineStyle(2, STORAGE_EDGE, edgeAlpha);
        this.graphics.strokeRect(x - STORAGE_HALF, y - STORAGE_HALF, STORAGE_HALF * 2, STORAGE_HALF * 2);
        this.drawDamageDecoration(STORAGE_HALF);
      }
    } else if (this.purifierSprite) {
      // 贴图模式（B1 横卧过滤罐）：HP 越低越黯淡，受损装饰仍走 graphics
      this.purifierSprite.setAlpha(
        Math.min(1, 0.45 + 0.5 * hpRatio + (this.proximityGlow ? 0.1 : 0)),
      );
      // 光随 HP 变弱：不能直接 setAlpha（会被呼吸 tween 覆盖），改为重建 tween
      const pf = 0.45 + 0.55 * hpRatio;
      if (Math.abs(pf - this.purifierHpFactor) > 0.05) {
        this.purifierHpFactor = pf;
        this.applyPurifierGlowTweens();
      }
      this.graphics.clear();
      this.drawDamageDecoration(PURIFIER_RADIUS);
    } else {
      const outer = PURIFIER_OUTER.map((p) => new Phaser.Geom.Point(x + p.x, y + p.y));
      const inner = PURIFIER_INNER.map((p) => new Phaser.Geom.Point(x + p.x, y + p.y));
      this.graphics.fillStyle(PURIFIER_FILL_OUTER, fillAlpha);
      this.graphics.fillPoints(outer, true);
      this.graphics.fillStyle(PURIFIER_FILL_INNER, fillAlpha);
      this.graphics.fillPoints(inner, true);
      this.graphics.lineStyle(2, PURIFIER_EDGE_OUTER, edgeAlpha);
      this.graphics.strokePoints(outer, true);
      this.graphics.lineStyle(1, PURIFIER_EDGE_INNER, edgeAlpha);
      this.graphics.strokePoints(inner, true);
      this.drawDamageDecoration(PURIFIER_RADIUS);
    }
  }

  /**
   * T6: 三态视觉中"框架"部分——受损时画裂缝线，严重受损时裂缝加宽并叠加边缘 teal 渗入点。
   * 健康状态不绘制任何附加物。指示灯部分见 drawIndicator()/setupIndicatorBlink()。
   */
  /** Embedded anchors and maintenance seams continue into the same concrete.
   * Wear follows the actual module's health; these marks do not add collision,
   * indicate loot, or replace the approved body/sprite. */
  private drawFooting(): void {
    const g = this.footing;
    const { x, y, type } = this.config;
    const span = type === 'PURIFIER' ? 18 : type === 'STORAGE' ? 13 : 16;
    g.clear();
    g.fillStyle(0x151a1e, 0.6);
    g.fillRect(x - span, y + 3, span * 2, 2);
    g.fillRect(x - span + 3, y + 5, span * 2 - 8, 1);
    g.fillStyle(0x3a3d42, 0.7);
    g.fillRect(x - span - 2, y + 1, 3, 2);
    g.fillRect(x + span - 1, y + 2, 3, 2);
    if (this.healthState === 'healthy') return;
    g.fillStyle(0x151a1e, 0.9);
    g.fillRect(x + span - 2, y + 5, 5, 1);
    g.fillRect(x + span + 2, y + 6, 1, 3);
    g.fillRect(x - span - 3, y + 4, 2, 1);
    // Ground damage is a dark local joint. Coloured intrusion belongs inside
    // the masked casing, never a scatter of bright squares on the floor.
  }

  private drawDamageDecoration(size: number): void {
    if (this.healthState === 'healthy') return;
    const sprite = this.coreSprite ?? this.purifierSprite ?? this.storageSprite;
    if (sprite) {
      const frame = this.config.type === 'CORE' ? sprite.frame : sprite.texture.get(0);
      if (this.damageMask?.key !== sprite.texture.key) {
        const canvas = document.createElement('canvas');
        canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
        const context = canvas.getContext('2d', {willReadFrequently:true});
        if (!context) return;
        context.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY,
          frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
        this.damageMask = {key:sprite.texture.key, mask:moduleDamageMaskFromRgba(frame.cutWidth,
          frame.cutHeight, context.getImageData(0,0,frame.cutWidth,frame.cutHeight).data)};
      }
      const pixels = buildModuleDamagePixels(this.config.type,this.healthState,this.damageMask.mask);
      // Source origin is deliberate (purifier y=37.9). Use exactly the sprite's
      // transform so the damage raster remains registered at both camera zooms.
      const left = sprite.x-sprite.displayOriginX, top = sprite.y-sprite.displayOriginY;
      for (const pixel of pixels) this.damageGraphics.fillStyle(pixel.color,1)
        .fillRect(left+pixel.x,top+pixel.y,1,1);
      return;
    }
    // Missing-texture fallback: two short cuts well inside each geometric body.
    const {x,y}=this.config;
    this.damageGraphics.fillStyle(CRACK_COLOR,1);
    const length = Math.max(3,Math.floor(size*.3));
    for (let i=0;i<length;i++) {
      this.damageGraphics.fillRect(x-3+Math.floor(i/3),y-4+i,1,1);
      this.damageGraphics.fillRect(x+2+Math.floor(i/3),y-2+i,1,1);
    }
  }

  /**
   * T6: 指示灯闪烁调度。健康=常亮，受损=每 500ms 切换亮/灭，严重受损=常灭。
   * 只在状态桶变化时被调用一次，不会每帧重建 timer。
   */
  private setupIndicatorBlink(): void {
    this.blinkTimer?.remove();
    this.blinkTimer = undefined;
    this.blinkOn = true;

    if (this.healthState === 'damaged') {
      this.blinkTimer = this.scene.time.addEvent({
        delay: INDICATOR_BLINK_INTERVAL_MS,
        loop: true,
        callback: () => {
          this.blinkOn = !this.blinkOn;
          this.drawIndicator();
        },
      });
    }

    this.drawIndicator();
  }

  /**
   * 指示灯 Y。
   * 六边形模式下灯在模块中心即可；贴图模式不行 —— 模块坐标 y 落在贴图 85%
   * 高度处（几乎贴地），灯会陷进地面光池里。需上移到贴图约 60% 高度处。
   */
  private getIndicatorY(): number {
    if (this.config.type === 'CORE' && this.scene?.textures.exists(coreSpriteKey('a'))) {
      return this.config.y - CORE_SPRITE_HEIGHT * 0.4 + CORE_SPRITE_BOTTOM_OFFSET;
    }
    // 净化器贴图 44 高、originY 0.86 => 模块坐标 y 落在贴图下部，需上移
    if (this.config.type === 'PURIFIER' && this.scene?.textures.exists(PURIFIER_SHEET_KEY)) {
      return this.config.y - PURIFIER_FRAME_H * 0.4
        + PURIFIER_FRAME_H * (1 - PURIFIER_ORIGIN_Y);
    }
    if (this.config.type === 'STORAGE' && this.storageSprite) {
      return this.config.y - STORAGE_FRAME_H * 0.4
        + STORAGE_FRAME_H * (1 - STORAGE_ORIGIN_Y);
    }
    return this.config.y;
  }

  /** T6: 重绘指示灯（独立 Graphics，不牵动整个模块的重绘）。 */
  private drawIndicator(): void {
    const { x } = this.config;
    const y = this.getIndicatorY();
    this.indicatorLight.clear();

    // 灯座底色：常亮/闪烁灯的“灭”帧也复用这个颜色
    this.indicatorLight.fillStyle(INDICATOR_OFF_COLOR, 1);
    this.indicatorLight.fillRect(x - INDICATOR_SIZE / 2, y - INDICATOR_SIZE / 2, INDICATOR_SIZE, INDICATOR_SIZE);

    let litColor: number | null = null;
    if (this.healthState === 'healthy') {
      litColor = this.config.type === 'PURIFIER' ? PURIFIER_LAMP : INDICATOR_HEALTHY_COLOR;
    } else if (this.healthState === 'damaged' && this.blinkOn) {
      litColor = INDICATOR_DAMAGED_COLOR;
    }

    if (litColor !== null) {
      this.indicatorLight.fillStyle(litColor, 1);
      this.indicatorLight.fillRect(x - INDICATOR_SIZE / 2, y - INDICATOR_SIZE / 2, INDICATOR_SIZE, INDICATOR_SIZE);
    }
  }

  private updateHpBar(distance?: number): void {
    const mod = gameState.getModule(this.config.id);
    if (!mod) return;

    const { x } = this.config;
    const barY = this.getHpBarY();
    const ratio = mod.hp / mod.maxHp;

    // Visibility: show if close enough or HP is low
    const shouldShow = (distance !== undefined && distance <= HP_SHOW_DISTANCE) || ratio < 0.5;
    const barAlpha = shouldShow ? 1 : 0.15;

    // Background
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(this.hpBarSlotColor(), barAlpha * 0.8);
    this.hpBarBg.fillRect(x - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    const fillColor = ratio < 0.25 ? DANGER_COLOR : this.hpBarFillColor();

    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(fillColor, barAlpha);
    this.hpBarFill.fillRect(
      x - HP_BAR_WIDTH / 2,
      barY,
      HP_BAR_WIDTH * ratio,
      HP_BAR_HEIGHT,
    );
  }

  private hpBarSlotColor(): number {
    if (this.config.type === 'PURIFIER') return PURIFIER_BAR_SLOT;
    return this.config.type === 'CORE' ? 0x222233 : 0x332222;
  }

  private hpBarFillColor(): number {
    if (this.config.type === 'PURIFIER') return PURIFIER_FILL_OUTER;
    return this.config.type === 'CORE' ? CORE_MAIN : STORAGE_MAIN;
  }

  private getHpBarY(): number {
    const { y, type } = this.config;
    if (type === 'CORE') {
      // 贴图模式：底部由 origin 与贴图高度决定，不能用六边形的 CORE_RADIUS，
      // 否则血条会掉到物体下方十几像素处（贴图底部只在 y+6）。
      if (this.scene?.textures.exists(coreSpriteKey('a'))) {
        return y + CORE_SPRITE_BOTTOM_OFFSET + HP_BAR_GAP;
      }
      return y + CORE_RADIUS + HP_BAR_GAP;
    }
    if (type === 'PURIFIER') {
      // 贴图模式：底部（支腿）约在 y + 44*(1-0.86) = y+6.2，
      // 用几何三角的 PURIFIER_RADIUS(18) 会让血条掉到物体下方十几像素处。
      if (this.scene?.textures.exists(PURIFIER_SHEET_KEY)) {
        return y + PURIFIER_FRAME_H * (1 - PURIFIER_ORIGIN_Y) + HP_BAR_GAP;
      }
      return y + PURIFIER_RADIUS + HP_BAR_GAP;
    }
    if (this.storageSprite) {
      return y + STORAGE_FRAME_H * (1 - STORAGE_ORIGIN_Y) + HP_BAR_GAP;
    }
    return y + STORAGE_HALF + HP_BAR_GAP;
  }
}
