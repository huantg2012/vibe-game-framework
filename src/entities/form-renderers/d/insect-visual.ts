import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { FormAttachContext, FormVisual, FormVisualPose } from '@/entities/form-renderers/form-renderer';
import { applyFormVisibility } from '@/entities/form-renderers/form-renderer';
import { bakeInsectModel, type InsectPhase } from '@/entities/form-renderers/d/insect-model';

let nextInsectTexture = 0;

/** One mutable texture per insect, bounded memory regardless of time/facing changes. */
export function attachInsectVisual(ctx: FormAttachContext): FormVisual {
  const key = `${ctx.textureNamespace ?? 'rift'}-insect16-${nextInsectTexture++}`;
  const texture = ctx.scene.textures.createCanvas(key, 48, 48);
  if (!texture) throw new Error('Could not allocate insect texture');
  const image = ctx.scene.add.image(0, 0, key).setDepth(ctx.depth).setOrigin(0.5);
  image.setScale(ctx.displayScale ?? 1);
  const pixels = texture.getContext().createImageData(48, 48);
  let clock = 0;
  let lastFrame = '';
  let lastPhase: InsectPhase = 'idle';
  let phaseClock = 0;
  let reviewCoverage: CoverageId | null = null;
  let lastPose: FormVisualPose | null = null;

  const visual: FormVisual = {
    update(pose: FormVisualPose) {
      lastPose = pose;
      const dt = Math.max(0, Math.min(pose.deltaMs, 50));
      clock += dt;
      let phase: InsectPhase;
      let progress: number;
      let facing = pose.facing4;
      if (pose.attack && pose.attack.phase !== 'idle') {
        phase = pose.attack.phase;
        progress = pose.attack.progress;
        // The telegraph and anatomy point along the same committed attack heading.
        const angle = pose.attack.facingAngle;
        if (angle !== undefined) {
          facing = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
            ? Math.cos(angle) > 0 ? 'right' : 'left'
            : Math.sin(angle) > 0 ? 'down' : 'up';
        }
      } else {
        phase = pose.moving ? 'walk' : pose.signal === 'awake' || pose.signal === 'inflated' ? 'alert' : 'idle';
        // Gallery signals have no combat clock; preview them without affecting play.
        if (!pose.attack && pose.signal === 'strike') phase = 'strike';
        if (!pose.attack && pose.signal === 'inflated') phase = 'windup';
        if (phase !== lastPhase) phaseClock = 0;
        phaseClock += dt;
        progress = phase === 'walk' ? phaseClock / 720 % 1
          : phase === 'windup' ? Math.min(1, phaseClock / 350)
          : phase === 'strike' ? 0 : clock / 2400 % 1;
      }
      lastPhase = phase;
      image.setPosition(pose.x, pose.y);
      applyFormVisibility(image, pose.visibility);
      // Hidden insects advance their clocks but do not allocate/upload unseen frames.
      if (pose.visibility <= 0) return;
      const sample = Math.min(29, Math.floor(Math.max(0, progress) * 30));
      const coverage = reviewCoverage ?? ctx.form.coverage;
      const frameKey = `${coverage}:${facing}:${phase}:${sample}`;
      if (frameKey !== lastFrame) {
        const baked = bakeInsectModel({ seed: ctx.seed, coverage, facing4: facing, phase, phase01: sample / 29 });
        pixels.data.set(baked.buf.data);
        texture.getContext().putImageData(pixels, 0, 0);
        texture.refresh();
        lastFrame = frameKey;
      }
    },
    setReviewCoverage(coverage) {
      if (!import.meta.env.DEV) return;
      reviewCoverage = coverage;
      lastFrame = '';
      if (lastPose) visual.update({ ...lastPose, deltaMs: 0 });
    },
    getFlashSource() {
      return { textureKey: key, originX: image.originX, originY: image.originY, scaleX: image.scaleX, scaleY: image.scaleY };
    },
    destroy() {
      image.destroy();
      ctx.scene.textures.remove(key);
    },
  };
  visual.update({ x: 0, y: 0, facing4: 'down', moving: false, visibility: 1, signal: 'idle', deltaMs: 0 });
  return visual;
}
