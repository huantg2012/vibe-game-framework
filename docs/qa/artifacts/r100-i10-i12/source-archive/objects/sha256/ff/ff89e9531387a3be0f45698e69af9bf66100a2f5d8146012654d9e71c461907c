/**
 * Rift rim interference — world-device veil bite on #dom-ui-root.
 *
 * Carrier A (world device). Dead Space / Barotrauma / Signalis for the action,
 * not the skin. Pixel contract: docs/specs/ui-detection-pulse.md.
 * Scene translates EnemyView → threats. This module does not import AI.
 *
 * Mechanical pass only. Aesthetic sign-off is the human's.
 */

import { getDomUiRoot } from '@/ui/dom/panel-styles';
import { AIState } from '@/types/game-types';

const LOGICAL_W = 960;
const LOGICAL_H = 640;
const RIM_ID = 'rift-detection-rim';
const Z_INDEX = 40;

const CONTAM_CORE = '#1aad96';
const CONTAM_GLOW = '#2ae6c8';

const APPEAR_LINE = 0.15;
const HIDE_LINE = 0.10;
const MERGE_DEG = 28;
const MIN_SAME_EDGE = 20;
const CORNER_GUARD = 24;

const LEGAL = {
  top: { x0: 280, x1: 680, y: 2 },
  bottom: { x0: 180, x1: 824, y: 622 },
  left: { x: 2, y0: 56, y1: 560 },
  right: { x: 942, y0: 56, y1: 508 },
} as const;

const CIRCLE_REJECT = { x: 833, y: 513 };

const STATE_RANK: Readonly<Record<AIState, number>> = {
  [AIState.CHASE]: 3,
  [AIState.ALERT]: 2,
  [AIState.SUSPICIOUS]: 1,
  [AIState.PATROL]: 0,
  [AIState.RETURN]: 0,
};

export type PulseForm = 'notice' | 'search' | 'lock';

export interface DetectionThreatView {
  readonly id: string;
  readonly detection: number;
  readonly state: AIState;
  readonly worldX: number;
  readonly worldY: number;
}

export interface PulseViewBox {
  readonly worldX: number;
  readonly worldY: number;
  readonly worldW: number;
  readonly worldH: number;
}

type Edge = 'top' | 'bottom' | 'left' | 'right';

interface Candidate {
  id: string;
  detection: number;
  state: AIState;
  form: PulseForm;
  angle: number;
  cx: number;
  cy: number;
  edge: Edge;
}

interface Slot {
  key: string;
  form: PulseForm;
  detection: number;
  cx: number;
  cy: number;
  edge: Edge;
  phase: number;
  appearMs: number;
  fade: number;
  dying: boolean;
}

const FORM: Record<PulseForm, { teeth: number; w: number; h: number; gap: number }> = {
  notice: { teeth: 3, w: 1, h: 8, gap: 10 },
  search: { teeth: 5, w: 2, h: 11, gap: 8 },
  lock: { teeth: 7, w: 2, h: 14, gap: 6 },
};

export class DetectionPulse {
  private wrap: HTMLDivElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly sticky = new Set<string>();
  private slots: Slot[] = [];
  private clock = 0;

  create(): void {
    this.destroy();
    const wrap = document.createElement('div');
    wrap.id = RIM_ID;
    wrap.style.cssText = [
      'position:absolute',
      'inset:0',
      `z-index:${Z_INDEX}`,
      'pointer-events:none',
    ].join(';');

    const canvas = document.createElement('canvas');
    canvas.width = LOGICAL_W;
    canvas.height = LOGICAL_H;
    canvas.style.cssText = [
      'width:100%',
      'height:100%',
      'image-rendering:pixelated',
      'image-rendering:crisp-edges',
      'pointer-events:none',
      'display:block',
    ].join(';');

    wrap.appendChild(canvas);
    getDomUiRoot().appendChild(wrap);
    this.wrap = wrap;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
  }

  update(
    deltaMs: number,
    view: PulseViewBox,
    playerWorld: { x: number; y: number },
    threats: readonly DetectionThreatView[]
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.clock += deltaMs;
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    const px = worldToScreenX(view, playerWorld.x);
    const py = worldToScreenY(view, playerWorld.y);
    const live = this.pick(view, px, py, threats);
    this.syncSlots(live, deltaMs);
    for (const slot of this.slots) this.drawSlot(ctx, slot);
  }

  destroy(): void {
    this.wrap?.remove();
    this.wrap = null;
    this.ctx = null;
    this.slots = [];
    this.sticky.clear();
  }

  private pick(
    view: PulseViewBox,
    px: number,
    py: number,
    threats: readonly DetectionThreatView[]
  ): Candidate[] {
    const raw: Candidate[] = [];
    for (const t of threats) {
      const keep =
        t.detection >= APPEAR_LINE ||
        t.state === AIState.SUSPICIOUS ||
        t.state === AIState.ALERT ||
        t.state === AIState.CHASE ||
        this.sticky.has(t.id);
      if (!keep) continue;
      if (t.state === AIState.RETURN && t.detection < APPEAR_LINE) {
        this.sticky.delete(t.id);
        continue;
      }
      if (
        (t.state === AIState.PATROL || t.state === AIState.RETURN) &&
        t.detection < HIDE_LINE &&
        this.sticky.has(t.id)
      ) {
        this.sticky.delete(t.id);
        continue;
      }
      if (t.detection < HIDE_LINE && t.state === AIState.PATROL && !this.sticky.has(t.id)) {
        continue;
      }

      const sx = worldToScreenX(view, t.worldX);
      const sy = worldToScreenY(view, t.worldY);
      const hit = projectToRim(px, py, sx, sy);
      if (!hit) continue;

      this.sticky.add(t.id);
      raw.push({
        id: t.id,
        detection: t.detection,
        state: t.state,
        form: formOf(t.state, t.detection),
        angle: Math.atan2(sy - py, sx - px),
        cx: hit.x,
        cy: hit.y,
        edge: hit.edge,
      });
    }

    raw.sort((a, b) => {
      if (b.detection !== a.detection) return b.detection - a.detection;
      return STATE_RANK[b.state] - STATE_RANK[a.state];
    });

    const merged: Candidate[] = [];
    for (const cand of raw) {
      const twin = merged.find((m) => angleDelta(m.angle, cand.angle) < (MERGE_DEG * Math.PI) / 180);
      if (twin) {
        if (cand.detection > twin.detection) {
          twin.detection = cand.detection;
          twin.cx = cand.cx;
          twin.cy = cand.cy;
          twin.edge = cand.edge;
        }
        if (STATE_RANK[cand.state] > STATE_RANK[twin.state]) {
          twin.state = cand.state;
          twin.form = cand.form;
        }
        continue;
      }
      merged.push({ ...cand });
    }

    const top = merged.slice(0, 2);
    if (top.length === 2 && top[0]!.edge === top[1]!.edge) {
      const a = top[0]!;
      const b = top[1]!;
      const dist = a.edge === 'top' || a.edge === 'bottom' ? Math.abs(a.cx - b.cx) : Math.abs(a.cy - b.cy);
      if (dist < MIN_SAME_EDGE) {
        return [a.detection >= b.detection ? a : b];
      }
    }
    return top;
  }

  private syncSlots(live: Candidate[], deltaMs: number): void {
    const next: Slot[] = [];
    for (const cand of live) {
      const key = `${cand.edge}:${Math.round(cand.cx / 4)}:${Math.round(cand.cy / 4)}`;
      const prev = this.slots.find((s) => s.key === key && !s.dying) ?? this.slots.find((s) => !s.dying && s.form === cand.form && s.edge === cand.edge);
      if (prev) {
        prev.form = cand.form;
        prev.detection = cand.detection;
        prev.cx = cand.cx;
        prev.cy = cand.cy;
        prev.edge = cand.edge;
        prev.appearMs = Math.min(prev.appearMs + deltaMs, 80);
        prev.dying = false;
        prev.fade = 1;
        prev.phase += deltaMs;
        next.push(prev);
      } else {
        next.push({
          key,
          form: cand.form,
          detection: cand.detection,
          cx: cand.cx,
          cy: cand.cy,
          edge: cand.edge,
          phase: this.clock * (0.37 + next.length * 0.61),
          appearMs: 0,
          fade: 1,
          dying: false,
        });
      }
    }
    for (const old of this.slots) {
      if (next.includes(old)) continue;
      old.dying = true;
      old.fade *= 0.45;
      if (old.fade > 0.05) next.push(old);
    }
    this.slots = next;
  }

  private drawSlot(ctx: CanvasRenderingContext2D, slot: Slot): void {
    const d = slot.detection;
    const extra = Math.floor(d * 2);
    const spec = FORM[slot.form];
    const appear = slot.appearMs < 33 ? 0.4 : 1;
    const peak = 0.22 + 0.7 * d;
    const t = slot.phase / 1000;
    let alpha = peak;
    let color = CONTAM_CORE;
    let under = 0;

    if (slot.form === 'notice') {
      const hz = 1.5 + 1.5 * d;
      alpha = peak * (0.72 + 0.28 * Math.sin(Math.PI * 2 * hz * t));
      color = CONTAM_CORE;
    } else if (slot.form === 'search') {
      const on = (t * 3) % 1 < 0.5;
      alpha = on ? peak : 0.1;
      color = CONTAM_GLOW;
      under = 0.12;
    } else {
      const on = (t * 6) % 1 < 0.88;
      alpha = on ? Math.min(0.95, 0.58 + 0.37 * d) : 0.42;
      color = CONTAM_GLOW;
      under = 0.28;
    }

    alpha *= appear * slot.fade;
    const along = slot.edge === 'top' || slot.edge === 'bottom';
    const mid = along ? slot.cx : slot.cy;
    const start = mid - ((spec.teeth - 1) * spec.gap) / 2;

    for (let i = 0; i < spec.teeth; i++) {
      const c = Math.round(start + i * spec.gap);
      const len = spec.h + extra;
      if (along) {
        const x = c;
        const y = slot.edge === 'top' ? slot.cy : slot.cy - len + 1;
        if (under > 0) fill(ctx, CONTAM_CORE, under * appear * slot.fade, x, y, 1, len);
        fill(ctx, color, alpha, x, y, spec.w, len);
      } else {
        const y = c;
        const x = slot.edge === 'left' ? slot.cx : slot.cx - len + 1;
        if (under > 0) fill(ctx, CONTAM_CORE, under * appear * slot.fade, x, y, len, 1);
        fill(ctx, color, alpha, x, y, len, spec.w);
      }
    }
  }
}

function formOf(state: AIState, detection: number): PulseForm {
  if (state === AIState.CHASE) return 'lock';
  if (state === AIState.ALERT) return 'search';
  if (state === AIState.RETURN && detection < APPEAR_LINE) return 'notice';
  return 'notice';
}

function worldToScreenX(view: PulseViewBox, x: number): number {
  return ((x - view.worldX) / view.worldW) * LOGICAL_W;
}

function worldToScreenY(view: PulseViewBox, y: number): number {
  return ((y - view.worldY) / view.worldH) * LOGICAL_H;
}

function projectToRim(px: number, py: number, tx: number, ty: number): { edge: Edge; x: number; y: number } | null {
  const dx = tx - px;
  const dy = ty - py;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null;

  const hits: { edge: Edge; x: number; y: number; t: number }[] = [];
  const push = (edge: Edge, x: number, y: number, t: number): void => {
    if (t <= 0) return;
    if (x < -1 || x > LOGICAL_W + 1 || y < -1 || y > LOGICAL_H + 1) return;
    hits.push({ edge, x, y, t });
  };

  if (Math.abs(dx) > 1e-6) {
    const tL = (0 - px) / dx;
    push('left', 0, py + dy * tL, tL);
    const tR = (LOGICAL_W - px) / dx;
    push('right', LOGICAL_W, py + dy * tR, tR);
  }
  if (Math.abs(dy) > 1e-6) {
    const tT = (0 - py) / dy;
    push('top', px + dx * tT, 0, tT);
    const tB = (LOGICAL_H - py) / dy;
    push('bottom', px + dx * tB, LOGICAL_H, tB);
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.t - b.t);
  const hit = hits[0]!;
  return clampToLegal(hit.edge, hit.x, hit.y);
}

function clampToLegal(edge: Edge, x: number, y: number): { edge: Edge; x: number; y: number } | null {
  let cx = x;
  let cy = y;
  if (edge === 'top') {
    cy = LEGAL.top.y;
    if (cx < LEGAL.top.x0) cx = LEGAL.top.x0;
    if (cx > LEGAL.top.x1) cx = LEGAL.top.x1;
    if (x < CORNER_GUARD) cx = LEGAL.top.x0;
    if (x > LOGICAL_W - CORNER_GUARD) cx = LEGAL.top.x1;
  } else if (edge === 'bottom') {
    cy = LEGAL.bottom.y;
    if (cx < LEGAL.bottom.x0) cx = LEGAL.bottom.x0;
    if (cx > LEGAL.bottom.x1) cx = LEGAL.bottom.x1;
    if (x < CORNER_GUARD) cx = LEGAL.bottom.x0;
    if (x > LOGICAL_W - CORNER_GUARD) cx = LEGAL.bottom.x1;
  } else if (edge === 'left') {
    cx = LEGAL.left.x;
    if (cy < LEGAL.left.y0) cy = LEGAL.left.y0;
    if (cy > LEGAL.left.y1) cy = LEGAL.left.y1;
    if (y < CORNER_GUARD) cy = LEGAL.left.y0;
    if (y > LOGICAL_H - CORNER_GUARD) cy = LEGAL.left.y1;
  } else {
    cx = LEGAL.right.x;
    if (cy < LEGAL.right.y0) cy = LEGAL.right.y0;
    if (cy > LEGAL.right.y1) cy = LEGAL.right.y1;
    if (y < CORNER_GUARD) cy = LEGAL.right.y0;
    if (y > LEGAL.right.y1) cy = LEGAL.right.y1;
  }

  if (cx >= CIRCLE_REJECT.x && cy >= CIRCLE_REJECT.y) return null;
  return { edge, x: Math.round(cx), y: Math.round(cy) };
}

function angleDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

function fill(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (alpha <= 0 || w <= 0 || h <= 0) return;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.globalAlpha = 1;
}
