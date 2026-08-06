/**
 * ExtractionSystem - the way out of a rift.
 *
 * Places a pulsing white marker at the extraction point and monitors distance.
 * When the player is within TRIGGER_RADIUS and requests extraction, it emits
 * `RIFT_EXIT_REACHED`. The RunController handles what happens next.
 *
 * This system never imports another system. The visibility system's glow source
 * is registered through an injected callback, not an import.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';
import type { ExtractionPointDef } from '@/types/map-types';
import type { Vector2 } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ExtractionSystemConfig {
  /** Register a glow source with the visibility system (optional). */
  registerGlowSource?: (id: string, position: Vector2, radius: number) => void;
}

// ---------------------------------------------------------------------------
// ExtractionSystem
// ---------------------------------------------------------------------------

const PULSE_HZ = 1;
const PULSE_ALPHA_MIN = 0.4;
const PULSE_ALPHA_MAX = 0.8;
const MARKER_SIZE = 16;
const MARKER_COLOR = 0xffffff;
const MARKER_DEPTH = 15; // between surface and player

export class ExtractionSystem {
  private extractionPoint!: ExtractionPointDef;
  private marker!: Phaser.GameObjects.Arc;
  private getPlayerPosition!: () => Readonly<Vector2>;
  private isRunEnded!: () => boolean;
  private elapsed = 0;

  create(
    scene: Phaser.Scene,
    extractionPoint: ExtractionPointDef,
    getPlayerPosition: () => Readonly<Vector2>,
    isRunEnded: () => boolean,
    config?: ExtractionSystemConfig,
  ): void {
    this.extractionPoint = extractionPoint;
    this.getPlayerPosition = getPlayerPosition;
    this.isRunEnded = isRunEnded;

    // Pulsing circle marker
    this.marker = scene.add.circle(
      extractionPoint.position.x,
      extractionPoint.position.y,
      MARKER_SIZE / 2,
      MARKER_COLOR,
    );
    this.marker.setDepth(MARKER_DEPTH);
    this.marker.setAlpha(PULSE_ALPHA_MIN);

    // Register glow source if the callback is provided
    if (config?.registerGlowSource) {
      config.registerGlowSource(
        extractionPoint.id,
        extractionPoint.position,
        GAME_CONSTANTS.VISIBILITY.GLOW_LEAK_RADIUS,
      );
    }
  }

  update(deltaMs: number): void {
    // Animate pulse
    this.elapsed += deltaMs;
    const phase = (this.elapsed / 1000) * PULSE_HZ * Math.PI * 2;
    const t = (Math.sin(phase) + 1) / 2; // 0..1
    this.marker.setAlpha(PULSE_ALPHA_MIN + (PULSE_ALPHA_MAX - PULSE_ALPHA_MIN) * t);
  }

  canExtract(): boolean {
    const pos = this.getPlayerPosition();
    const ext = this.extractionPoint.position;
    const dx = pos.x - ext.x;
    const dy = pos.y - ext.y;
    return Math.sqrt(dx * dx + dy * dy) <= GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS;
  }

  requestExtract(): void {
    if (this.isRunEnded()) return;
    if (!this.canExtract()) return;
    eventBus.emit(GameEvent.RIFT_EXIT_REACHED, {});
  }

  reset(): void {
    this.elapsed = 0;
    this.marker.setAlpha(PULSE_ALPHA_MIN);
  }

  destroy(): void {
    this.marker?.destroy();
  }
}
