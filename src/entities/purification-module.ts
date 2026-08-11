/**
 * PurificationModule entity - visual representation of a module in the purification scene.
 *
 * Each module is a coloured geometric shape (CORE=blue hexagon, STORAGE=orange square)
 * with an hp bar displayed as a same-colour thin bar below the module body.
 * No text is rendered in the game world; all readable info lives in DOM overlays.
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

// Module sizes (spec B1)
const CORE_RADIUS = 16;
const STORAGE_HALF = 14; // half-side = 14 => 28px side

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

// 裂缝线色值与形状 (spec B3：受损 2-3 条 1px，严重受损同样的线加宽)
const CRACK_COLOR = 0x151a1e;
const CRACK_LINE_OFFSETS: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: -0.55, y1: -0.65, x2: -0.15, y2: -0.1 },
  { x1: 0.25, y1: -0.6, x2: 0.6, y2: -0.05 },
  { x1: -0.2, y1: 0.15, x2: 0.35, y2: 0.7 },
];

// 边缘 teal 渗入点色值与位置 (spec B3：严重受损时出现)
const SEEP_COLOR = 0x1aad96;
const SEEP_SIZE = 3; // 2-3px 渗入点
const SEEP_ANGLES = [Math.PI * (40 / 180), Math.PI * (165 / 180), Math.PI * (280 / 180)];

function classifyModuleHealth(hpRatio: number): ModuleHealthState {
  if (hpRatio > MODULE_HEALTHY_HP_RATIO) return 'healthy';
  if (hpRatio >= MODULE_CRITICAL_HP_RATIO) return 'damaged';
  return 'critical';
}

// ---------------------------------------------------------------------------
// PurificationModuleEntity
// ---------------------------------------------------------------------------

export class PurificationModuleEntity {
  private graphics!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private indicatorLight!: Phaser.GameObjects.Graphics;

  private readonly config: ModuleEntityConfig;
  private inRange = false;
  private proximityGlow = false;
  private scene!: Phaser.Scene;

  // T6: 三态视觉状态
  private healthState: ModuleHealthState = 'healthy';
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

  create(scene: Phaser.Scene): void {
    this.scene = scene;
    const depth = 20;

    // Module shape
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(depth);

    // HP bar background
    const barY = this.getHpBarY();
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.setDepth(depth + 1);
    this.hpBarBg.fillStyle(this.config.type === 'CORE' ? 0x222233 : 0x332222, 0.8);
    this.hpBarBg.fillRect(this.config.x - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    // HP bar fill
    this.hpBarFill = scene.add.graphics();
    this.hpBarFill.setDepth(depth + 2);

    // Indicator light (T6 三态视觉)
    this.indicatorLight = scene.add.graphics();
    this.indicatorLight.setDepth(depth + 1);

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
    if (this.config.type === 'CORE') {
      return Math.round((mod.hp / 100) * P.MAX_CORE_REDUCTION * 100);
    }
    return Math.round((mod.hp / 100) * P.MAX_STORAGE_BONUS * 100);
  }

  /** Get module HP data for prompt display. */
  getHpData(): { hp: number; maxHp: number } | null {
    const mod = gameState.getModule(this.config.id);
    if (!mod) return null;
    return { hp: mod.hp, maxHp: mod.maxHp };
  }

  destroy(): void {
    this.blinkTimer?.remove();
    this.blinkTimer = undefined;
    this.graphics?.destroy();
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    this.indicatorLight?.destroy();
  }

  // ------------------------------------------------------------------ internal

  private drawModule(): void {
    const { x, y, type } = this.config;
    const mainColor = type === 'CORE' ? CORE_MAIN : STORAGE_MAIN;
    const edgeColor = type === 'CORE' ? CORE_EDGE : STORAGE_EDGE;

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

    if (type === 'CORE') {
      // Hexagon
      const points: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        points.push(new Phaser.Geom.Point(
          x + CORE_RADIUS * Math.cos(angle),
          y + CORE_RADIUS * Math.sin(angle),
        ));
      }
      this.graphics.fillStyle(mainColor, fillAlpha);
      this.graphics.fillPoints(points, true);
      this.graphics.lineStyle(2, edgeColor, edgeAlpha);
      this.graphics.strokePoints(points, true);

      // T6: 受损/严重受损裂缝 + 严重受损边缘渗入 (spec B3，替代旧的低血红环闪烁)
      this.drawDamageDecoration(CORE_RADIUS);
    } else {
      // Square
      this.graphics.fillStyle(mainColor, fillAlpha);
      this.graphics.fillRect(x - STORAGE_HALF, y - STORAGE_HALF, STORAGE_HALF * 2, STORAGE_HALF * 2);
      this.graphics.lineStyle(2, edgeColor, edgeAlpha);
      this.graphics.strokeRect(x - STORAGE_HALF, y - STORAGE_HALF, STORAGE_HALF * 2, STORAGE_HALF * 2);

      // T6: 受损/严重受损裂缝 + 严重受损边缘渗入 (spec B3，替代旧的低血红环闪烁)
      this.drawDamageDecoration(STORAGE_HALF);
    }
  }

  /**
   * T6: 三态视觉中"框架"部分——受损时画裂缝线，严重受损时裂缝加宽并叠加边缘 teal 渗入点。
   * 健康状态不绘制任何附加物。指示灯部分见 drawIndicator()/setupIndicatorBlink()。
   */
  private drawDamageDecoration(size: number): void {
    if (this.healthState === 'healthy') return;

    const { x, y } = this.config;
    const crackWidth = this.healthState === 'critical' ? 2 : 1;

    this.graphics.lineStyle(crackWidth, CRACK_COLOR, 1);
    for (const line of CRACK_LINE_OFFSETS) {
      this.graphics.beginPath();
      this.graphics.moveTo(x + line.x1 * size, y + line.y1 * size);
      this.graphics.lineTo(x + line.x2 * size, y + line.y2 * size);
      this.graphics.strokePath();
    }

    if (this.healthState === 'critical') {
      this.graphics.fillStyle(SEEP_COLOR, 1);
      for (const angle of SEEP_ANGLES) {
        const sx = x + size * Math.cos(angle);
        const sy = y + size * Math.sin(angle);
        this.graphics.fillRect(sx - SEEP_SIZE / 2, sy - SEEP_SIZE / 2, SEEP_SIZE, SEEP_SIZE);
      }
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

  /** T6: 重绘指示灯（独立 Graphics，不牵动整个模块的重绘）。 */
  private drawIndicator(): void {
    const { x, y } = this.config;
    this.indicatorLight.clear();

    // 灯座底色：常亮/闪烁灯的“灭”帧也复用这个颜色
    this.indicatorLight.fillStyle(INDICATOR_OFF_COLOR, 1);
    this.indicatorLight.fillRect(x - INDICATOR_SIZE / 2, y - INDICATOR_SIZE / 2, INDICATOR_SIZE, INDICATOR_SIZE);

    let litColor: number | null = null;
    if (this.healthState === 'healthy') {
      litColor = INDICATOR_HEALTHY_COLOR;
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
    this.hpBarBg.fillStyle(this.config.type === 'CORE' ? 0x222233 : 0x332222, barAlpha * 0.8);
    this.hpBarBg.fillRect(x - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    // Fill (same color as module, or danger red when critical)
    const fillColor = ratio < 0.25 ? DANGER_COLOR :
      (this.config.type === 'CORE' ? CORE_MAIN : STORAGE_MAIN);

    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(fillColor, barAlpha);
    this.hpBarFill.fillRect(
      x - HP_BAR_WIDTH / 2,
      barY,
      HP_BAR_WIDTH * ratio,
      HP_BAR_HEIGHT,
    );
  }

  private getHpBarY(): number {
    const { y, type } = this.config;
    // Position below module body
    if (type === 'CORE') {
      return y + CORE_RADIUS + HP_BAR_GAP;
    }
    return y + STORAGE_HALF + HP_BAR_GAP;
  }
}
