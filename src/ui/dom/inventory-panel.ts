/** Shared inventory PRESENTATION. Ownership, slots, item stats, transactions,
 * capacity validation, and world time remain the injected domain's concern. */
import { getDomUiRoot, injectPanelStyles } from './panel-styles';
import { ensureInventoryPanelStyles } from './inventory-panel-styles';

export type InventoryPanelMode = 'catalog' | 'prepare' | 'rift';
export interface InventoryPanelStat { label: string; value: string | number; comparison?: string | number }
export interface InventoryPanelItem {
  id: string;
  kind: 'weapon' | 'contaminant';
  name: string;
  quality?: string;
  qualityRank?: number;
  /** Integer tenths; presentation alone divides by ten. */
  weight: number;
  location: 'stash' | 'carried' | 'ground' | 'defense';
  equippedLabel?: string;
  description?: string;
  explanations?: readonly { label: string; text: string }[];
  /** Read-only proposed equipment result, never committed stats. */
  preview?: string;
  stats?: readonly InventoryPanelStat[];
  /** Trusted local image path/data URL, not HTML. Omit for native icons. */
  icon?: string;
  /** Legal tool targets supplied by domain. Omitted = show unlocked tool slots. */
  toolSlots?: readonly string[];
  /** Unoffered residue; navigation cannot consume or equip the item. */
  canOffer?: boolean;
  canEquip?: boolean;
  stageLabel?: string;
  usesRemaining?: number;
  /** Weapon-only display ceiling; consumption still uses the shared lifecycle. */
  maxDurability?: number;
}
export interface InventoryEquipmentSlot { id: string; label: string; itemId?: string | null; locked?: boolean }
export interface InventoryPanelSnapshot {
  items: readonly InventoryPanelItem[];
  equipment: readonly InventoryEquipmentSlot[];
  weight: number;
  capacity: number;
  equippedWeight?: number;
  survival?: { resistancePercent: number; burdenSpeedFactor: number };
  message?: string;
  canDepart?: boolean;
  departReason?: string;
}
export type InventoryPanelAction =
  | { type: 'inspect'; itemId: string }
  | { type: 'discard'; itemId: string }
  | { type: 'equipWeapon'; itemId: string }
  | { type: 'equipTool'; itemId: string; slotId: string }
  | { type: 'unequipTool'; slotId: string }
  | { type: 'take' | 'store' | 'drop'; itemIds: string[] }
  | { type: 'exchange'; takeIds: string[]; dropIds: string[] };
export interface InventoryPanelActionResult { ok: boolean; message?: string }
export interface InventoryPanelOptions {
  mode: InventoryPanelMode;
  getSnapshot: () => InventoryPanelSnapshot;
  onAction: (action: InventoryPanelAction) => void | InventoryPanelActionResult | Promise<void | InventoryPanelActionResult>;
  onClose: () => void;
  onDepart?: () => void;
  onOffering?: () => void;
  mount?: HTMLElement;
  portrait?: string;
}
type Filter = 'all' | 'weapon' | 'contaminant';
type Sort = 'kept' | 'name' | 'weight';
type Lane = 'main' | 'nearby';
interface ViewMemory { focus: string | null; scroll: number }
interface ListElements { column: HTMLDivElement; heading: HTMLElement; count: HTMLElement; list: HTMLDivElement; position: HTMLDivElement; rows: Map<string, HTMLButtonElement>; ids: string[] }
const CROWBAR = `<svg viewBox="0 0 48 100" aria-hidden="true"><path fill="#272e2a" d="M18 11h5V6h13v4h7v13h-6V16H26v13h-4v48h5v12h-5v5H10v-5H5V77h6v8h6V29h-4V16h5z"/><path fill="#71756a" d="M20 13h5V9h10v4h5v7h-3v-5H24v15h-4v48h4v10h-5v4h-7v-3H8V78h3v9h8V29h-3V18h4z"/><path fill="#a2a28b" d="M20 13h5v-2h8v2h-9v16h-3v46h-2V29h1zM10 78h2v8h-2z"/><path fill="#655c44" d="M16 45h10v5H15v4h11v5H15v4h10v5H15V46z"/><path fill="#958568" d="M16 46h8v2h-8zM16 54h9v2h-9zM16 62h7v2h-7z"/><path fill="#454937" d="M27 10h4v2h-4zM20 35h3v3h-3zM13 87h3v3h-3z"/></svg>`;
const CONTAMINANT = `<svg viewBox="0 0 48 58" aria-hidden="true"><path fill="#262f29" d="M17 5h14v7h5v6h4v29h-5v7H12v-6H7V20h5v-8h5z"/><path fill="#5c6450" d="M19 8h10v7H16v6H11v24h6v6h15v-6h5V21h-7v-7H19z"/><path fill="#243e34" d="M17 21h15v20H15V27h-3v-4h5z"/><path fill="#759181" d="M18 25h9v4h-6v6h-5v-7h2zM27 34h5v5h-5z"/><path fill="#80745a" d="M8 20h29v4H8zM12 42h26v5H12zM22 8h4v42h-4z"/><path fill="#aaa080" d="M23 20h4v5h-4zM23 42h4v5h-4z"/></svg>`;
const DISCARD_HOLD_MS = 1500;
const formatWeight = (weight: number): string => (weight / 10).toLocaleString('en-US', { maximumFractionDigits: 1, useGrouping: false });
const locationName = (item: InventoryPanelItem): string => item.equippedLabel || ({ stash: '留存', carried: '随身', ground: '附近', defense: '守护中' }[item.location]);
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(className: string, text: string, action: () => void): HTMLButtonElement {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function putIcon(target: HTMLElement, item?: InventoryPanelItem): void {
  target.replaceChildren();
  if (!item) return;
  if (item.icon) {
    const img = element('img'); img.src = item.icon; img.alt = ''; img.draggable = false; target.append(img);
  } else target.innerHTML = item.kind === 'weapon' ? CROWBAR : CONTAMINANT;
}

class InventoryPanel {
  private panel: HTMLDivElement | null = null;
  private backdrop: HTMLDivElement | null = null;
  private options: InventoryPanelOptions | null = null;
  private snapshot: InventoryPanelSnapshot | null = null;
  private filter: Filter = 'all';
  private sort: Sort = 'kept';
  private focusId: string | null = null;
  private lane: Lane = 'main';
  private picks = new Set<string>();
  private takes = new Set<string>();
  private memory = new Map<string, ViewMemory>();
  private lists: Partial<Record<Lane, ListElements>> = {};
  private equipment!: HTMLDivElement;
  private detail!: HTMLElement;
  private detailActions!: HTMLElement;
  private detailHint!: HTMLElement;
  private weight!: HTMLElement;
  private message!: HTMLElement;
  private primary!: HTMLButtonElement;
  private exchangeInspect!: HTMLElement;
  private filters = new Map<Filter, HTMLButtonElement>();
  private equipmentSignature = '';
  private detailSignature = '';
  private signature = '';
  private localMessage = '';
  private busy = false;
  private suggestedGround = false;
  private revision = 0;
  private pendingScroll = new Map<Lane, number>();
  private previousFocus: HTMLElement | null = null;
  private discardTimer: ReturnType<typeof setTimeout> | null = null;
  private discardControl: HTMLButtonElement | null = null;

  isOpen(): boolean { return this.panel !== null; }

  showMessage(message: string): void { this.localMessage = message; this.renderFooter(); }

  open(options: InventoryPanelOptions): void {
    if (this.panel) this.close();
    injectPanelStyles();
    ensureInventoryPanelStyles();
    this.options = options;
    this.filter = 'all'; this.sort = 'kept';
    this.focusId = null; this.lane = 'main'; this.pendingScroll.clear();
    this.picks.clear(); this.takes.clear(); this.memory.clear(); this.filters.clear();
    this.signature = ''; this.equipmentSignature = ''; this.detailSignature = ''; this.localMessage = ''; this.busy = false; this.suggestedGround = false;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.revision++;
    this.create();
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('keyup', this.onKeyUp, true);
    document.addEventListener('pointerup', this.cancelDiscardHold, true);
    document.addEventListener('pointercancel', this.cancelDiscardHold, true);
    document.addEventListener('visibilitychange', this.cancelDiscardHold);
    window.addEventListener('blur', this.cancelDiscardHold);
    this.update();
    this.panel?.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.panel) return;
    this.cancelDiscardHold();
    const callback = this.options?.onClose;
    this.revision++;
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('keyup', this.onKeyUp, true);
    document.removeEventListener('pointerup', this.cancelDiscardHold, true);
    document.removeEventListener('pointercancel', this.cancelDiscardHold, true);
    document.removeEventListener('visibilitychange', this.cancelDiscardHold);
    window.removeEventListener('blur', this.cancelDiscardHold);
    this.panel.remove(); this.backdrop?.remove(); this.backdrop = null; this.panel = null; this.options = null; this.snapshot = null; this.lists = {};
    this.picks.clear(); this.takes.clear(); this.busy = false;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = null;
    callback?.();
  }

  update(snapshot?: InventoryPanelSnapshot): void {
    if (!this.options || !this.panel) return;
    const next = snapshot ?? this.options.getSnapshot();
    const signature = JSON.stringify(next);
    this.snapshot = next;
    if (signature === this.signature) { this.renderFooter(); return; }
    this.signature = signature;
    const eligible = new Set(next.items.filter(item => item.location === 'carried' && !this.isEquipped(item)).map(item => item.id));
    const nearby = new Set(next.items.filter(item => item.location === 'ground').map(item => item.id));
    for (const id of this.picks) if (!eligible.has(id)) this.picks.delete(id);
    for (const id of this.takes) if (!nearby.has(id)) this.takes.delete(id);
    if (this.exchange && !this.suggestedGround) {
      if (nearby.size === 1) this.takes.add([...nearby][0]!);
      this.suggestedGround = true;
    }
    this.render();
  }

  private get exchange(): boolean { return this.options?.mode === 'rift' && !!this.snapshot?.items.some(item => item.location === 'ground'); }
  private get items(): readonly InventoryPanelItem[] { return this.snapshot?.items ?? []; }
  private item(id: string | null): InventoryPanelItem | undefined { return this.items.find(item => item.id === id); }
  private isEquipped(item: InventoryPanelItem): boolean { return !!item.equippedLabel || !!this.snapshot?.equipment.some(slot => slot.itemId === item.id); }
  private memoryKey(lane = this.lane): string { return `${this.filter}:${this.sort}:${lane}`; }

  private create(): void {
    const embedded = this.options!.mode === 'catalog';
    const panel = element('div', `inventory-wrap ${embedded ? 'inventory-catalog' : 'game-panel crt-stack scene-menu'} is-${this.options!.mode}`); panel.id = 'inventory-panel'; panel.tabIndex = -1;
    panel.setAttribute('role', embedded ? 'region' : 'dialog'); if (!embedded) panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', this.options!.mode === 'prepare' ? '备行' : embedded ? '物件' : '本趟拾获');
    const header = element('header', 'inventory-header');
    header.append(element('h2', 'inventory-title', this.options!.mode === 'prepare' ? '备行' : '本趟拾获'));
    header.hidden = embedded;
    header.append(element('span', 'inventory-context', this.options!.mode === 'rift' ? '只收好这次带回的物件' : '沿旧路出发'));
    this.equipment = element('div', 'inventory-equipment');
    this.weight = element('div', 'inventory-weight'); header.append(this.weight);
    const close = button('inventory-close', 'Esc 收起', () => this.close()); close.setAttribute('aria-label', this.options!.mode === 'prepare' ? '离开备行' : '合上拾获'); header.append(close);
    this.equipment.setAttribute('aria-label', '本趟装备'); this.equipment.hidden = this.options!.mode !== 'prepare';
    const filters = element('nav', 'inventory-filters'); filters.setAttribute('aria-label', '物件筛选');
    for (const [value, label] of [['all', '全部'], ['weapon', '武器'], ['contaminant', '污染物']] as const) {
      const control = button('inventory-filter', label, () => this.changeFilter(value)); this.filters.set(value, control); filters.append(control);
    }
    const sort = element('select', 'inventory-sort'); sort.setAttribute('aria-label', '物件排序');
    for (const [value, label] of [['kept', '原来顺序'], ['name', '按名称'], ['weight', '按负重']] as const) {
      if (value === 'weight' && this.options!.mode !== 'rift') continue;
      const option = element('option', '', label); option.value = value; sort.append(option);
    }
    sort.addEventListener('change', () => { this.remember(); this.sort = sort.value as Sort; this.restore(); this.render(); }); filters.append(sort);
    this.exchangeInspect = element('div', 'inventory-exchange-inspect');
    const body = element('div', 'inventory-body');
    this.lists.nearby = this.makeList('nearby', '附近');
    this.lists.main = this.makeList('main', '物件');
    this.detail = element('aside', 'inventory-detail'); this.detail.setAttribute('aria-label', '正在查看的物件');
    const detailColumn = element('div', 'inventory-detail-column');
    this.detailHint = element('div', 'inventory-detail-hint');
    this.detailActions = element('div', 'inventory-actions');
    this.detailActions.setAttribute('aria-label', '当前物件操作');
    this.detail.addEventListener('scroll', this.updateDetailOverflow, { passive: true });
    this.detail.addEventListener('toggle', this.updateDetailOverflow, true);
    detailColumn.append(this.detail, this.detailHint, this.detailActions);
    body.append(this.lists.nearby.column, this.lists.main.column, detailColumn);
    const bottom = element('footer', 'inventory-bottom');
    this.message = element('div', 'inventory-message'); this.message.setAttribute('role', 'status'); this.message.setAttribute('aria-live', 'polite');
    const bottomRow = element('div', 'inventory-bottom-row');
    const help = element('span', 'inventory-key-help', embedded ? '↑↓ 查看 · Enter 操作' : this.options!.mode === 'prepare' ? '↑↓ 查看 · Tab 移步 · Esc 离开' : '↑↓ 查看 · Enter 操作 · Tab / Esc 合上');
    this.primary = button('inventory-primary', '', () => this.primaryAction());
    bottomRow.append(help, this.primary); bottom.append(this.message, bottomRow);
    panel.append(header, this.equipment, filters, this.exchangeInspect, body, bottom);
    panel.addEventListener('pointerdown', event => event.stopPropagation());
    panel.addEventListener('click', event => event.stopPropagation());
    panel.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
    if (!embedded) { this.backdrop = element('div', 'game-panel-backdrop scene-menu-backdrop'); getDomUiRoot().append(this.backdrop); }
    (this.options!.mount ?? getDomUiRoot()).append(panel); this.panel = panel;
  }

  private makeList(lane: Lane, title: string): ListElements {
    const column = element('div', 'inventory-list-column');
    const heading = element('div', 'inventory-column-heading'); const label = element('span', '', title); const count = element('strong'); heading.append(label, count);
    const list = element('div', 'inventory-list'); list.dataset.lane = lane; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', title);
    const position = element('div', 'inventory-position');
    column.append(heading, list, position);
    list.addEventListener('scroll', () => this.renderPosition(lane), { passive: true });
    return { column, heading: label, count, list, position, rows: new Map(), ids: [] };
  }

  private visibleItems(lane: Lane): InventoryPanelItem[] {
    const list = this.items.filter(item => {
      if (lane === 'nearby') return this.exchange && item.location === 'ground' && (this.filter === 'all' || item.kind === this.filter);
      if (item.location === 'ground') return false;
      if (this.options?.mode === 'rift' && this.isEquipped(item)) return false;
      if ((this.options?.mode === 'rift' || this.exchange) && item.location !== 'carried') return false;
      return this.filter === 'all' || item.kind === this.filter;
    });
    if (this.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || (b.qualityRank ?? 0) - (a.qualityRank ?? 0) || a.id.localeCompare(b.id));
    if (this.sort === 'weight') list.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
    return list;
  }

  private render(): void {
    if (!this.panel || !this.snapshot) return;
    this.panel.classList.toggle('is-exchange', this.exchange);
    this.lists.nearby!.column.hidden = !this.exchange;
    this.lists.nearby!.heading.textContent = '附近';
    this.lists.nearby!.list.setAttribute('aria-label', '附近物件');
    this.lists.main!.heading.textContent = this.options?.mode === 'rift' ? '本趟拾获' : this.options?.mode === 'prepare' ? '选择装配' : '全部物件';
    for (const [filter, control] of this.filters) { control.classList.toggle('is-current', filter === this.filter); control.setAttribute('aria-pressed', String(filter === this.filter)); }
    this.renderEquipment();
    const previousIds = this.lists[this.lane]?.ids ?? [];
    const oldIndex = Math.max(0, previousIds.indexOf(this.focusId ?? ''));
    this.renderList('nearby'); this.renderList('main');
    if (!this.exchange) this.lane = 'main';
    const active = this.lists[this.lane]!;
    const focusedEquipment = this.item(this.focusId);
    if (!active.ids.includes(this.focusId ?? '') && !(focusedEquipment && this.isEquipped(focusedEquipment))) this.focusId = active.ids[Math.min(oldIndex, active.ids.length - 1)] ?? null;
    for (const [lane, scroll] of this.pendingScroll) { this.lists[lane]!.list.scrollTop = scroll; this.renderPosition(lane); }
    this.pendingScroll.clear();
    this.renderSelection(); this.renderDetail(); this.renderFooter();
  }

  private renderEquipment(): void {
    if (this.options?.mode !== 'prepare') return;
    const signature = JSON.stringify([this.snapshot!.equipment, this.snapshot!.equipment.map(slot => this.item(slot.itemId ?? null))]);
    if (signature === this.equipmentSignature) return;
    this.equipmentSignature = signature;
    const activeId = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.slotId : undefined;
    this.equipment.replaceChildren();
    if (this.options.portrait) { const portrait = element('img', 'inventory-player-portrait'); portrait.src = this.options.portrait; portrait.alt = ''; this.equipment.append(portrait); }
    for (const slot of this.snapshot!.equipment) {
      const item = this.item(slot.itemId ?? null);
      const control = button('inventory-slot', '', () => {
        if (item) this.select(item.id, 'main', false);
        else { this.localMessage = this.options?.mode === 'rift' ? '本趟装备已定' : slot.locked ? '这个挂点尚未开放' : `先选一件污染物，再装到 ${slot.label}`; this.renderFooter(); }
      });
      control.dataset.slotId = slot.id; control.classList.toggle('is-locked', !!slot.locked);
      control.setAttribute('aria-label', `${slot.label} · ${item?.name ?? (slot.locked ? '未开放' : '空')}`);
      const art = element('span', 'inventory-slot-icon'); putIcon(art, item);
      control.append(art, element('span', 'inventory-slot-label', slot.label), element('span', 'inventory-slot-name', item?.name ?? '未装配'));
      if (item?.usesRemaining !== undefined) control.append(element('span', 'inventory-slot-uses', item.kind === 'weapon' ? `耐久 ${item.usesRemaining} / ${item.maxDurability ?? '—'}` : `余次 ${item.usesRemaining}`));
      this.equipment.append(control);
      if (activeId === slot.id) control.focus({ preventScroll: true });
    }
  }

  private renderList(lane: Lane): void {
    const view = this.lists[lane]!;
    const items = this.visibleItems(lane), ids = items.map(item => item.id);
    view.list.setAttribute('aria-multiselectable', String(this.exchange));
    const keep = new Set(ids); const scroll = view.list.scrollTop;
    for (const [id, row] of view.rows) if (!keep.has(id)) { row.remove(); view.rows.delete(id); }
    view.list.querySelector('.inventory-empty')?.remove();
    for (const [index, item] of items.entries()) {
      let row = view.rows.get(item.id);
      if (!row) {
        row = button('inventory-item', '', () => { this.select(item.id, lane, false); if (this.exchange) { const current = this.item(item.id); if (current) this.togglePick(current); } });
        row.dataset.itemId = item.id; row.dataset.lane = lane; row.setAttribute('role', 'option'); row.tabIndex = -1;
        row.addEventListener('focus', () => { if (this.focusId !== item.id || this.lane !== lane) this.select(item.id, lane, false); });
        view.rows.set(item.id, row);
      }
      const itemSignature = JSON.stringify(item);
      if (row.dataset.signature !== itemSignature) {
        row.dataset.signature = itemSignature;
        const icon = element('span', 'inventory-item-image'); putIcon(icon, item);
        const copy = element('span', 'inventory-item-copy');
        copy.append(element('span', 'inventory-item-name', item.name), element('span', 'inventory-item-caption', [locationName(item), item.stageLabel, item.quality].filter(Boolean).join(' · ')));
        row.replaceChildren(icon, copy);
        if (this.options?.mode === 'rift') row.append(element('span', 'inventory-item-weight', formatWeight(item.weight)));
        row.setAttribute('aria-label', `${item.name}，${locationName(item)}${this.options?.mode === 'rift' ? `，负重 ${formatWeight(item.weight)}` : ''}`);
      }
      // Do not re-append every keyed node: moving the focused node can lose
      // focus and browser scroll even when all instance IDs remain unchanged.
      if (view.list.children[index] !== row) view.list.insertBefore(row, view.list.children[index] ?? null);
    }
    if (!items.length) view.list.append(element('div', 'inventory-empty', lane === 'nearby' ? '附近没有这一类物件' : this.options?.mode === 'rift' ? '本趟尚无拾获' : '没有这一类物件'));
    view.ids = ids; view.list.scrollTop = scroll;
    this.renderPosition(lane);
  }

  private renderPosition(lane: Lane): void {
    const view = this.lists[lane]; if (!view) return;
    const count = view.ids.length;
    if (!count) { view.position.textContent = ''; return; }
    const rowHeight = (view.list.firstElementChild as HTMLElement | null)?.offsetHeight || 52;
    const start = Math.min(count, Math.floor(view.list.scrollTop / rowHeight) + 1);
    const end = Math.max(start, Math.floor((view.list.scrollTop + view.list.clientHeight) / rowHeight));
    view.position.textContent = `${start}–${Math.min(count, end)} / ${count}`;
  }

  private select(id: string, lane: Lane, focus: boolean): void {
    this.focusId = id; this.lane = lane; this.localMessage = '';
    if (focus) {
      const view = this.lists[lane]!; const row = view.rows.get(id);
      row?.focus({ preventScroll: true });
      if (row) {
        const top = row.offsetTop - view.list.offsetTop;
        if (top < view.list.scrollTop) view.list.scrollTop = top;
        else if (top + row.offsetHeight > view.list.scrollTop + view.list.clientHeight) view.list.scrollTop = top + row.offsetHeight - view.list.clientHeight;
      }
    }
    this.renderSelection(); this.renderDetail(); this.renderFooter();
  }

  private renderSelection(): void {
    for (const lane of ['main', 'nearby'] as const) for (const [id, row] of this.lists[lane]!.rows) {
      const looking = this.focusId === id && this.lane === lane;
      row.classList.toggle('is-looking', looking); row.classList.toggle('is-picked', this.picks.has(id) || this.takes.has(id));
      row.setAttribute('aria-selected', String(this.exchange ? this.picks.has(id) || this.takes.has(id) : looking));
      row.tabIndex = looking ? 0 : -1;
    }
    for (const node of this.equipment.querySelectorAll<HTMLButtonElement>('[data-slot-id]')) node.classList.toggle('is-looking', this.snapshot?.equipment.find(slot => slot.id === node.dataset.slotId)?.itemId === this.focusId);
  }

  private renderDetail(): void {
    const item = this.item(this.focusId);
    const signature = JSON.stringify([item, this.snapshot?.equipment, this.options?.mode, this.picks.has(item?.id ?? ''), this.takes.has(item?.id ?? '')]);
    if (signature === this.detailSignature) return;
    this.detailSignature = signature;
    this.cancelDiscardHold();
    const scroll = this.detail.dataset.itemId === item?.id ? this.detail.scrollTop : 0;
    this.detail.dataset.itemId = item?.id ?? '';
    const expanded = new Set([...this.detail.querySelectorAll<HTMLDetailsElement>('details[open]')].filter(node => node.dataset.itemId === item?.id).map(node => node.dataset.label));
    this.detail.replaceChildren();
    this.detailActions.replaceChildren();
    if (!item) { this.detail.append(element('p', '', '选一件物件，看看它还能做什么。')); this.detailHint.textContent = ''; this.exchangeInspect.textContent = '先选准备拿取的物件，再选要放下的收获。'; return; }
    const art = element('div', `inventory-art${item.kind === 'weapon' ? ' is-weapon' : ''}`); putIcon(art, item);
    this.detail.append(art, element('h3', '', item.name), element('div', 'inventory-detail-meta', [item.quality, item.stageLabel, locationName(item), this.options?.mode === 'rift' ? `负重 ${formatWeight(item.weight)}` : ''].filter(Boolean).join(' · ')));
    if (item.usesRemaining !== undefined) {
      const remaining = element('div', 'inventory-stat inventory-detail-uses');
      remaining.append(element('span', '', item.kind === 'weapon' ? '耐久度' : '剩余次数'), element('strong', '', item.kind === 'weapon' ? `${item.usesRemaining} / ${item.maxDurability ?? '—'}` : String(item.usesRemaining)));
      this.detail.append(remaining);
    }
    if (item.description) this.detail.append(element('p', '', item.description));
    for (const stat of item.stats ?? []) {
      const line = element('div', 'inventory-stat'); line.append(element('span', '', stat.label), element('strong', '', stat.comparison !== undefined ? `${stat.comparison} → ${stat.value}` : String(stat.value))); this.detail.append(line);
    }
    const actions = this.detailActions;
    const action = (label: string, run: () => void, disabled = false) => { const control = button('inventory-action', label, run); control.disabled = disabled; actions.append(control); };
    if (this.options?.mode !== 'rift') {
      if (this.options?.mode === 'prepare' && item.canEquip && (item.location === 'carried' || item.location === 'stash')) {
        if (item.kind === 'weapon') action('换到在手', () => void this.dispatch({ type: 'equipWeapon', itemId: item.id }), this.isEquipped(item));
        else for (const slot of this.snapshot!.equipment.filter(slot => slot.id !== 'weapon' && !slot.locked && (!item.toolSlots || item.toolSlots.includes(slot.id)))) {
          if (slot.itemId === item.id) action(`卸下 ${slot.label}`, () => void this.dispatch({ type: 'unequipTool', slotId: slot.id }));
          else action(`装到 ${slot.label}`, () => void this.dispatch({ type: 'equipTool', itemId: item.id, slotId: slot.id }));
        }
      }
      if (item.canOffer && this.options?.onOffering) action('前往供奉台', () => this.goToOffering());
      if (this.options?.mode === 'catalog' && item.location === 'stash' && !this.isEquipped(item)) actions.append(this.makeDiscardControl(item));
      if (item.location === 'defense') this.detail.append(element('p', 'inventory-locked-note', '正在净化点守护中'));
    } else if (this.exchange) {
      action(item.location === 'ground' ? (this.takes.has(item.id) ? '取消拿取' : '选为拿取') : (this.picks.has(item.id) ? '取消放下' : '选为放下'), () => this.togglePick(item), item.location !== 'ground' && (item.location !== 'carried' || this.isEquipped(item)));
    } else if (item.location === 'carried' && !this.isEquipped(item)) action('放在脚边', () => void this.dispatch({ type: 'drop', itemIds: [item.id] }));
    if (item.preview) this.detail.append(element('p', 'inventory-preview', item.preview));
    if (this.options?.mode === 'rift' && this.isEquipped(item)) this.detail.append(element('p', 'inventory-locked-note', '本趟已装配 · 不能卸下'));
    for (const explanation of item.explanations ?? []) {
      const disclosure = element('details', 'inventory-explanation');
      disclosure.dataset.itemId = item.id; disclosure.dataset.label = explanation.label;
      disclosure.open = expanded.has(explanation.label);
      disclosure.append(element('summary', '', explanation.label), element('p', '', explanation.text));
      this.detail.append(disclosure);
    }
    this.detail.scrollTop = scroll;
    this.updateDetailOverflow();
    this.exchangeInspect.textContent = [item.name, `负重 ${formatWeight(item.weight)}`, item.description, ...(item.stats ?? []).map(stat => `${stat.label} ${stat.comparison !== undefined ? `${stat.comparison} → ` : ''}${stat.value}`)].filter(Boolean).join(' · ');
  }

  private updateDetailOverflow = (): void => {
    const hasMore = this.detail.scrollTop + this.detail.clientHeight < this.detail.scrollHeight - 1;
    this.detailHint.textContent = hasMore ? '向下滚动查看 ↓' : this.detail.scrollTop > 0 ? '↑ 向上查看' : '';
  };

  private makeDiscardControl(item: InventoryPanelItem): HTMLButtonElement {
    const control = button('inventory-action inventory-discard', '长按永久丢弃', () => {
      if (!this.busy) this.showMessage(`永久丢弃「${item.name}」，没有返还。按住此按钮或 Enter / Space，松开取消。`);
    });
    control.dataset.discardId = item.id;
    control.setAttribute('aria-label', `长按永久丢弃 ${item.name}，没有返还`);
    control.style.setProperty('--discard-hold-duration', `${DISCARD_HOLD_MS}ms`);
    control.addEventListener('pointerdown', event => {
      if (event.button !== 0 || this.busy) return;
      event.preventDefault(); control.focus({ preventScroll: true }); this.startDiscardHold(control);
    });
    control.addEventListener('pointerleave', this.cancelDiscardHold);
    control.addEventListener('blur', this.cancelDiscardHold);
    return control;
  }

  private startDiscardHold(control: HTMLButtonElement): void {
    if (this.busy || this.discardTimer !== null || this.options?.mode === 'rift') return;
    const id = control.dataset.discardId, item = id ? this.item(id) : undefined;
    if (!item || item.location !== 'stash' || this.isEquipped(item)) return;
    this.discardControl = control;
    control.classList.add('is-holding');
    this.showMessage(`永久丢弃「${item.name}」，没有返还 · 松开取消`);
    const revision = this.revision;
    this.discardTimer = setTimeout(() => {
      const current = this.item(item.id);
      const valid = revision === this.revision && control.isConnected && document.activeElement === control
        && !document.hidden && current?.location === 'stash' && !this.isEquipped(current);
      this.cancelDiscardHold();
      if (valid) void this.dispatch({ type: 'discard', itemId: item.id });
    }, DISCARD_HOLD_MS);
  }

  private cancelDiscardHold = (): void => {
    if (this.discardTimer !== null) clearTimeout(this.discardTimer);
    this.discardTimer = null;
    if (this.discardControl) {
      this.discardControl.classList.remove('is-holding');
      this.discardControl = null;
      this.localMessage = ''; this.renderFooter();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.discardControl && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); event.stopImmediatePropagation(); this.cancelDiscardHold();
    }
  };

  private preview(): { result: number; added: number; removed: number } {
    const sum = (ids: Set<string>) => this.items.reduce((total, item) => total + (ids.has(item.id) ? item.weight : 0), 0);
    const added = sum(this.takes), removed = sum(this.picks);
    return { added, removed, result: (this.snapshot?.weight ?? 0) + added - removed };
  }

  private renderFooter(): void {
    if (!this.panel || !this.snapshot) return;
    const preview = this.preview(); const changed = this.exchange && (this.takes.size > 0 || this.picks.size > 0);
    this.weight.hidden = this.options?.mode !== 'rift';
    this.weight.replaceChildren(document.createTextNode('负重'), element('strong', '', `${formatWeight(this.snapshot.weight)}${changed ? ` → ${formatWeight(preview.result)}` : ''} / ${formatWeight(this.snapshot.capacity)}`));
    if (this.options?.mode === 'rift' && this.snapshot.survival) this.weight.append(element('span', 'inventory-survival', `移动 −${Math.round((1 - this.snapshot.survival.burdenSpeedFactor) * 100)}% · 抗性 ${this.snapshot.survival.resistancePercent}%`));
    this.weight.classList.toggle('is-over', changed ? preview.result > this.snapshot.capacity : this.snapshot.weight > this.snapshot.capacity);
    this.lists.nearby!.count.textContent = this.exchange ? `准备拿取 ${formatWeight(preview.added)}` : '';
    this.lists.main!.count.textContent = this.exchange ? `准备放下 ${formatWeight(preview.removed)}` : '';
    this.primary.hidden = false; this.primary.disabled = this.busy;
    if (this.exchange) {
      const over = Math.max(0, preview.result - this.snapshot.capacity);
      this.primary.textContent = over ? `还需腾出 ${formatWeight(over)}` : `Enter 放下 ${this.picks.size} 件 · 拿取 ${this.takes.size} 件`;
      this.primary.disabled ||= over > 0 || !this.takes.size;
      this.message.textContent = this.localMessage || this.snapshot.message || (this.takes.size ? `${formatWeight(this.snapshot.weight)} − ${formatWeight(preview.removed)} + ${formatWeight(preview.added)} = ${formatWeight(preview.result)} / ${formatWeight(this.snapshot.capacity)}　·　Space 选择，Esc 保持原样` : '先选附近物件，再用 Space 选择要放下的收获');
    } else if (this.options?.mode === 'prepare' && this.options.onDepart) {
      this.primary.textContent = 'Shift+Enter 踏入裂隙'; this.primary.disabled ||= this.snapshot.canDepart === false;
      this.message.textContent = this.localMessage || this.snapshot.message || this.snapshot.departReason || '只装配已成熟物件 · 空工具位不妨碍出发';
    } else {
      const item = this.item(this.focusId);
      this.primary.textContent = this.options?.mode === 'rift' ? 'Enter 放在脚边' : item?.canOffer && this.options?.onOffering ? 'Enter 前往供奉台' : '仅供查看';
      this.primary.disabled ||= this.options?.mode === 'catalog' ? !(item?.canOffer && this.options.onOffering) : !item || item.location === 'defense' || (this.options?.mode === 'rift' && this.isEquipped(item)) || (this.options?.mode !== 'rift' && item.kind === 'weapon' && this.isEquipped(item)) || (this.options?.mode !== 'rift' && item.kind === 'contaminant' && item.toolSlots?.length === 0 && !(item.canOffer && this.options?.onOffering));
      this.message.textContent = this.localMessage || this.snapshot.message || (this.options?.mode === 'rift' ? `世界仍在继续 · 已装配占 ${formatWeight(this.snapshot.equippedWeight ?? 0)}` : '装备请前往裂隙入口备行；未成熟物件先供奉');
    }
    this.panel.classList.toggle('is-busy', this.busy);
  }

  private togglePick(item: InventoryPanelItem): void {
    if (!this.exchange || this.busy) return;
    const target = item.location === 'ground' ? this.takes : this.picks;
    if (target === this.picks && (item.location !== 'carried' || this.isEquipped(item))) { this.localMessage = '本趟装备不能卸下'; this.renderFooter(); return; }
    if (target.has(item.id)) target.delete(item.id); else target.add(item.id);
    this.localMessage = ''; this.renderSelection(); this.renderDetail(); this.renderFooter();
  }

  private primaryAction(): void {
    if (!this.options || !this.snapshot || this.busy) return;
    if (this.exchange) {
      if (this.takes.size && this.preview().result <= this.snapshot.capacity) void this.dispatch({ type: 'exchange', takeIds: [...this.takes], dropIds: [...this.picks] });
      return;
    }
    if (this.options.mode === 'prepare' && this.options.onDepart) { this.depart(); return; }
    this.itemAction();
  }

  private itemAction(): void {
    const item = this.item(this.focusId); if (!item || !this.options || this.busy) return;
    if (this.exchange) { this.togglePick(item); return; }
    if (this.options.mode === 'rift') {
      if (item.location === 'carried' && !this.isEquipped(item)) void this.dispatch({ type: 'drop', itemIds: [item.id] });
    } else if (this.options.mode === 'prepare' && item.canEquip && (item.location === 'carried' || item.location === 'stash') && item.kind === 'weapon' && !this.isEquipped(item)) void this.dispatch({ type: 'equipWeapon', itemId: item.id });
    else if (item.canOffer && this.options.onOffering) this.goToOffering();
    else if (this.options.mode === 'prepare' && item.canEquip && (item.location === 'carried' || item.location === 'stash') && item.kind === 'contaminant') {
      const target = this.detailActions.querySelector<HTMLButtonElement>('.inventory-action:not(:disabled)'); target?.focus({ preventScroll: true });
    }
  }

  private goToOffering(): void {
    if (!this.panel || this.busy || this.options?.mode === 'rift' || !this.item(this.focusId)?.canOffer) return;
    const navigate = this.options?.onOffering;
    if (!navigate) return;
    this.close();
    navigate();
  }

  private depart(): void {
    if (this.exchange) { this.localMessage = '先完成交换，或按 Esc 保持原样'; this.renderFooter(); return; }
    if (this.options?.mode === 'prepare' && !this.busy && this.snapshot?.canDepart !== false) this.options.onDepart?.();
  }

  private async dispatch(action: InventoryPanelAction): Promise<void> {
    if (!this.options || this.busy) return;
    const options = this.options, revision = this.revision;
    const focusBefore = document.activeElement;
    this.busy = true; this.localMessage = ''; this.renderFooter();
    try {
      const result = await options.onAction(action);
      if (!this.panel || revision !== this.revision) return;
      this.localMessage = result?.message ?? '';
      if (result?.ok !== false && action.type === 'exchange') {
        this.picks.clear(); this.takes.clear();
      }
      this.busy = false;
      this.update(); this.renderSelection(); this.renderDetail(); this.renderFooter();
      if (focusBefore instanceof HTMLElement && (!focusBefore.isConnected || (focusBefore instanceof HTMLButtonElement && focusBefore.disabled)) && this.focusId) this.lists[this.lane]?.rows.get(this.focusId)?.focus({ preventScroll: true });
    } catch {
      if (!this.panel || revision !== this.revision) return;
      this.busy = false; this.localMessage = '未能完成这次操作，物件状态请重新查看'; this.update(); this.renderFooter();
    }
  }

  private remember(): void {
    for (const lane of ['main', 'nearby'] as const) this.memory.set(this.memoryKey(lane), { focus: this.lane === lane ? this.focusId : null, scroll: this.lists[lane]?.list.scrollTop ?? 0 });
  }
  private restore(): void {
    const previous = this.memory.get(this.memoryKey()); this.focusId = previous?.focus ?? null;
    for (const lane of ['main', 'nearby'] as const) this.pendingScroll.set(lane, this.memory.get(this.memoryKey(lane))?.scroll ?? 0);
  }
  private changeFilter(filter: Filter): void {
    if (filter === this.filter) return;
    this.remember(); this.filter = filter; this.restore(); this.render();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.panel || !this.options) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const key = event.key.toLowerCase();
    if (this.discardControl && (event.shiftKey || !['Enter', ' '].includes(event.key))) this.cancelDiscardHold();
    if (!event.shiftKey && (event.key === 'Enter' || event.key === ' ') && target instanceof HTMLButtonElement && target.dataset.discardId) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) this.startDiscardHold(target);
      return;
    }
    if (this.options.mode === 'catalog' && ['escape', 'tab', '[', ']'].includes(key)) return;
    if (key === 'escape' || (key === 'tab' && this.options.mode === 'rift')) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) {
        if (key === 'escape' && this.exchange && (this.takes.size || this.picks.size)) {
          this.takes.clear(); this.picks.clear(); this.localMessage = '已取消本次选择，物件保持原样。再按 Esc 收起';
          this.renderSelection(); this.renderDetail(); this.renderFooter();
        } else this.close();
      }
      return;
    }
    if (this.options.mode === 'rift' && ['w', 'a', 's', 'd'].includes(key)) { this.close(); return; }
    if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) this.depart(); return; }
    if (target?.tagName === 'SUMMARY' && ['Enter', ' '].includes(event.key)) { event.stopImmediatePropagation(); return; }
    if (target instanceof HTMLSelectElement && ['ArrowUp', 'ArrowDown', 'Home', 'End', ' '].includes(event.key)) { event.stopImmediatePropagation(); return; }
    if (event.key === 'Tab') {
      event.preventDefault(); event.stopImmediatePropagation();
      const focusable = [...this.panel.querySelectorAll<HTMLElement>('button:not(:disabled),select,summary')].filter(node => node.tabIndex >= 0 && node.getClientRects().length > 0);
      const at = focusable.indexOf(document.activeElement as HTMLElement), next = (at + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      focusable[next]?.focus({ preventScroll: true }); return;
    }
    const handled = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', ' '].includes(event.key);
    if (handled) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Enter') {
        if (event.repeat) return;
        if (target instanceof HTMLButtonElement && this.panel.contains(target) && !target.classList.contains('inventory-item')) target.click();
        else if (this.exchange) this.primaryAction(); else this.itemAction();
        return;
      }
      if (event.key === ' ') { if (!event.repeat) { const item = this.item(this.focusId); if (item) this.togglePick(item); } return; }
      if (this.exchange && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        this.lane = event.key === 'ArrowLeft' ? 'nearby' : 'main';
        const id = this.lists[this.lane]!.ids[0]; if (id) this.select(id, this.lane, true); return;
      }
      const view = this.lists[this.lane]!; if (!view.ids.length) return;
      let index = Math.max(0, view.ids.indexOf(this.focusId ?? ''));
      if (event.key === 'ArrowUp') index--;
      if (event.key === 'ArrowDown') index++;
      if (event.key === 'PageUp') index -= 6;
      if (event.key === 'PageDown') index += 6;
      if (event.key === 'Home') index = 0;
      if (event.key === 'End') index = view.ids.length - 1;
      const id = view.ids[Math.max(0, Math.min(view.ids.length - 1, index))]; if (id) this.select(id, this.lane, true);
      return;
    }
    // No accidental attacks/tool casts while operating a screen-space bag.
    // Movement/world continuation itself is owned by the scene adapter.
    if (['q', 'f', 'g', 'e', 'r', 'w', 'a', 's', 'd'].includes(key)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
}
export const inventoryPanel = new InventoryPanel();
