/** Runs the actual shared queue with deterministic DOM/timers. No CSS snapshots. */
import assert from 'node:assert/strict';
import { clearToastInline, showToastInline } from '../../src/ui/dom/panel-styles';
class Element {
  id = ''; className = ''; innerHTML = ''; textContent = ''; style = { cssText: '' };
  readonly children: Element[] = []; parent: Element | null = null;
  get isConnected(): boolean { return this === head || this === body || !!this.parent?.isConnected; }
  appendChild(child: Element): Element { child.remove(); this.children.push(child); child.parent = this; return child; }
  remove(): void { if (!this.parent) return; this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap(child => [...(selector === '.toast-inline' && child.className === 'toast-inline' ? [child] : []), ...child.querySelectorAll(selector)]);
  }
}
const head = new Element(), body = new Element();
const find = (root: Element, id: string): Element | null => root.id === id ? root : root.children.map(child => find(child, id)).find(Boolean) ?? null;
const timers = new Map<number, () => void>(); let next = 0;
const oldTimeout = globalThis.setTimeout, oldClear = globalThis.clearTimeout;
Object.assign(globalThis, { document: { head, body, createElement: () => new Element(), getElementById: (id: string) => find(head, id) ?? find(body, id) },
  setTimeout: (fn: () => void) => { timers.set(++next, fn); return next; }, clearTimeout: (id: number) => timers.delete(id) });
const visible = () => body.querySelectorAll('.toast-inline').map(element => element.innerHTML);
try {
  showToastInline('first pickup', { channel: 'field-loot' });
  showToastInline('save must remain', { channel: 'save' });
  showToastInline('queued pickup', { channel: 'field-loot' });
  showToastInline('queued skill', { channel: 'skill' });
  showToastInline('local pickup', { channel: 'field-loot', skipQueue: true });
  showToastInline('local passive', { channel: 'skill', skipQueue: true });
  assert.deepEqual(visible(), ['first pickup', 'save must remain', 'local pickup', 'local passive']);
  clearToastInline('field-loot');
  assert.deepEqual(visible(), ['save must remain', 'queued skill', 'local passive']);
  assert.equal(timers.size, 3, 'Removed pickup timers cannot reopen or disturb the queue');
  clearToastInline('field-loot'); assert.deepEqual(visible(), ['save must remain', 'queued skill', 'local passive']);
  // Execute only live callbacks; removed pending pickup never reappears.
  for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
  assert.deepEqual(visible(), []);
  showToastInline('next-run pickup', { channel: 'field-loot' }); assert.deepEqual(visible(), ['next-run pickup']);
  clearToastInline('unrelated'); assert.deepEqual(visible(), ['next-run pickup']);
  clearToastInline('field-loot'); assert.equal(timers.size, 0);
  console.log('PASS pickup channel cancellation removes mounted, pending and local messages; preserves save/skill channels, capacity, future messages and live timer ownership.');
} finally { globalThis.setTimeout = oldTimeout; globalThis.clearTimeout = oldClear; }
