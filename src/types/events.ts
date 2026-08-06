/**
 * Game event type definitions.
 * All inter-system communication goes through these typed events.
 */

export enum GameEvent {
  // Chaos system
  CHAOS_CHANGED = 'chaos:changed',
  CHAOS_THRESHOLD_REACHED = 'chaos:threshold-reached',

  // Combat
  PLAYER_DAMAGED = 'player:damaged',
  ENEMY_DAMAGED = 'enemy:damaged',
  ENEMY_KILLED = 'enemy:killed',

  // AI / Perception
  ENEMY_ALERT = 'enemy:alert',
  ENEMY_LOST_PLAYER = 'enemy:lost-player',

  // Loot / Items
  KINDLING_COLLECTED = 'kindling:collected',
  ITEM_COLLECTED = 'item:collected',
  ITEM_USED = 'item:used',

  // Rift flow
  RIFT_ENTERED = 'rift:entered',
  RIFT_EXIT_REACHED = 'rift:exit-reached',
  RIFT_EXITED = 'rift:exited',

  // Purification point
  IMPACT_STARTED = 'impact:started',
  IMPACT_RESOLVED = 'impact:resolved',
  MODULE_DAMAGED = 'module:damaged',
  ALLOCATION_CONFIRMED = 'allocation:confirmed',

  // Player state
  PLAYER_DIED = 'player:died',
  PLAYER_HEALTH_CHANGED = 'player:health-changed',

  // Game flow
  GAME_SAVED = 'game:saved',
  GAME_LOADED = 'game:loaded',
}

/**
 * Event payload type map.
 * Ensures type safety when emitting/listening to events.
 */
export interface EventPayloads {
  /** Emitted when chaos value changes by >= EMIT_STEP from the last emission. */
  [GameEvent.CHAOS_CHANGED]: { value: number; delta: number; max: number; rate: number };
  /** Emitted once per level as chaos crosses 50 (1), 75 (2), 100 (3). */
  [GameEvent.CHAOS_THRESHOLD_REACHED]: { level: 1 | 2 | 3 };
  /** `source` is the enemyId that dealt the damage (e.g. 'ENM_INF_01'), not a category. */
  [GameEvent.PLAYER_DAMAGED]: { amount: number; source: string };
  /**
   * `source` distinguishes a player hit from any future damage source. The chaos system
   * treats this event as "the player landed a hit" and bills for it, so environmental or
   * enemy-on-enemy damage arriving later must be filterable - otherwise chaos would be
   * charged silently and the cause would be near impossible to find from the symptom.
   * Slice 1 has one source and always fills `'player'`.
   */
  [GameEvent.ENEMY_DAMAGED]: { enemyId: string; amount: number; source?: 'player' };
  [GameEvent.ENEMY_KILLED]: { enemyId: string; position: { x: number; y: number } };
  [GameEvent.ENEMY_ALERT]: { enemyId: string; alertLevel: 'suspicious' | 'alert' | 'chase' };
  [GameEvent.ENEMY_LOST_PLAYER]: { enemyId: string };
  [GameEvent.KINDLING_COLLECTED]: { amount: number; total: number };
  [GameEvent.ITEM_COLLECTED]: { itemId: string; itemType: string };
  [GameEvent.ITEM_USED]: { itemId: string; itemType: string };
  [GameEvent.RIFT_ENTERED]: { cycle: number };
  [GameEvent.RIFT_EXIT_REACHED]: Record<string, never>;
  [GameEvent.RIFT_EXITED]: { kindlingGained: number; survived: boolean };
  [GameEvent.IMPACT_STARTED]: { intensity: number };
  [GameEvent.IMPACT_RESOLVED]: { moduleDamage: Record<string, number> };
  [GameEvent.MODULE_DAMAGED]: { moduleId: string; newHealth: number };
  [GameEvent.ALLOCATION_CONFIRMED]: { allocations: Record<string, number> };
  /** Slice 1 has exactly one cause: 'enemy_attack'. Emitted at most once per run. */
  [GameEvent.PLAYER_DIED]: { cause: string };
  [GameEvent.PLAYER_HEALTH_CHANGED]: { current: number; max: number };
  [GameEvent.GAME_SAVED]: { timestamp: number };
  [GameEvent.GAME_LOADED]: { cycle: number };
}
