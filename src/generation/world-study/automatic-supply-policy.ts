import { AUTOMATIC_SUPPLY_POLICIES } from '@/generated/rift-auto-supply-policy';
import { isPollutionGrade, type PollutionGrade } from './pollution-grade';

/** Grade-level engineering defaults; no world identity, coordinates or certified seeds. */
export interface R100AutomaticSupplyPolicy {
  readonly version: 1;
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
}
const numericKeys = ['bodyAreaPerNodePx2', 'routePerNodePx', 'maxCoveragePx', 'p95CoveragePx', 'maxNodes', 'earlyFuelNodes', 'maxBodyCells', 'maxWorkEdges'] as const;
const keys = ['version', 'algorithm', 'grade', 'sourceHash', ...numericKeys].sort().join(',');
export function validAutomaticSupplyPolicy(value: unknown): value is R100AutomaticSupplyPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as R100AutomaticSupplyPolicy;
  return Object.keys(value).sort().join(',') === keys && p.version === 1 && p.algorithm === 'body-geodesic-cover-v1'
    && isPollutionGrade(p.grade) && typeof p.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(p.sourceHash)
    && numericKeys.every(key => Number.isSafeInteger(p[key]) && p[key] > 0)
    && p.p95CoveragePx <= p.maxCoveragePx && p.earlyFuelNodes <= p.maxNodes && p.maxNodes <= 32
    && p.maxBodyCells <= 131072 && p.maxWorkEdges <= 64000000;
}
export function createAutomaticSupplyPolicy(grade: PollutionGrade): R100AutomaticSupplyPolicy {
  const policy = AUTOMATIC_SUPPLY_POLICIES.find(row => row.grade === grade);
  if (!validAutomaticSupplyPolicy(policy)) throw new Error('Invalid automatic supply policy');
  return { ...policy };
}
