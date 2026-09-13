import { audioManager, type PlaySfxConfig } from '@/managers/audio-manager';
import type { SeaPoint, ShellView } from '@/worlds/suspended-sea/types';
import { WaterFlowCycle, createFallingWaterFlow, type FlowCycleDefinition } from '../spatial-study/water-flow';

export interface SuspendedSeaAudioPort {
  playSpatialSFX(key: string, source: SeaPoint, listener: SeaPoint, config?: PlaySfxConfig): void;
  stopInstance(instanceId: string, fadeOut?: number): void;
}

const PREFIX = 'suspended-sea-water';
const LOOP = `${PREFIX}:near`;
const TRANSIENT = `${PREFIX}:transient`;
const HIT = `${PREFIX}:shell-hit`;

/** Only a material consumer: samples the same world instant as the water and
 * shell; no timers, damage, target registration or new AudioContext. */
export class SuspendedSeaAudio {
  private readonly cycle: WaterFlowCycle;
  private readonly flow = createFallingWaterFlow();
  private readonly source = { x: 0, y: 0 };
  private readonly config: PlaySfxConfig = { volume: .62, loop: true, priority: 'game', instanceId: LOOP };
  private readonly transientConfig: PlaySfxConfig = { volume: .54, priority: 'low', instanceId: TRANSIENT };
  private readonly hitConfig: PlaySfxConfig = { volume: .92, priority: 'game', instanceId: HIT };
  private previousElapsed: number | null = null;
  private hitSequence = 0;
  private loopKey: string | null = null;
  private stopped = false;
  private lastEvent: string | null = null;
  private eventCount = 0;

  constructor(definition: FlowCycleDefinition, private readonly origin: SeaPoint,
    private readonly port: SuspendedSeaAudioPort = audioManager) {
    this.cycle = new WaterFlowCycle(definition);
  }

  update(shell: ShellView, listener: SeaPoint, ended: boolean, entering: boolean): void {
    if (ended) { this.destroy(); return; }
    if (this.stopped) return;
    const elapsed = shell.elapsedMs, flow = this.cycle.sample(elapsed, this.flow);
    const previous = this.previousElapsed;
    this.previousElapsed = elapsed;
    if (entering) { this.setLoop(null); return; }
    const cycleStart = Math.floor(elapsed / this.cycle.period) * this.cycle.period;
    // A pause has no update and freezes the world's clock. A large external
    // jump does not replay a backlog of missed falls and drains.
    const crossed = (boundary: number): boolean => previous !== null && elapsed >= previous
      && elapsed - previous < 500 && previous < cycleStart + boundary && elapsed >= cycleStart + boundary;
    if (crossed(flow.feedStart)) this.once('sfx-suspended-sea-fall', this.origin, listener);
    if (crossed(flow.feedEnd)) this.once('sfx-suspended-sea-drain', this.origin, listener);
    if (shell.hitSequence > this.hitSequence) {
      this.hitSequence = shell.hitSequence;
      this.port.playSpatialSFX('sfx-suspended-sea-shell-hit', shell.position, listener, this.hitConfig);
      this.lastEvent = 'shell-hit'; this.eventCount++;
    }
    this.source.x = this.origin.x; this.source.y = this.origin.y;
    let key: string | null = null;
    if (shell.coreActive) {
      key = 'sfx-suspended-sea-contact'; this.config.volume = .72;
      if (shell.mode === 'diverting' || shell.mode === 'diverted') {
        const drain = shell.drainPath[Math.min(1, shell.drainPath.length - 1)] ?? this.origin;
        const amount = shell.mode === 'diverted' ? 1 : shell.diversionProgress;
        this.source.x += (drain.x - this.source.x) * amount;
        this.source.y += (drain.y - this.source.y) * amount;
      }
    } else if (flow.cycleTime >= this.cycle.definition.quietMs && flow.cycleTime < flow.feedStart) {
      key = 'sfx-suspended-sea-gather'; this.config.volume = .14 + flow.swell * .34;
    }
    this.setLoop(key);
    if (key) this.port.playSpatialSFX(key, this.source, listener, this.config);
  }

  synchronizeRecovery(shell: ShellView): void {
    if (this.stopped) throw new Error('Cannot restore disposed water audio');
    this.previousElapsed = shell.elapsedMs;
    this.hitSequence = shell.hitSequence;
    this.setLoop(null);
  }

  private once(key: string, point: SeaPoint, listener: SeaPoint): void {
    this.port.playSpatialSFX(key, point, listener, this.transientConfig);
    this.lastEvent = key; this.eventCount++;
  }

  private setLoop(key: string | null): void {
    if (key === this.loopKey) return;
    // There is one near-field water voice, even when the two source clips
    // switch. No overlapping crossfade may claim two slots for one object.
    this.port.stopInstance(LOOP, 0); this.loopKey = key;
  }

  snapshot(): Record<string, unknown> {
    return { clock: this.previousElapsed, loopKey: this.loopKey, hitSequence: this.hitSequence,
      lastEvent: this.lastEvent, eventCount: this.eventCount, stopped: this.stopped,
      source: { ...this.source }, nearFieldInstances: this.loopKey ? 1 : 0 };
  }

  destroy(): void {
    if (this.stopped) return;
    this.stopped = true; this.loopKey = null;
    for (const id of [LOOP, TRANSIENT, HIT]) this.port.stopInstance(id, 0);
  }
}
