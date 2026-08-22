/**
 * Contamination-lexicon gallery: one hall at a time (portfolio × substrate),
 * viewport virtualization, DOM labels, inspect live specimen.
 * Production scheme D only. Contract: docs/tasks/iteration-4.md (I4-B / I4-C).
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { getFormRenderer } from '@/entities/form-renderers/registry';
import type {
  FormAttachContext,
  FormVisual,
  FormVisualPose,
  FormVisualSignal,
} from '@/entities/form-renderers/form-renderer';
import {
  isLexiconFragmentId,
  LEXICON_DEFAULT_FRAGMENT,
  LEXICON_FRAGMENT_IDS,
} from '@/entities/form-renderers/d/fragment-ramp';
import {
  DISPLAY_TOKEN_DATA,
  LEXEME_DATA,
  PORTFOLIO_DATA,
  SUBSTRATE_DATA,
  UTTERANCE_DATA,
  type CoverageId,
  type PortfolioId,
} from '@/generated/contamination-lexicon-data';
import { mix32 } from '@/generation/seed-fork';
import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { bindGymCamera, type GymCameraHandle } from '@/gym/gym-camera';
import {
  coverageOptions,
  portfolioOptions,
  substrateOptions,
} from '@/gym/gym-lexicon-form';
import {
  CANONICAL_SEED,
  enumerateGallerySpecimens,
  galleryDedupeCopy,
  type GallerySpecimen,
} from '@/gym/lexicon-gallery-catalog';

const TILE = GAME_CONSTANTS.TILE_SIZE;
const STAIN_SINK = { x: -100000, y: -100000 };
const CELL_SIZE: Record<PortfolioId, number> = { jia: 96, yi: 96, bing: 120, ding: 192 };
const ATTACH_CAP: Record<PortfolioId, number> = { jia: 8, yi: 12, bing: 12, ding: 8 };
const COVERAGES: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const PORTFOLIO_NAME: Record<PortfolioId, string> = { jia: '甲', yi: '乙', bing: '丙', ding: '丁' };
const CONTINUITY_LABEL: Record<string, string> = {
  monolith: '整块',
  shards: '碎裂',
  colony: '菌落',
  field: '场',
};
const STOP_FAMILY_LABEL: Record<string, string> = {
  core_strike: '打核',
  scatter_rejoin: '打散重组',
  unkillable: '打不死',
};
const DEPTH: Record<PortfolioId, number> = {
  jia: 25,
  yi: 20,
  bing: 1,
  ding: GAME_CONSTANTS.CONTAMINATION.VOLUME_DEPTH,
};
const START_ZOOM: Record<PortfolioId, number> = { jia: 1.25, yi: 1.25, bing: 1, ding: 0.7 };
const GRID_DEPTH = 0.4;
const SELECT_DEPTH = 46;
const INSPECT_DBL_MS = 400;
const FACINGS: readonly { id: FormVisualPose['facing4']; label: string }[] = [
  { id: 'up', label: '北' },
  { id: 'right', label: '东' },
  { id: 'down', label: '南' },
  { id: 'left', label: '西' },
];
const SIGNALS: readonly FormVisualSignal[] = ['idle', 'awake', 'strike', 'inflated'];
const CORE_POLICY_LABEL: Record<string, string> = {
  exposed: '核露',
  standard: '核常规',
  obscured: '核埋',
  none: '无核',
};

interface HallCell {
  readonly specimen: GallerySpecimen;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

interface HallBand {
  readonly coverage: CoverageId;
  readonly x: number;
  readonly y: number;
}

interface AttachedCell {
  readonly cell: HallCell;
  readonly visual: FormVisual;
}

interface InspectState {
  readonly cell: HallCell;
  visual: FormVisual;
  facing: FormVisualPose['facing4'];
  signal: FormVisualSignal;
  seed: number;
}

export class GymLexiconGalleryScene extends Phaser.Scene {
  private cameraHandle: GymCameraHandle | null = null;
  private includeIllegal = false;
  private fragmentTypeId = LEXICON_DEFAULT_FRAGMENT;
  private specimens: readonly GallerySpecimen[] = [];
  private hallPortfolio: PortfolioId = 'jia';
  private hallSubstrate = 'organic_remnant';
  private cells: HallCell[] = [];
  private bands: HallBand[] = [];
  private readonly attached = new Map<string, AttachedCell>();
  private selectedKey: string | null = null;
  private hoveredKey: string | null = null;
  private inspect: InspectState | null = null;
  private lastClickAt = 0;
  private lastClickKey: string | null = null;
  private viewStamp = '';
  private grid: Phaser.GameObjects.Graphics | null = null;
  private selectMark: Phaser.GameObjects.Graphics | null = null;
  private bound = false;

  constructor() {
    super({ key: 'GymLexiconGalleryScene' });
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);
    this.input.mouse?.disableContextMenu();

    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 污染句法陈列馆';
    this.setStatus('拖动画布平移，滚轮缩放。点格选中。双击或侧栏检视看动作。浏览态静帧。');

    this.grid = this.add.graphics().setDepth(GRID_DEPTH);
    this.selectMark = this.add.graphics().setDepth(SELECT_DEPTH);

    this.fillFragmentSelect();
    this.bindDom();
    this.reloadCatalog();
    this.enterFirstHall();

    this.cameraHandle = bindGymCamera(this, { onClick: this.onCanvasClick });
    this.input.on('pointermove', this.onPointerHover, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(_time: number, delta: number): void {
    const camera = this.cameras.main;
    const stamp = `${Math.round(camera.scrollX)},${Math.round(camera.scrollY)},${Math.round(camera.zoom * 200)}`;
    if (stamp !== this.viewStamp) {
      this.viewStamp = stamp;
      this.reconcile();
    }
    if (this.inspect) this.inspect.visual.update(inspectPose(this.inspect, delta));
    this.syncCaptions();
    this.paintSelect();
  }

  private bindDom(): void {
    if (this.bound) return;
    this.bound = true;
    document.getElementById('gym-gallery-fragment')?.addEventListener('change', this.onFragmentChange);
    document.getElementById('gym-gallery-illegal')?.addEventListener('change', this.onIllegalChange);
    document.getElementById('gym-gallery-nav')?.addEventListener('click', this.onNavClick);
    document.getElementById('gym-gallery-inspect')?.addEventListener('click', this.onInspectClick);
    document.addEventListener('keydown', this.onDocKey);
  }

  private unbindDom(): void {
    if (!this.bound) return;
    this.bound = false;
    document.getElementById('gym-gallery-fragment')?.removeEventListener('change', this.onFragmentChange);
    document.getElementById('gym-gallery-illegal')?.removeEventListener('change', this.onIllegalChange);
    document.getElementById('gym-gallery-nav')?.removeEventListener('click', this.onNavClick);
    document.getElementById('gym-gallery-inspect')?.removeEventListener('click', this.onInspectClick);
    document.removeEventListener('keydown', this.onDocKey);
  }

  private readonly onFragmentChange = (): void => {
    const raw = selectValue('gym-gallery-fragment');
    this.fragmentTypeId = isLexiconFragmentId(raw) ? raw : LEXICON_DEFAULT_FRAGMENT;
    this.reattachVisible();
    this.reattachInspect();
  };

  private readonly onIllegalChange = (): void => {
    const el = document.getElementById('gym-gallery-illegal');
    this.includeIllegal = el instanceof HTMLInputElement && el.checked;
    const keepPortfolio = this.hallPortfolio;
    const keepSubstrate = this.hallSubstrate;
    this.reloadCatalog();
    const still = this.specimens.some((row) => row.portfolio === keepPortfolio && row.substrate === keepSubstrate);
    if (still) this.enterHall(keepPortfolio, keepSubstrate);
    else this.enterFirstHall();
  };

  private readonly onNavClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-portfolio][data-substrate]');
    if (!(button instanceof HTMLButtonElement)) return;
    const portfolio = button.dataset.portfolio;
    const substrate = button.dataset.substrate;
    if (!isPortfolioId(portfolio) || !substrate) return;
    this.enterHall(portfolio, substrate);
  };

  private readonly onCanvasClick = (pointer: Phaser.Input.Pointer): void => {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = this.hitCell(world.x, world.y);
    const now = this.time.now;
    const key = cell?.specimen.visualKey ?? null;
    const doubled = Boolean(cell && key && key === this.lastClickKey && now - this.lastClickAt <= INSPECT_DBL_MS);
    this.lastClickAt = now;
    this.lastClickKey = key;
    if (doubled && cell) {
      this.openInspect(cell);
      return;
    }
    if (this.inspect) return;
    this.selectedKey = key;
    this.paintHover();
    this.paintSelect();
    this.paintInspect();
  };

  private readonly onPointerHover = (pointer: Phaser.Input.Pointer): void => {
    if (this.cameraHandle?.isDragging()) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = this.hitCell(world.x, world.y);
    const next = cell?.specimen.visualKey ?? null;
    if (next === this.hoveredKey) return;
    this.hoveredKey = next;
    this.paintHover();
  };

  private readonly onInspectClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    if (button.dataset.inspectOpen !== undefined) {
      const cell = this.cells.find((row) => row.specimen.visualKey === this.selectedKey);
      if (cell) this.openInspect(cell);
      return;
    }
    if (button.dataset.inspectClose !== undefined) {
      this.closeInspect(true);
      return;
    }
    const facing = button.dataset.facing;
    if (isFacing4(facing)) {
      this.setInspectFacing(facing);
      return;
    }
    const signal = button.dataset.signal;
    if (isSignal(signal)) {
      this.setInspectSignal(signal);
      return;
    }
    if (button.dataset.reroll !== undefined) this.rerollInspectSeed();
  };

  private readonly onDocKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    if (!this.inspect) return;
    event.preventDefault();
    this.closeInspect(true);
  };

  private reloadCatalog(): void {
    this.specimens = enumerateGallerySpecimens({
      includeIllegal: this.includeIllegal,
      fragmentTypeId: this.fragmentTypeId,
    });
    this.paintNav();
  }

  private enterFirstHall(): void {
    const first = this.specimens[0];
    if (!first) {
      this.enterHall('jia', 'organic_remnant');
      return;
    }
    this.enterHall(first.portfolio, first.substrate);
  }

  private enterHall(portfolio: PortfolioId, substrate: string): void {
    this.closeInspect(false);
    this.destroyAttached();
    this.hallPortfolio = portfolio;
    this.hallSubstrate = substrate;
    this.selectedKey = null;
    this.hoveredKey = null;
    const laid = layoutHall(
      this.specimens.filter((row) => row.portfolio === portfolio && row.substrate === substrate),
      CELL_SIZE[portfolio],
    );
    this.cells = laid.cells;
    this.bands = laid.bands;
    this.paintHallChrome();
    this.paintNav();
    this.paintDedupe();
    this.paintHover();
    this.paintInspect();
    this.paintRoster();
    this.fitCamera(laid.bounds, portfolio);
    this.viewStamp = '';
    this.reconcile();
    this.syncCaptions();
  }

  private fitCamera(
    bounds: { x: number; y: number; w: number; h: number },
    portfolio: PortfolioId,
  ): void {
    const camera = this.cameras.main;
    camera.setBounds(bounds.x, bounds.y, Math.max(bounds.w, 64), Math.max(bounds.h, 64));
    camera.setZoom(START_ZOOM[portfolio]);
    const first = this.cells[0];
    if (first) camera.centerOn(first.x, first.y);
    else camera.centerOn(bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.5);
  }

  private paintHallChrome(): void {
    const g = this.grid;
    if (!g) return;
    g.clear();
    g.lineStyle(1, 0x2a2d32, 0.9);
    for (const cell of this.cells) {
      g.strokeRect(cell.x - cell.size * 0.5, cell.y - cell.size * 0.5, cell.size, cell.size);
    }
  }

  private paintSelect(): void {
    const g = this.selectMark;
    if (!g) return;
    g.clear();
    const cell = this.cells.find((row) => row.specimen.visualKey === this.selectedKey);
    if (!cell) return;
    g.lineStyle(2, 0x1aad96, 0.95);
    g.strokeRect(cell.x - cell.size * 0.5, cell.y - cell.size * 0.5, cell.size, cell.size);
  }

  private reconcile(): void {
    const camera = this.cameras.main;
    const view = camera.worldView;
    const cellSize = CELL_SIZE[this.hallPortfolio];
    const pad = cellSize;
    const left = view.x - pad;
    const top = view.y - pad;
    const right = view.x + view.width + pad;
    const bottom = view.y + view.height + pad;
    const visible = this.cells.filter((cell) => {
      const half = cell.size * 0.5;
      return cell.x + half >= left && cell.x - half <= right && cell.y + half >= top && cell.y - half <= bottom;
    });
    const midX = camera.midPoint.x;
    const midY = camera.midPoint.y;
    visible.sort((a, b) => dist2(a.x, a.y, midX, midY) - dist2(b.x, b.y, midX, midY));
    const inspectKey = this.inspect?.cell.specimen.visualKey;
    const cap = ATTACH_CAP[this.hallPortfolio];
    const keep = visible.filter((cell) => cell.specimen.visualKey !== inspectKey).slice(0, cap);
    const keepKeys = new Set(keep.map((cell) => cell.specimen.visualKey));
    for (const [key, row] of this.attached) {
      if (keepKeys.has(key)) continue;
      row.visual.destroy();
      this.attached.delete(key);
    }
    for (const cell of keep) {
      if (this.attached.has(cell.specimen.visualKey)) continue;
      this.attachCell(cell);
    }
  }

  private attachCell(cell: HallCell): void {
    const renderer = getFormRenderer('d-mixed');
    if (renderer?.ready !== true) return;
    const visual = renderer.attach(this.attachContext(cell));
    visual.update(browsePose(cell));
    this.attached.set(cell.specimen.visualKey, { cell, visual });
  }

  private attachContext(cell: HallCell): FormAttachContext {
    const { specimen, x, y } = cell;
    const field = specimen.form.continuity === 'field';
    const pinW = specimen.portfolio === 'ding' ? (field ? TILE * 8 : TILE * 6) : undefined;
    const pinH = specimen.portfolio === 'ding' ? (field ? TILE * 12 : TILE * 6) : undefined;
    const pin =
      specimen.portfolio === 'jia'
        ? undefined
        : specimen.portfolio === 'ding'
          ? {
              kind: 'volume' as const,
              x: x - (pinW ?? TILE * 6) * 0.5,
              y: y - (pinH ?? TILE * 6) * 0.5,
              width: pinW,
              height: pinH,
            }
          : specimen.portfolio === 'yi'
            ? { kind: 'wall' as const, x, y }
            : { kind: 'cluster' as const, x, y };
    return {
      scene: this,
      form: specimen.form,
      seed: specimen.seed,
      depth: DEPTH[specimen.portfolio],
      fragmentTypeId: this.fragmentTypeId,
      textureNamespace: galleryTextureNamespace(specimen.visualKey),
      stainWorldPoint: STAIN_SINK,
      pin,
    };
  }

  private reattachVisible(): void {
    const cells = [...this.attached.values()].map((row) => row.cell);
    this.destroyAttached();
    for (const cell of cells) this.attachCell(cell);
    this.syncCaptions();
  }

  private destroyAttached(): void {
    for (const row of this.attached.values()) row.visual.destroy();
    this.attached.clear();
  }

  private openInspect(cell: HallCell): void {
    if (this.inspect?.cell.specimen.visualKey === cell.specimen.visualKey) {
      this.paintInspect();
      return;
    }
    this.closeInspect(false);
    this.selectedKey = cell.specimen.visualKey;
    const hall = this.attached.get(cell.specimen.visualKey);
    if (hall) {
      hall.visual.destroy();
      this.attached.delete(cell.specimen.visualKey);
    }
    const visual = this.attachInspectVisual(cell, cell.specimen.seed);
    if (!visual) return;
    this.inspect = {
      cell,
      visual,
      facing: 'down',
      signal: 'idle',
      seed: cell.specimen.seed,
    };
    this.cameras.main.centerOn(cell.x, cell.y);
    this.viewStamp = '';
    this.reconcile();
    this.paintHover();
    this.paintInspect();
    this.setStatus('检视：四朝向与信号相。Esc 或关闭回到厅。浏览格仍是静帧。');
  }

  private closeInspect(reattachHall: boolean): void {
    if (!this.inspect) {
      this.paintInspect();
      return;
    }
    this.inspect.visual.destroy();
    this.inspect = null;
    this.paintInspect();
    this.setStatus('拖动画布平移，滚轮缩放。点格选中。双击或侧栏检视看动作。浏览态静帧。');
    if (reattachHall) {
      this.viewStamp = '';
      this.reconcile();
    }
  }

  private reattachInspect(): void {
    if (!this.inspect) return;
    this.inspect.visual.destroy();
    const visual = this.attachInspectVisual(this.inspect.cell, this.inspect.seed);
    if (!visual) {
      this.inspect = null;
      this.paintInspect();
      return;
    }
    this.inspect.visual = visual;
    this.paintInspect();
  }

  private attachInspectVisual(cell: HallCell, seed: number): FormVisual | null {
    const renderer = getFormRenderer('d-mixed');
    if (renderer?.ready !== true) return null;
    const stain =
      cell.specimen.portfolio === 'ding' ? { x: cell.x, y: cell.y } : STAIN_SINK;
    const visual = renderer.attach({
      ...this.attachContext(cell),
      seed,
      textureNamespace: inspectTextureNamespace(cell.specimen.visualKey),
      stainWorldPoint: stain,
    });
    visual.update(
      inspectPose(
        {
          cell,
          visual,
          facing: this.inspect?.facing ?? 'down',
          signal: this.inspect?.signal ?? 'idle',
          seed,
        },
        0,
      ),
    );
    return visual;
  }

  private setInspectFacing(facing: FormVisualPose['facing4']): void {
    if (!this.inspect) return;
    this.inspect.facing = facing;
    this.inspect.visual.update(inspectPose(this.inspect, 0));
    this.paintInspect();
  }

  private setInspectSignal(signal: FormVisualSignal): void {
    if (!this.inspect) return;
    if (!signalsOf(this.inspect.cell.specimen.portfolio).has(signal)) return;
    this.inspect.signal = signal;
    this.inspect.visual.update(inspectPose(this.inspect, 0));
    this.paintInspect();
  }

  private rerollInspectSeed(): void {
    if (!this.inspect) return;
    const portfolio = this.inspect.cell.specimen.portfolio;
    if (portfolio === 'jia') return;
    const next = mix32(this.inspect.seed, `gallery-inspect:${portfolio}`);
    this.inspect.visual.destroy();
    this.inspect.seed = next;
    const visual = this.attachInspectVisual(this.inspect.cell, next);
    if (!visual) {
      this.inspect = null;
      this.paintInspect();
      return;
    }
    this.inspect.visual = visual;
    this.paintInspect();
  }

  private hitCell(wx: number, wy: number): HallCell | null {
    for (const cell of this.cells) {
      const half = cell.size * 0.5;
      if (Math.abs(wx - cell.x) <= half && Math.abs(wy - cell.y) <= half) return cell;
    }
    return null;
  }

  private fillFragmentSelect(): void {
    const el = document.getElementById('gym-gallery-fragment');
    if (!(el instanceof HTMLSelectElement)) return;
    el.replaceChildren();
    for (const id of LEXICON_FRAGMENT_IDS) {
      el.add(new Option(RIFT_FRAGMENT_DATA[id]?.displayName ?? id, id));
    }
    el.value = LEXICON_DEFAULT_FRAGMENT;
    this.fragmentTypeId = LEXICON_DEFAULT_FRAGMENT;
  }

  private paintNav(): void {
    const nav = document.getElementById('gym-gallery-nav');
    if (!nav) return;
    nav.replaceChildren();
    for (const port of portfolioOptions()) {
      const halls: { id: string; label: string; count: number }[] = [];
      for (const sub of substrateOptions(port.id)) {
        const count = this.specimens.filter((row) => row.portfolio === port.id && row.substrate === sub.id).length;
        if (count === 0) continue;
        halls.push({ id: sub.id, label: sub.label, count });
      }
      if (halls.length === 0) continue;
      const heading = document.createElement('h3');
      heading.textContent = port.label;
      nav.append(heading);
      for (const hall of halls) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.portfolio = port.id;
        button.dataset.substrate = hall.id;
        if (port.id === this.hallPortfolio && hall.id === this.hallSubstrate) {
          button.setAttribute('aria-current', 'true');
        }
        const name = document.createElement('span');
        name.className = 'gym-gal-sub';
        name.textContent = hall.label;
        const count = document.createElement('span');
        count.className = 'gym-gal-n';
        count.textContent = String(hall.count);
        button.append(name, count);
        nav.append(button);
      }
    }
  }

  private paintDedupe(): void {
    const host = document.getElementById('gym-gallery-dedupe');
    if (!host) return;
    const hallN = this.cells.length;
    const portM = this.specimens.filter((row) => row.portfolio === this.hallPortfolio).length;
    const totalT = this.specimens.length;
    const copy = galleryDedupeCopy(this.hallPortfolio);
    host.replaceChildren();
    host.append(
      kvLine('本厅视觉不同', String(hallN)),
      kvLine('本孔谱合计', String(portM)),
      kvLine('本课合计', String(totalT)),
    );
    const range = document.createElement('p');
    range.textContent = '碎片是着色方言。本课按一种碎片陈列视觉身份。完整笛卡尔约 2700，本课不铺。';
    host.append(range);
    host.append(namedList('静帧占格', copy.occupying.map((row) => row.item)));
    host.append(namedList('静帧不占格', copy.nonOccupying.map((row) => row.item)));
    const rules = document.createElement('dl');
    for (const row of copy.rules) {
      const dt = document.createElement('dt');
      dt.textContent = row.item;
      const dd = document.createElement('dd');
      dd.textContent = row.value;
      rules.append(dt, dd);
    }
    host.append(rules);
    host.append(kvLine('规范种子', String(CANONICAL_SEED)));
  }

  private paintHover(): void {
    const host = document.getElementById('gym-gallery-hover');
    if (!host) return;
    const key = this.hoveredKey ?? this.selectedKey;
    const cell = this.cells.find((row) => row.specimen.visualKey === key);
    host.replaceChildren();
    if (!cell) {
      const p = document.createElement('p');
      p.textContent = '移到格子上，或点选一只。';
      host.append(p);
      return;
    }
    const dl = document.createElement('dl');
    for (const row of hoverRows(cell.specimen)) {
      const dt = document.createElement('dt');
      dt.textContent = row.item;
      const dd = document.createElement('dd');
      dd.textContent = row.value;
      dl.append(dt, dd);
    }
    host.append(dl);
  }

  private paintInspect(): void {
    const host = document.getElementById('gym-gallery-inspect');
    if (!host) return;
    host.replaceChildren();
    const inspect = this.inspect;
    if (!inspect) {
      const selected = this.cells.find((row) => row.specimen.visualKey === this.selectedKey);
      if (!selected) {
        const p = document.createElement('p');
        p.textContent = '点格选中，再点检视或双击。';
        host.append(p);
        return;
      }
      const open = document.createElement('button');
      open.type = 'button';
      open.dataset.inspectOpen = '';
      open.textContent = '检视';
      host.append(open);
      return;
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.dataset.inspectClose = '';
    close.textContent = '关闭检视';
    host.append(close);

    const faceLabel = document.createElement('p');
    faceLabel.className = 'gym-gal-k';
    faceLabel.textContent = '朝向';
    host.append(faceLabel, facingButtons(inspect.facing));

    const signalLabel = document.createElement('p');
    signalLabel.className = 'gym-gal-k';
    signalLabel.textContent = '信号相';
    host.append(signalLabel, signalButtons(inspect.cell.specimen.portfolio, inspect.signal));

    const portfolio = inspect.cell.specimen.portfolio;
    if (portfolio !== 'jia') {
      const reroll = document.createElement('button');
      reroll.type = 'button';
      reroll.dataset.reroll = '';
      reroll.textContent = portfolio === 'yi' ? '换锈斑' : '换种子';
      host.append(reroll);
    }

    const dl = document.createElement('dl');
    for (const row of inspectRows(inspect, this.fragmentTypeId)) {
      const dt = document.createElement('dt');
      dt.textContent = row.item;
      const dd = document.createElement('dd');
      dd.textContent = row.value;
      dl.append(dt, dd);
    }
    host.append(dl);
  }

  private paintRoster(): void {
    const el = document.getElementById('gym-roster');
    if (!el) return;
    el.replaceChildren();
    el.append(
      kvLine('孔谱', PORTFOLIO_NAME[this.hallPortfolio]),
      kvLine('基体', SUBSTRATE_DATA[this.hallSubstrate]?.displayToken ?? this.hallSubstrate),
      kvLine('本厅', String(this.cells.length)),
    );
  }

  private syncCaptions(): void {
    const overlay = document.getElementById('gym-gallery-captions');
    if (!overlay) return;
    overlay.replaceChildren();
    const camera = this.cameras.main;
    for (const band of this.bands) {
      const pos = worldToOverlay(this, overlay, band.x, band.y);
      if (!pos || !inOverlay(overlay, pos.x, pos.y)) continue;
      const cap = document.createElement('div');
      cap.className = 'gym-gal-band';
      cap.style.left = `${pos.x}px`;
      cap.style.top = `${pos.y}px`;
      cap.append(kvInline('覆盖深度', coverageLabel(band.coverage)));
      overlay.append(cap);
    }
    for (const { cell } of this.attached.values()) {
      const pos = worldToOverlay(this, overlay, cell.x, cell.y + cell.size * 0.5);
      if (!pos || !inOverlay(overlay, pos.x, pos.y)) continue;
      overlay.append(captionEl(cell, pos, camera.zoom));
    }
  }

  private setStatus(text: string): void {
    const status = document.getElementById('gym-status');
    if (status) status.textContent = text;
  }

  private onShutdown(): void {
    this.closeInspect(false);
    this.destroyAttached();
    this.cameraHandle?.destroy();
    this.cameraHandle = null;
    this.input.off('pointermove', this.onPointerHover, this);
    this.unbindDom();
    this.grid?.destroy();
    this.grid = null;
    this.selectMark?.destroy();
    this.selectMark = null;
    document.getElementById('gym-gallery-captions')?.replaceChildren();
    document.getElementById('gym-gallery-nav')?.replaceChildren();
    document.getElementById('gym-gallery-dedupe')?.replaceChildren();
    document.getElementById('gym-gallery-hover')?.replaceChildren();
    document.getElementById('gym-gallery-inspect')?.replaceChildren();
  }
}

function browsePose(cell: HallCell): FormVisualPose {
  return {
    x: cell.x,
    y: cell.y,
    facing4: 'down',
    moving: false,
    visibility: 1,
    signal: 'idle',
    deltaMs: 0,
  };
}

function galleryTextureNamespace(visualKey: string): string {
  return `gal_${visualKey.replace(/\|/g, '~')}`;
}

function inspectTextureNamespace(visualKey: string): string {
  return `gal_ins_${visualKey.replace(/\|/g, '~')}`;
}

function inspectPose(state: InspectState, deltaMs: number): FormVisualPose {
  return {
    x: state.cell.x,
    y: state.cell.y,
    facing4: state.facing,
    moving: state.cell.specimen.portfolio === 'jia',
    visibility: 1,
    signal: state.signal,
    deltaMs,
  };
}

function signalsOf(portfolio: PortfolioId): ReadonlySet<FormVisualSignal> {
  if (portfolio === 'jia') return new Set<FormVisualSignal>(SIGNALS);
  if (portfolio === 'yi') return new Set<FormVisualSignal>(['idle', 'strike']);
  if (portfolio === 'bing') return new Set<FormVisualSignal>(['idle', 'inflated']);
  return new Set<FormVisualSignal>(['idle', 'awake']);
}

function facingButtons(current: FormVisualPose['facing4']): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'gym-gal-btns';
  for (const face of FACINGS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.facing = face.id;
    button.textContent = face.label;
    button.setAttribute('aria-pressed', face.id === current ? 'true' : 'false');
    wrap.append(button);
  }
  return wrap;
}

function signalButtons(portfolio: PortfolioId, current: FormVisualSignal): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'gym-gal-btns';
  const allowed = signalsOf(portfolio);
  for (const id of SIGNALS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.signal = id;
    button.textContent = id;
    const ok = allowed.has(id);
    button.disabled = !ok;
    if (ok) button.setAttribute('aria-pressed', id === current ? 'true' : 'false');
    else {
      const hint = document.createElement('span');
      hint.className = 'gym-gal-hint';
      hint.textContent = '此孔谱无此相';
      button.append(hint);
    }
    wrap.append(button);
  }
  return wrap;
}

function inspectRows(
  state: InspectState,
  fragmentTypeId: string,
): readonly { item: string; value: string }[] {
  const specimen = state.cell.specimen;
  const form = specimen.form;
  const lex = form.lexemes;
  const rows: { item: string; value: string }[] = [
    { item: '孔谱', value: PORTFOLIO_NAME[form.portfolio] },
    { item: '占位', value: PORTFOLIO_DATA[form.portfolio].displayToken },
    { item: '基体', value: SUBSTRATE_DATA[form.substrate]?.displayToken ?? form.substrate },
    { item: '覆盖深度', value: coverageLabel(form.coverage) },
    { item: '连续性', value: CONTINUITY_LABEL[form.continuity] ?? form.continuity },
    { item: '运动', value: tokenOf(lex.motion) },
    { item: '感知', value: tokenOf(lex.sense) },
    { item: '节律', value: tokenOf(lex.rhythm) },
    { item: '接触', value: tokenOf(lex.contact) },
  ];
  if (specimen.utteranceIds.length === 0) {
    rows.push({ item: '成句', value: '无名填法' });
  } else {
    for (const id of specimen.utteranceIds) {
      rows.push({ item: '成句', value: UTTERANCE_DATA[id]?.onScreenMark ?? id });
    }
  }
  if (specimen.stopLoss === 'illegal') {
    rows.push({ item: '止损族', value: '非法组合' }, { item: '核策略', value: '无' });
  } else {
    rows.push(
      { item: '止损族', value: STOP_FAMILY_LABEL[specimen.stopLoss.family] ?? specimen.stopLoss.family },
      { item: '核策略', value: CORE_POLICY_LABEL[specimen.stopLoss.corePolicy] ?? specimen.stopLoss.corePolicy },
    );
  }
  rows.push(
    {
      item: '碎片身份',
      value: RIFT_FRAGMENT_DATA[fragmentTypeId]?.displayName ?? fragmentTypeId,
    },
    {
      item: '范围',
      value: specimen.enabledScope === 'sortie' ? '出击抽卡会抽到' : '仅练习场',
    },
  );
  if (form.portfolio === 'jia') {
    rows.push({ item: '族内变体', value: String(specimen.seedBucket + 1) });
  } else {
    rows.push(
      { item: '规范种子', value: String(CANONICAL_SEED) },
      { item: '检视种子', value: String(state.seed) },
    );
  }
  return rows;
}

function layoutHall(
  specimens: readonly GallerySpecimen[],
  cellSize: number,
): { cells: HallCell[]; bands: HallBand[]; bounds: { x: number; y: number; w: number; h: number } } {
  const cols = Math.max(4, Math.min(10, Math.round(960 / cellSize)));
  const rowGap = cellSize * 0.55;
  const bandGap = cellSize * 1.15;
  const originX = cellSize;
  const originY = cellSize * 0.7;
  const cells: HallCell[] = [];
  const bands: HallBand[] = [];
  let y = originY;
  let maxX = originX + cellSize;
  let maxY = originY + cellSize;
  for (const coverage of COVERAGES) {
    const rows = specimens.filter((row) => row.form.coverage === coverage);
    if (rows.length === 0) continue;
    bands.push({ coverage, x: originX, y: y - cellSize * 0.42 });
    let col = 0;
    let x = originX;
    for (const specimen of rows) {
      if (col >= cols) {
        col = 0;
        x = originX;
        y += cellSize + rowGap;
      }
      const cx = x + cellSize * 0.5;
      const cy = y + cellSize * 0.5;
      cells.push({ specimen, x: cx, y: cy, size: cellSize });
      maxX = Math.max(maxX, x + cellSize);
      maxY = Math.max(maxY, y + cellSize);
      x += cellSize;
      col += 1;
    }
    y += cellSize + bandGap;
  }
  const pad = cellSize * 1.5;
  return {
    cells,
    bands,
    bounds: { x: 0, y: 0, w: maxX + pad, h: maxY + pad },
  };
}

function captionEl(cell: HallCell, pos: { x: number; y: number }, zoom: number): HTMLElement {
  const cap = document.createElement('div');
  cap.className = 'gym-gal-cap';
  cap.style.left = `${pos.x}px`;
  cap.style.top = `${pos.y}px`;
  cap.style.transform = `translate(-50%, ${Math.max(4, 6 * zoom)}px)`;
  const form = cell.specimen.form;
  cap.append(
    kvInline('孔谱', PORTFOLIO_NAME[form.portfolio]),
    kvInline('基体', SUBSTRATE_DATA[form.substrate]?.displayToken ?? form.substrate),
    kvInline('覆盖深度', coverageLabel(form.coverage)),
  );
  if (form.portfolio === 'jia') {
    cap.append(kvInline('族内变体', String(cell.specimen.seedBucket + 1)));
  }
  if (cell.specimen.stopLoss === 'illegal') {
    const badge = document.createElement('span');
    badge.className = 'gym-gal-badge';
    badge.textContent = '抽卡丢弃';
    cap.append(badge);
  }
  return cap;
}

function hoverRows(specimen: GallerySpecimen): readonly { item: string; value: string }[] {
  const form = specimen.form;
  const lex = form.lexemes;
  const stop =
    specimen.stopLoss === 'illegal'
      ? '非法组合'
      : STOP_FAMILY_LABEL[specimen.stopLoss.family] ?? specimen.stopLoss.family;
  return [
    { item: '基体', value: SUBSTRATE_DATA[form.substrate]?.displayToken ?? form.substrate },
    { item: '覆盖深度', value: coverageLabel(form.coverage) },
    { item: '连续性', value: CONTINUITY_LABEL[form.continuity] ?? form.continuity },
    { item: '运动', value: tokenOf(lex.motion) },
    { item: '感知', value: tokenOf(lex.sense) },
    { item: '节律', value: tokenOf(lex.rhythm) },
    { item: '接触', value: tokenOf(lex.contact) },
    { item: '成句', value: utteranceLabel(specimen.utteranceIds) },
    { item: '止损族', value: stop },
  ];
}

function utteranceLabel(ids: readonly string[]): string {
  if (ids.length === 0) return '无名填法';
  return ids.map((id) => UTTERANCE_DATA[id]?.onScreenMark ?? id).join('、');
}

function tokenOf(id: string): string {
  return LEXEME_DATA[id]?.displayToken ?? DISPLAY_TOKEN_DATA[id]?.displayToken ?? id;
}

function coverageLabel(id: CoverageId): string {
  return coverageOptions().find((row) => row.id === id)?.label ?? DISPLAY_TOKEN_DATA[`coverage_${id}`]?.displayToken ?? id;
}

function kvLine(item: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'gym-gal-kv';
  const k = document.createElement('span');
  k.className = 'gym-gal-k';
  k.textContent = item;
  const v = document.createElement('span');
  v.className = 'gym-gal-v';
  v.textContent = value;
  row.append(k, v);
  return row;
}

function kvInline(item: string, value: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'gym-gal-pair';
  const k = document.createElement('span');
  k.className = 'gym-gal-k';
  k.textContent = item;
  const v = document.createElement('span');
  v.className = 'gym-gal-v';
  v.textContent = value;
  wrap.append(k, v);
  return wrap;
}

function namedList(title: string, items: readonly string[]): HTMLElement {
  const block = document.createElement('div');
  const h = document.createElement('p');
  h.className = 'gym-gal-k';
  h.textContent = title;
  const ul = document.createElement('ul');
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    ul.append(li);
  }
  block.append(h, ul);
  return block;
}

function worldToOverlay(
  scene: Phaser.Scene,
  overlay: HTMLElement,
  wx: number,
  wy: number,
): { x: number; y: number } | null {
  const camera = scene.cameras.main;
  const canvas = scene.game.canvas;
  if (!canvas) return null;
  const cr = canvas.getBoundingClientRect();
  const or = overlay.getBoundingClientRect();
  const sx = (wx - camera.worldView.x) * camera.zoom;
  const sy = (wy - camera.worldView.y) * camera.zoom;
  const scaleX = cr.width / scene.scale.width;
  const scaleY = cr.height / scene.scale.height;
  return {
    x: cr.left - or.left + sx * scaleX,
    y: cr.top - or.top + sy * scaleY,
  };
}

function inOverlay(overlay: HTMLElement, x: number, y: number): boolean {
  return x >= -40 && y >= -40 && x <= overlay.clientWidth + 40 && y <= overlay.clientHeight + 40;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function selectValue(id: string): string {
  const el = document.getElementById(id);
  return el instanceof HTMLSelectElement ? el.value : '';
}

function isPortfolioId(value: string | undefined): value is PortfolioId {
  return value === 'jia' || value === 'yi' || value === 'bing' || value === 'ding';
}

function isFacing4(value: string | undefined): value is FormVisualPose['facing4'] {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

function isSignal(value: string | undefined): value is FormVisualSignal {
  return value === 'idle' || value === 'awake' || value === 'strike' || value === 'inflated';
}
