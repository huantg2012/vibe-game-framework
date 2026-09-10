// AUTO-GENERATED from contaminant-migrations.csv and contaminant-loot.csv — DO NOT EDIT
import type { ContaminantType, ContaminantQuality } from '@/types/game-types';
import type { KindlingTier } from '@/types/map-types';
export const CONTAMINANT_MIGRATIONS: Readonly<Partial<Record<ContaminantType, { readonly target: ContaminantType; readonly legacyUses: number }>>> = {
  "ruminate": {
    "target": "siphon",
    "legacyUses": 4
  },
  "resonate": {
    "target": "stitch",
    "legacyUses": 2
  },
  "overwrite": {
    "target": "mirror",
    "legacyUses": 2
  },
  "erode": {
    "target": "compress",
    "legacyUses": 2
  },
  "echo": {
    "target": "kindle",
    "legacyUses": 3
  },
  "delay": {
    "target": "delay",
    "legacyUses": 3
  },
  "siphon": {
    "target": "siphon",
    "legacyUses": 3
  },
  "stitch": {
    "target": "stitch",
    "legacyUses": 4
  },
  "compress": {
    "target": "compress",
    "legacyUses": 3
  },
  "abyss": {
    "target": "abyss",
    "legacyUses": 2
  }
};
export const CONTAMINANT_LOOT_PROFILES: Readonly<Record<KindlingTier, Readonly<Record<ContaminantQuality, number>>>> = {
  "safe": {
    "ordinary": 60,
    "good": 25,
    "fine": 12,
    "excellent": 3
  },
  "contested": {
    "ordinary": 40,
    "good": 35,
    "fine": 20,
    "excellent": 5
  },
  "deep": {
    "ordinary": 20,
    "good": 35,
    "fine": 32,
    "excellent": 13
  }
};
