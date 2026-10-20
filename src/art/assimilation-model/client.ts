import { LAST_LIGHT_IDLE_FRAMES, LAST_LIGHT_SETTLE_STAGES, LAST_LIGHT_WALK_FRAMES } from '../last-light-gait';
import { LAST_LIGHT_ATTACK_SAMPLES } from '@/entities/player-last-light-combat';
import type {
  AssimilationModelFrame, AssimilationModelFrameQuery, AssimilationModelFrameSource,
  AssimilationModelRequest, AssimilationModelResponse,
} from './protocol';

export interface AssimilationModelSource {
  readonly amount: number;
  readonly fibre: number;
  readonly structure?: number;
}
export interface AssimilationModelClientOptions {
  readonly profile: 'rift' | 'haven';
  readonly yaws: readonly number[];
  readonly seatHeight?: number;
  readonly priority?: 'foreground' | 'background';
}
export interface AssimilationModelStatus {
  readonly state: 'idle' | 'warming' | 'ready' | 'updating' | 'failed' | 'disposed';
  readonly completed: number;
  readonly total: number;
  readonly error: string;
}
type Source = Required<AssimilationModelSource>;
type Channels = Pick<AssimilationModelFrame, 'albedo' | 'normal' | 'material' | 'depth'>;
type Watcher = { notify: () => void; priority: 'foreground' | 'background' };
interface PackedFrame {
  readonly offsets: Uint16Array;
  readonly values: Uint8Array;
  readonly view: AssimilationModelFrame;
}
interface Bank {
  readonly key: string;
  readonly source: Source;
  readonly options: AssimilationModelClientOptions;
  readonly requests: AssimilationModelFrameQuery[];
  readonly frames: Map<string, PackedFrame>;
  readonly watchers: Set<Watcher>;
  state: 'building' | 'ready' | 'failed';
  completed: number;
  bytes: number;
  error: string;
  elapsedMs: number;
  startedAt: number;
  usedAt: number;
  handoffTimer: ReturnType<typeof setTimeout> | null;
}
interface Lease { readonly bank: Bank; release(): void }
const TAU = Math.PI * 2;
const MAX_BANKS = 4, MAX_BANK_BYTES = 32 * 1024 * 1024, MAX_HOT_FRAMES = 32, MAX_BANK_FRAMES = 1100;
const HANDOFF_GRACE_MS = 2000;
const banks = new Map<string, Bank>(), hot = new Map<number, Channels>();
let worker: Worker | null = null;
let pending: { bank: Bank; request: AssimilationModelRequest; frameKey: string; timer: ReturnType<typeof setTimeout> } | null = null;
let scheduled: ReturnType<typeof setTimeout> | null = null, idleTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 0, batchCount = 0, clock = 0, packedBytes = 0;
const totals = { requests: 0, completed: 0, cancelled: 0, lastBuildMs: 0, lastBakeMs: 0, maxBakeMs: 0,
  lastBankMs: 0, unpacked: 0, failed: 0 };

function normalizeSource(value: AssimilationModelSource): Source {
  const unit = (n: number): number => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  return { amount: Math.round(unit(value.amount) * 40) / 40, fibre: Math.round(unit(value.fibre) * 20) / 20,
    structure: Math.round(unit(value.structure ?? 1) * 20) / 20 };
}
function validateOptions(options: AssimilationModelClientOptions): AssimilationModelClientOptions {
  const maximum = options.profile === 'rift' ? 8 : 15;
  if (!['rift', 'haven'].includes(options.profile) || !options.yaws.length || options.yaws.length > maximum
    || options.yaws.some(yaw => !Number.isFinite(yaw)) || new Set(options.yaws).size !== options.yaws.length
    || (options.seatHeight !== undefined && (!Number.isFinite(options.seatHeight) || options.seatHeight < .2 || options.seatHeight > .8)))
    throw new Error('Invalid assimilation model profile');
  return { ...options, yaws: [...options.yaws] };
}
function profileKey(options: AssimilationModelClientOptions): string {
  return `${options.profile}:${options.yaws.join(',')}:${options.seatHeight ?? .48}`;
}
function bankKey(source: Source, options: AssimilationModelClientOptions): string {
  return `${profileKey(options)}/${source.amount}/${source.fibre}/${source.structure}`;
}
function phaseFrame(phase: number, count: number): number {
  return ((Math.round(phase / TAU * count) % count) + count) % count;
}
function queryKey(query: AssimilationModelFrameQuery, options: AssimilationModelClientOptions): string {
  let yawIndex = 0, best = Infinity;
  for (let i = 0; i < options.yaws.length; i++) {
    const angle = query.yaw - options.yaws[i]!, difference = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
    if (difference < best) { best = difference; yawIndex = i; }
  }
  const part = query.part ?? 'body';
  if (part === 'arm') return `arm/${yawIndex}/${query.attackSample}`;
  const pose = query.pose ?? (query.phase === null ? 'idle' : 'walk');
  if (pose === 'sit') return `${part}/${yawIndex}/sit`;
  if (pose === 'idle' || query.phase === null) return `${part}/${yawIndex}/idle/${options.profile === 'rift' ? 0 : phaseFrame(query.breath, LAST_LIGHT_IDLE_FRAMES)}`;
  return `${part}/${yawIndex}/walk/${phaseFrame(query.phase, LAST_LIGHT_WALK_FRAMES)}/${Math.round((query.settle ?? 0) * LAST_LIGHT_SETTLE_STAGES)}`;
}
function poseRequests(options: AssimilationModelClientOptions): AssimilationModelFrameQuery[] {
  const requests: AssimilationModelFrameQuery[] = [];
  // Each yaw's full action set is contiguous. Work starts with the supplied
  // preferred yaw, without exposing a partially completed bank to a renderer.
  for (const yaw of options.yaws) {
    const parts = options.profile === 'rift' ? ['body', 'withoutArm'] as const : ['body'] as const;
    for (const part of parts) {
      const idleCount = options.profile === 'rift' ? 1 : LAST_LIGHT_IDLE_FRAMES;
      for (let idle = 0; idle < idleCount; idle++)
        requests.push({ part, yaw, pose: 'idle', phase: null, breath: idle / idleCount * TAU, settle: 0 });
      for (let walk = 0; walk < LAST_LIGHT_WALK_FRAMES; walk++) {
        const stages = options.profile === 'haven' ? LAST_LIGHT_SETTLE_STAGES : 0;
        for (let stage = 0; stage <= stages; stage++)
          requests.push({ part, yaw, pose: 'walk', phase: walk / LAST_LIGHT_WALK_FRAMES * TAU,
            breath: 0, settle: stage / LAST_LIGHT_SETTLE_STAGES });
      }
    }
    if (options.profile === 'rift') {
      for (let attackSample = 0; attackSample < LAST_LIGHT_ATTACK_SAMPLES.length; attackSample++)
        requests.push({ part: 'arm', yaw, phase: null, breath: 0, settle: 0, attackSample });
    } else requests.push({ part: 'body', yaw, pose: 'sit', phase: null, breath: 0, seatHeight: options.seatHeight ?? .48 });
  }
  if (requests.length > MAX_BANK_FRAMES) throw new Error('Assimilation action bank exceeds frame budget');
  return requests;
}
function unpack(frame: PackedFrame): Channels {
  const cached = hot.get(frame.view.id);
  if (cached) { hot.delete(frame.view.id); hot.set(frame.view.id, cached); return cached; }
  const channels: Channels = { albedo: new Uint8Array(64 * 80 * 4), normal: new Uint8Array(64 * 80 * 4),
    material: new Uint8Array(64 * 80 * 4), depth: new Uint8Array(64 * 80 * 4) };
  const output = [channels.albedo, channels.normal, channels.material, channels.depth];
  for (let pixel = 0; pixel < frame.offsets.length; pixel++) {
    const offset = frame.offsets[pixel]! * 4;
    for (let channel = 0; channel < 4; channel++)
      output[channel]!.set(frame.values.subarray(pixel * 16 + channel * 4, pixel * 16 + channel * 4 + 4), offset);
  }
  hot.set(frame.view.id, channels); totals.unpacked++;
  while (hot.size > MAX_HOT_FRAMES) hot.delete(hot.keys().next().value!);
  return channels;
}
function pack(frame: AssimilationModelFrame): PackedFrame {
  const channels = [frame.albedo, frame.normal, frame.material, frame.depth];
  if (frame.width !== 64 || frame.height !== 80 || channels.some(data => !(data instanceof Uint8Array) || data.length !== 64 * 80 * 4))
    throw new Error('Malformed assimilation worker frame');
  let count = 0;
  for (let i = 3; i < frame.albedo.length; i += 4) if (frame.albedo[i]) count++;
  if (!count) throw new Error('Empty assimilation worker frame');
  const offsets = new Uint16Array(count), values = new Uint8Array(count * 16);
  for (let pixel = 0, index = 0; pixel < 64 * 80; pixel++) {
    if (!frame.albedo[pixel * 4 + 3]) continue;
    offsets[index] = pixel;
    for (let channel = 0; channel < 4; channel++)
      values.set(channels[channel]!.subarray(pixel * 4, pixel * 4 + 4), index * 16 + channel * 4);
    index++;
  }
  // Stable identity and metadata survive hot-buffer eviction. Reading a cached
  // renderer's id never decompresses pixels; first channel access does.
  const packed: PackedFrame = { offsets, values, view: {
    id: frame.id, width: 64, height: 80, meta: frame.meta, buildMs: frame.buildMs, bakeMs: frame.bakeMs, triangles: frame.triangles,
    get albedo() { return unpack(packed).albedo; }, get normal() { return unpack(packed).normal; },
    get material() { return unpack(packed).material; }, get depth() { return unpack(packed).depth; },
  } };
  return packed;
}
function notify(bank: Bank): void { for (const watcher of [...bank.watchers]) watcher.notify(); }
function stopWorker(): void {
  worker?.terminate(); worker = null;
  if (pending) clearTimeout(pending.timer);
  pending = null;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}
function drop(bank: Bank): void {
  if (bank.handoffTimer) clearTimeout(bank.handoffTimer);
  bank.handoffTimer = null;
  if (pending?.bank === bank) stopWorker();
  for (const frame of bank.frames.values()) hot.delete(frame.view.id);
  packedBytes -= bank.bytes; bank.bytes = 0; bank.frames.clear(); banks.delete(bank.key);
}
function prune(requiredBytes = 0, requiredSlots = 0): boolean {
  while (banks.size + requiredSlots > MAX_BANKS || packedBytes + requiredBytes > MAX_BANK_BYTES) {
    const available = [...banks.values()].filter(bank => bank.watchers.size === 0).sort((a, b) => a.usedAt - b.usedAt)[0];
    if (!available) return false;
    drop(available);
  }
  return true;
}
function fail(bank: Bank, reason: unknown): void {
  bank.state = 'failed'; bank.error = reason instanceof Error ? reason.message : String(reason);
  totals.failed++; notify(bank);
}
function schedule(delay = 0): void {
  if (scheduled || pending) return;
  scheduled = setTimeout(() => { scheduled = null; pump(); }, delay);
}
function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<AssimilationModelResponse>) => {
    const current = pending;
    if (!current || data.id !== current.request.id) return;
    clearTimeout(current.timer); pending = null;
    const bank = current.bank;
    if ('error' in data) fail(bank, data.error);
    else {
      try {
        const packed = pack(data), bytes = packed.offsets.byteLength + packed.values.byteLength;
        if (!prune(bytes)) throw new Error('Assimilation action banks exceed the 32 MiB pixel budget');
        bank.frames.set(current.frameKey, packed); bank.bytes += bytes; packedBytes += bytes;
        bank.completed++; totals.completed++; totals.lastBuildMs = data.buildMs;
        totals.lastBakeMs = data.bakeMs; totals.maxBakeMs = Math.max(totals.maxBakeMs, data.bakeMs);
        if (bank.completed === bank.requests.length) {
          bank.state = 'ready'; bank.elapsedMs = performance.now() - bank.startedAt; totals.lastBankMs = bank.elapsedMs;
        }
        notify(bank);
      } catch (error) { fail(bank, error); }
    }
    const foreground = [...bank.watchers].some(watcher => watcher.priority === 'foreground');
    // A worker cannot monopolize a core indefinitely during passive prewarming.
    // At most four foreground frames run before a frame-length pause.
    batchCount = foreground ? batchCount + 1 : 0;
    const delay = foreground ? (batchCount >= 4 ? 16 : 0) : 24;
    if (batchCount >= 4) batchCount = 0;
    schedule(delay);
  };
  worker.onerror = event => { const bank = pending?.bank; stopWorker(); if (bank) fail(bank, event.message); schedule(); };
  worker.onmessageerror = () => { const bank = pending?.bank; stopWorker(); if (bank) fail(bank, 'Cannot decode assimilation worker response'); schedule(); };
  return worker;
}
function pump(): void {
  if (pending) return;
  const candidates = [...banks.values()].filter(bank => bank.state === 'building' && bank.watchers.size > 0);
  candidates.sort((a, b) => Number([...b.watchers].some(w => w.priority === 'foreground'))
    - Number([...a.watchers].some(w => w.priority === 'foreground')) || a.usedAt - b.usedAt);
  const bank = candidates[0];
  if (!bank) {
    if (worker && !idleTimer) idleTimer = setTimeout(() => { idleTimer = null; stopWorker(); }, 2000);
    return;
  }
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  try {
    const activeWorker = getWorker(), query = bank.requests[bank.completed]!;
    const request: AssimilationModelRequest = { ...query, ...bank.source, id: ++nextId };
    const timer = setTimeout(() => { stopWorker(); fail(bank, 'Assimilation worker frame exceeded 10 seconds'); schedule(); }, 10000);
    pending = { bank, request, frameKey: queryKey(query, bank.options), timer }; totals.requests++;
    activeWorker.postMessage(request);
  } catch (error) { stopWorker(); fail(bank, error); schedule(); }
}
function acquire(source: Source, options: AssimilationModelClientOptions, onChange: () => void): Lease {
  const key = bankKey(source, options);
  let bank = banks.get(key);
  if (!bank) {
    if (!prune(0, 1)) throw new Error('Assimilation cache already has four live action banks');
    bank = { key, source, options, requests: poseRequests(options), frames: new Map(), watchers: new Set(),
      state: 'building', completed: 0, bytes: 0, error: '', elapsedMs: 0, startedAt: performance.now(), usedAt: ++clock, handoffTimer: null };
    banks.set(key, bank);
  }
  if (bank.handoffTimer) clearTimeout(bank.handoffTimer);
  bank.handoffTimer = null;
  bank.usedAt = ++clock;
  const watcher: Watcher = { notify: onChange, priority: options.priority ?? 'foreground' };
  bank.watchers.add(watcher); schedule();
  let released = false;
  return { bank, release: () => {
    if (released) return;
    released = true; bank!.watchers.delete(watcher);
    if (bank!.watchers.size === 0 && bank!.state !== 'ready') {
      totals.cancelled++;
      if (bank!.state === 'failed') drop(bank!);
      else {
        // Scene shutdown can precede the next scene's acquire in the same
        // transition. Stop work now, but retain completed frames briefly.
        // Unwatched banks remain eligible for ordinary budget eviction.
        if (pending?.bank === bank) stopWorker();
        bank!.handoffTimer = setTimeout(() => {
          bank!.handoffTimer = null;
          if (bank!.watchers.size === 0 && banks.get(key) === bank) { drop(bank!); schedule(); }
        }, HANDOFF_GRACE_MS);
      }
      schedule();
    }
  } };
}

/** One scene lease, backed by a shared worker and bounded cross-scene banks.
 * First warmup uses the ordinary live pose. Only a complete bank is admitted;
 * source changes retain the previous complete shape until its replacement is
 * ready. No animation or combat clock ever waits for a worker response. */
export class AssimilationModelClient implements AssimilationModelFrameSource {
  private readonly options: AssimilationModelClientOptions;
  private source: Source | null = null;
  private active: Lease | null = null;
  private desired: Lease | null = null;
  private disposed = false;
  private error = '';
  private readonly prewarmOptions = new Map<string, AssimilationModelClientOptions>();
  private readonly prewarms = new Map<string, Lease>();
  constructor(options: AssimilationModelClientOptions) { this.options = validateOptions(options); }
  private readonly changed = (): void => {
    if (this.disposed || this.desired?.bank.state !== 'ready' || this.active === this.desired) return;
    this.active?.release(); this.active = this.desired;
  };
  update(value: AssimilationModelSource): void {
    if (this.disposed) return;
    const source = normalizeSource(value);
    if (this.source && source.amount === this.source.amount && source.fibre === this.source.fibre && source.structure === this.source.structure) return;
    this.source = source; this.error = '';
    if (this.desired && this.desired !== this.active) this.desired.release();
    this.desired = null;
    for (const lease of this.prewarms.values()) lease.release();
    this.prewarms.clear();
    if (source.amount === 0) { this.active?.release(); this.active = null; return; }
    try {
      this.desired = acquire(source, this.options, this.changed); this.changed();
      for (const [key, options] of this.prewarmOptions) this.prewarms.set(key, acquire(source, options, () => {}));
    } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
  }
  prewarm(options: AssimilationModelClientOptions): void {
    if (this.disposed) return;
    const profile = validateOptions({ ...options, priority: options.priority ?? 'background' }), key = profileKey(profile);
    if (profileKey(this.options) === key || this.prewarmOptions.has(key)) return;
    if (this.prewarmOptions.size >= 1) throw new Error('A scene may prewarm one other assimilation profile');
    this.prewarmOptions.set(key, profile);
    if (this.source?.amount) {
      try { this.prewarms.set(key, acquire(this.source, profile, () => {})); }
      catch (error) { this.error = error instanceof Error ? error.message : String(error); }
    }
  }
  getFrame(query: AssimilationModelFrameQuery): AssimilationModelFrame | null {
    if (this.disposed || this.active?.bank.state !== 'ready') return null;
    return this.active.bank.frames.get(queryKey(query, this.active.bank.options))?.view ?? null;
  }
  get status(): AssimilationModelStatus {
    const bank = this.desired?.bank, error = this.error || bank?.error || '';
    return { state: this.disposed ? 'disposed' : error ? 'failed' : !bank ? 'idle'
      : bank.state === 'ready' ? 'ready' : this.active ? 'updating' : 'warming',
    completed: bank?.completed ?? 0, total: bank?.requests.length ?? 0, error };
  }
  get metrics() {
    return { ...totals, bankCount: banks.size, packedBytes, hotFrames: hot.size, hotBytes: hot.size * 64 * 80 * 16,
      activeSource: this.active?.bank.source ?? null, desiredSource: this.source,
      activeFrames: this.active?.bank.frames.size ?? 0, warmupMs: this.desired?.bank.elapsedMs ?? 0 };
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.desired && this.desired !== this.active) this.desired.release();
    this.active?.release(); this.active = this.desired = null;
    for (const lease of this.prewarms.values()) lease.release();
    this.prewarms.clear(); this.prewarmOptions.clear();
  }
}
export function createAssimilationModelClient(options: AssimilationModelClientOptions): AssimilationModelClient {
  return new AssimilationModelClient(options);
}
/** Application teardown and isolated QA only; ordinary scene destroy retains
 * completed banks for the next scene to acquire without another bake. */
export function disposeAssimilationModelCache(): void {
  if (scheduled) clearTimeout(scheduled);
  scheduled = null; stopWorker();
  for (const bank of banks.values()) {
    if (bank.handoffTimer) clearTimeout(bank.handoffTimer);
    bank.handoffTimer = null;
    bank.state = 'failed'; bank.error = 'Assimilation cache disposed';
    bank.frames.clear(); bank.bytes = 0; notify(bank);
  }
  banks.clear(); hot.clear(); packedBytes = 0; batchCount = 0;
}
