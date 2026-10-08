// Generated from data/weapons.csv, weapon-qualities.csv, weapon-attack-profiles.csv and weapon-loot.csv. Do not edit.
export type WeaponQuality = "ordinary" | "good" | "fine" | "excellent";
export type WeaponVariant = "standard" | "light" | "resistant";
/** Weight is integer tenths. damage is the mean for legacy summaries; combat uses damageMin/Max. */
export interface WeaponDefinition { readonly id: string; readonly name: string; readonly type: string; readonly profileId: string; readonly quality: WeaponQuality; readonly qualityName: string; readonly qualityRank: number; readonly variant: WeaponVariant; readonly weight: number; readonly damageMin: number; readonly damageMax: number; readonly damage: number; readonly pollutionResistance: number; readonly visualKey: string; readonly offeringCharges: number; readonly maxUses: number; }
export interface WeaponAttackProfile { readonly reachPx: number; readonly arcDeg: number; readonly windupMs: number; readonly activeMs: number; readonly recoveryMs: number; readonly minIntervalMs: number; readonly targetLimit: number; readonly chaosPerTarget: number; readonly noiseWhiffPx: number; readonly noiseHitPx: number; readonly noiseKillPx: number; readonly recoilVisualPx: number; readonly contactHoldMs: number; }
export interface WeaponLootProfile { readonly chancePercent: number; readonly qualityWeights: readonly number[]; readonly variantWeights: readonly number[]; }
export const WEAPON_DATA: Readonly<Record<string, WeaponDefinition>> = {
  "crowbar_plain": {
    "id": "crowbar_plain",
    "name": "普通撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "ordinary",
    "qualityName": "普通",
    "qualityRank": 1,
    "variant": "standard",
    "offeringCharges": 3,
    "maxUses": 60,
    "weight": 30,
    "damageMin": 22,
    "damageMax": 28,
    "damage": 25,
    "pollutionResistance": 0,
    "visualKey": "plain_iron"
  },
  "crowbar_good_standard": {
    "id": "crowbar_good_standard",
    "name": "优良撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "good",
    "qualityName": "优良",
    "qualityRank": 2,
    "variant": "standard",
    "offeringCharges": 3,
    "maxUses": 75,
    "weight": 30,
    "damageMin": 29,
    "damageMax": 35,
    "damage": 32,
    "pollutionResistance": 2,
    "visualKey": "good_standard"
  },
  "crowbar_good_light": {
    "id": "crowbar_good_light",
    "name": "优良轻型撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "good",
    "qualityName": "优良",
    "qualityRank": 2,
    "variant": "light",
    "offeringCharges": 3,
    "maxUses": 75,
    "weight": 27,
    "damageMin": 29,
    "damageMax": 35,
    "damage": 32,
    "pollutionResistance": 0,
    "visualKey": "good_light"
  },
  "crowbar_good_resistant": {
    "id": "crowbar_good_resistant",
    "name": "优良抗污撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "good",
    "qualityName": "优良",
    "qualityRank": 2,
    "variant": "resistant",
    "offeringCharges": 3,
    "maxUses": 75,
    "weight": 33,
    "damageMin": 29,
    "damageMax": 35,
    "damage": 32,
    "pollutionResistance": 4,
    "visualKey": "good_resistant"
  },
  "crowbar_fine_standard": {
    "id": "crowbar_fine_standard",
    "name": "精良撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "fine",
    "qualityName": "精良",
    "qualityRank": 3,
    "variant": "standard",
    "offeringCharges": 3,
    "maxUses": 90,
    "weight": 30,
    "damageMin": 36,
    "damageMax": 44,
    "damage": 40,
    "pollutionResistance": 2,
    "visualKey": "fine_standard"
  },
  "crowbar_fine_light": {
    "id": "crowbar_fine_light",
    "name": "精良轻型撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "fine",
    "qualityName": "精良",
    "qualityRank": 3,
    "variant": "light",
    "offeringCharges": 3,
    "maxUses": 90,
    "weight": 27,
    "damageMin": 36,
    "damageMax": 44,
    "damage": 40,
    "pollutionResistance": 0,
    "visualKey": "fine_light"
  },
  "crowbar_fine_resistant": {
    "id": "crowbar_fine_resistant",
    "name": "精良抗污撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "fine",
    "qualityName": "精良",
    "qualityRank": 3,
    "variant": "resistant",
    "offeringCharges": 3,
    "maxUses": 90,
    "weight": 33,
    "damageMin": 36,
    "damageMax": 44,
    "damage": 40,
    "pollutionResistance": 4,
    "visualKey": "fine_resistant"
  },
  "crowbar_excellent_standard": {
    "id": "crowbar_excellent_standard",
    "name": "卓越撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "excellent",
    "qualityName": "卓越",
    "qualityRank": 4,
    "variant": "standard",
    "offeringCharges": 3,
    "maxUses": 110,
    "weight": 30,
    "damageMin": 46,
    "damageMax": 56,
    "damage": 51,
    "pollutionResistance": 2,
    "visualKey": "excellent_standard"
  },
  "crowbar_excellent_light": {
    "id": "crowbar_excellent_light",
    "name": "卓越轻型撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "excellent",
    "qualityName": "卓越",
    "qualityRank": 4,
    "variant": "light",
    "offeringCharges": 3,
    "maxUses": 110,
    "weight": 27,
    "damageMin": 46,
    "damageMax": 56,
    "damage": 51,
    "pollutionResistance": 0,
    "visualKey": "excellent_light"
  },
  "crowbar_excellent_resistant": {
    "id": "crowbar_excellent_resistant",
    "name": "卓越抗污撬棍",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "excellent",
    "qualityName": "卓越",
    "qualityRank": 4,
    "variant": "resistant",
    "offeringCharges": 3,
    "maxUses": 110,
    "weight": 33,
    "damageMin": 46,
    "damageMax": 56,
    "damage": 51,
    "pollutionResistance": 4,
    "visualKey": "excellent_resistant"
  }
};
export const WEAPON_ATTACK_PROFILES: Readonly<Record<string, WeaponAttackProfile>> = {
  "crowbar": {
    "reachPx": 40,
    "arcDeg": 120,
    "windupMs": 120,
    "activeMs": 60,
    "recoveryMs": 220,
    "minIntervalMs": 500,
    "targetLimit": 2,
    "chaosPerTarget": 5,
    "noiseWhiffPx": 96,
    "noiseHitPx": 160,
    "noiseKillPx": 192,
    "recoilVisualPx": 2,
    "contactHoldMs": 24
  }
};
export const WEAPON_LOOT_PROFILES: Readonly<Record<"safe"|"contested"|"deep", WeaponLootProfile>> = {
  "safe": {
    "chancePercent": 8,
    "qualityWeights": [
      25,
      65,
      10,
      0
    ],
    "variantWeights": [
      50,
      25,
      25
    ]
  },
  "contested": {
    "chancePercent": 18,
    "qualityWeights": [
      10,
      65,
      22,
      3
    ],
    "variantWeights": [
      50,
      25,
      25
    ]
  },
  "deep": {
    "chancePercent": 30,
    "qualityWeights": [
      0,
      50,
      42,
      8
    ],
    "variantWeights": [
      50,
      25,
      25
    ]
  }
};
export const WEAPON_FIRST_DISCOVERY = {"minimumTier":"contested","definitionId":"crowbar_good_standard"} as const;
