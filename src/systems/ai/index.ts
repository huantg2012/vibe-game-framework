/**
 * Public surface of the AI system. Scenes and other systems import from here so the
 * internal split between the FSM, the behaviours and the perception loop stays internal.
 */

export { AISystem, ENEMY_DEPTH } from '@/systems/ai/ai-system';
export type { AIStats, AISystemAPI, CueListener, VisibilityProvider } from '@/systems/ai/ai-system';
export type { AICueId, AlertLevel, EnemyView } from '@/types/ai-types';
