/**
 * BoundaryBreath -- subtle localized pressure impacts on the purification boundary.
 *
 * World model: external contamination constantly probes the force field at random points.
 * Each "impact" is a short arc that sweeps inward at a specific location, creating
 * localized squeezing rather than uniform pulsing. Multiple impacts active simultaneously
 * at different angles, different phases.
 *
 * Visual weight: very low — a background atmospheric hint, not a focal element.
 * Colors are dark/desaturated, alphas are in 0.04-0.15 range.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { BoundaryShape } from '@/systems/boundary-shape';
import type { TidePhase } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Tuning (B4, Slice 5: migrated into constants.ts as GAME_CONSTANTS.PURIFICATION.
// BOUNDARY.BREATH; values unchanged from the original inline consts)
// ---------------------------------------------------------------------------

const BREATH = GAME_CONSTANTS.PURIFICATION.BOUNDARY.BREATH;

const SAMPLE_COUNT = BREATH.SAMPLE_COUNT;
const ANGLE_STEP = (2 * Math.PI) / SAMPLE_COUNT;

/** Max simultaneous localized impacts. */
const MAX_IMPACTS = BREATH.MAX_IMPACTS;
/** Impact arc half-width in radians (~25-45 degrees per impact). */
const ARC_HALF_MIN = BREATH.ARC_HALF_MIN;
const ARC_HALF_MAX = BREATH.ARC_HALF_MAX;
/** Distance range: spawn outside, push toward membrane. */
const SPAWN_DIST_MIN = BREATH.SPAWN_DIST_MIN;
const SPAWN_DIST_MAX = BREATH.SPAWN_DIST_MAX;
/** Single impact duration (ms). */
const IMPACT_DURATION_MIN = BREATH.IMPACT_DURATION_MIN;
const IMPACT_DURATION_MAX = BREATH.IMPACT_DURATION_MAX;
/** Spawn interval range (ms between new impacts). */
const SPAWN_INTERVAL_MIN = BREATH.SPAWN_INTERVAL_MIN;
const SPAWN_INTERVAL_MAX = BREATH.SPAWN_INTERVAL_MAX;

// Dark, desaturated teal — background-level
const WAVE_COLOR = BREATH.WAVE_COLOR;
const MEMBRANE_COLOR = BREATH.MEMBRANE_COLOR;

/** Max inward deformation of the membrane at impact center (px). */
const DEFORM_MAX_PX = BREATH.DEFORM_MAX_PX;

// ---------------------------------------------------------------------------
// Impact state
// ---------------------------------------------------------------------------

interface Impact {
  angle: number;        // center angle of the arc
  arcHalf: number;      // half-width in radians
  spawnDist: number;    // starting distance from boundary
  duration: number;     // total lifetime (ms)
  elapsed: number;      // time since spawn
  active: boolean;
}

// ---------------------------------------------------------------------------
// Deterministic-ish PRNG (seeded from elapsed time, not crypto-random)
// ---------------------------------------------------------------------------

function quickRng(seed: number): number {
  let h = (seed * 374761393 + 668265263) | 0;
  h = (Math.imul(h ^ (h >> 13), 1274126177)) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// BoundaryBreath
// ---------------------------------------------------------------------------

export class BoundaryBreath {
  private graphics!: Phaser.GameObjects.Graphics;
  private shape!: BoundaryShape;
  private phase!: TidePhase;
  private elapsed = 0;
  private nextSpawnIn = 0;
  private spawnCounter = 0;
  private readonly impacts: Impact[] = [];

  create(scene: Phaser.Scene, shape: BoundaryShape, tidePhase: TidePhase): void {
    this.shape = shape;
    this.phase = tidePhase;
    this.elapsed = 0;
    this.nextSpawnIn = 300;
    this.spawnCounter = 0;
    this.impacts.length = 0;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10);
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.updateImpacts(delta);
    this.draw();
  }

  destroy(): void {
    this.graphics?.destroy();
  }

  // ------------------------------------------------------------------ logic

  private updateImpacts(delta: number): void {
    // Advance existing impacts
    for (const imp of this.impacts) {
      if (imp.active) {
        imp.elapsed += delta;
        if (imp.elapsed >= imp.duration) {
          imp.active = false;
        }
      }
    }

    // Spawn new impacts
    this.nextSpawnIn -= delta;
    if (this.nextSpawnIn <= 0) {
      this.spawnImpact();
      // Faster spawning during crest
      const intervalMult = this.phase === 'crest' ? 0.6 : 1.0;
      const range = SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN;
      this.nextSpawnIn = (SPAWN_INTERVAL_MIN + quickRng(this.spawnCounter * 31 + 7) * range) * intervalMult;
    }
  }

  private spawnImpact(): void {
    this.spawnCounter++;
    const seed = this.spawnCounter;

    // Distribute impacts around the full boundary with mild pressure bias.
    // Use golden angle offset to avoid clustering.
    const goldenAngle = 2.399963; // radians (~137.5°)
    let angle = (seed * goldenAngle) % (Math.PI * 2);
    // 30% chance: nudge toward pressure direction (subtle bias, not cluster)
    const r = quickRng(seed * 13 + 3);
    if (r < 0.3) {
      const pressDir = this.shape.pressureDirection;
      angle = pressDir + (quickRng(seed * 7 + 11) - 0.5) * 3.0;
    }

    const arcHalf = ARC_HALF_MIN + quickRng(seed * 23 + 1) * (ARC_HALF_MAX - ARC_HALF_MIN);
    const spawnDist = SPAWN_DIST_MIN + quickRng(seed * 29 + 9) * (SPAWN_DIST_MAX - SPAWN_DIST_MIN);
    const duration = IMPACT_DURATION_MIN + quickRng(seed * 37 + 2) * (IMPACT_DURATION_MAX - IMPACT_DURATION_MIN);

    // Reuse an inactive slot or push new
    let slot = this.impacts.find(i => !i.active);
    if (!slot) {
      if (this.impacts.length >= MAX_IMPACTS) {
        // Replace oldest
        slot = this.impacts[0]!;
      } else {
        slot = { angle: 0, arcHalf: 0, spawnDist: 0, duration: 0, elapsed: 0, active: false };
        this.impacts.push(slot);
      }
    }

    slot.angle = angle;
    slot.arcHalf = arcHalf;
    slot.spawnDist = spawnDist;
    slot.duration = duration;
    slot.elapsed = 0;
    slot.active = true;
  }

  // ------------------------------------------------------------------ draw

  private draw(): void {
    this.graphics.clear();

    const cx = this.shape.centerX;
    const cy = this.shape.centerY;

    // --- Draw localized impacts (inward arcs) ---
    for (const imp of this.impacts) {
      if (!imp.active) continue;

      const progress = imp.elapsed / imp.duration;
      // Distance: outer → membrane
      const dist = imp.spawnDist * (1 - progress);

      // Alpha envelope: fade in (0-15%), sustain (15-70%), fade out (70-100%)
      let envelope: number;
      if (progress < 0.15) {
        envelope = progress / 0.15;
      } else if (progress > 0.7) {
        envelope = 1 - (progress - 0.7) / 0.3;
      } else {
        envelope = 1.0;
      }

      // Very low alpha — background only
      const baseAlpha = 0.06 + envelope * 0.09; // range 0.06 ~ 0.15
      const lineWidth = 1.5 + progress * 1.5;   // thicker as it approaches

      // Draw arc segments within this impact's angular range
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const segAngle = i * ANGLE_STEP;

        // Check if this segment is within the impact's arc
        let angleDiff = segAngle - imp.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) > imp.arcHalf) continue;

        // Cosine falloff from arc center
        const arcFalloff = Math.cos((angleDiff / imp.arcHalf) * (Math.PI / 2));
        const segAlpha = baseAlpha * arcFalloff;
        if (segAlpha < 0.015) continue;

        const nextAngle = ((i + 1) % SAMPLE_COUNT) * ANGLE_STEP;
        const r0 = this.shape.radiusAt(segAngle) + dist;
        const r1 = this.shape.radiusAt(nextAngle) + dist;

        const x0 = cx + Math.cos(segAngle) * r0;
        const y0 = cy + Math.sin(segAngle) * r0;
        const x1 = cx + Math.cos(nextAngle) * r1;
        const y1 = cy + Math.sin(nextAngle) * r1;

        this.graphics.lineStyle(lineWidth, WAVE_COLOR, segAlpha);
        this.graphics.beginPath();
        this.graphics.moveTo(x0, y0);
        this.graphics.lineTo(x1, y1);
        this.graphics.strokePath();
      }
    }

    // --- Draw void intrusion (dark wedges that simulate gradient layer deforming inward) ---
    // For each active impact near the membrane, fill a dark arc shape that extends
    // from the normal boundary inward by the deformation amount — looks like the
    // outer darkness is being pushed into the lit area.
    for (const imp of this.impacts) {
      if (!imp.active) continue;
      const progress = imp.elapsed / imp.duration;
      if (progress < 0.4) continue;

      const deformPhase = (progress - 0.4) / 0.6;
      const deformStrength = deformPhase < 0.5
        ? deformPhase * 2
        : 1 - (deformPhase - 0.5) * 1.2;
      if (deformStrength <= 0) continue;

      // Draw a filled polygon: outer edge at boundary, inner edge pushed inward
      // Covers the angular extent of this impact
      const steps = Math.ceil((imp.arcHalf * 2) / ANGLE_STEP);
      const startAngle = imp.angle - imp.arcHalf;

      // Alpha of the intrusion: subtle dark overlay
      const intrusionAlpha = 0.25 + deformStrength * 0.35; // 0.25 ~ 0.60

      this.graphics.fillStyle(0x080a0c, intrusionAlpha);
      this.graphics.beginPath();

      // Outer edge (at normal boundary radius) — clockwise
      for (let s = 0; s <= steps; s++) {
        const a = startAngle + (s / steps) * imp.arcHalf * 2;
        const r = this.shape.radiusAt(a);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (s === 0) this.graphics.moveTo(px, py);
        else this.graphics.lineTo(px, py);
      }

      // Inner edge (pushed inward by deformation) — counter-clockwise back
      for (let s = steps; s >= 0; s--) {
        const a = startAngle + (s / steps) * imp.arcHalf * 2;
        let angleDiff = a - imp.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const arcFalloff = Math.cos((angleDiff / imp.arcHalf) * (Math.PI / 2));
        const push = DEFORM_MAX_PX * Math.max(0, deformStrength) * arcFalloff;
        const r = this.shape.radiusAt(a) - push;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        this.graphics.lineTo(px, py);
      }

      this.graphics.closePath();
      this.graphics.fillPath();
    }

    // --- Draw membrane line with deformation ---
    // Impacts that are close to the membrane push it inward (visual only).
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const angle0 = i * ANGLE_STEP;
      const angle1 = ((i + 1) % SAMPLE_COUNT) * ANGLE_STEP;

      // Compute deformation: how many px to push inward at this angle
      let deform0 = 0;
      let deform1 = 0;
      let memAlpha = 0.04;
      let memWidth = 2;

      for (const imp of this.impacts) {
        if (!imp.active) continue;
        const progress = imp.elapsed / imp.duration;

        // Deformation ramps up as impact approaches, eases out at end
        // Active from 40% progress onward (when wave is getting close)
        if (progress < 0.4) continue;

        const deformPhase = (progress - 0.4) / 0.6; // 0→1 over last 60%
        // Ease: quick ramp in, slow release
        const deformStrength = deformPhase < 0.5
          ? deformPhase * 2                          // 0→1 in first half
          : 1 - (deformPhase - 0.5) * 1.2;          // 1→0.4 in second half (slow release)

        // Check angular proximity for each vertex
        for (const [angleN, idx] of [[angle0, 0], [angle1, 1]] as const) {
          let angleDiff = angleN - imp.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          if (Math.abs(angleDiff) > imp.arcHalf) continue;

          // Cosine falloff from impact center
          const arcFalloff = Math.cos((angleDiff / imp.arcHalf) * (Math.PI / 2));
          const push = DEFORM_MAX_PX * Math.max(0, deformStrength) * arcFalloff;

          if (idx === 0) deform0 = Math.max(deform0, push);
          else deform1 = Math.max(deform1, push);
        }

        // Glow at contact (last 30%)
        if (progress > 0.7) {
          let angleDiff = angle0 - imp.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (Math.abs(angleDiff) <= imp.arcHalf) {
            const arcFalloff = Math.cos((angleDiff / imp.arcHalf) * (Math.PI / 2));
            const contactIntensity = (progress - 0.7) / 0.3;
            memAlpha += arcFalloff * contactIntensity * 0.10;
            memWidth = Math.max(memWidth, 2 + contactIntensity * arcFalloff * 1.5);
          }
        }
      }

      memAlpha = Math.min(memAlpha, 0.22);

      // Apply deformation: push radius inward
      const r0 = this.shape.radiusAt(angle0) - deform0;
      const r1 = this.shape.radiusAt(angle1) - deform1;

      const x0 = cx + Math.cos(angle0) * r0;
      const y0 = cy + Math.sin(angle0) * r0;
      const x1 = cx + Math.cos(angle1) * r1;
      const y1 = cy + Math.sin(angle1) * r1;

      this.graphics.lineStyle(memWidth, MEMBRANE_COLOR, memAlpha);
      this.graphics.beginPath();
      this.graphics.moveTo(x0, y0);
      this.graphics.lineTo(x1, y1);
      this.graphics.strokePath();
    }
  }
}
