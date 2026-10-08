/** Map pollution is independent of material age and starting player chaos.
 * The grading contract is implemented in the native R100 master fixtures only;
 * it does not admit any world package into the production selection pool. */
export const POLLUTION_GRADES = ['low', 'medium', 'severe'] as const;
export type PollutionGrade = typeof POLLUTION_GRADES[number];

export interface PollutionGradeDefinition {
  readonly id: PollutionGrade;
  readonly version: 1;
  readonly label: string;
  readonly status: 'dev-masters';
  readonly intent: string;
  readonly paintCount: number;
  readonly paintSubstrate: 'oil_film';
  readonly paintContinuity: 'monolith';
  readonly paintCoverage: 'infiltrate' | 'rewrite' | 'overwrite';
  readonly volumeCount: number;
  readonly volumeSubstrate: 'gas_mass';
  readonly volumeCoverage: 'infiltrate' | 'rewrite' | 'overwrite';
  readonly volumeCols: number;
  readonly volumeRows: number;
  readonly chaosStartRate: number;
  readonly chaosEndRate: number;
  readonly chaosRampStartSeconds: number;
  readonly chaosRampEndSeconds: number;
}

export function isPollutionGrade(value: unknown): value is PollutionGrade {
  return typeof value === 'string' && POLLUTION_GRADES.some(grade => grade === value);
}

export function isPollutionGradeDefinition(value: unknown): value is PollutionGradeDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const coverage = ['infiltrate', 'rewrite', 'overwrite'];
  const keys = 'chaosEndRate,chaosRampEndSeconds,chaosRampStartSeconds,chaosStartRate,id,intent,label,paintContinuity,paintCount,paintCoverage,paintSubstrate,status,version,volumeCols,volumeCount,volumeCoverage,volumeRows,volumeSubstrate';
  return !(!row || typeof row !== 'object' || Array.isArray(row)
      || Object.keys(row).sort().join(',') !== keys
      || !isPollutionGrade(row.id) || row.version !== 1 || row.status !== 'dev-masters'
      || typeof row.label !== 'string' || !row.label.trim() || row.label.length > 40
      || typeof row.intent !== 'string' || !row.intent.trim() || row.intent.length > 500
      || row.paintSubstrate !== 'oil_film' || row.paintContinuity !== 'monolith' || row.volumeSubstrate !== 'gas_mass'
      || !coverage.includes(String(row.paintCoverage)) || !coverage.includes(String(row.volumeCoverage))
      || !['paintCount', 'volumeCount', 'volumeCols', 'volumeRows'].every(key => typeof row[key] === 'number' && Number.isInteger(row[key]) && row[key] > 0 && row[key] <= 16)
      || !['chaosStartRate', 'chaosEndRate', 'chaosRampStartSeconds', 'chaosRampEndSeconds'].every(key => typeof row[key] === 'number' && Number.isFinite(row[key]) && row[key] >= 0)
      || (row.chaosStartRate as number) <= 0 || (row.chaosEndRate as number) < (row.chaosStartRate as number) || (row.chaosEndRate as number) > 2
      || (row.chaosRampEndSeconds as number) <= (row.chaosRampStartSeconds as number));
}

export function validatePollutionGradeDefinitions(value: unknown): asserts value is readonly PollutionGradeDefinition[] {
  if (!Array.isArray(value) || value.length !== POLLUTION_GRADES.length)
    throw new Error('Pollution grade contract requires low, medium and severe');
  const seen = new Set<PollutionGrade>();
  for (const row of value) {
    if (!isPollutionGradeDefinition(row) || seen.has(row.id))
      throw new Error('Unsupported or duplicate pollution grade definition');
    seen.add(row.id);
  }
  const ordered = POLLUTION_GRADES.map(id => value.find(row => row.id === id)!);
  for (let index = 1; index < ordered.length; index++) {
    const before = ordered[index - 1]!, after = ordered[index]!;
    if (after.paintCount <= before.paintCount || after.volumeCount <= before.volumeCount
      || after.volumeCols * after.volumeRows <= before.volumeCols * before.volumeRows
      || after.chaosStartRate <= before.chaosStartRate || after.chaosEndRate <= before.chaosEndRate)
      throw new Error('Pollution grades must increase real host count, occupied area and pollution rate');
  }
}

/** Simulation-time piecewise-linear exposure, never wall time or current chaos. */
export function pollutionRateAt(definition: PollutionGradeDefinition, elapsedSeconds: number): number {
  const t = Math.max(0, Math.min(1, (elapsedSeconds - definition.chaosRampStartSeconds)
    / (definition.chaosRampEndSeconds - definition.chaosRampStartSeconds)));
  return definition.chaosStartRate + (definition.chaosEndRate - definition.chaosStartRate) * t;
}

function pollutionExposureUntil(definition: PollutionGradeDefinition, seconds: number): number {
  const time = Math.max(0, seconds), from = definition.chaosRampStartSeconds, to = definition.chaosRampEndSeconds;
  const rampTime = Math.max(0, Math.min(time, to) - from);
  return time * definition.chaosStartRate
    + rampTime * rampTime * (definition.chaosEndRate - definition.chaosStartRate) / (2 * (to - from))
    + Math.max(0, time - to) * (definition.chaosEndRate - definition.chaosStartRate);
}

/** Exact integral prevents frame rate from changing pressure near a curve break. */
export function pollutionExposureBetween(definition: PollutionGradeDefinition, fromSeconds: number, toSeconds: number): number {
  return Math.max(0, pollutionExposureUntil(definition, toSeconds) - pollutionExposureUntil(definition, fromSeconds));
}
