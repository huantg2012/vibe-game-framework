/** Catalog identity is private state. UI receives projectItemForPlayer, never this registry. */
import { CATALOG_APPEARANCES, CATALOG_ITEMS, CATALOG_OFFERINGS, CATALOG_QUALITIES, INVENTORY_RULES,
  type CatalogAbilityFamily, type CatalogItemDefinition } from '@/generated/contaminant-catalog-data';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { GAME_CONSTANTS } from '@/config/constants';
import type { CatalogIdentity, Contaminant, ContaminantQuality } from '@/types/game-types';
export type { CatalogAbilityFamily } from '@/generated/contaminant-catalog-data';
export const CURRENT_CATALOG_VERSION = 'contaminant-v1' as const;
export const LEGACY_CATALOG_VERSION = 'legacy-v1' as const;
export type CatalogVersion = typeof CURRENT_CATALOG_VERSION | typeof LEGACY_CATALOG_VERSION;
export interface CatalogRuntimeAbility {
  readonly familyId: CatalogAbilityFamily;
  readonly slot: 'active' | 'passive';
  readonly scope: 'timed' | 'run' | 'instant' | 'snapshot';
  readonly paramKey: string;
  readonly paramValue: number;
  readonly durationMs: number;
  readonly rangePx: number;
  readonly baseUses: number;
  readonly definitionId: string;
  readonly catalogVersion: typeof CURRENT_CATALOG_VERSION;
}
export function isCatalogContaminant(c: Pick<Contaminant, 'type'>): c is Contaminant & { type:'catalog'; catalog:CatalogIdentity } {
  return c.type === 'catalog';
}
export function getCatalogDefinition(c: Pick<Contaminant,'type'|'catalog'>): CatalogItemDefinition | null {
  if(c.type!=='catalog'||c.catalog?.catalogVersion!==CURRENT_CATALOG_VERSION) return null;
  return Object.prototype.hasOwnProperty.call(CATALOG_ITEMS,c.catalog.definitionId)?CATALOG_ITEMS[c.catalog.definitionId]!:null;
}
export function getCatalogItemWeight(c:Pick<Contaminant,'type'|'catalog'>):number {
  const def=getCatalogDefinition(c);if(!def||!c.catalog)throw Error('Unknown catalog weight');
  return c.catalog.identification==='unidentified'?CATALOG_APPEARANCES[c.catalog.appearanceId]!.weight:def.weight;
}
export function getCatalogAbilityByDefinition(definitionId: string, catalogVersion: string): CatalogRuntimeAbility | null {
  const def = catalogVersion===CURRENT_CATALOG_VERSION && Object.prototype.hasOwnProperty.call(CATALOG_ITEMS,definitionId) ? CATALOG_ITEMS[definitionId] : undefined;
  if(!def?.familyId || !def.slot || !def.scope) return null;
  return { familyId:def.familyId,slot:def.slot,scope:def.scope,paramKey:def.paramKey,paramValue:def.paramValue,
    durationMs:def.durationMs,rangePx:def.rangePx,baseUses:def.baseUses,definitionId:def.id,catalogVersion:CURRENT_CATALOG_VERSION };
}
export function validateResolvedCatalogAbility(value: unknown): value is CatalogRuntimeAbility {
  if(!value||typeof value!=='object')return false;
  const r=value as CatalogRuntimeAbility;
  if(typeof r.definitionId!=='string'||typeof r.catalogVersion!=='string')return false;
  const expected=getCatalogAbilityByDefinition(r.definitionId,r.catalogVersion);
  return !!expected && Object.keys(r).length===Object.keys(expected).length && Object.entries(expected).every(([key,v])=>r[key as keyof CatalogRuntimeAbility]===v);
}
export function getCatalogRuntimeAbility(c: Contaminant): CatalogRuntimeAbility | null {
  return c.type==='catalog' && c.catalog?.identification==='revealed' && c.stage==='tool'
    ? getCatalogAbilityByDefinition(c.catalog.definitionId,c.catalog.catalogVersion) : null;
}
export function getContaminantSlot(c: Contaminant): 'active'|'passive'|null {
  if(c.type==='catalog')return getCatalogRuntimeAbility(c)?.slot ?? null;
  return CONTAMINANT_DATA[c.type]?.toolType ?? null;
}
export function getContaminantOffering(c: Contaminant): { reduction:number; chargeMultiplier:number; summary:string; description:string } {
  if(c.type==='catalog'){
    const profile=c.catalog && CATALOG_OFFERINGS[c.catalog.offeringProfileId];
    if(!profile)throw Error('Unknown catalog offering profile');
    return { reduction:profile.effect==='impact_damage_reduction'?profile.amount:0,chargeMultiplier:profile.chargeMultiplier,summary:profile.description,description:profile.description };
  }
  const def=CONTAMINANT_DATA[c.type];
  return {reduction:def.defenseReduction,chargeMultiplier:def.defenseChargeMult,summary:def.summaryDefense,description:def.descriptionDefense};
}
export function getCatalogMaxUses(c: Pick<Contaminant,'type'|'catalog'|'quality'>): number {
  const def=getCatalogDefinition(c);
  if(!def)throw Error('Unknown catalog item');
  if(def.class==='inert')return 0;
  const quality=c.quality && CATALOG_QUALITIES[c.quality];
  if(!quality)throw Error('Missing catalog quality');
  return def.baseUses+quality.extraUses;
}
export function getContaminantLifecycleRules(c: Contaminant): { offeringCharges:number;maxUses:number;chargeMultiplier:number } {
  if(c.type!=='catalog')throw Error('Legacy max uses are owned by contaminant-quality');
  return {offeringCharges:GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD,maxUses:getCatalogMaxUses(c),chargeMultiplier:getContaminantOffering(c).chargeMultiplier};
}
export function createCatalogContaminant(input: {id:string;definitionId:string;appearanceId:string;offeringProfileId:string;quality:ContaminantQuality;acquiredOrdinal:number}): Contaminant {
  if(!Object.prototype.hasOwnProperty.call(CATALOG_ITEMS,input.definitionId)||!CATALOG_APPEARANCES[input.appearanceId]||!CATALOG_OFFERINGS[input.offeringProfileId]||!CATALOG_QUALITIES[input.quality])throw Error('Unknown catalog identity');
  if(!input.id||!Number.isSafeInteger(input.acquiredOrdinal)||input.acquiredOrdinal<0)throw Error('Invalid catalog identity');
  return {id:input.id,type:'catalog',rarity:'common',quality:input.quality,stage:'defense',impactCharges:0,usesRemaining:0,
    catalog:{catalogVersion:CURRENT_CATALOG_VERSION,definitionId:input.definitionId,appearanceId:input.appearanceId,offeringProfileId:input.offeringProfileId,acquiredOrdinal:input.acquiredOrdinal,identification:'unidentified'}};
}
export function validateCatalogContaminant(c: Contaminant): boolean {
  const def=getCatalogDefinition(c),identity=c.catalog;
  if(!def||!identity||!Object.prototype.hasOwnProperty.call(CATALOG_APPEARANCES,identity.appearanceId)||!Object.prototype.hasOwnProperty.call(CATALOG_OFFERINGS,identity.offeringProfileId)||!c.quality||!Object.prototype.hasOwnProperty.call(CATALOG_QUALITIES,c.quality)
    ||!Number.isSafeInteger(identity.acquiredOrdinal)||identity.acquiredOrdinal<0||!['unidentified','revealed'].includes(identity.identification)
    ||!Number.isFinite(c.impactCharges)||c.impactCharges<0||!Number.isSafeInteger(c.usesRemaining)||c.usesRemaining<0||c.usesRemaining>getCatalogMaxUses(c))return false;
  if(identity.identification==='unidentified')return c.stage==='defense'&&c.usesRemaining===0&&identity.revealedAt===undefined&&identity.revealReceiptId===undefined&&identity.runBinding===undefined;
  if(!Number.isFinite(identity.revealedAt)||identity.revealedAt!<0||typeof identity.revealReceiptId!=='string'||!identity.revealReceiptId)return false;
  if(def.class==='inert')return c.stage==='inert'&&c.usesRemaining===0&&!identity.runBinding;
  if(c.stage!=='tool')return false;
  const binding=identity.runBinding;
  if(binding && (binding.consumed!==true||typeof binding.runId!=='string'||!binding.runId||!['sight','capacity'].includes(binding.familyId)||binding.familyId!==def.familyId||binding.benefit!==def.paramValue))return false;
  return c.usesRemaining>0||!!binding;
}
export function getBoundCatalogPassive(c:Contaminant,runId:string): CatalogIdentity['runBinding']|null {
  if(c.type!=='catalog'||c.stage!=='tool'||c.catalog?.identification!=='revealed')return null;
  return c.catalog.runBinding?.runId===runId?c.catalog.runBinding:null;
}
/** Safe metadata: it is deliberately impossible to recover a hidden definition from this object. */
export interface PlayerContaminantView {
  readonly instanceId:string;
  readonly identification:'unidentified'|'revealed'|'legacy_known';
  readonly name:string;
  readonly iconRef:{kind:'appearance'|'item'|'legacy';id:string;appearanceId?:string};
  readonly qualityId:ContaminantQuality;
  readonly weight:number;
  readonly summary:string;
  readonly description:string;
  readonly offeringSummary:string;
  readonly offeringCharges:number;
  readonly impactCharges:number;
  readonly acquiredOrdinal:number;
  readonly slot:'active'|'passive'|null;
  readonly usesRemaining?:number;
  readonly maxUses?:number;
  readonly inert:boolean;
}
export function projectItemForPlayer(c:Contaminant):PlayerContaminantView {
  const qualityId=c.quality??({common:'ordinary',fine:'good',rare:'fine'} as const)[c.rarity];
  const offering=getContaminantOffering(c);
  const shared={instanceId:c.id,qualityId,offeringSummary:offering.summary,offeringCharges:GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD,impactCharges:c.impactCharges};
  if(c.type==='catalog'){
    const def=getCatalogDefinition(c);if(!def||!c.catalog)throw Error('Invalid catalog projection');
    const shell=CATALOG_APPEARANCES[c.catalog.appearanceId]!;
    if(c.catalog.identification==='unidentified')return {...shared,identification:'unidentified',name:shell.name,iconRef:{kind:'appearance',id:shell.iconId},weight:shell.weight,summary:offering.summary,description:offering.description,acquiredOrdinal:c.catalog.acquiredOrdinal,slot:null,inert:false};
    return {...shared,identification:'revealed',name:def.name,iconRef:{kind:'item',id:def.iconId,appearanceId:c.catalog.appearanceId},weight:def.weight,summary:def.description,description:def.description,acquiredOrdinal:c.catalog.acquiredOrdinal,slot:def.slot,inert:def.class==='inert',...(def.class==='inert'?{}:{usesRemaining:c.usesRemaining,maxUses:getCatalogMaxUses(c)})};
  }
  const def=CONTAMINANT_DATA[c.type];
  return {...shared,identification:'legacy_known',name:c.stage==='tool'?def.displayNameTool:def.displayNameDefense,iconRef:{kind:'legacy',id:c.type},weight:INVENTORY_RULES.contaminant_weight_tenths,summary:c.stage==='tool'?def.summaryTool:def.summaryDefense,description:c.stage==='tool'?def.descriptionTool:def.descriptionDefense,acquiredOrdinal:0,slot:c.stage==='tool'?def.toolType:null,inert:false,...(c.stage==='tool'?{usesRemaining:c.usesRemaining}:{})};
}

export interface CatalogDiscoveryView {
  readonly definitionId: string;
  readonly name: string;
  readonly iconId: string;
  readonly summary: string;
  readonly slot: 'active' | 'passive' | null;
  readonly inert: boolean;
}

/** Call with the durable discovery ledger. Knowledge never identifies a new shell. */
export function projectDiscoveredCatalogItems(discoveredIds: readonly string[]): CatalogDiscoveryView[] {
  return [...new Set(discoveredIds)].flatMap(id => {
    if (!Object.prototype.hasOwnProperty.call(CATALOG_ITEMS, id)) return [];
    const definition = CATALOG_ITEMS[id]!;
    return [{ definitionId: id, name: definition.name, iconId: definition.iconId,
      summary: definition.description, slot: definition.slot, inert: definition.class === 'inert' }];
  });
}
