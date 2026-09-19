/** Only this public projection crosses from private inventory identity into UI/art. */
import { projectItemForPlayer, type PlayerContaminantView } from '@/systems/contaminant-catalog';
import { catalogIconUrl, catalogWorldPixels, type CatalogIconRef } from '@/art/contaminant-catalog-icons';
import { contaminantIconUrl, contaminantWorldPixels } from '@/art/contaminant-icons';
import { getContaminantQuality } from '@/systems/contaminant-quality';
import type { Contaminant, LegacyContaminantType } from '@/types/game-types';

export function publicCatalogIconRef(view: PlayerContaminantView): CatalogIconRef | null {
  if (view.iconRef.kind === 'legacy') return null;
  return view.iconRef.kind === 'appearance'
    ? { kind: 'shell', appearanceId: view.iconRef.id }
    : { kind: 'item', definitionId: view.iconRef.id,
      ...('appearanceId' in view.iconRef && typeof view.iconRef.appearanceId === 'string' ? { appearanceId: view.iconRef.appearanceId } : {}) };
}
export function itemIconUrl(c: Contaminant): string {
  const view = projectItemForPlayer(c), ref = publicCatalogIconRef(view);
  return ref ? catalogIconUrl(ref) : contaminantIconUrl(view.iconRef.id as LegacyContaminantType, getContaminantQuality(c));
}
export function itemWorldPixels(c: Contaminant) {
  const view = projectItemForPlayer(c), ref = publicCatalogIconRef(view);
  return ref ? catalogWorldPixels(ref) : contaminantWorldPixels(view.iconRef.id as LegacyContaminantType, getContaminantQuality(c));
}
export function itemStageLabel(c: Contaminant): string {
  const view = projectItemForPlayer(c);
  return view.identification === 'unidentified' ? '未鉴定' : view.inert ? '已鉴定 · 无裂隙能力'
    : c.stage === 'tool' ? '已成熟' : c.stage === 'broken' ? '已耗尽' : '未成熟';
}
