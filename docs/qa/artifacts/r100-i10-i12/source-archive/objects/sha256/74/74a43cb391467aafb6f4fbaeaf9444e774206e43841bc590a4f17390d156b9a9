/** One quiet Rift line: identification first, infrequent environment second.
 * Presentation time is advanced by the owning Scene after its committed frame.
 * No browser timers survive a pause, restoration or scene shutdown. */
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { displayTokenFor, identityKey, observePoolFor, type ContaminationForm, type EncounterNode } from '@/generation/contamination-draw';
import { chooseNarration } from '@/narrative/atmosphere';
import { GameEvent } from '@/types/events';
import { getDomUiRoot, injectPanelStyles } from '@/ui/dom/panel-styles';

const C = GAME_CONSTANTS.CONTAMINATION;
const FADE_IN_MS = 200, FADE_OUT_MS = 300;
export interface EncounterSubject { readonly id: string; readonly form: ContaminationForm; readonly identifiable: boolean; }
type LineKind = 'encounter' | 'atmosphere' | 'threshold';

/** Small, deliberately lossy schedule. A busy opportunity expires rather than
 * waiting in a queue and firing as soon as a fight or menu ends. */
export class RiftAtmosphereSchedule {
  private elapsed = 0;
  private quietMs = 0;
  private count = 0;
  private entryPending: boolean;
  private nextAt = 45_000;
  constructor(restoring = false) {
    this.entryPending = !restoring;
    // Unknown historical budget after a full page reload: silence is safer
    // than replaying an entrance or replenishing a sortie's three-line cap.
    if (restoring) this.count = 3;
  }
  interrupt(): void { this.entryPending = false; this.quietMs = 0; this.nextAt = this.elapsed + 45_000; }
  tick(deltaMs: number, quiet: boolean, slotFree: boolean): 'entry' | 'quiet' | null {
    const step = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    this.elapsed += step;
    this.quietMs = quiet ? this.quietMs + step : 0;
    if (this.count >= 3) return null;
    if (this.entryPending) {
      if (this.elapsed > 12_000) { this.entryPending = false; this.nextAt = this.elapsed + 45_000; }
      else if (this.elapsed >= 2_000 && this.quietMs >= 2_000 && slotFree) {
        this.entryPending = false; this.count++; this.nextAt = this.elapsed + 45_000; return 'entry';
      }
      return null;
    }
    if (this.elapsed < this.nextAt) return null;
    this.nextAt = this.elapsed + 45_000;
    if (!quiet || this.quietMs < 2_000 || !slotFree) return null;
    this.count++; return 'quiet';
  }
}

export class EncounterNarration {
  private root: HTMLDivElement | null = null;
  private line: HTMLDivElement | null = null;
  private elapsed = 0;
  private active: { kind: LineKind; began: number; holdMs: number } | null = null;
  private lastLineAt = -Infinity;
  private readonly cooldownUntil = new Map<string, number>();
  private readonly identifiable = new Map<string, boolean>();

  create(): void {
    this.destroy(); injectPanelStyles();
    this.root = document.createElement('div'); this.root.id = 'rift-encounter-log';
    this.line = document.createElement('div'); this.line.className = 'encounter-log';
    this.root.appendChild(this.line); getDomUiRoot().appendChild(this.root);
  }
  destroy(): void {
    this.root?.remove(); this.root = null; this.line = null; this.active = null;
    this.cooldownUntil.clear(); this.identifiable.clear(); this.elapsed = 0; this.lastLineAt = -Infinity;
  }
  advance(deltaMs: number): void {
    this.elapsed += Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    if (!this.active || !this.root) return;
    const age = this.elapsed - this.active.began, holdEnd = FADE_IN_MS + this.active.holdMs;
    if (age >= holdEnd + FADE_OUT_MS) { this.clear(); return; }
    this.root.style.opacity = String(Math.min(1, age / FADE_IN_MS, (holdEnd + FADE_OUT_MS - age) / FADE_OUT_MS));
  }
  isBusy(): boolean { return this.active !== null; }
  isAtmosphere(): boolean { return this.active?.kind === 'atmosphere'; }
  setHidden(hidden: boolean): void { if (this.root) this.root.style.visibility = hidden ? 'hidden' : ''; }
  clear(): void {
    this.active = null; this.root?.classList.remove('is-recording');
    if (this.root) {
      this.root.style.opacity = '0';
      delete this.root.dataset.narrationKind;
    }
    this.line?.replaceChildren();
  }
  showAtmosphere(text: string): boolean {
    if (!this.root || !this.line || this.active || !text) return false;
    this.showText(text, 'atmosphere', 3_600); return true;
  }
  showThreshold(text: string): void { if (this.root && this.line && text) this.showText(text, 'threshold', 2_500); }

  /** Blocked edges are consumed, not queued. Watching a body continuously does
   * not repeat a line, even when its identity cooldown has expired. */
  tick(subjects: readonly EncounterSubject[], blocked: boolean): boolean {
    if (!this.root) return false;
    const live = new Set<string>(); let shown = false;
    for (const subject of subjects) {
      live.add(subject.id);
      const was = this.identifiable.get(subject.id) === true;
      if (subject.identifiable && !was && !blocked) shown = this.tryIdentify(subject.form) || shown;
      this.identifiable.set(subject.id, subject.identifiable);
    }
    for (const id of this.identifiable.keys()) if (!live.has(id)) this.identifiable.delete(id);
    return shown;
  }
  private tryIdentify(form: ContaminationForm): boolean {
    if (!this.root || !this.line || this.active?.kind === 'threshold') return false;
    if (this.active?.kind === 'encounter' || this.elapsed - this.lastLineAt < C.ENCOUNTER_GAP_MS) return false;
    const key = identityKey(form);
    if (this.elapsed < (this.cooldownUntil.get(key) ?? 0)) return false;
    const pool = observePoolFor(form);
    if (!pool.length) return false;
    const scope = form.utteranceId ?? (form.occupancy === 'floor'
      ? `floor:${form.lexemes.sense === 'sense_hear' ? 'hear' : 'cone'}`
      : `${form.occupancy}:${form.coverage === 'infiltrate' ? 'infiltrate' : 'overwrite'}`);
    const chosen = chooseNarration(`encounter:${scope}`, pool.map(row => ({ ...row, text: row.displayToken })));
    const nodes: EncounterNode[] = [{ kind: 'observe', tokenId: chosen.id }];
    if (form.utteranceId) nodes.push({ kind: 'utterance_mark', tokenId: form.utteranceId });
    this.clear();
    for (const node of nodes) {
      const span = document.createElement('span');
      span.className = node.kind === 'utterance_mark' ? 'encounter-node encounter-mark' : 'encounter-node';
      span.textContent = displayTokenFor(node); this.line.appendChild(span);
    }
    this.begin('encounter', C.ENCOUNTER_HOLD_MS);
    this.cooldownUntil.set(key, this.elapsed + C.ENCOUNTER_COOLDOWN_MS); this.lastLineAt = this.elapsed;
    eventBus.emit(GameEvent.ENCOUNTER_IDENTIFIED, { identityKey: key, nodes, utteranceId: form.utteranceId });
    return true;
  }
  private showText(text: string, kind: LineKind, holdMs: number): void {
    this.clear();
    const span = document.createElement('span'); span.className = 'encounter-node'; span.textContent = text;
    this.line!.appendChild(span); this.begin(kind, holdMs);
  }
  private begin(kind: LineKind, holdMs: number): void {
    this.active = { kind, began: this.elapsed, holdMs };
    this.root!.dataset.narrationKind = kind; this.root!.classList.add('is-recording');
    this.root!.style.transition = 'none'; this.root!.style.opacity = '0';
  }
}
