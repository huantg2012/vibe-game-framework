/**
 * 供奉台 H / I 装填光点档。
 *
 * 外观不显槽数：基础 3 槽、改造后 4 槽，世界内只读得出空 / 弱 / 中 / 满。
 * 3 与 4 个残渣同一档。生产默认 = 卡 I 环（DEC-115）；对照课仍可切 H。
 */
export type OfferingChargeTier = 0 | 1 | 2 | 3;

export const OFFERING_CHARGE_TIER_COUNT = 4;
export const OFFERING_CHARGE_VARIANTS = ['h', 'i'] as const;

export function offeringChargeTier(slottedCount: number): OfferingChargeTier {
  if (slottedCount <= 0) return 0;
  return Math.min(3, slottedCount) as 1 | 2 | 3;
}

export function offeringChargeAnimKey(variant: string, tier: OfferingChargeTier): string {
  return `offering-${variant}-c${tier}`;
}
