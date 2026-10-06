import * as THREE from 'three';
import { BODY_PROFILE_DATA } from '@/generated/contamination-body-data';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { StageWorldGeometry } from './world-geometry';
import type { RiftPresentationView } from './bridge';

const CAPACITY = 4096;
const FIBRE = 0xb1a28a, KNOT = 0x7d9381, PRESSURE = 0x89988a;
const STONE = 0x73796c, STONE_EDGE = 0xacb097, SOUND = 0xb5b4a0;

/** Sparse material marks on the same physical ground as the actors. No effect
 * in this class queries targets, changes controls, spends items or advances time. */
export class StageEffects {
  readonly group = new THREE.Group();
  private readonly positions = new Float32Array(CAPACITY * 3);
  private readonly colours = new Float32Array(CAPACITY * 3);
  private readonly opacity = new Float32Array(CAPACITY);
  private readonly sizes = new Float32Array(CAPACITY);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly point = { x: 0, y: 0 };
  private count = 0;
  private clipped = 0;
  private eventSequence = 0;
  private readonly impacts = Array.from({ length: 16 }, () => ({ active: false, at: 0, x: 0, y: 0, dx: 0, dy: 0 }));
  private nextImpact = 0;
  private lastSeams = 0;
  private lastPressures = 0;
  private lastSounds = 0;

  constructor(private readonly context: RiftDevRuntimeContext, private readonly world: StageWorldGeometry, visibility: THREE.Texture) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('colour', new THREE.BufferAttribute(this.colours, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('markOpacity', new THREE.BufferAttribute(this.opacity, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('markSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { stageSight: { value: visibility }, stageSize: { value: new THREE.Vector2(world.width, world.height) } },
      vertexShader: `attribute vec3 colour; attribute float markOpacity; attribute float markSize;
        varying vec3 ink; varying float opacity; varying vec2 ground;
        void main() { ink=colour; opacity=markOpacity; ground=position.xz;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=markSize; }`,
      fragmentShader: `uniform sampler2D stageSight; uniform vec2 stageSize;
        varying vec3 ink; varying float opacity; varying vec2 ground;
        void main() { float sight=texture2D(stageSight,ground/stageSize).r;
          if(sight<=0. || opacity<=0.) discard;
          gl_FragColor=vec4(ink,opacity*pow(sight,.65)); }`,
      transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    });
    const points = new THREE.Points(this.geometry, this.material);
    points.frustumCulled = false;
    points.renderOrder = 2; // Beneath the water's depth/colour passes, never over it.
    points.name = 'grounded-tool-material';
    this.group.add(points);
  }

  update(frame: RiftPresentationView): void {
    this.count = 0; this.clipped = 0;
    const tools = frame.tools;
    this.lastSeams = tools.seams.length; this.lastPressures = tools.pressures.length; this.lastSounds = tools.soundLures.length;
    for (const seam of tools.seams) {
      const dx = seam.bx - seam.ax, dy = seam.by - seam.ay, length = Math.max(1, Math.hypot(dx, dy));
      const steps = Math.ceil(length / 1.2), nx = -dy / length, ny = dx / length;
      for (let step = 0; step <= steps; step++) {
        const t = step / steps, slack = Math.sin(t * Math.PI) * Math.sin(t * 7.3) * 1.5 * (1 - seam.tension);
        const x = seam.ax + dx * t + nx * slack, y = seam.ay + dy * t + ny * slack;
        this.mark(x, y, step % 9 === 0 ? KNOT : FIBRE, 1.4, seam.opacity * .86);
        if (step % 11 < 3) this.mark(x + nx * 1.3, y + ny * 1.3, KNOT, 1.1, seam.opacity * .64);
      }
      this.object(seam.ax, seam.ay, KNOT, seam.opacity, true);
      this.object(seam.bx, seam.by, KNOT, seam.opacity, true);
    }
    for (const field of tools.pressures) {
      this.object(field.x, field.y, STONE, field.opacity);
      // Broken impressions sit on the actual radius, with quiet empty stretches.
      for (let arc = 0; arc < 11; arc++) {
        const start = arc * Math.PI * 2 / 11 + .055 * Math.sin(arc * 2.1);
        const length = .10 + .07 * (1 + Math.sin(arc * 1.7));
        for (let at = 0; at <= length; at += .022) {
          const angle = start + at;
          this.mark(field.x + Math.cos(angle) * field.radius, field.y + Math.sin(angle) * field.radius,
            PRESSURE, 1.4, field.opacity * .56);
        }
      }
      for (let trace = 0; trace < 7; trace++) {
        const angle = trace * 2.399, radius = field.radius * (.3 + .055 * trace);
        const x = field.x + Math.cos(angle) * radius, y = field.y + Math.sin(angle) * radius;
        this.line(x, y, x + Math.cos(angle + .7) * 4, y + Math.sin(angle + .7) * 4, PRESSURE, field.opacity * .27);
      }
    }
    for (const sound of tools.soundLures) {
      const fade = Math.min(1, sound.remainingMs / 500);
      this.object(sound.x, sound.y, SOUND, fade);
      if (sound.elapsedMs < 160) {
        const t = sound.elapsedMs / 160;
        this.object(sound.fromX + (sound.x - sound.fromX) * t, sound.fromY + (sound.y - sound.fromY) * t,
          SOUND, 1 - t * .35, false, Math.sin(t * Math.PI) * 10 + 2);
      }
      const pulse = sound.pulseElapsedMs / Math.max(1, sound.pulseIntervalMs), radius = 5 + pulse * 22;
      for (let i = 0; i < 15; i++) {
        if (i % 4 === 0) continue;
        const angle = i * Math.PI * 2 / 15;
        this.mark(sound.x + Math.cos(angle) * radius, sound.y + Math.sin(angle) * radius,
          SOUND, 1.5, fade * (1 - pulse) * .58);
      }
    }
    for (const enemy of frame.enemies) {
      if (enemy.visibility <= 0) continue;
      if (enemy.restraint?.pressure || enemy.restraint?.snared) {
        for (const side of [-1, 1]) {
          const nx = -Math.sin(enemy.facing) * 12 * side, ny = Math.cos(enemy.facing) * 12 * side;
          this.line(enemy.position.x + nx, enemy.position.y + ny,
            enemy.position.x + nx - Math.cos(enemy.facing) * 5,
            enemy.position.y + ny - Math.sin(enemy.facing) * 5, PRESSURE, .78);
        }
      }
      const attack = enemy.attack, profile = BODY_PROFILE_DATA[enemy.substrate];
      if (!profile || (attack.phase !== 'windup' && attack.phase !== 'strike')) continue;
      const facing = attack.facingAngle ?? enemy.facing, alpha = attack.phase === 'strike' ? .8 : .18 + .56 * attack.progress;
      this.line(enemy.position.x, enemy.position.y,
        enemy.position.x + Math.cos(facing) * profile.rangePx, enemy.position.y + Math.sin(facing) * profile.rangePx,
        STONE_EDGE, alpha * .6);
      for (const side of [-1, 1]) {
        const angle = facing + side * profile.halfAngleDeg * Math.PI / 180;
        this.line(enemy.position.x + Math.cos(angle) * (profile.rangePx - 6),
          enemy.position.y + Math.sin(angle) * (profile.rangePx - 6),
          enemy.position.x + Math.cos(angle) * profile.rangePx, enemy.position.y + Math.sin(angle) * profile.rangePx,
          STONE_EDGE, alpha);
      }
    }
    for (const event of frame.events) {
      if (event.sequence <= this.eventSequence) continue;
      this.eventSequence = event.sequence;
      if (event.kind !== 'enemy-hit' || this.context.visibilityAt(event.position) <= 0) continue;
      const hit = this.impacts[this.nextImpact]!; this.nextImpact = (this.nextImpact + 1) % this.impacts.length;
      hit.active = true; hit.at = event.elapsedMs; hit.x = event.position.x; hit.y = event.position.y;
      hit.dx = event.direction.x; hit.dy = event.direction.y;
    }
    for (const hit of this.impacts) {
      const age = frame.elapsedMs - hit.at;
      if (!hit.active || age < 0) continue;
      if (age >= 240) { hit.active = false; continue; }
      for (let piece = 0; piece < 5; piece++) {
        const t = age / 240, sideways = (piece - 2) * (1.2 + t * 2);
        const x = hit.x - hit.dx * 5 + hit.dx * t * (8 + piece) - hit.dy * sideways;
        const y = hit.y - hit.dy * 5 + hit.dy * t * (8 + piece) + hit.dx * sideways;
        this.mark(x, y, piece % 2 ? STONE_EDGE : KNOT, 1.5, (1 - t) * .8, 5 * (1 - t));
      }
    }
    this.geometry.setDrawRange(0, this.count);
    for (const name of ['position', 'colour', 'markOpacity', 'markSize']) this.geometry.getAttribute(name).needsUpdate = true;
  }

  private line(ax: number, ay: number, bx: number, by: number, colour: number, opacity: number): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let at = 0; at <= steps; at++) this.mark(ax + (bx - ax) * at / steps, ay + (by - ay) * at / steps, colour, 1.3, opacity);
  }

  private object(x: number, y: number, colour: number, opacity: number, knot = false, lift = 0): void {
    const reach = knot ? 1 : 2;
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      if (dx === reach && dy === -reach || dx === -reach && dy === reach) continue;
      this.mark(x + dx, y + dy, dx + dy < 0 ? STONE_EDGE : colour, 1.6, opacity, lift + 1);
    }
  }

  private mark(x: number, y: number, colour: number, size: number, opacity: number, lift = 0): void {
    if (opacity <= 0 || this.count >= CAPACITY) return;
    if (!this.world.isFloor(x, y)) { this.clipped++; return; }
    this.point.x = x; this.point.y = y;
    // Real-time visibility prevents a just-hidden actor's trace revealing its
    // position during the terrain texture's bounded 20 Hz refresh interval.
    if (this.context.visibilityAt(this.point) <= 0) return;
    const at = this.count++, offset = at * 3;
    this.positions[offset] = x; this.positions[offset + 1] = this.world.groundHeightAt(x, y) + .7 + lift;
    this.positions[offset + 2] = y;
    this.colours[offset] = (colour >> 16 & 255) / 255;
    this.colours[offset + 1] = (colour >> 8 & 255) / 255;
    this.colours[offset + 2] = (colour & 255) / 255;
    this.opacity[at] = opacity; this.sizes[at] = size;
  }

  /** Read-only geometry diagnostics; callers cannot mutate the live buffers. */
  copyGroundPoints(): Float32Array { return this.positions.slice(0, this.count * 3); }
  snapshot(): Record<string, unknown> {
    return { points: this.count, clippedUnsupported: this.clipped,
      seams: this.lastSeams, pressures: this.lastPressures, soundLures: this.lastSounds };
  }

  destroy(): void {
    this.geometry.dispose(); this.material.dispose(); this.group.clear();
  }
}
