/**
 * AudioManager — global Phaser Sound wrapper (docs/specs/system-audio.md).
 *
 * Scenes and UI call this instead of `game.sound`. Group volumes are constants;
 * this Slice has no mixer panel and writes nothing to the save.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import {
  AUDIO_ASSETS,
  LAYER_ASSET_KEY,
  findAudioAsset,
  type RiftLayer,
  type SpatialCurve,
} from '@/managers/audio-catalog';

export type AudioGroup = 'Master' | 'BGM' | 'Ambient' | 'SFX';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlaySfxConfig {
  volume?: number;
  pan?: number;
  loop?: boolean;
  priority?: 'ui' | 'game' | 'low';
  /** Distinguishes looping spatial voices that share a key (rewriter vs infiltrator chase). */
  instanceId?: string;
  spatialGain?: number;
}

export interface PlayBgmOpts {
  loop?: boolean;
}

const MASTER = 1.0;
const GROUP_BGM = 0.6;
const GROUP_AMBIENT = 0.5;
const GROUP_SFX = 0.8;
const MAX_VOICES = 8;
const TILE = GAME_CONSTANTS.TILE_SIZE;
const DEFAULT_FADE = 1;
const HOVER_COOLDOWN_MS = 50;
const PICKUP_DEBOUNCE_MS = 100;
const ALERT_MAX = 2;
const LAYER_STOP = 0.01;

const SPATIAL_RANGE: Record<Exclude<SpatialCurve, 'none'>, { start: number; mute: number }> = {
  enemy: { start: 5, mute: 8 },
  point: { start: 3, mute: 6 },
  'rewriter-hum': { start: 10, mute: 15 },
  boundary: { start: 0, mute: 2 },
};

const UNLOCK_EVENTS: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];

interface Voice {
  id: number;
  key: string;
  instanceId: string;
  sound: Phaser.Sound.BaseSound;
  group: 'BGM' | 'Ambient' | 'SFX';
  priority: 'ui' | 'game' | 'low';
  kickable: boolean;
  duckable: boolean;
  startedAt: number;
  loop: boolean;
  extraVolume: number;
  layerMul: number;
  spatialGain: number;
  fadeGain: number;
  layer?: RiftLayer;
  fade?: { from: number; to: number; elapsed: number; duration: number; stopOnEnd: boolean };
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function groupGain(group: 'BGM' | 'Ambient' | 'SFX'): number {
  if (group === 'BGM') return GROUP_BGM;
  if (group === 'Ambient') return GROUP_AMBIENT;
  return GROUP_SFX;
}

function defaultPriority(key: string, explicit?: PlaySfxConfig['priority']): 'ui' | 'game' | 'low' {
  if (explicit) return explicit;
  return key.startsWith('sfx-ui-') ? 'ui' : 'game';
}

function setSoundVolume(sound: Phaser.Sound.BaseSound, volume: number): void {
  const v = clamp01(volume);
  if ('setVolume' in sound && typeof sound.setVolume === 'function') {
    sound.setVolume(v);
    return;
  }
  (sound as unknown as { volume: number }).volume = v;
}

function setSoundPan(sound: Phaser.Sound.BaseSound, pan: number): void {
  if ('setPan' in sound && typeof sound.setPan === 'function') {
    sound.setPan(pan);
  }
}

function isActiveSound(sound: Phaser.Sound.BaseSound): boolean {
  return sound.isPlaying || sound.isPaused;
}

export class AudioManager {
  private game: Phaser.Game | null = null;
  private nextId = 1;
  private voices: Voice[] = [];
  private unlocked = false;
  private unlockInstalled = false;
  private paused = false;
  private currentBgmKey: string | null = null;
  private readonly activeAmbients = new Set<string>();
  private readonly layerVolume: Record<RiftLayer, number> = {
    base: 0.4,
    tension: 0,
    threat: 0,
    proximity: 0,
  };
  private readonly layerTarget: Record<RiftLayer, number> = {
    base: 0.4,
    tension: 0,
    threat: 0,
    proximity: 0,
  };
  private readonly layerTau: Record<RiftLayer, number> = {
    base: 0,
    tension: 1,
    threat: 1,
    proximity: 1,
  };
  private ambientDuck = 1;
  private duck: { phase: 'down' | 'up'; elapsed: number } | null = null;
  private lastHoverAt = -Infinity;
  private lastPickupAt = -Infinity;
  private bound = false;
  private readonly onStep = (_time: number, delta: number): void => {
    this.tick(delta);
  };
  private readonly onUnlockGesture = (): void => {
    this.tryUnlock();
  };

  bind(game: Phaser.Game): void {
    this.game = game;
    if (this.bound) return;
    this.bound = true;
    game.events.on(Phaser.Core.Events.STEP, this.onStep);
  }

  playBGM(key: string, fadeIn?: number, opts?: PlayBgmOpts): void {
    if (this.paused) return;
    if (!this.game?.sound) return;
    if (!this.game.cache.audio.exists(key) && !this.game.sound.get(key)) {
      if (import.meta.env.DEV) console.warn(`[audio] missing ${key}`);
      return;
    }
    if (this.currentBgmKey === key && this.voices.some((v) => v.key === key && v.group === 'BGM' && !v.layer && isActiveSound(v.sound))) {
      return;
    }
    const fade = fadeIn ?? DEFAULT_FADE;
    const loop = opts?.loop ?? true;
    for (const voice of this.voices) {
      if (voice.group === 'BGM' && !voice.layer) {
        this.startFade(voice, voice.fadeGain, 0, fade, true);
      }
    }
    const isRiftBase = key === LAYER_ASSET_KEY.base;
    if (isRiftBase) {
      this.layerTarget.base = 0.4;
      this.layerVolume.base = 0.4;
    }
    const voice = this.spawn({
      key,
      instanceId: `bgm:${key}`,
      group: 'BGM',
      priority: 'game',
      kickable: false,
      duckable: false,
      loop,
      extraVolume: 1,
      layerMul: isRiftBase ? this.layerVolume.base : 1,
      spatialGain: 1,
      fadeGain: fade <= 0 ? 1 : 0,
    });
    if (!voice) return;
    this.currentBgmKey = key;
    if (fade > 0) this.startFade(voice, 0, 1, fade, false);
    this.applyVolume(voice);
  }

  stopBGM(fadeOut?: number): void {
    const fade = fadeOut ?? DEFAULT_FADE;
    for (const voice of this.voices) {
      if (voice.group === 'BGM' && !voice.layer) {
        this.startFade(voice, voice.fadeGain, 0, fade, true);
      }
    }
    this.currentBgmKey = null;
  }

  playSFX(key: string, config?: PlaySfxConfig): void {
    const priority = defaultPriority(key, config?.priority);
    if (this.paused && priority !== 'ui') return;
    if (key === 'sfx-ui-hover') {
      const now = performance.now();
      if (now - this.lastHoverAt < HOVER_COOLDOWN_MS) return;
      this.lastHoverAt = now;
    }
    if (key === 'sfx-shared-player-pickup') {
      const now = performance.now();
      if (now - this.lastPickupAt < PICKUP_DEBOUNCE_MS) return;
      this.lastPickupAt = now;
    }
    if (key === 'sfx-shared-chaos-tick' && this.voices.some((v) => v.key === key && isActiveSound(v.sound))) {
      return;
    }
    if (key === 'sfx-rift-enemy-alert') {
      const n = this.voices.filter((v) => v.key === key && isActiveSound(v.sound)).length;
      if (n >= ALERT_MAX) return;
    }
    const extra = clamp01(config?.volume ?? 1);
    const loop = config?.loop ?? false;
    const instanceId = config?.instanceId ?? key;
    if (loop) {
      const existing = this.voices.find((v) => v.instanceId === instanceId && v.loop && !v.fade?.stopOnEnd);
      if (existing) {
        existing.extraVolume = extra;
        existing.spatialGain = config?.spatialGain ?? existing.spatialGain;
        if (config?.pan !== undefined) setSoundPan(existing.sound, config.pan);
        this.applyVolume(existing);
        return;
      }
    }
    if (!this.acquireSlot(priority, loop && this.isBedKey(key))) return;
    const asset = findAudioAsset(key);
    const group = asset?.group ?? 'SFX';
    const voice = this.spawn({
      key,
      instanceId,
      group,
      priority,
      kickable: priority !== 'ui' && !this.isBedKey(key),
      duckable: group === 'Ambient',
      loop,
      extraVolume: extra,
      layerMul: 1,
      spatialGain: config?.spatialGain ?? 1,
      fadeGain: 1,
    });
    if (!voice) return;
    if (config?.pan !== undefined) setSoundPan(voice.sound, config.pan);
    this.applyVolume(voice);
  }

  playAmbient(key: string, fadeIn?: number): void {
    if (this.paused) return;
    const existing = this.voices.find((v) => v.key === key && v.group === 'Ambient' && !v.layer);
    if (existing) {
      // A fast scene re-entry can reclaim a bed that is still fading out.
      // Preserve the voice and reverse its fade instead of accepting a doomed loop.
      if (existing.fade?.stopOnEnd) {
        this.startFade(existing, existing.fadeGain, 1, fadeIn ?? DEFAULT_FADE, false);
      }
      this.activeAmbients.add(key);
      return;
    }
    const fade = fadeIn ?? DEFAULT_FADE;
    const voice = this.spawn({
      key,
      instanceId: `amb:${key}`,
      group: 'Ambient',
      priority: 'game',
      kickable: false,
      duckable: true,
      loop: true,
      extraVolume: 1,
      layerMul: 1,
      spatialGain: 1,
      fadeGain: fade <= 0 ? 1 : 0,
    });
    if (!voice) return;
    this.activeAmbients.add(key);
    if (fade > 0) this.startFade(voice, 0, 1, fade, false);
    this.applyVolume(voice);
  }

  stopAmbient(key: string, fadeOut?: number): void {
    const fade = fadeOut ?? DEFAULT_FADE;
    this.activeAmbients.delete(key);
    for (const voice of this.voices) {
      if (voice.key === key && (voice.group === 'Ambient' || voice.instanceId.startsWith('amb:'))) {
        this.startFade(voice, voice.fadeGain, 0, fade, true);
      }
    }
  }

  setLayerVolume(layer: RiftLayer, volume: number, duration?: number): void {
    const v = clamp01(volume);
    this.layerTarget[layer] = v;
    if (duration !== undefined) this.layerTau[layer] = Math.max(0, duration);
    if (layer === 'base') {
      if (duration === 0) this.layerVolume.base = v;
      return;
    }
    if (v > LAYER_STOP) this.ensureLayerVoice(layer);
  }

  playSpatialSFX(key: string, sourcePos: Vec2, listenerPos: Vec2, config?: PlaySfxConfig): void {
    if (this.paused) return;
    const asset = findAudioAsset(key);
    const curve = asset?.spatial ?? 'enemy';
    const { gain, pan } = this.spatialFor(curve, sourcePos, listenerPos);
    const loop = config?.loop ?? false;
    const instanceId = config?.instanceId ?? key;
    if (loop) {
      const existing = this.voices.find((v) => v.instanceId === instanceId && v.loop && !v.fade?.stopOnEnd);
      if (gain <= 0) {
        if (existing) this.startFade(existing, existing.fadeGain, 0, 0.15, true);
        return;
      }
      if (existing && existing.key !== key) {
        this.startFade(existing, existing.fadeGain, 0, 0.12, true);
      } else if (existing) {
        existing.spatialGain = gain;
        existing.extraVolume = clamp01(config?.volume ?? 1);
        setSoundPan(existing.sound, pan);
        this.applyVolume(existing);
        return;
      }
    } else if (gain <= 0) {
      return;
    }
    this.playSFX(key, {
      ...config,
      pan,
      loop,
      instanceId,
      spatialGain: gain,
    });
  }

  pauseAll(): void {
    this.paused = true;
    this.game?.sound.pauseAll();
  }

  resumeAll(): void {
    this.paused = false;
    this.game?.sound.resumeAll();
    this.tryUnlock();
  }

  unlock(): void {
    if (this.unlocked) return;
    this.installUnlockListeners();
    this.tryUnlock();
  }

  /**
   * Spec E.27: first time the player is spotted, duck Ambient (not BGM) 0.5s down and 0.5s back.
   */
  duckAmbientGroup(): void {
    this.duck = { phase: 'down', elapsed: 0 };
  }

  haltNonBgm(fadeOut = 0.35): void {
    this.activeAmbients.clear();
    this.layerTarget.tension = 0;
    this.layerTarget.threat = 0;
    this.layerTarget.proximity = 0;
    this.duck = null;
    this.ambientDuck = 1;
    for (const voice of [...this.voices]) {
      if (voice.group === 'BGM' && !voice.layer) continue;
      this.startFade(voice, voice.fadeGain, 0, fadeOut, true);
    }
  }

  stopLoop(instanceId: string, fadeOut = 0.15): void {
    for (const voice of this.voices) {
      if (voice.instanceId === instanceId && voice.loop) {
        this.startFade(voice, voice.fadeGain, 0, fadeOut, true);
      }
    }
  }

  getState(): {
    unlocked: boolean;
    paused: boolean;
    currentBgmKey: string | null;
    activeAmbients: string[];
    layerVolume: Record<RiftLayer, number>;
    playingCount: number;
  } {
    return {
      unlocked: this.unlocked,
      paused: this.paused,
      currentBgmKey: this.currentBgmKey,
      activeAmbients: [...this.activeAmbients],
      layerVolume: { ...this.layerVolume },
      playingCount: this.voices.filter((v) => isActiveSound(v.sound)).length,
    };
  }

  private installUnlockListeners(): void {
    if (this.unlockInstalled) return;
    this.unlockInstalled = true;
    for (const event of UNLOCK_EVENTS) {
      window.addEventListener(event, this.onUnlockGesture, { capture: true });
    }
  }

  private removeUnlockListeners(): void {
    if (!this.unlockInstalled) return;
    this.unlockInstalled = false;
    for (const event of UNLOCK_EVENTS) {
      window.removeEventListener(event, this.onUnlockGesture, { capture: true } as EventListenerOptions);
    }
  }

  private tryUnlock(): void {
    const sound = this.game?.sound as Phaser.Sound.WebAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager | undefined;
    if (!sound) return;
    const ctx = 'context' in sound ? sound.context : null;
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    if ('unlock' in sound && typeof sound.unlock === 'function') {
      sound.unlock();
    }
    const locked = 'locked' in sound ? sound.locked : false;
    if (ctx?.state === 'running' || locked === false) {
      this.unlocked = true;
      this.removeUnlockListeners();
    }
  }

  private tick(delta: number): void {
    if (this.paused) return;
    const dt = Math.max(0, delta);
    this.tickDuck(dt);
    this.tickLayers(dt);
    this.tickFades(dt);
    this.reap();
  }

  private tickDuck(dt: number): void {
    if (!this.duck) return;
    this.duck.elapsed += dt;
    if (this.duck.phase === 'down') {
      this.ambientDuck = 1 - Math.min(1, this.duck.elapsed / 500);
      if (this.duck.elapsed >= 500) {
        this.duck = { phase: 'up', elapsed: 0 };
        this.ambientDuck = 0;
      }
    } else {
      this.ambientDuck = Math.min(1, this.duck.elapsed / 500);
      if (this.duck.elapsed >= 500) {
        this.ambientDuck = 1;
        this.duck = null;
      }
    }
    for (const voice of this.voices) {
      if (voice.duckable) this.applyVolume(voice);
    }
  }

  private tickLayers(dt: number): void {
    (Object.keys(this.layerTarget) as RiftLayer[]).forEach((layer) => {
      const tau = this.layerTau[layer] * 1000;
      const target = this.layerTarget[layer];
      if (tau <= 0) {
        this.layerVolume[layer] = target;
      } else {
        const t = Math.min(1, dt / tau);
        this.layerVolume[layer] += (target - this.layerVolume[layer]) * t;
      }
      if (layer === 'base') {
        for (const voice of this.voices) {
          if (voice.key === LAYER_ASSET_KEY.base && !voice.layer) {
            voice.layerMul = this.layerVolume.base;
            this.applyVolume(voice);
          }
        }
        return;
      }
      if (target <= LAYER_STOP && this.layerVolume[layer] <= LAYER_STOP) {
        for (const voice of this.voices) {
          if (voice.layer === layer) this.startFade(voice, voice.fadeGain, 0, 0.2, true);
        }
        return;
      }
      for (const voice of this.voices) {
        if (voice.layer === layer) {
          voice.layerMul = this.layerVolume[layer];
          this.applyVolume(voice);
        }
      }
    });
  }

  private tickFades(dt: number): void {
    for (const voice of [...this.voices]) {
      const fade = voice.fade;
      if (!fade) continue;
      fade.elapsed += dt;
      const dur = Math.max(1, fade.duration * 1000);
      const t = Math.min(1, fade.elapsed / dur);
      voice.fadeGain = fade.from + (fade.to - fade.from) * t;
      this.applyVolume(voice);
      if (t >= 1) {
        voice.fade = undefined;
        if (fade.stopOnEnd) this.release(voice);
      }
    }
  }

  private reap(): void {
    for (const voice of [...this.voices]) {
      if (voice.loop) continue;
      if (voice.sound.isPlaying || voice.sound.isPaused) continue;
      this.release(voice);
    }
  }

  private ensureLayerVoice(layer: Exclude<RiftLayer, 'base'>): void {
    if (this.paused) return;
    const existing = this.voices.find((v) => v.layer === layer && isActiveSound(v.sound));
    if (existing) return;
    const key = LAYER_ASSET_KEY[layer];
    const group = layer === 'proximity' ? 'Ambient' : 'BGM';
    const voice = this.spawn({
      key,
      instanceId: `layer:${layer}`,
      group,
      priority: 'game',
      kickable: false,
      duckable: group === 'Ambient',
      loop: true,
      extraVolume: 1,
      layerMul: Math.max(this.layerVolume[layer], 0.02),
      spatialGain: 1,
      fadeGain: 1,
      layer,
    });
    if (voice) this.applyVolume(voice);
  }

  private isBedKey(key: string): boolean {
    const asset = findAudioAsset(key);
    if (!asset) return false;
    return asset.group === 'BGM' || asset.group === 'Ambient';
  }

  private acquireSlot(priority: 'ui' | 'game' | 'low', isBed: boolean): boolean {
    this.reap();
    const playing = this.voices.filter((v) => isActiveSound(v.sound) || v.fade);
    if (playing.length < MAX_VOICES || isBed) return true;
    if (priority === 'low') return false;
    const candidates = playing
      .filter((v) => v.kickable && v.priority !== 'ui')
      .sort((a, b) => {
        const rank = (p: 'ui' | 'game' | 'low'): number => (p === 'low' ? 0 : p === 'game' ? 1 : 2);
        const d = rank(a.priority) - rank(b.priority);
        if (d !== 0) return d;
        return a.startedAt - b.startedAt;
      });
    const victim = candidates[0];
    if (!victim) return priority === 'ui';
    this.release(victim);
    return true;
  }

  private spawn(init: Omit<Voice, 'id' | 'sound' | 'startedAt'> & { startedAt?: number }): Voice | null {
    if (!this.game?.sound) return null;
    if (!this.game.cache.audio.exists(init.key)) {
      if (import.meta.env.DEV) console.warn(`[audio] missing ${init.key}`);
      return null;
    }
    const sound = this.game.sound.add(init.key, {
      loop: init.loop,
      volume: 0,
    });
    const voice: Voice = {
      ...init,
      id: this.nextId++,
      sound,
      startedAt: performance.now(),
    };
    this.voices.push(voice);
    // Initialize the WebAudio parameter's intrinsic value before the source
    // starts, as well as Phaser's playback config. setVolume alone schedules an
    // automation event and may still expose the new GainNode's default of 1
    // until the audio thread consumes it (especially during context unlock).
    const initialVolume = this.volumeFor(voice);
    if ('volumeNode' in sound) {
      (sound as Phaser.Sound.WebAudioSound).volumeNode.gain.value = initialVolume;
    }
    sound.play({ volume: initialVolume, loop: init.loop });
    this.applyVolume(voice);
    if (!init.loop) {
      sound.once('complete', () => this.release(voice));
    }
    return voice;
  }

  private startFade(voice: Voice, from: number, to: number, duration: number, stopOnEnd: boolean): void {
    if (duration <= 0) {
      voice.fadeGain = to;
      voice.fade = undefined;
      if (stopOnEnd) this.release(voice);
      else this.applyVolume(voice);
      return;
    }
    voice.fade = { from, to, elapsed: 0, duration, stopOnEnd };
  }

  private volumeFor(voice: Voice): number {
    const duck = voice.duckable ? this.ambientDuck : 1;
    return clamp01(
      voice.extraVolume
      * voice.layerMul
      * groupGain(voice.group)
      * MASTER
      * voice.spatialGain
      * voice.fadeGain
      * duck,
    );
  }

  private applyVolume(voice: Voice): void {
    setSoundVolume(voice.sound, this.volumeFor(voice));
  }

  private release(voice: Voice): void {
    const idx = this.voices.indexOf(voice);
    if (idx >= 0) this.voices.splice(idx, 1);
    if (voice.group === 'Ambient' && !voice.layer) this.activeAmbients.delete(voice.key);
    if (voice.sound.isPlaying || voice.sound.isPaused) voice.sound.stop();
    voice.sound.destroy();
  }

  private spatialFor(
    curve: SpatialCurve,
    source: Vec2,
    listener: Vec2,
  ): { gain: number; pan: number } {
    if (curve === 'none') return { gain: 1, pan: 0 };
    const range = SPATIAL_RANGE[curve];
    const dx = source.x - listener.x;
    const dy = source.y - listener.y;
    const d = Math.hypot(dx, dy) / TILE;
    let gain = 0;
    if (d <= range.start) gain = 1;
    else if (d >= range.mute) gain = 0;
    else gain = 1 - (d - range.start) / (range.mute - range.start);
    const pan = Math.max(-0.7, Math.min(0.7, (dx / (range.mute * TILE)) * 0.7));
    return { gain, pan };
  }
}

export const audioManager = new AudioManager();

export const AUDIO_GROUP_VOLUME = {
  Master: MASTER,
  BGM: GROUP_BGM,
  Ambient: GROUP_AMBIENT,
  SFX: GROUP_SFX,
} as const;

export { AUDIO_ASSETS };
