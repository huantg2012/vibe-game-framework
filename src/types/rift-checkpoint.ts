/** A complete simulation state has one revision with the containing base and
 * inventory record. Domain owners validate `state` before it touches a scene. */
export interface RiftCheckpoint<State = unknown> {
  version: 1;
  runId: string;
  sequence: number;
  identity: {
    worldId: 'suspended-sea' | 'procedural-rift';
    layoutId: 'sea-open-channel' | 'sea-folded-ridge' | 'procedural-rift';
    recipeId?: string;
    catalogVersion?: 'legacy-v1' | 'contaminant-v1';
    lootAlgorithmVersion?: 1;
    combatRulesVersion?: 1 | 2;
    seed: number;
    signature: string;
  };
  elapsedMs: number;
  state: State;
}

export function validRiftCheckpoint(value: unknown): value is RiftCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RiftCheckpoint>;
  const identity = data.identity;
  return data.version === 1 && typeof data.runId === 'string' && data.runId.length > 0
    && Number.isSafeInteger(data.sequence) && data.sequence! >= 0
    && Number.isFinite(data.elapsedMs) && data.elapsedMs! >= 0
    && !!identity && (identity.worldId === 'suspended-sea' || identity.worldId === 'procedural-rift')
    && (identity.worldId === 'procedural-rift' ? identity.layoutId === 'procedural-rift' : ['sea-open-channel', 'sea-folded-ridge'].includes(identity.layoutId))
    && Number.isSafeInteger(identity.seed) && identity.seed >= 0
    && (identity.recipeId === undefined || typeof identity.recipeId === 'string')
    && (identity.catalogVersion === undefined || ['legacy-v1','contaminant-v1'].includes(identity.catalogVersion))
    && (identity.lootAlgorithmVersion === undefined || identity.lootAlgorithmVersion === 1)
    && (identity.combatRulesVersion === undefined || identity.combatRulesVersion === 1 || identity.combatRulesVersion === 2)
    && typeof identity.signature === 'string' && identity.signature.length > 0
    && data.state !== null && typeof data.state === 'object';
}

/** Detect accidental storage corruption. This is not an anti-cheat signature. */
export function checkpointChecksum(value: unknown): string {
  const bytes = JSON.stringify(value);
  if (bytes === undefined) throw new Error('Checkpoint is not serializable');
  let hash = 2166136261;
  for (let index = 0; index < bytes.length; index++) {
    hash ^= bytes.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Written atomically with beginRun, before any entry animation or scene creation. */
export interface RiftDepartureIntent {
  version: 1;
  runId: string;
  identity: RiftCheckpoint['identity'];
  conditions: { modifiers: import('@/managers/game-state').SortieModifiers; cycle: number };
}
export function validRiftDeparture(value: unknown): value is RiftDepartureIntent {
  if (!value || typeof value !== 'object') return false;
  const item = value as RiftDepartureIntent;
  const mods = item.conditions?.modifiers;
  return validRiftCheckpoint({ ...item, sequence: 0, elapsedMs: 0, state: {} })
    && Number.isSafeInteger(item.conditions?.cycle) && item.conditions.cycle >= 0
    && !!mods && Object.values(mods).every(Number.isFinite)
    && Number.isFinite(mods.chaosRateModifier) && Number.isFinite(mods.kindlingValueModifier)
    && Number.isFinite(mods.startingChaos);
}
