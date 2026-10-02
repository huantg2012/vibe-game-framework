/** Exercise the real narration controller with a minimal DOM, not its timing model. */
import assert from 'node:assert/strict';
import { HavenNarration } from '../../src/ui/dom/haven-narration.ts';
import type { AtmospherePool } from '../../src/narrative/atmosphere.ts';

class Element {
  id = '';
  textContent = '';
  style: Record<string, string> = {};
  parent: Element | null = null;
  children: Element[] = [];
  get isConnected(): boolean { return this === body || !!this.parent?.isConnected; }
  append(child: Element): void { child.remove(); child.parent = this; this.children.push(child); }
  appendChild(child: Element): Element { this.append(child); return child; }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
  }
}
const body = new Element();
const find = (id: string, parent = body): Element | null => parent.id === id ? parent
  : parent.children.reduce<Element | null>((found, child) => found ?? find(id, child), null);
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  body, createElement: () => new Element(), getElementById: find,
} });
type State = Parameters<HavenNarration['tick']>[1];
const idle: State = { blocked: false, resting: false, moving: false, target: null };
const root = (): Element | null => find('dom-ui-root');
const line = (): Element | null => find('haven-atmosphere-line') ?? find('purification-rest-line');
const advance = (subject: HavenNarration, ms: number, state = idle): void => {
  for (let left = ms; left > 0; left -= 100) subject.tick(Math.min(100, left), state);
};
const make = (): { subject: HavenNarration; picks: AtmospherePool[] } => {
  const picks: AtmospherePool[] = [];
  return { picks, subject: new HavenNarration(pool => { picks.push(pool); return `${pool}：第${picks.length}句。`; }) };
};
const checks: string[] = [];
{
  const { subject, picks } = make();
  subject.queueArrival('haven.arrival');
  assert.equal(picks.length, 0, 'Queuing is not presentation');
  advance(subject, 2400);
  assert.equal(picks.length, 0);
  advance(subject, 200);
  assert.deepEqual(picks, ['haven.arrival']);
  assert.equal(line()?.parent?.id, 'dom-ui-root');
  assert(Number(line()?.style.opacity) > 0, 'Displayed text fades in on active frames');
  advance(subject, 7500);
  assert.equal(line(), null, 'Expired text unmounts');
  subject.destroy();
  checks.push('arrival consumes only on presentation; shared DOM mount; active-frame fade and removal');
}
{
  const { subject, picks } = make();
  subject.queueArrival('haven.return');
  advance(subject, 10000, { ...idle, blocked: true, target: 'core' });
  assert.equal(picks.length, 0, 'Blocking panels must not consume pending text');
  advance(subject, 2400);
  assert.equal(picks.length, 0, 'Panel dismissal retains a quiet gap');
  advance(subject, 200);
  assert.deepEqual(picks, ['haven.return']);
  subject.tick(16, { ...idle, blocked: true });
  assert.equal(line(), null, 'Opening a panel clears the current sentence');
  subject.destroy();
  checks.push('panels block consumption, dismiss with a quiet gap, and clear existing text');
}
{
  const { subject, picks } = make();
  advance(subject, 8000, { ...idle, moving: true, target: 'purifier' });
  assert.equal(picks.length, 0);
  advance(subject, 3000, { ...idle, target: 'purifier' });
  advance(subject, 100, { ...idle, moving: true, target: 'purifier' });
  advance(subject, 3000, { ...idle, target: 'purifier' });
  assert.equal(picks.length, 0, 'Brief passes must not accumulate dwell');
  advance(subject, 600, { ...idle, target: 'purifier' });
  assert.deepEqual(picks, ['haven.purifier']);
  advance(subject, 40000, { ...idle, target: 'purifier' });
  assert.equal(picks.length, 1, 'One object speaks at most once per visit');
  advance(subject, 4000, { ...idle, target: 'storage' });
  assert.deepEqual(picks, ['haven.purifier', 'haven.storage']);
  advance(subject, 40000, { ...idle, target: 'core' });
  assert.equal(picks.length, 2, 'A visit is not an endless stream of object text');
  subject.destroy();
  checks.push('movement resets dwell; each object once; at most two object observations per visit');
}
{
  const { subject, picks } = make();
  subject.queueArrival('haven.arrival');
  subject.sit();
  const first = line()?.textContent;
  advance(subject, 400, { ...idle, resting: true, target: 'core' });
  assert(Number(line()?.style.opacity) > 0);
  subject.stand();
  assert.equal(line(), null);
  subject.sit();
  assert.equal(line()?.textContent, first);
  assert.deepEqual(picks, ['haven.rest'], 'Rapid sit/stand does not empty the writing bank');
  advance(subject, 10000, { ...idle, resting: true, target: 'core' });
  assert.equal(line(), null);
  assert.equal(picks.length, 1, 'Rest suppresses arrival and object observations');
  subject.tick(16, { ...idle, blocked: true, resting: true });
  assert.equal(line(), null);
  advance(subject, 22000, { ...idle, resting: true });
  subject.stand(); subject.sit();
  assert.deepEqual(picks, ['haven.rest', 'haven.rest'], 'A later rest can select a new sentence');
  subject.destroy();
  assert.equal(line(), null);
  checks.push('rapid rest reuses its sentence; later rest rotates; resting never queues other observations');
}
{
  const { subject, picks } = make();
  subject.queueArrival('haven.return-lost');
  advance(subject, 21000, { ...idle, blocked: true });
  advance(subject, 5000);
  assert.equal(picks.length, 0, 'An expired blocked arrival never consumes a line');
  subject.queueArrival('haven.arrival');
  subject.destroy();
  advance(subject, 5000);
  assert.equal(picks.length, 0, 'Destroyed arrival leaves no delayed callback');
  assert.equal(root()?.children.length ?? 0, 0);
  const next = make();
  next.subject.sit();
  assert.equal(root()?.children.length, 1, 'A new scene mounts exactly one sentence');
  next.subject.destroy();
  checks.push('expired arrivals are not consumed; destroy clears pending work and next scene has no duplicate DOM');
}
console.log(JSON.stringify({ status: 'PASS', checks: checks.length, details: checks }, null, 2));
