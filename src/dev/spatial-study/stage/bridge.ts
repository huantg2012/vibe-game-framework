import type { WeaponAttackPose } from '@/systems/weapon-swing';
import type { FormAttackPose } from '@/entities/form-renderers/form-renderer';

/** Borrowed until the next simulation tick. No renderer receives mutable game objects. */
export type DeepReadonly<T> = T extends readonly (infer E)[] ? readonly DeepReadonly<E>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export interface PresentationPoint { x: number; y: number }
export interface PresentationBody { x: number; y: number; width: number; height: number }
export interface RiftPresentationEnemy {
  id: string; substrate: string; coverage: string; position: PresentationPoint;
  velocity: PresentationPoint; facing: number; hp: number; visibility: number;
  state: string; activity: { phase: string; progress: number }; attack: FormAttackPose;
}
export interface RiftPresentationPile {
  id: string; position: PresentationPoint; collected: boolean; visibility: number;
  searching: boolean; targeted: boolean; progress: number;
}
export interface RiftPresentationItem {
  id: string; kind: 'weapon' | 'contaminant'; definitionId: string;
  position: PresentationPoint; visibility: number;
}
export interface RiftPresentationEvent {
  sequence: number; elapsedMs: number; kind: 'player-hit' | 'enemy-hit' | 'enemy-death';
  id: string; source: string; amount: number; position: PresentationPoint; direction: PresentationPoint;
}
export interface RiftPresentationFrame {
  sequence: number; elapsedMs: number; ended: boolean;
  player: { position: PresentationPoint; velocity: PresentationPoint; body: PresentationBody;
    facing: number; moving: boolean; hp: number; maxHp: number; invulnerable: boolean;
    attack: WeaponAttackPose; weaponId: string | null; weaponDefinitionId: string | null; durability: number };
  enemies: RiftPresentationEnemy[]; piles: RiftPresentationPile[]; groundItems: RiftPresentationItem[];
  search: { prompt: string | null; targetId: string | null; channelId: string | null; progress: number | null };
  exit: { position: PresentationPoint; radius: number; inRange: boolean };
  /** Bounded, sequence-numbered history. An event is never fabricated from a keypress. */
  events: RiftPresentationEvent[];
}
export type RiftPresentationView = DeepReadonly<RiftPresentationFrame>;
/** Same logical 960×640 HUD coordinates, independent of canvas CSS scaling. */
export type RiftWorldProjector = (world: Readonly<PresentationPoint>, out: PresentationPoint) => void;

export function createPresentationFrame(): RiftPresentationFrame {
  return { sequence: 0, elapsedMs: 0, ended: false,
    player: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, body: { x: 0, y: 0, width: 0, height: 0 },
      facing: 0, moving: false, hp: 0, maxHp: 0, invulnerable: false,
      attack: { phase: 'idle', elapsedMs: 0, facing: 0, windupMs: 0, activeMs: 0, recoveryMs: 0,
        contactHoldMs: 0, contactRemainingMs: 0, contactElapsedMs: 0 },
      weaponId: null, weaponDefinitionId: null, durability: 0 },
    enemies: [], piles: [], groundItems: [], search: { prompt: null, targetId: null, channelId: null, progress: null },
    exit: { position: { x: 0, y: 0 }, radius: 0, inRange: false }, events: [] };
}
