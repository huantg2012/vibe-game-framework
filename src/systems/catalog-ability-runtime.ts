/** Versioned item effects. Inventory owns charges; this owns only committed effect lifetimes. */
import type Phaser from 'phaser';
import type { Vector2 } from '@/types/game-types';
import type { EnemyView } from '@/types/ai-types';
import type { HostToolTarget } from '@/systems/contamination-host-system';
import { validateResolvedCatalogAbility, type CatalogRuntimeAbility, type CatalogAbilityFamily } from '@/systems/contaminant-catalog';
import { runtimeInteger, runtimeNumber, runtimeRecord, runtimeStrings, runtimeVector } from '@/systems/ai/runtime-validation';
import { crossesToolLine, selectNearestVisibleTarget, type ToolLine, type ToolRevealSnapshot } from '@/systems/tool-targeting';
import type { EnemyControlEffect } from '@/systems/enemy-control-state';
import { captureBodyEcho, restoreBodyEcho, validateBodyEchoRuntimeState, type BodyEcho, type BodyEchoRuntimeState, type BodyEchoSource } from '@/systems/tool-body-echo';
import { drawPressure, drawSeam, drawHostRestraint, drawFootDrag } from '@/systems/tool-ground-vfx';
import { drawBracketMarker, CONTAM_GLOW, GHOST_COLOR } from '@/systems/tool-vfx';

export interface CatalogAbilityPorts {
  readonly runId?: string;
  readonly hasEquivalentLegacyEffect?: (family: CatalogAbilityFamily) => boolean;
  readonly combatRulesVersion?: 1 | 2;
  readonly getFacingAngle?: () => number;
  readonly canApplyHardControl?: (id: string) => boolean;
  readonly setPlayerActionSilenced?: (active: boolean) => void;
  readonly getBasePollutionResistance?: () => number;
  readonly getDashDestination?: (distance: number) => Vector2 | null;
  /** Must sweep bodies and execute contact, hazard and sound at each traversed substep. */
  readonly advanceGroundDash?: (target: Readonly<Vector2>, dtMs: number) => boolean;
  readonly isGroundConnected?: (from: Readonly<Vector2>, to: Readonly<Vector2>, range: number) => boolean;
  readonly isTargetAlive?: (id: string) => boolean;
  readonly isTargetVisible?: (position: Readonly<Vector2>) => boolean;
  readonly hasTargetLineOfSight?: (from: Readonly<Vector2>, to: Readonly<Vector2>) => boolean;
  readonly setEnemyControl?: (id: string, source: string, effect: EnemyControlEffect) => void;
  readonly clearEnemyControl?: (id: string, source: string) => void;
  readonly hasEnemyControl?: (id: string, source: string) => boolean;
  readonly getSoundLureDestination?: (distance: number) => Vector2 | null;
  readonly reportSoundLure?: (position: Vector2, radius: number, pathBounded?: boolean) => void;
  readonly getStitchPlacement?: (length: number, distance: number) => ToolLine | null;
  readonly getEnvironmentTargets?: () => readonly HostToolTarget[];
  readonly suppressEnvironmentHazard?: (id: string, source: string, durationMs: number, includeWall?: boolean) => boolean;
  readonly clearEnvironmentControl?: (id: string, source: string) => void;
  readonly getRevealSnapshot?: (range: number) => ToolRevealSnapshot;
  readonly showAbyssReveal?: (enemies: readonly Vector2[], nodes: readonly Vector2[], durationMs: number, cores?: readonly Vector2[]) => void;
  readonly setVisualDecoy?: (source: string, position: Vector2 | null) => void;
  readonly setPlayerInput?: (enabled: boolean) => void;
  readonly getPlayerSprite?: () => Phaser.GameObjects.Image | undefined;
  readonly captureEnemyVisual?: (id: string) => BodyEchoSource | undefined;
  readonly getGroundVisualDepth?: (groundY: number) => number;
  readonly drawCatalogToolObject?: (g: Phaser.GameObjects.Graphics, definitionId: string, position: Readonly<Vector2>, alpha: number) => void;
}

export interface CatalogTargetPreview {
  readonly kind: 'target' | 'dash' | 'line' | 'point' | 'area';
  readonly origin: Readonly<Vector2>;
  readonly position: Readonly<Vector2>;
  readonly targetId?: string;
  readonly line?: ToolLine;
  readonly radius?: number;
}

export interface CatalogEffectState {
  effectId: string;
  actionId: string;
  sourceInstanceId: string;
  definitionId: string;
  catalogVersion: string;
  resolvedParams: CatalogRuntimeAbility;
  startTime: number;
  remainingTime: number;
  position: Vector2;
  origin: Vector2;
  targetId: string | null;
  controlActive: boolean;
  pulseElapsedMs: number;
  line: ToolLine | null;
  affectedEnemyIds: string[];
  previousPositions: { enemyId: string; position: Vector2 }[];
  stops: { enemyId: string; remainingMs: number }[];
  snapshot: ToolRevealSnapshot | null;
  echo: BodyEchoRuntimeState | null;
}
export interface CatalogAbilityRuntimeState {
  readonly version: 1;
  readonly runId: string;
  readonly elapsedMs: number;
  readonly serial: number;
  readonly completedActions: readonly string[];
  readonly dashCooldownMs: number;
  readonly effects: readonly CatalogEffectState[];
  readonly controlRejections?: readonly { enemyId: string; remainingMs: number }[];
}

const textId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
const points = (value: unknown): value is Vector2[] => Array.isArray(value) && value.length <= 4096 && value.every(runtimeVector);
export function validateCatalogAbilityRuntimeState(value: unknown): value is CatalogAbilityRuntimeState {
  if (!runtimeRecord(value) || value.version !== 1 || typeof value.runId !== 'string'
    || !runtimeNumber(value.elapsedMs, 0) || !runtimeInteger(value.serial, 0)
    || !runtimeStrings(value.completedActions, 16384) || value.completedActions.length !== value.serial
    || !runtimeNumber(value.dashCooldownMs, 0, 400) || !Array.isArray(value.effects) || value.effects.length > 10) return false;
  if (value.controlRejections !== undefined && (!Array.isArray(value.controlRejections) || value.controlRejections.length > 4096
    || !value.controlRejections.every(row => runtimeRecord(row) && textId(row.enemyId) && runtimeNumber(row.remainingMs, Number.MIN_VALUE, 350))
    || new Set(value.controlRejections.map(row => row.enemyId)).size !== value.controlRejections.length)) return false;
  const ids = new Set<string>(), families = new Set<CatalogAbilityFamily>();
  for (const effect of value.effects) {
    if (!runtimeRecord(effect) || !validateResolvedCatalogAbility(effect.resolvedParams)) return false;
    const params = effect.resolvedParams;
    if (params.slot !== 'active' || families.has(params.familyId) || !textId(effect.effectId)
      || !/^ability:[1-9][0-9]*$/.test(effect.effectId) || Number(effect.effectId.slice(8)) > value.serial
      || ids.has(effect.effectId) || !textId(effect.actionId) || !value.completedActions.includes(effect.actionId)
      || !textId(effect.sourceInstanceId) || effect.definitionId !== params.definitionId || effect.catalogVersion !== params.catalogVersion
      || !runtimeNumber(effect.startTime, 0, value.elapsedMs) || !runtimeNumber(effect.remainingTime, 0, params.durationMs)
      || Math.abs(effect.remainingTime - Math.max(0, params.durationMs - (value.elapsedMs - effect.startTime))) > .001
      || !runtimeVector(effect.position) || !runtimeVector(effect.origin) || typeof effect.controlActive !== 'boolean'
      || !(effect.targetId === null || textId(effect.targetId)) || !runtimeNumber(effect.pulseElapsedMs, 0, 1000)
      || !runtimeStrings(effect.affectedEnemyIds, 4096) || !Array.isArray(effect.previousPositions) || effect.previousPositions.length > 4096
      || !effect.previousPositions.every(row => runtimeRecord(row) && textId(row.enemyId) && runtimeVector(row.position))
      || new Set(effect.previousPositions.map(row => row.enemyId)).size !== effect.previousPositions.length
      || !Array.isArray(effect.stops) || effect.stops.length > 4096
      || !effect.stops.every(row => runtimeRecord(row) && textId(row.enemyId) && (effect.affectedEnemyIds as string[]).includes(row.enemyId)
        && runtimeNumber(row.remainingMs, Number.MIN_VALUE, params.familyId === 'tripwire' ? params.paramValue : 0))
      || new Set(effect.stops.map(row => row.enemyId)).size !== effect.stops.length
      || !(effect.echo === null || validateBodyEchoRuntimeState(effect.echo))) return false;
    if (params.familyId === 'solidify' || params.familyId === 'suppress') {
      if (!textId(effect.targetId)) return false;
    } else if (effect.targetId !== null) return false;
    if (params.familyId === 'tripwire') {
      if (!runtimeRecord(effect.line) || !runtimeVector(effect.line.pointA) || !runtimeVector(effect.line.pointB)
        || Math.abs(Math.hypot(effect.line.pointA.x - effect.line.pointB.x, effect.line.pointA.y - effect.line.pointB.y) - 64) > .001) return false;
    } else if (effect.line !== null || effect.stops.length || effect.previousPositions.length) return false;
    if (params.familyId === 'survey') {
      const snapshot = effect.snapshot;
      if (!runtimeRecord(snapshot) || !points(snapshot.enemyPositions) || !points(snapshot.nodePositions)
        || (snapshot.corePositions !== undefined && !points(snapshot.corePositions))) return false;
    } else if (effect.snapshot !== null) return false;
    if (effect.remainingTime === 0 && !effect.stops.length) return false;
    ids.add(effect.effectId); families.add(params.familyId);
  }
  return true;
}

/** No simulation is performed during restore: source rebinding only. */
export class CatalogAbilityRuntime {
  private elapsedMs = 0;
  private serial = 0;
  private completedActions: string[] = [];
  private effects: CatalogEffectState[] = [];
  private dashCooldownMs = 0;
  private graphics = new Map<string, Phaser.GameObjects.Graphics>();
  private echoes = new Map<string, BodyEcho>();
  private failure: string | null = null;
  private controlRejections = new Map<string, number>();
  private rejectionGraphic: Phaser.GameObjects.Graphics | null = null;
  constructor(private readonly scene: Phaser.Scene, private readonly player: () => Vector2,
    private readonly enemies: () => readonly EnemyView[], private readonly ports: CatalogAbilityPorts) {}

  getLastFailure(): string | null { return this.failure; }
  showControlRejection(enemyId: string): void {
    const enemy = this.enemies().find(row => row.getId() === enemyId);
    if (!enemy || !(this.ports.isTargetVisible?.(enemy.getPosition()) ?? true)) return;
    this.controlRejections.set(enemyId, 350); this.drawControlRejections();
  }
  showNearestControlRejection(range = Infinity): void {
    const enemy = this.pick(this.enemies(), range, row => row.getPosition(), row =>
      (this.ports.isTargetAlive?.(row.getId()) ?? true) && !(this.ports.canApplyHardControl?.(row.getId()) ?? true));
    if (enemy) this.showControlRejection(enemy.getId());
  }
  isFamilyActive(family: CatalogAbilityFamily): boolean { return this.effects.some(effect => effect.resolvedParams.familyId === family); }
  isActionSilenced(): boolean { return this.isFamilyActive('silence'); }
  isGroundDashing(): boolean { return this.isFamilyActive('dash'); }
  getResistanceBonus(): number {
    return this.effects.find(effect => effect.resolvedParams.familyId === 'resistance')?.resolvedParams.paramValue ?? 0;
  }
  getActiveEffects(): readonly { definitionId: string; familyId: CatalogAbilityFamily; remainingMs: number; durationMs: number; resistanceBonus?: number }[] {
    return this.effects.map(effect => ({ definitionId: effect.definitionId, familyId: effect.resolvedParams.familyId,
      remainingMs: effect.remainingTime, durationMs: effect.resolvedParams.durationMs,
      ...(effect.resolvedParams.familyId === 'resistance' ? { resistanceBonus: effect.resolvedParams.paramValue } : {}) }));
  }
  getRestraint(id: string): { pressure: boolean; snared: boolean } {
    return { pressure: this.effects.some(effect => effect.resolvedParams.familyId === 'slow_zone' && effect.affectedEnemyIds.includes(id)),
      snared: this.effects.some(effect => effect.stops.some(stop => stop.enemyId === id)) };
  }

  /** Shared read-only admission for visible aiming and the real one-press action. */
  getTargetPreview(ability: CatalogRuntimeAbility): CatalogTargetPreview | null {
    if (ability.slot !== 'active' || this.isFamilyActive(ability.familyId) || this.ports.hasEquivalentLegacyEffect?.(ability.familyId)) return null;
    const origin = this.player(), family = ability.familyId;
    if (family === 'solidify') {
      const enemy = this.pick(this.enemies(), ability.rangePx, row => row.getPosition(), row =>
        (this.ports.isTargetAlive?.(row.getId()) ?? true) && (this.ports.canApplyHardControl?.(row.getId()) ?? true));
      return enemy && this.ports.setEnemyControl ? { kind: 'target', origin, position: enemy.getPosition(), targetId: enemy.getId() } : null;
    }
    if (family === 'suppress') {
      const target = this.pick(this.ports.getEnvironmentTargets?.() ?? [], ability.rangePx, row => row.position, row => row.canSuppressCatalogHazard ?? row.canSuppressHazard);
      return target && this.ports.suppressEnvironmentHazard ? { kind: 'target', origin, position: target.position, targetId: target.id } : null;
    }
    if (family === 'dash') {
      if (this.dashCooldownMs > 0 || !this.ports.advanceGroundDash) return null;
      const destination = this.ports.getDashDestination?.(ability.paramValue);
      return destination && Math.hypot(destination.x-origin.x, destination.y-origin.y)>=16
        ? { kind: 'dash', origin, position: destination } : null;
    }
    if (family === 'sound_lure') {
      const position = this.ports.getSoundLureDestination?.(ability.rangePx);
      return position && this.ports.reportSoundLure && (this.ports.isTargetVisible?.(position) ?? true)
        ? { kind: 'point', origin, position } : null;
    }
    if (family === 'tripwire') {
      const line = this.ports.getStitchPlacement?.(64, ability.rangePx);
      return line && this.ports.setEnemyControl ? { kind: 'line', origin, line,
        position: { x: (line.pointA.x+line.pointB.x)/2, y: (line.pointA.y+line.pointB.y)/2 } } : null;
    }
    if (family === 'slow_zone' && this.ports.setEnemyControl && this.ports.isGroundConnected?.(origin, origin, ability.rangePx)) {
      return { kind: 'area', origin, position: origin, radius: ability.rangePx };
    }
    return null;
  }

  use(ability: CatalogRuntimeAbility, sourceInstanceId: string, commit: (actionId: string) => boolean, requestedActionId?: string): boolean {
    this.failure = null;
    if (!validateResolvedCatalogAbility(ability) || ability.slot !== 'active') return false;
    const actionId = requestedActionId ?? `catalog:${this.ports.runId ?? ''}:${this.serial + 1}`;
    if (!textId(actionId) || this.completedActions.includes(actionId)) return false;
    const family = ability.familyId;
    if (this.isFamilyActive(family) || this.ports.hasEquivalentLegacyEffect?.(family)) return this.fail('同类效果尚未结束，未消耗次数。');
    let targetId: string | null = null, line: ToolLine | null = null, snapshot: ToolRevealSnapshot | null = null;
    const origin = { ...this.player() };
    let position = { ...origin };
    const preview = this.getTargetPreview(ability);
    if (family === 'solidify') {
      if (!preview?.targetId) {
        this.showNearestControlRejection(ability.rangePx);
        return this.fail('面前没有可凝滞的可见目标；刚挣脱的对象暂时不能再控制。');
      }
      targetId = preview.targetId; position = { ...preview.position };
    } else if (family === 'suppress') {
      if (!preview?.targetId) return this.fail('面前没有可压制的活动污染源。');
      targetId = preview.targetId; position = { ...preview.position };
    } else if (family === 'dash') {
      if (!preview) return this.fail(this.dashCooldownMs > 0 ? '脚步尚未落稳，未消耗次数。' : '面前没有足够长的可见通路。');
      position = { ...preview.position };
    } else if (family === 'resistance') {
      if ((this.ports.getBasePollutionResistance?.() ?? 0) >= 60) return this.fail('抗污已经达到上限，未消耗次数。');
    } else if (family === 'sound_lure') {
      if (!preview) return this.fail('面前没有可见的合法落点。');
      position = { ...preview.position };
    } else if (family === 'tripwire') {
      if (!preview?.line) return this.fail('面前没有足够完整的地面铺线。');
      line = preview.line;
    } else if (family === 'slow_zone') {
      if (!preview) return this.fail('此处没有可以承重的完整地面。');
    } else if (family === 'image_lure') {
      if (!this.ports.setVisualDecoy) return false;
    } else if (family === 'survey') {
      if (!this.ports.getRevealSnapshot || !this.ports.showAbyssReveal) return false;
      snapshot = this.ports.getRevealSnapshot(ability.rangePx); // Empty is still a paid, useful answer.
    }
    if (!commit(actionId)) return false;
    this.serial++;
    this.completedActions.push(actionId);
    const effect: CatalogEffectState = { effectId: `ability:${this.serial}`, actionId, sourceInstanceId,
      definitionId: ability.definitionId, catalogVersion: ability.catalogVersion, resolvedParams: { ...ability },
      startTime: this.elapsedMs, remainingTime: ability.durationMs, origin, position, targetId,
      controlActive: family === 'solidify', pulseElapsedMs: 0, line, snapshot, echo: null,
      affectedEnemyIds: [], stops: [], previousPositions: family === 'tripwire'
        ? this.enemies().map(enemy => ({ enemyId: enemy.getId(), position: { ...enemy.getPosition() } })) : [] };
    this.effects.push(effect);
    if (family === 'solidify') {
      this.ports.setEnemyControl!(targetId!, effect.effectId, { movementMultiplier: 0, perceptionMultiplier: 0, suppressAttack: true, breakOnDamage: true });
      const visual = this.ports.captureEnemyVisual?.(targetId!);
      if (visual) this.rememberEcho(effect, captureBodyEcho(this.scene, visual, 'freeze'));
    } else if (family === 'suppress') {
      if (!this.ports.suppressEnvironmentHazard!(targetId!, effect.effectId, ability.durationMs, true)) throw new Error('Suppression target changed during atomic use');
    } else if (family === 'sound_lure') this.ports.reportSoundLure!(position, ability.rangePx, true);
    else if (family === 'image_lure') {
      this.ports.setVisualDecoy!(effect.effectId, position);
      const sprite = this.ports.getPlayerSprite?.();
      if (sprite?.texture) this.rememberEcho(effect, captureBodyEcho(this.scene, { textureKey: sprite.texture.key, frame: sprite.frame.name,
        originX: sprite.originX, originY: sprite.originY, scaleX: sprite.scaleX, scaleY: sprite.scaleY }, 'mirror'));
    } else if (family === 'survey') this.publishSnapshot(effect);
    else if (family === 'dash') this.ports.setPlayerInput?.(false);
    this.draw(effect);
    return true;
  }

  update(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return;
    this.elapsedMs += deltaMs;
    for (const [id, remaining] of this.controlRejections) {
      if (remaining <= deltaMs) this.controlRejections.delete(id);
      else this.controlRejections.set(id, remaining - deltaMs);
    }
    this.drawControlRejections();
    this.dashCooldownMs = Math.max(0, this.dashCooldownMs - deltaMs);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]!, params = effect.resolvedParams, family = params.familyId;
      const activeDt = Math.min(effect.remainingTime, deltaMs);
      effect.remainingTime = Math.max(0, effect.remainingTime - deltaMs);
      for (let j = effect.stops.length - 1; j >= 0; j--) {
        const stop = effect.stops[j]!; stop.remainingMs -= deltaMs;
        if (stop.remainingMs <= 0) { this.ports.clearEnemyControl?.(stop.enemyId, effect.effectId); effect.stops.splice(j, 1); }
      }
      if (family === 'solidify') {
        const enemy = this.enemies().find(row => row.getId() === effect.targetId);
        effect.controlActive = !!enemy && (this.ports.hasEnemyControl?.(effect.targetId!, effect.effectId) ?? effect.controlActive);
        if (!effect.controlActive) effect.remainingTime = 0;
        if (enemy) Object.assign(effect.position, enemy.getPosition());
      } else if (family === 'dash') {
        const progress = 1 - effect.remainingTime / params.durationMs;
        const target = { x: effect.origin.x + (effect.position.x - effect.origin.x) * progress,
          y: effect.origin.y + (effect.position.y - effect.origin.y) * progress };
        if (!this.ports.advanceGroundDash?.(target, activeDt)) effect.remainingTime = 0;
        if (effect.remainingTime === 0) this.dashCooldownMs = Math.max(0, 400 - Math.max(0, deltaMs - activeDt));
      } else if (family === 'sound_lure' && effect.remainingTime > 0) {
        effect.pulseElapsedMs += activeDt;
        while (effect.pulseElapsedMs >= 1000) { effect.pulseElapsedMs -= 1000; this.ports.reportSoundLure?.(effect.position, params.rangePx, true); }
      } else if (family === 'tripwire' && effect.remainingTime > 0) this.updateTripwire(effect);
      else if (family === 'slow_zone') this.updateSlowZone(effect);
      if (effect.remainingTime <= 0 && effect.stops.length === 0) { this.remove(effect); this.effects.splice(i, 1); }
      else this.draw(effect);
    }
  }

  exportRuntimeState(): CatalogAbilityRuntimeState {
    const effects = this.effects.map(effect => ({ ...effect, controlActive: effect.resolvedParams.familyId === 'solidify'
      ? this.ports.hasEnemyControl?.(effect.targetId!, effect.effectId) ?? effect.controlActive : effect.controlActive }));
    return structuredClone({ version: 1, runId: this.ports.runId ?? '', elapsedMs: this.elapsedMs,
      serial: this.serial, completedActions: this.completedActions, dashCooldownMs: this.dashCooldownMs, effects,
      controlRejections: [...this.controlRejections].map(([enemyId, remainingMs]) => ({ enemyId, remainingMs })) });
  }
  restoreRuntimeState(value: CatalogAbilityRuntimeState | undefined, legacyElapsedMs = 0): void {
    if (value && (!validateCatalogAbilityRuntimeState(value) || value.runId !== (this.ports.runId ?? ''))) throw new Error('Invalid catalog ability continuation');
    // Host/AI/minimap have already restored authoritative clocks. Do not clear or
    // reapply an environment source merely to replace its visual projection.
    for (const graphic of this.graphics.values()) graphic.destroy(); this.graphics.clear();
    for (const echo of this.echoes.values()) echo.destroy(); this.echoes.clear();
    if (this.isGroundDashing() && !value?.effects.some(effect => effect.resolvedParams.familyId === 'dash')) this.ports.setPlayerInput?.(true);
    this.effects = []; this.completedActions = []; this.serial = 0; this.elapsedMs = 0; this.dashCooldownMs = 0;
    this.controlRejections.clear(); this.rejectionGraphic?.clear();
    if (!value) { this.elapsedMs = legacyElapsedMs; return; }
    this.elapsedMs = value.elapsedMs; this.serial = value.serial; this.completedActions = [...value.completedActions];
    this.dashCooldownMs = value.dashCooldownMs; this.effects = structuredClone(value.effects) as CatalogEffectState[];
    for (const row of value.controlRejections ?? []) this.controlRejections.set(row.enemyId, row.remainingMs);
    this.drawControlRejections();
    for (const effect of this.effects) {
      const family = effect.resolvedParams.familyId;
      if (family === 'solidify' && effect.controlActive) this.ports.setEnemyControl?.(effect.targetId!, effect.effectId,
        { movementMultiplier: 0, perceptionMultiplier: 0, suppressAttack: true, breakOnDamage: true });
      for (const stop of effect.stops) this.ports.setEnemyControl?.(stop.enemyId, effect.effectId, { movementMultiplier: 0 });
      if (family === 'slow_zone') for (const id of effect.affectedEnemyIds) this.ports.setEnemyControl?.(id, effect.effectId,
        { movementMultiplier: effect.resolvedParams.paramValue, movementGroup: 'heavy-zone' });
      if (family === 'image_lure') this.ports.setVisualDecoy?.(effect.effectId, effect.position);
      if (family === 'dash') this.ports.setPlayerInput?.(false);
      if (family === 'survey') this.publishSnapshot(effect);
      const echo = restoreBodyEcho(this.scene, effect.echo); if (echo) this.echoes.set(effect.effectId, echo);
      this.draw(effect);
    }
  }
  destroy(): void {
    for (const effect of this.effects) this.remove(effect);
    this.controlRejections.clear(); this.rejectionGraphic?.destroy(); this.rejectionGraphic = null;
    this.effects = []; this.completedActions = []; this.serial = 0; this.elapsedMs = 0; this.dashCooldownMs = 0;
  }

  private updateTripwire(effect: CatalogEffectState): void {
    for (const enemy of this.enemies()) {
      const id = enemy.getId(), position = enemy.getPosition();
      const previous = effect.previousPositions.find(row => row.enemyId === id);
      if (previous && !effect.affectedEnemyIds.includes(id) && (this.ports.isTargetAlive?.(id) ?? true)
        && crossesToolLine(previous.position, position, effect.line!)) {
        effect.affectedEnemyIds.push(id); // Immune crossings still spend this line's one opportunity.
        if (this.ports.canApplyHardControl?.(id) ?? true) {
          this.ports.setEnemyControl?.(id, effect.effectId, { movementMultiplier: 0 });
          effect.stops.push({ enemyId: id, remainingMs: effect.resolvedParams.paramValue });
        } else this.showControlRejection(id);
      }
      if (previous) Object.assign(previous.position, position);
      else effect.previousPositions.push({ enemyId: id, position: { ...position } });
    }
  }
  private updateSlowZone(effect: CatalogEffectState): void {
    const params = effect.resolvedParams;
    for (let i = effect.affectedEnemyIds.length - 1; i >= 0; i--) {
      const id = effect.affectedEnemyIds[i]!, enemy = this.enemies().find(row => row.getId() === id);
      if (!enemy || effect.remainingTime <= 0 || !this.ports.isGroundConnected?.(effect.position, enemy.getPosition(), params.rangePx)) {
        this.ports.clearEnemyControl?.(id, effect.effectId); effect.affectedEnemyIds.splice(i, 1);
      }
    }
    if (effect.remainingTime <= 0) return;
    for (const enemy of this.enemies()) {
      const id = enemy.getId();
      if (!effect.affectedEnemyIds.includes(id) && (this.ports.isTargetAlive?.(id) ?? true)
        && this.ports.isGroundConnected?.(effect.position, enemy.getPosition(), params.rangePx)) {
        this.ports.setEnemyControl?.(id, effect.effectId, { movementMultiplier: params.paramValue, movementGroup: 'heavy-zone' });
        effect.affectedEnemyIds.push(id);
      }
    }
  }
  private pick<T>(targets: readonly T[], range: number, position: (target: T) => Readonly<Vector2>, alive: (target: T) => boolean): T | null {
    return selectNearestVisibleTarget(this.player(), targets, { getPosition: position, isAlive: alive,
      isVisible: target => {
        const point = position(target), origin = this.player(), angle = this.ports.getFacingAngle?.();
        const facing = angle === undefined || Math.abs(Math.atan2(Math.sin(Math.atan2(point.y-origin.y, point.x-origin.x)-angle), Math.cos(Math.atan2(point.y-origin.y, point.x-origin.x)-angle))) <= Math.PI / 2;
        return facing && (this.ports.isTargetVisible?.(point) ?? true);
      }, hasLineOfSight: (from, to) => this.ports.hasTargetLineOfSight?.(from, to) ?? true, maxDistance: range });
  }
  private fail(message: string): false { this.failure = message; return false; }
  private rememberEcho(effect: CatalogEffectState, echo: BodyEcho | null): void {
    if (echo) { this.echoes.set(effect.effectId, echo); effect.echo = echo.exportRuntimeState(); }
  }
  private publishSnapshot(effect: CatalogEffectState): void {
    if (effect.snapshot) this.ports.showAbyssReveal?.(effect.snapshot.enemyPositions, effect.snapshot.nodePositions,
      effect.remainingTime, effect.snapshot.corePositions);
  }
  private remove(effect: CatalogEffectState): void {
    const family = effect.resolvedParams.familyId;
    if (family === 'solidify' && effect.targetId) this.ports.clearEnemyControl?.(effect.targetId, effect.effectId);
    if (family === 'slow_zone') for (const id of effect.affectedEnemyIds) this.ports.clearEnemyControl?.(id, effect.effectId);
    for (const stop of effect.stops) this.ports.clearEnemyControl?.(stop.enemyId, effect.effectId);
    if (family === 'suppress' && effect.targetId) this.ports.clearEnvironmentControl?.(effect.targetId, effect.effectId);
    if (family === 'image_lure') this.ports.setVisualDecoy?.(effect.effectId, null);
    if (family === 'survey') this.ports.showAbyssReveal?.([], [], 0);
    if (family === 'dash') this.ports.setPlayerInput?.(true);
    this.graphics.get(effect.effectId)?.destroy(); this.graphics.delete(effect.effectId);
    this.echoes.get(effect.effectId)?.destroy(); this.echoes.delete(effect.effectId);
  }
  private drawControlRejections(): void {
    this.rejectionGraphic?.clear();
    for (const [id, remaining] of this.controlRejections) {
      const enemy = this.enemies().find(row => row.getId() === id);
      if (!enemy || !(this.ports.isTargetAlive?.(id) ?? true)) { this.controlRejections.delete(id); continue; }
      if (!(this.ports.isTargetVisible?.(enemy.getPosition()) ?? true)) continue;
      const g = this.rejectionGraphic ??= this.scene.add.graphics().setDepth(26);
      drawBracketMarker(g, enemy.getPosition(), GHOST_COLOR, .8 * remaining / 350);
    }
  }
  private draw(effect: CatalogEffectState): void {
    const family = effect.resolvedParams.familyId;
    let g = this.graphics.get(effect.effectId);
    if (!g) { g = this.scene.add.graphics().setDepth(family === 'solidify' ? 26 : 10); this.graphics.set(effect.effectId, g); }
    g.clear();
    const fade = Math.min(1, effect.remainingTime / 300);
    if (family === 'tripwire' && effect.remainingTime > 0) {
      drawSeam(g, effect.line!.pointA, effect.line!.pointB, fade, effect.stops.length ? 1 : 0);
      for (const stop of effect.stops) {
        const enemy = this.enemies().find(row => row.getId() === stop.enemyId);
        if (enemy) drawFootDrag(g, enemy.getPosition(), 1);
      }
    } else if (family === 'slow_zone') drawPressure(g, effect.position, effect.resolvedParams.rangePx, fade, false);
    else if (family === 'suppress') drawHostRestraint(g, effect.position, false, effect.remainingTime, this.elapsedMs);
    else if (family === 'solidify') drawBracketMarker(g, effect.position, CONTAM_GLOW, fade * .75);
    else if (family === 'sound_lure') {
      const radius = 5 + effect.pulseElapsedMs / 1000 * 22;
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        g.fillStyle(GHOST_COLOR, (1 - effect.pulseElapsedMs / 1000) * fade * .5)
          .fillRect(Math.round(effect.position.x + Math.cos(angle) * radius), Math.round(effect.position.y + Math.sin(angle) * radius * .55), 2, 1);
      }
    } else if (family === 'resistance' || family === 'silence') {
      const p = this.player();
      drawBracketMarker(g, { x: p.x, y: p.y + 12 }, family === 'silence' ? GHOST_COLOR : CONTAM_GLOW, fade * .32);
    }
    if (family === 'sound_lure' || family === 'slow_zone') this.ports.drawCatalogToolObject?.(g, effect.definitionId, effect.position, fade);
    this.echoes.get(effect.effectId)?.update(effect.position, 1 - effect.remainingTime / effect.resolvedParams.durationMs,
      this.ports.getGroundVisualDepth?.(effect.position.y) ?? 29);
  }
}
