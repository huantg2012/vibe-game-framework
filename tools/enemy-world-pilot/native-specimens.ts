/** Offline editorial labels; gameplay data remains in the CSV registries. */
import type { CoverageId } from '../../src/generated/contamination-lexicon-data';
import type { CreaturePhase } from '../../src/entities/form-renderers/d/model-raster';
export const nativeOut = 'docs/qa/artifacts/enemy-native-catalog-2026-10-23';
export const groundSource = 'docs/qa/artifacts/enemy-world-automation-2026-10-23';
export const nativeSubjects = [
  { id: 'organic_remnant', label: '有机残影', type: 'body' },
  { id: 'gas_mass', label: '气团', type: 'volume' },
  { id: 'insect_remnant', label: '虫', type: 'body' },
  { id: 'mammal_remnant', label: '哺乳动物', type: 'body' },
  { id: 'worm_remnant', label: '大号蠕虫', type: 'body' },
  { id: 'stalk_clump', label: '残茎', type: 'body' },
  { id: 'mist_bank', label: '雾团', type: 'volume' },
  { id: 'dust_swarm', label: '尘絮群', type: 'volume' },
  { id: 'sound_echo', label: '余响', type: 'echo' },
  { id: 'fungal_mat', label: '菌毯', type: 'paint' },
  { id: 'oil_film', label: '油膜', type: 'paint' },
  { id: 'ash_veil', label: '灰幕', type: 'paint' },
] as const;
export const coverages: CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
export const facingNames = ['down', 'left', 'up', 'right'] as const;
export const bodyPoses: { phase: CreaturePhase; phase01: number }[] = [
  { phase: 'idle', phase01: 0 },
  ...Array.from({ length: 24 }, (_, i) => ({ phase: 'walk' as const, phase01: i / 24 })),
  ...Array.from({ length: 6 }, (_, i) => ({ phase: 'windup' as const, phase01: i / 5 })),
  { phase: 'strike', phase01: 0 },
  ...Array.from({ length: 6 }, (_, i) => ({ phase: 'recover' as const, phase01: i / 5 })),
];
export const specimenLight = { lights: [{ x: 160, y: 8, z: 100, radius: 500, intensity: 2.4, color: [1, .94, .86] as const, castsShadow: false }] };
