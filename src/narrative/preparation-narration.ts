import { PREPARATION_NARRATION_POOLS, type PreparationNarrationGrade, type PreparationNarrationPool } from '../generated/preparation-narration-data';
import { chooseNarration } from './atmosphere';
import type { NarrationRow } from './narration-memory';

export interface PreparationNarrationFact {
  readonly pool: PreparationNarrationPool;
  /** Stable event/qualification identity, never an item-specific history scope. */
  readonly key: string;
  readonly recent: boolean;
  readonly eventKeys?: readonly string[];
}
export interface PreparationNarrationFrame {
  readonly grade: PreparationNarrationGrade;
  readonly visible: boolean;
  readonly paused: boolean;
}
export interface PreparationNarrationPort {
  update(deltaMs: number, frame: PreparationNarrationFrame): string;
}
/** One owner per haven visit. Closing a view never resets its budget. */
export class PreparationNarrationJourney implements PreparationNarrationPort {
  private readonly readGrades = new Set<PreparationNarrationGrade>();
  private readonly consumedEvents = new Set<string>();
  private readonly observedFacts = new Set<string>();
  private extraAvailable = false;
  private extraUsed = false;
  private started = false;
  private grade: PreparationNarrationGrade | null = null;
  private candidateMs = 0;
  private active: { fact: PreparationNarrationFact; text: string; remaining: number } | null = null;
  private lastFact: PreparationNarrationFact | null = null;
  private dead = false;
  constructor(private readonly facts: () => readonly PreparationNarrationFact[],
    private readonly choose: (scope: string, rows: readonly NarrationRow[]) => NarrationRow = chooseNarration,
    private readonly release: () => void = () => {}) {}

  update(deltaMs: number, frame: PreparationNarrationFrame): string {
    if (this.dead) return '';
    const facts = this.facts();
    for (const fact of facts) {
      if (!this.observedFacts.has(fact.key)) {
        if (this.started && fact.recent && !this.consumedEvents.has(fact.key)) this.extraAvailable = true;
        this.observedFacts.add(fact.key);
      }
    }
    if (this.lastFact && !this.lastFact.pool.startsWith('prepare.baseline.')
      && !facts.some(f => f.key === this.lastFact!.key && f.pool === this.lastFact!.pool)) {
      this.active = null; this.lastFact = null; this.candidateMs = 0; this.extraAvailable = true;
    }
    if (!frame.visible || frame.grade !== this.grade) {
      this.active = null; this.candidateMs = 0;
      this.grade = frame.visible ? frame.grade : null;
    }
    if (!frame.visible) return '';
    if (frame.paused) { this.candidateMs = 0; return ''; }
    const elapsed = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    if (this.active) {
      this.active.remaining -= elapsed;
      if (this.active.remaining <= 0) this.active = null;
      return this.active?.text ?? '';
    }
    const extra = this.readGrades.has(frame.grade);
    if (extra && (!this.extraAvailable || this.extraUsed)) return '';
    this.candidateMs += elapsed;
    if (this.candidateMs < 250) return '';
    this.candidateMs = 0;
    const eligible = facts.filter(f => PREPARATION_NARRATION_POOLS[f.pool].grades.includes(frame.grade));
    const fact = eligible.find(f => f.recent && (f.eventKeys ?? [f.key]).every(key => !this.consumedEvents.has(key)))
      ?? eligible.find(f => !f.recent)
      ?? { pool: `prepare.baseline.${frame.grade}` as PreparationNarrationPool, key: `baseline:${frame.grade}`, recent: false };
    const line = this.choose(`atmosphere:${fact.pool}`, PREPARATION_NARRATION_POOLS[fact.pool].lines);
    this.lastFact = fact;
    this.active = { fact, text: line.text, remaining: 6000 };
    this.readGrades.add(frame.grade); this.started = true;
    if (fact.recent) for (const key of fact.eventKeys ?? [fact.key]) this.consumedEvents.add(key);
    if (extra) this.extraUsed = true;
    this.extraAvailable = false;
    return line.text;
  }
  destroy(): void { if (this.dead) return; this.dead = true; this.active = null; this.release(); }
}
