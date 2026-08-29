/**
 * Encounter identification log (DEC-074 / DEC-076).
 *
 * Carrier A: rift wearable recorder. Mounts on `#dom-ui-root`.
 * Not a toast, not chaos-threshold literature, not a nameplate.
 * Mechanical layer only; aesthetic is human-final.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import {
  displayTokenFor,
  encounterNodes,
  identityKey,
  type ContaminationForm,
} from '@/generation/contamination-draw';
import { mix32 } from '@/generation/seed-fork';
import { GameEvent } from '@/types/events';
import { getDomUiRoot, injectPanelStyles } from '@/ui/dom/panel-styles';

const C = GAME_CONSTANTS.CONTAMINATION;
const FADE_IN_MS = 200;
const FADE_OUT_MS = 300;

export interface EncounterSubject {
  readonly id: string;
  readonly form: ContaminationForm;
  readonly identifiable: boolean;
}

export class EncounterNarration {
  private root: HTMLDivElement | null = null;
  private line: HTMLDivElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private visibleUntil = 0;
  private lastLineAt = -Infinity;
  private readonly cooldownUntil = new Map<string, number>();
  private readonly identifiable = new Map<string, boolean>();

  create(): void {
    this.destroy();
    injectPanelStyles();
    const root = document.createElement('div');
    root.id = 'rift-encounter-log';
    const line = document.createElement('div');
    line.className = 'encounter-log';
    root.appendChild(line);
    getDomUiRoot().appendChild(root);
    this.root = root;
    this.line = line;
  }

  destroy(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.root?.remove();
    this.root = null;
    this.line = null;
    this.cooldownUntil.clear();
    this.identifiable.clear();
    this.visibleUntil = 0;
    this.lastLineAt = -Infinity;
  }

  /**
   * Edge-trigger identification for currently spawned enemies.
   * `thresholdActive`: chaos-threshold overlay still up → this attempt is voided, not queued.
   */
  tick(nowMs: number, subjects: readonly EncounterSubject[], thresholdActive: boolean): void {
    if (!this.root) return;
    const live = new Set<string>();
    for (const subject of subjects) {
      live.add(subject.id);
      const seen = subject.identifiable;
      const was = this.identifiable.get(subject.id) === true;
      if (seen && !was) {
        this.tryIdentify(nowMs, subject.id, subject.form, thresholdActive);
      }
      this.identifiable.set(subject.id, seen);
    }
    for (const id of [...this.identifiable.keys()]) {
      if (!live.has(id)) this.identifiable.delete(id);
    }
  }

  private tryIdentify(
    nowMs: number,
    hostId: string,
    form: ContaminationForm,
    thresholdActive: boolean,
  ): void {
    if (thresholdActive) return;
    if (nowMs < this.visibleUntil) return;
    if (nowMs - this.lastLineAt < C.ENCOUNTER_GAP_MS) return;
    const key = identityKey(form);
    const cooled = this.cooldownUntil.get(key) ?? 0;
    if (nowMs < cooled) return;

    const nodes = encounterNodes(form, mix32(0, hostId));
    this.render(nodes);
    this.cooldownUntil.set(key, nowMs + C.ENCOUNTER_COOLDOWN_MS);
    this.lastLineAt = nowMs;
    this.visibleUntil = nowMs + C.ENCOUNTER_HOLD_MS;
    eventBus.emit(GameEvent.ENCOUNTER_IDENTIFIED, {
      identityKey: key,
      nodes,
      utteranceId: form.utteranceId,
    });

    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hide();
    }, FADE_IN_MS + C.ENCOUNTER_HOLD_MS);
  }

  private render(nodes: ReturnType<typeof encounterNodes>): void {
    const root = this.root;
    const line = this.line;
    if (!root || !line) return;
    line.replaceChildren();
    for (const node of nodes) {
      const span = document.createElement('span');
      span.className = node.kind === 'utterance_mark' ? 'encounter-node encounter-mark' : 'encounter-node';
      span.textContent = displayTokenFor(node);
      line.appendChild(span);
    }
    root.classList.add('is-recording');
    root.style.opacity = '0';
    root.style.transition = `opacity ${FADE_IN_MS}ms linear`;
    requestAnimationFrame(() => {
      if (this.root === root) root.style.opacity = '1';
    });
  }

  private hide(): void {
    const root = this.root;
    if (!root) return;
    root.style.transition = `opacity ${FADE_OUT_MS}ms linear`;
    root.style.opacity = '0';
    this.hideTimer = setTimeout(() => {
      root.classList.remove('is-recording');
      if (this.line) this.line.replaceChildren();
      this.hideTimer = null;
    }, FADE_OUT_MS);
  }
}
