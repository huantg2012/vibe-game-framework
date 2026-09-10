/** One-way read migration. Preserve instance references/ownership; never grant a new item. */
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { CONTAMINANT_MIGRATIONS } from '@/generated/contaminant-economy-data';
import { getContaminantMaxUses, getContaminantQuality } from './contaminant-quality';
import type { Contaminant } from '@/types/game-types';

export function migrateContaminant(item: Contaminant): Contaminant {
  const migration = CONTAMINANT_MIGRATIONS[item.type];
  if (!migration || (migration.target === item.type && item.quality !== undefined)) return { ...item };
  const target = migration.target;
  const quality = getContaminantQuality(item);
  const changedFamily = target !== item.type;
  // A canonical item with explicit quality already uses the current capacity table.
  const convertQuota = !!migration && (changedFamily || item.quality === undefined);
  const migrated: Contaminant = { ...item, type: target, quality,
    rarity: changedFamily ? CONTAMINANT_DATA[target].rarity : item.rarity };
  if (convertQuota && item.stage === 'tool' && item.usesRemaining > 0) {
    const scaled = Math.floor(item.usesRemaining * getContaminantMaxUses(migrated) / migration.legacyUses);
    // Preserve a still-usable final charge. Legacy bonus ratios above 100% remain above 100%.
    migrated.usesRemaining = Math.max(1, scaled);
  }
  return migrated;
}
