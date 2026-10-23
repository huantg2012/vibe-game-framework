import { AUTOMATIC_SUPPLY_POLICIES } from '@/generated/rift-auto-supply-policy';
import { isPollutionGrade, type PollutionGrade } from './pollution-grade';

/** Grade-level engineering defaults; no world identity, coordinates or certified seeds. */
export interface R100AutomaticSupplyPolicy {
  readonly version: 1;
  /** v1 admits contested travel by either extra return-trip distance or the
   * frozen long-approach threshold. Safe/deep eligibility remains unchanged. */
  readonly algorithm: 'body-geodesic-cover-v1';
  readonly grade: PollutionGrade;
  readonly sourceHash: string;
  readonly bodyAreaPerNodePx2: number;
  readonly routePerNodePx: number;
  readonly maxCoveragePx: number;
  readonly p95CoveragePx: number;
  readonly maxNodes: number;
  readonly earlyFuelNodes: number;
  readonly maxBodyCells: number;
  readonly maxWorkEdges: number;
  /** Actual 20px-body shortest approach, independent of today's spatial CSV. */
  readonly contestedApproachMinPx: number;
  /** Long outbound travel plus actual threat can price deep rewards on a trunk. */
  readonly deepApproachMinPx?: number;
}
const numericKeys = ['bodyAreaPerNodePx2', 'routePerNodePx', 'maxCoveragePx', 'p95CoveragePx', 'maxNodes', 'earlyFuelNodes', 'maxBodyCells', 'maxWorkEdges', 'contestedApproachMinPx'] as const;
const keys = ['version', 'algorithm', 'grade', 'sourceHash', ...numericKeys].sort().join(',');
export function validAutomaticSupplyPolicy(value: unknown): value is R100AutomaticSupplyPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as R100AutomaticSupplyPolicy;
  return Object.keys(value).filter(key=>key!=='deepApproachMinPx').sort().join(',') === keys
    && (p.deepApproachMinPx===undefined||Number.isSafeInteger(p.deepApproachMinPx)&&p.deepApproachMinPx>p.contestedApproachMinPx&&p.deepApproachMinPx<=2600) && p.version === 1 && p.algorithm === 'body-geodesic-cover-v1'
    && isPollutionGrade(p.grade) && typeof p.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(p.sourceHash)
    && numericKeys.every(key => Number.isSafeInteger(p[key]) && p[key] >= (key === 'earlyFuelNodes' ? 0 : 1))
    && (p.grade !== 'low' || p.earlyFuelNodes >= 2)
    && p.p95CoveragePx <= p.maxCoveragePx && p.earlyFuelNodes <= p.maxNodes && p.maxNodes <= 32
    && p.maxBodyCells <= 131072 && p.maxWorkEdges <= 64000000;
}
export function createAutomaticSupplyPolicy(grade: PollutionGrade): R100AutomaticSupplyPolicy {
  const policy = AUTOMATIC_SUPPLY_POLICIES.find(row => row.grade === grade);
  if (!validAutomaticSupplyPolicy(policy)) throw new Error('Invalid automatic supply policy');
  return { ...policy };
}

export function automaticSupplyTravelEligible(tier:'safe'|'contested'|'deep',extraTravelPx:number,approachPx:number,
  minimumExtraPx:number,maximumExtraPx:number,policy:R100AutomaticSupplyPolicy):boolean {
  if(!Number.isFinite(extraTravelPx)||!Number.isFinite(approachPx))return false;
  return extraTravelPx>=minimumExtraPx&&extraTravelPx<=maximumExtraPx
    ||tier==='contested'&&approachPx>=policy.contestedApproachMinPx
    ||tier==='deep'&&policy.deepApproachMinPx!==undefined&&approachPx>=policy.deepApproachMinPx;
}
