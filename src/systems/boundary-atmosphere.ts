/**
 * BoundaryAtmosphere - particles and apparitions at the purification point boundary.
 *
 * Renders grey micro-particles drifting inward from the darkness, plus periodic
 * blurry humanoid silhouettes that fade in and out. A directional density boost
 * on one side hints at the next impact's primary target (spec rule 7, 80% accurate).
 *
 * Uses Phaser Graphics only - no external particle libraries.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { impactSystem } from '@/systems/impact-system';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface Apparition {
  x: number;
  y: number;
  elapsed: number;
  duration: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ATM = GAME_CONSTANTS.PURIFICATION.ATMOSPHERE;
const TILE = GAME_CONSTANTS.TILE_SIZE;
const MAP_COLS = GAME_CONSTANTS.PURIFICATION.MAP_COLS;
const MAP_ROWS = GAME_CONSTANTS.PURIFICATION.MAP_ROWS;

const CENTER_X = (MAP_COLS * TILE) / 2;
const CENTER_Y = (MAP_ROWS * TILE) / 2;
const BOUNDARY_RADIUS = Math.min(MAP_COLS, MAP_ROWS) * TILE * 0.42;

// ---------------------------------------------------------------------------
// BoundaryAtmosphere
// ---------------------------------------------------------------------------

export class BoundaryAtmosphere {
  private graphics!: Phaser.GameObjects.Graphics;
  private particles: Particle[] = [];
  private apparitions: Apparition[] = [];
  private apparitionTimer = 0;
  private nextApparitionDelay = 0;

  create(scene: Phaser.Scene): void {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(60); // above the vision mask

    this.initParticles();
    this.scheduleNextApparition();
  }

  update(delta: number): void {
    this.updateParticles(delta);
    this.updateApparitions(delta);
    this.draw();
  }

  /**
   * Returns the angle (radians) toward the forecasted threat direction.
   * Used by the scene to position the density boost.
   */
  getForecastAngle(): number {
    const target = impactSystem.getForecastTarget();
    // BARRIER is left side, STORAGE is right side
    if (target === 'BARRIER') return Math.PI; // left
    return 0; // right (default)
  }

  destroy(): void {
    this.graphics?.destroy();
    this.particles = [];
    this.apparitions = [];
  }

  // ------------------------------------------------------------------ particles

  private initParticles(): void {
    for (let i = 0; i < ATM.PARTICLE_COUNT; i++) {
      this.particles.push(this.spawnParticle());
    }
  }

  private spawnParticle(): Particle {
    // Spawn at boundary edge, slightly outside
    const angle = Math.random() * Math.PI * 2;
    const forecastAngle = this.getForecastAngle();
    // Boost density near forecast direction (2x more likely to spawn there)
    const angleDiff = Math.abs(normalizeAngle(angle - forecastAngle));
    const boosted = angleDiff < Math.PI / 3;
    if (!boosted && Math.random() < 0.3) {
      // Re-roll toward the forecast direction
      return this.spawnParticleAt(forecastAngle + (Math.random() - 0.5) * Math.PI * 0.6);
    }
    return this.spawnParticleAt(angle);
  }

  private spawnParticleAt(angle: number): Particle {
    const dist = BOUNDARY_RADIUS + 10 + Math.random() * 30;
    const x = CENTER_X + Math.cos(angle) * dist;
    const y = CENTER_Y + Math.sin(angle) * dist;
    // Drift inward
    const speed = ATM.PARTICLE_SPEED * (0.7 + Math.random() * 0.6);
    const inwardAngle = Math.atan2(CENTER_Y - y, CENTER_X - x) + (Math.random() - 0.5) * 0.4;
    const maxLife = 4000 + Math.random() * 4000;
    return {
      x,
      y,
      vx: Math.cos(inwardAngle) * speed,
      vy: Math.sin(inwardAngle) * speed,
      alpha: ATM.PARTICLE_ALPHA_MIN + Math.random() * (ATM.PARTICLE_ALPHA_MAX - ATM.PARTICLE_ALPHA_MIN),
      life: 0,
      maxLife,
    };
  }

  private updateParticles(delta: number): void {
    const dt = delta / 1000;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += delta;

      // Respawn if expired or too close to center
      const dx = p.x - CENTER_X;
      const dy = p.y - CENTER_Y;
      const distSq = dx * dx + dy * dy;
      const innerLimit = BOUNDARY_RADIUS * 0.5;
      if (p.life >= p.maxLife || distSq < innerLimit * innerLimit) {
        this.particles[i] = this.spawnParticle();
      }
    }
  }

  // ------------------------------------------------------------------ apparitions

  private scheduleNextApparition(): void {
    this.nextApparitionDelay = ATM.APPARITION_INTERVAL_MIN +
      Math.random() * (ATM.APPARITION_INTERVAL_MAX - ATM.APPARITION_INTERVAL_MIN);
    this.apparitionTimer = 0;
  }

  private updateApparitions(delta: number): void {
    this.apparitionTimer += delta;

    // Spawn new apparition
    if (this.apparitionTimer >= this.nextApparitionDelay) {
      const activeCount = this.apparitions.filter((a) => a.active).length;
      if (activeCount < ATM.APPARITION_MAX_SIMULTANEOUS) {
        const angle = Math.random() * Math.PI * 2;
        const dist = BOUNDARY_RADIUS + 40 + Math.random() * 40;
        this.apparitions.push({
          x: CENTER_X + Math.cos(angle) * dist,
          y: CENTER_Y + Math.sin(angle) * dist,
          elapsed: 0,
          duration: ATM.APPARITION_DURATION,
          active: true,
        });
      }
      this.scheduleNextApparition();
    }

    // Update existing
    for (const app of this.apparitions) {
      if (!app.active) continue;
      app.elapsed += delta;
      if (app.elapsed >= app.duration) {
        app.active = false;
      }
    }

    // Clean up inactive
    this.apparitions = this.apparitions.filter((a) => a.active);
  }

  // ------------------------------------------------------------------ draw

  private draw(): void {
    this.graphics.clear();

    // Draw particles
    for (const p of this.particles) {
      const fadeIn = Math.min(p.life / 500, 1);
      const fadeOut = Math.min((p.maxLife - p.life) / 500, 1);
      const alpha = p.alpha * fadeIn * fadeOut;
      this.graphics.fillStyle(0x888888, alpha);
      this.graphics.fillCircle(p.x, p.y, 1.5);
    }

    // Draw apparitions
    for (const app of this.apparitions) {
      const t = app.elapsed / app.duration;
      let alpha: number;
      // 0-0.167: fade in (0→0.3), 0.167-0.833: hold (0.3), 0.833-1: fade out (0.3→0)
      if (t < 0.167) {
        alpha = (t / 0.167) * 0.3;
      } else if (t < 0.833) {
        alpha = 0.3;
      } else {
        alpha = (1 - (t - 0.833) / 0.167) * 0.3;
      }
      this.drawApparition(app.x, app.y, alpha);
    }
  }

  private drawApparition(x: number, y: number, alpha: number): void {
    // Simple humanoid silhouette: head + body
    this.graphics.fillStyle(0x444444, alpha);
    // Head
    this.graphics.fillCircle(x, y - 12, 5);
    // Body (rectangle)
    this.graphics.fillRect(x - 4, y - 7, 8, 18);
    // Legs
    this.graphics.fillRect(x - 4, y + 11, 3, 8);
    this.graphics.fillRect(x + 1, y + 11, 3, 8);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
