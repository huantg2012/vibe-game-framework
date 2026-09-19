import { GAME_CONSTANTS } from '@/config/constants';
import { validateEnemyRuntimeState, type Enemy, type EnemyRuntimeState } from '@/entities/enemy-factory';
import type { EnemyAIState, EnemyAIRuntimeState } from '@/types/ai-types';
import { AIState, type Vector2 } from '@/types/game-types';
import { copyRuntimeVector, runtimeFacing, runtimeInteger, runtimeNumber, runtimeRecord, runtimeVector } from '@/systems/ai/runtime-validation';

export interface AIRuntimeRecoveryOptions {
  readonly runSeed: number;
  /** Exact world/content signature supplied by the suspended sea run coordinator. */
  readonly signature: string;
}

export interface AIRuntimeEnemy {
  readonly id: string;
  readonly entity: EnemyRuntimeState;
  readonly state: EnemyAIRuntimeState;
  readonly attackInterruptRevision: number;
  readonly controlProtectionRemainingMs?: number;
}

export interface AIRuntimeState {
  readonly version: 1;
  readonly signature: string;
  readonly rosterSignature: string;
  readonly runSeed: number;
  readonly randomState: number;
  readonly playerPos: Vector2;
  readonly previousPlayerPos: Vector2;
  readonly playerVel: Vector2;
  readonly playerIsMoving: boolean;
  readonly hasPreviousPlayerPos: boolean;
  readonly physicsElapsedMs: number;
  readonly hearingRangeMult: number;
  readonly hearingSuppressed: boolean;
  readonly playerActionSilenced?: boolean;
  readonly enemies: readonly AIRuntimeEnemy[];
  readonly visualDecoys?: readonly (readonly [string, Vector2])[];
}

const numberFields = [
  'facingAngle', 'detection', 'losGraceMs', 'perceptionAccumMs', 'suspicionTimerMs', 'searchTimerMs',
  'waypointPauseMs', 'suspiciousTurnHoldMs', 'searchHoldMs', 'scanPhaseMs', 'scanBaseAngle',
  'repathCooldownMs', 'pathRequestAgeMs', 'preferPathMs', 'stuckMs', 'alertEmitCooldownMs', 'detectionFillRateMult',
] as const satisfies readonly (keyof EnemyAIState)[];
const integerFields = ['scanIndex', 'searchPointCount', 'searchIndex', 'patrolIndex', 'pathLength', 'pathCursor', 'pathFailCount'] as const;
const booleanFields = ['hearingJitterLocked', 'pathRequestPending', 'engaged', 'alertEpisodeActive', 'pendingDamage',
  'pendingNoiseIsLure', 'investigatingLure', 'movementDirLocked', 'targetingDecoy', 'escalationSuppressed'] as const;
const vectorFields = ['position', 'velocity', 'pathRequestTarget', 'pathTargetAtRequest', 'pendingDamagePos', 'pendingNoisePos', 'lockedDir'] as const;
const nullableVectors = ['lastSeenPlayerPos', 'lastSeenPlayerVel', 'investigatePos'] as const;

function validEnemyAIState(value: unknown): value is EnemyAIRuntimeState {
  if (!runtimeRecord(value) || !Object.values(AIState).includes(value.state as AIState)
    || !runtimeFacing(value.facing4) || (value.role !== 'infiltrator' && value.role !== 'rewriter')
    || !['static', 'pingpong', 'loop'].includes(value.patrolMode as string)
    || (value.patrolDir !== 1 && value.patrolDir !== -1)
    || !['none', 'suspicious', 'alert', 'chase'].includes(value.lastEmittedLevel as string)
    || (value.pendingNoiseLevel !== null && value.pendingNoiseLevel !== 'suspicious' && value.pendingNoiseLevel !== 'alert')) return false;
  if (!numberFields.every(key => runtimeNumber(value[key])) || !integerFields.every(key => runtimeInteger(value[key]))
    || !booleanFields.every(key => typeof value[key] === 'boolean') || !vectorFields.every(key => runtimeVector(value[key]))
    || !nullableVectors.every(key => value[key] === null || runtimeVector(value[key]))) return false;
  if (!runtimeNumber(value.detection, 0, 1) || !runtimeNumber(value.detectionFillRateMult, 0)
    || !runtimeInteger(value.searchPointCount, 0, 3) || !runtimeInteger(value.searchIndex, 0, 4)
    || !runtimeInteger(value.pathLength, 0, GAME_CONSTANTS.AI.MAX_PATH_POINTS)
    // The stuck watchdog may advance one cursor past the last point before behavior clears it.
    || !runtimeInteger(value.pathCursor, 0, GAME_CONSTANTS.AI.MAX_PATH_POINTS + 1)
    || !Array.isArray(value.searchPoints) || value.searchPoints.length !== 3 || !value.searchPoints.every(runtimeVector)
    || !Array.isArray(value.dynamicPath) || value.dynamicPath.length !== GAME_CONSTANTS.AI.MAX_PATH_POINTS
    || !value.dynamicPath.every(runtimeVector)) return false;
  if (value.currentPatrolLegIndex !== null && !runtimeInteger(value.currentPatrolLegIndex)) return false;
  const binding = value.pathBinding;
  return binding === null ? value.pathLength === 0 && value.pathCursor === 0
    : runtimeRecord(binding) && (binding.kind === 'dynamic'
      || (binding.kind === 'patrol' && runtimeInteger(binding.index)));
}

export function validateAIRuntimeState(value: unknown): value is AIRuntimeState {
  if (!runtimeRecord(value) || value.version !== 1 || typeof value.signature !== 'string' || !value.signature
    || typeof value.rosterSignature !== 'string' || !value.rosterSignature || !runtimeInteger(value.runSeed, 0, 0xffffffff)
    || !runtimeInteger(value.randomState, 0, 0xffffffff) || !runtimeVector(value.playerPos)
    || !runtimeVector(value.previousPlayerPos) || !runtimeVector(value.playerVel)
    || typeof value.playerIsMoving !== 'boolean' || typeof value.hasPreviousPlayerPos !== 'boolean'
    || !runtimeNumber(value.physicsElapsedMs, 0) || !runtimeNumber(value.hearingRangeMult, 0)
    || typeof value.hearingSuppressed !== 'boolean'
    || (value.playerActionSilenced !== undefined && typeof value.playerActionSilenced !== 'boolean') || !Array.isArray(value.enemies) || value.enemies.length > 4096) return false;
  if (value.visualDecoys !== undefined && (!Array.isArray(value.visualDecoys) || value.visualDecoys.length > 1024 || !value.visualDecoys.every(row => Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && runtimeVector(row[1])) || new Set(value.visualDecoys.map(row => row[0])).size !== value.visualDecoys.length)) return false;
  const ids = new Set<string>();
  for (const enemy of value.enemies) {
    if (!runtimeRecord(enemy) || typeof enemy.id !== 'string' || !enemy.id || ids.has(enemy.id)
      || !validateEnemyRuntimeState(enemy.entity) || enemy.entity.id !== enemy.id
      || !validEnemyAIState(enemy.state) || !runtimeInteger(enemy.attackInterruptRevision)
      || (enemy.controlProtectionRemainingMs !== undefined && !runtimeNumber(enemy.controlProtectionRemainingMs, 0, 2000))) return false;
    ids.add(enemy.id);
  }
  return true;
}

export function exportEnemyAIState(enemy: Enemy): EnemyAIRuntimeState {
  const ai = enemy.ai;
  const values: Record<string, unknown> = {};
  for (const key of numberFields) values[key] = ai[key];
  for (const key of integerFields) values[key] = ai[key];
  for (const key of booleanFields) values[key] = ai[key] === true;
  for (const key of vectorFields) values[key] = copyRuntimeVector(ai[key]);
  for (const key of nullableVectors) values[key] = ai[key] ? copyRuntimeVector(ai[key]!) : null;
  const pathIndex = ai.pathPoints ? ai.patrolPaths.indexOf(ai.pathPoints) : -1;
  const legIndex = ai.currentPatrolLeg ? ai.patrolPaths.indexOf(ai.currentPatrolLeg) : -1;
  if ((ai.pathPoints && ai.pathPoints !== ai.dynamicPath && pathIndex < 0) || (ai.currentPatrolLeg && legIndex < 0)) {
    throw new Error(`Unknown AI path alias: ${enemy.id}`);
  }
  Object.assign(values, { state: ai.state, facing4: ai.facing4, role: ai.role, patrolMode: ai.patrolMode,
    patrolDir: ai.patrolDir, lastEmittedLevel: ai.lastEmittedLevel, pendingNoiseLevel: ai.pendingNoiseLevel,
    searchPoints: ai.searchPoints.map(copyRuntimeVector), dynamicPath: ai.dynamicPath.map(copyRuntimeVector),
    currentPatrolLegIndex: ai.currentPatrolLeg ? legIndex : null,
    pathBinding: ai.pathPoints === null ? null : ai.pathPoints === ai.dynamicPath ? { kind: 'dynamic' } : { kind: 'patrol', index: pathIndex } });
  if (!validEnemyAIState(values)) throw new Error(`Invalid live AI state: ${enemy.id}`);
  return values;
}

/** Authored, immutable bindings; validation does not require a live Phaser enemy. */
export interface EnemyAIRuntimeBindings {
  readonly role: EnemyAIState['role'];
  readonly patrolMode: EnemyAIState['patrolMode'];
  readonly patrolWaypoints: readonly Readonly<Vector2>[];
  readonly patrolPaths: readonly (readonly Readonly<Vector2>[] | null)[];
}

/** Checks every reference before the caller mutates any member of its roster. */
export function validateEnemyAIBindings(ai: EnemyAIRuntimeBindings, state: EnemyAIRuntimeState): boolean {
  if (state.role !== ai.role || state.patrolMode !== ai.patrolMode || state.patrolIndex >= ai.patrolWaypoints.length) return false;
  const leg = state.currentPatrolLegIndex;
  if (leg !== null && !ai.patrolPaths[leg]) return false;
  const binding = state.pathBinding;
  return binding?.kind !== 'patrol' || (!!ai.patrolPaths[binding.index] && state.pathLength === ai.patrolPaths[binding.index]!.length);
}

/** No transitionTo, path generation, random draws, perception ticks, or event publication. */
export function restoreEnemyAIState(enemy: Enemy, state: EnemyAIRuntimeState): void {
  const ai = enemy.ai;
  for (const key of numberFields) ai[key] = state[key];
  for (const key of integerFields) ai[key] = state[key];
  for (const key of booleanFields) ai[key] = state[key] === true;
  for (const key of vectorFields) Object.assign(ai[key], state[key]);
  for (const key of nullableVectors) ai[key] = state[key] ? copyRuntimeVector(state[key]!) : null;
  for (let index = 0; index < ai.searchPoints.length; index++) Object.assign(ai.searchPoints[index]!, state.searchPoints[index]);
  for (let index = 0; index < ai.dynamicPath.length; index++) Object.assign(ai.dynamicPath[index]!, state.dynamicPath[index]);
  ai.state = state.state; ai.facing4 = state.facing4; ai.role = state.role; ai.patrolMode = state.patrolMode;
  ai.patrolDir = state.patrolDir; ai.lastEmittedLevel = state.lastEmittedLevel; ai.pendingNoiseLevel = state.pendingNoiseLevel;
  ai.currentPatrolLeg = state.currentPatrolLegIndex === null ? null : ai.patrolPaths[state.currentPatrolLegIndex]!;
  ai.pathPoints = state.pathBinding === null ? null : state.pathBinding.kind === 'dynamic' ? ai.dynamicPath : ai.patrolPaths[state.pathBinding.index]!;
}
