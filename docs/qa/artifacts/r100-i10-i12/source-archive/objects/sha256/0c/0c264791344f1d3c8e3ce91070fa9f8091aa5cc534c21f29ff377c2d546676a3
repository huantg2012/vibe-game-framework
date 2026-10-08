import { createVistaSoundSamples, VISTA_CYCLE_SECONDS, VISTA_SOUND_SOURCE, vistaMotion } from './vista-motion';

/** Isolated scenic audio: user-gesture unlock, same cycle as the landforms,
 * one owned context, no game AudioManager slots or persistent settings. */
export class VistaAudio {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private volume: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private disposed = false;
  private muted = false;
  private suspended = false;
  private seconds = 0;
  private distance = 0;
  private pan = 0;
  private gain = 0;
  private starts = 0;
  private startedAt = 0;
  private startOffset = 0;
  private readonly failures: string[] = [];

  constructor(private readonly reducedMotion = false) { window.addEventListener('keydown', this.onKey); }
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.repeat || this.disposed) return;
    if (event.code === 'KeyM') this.muted = !this.muted;
    if (!/^(Key[WASDM]|Arrow(Up|Down|Left|Right))$/.test(event.code)) return;
    if (!this.context) {
      try {
        this.context = new AudioContext();
        const samples = createVistaSoundSamples(this.context.sampleRate, this.reducedMotion);
        const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
        buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
        this.volume = this.context.createGain(); this.volume.gain.value = 0;
        this.panner = this.context.createStereoPanner();
        this.source = this.context.createBufferSource(); this.source.buffer = buffer; this.source.loop = true;
        this.source.connect(this.panner).connect(this.volume).connect(this.context.destination);
        this.startedAt = this.context.currentTime; this.startOffset = this.seconds;
        this.source.start(0, this.seconds % VISTA_CYCLE_SECONDS); this.starts++;
      } catch (error) { this.failures.push(String(error)); }
    }
    if (!this.suspended) void this.context?.resume().catch(error => this.failures.push(String(error)));
  };
  update(elapsedMs: number, player: { x: number; y: number }): void {
    this.seconds = this.presentationMs(elapsedMs) * .001;
    this.distance = Math.hypot(player.x - VISTA_SOUND_SOURCE.x, player.y - VISTA_SOUND_SOURCE.y);
    this.pan = Math.max(-.85, Math.min(.85, (VISTA_SOUND_SOURCE.x - player.x) / 900));
    this.gain = this.muted || this.suspended ? 0 : .9 / (1 + (this.distance / 950) ** 2);
    if (this.context && this.volume && this.panner) {
      this.volume.gain.setTargetAtTime(this.gain, this.context.currentTime, .18);
      this.panner.pan.setTargetAtTime(this.pan, this.context.currentTime, .15);
    }
  }
  /** Once unlocked the audible buffer clock is also the scenic motion clock.
   * Rendering stalls cannot make a diagnostic phase diverge from heard sound. */
  presentationMs(fallback: number): number {
    return this.context && this.source ? (this.startOffset + this.context.currentTime - this.startedAt) * 1000 : fallback;
  }
  pause(): void { this.suspended = true; void this.context?.suspend().catch(error => this.failures.push(String(error))); }
  resume(): void {
    this.suspended = false;
    if (this.context) void this.context.resume().catch(error => this.failures.push(String(error)));
  }
  snapshot(): Record<string, unknown> {
    return { state: this.context?.state ?? 'locked-until-movement', muted: this.muted, paused: this.suspended,
      cycle: vistaMotion(this.reducedMotion ? 0 : this.seconds), reducedMotion: this.reducedMotion,
      audioContextTime: this.context?.currentTime ?? null, presentationSeconds: this.seconds,
      sourcePosition: { ...VISTA_SOUND_SOURCE }, distance: this.distance,
      pan: this.pan, gain: this.gain, sourceStarts: this.starts, errors: [...this.failures],
      synthesis: 'deterministic mineral friction and low bearing resonance; shared 26-second scenic cycle' };
  }
  destroy(): void {
    if (this.disposed) return; this.disposed = true; window.removeEventListener('keydown', this.onKey);
    this.source?.stop(); this.source?.disconnect(); this.volume?.disconnect(); this.panner?.disconnect();
    void this.context?.close().catch(error => this.failures.push(String(error)));
  }
}
