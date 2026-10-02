/** Map exposure is independent of material age, enemy coverage and player chaos.
 * I01 records the contract only: these definitions do not enable graded departures.
 */
export const POLLUTION_GRADES = ['low', 'medium', 'severe'] as const;
export type PollutionGrade = typeof POLLUTION_GRADES[number];

export interface PollutionGradeDefinition {
  readonly id: PollutionGrade;
  readonly version: 1;
  readonly label: string;
  readonly status: 'contract-only';
  readonly intent: string;
}

export function isPollutionGrade(value: unknown): value is PollutionGrade {
  return typeof value === 'string' && POLLUTION_GRADES.some(grade => grade === value);
}

export function validatePollutionGradeDefinitions(value: unknown): asserts value is readonly PollutionGradeDefinition[] {
  if (!Array.isArray(value) || value.length !== POLLUTION_GRADES.length)
    throw new Error('Pollution grade contract requires low, medium and severe');
  const seen = new Set<PollutionGrade>();
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || Object.keys(row).sort().join(',') !== 'id,intent,label,status,version'
      || !isPollutionGrade(row.id) || seen.has(row.id) || row.version !== 1 || row.status !== 'contract-only'
      || typeof row.label !== 'string' || row.label.trim().length === 0 || row.label.length > 40
      || typeof row.intent !== 'string' || row.intent.trim().length === 0 || row.intent.length > 500)
      throw new Error('Unsupported or duplicate pollution grade definition');
    seen.add(row.id);
  }
}
