/** Title-only crossing into the refuge. One screen-space veil changes scene
 * ownership at full darkness; scene clocks own all milestones and camera work.
 * DOM opacity uses compositor animations, suspended with the owning scene.
 */
import Phaser from 'phaser';
import { audioManager } from '@/managers/audio-manager';
import type { ExpeditionEntryMode } from '@/managers/session';
import { getDomUiRoot } from '@/ui/dom/panel-styles';

interface EntryTiming {
  departure: number;
  text: number;
  audio: number;
  reveal: number;
  settle: number;
  hud: number;
  zoomScale: number;
}

const NEW_TIMING: EntryTiming = {
  departure: 420, text: 160, audio: 120, reveal: 1250, settle: 1460, hud: 220, zoomScale: 0.96,
};
const CONTINUE_TIMING: EntryTiming = {
  departure: 240, text: 100, audio: 60, reveal: 620, settle: 720, hud: 140, zoomScale: 0.98,
};
const REDUCED_TIMING: EntryTiming = {
  departure: 160, text: 80, audio: 40, reveal: 240, settle: 240, hud: 100, zoomScale: 1,
};

export class MenuEntryTransition {
  private readonly veil: HTMLDivElement;
  private readonly timing: EntryTiming;
  private scene: Phaser.Scene | null = null;
  private animations: Animation[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private cameraTween: Phaser.Tweens.Tween | null = null;
  private destroyed = false;
  private readonly pauseAnimations = (): void => {
    for (const animation of this.animations) animation.pause();
  };
  private readonly resumeAnimations = (): void => {
    for (const animation of this.animations) {
      if (animation.playState === 'paused') animation.play();
    }
  };

  constructor(readonly mode: ExpeditionEntryMode) {
    this.timing = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? REDUCED_TIMING : mode === 'new' ? NEW_TIMING : CONTINUE_TIMING;
    this.veil = document.createElement('div');
    this.veil.id = 'menu-entry-transition';
    this.veil.dataset.mode = mode;
    this.veil.dataset.phase = 'departure';
    this.veil.setAttribute('aria-hidden', 'true');
    this.veil.style.cssText = 'position:absolute;inset:0;background:#080a0c;opacity:0;z-index:3000;pointer-events:auto;';
    getDomUiRoot().appendChild(this.veil);
  }

  depart(scene: Phaser.Scene, text: Phaser.GameObjects.GameObject[], onCovered: () => void): void {
    this.own(scene);
    scene.tweens.add({ targets: text, alpha: 0, duration: this.timing.text, ease: 'Sine.easeOut' });
    // Give the text a head start; the first click has an immediate visible reply.
    const lead = Math.min(70, this.timing.text / 2);
    this.animate(this.veil, [{ opacity: 0 }, { opacity: 1 }], this.timing.departure - lead, lead);
    this.after(this.timing.audio, () => {
      audioManager.playBGM('bgm-pp-isolation-drone', this.timing.departure / 1000);
      audioManager.playAmbient('amb-pp-mechanical-hum', this.timing.departure / 1000);
    });
    this.after(this.timing.departure, () => {
      this.veil.style.opacity = '1';
      this.veil.dataset.phase = 'covered';
      this.releaseScene();
      onCovered();
    });
  }

  arrive(scene: Phaser.Scene, revealHud: () => readonly HTMLElement[], onReady: () => void): void {
    this.own(scene);
    this.veil.dataset.phase = 'arrival';
    const camera = scene.cameras.main;
    const zoom = camera.zoom;
    const scrollX = camera.scrollX;
    const scrollY = camera.scrollY;
    const roundPixels = camera.roundPixels;
    // No physical movement, panning, or change to the final authored camera.
    camera.setRoundPixels(false).setZoom(zoom * this.timing.zoomScale);
    this.cameraTween = scene.tweens.add({
      targets: camera, zoom, duration: this.timing.settle, ease: 'Sine.easeInOut',
    });
    this.animate(this.veil, [{ opacity: 1 }, { opacity: 0 }], this.timing.reveal);
    this.after(this.timing.reveal, () => {
      this.veil.style.opacity = '0';
      this.veil.dataset.phase = 'settling';
    });
    this.after(this.timing.settle, () => {
      this.cameraTween?.remove();
      this.cameraTween = null;
      camera.setScroll(scrollX, scrollY).setZoom(zoom).setRoundPixels(roundPixels);
      this.veil.dataset.phase = 'hud';
      for (const element of revealHud()) {
        this.animate(element, [{ opacity: 0 }, { opacity: getComputedStyle(element).opacity }], this.timing.hud);
      }
    });
    this.after(this.timing.settle + this.timing.hud, () => {
      this.destroy();
      onReady();
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.releaseScene();
    this.cameraTween?.remove();
    this.cameraTween = null;
    this.veil.remove();
  }

  private own(scene: Phaser.Scene): void {
    this.scene = scene;
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.pauseAnimations);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.resumeAnimations);
  }

  private releaseScene(): void {
    this.scene?.events.off(Phaser.Scenes.Events.PAUSE, this.pauseAnimations);
    this.scene?.events.off(Phaser.Scenes.Events.RESUME, this.resumeAnimations);
    for (const timer of this.timers) timer.remove(false);
    this.timers.length = 0;
    for (const animation of this.animations) animation.cancel();
    this.animations.length = 0;
    this.scene = null;
  }

  private after(delay: number, callback: () => void): void {
    if (!this.scene) return;
    this.timers.push(this.scene.time.delayedCall(delay, () => {
      if (!this.destroyed) callback();
    }));
  }

  private animate(element: HTMLElement, frames: Keyframe[], duration: number, delay = 0): void {
    this.animations.push(element.animate(frames, {
      duration, delay, fill: 'both', easing: 'cubic-bezier(.37,0,.63,1)',
    }));
  }
}
