/** DEV catalog: production CSV capabilities + renderer-owned variant identities. */
import { FAMILY_CAPABILITY_DATA, type FamilyCapability } from '@/generated/contamination-family-data';
import { SUBSTRATE_DATA, PORTFOLIO_DATA, type CoverageId } from '@/generated/contamination-lexicon-data';
import { BODY_PROFILE_DATA } from '@/generated/contamination-body-data';
import type { ContaminationForm } from '@/generation/contamination-draw';
import { productionModelFor } from '@/entities/form-renderers/d/production-models';
import { beastVariantOf } from '@/entities/form-renderers/d/beast-model';
import { wormVariantOf } from '@/entities/form-renderers/d/worm-model';
import { remnantVariantOf } from '@/entities/form-renderers/d/remnant-model';
import { growthVariantOf } from '@/entities/form-renderers/d/growth-model';
import { WALL_RECOIL_MS } from '@/entities/form-renderers/d/yi';
import { oilFilmProductionVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { getVolumeProfile, volumeTimeAtPhase, type VolumePhase } from '@/systems/volume-presence';
import { VOLUME_PROFILE_DATA } from '@/generated/contamination-volume-data';
export interface InspectorEntry {
    id: string;
    label: string;
    family: FamilyCapability;
    variants: readonly {
        label: string;
        seed: number;
    }[];
}
const variations: Record<string, {
    names: string[];
    index: (seed: number) => number;
}> = {
    mammal_remnant: { names: ['低伏长身', '高胯长肢', '宽肩重身'], index: beastVariantOf },
    worm_remnant: { names: ['拉长链体', '回折钩身', '抬起折弓'], index: wormVariantOf },
    organic_remnant: { names: ['折叠厚幕', '悬垂空壳', '共腹残体'], index: remnantVariantOf },
    stalk_clump: { names: ['束生立柱', '倒伏扇丛', '裂开残桩'], index: growthVariantOf },
    oil_film: { names: ['聚珠成滩', '沾抹拖尾', '薄滩收边'], index: seed => oilFilmProductionVeinVariant(seed) - 3 },
};
const groups = { jia: '占地 · 生物残余', yi: '占墙 · 附墙实体', bing: '占漆 · 地表侵染', ding: '占空 · 空间异象' };
export const INSPECTOR_ENTRIES: readonly InspectorEntry[] = FAMILY_CAPABILITY_DATA
    .filter(f => SUBSTRATE_DATA[f.substrate]?.enabledScope === 'sortie' && (f.portfolio !== 'jia' || productionModelFor(f.substrate)))
    .map(family => {
    const v = family.portfolio === 'jia' || family.substrate === 'oil_film' ? variations[family.substrate] : undefined;
    const variants = v ? v.names.map((label, index) => {
        for (let seed = 0; seed < 10000; seed++)
            if (v.index(seed) === index)
                return { label, seed };
        throw new Error(`No representative seed for ${family.id}/${index}`);
    }) : [{ label: '原形', seed: 0 }];
    return { id: family.id, label: SUBSTRATE_DATA[family.substrate]!.displayToken, family, variants };
}).sort((a, b) => ['jia', 'yi', 'bing', 'ding'].indexOf(a.family.portfolio) - ['jia', 'yi', 'bing', 'ding'].indexOf(b.family.portfolio));
export function entryGroup(e: InspectorEntry): string { return groups[e.family.portfolio]; }
export function inspectorForm(e: InspectorEntry, coverage: CoverageId): ContaminationForm {
    const f = e.family;
    const continuity = PORTFOLIO_DATA[f.portfolio].legalContinuities.find(c => SUBSTRATE_DATA[f.substrate]!.legalContinuities.includes(c))!;
    return { substrate: f.substrate, portfolio: f.portfolio, occupancy: PORTFOLIO_DATA[f.portfolio].occupancy,
        coverage, continuity, lexemes: { motion: f.infiltrateMotion, sense: f.sense[0]!, rhythm: f.rhythm[0]!, contact: f.contact[0]! } };
}
export type ReviewAction = 'idle' | 'walk' | 'alert' | 'windup' | 'strike' | 'recover' | 'rest' | 'wake';
export const ACTION_LABELS: Record<ReviewAction, string> = { idle: '静息', walk: '行走', alert: '警觉', windup: '攻击前摇', strike: '出手', recover: '收势', rest: '休眠', wake: '苏醒' };
export function hasMaterialVolumeCycle(e: InspectorEntry): boolean {
    return e.family.portfolio === 'ding' && e.family.substrate !== 'sound_echo' && !!VOLUME_PROFILE_DATA[e.family.substrate];
}
export function actionLabel(e: InspectorEntry, action: ReviewAction): string {
    if (!hasMaterialVolumeCycle(e)) return ACTION_LABELS[action];
    if (action === 'idle') return '完整周期';
    const names: Record<string, readonly string[]> = {
        gas_mass: ['压缩', '外胀', '回落'], mist_bank: ['汇拢', '漫开', '回流'], dust_swarm: ['旋聚', '扫过', '散开'],
    };
    const index = ['windup', 'strike', 'recover'].indexOf(action);
    return index < 0 ? ACTION_LABELS[action] : names[e.family.substrate]![index]!;
}
export function volumePhaseLabel(substrate: string, phase: VolumePhase): string {
    if (phase === 'rest') return '舒缓';
    const entry = INSPECTOR_ENTRIES.find(e => e.family.substrate === substrate && e.family.portfolio === 'ding');
    const action = phase === 'gather' ? 'windup' : phase === 'release' ? 'strike' : 'recover';
    return entry ? actionLabel(entry, action) : ACTION_LABELS[action];
}
export function volumePreviewTime(e: InspectorEntry, action: ReviewAction, elapsedMs: number): number | undefined {
    if (!hasMaterialVolumeCycle(e)) return undefined;
    const progress = elapsedMs / actionDuration(e, action);
    switch (action) {
        case 'windup': return volumeTimeAtPhase(e.family.substrate, 'gather', progress);
        case 'strike': return volumeTimeAtPhase(e.family.substrate, 'release', progress);
        case 'recover': return volumeTimeAtPhase(e.family.substrate, 'disperse', progress);
        case 'rest': case 'wake': return volumeTimeAtPhase(e.family.substrate, 'rest', .5);
        default: return elapsedMs;
    }
}
export function actionsFor(e: InspectorEntry): ReviewAction[] {
    if (hasMaterialVolumeCycle(e)) return ['idle', 'windup', 'strike', 'recover', 'rest', 'wake'];
    if (e.family.portfolio !== 'jia')
        return e.family.portfolio === 'yi' ? ['idle', 'windup', 'strike', 'recover', 'rest', 'wake'] : e.family.portfolio === 'ding' ? ['idle', 'rest', 'wake'] : ['idle'];
    return ['idle', ...(BODY_PROFILE_DATA[e.family.substrate]?.moveScale ? ['walk' as const] : []), 'alert', 'windup', 'strike', 'recover', 'rest', 'wake'];
}
export function actionDuration(e: InspectorEntry, action: ReviewAction): number {
    if (hasMaterialVolumeCycle(e)) {
        const p = getVolumeProfile(e.family.substrate);
        if (action === 'idle') return p.restMs + p.gatherMs + p.releaseMs + p.disperseMs;
        if (action === 'windup') return p.gatherMs;
        if (action === 'strike') return p.releaseMs;
        if (action === 'recover') return p.disperseMs;
    }
    switch (action) {
        case 'walk': return productionModelFor(e.family.substrate)?.walkCycleMs ?? 1000;
        case 'windup': return BODY_PROFILE_DATA[e.family.substrate]?.windupMs ?? 350;
        case 'strike': return 80;
        case 'recover': return e.family.portfolio === 'yi' ? WALL_RECOIL_MS : 240;
        case 'wake': return 600;
        default: return 2400;
    }
}
