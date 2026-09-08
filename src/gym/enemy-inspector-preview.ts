import Phaser from 'phaser';
import { rgbToHex, yardSurfaceColors } from '@/entities/form-renderers/d/fragment-ramp';
import type { FormVisual, FormVisualPose } from '@/entities/form-renderers/form-renderer';
import { schemeDMixed } from '@/entities/form-renderers/scheme-d-mixed';
import { productionModelFor } from '@/entities/form-renderers/d/production-models';
import type { ContaminationForm } from '@/generation/contamination-draw';
import { actionLabel, actionDuration, actionsFor, volumePreviewTime, type InspectorEntry, type ReviewAction } from './enemy-inspector-catalog';
export interface PreviewSelection {
    entry: InspectorEntry;
    form: ContaminationForm;
    seed: number;
    fragmentTypeId: string;
}
export class EnemyInspectorPreview extends Phaser.Scene {
    private selection!: PreviewSelection;
    private visual?: FormVisual;
    private hostLayer?: Phaser.GameObjects.Container;
    private image?: Phaser.GameObjects.Image;
    private texture?: Phaser.Textures.CanvasTexture;
    private native?: Phaser.GameObjects.Image;
    private frameKey = '';
    private hostTime = -1;
    private elapsed = 0;
    private volumeCycleOffset = 0;
    private action: ReviewAction = 'idle';
    private auto = true;
    private playing = true;
    private speed = 1;
    private facing: FormVisualPose['facing4'] = 'down';
    private zoom = 5;
    private caption?: Phaser.GameObjects.Text;
    constructor() { super('EnemyInspectorPreview'); }
    init(selection: PreviewSelection): void { this.selection = selection; this.elapsed = 0; this.volumeCycleOffset = 0; this.action = 'idle'; this.playing = true; this.auto = true; this.frameKey = ''; this.hostTime = -1; }
    create(): void {
        this.cameras.main.setBackgroundColor(rgbToHex(yardSurfaceColors(this.selection.fragmentTypeId).floor));
        const g = this.add.graphics();
        g.lineStyle(1, 0x91a1a6, .045);
        for (let x = 0; x < 960; x += 32)
            g.lineBetween(x, 0, x, 640);
        for (let y = 0; y < 640; y += 32)
            g.lineBetween(0, y, 960, y);
        g.lineStyle(1, 0x839c9c, .3).lineBetween(435, 350, 525, 350).lineBetween(480, 342, 480, 358);
        this.caption = this.add.text(28, 25, '', { fontFamily: 'sans-serif', fontSize: '16px', color: '#acb9be' });
        this.add.text(28, 600, '脚底锚点固定 · 使用生产绘制函数 · 检视姿态不结算伤害', { fontFamily: 'sans-serif', fontSize: '13px', color: '#869499' });
        if (productionModelFor(this.selection.form.substrate) && this.selection.form.portfolio === 'jia') {
            const baked = productionModelFor(this.selection.form.substrate)!.bake({ seed: this.selection.seed, coverage: this.selection.form.coverage, facing4: this.facing, phase: 'idle', phase01: 0 });
            this.texture = this.textures.createCanvas('inspector-body', baked.canvas.w, baked.canvas.h)!;
            this.image = this.add.image(480, 350, 'inspector-body').setOrigin(baked.canvas.originX / baked.canvas.w, baked.canvas.originY / baked.canvas.h).setScale(this.zoom);
            this.native = this.add.image(830, 535, 'inspector-body').setOrigin(this.image.originX, this.image.originY);
            this.add.text(785, 565, '原始像素 1×', { fontFamily: 'sans-serif', fontSize: '13px', color: '#869499' });
        }
        else {
            this.zoom = 2;
            this.makeHost();
        }
        this.draw();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.visual?.destroy();
            this.visual = undefined;
            this.hostLayer?.destroy();
            this.hostLayer = undefined;
            this.image?.destroy();
            this.image = undefined;
            this.native?.destroy();
            this.native = undefined;
            if (this.texture)
                this.textures.remove('inspector-body');
            this.texture = undefined;
        });
    }
    update(_time: number, delta: number): void {
        if (!this.playing)
            return;
        this.elapsed += Math.min(delta, 100) * this.speed;
        const duration = actionDuration(this.selection.entry, this.action);
        if (this.elapsed >= duration) {
            if (!this.auto && this.action === 'idle' && volumePreviewTime(this.selection.entry, this.action, 0) !== undefined)
                this.volumeCycleOffset += Math.floor(this.elapsed / duration) * duration;
            this.elapsed %= duration;
            if (this.auto) {
                const actions = actionsFor(this.selection.entry);
                this.action = actions[(actions.indexOf(this.action) + 1) % actions.length]!;
                this.elapsed = 0;
            }
        }
        this.draw();
    }
    setAction(action: ReviewAction | 'auto'): void { this.auto = action === 'auto'; this.action = action === 'auto' ? 'idle' : action; this.elapsed = 0; this.volumeCycleOffset = 0; this.hostTime = -1; this.draw(); }
    setFacing(facing: FormVisualPose['facing4']): void { this.facing = facing; this.hostTime = -1; this.draw(); }
    setZoom(zoom: number): void { this.zoom = zoom; this.image?.setScale(zoom); if (this.visual) {
        this.makeHost();
        this.draw();
    } }
    setSpeed(speed: number): void { this.speed = speed; }
    togglePlay(): void { this.playing = !this.playing; }
    seek(progress: number): void { this.playing = false; this.volumeCycleOffset = 0; this.elapsed = Math.max(0, Math.min(1, progress)) * actionDuration(this.selection.entry, this.action); this.draw(); }
    step(direction: number): void { this.seek(this.elapsed / actionDuration(this.selection.entry, this.action) + direction / 29); }
    getReviewState() { return { action: this.action, label: actionLabel(this.selection.entry, this.action), progress: this.elapsed / actionDuration(this.selection.entry, this.action), playing: this.playing, auto: this.auto, speed: this.speed, facing: this.facing, zoom: this.zoom, seed: this.selection.seed }; }
    private makeHost(): void {
        this.visual?.destroy();
        this.hostLayer?.destroy();
        const start = this.children.list.length;
        const { form, seed, fragmentTypeId } = this.selection;
        this.visual = schemeDMixed.attach({ scene: this, form, seed, fragmentTypeId, depth: 10, displayScale: 1, textureNamespace: 'inspector-host', stainWorldPoint: { x: -1000, y: -1000 }, pin: { kind: form.occupancy === 'wall' ? 'wall' : form.occupancy === 'paint' ? 'cluster' : 'volume', x: form.occupancy === 'volume' ? 384 : 480, y: form.occupancy === 'volume' ? 254 : 350, width: 192, height: 192 } });
        const objects = this.children.list.slice(start);
        this.hostLayer = this.add.container(480 * (1 - this.zoom), 350 * (1 - this.zoom), objects).setScale(this.zoom).setDepth(10);
        this.hostTime = 0;
    }
    private draw(): void {
        const { entry, form, seed } = this.selection;
        const progress = Math.max(0, Math.min(1, this.elapsed / actionDuration(entry, this.action)));
        this.caption?.setText(`${entry.label} / ${actionLabel(entry, this.action)}${this.auto ? ' · 自动巡演' : ''}`);
        if (this.texture) {
            const sample = Math.round(progress * 29);
            const key = `${this.action}/${sample}/${this.facing}`;
            if (key === this.frameKey)
                return;
            const rest = this.action === 'rest' ? 1 : this.action === 'wake' ? 1 - progress : 0;
            const phase = this.action === 'rest' || this.action === 'wake' ? 'idle' : this.action;
            const baked = productionModelFor(form.substrate)!.bake({ seed, coverage: form.coverage, facing4: this.facing, phase, phase01: sample / 29, restAmount: rest });
            const ctx = this.texture.getContext();
            const data = ctx.createImageData(baked.buf.w, baked.buf.h);
            data.data.set(baked.buf.data);
            ctx.putImageData(data, 0, 0);
            this.texture.refresh();
            this.frameKey = key;
        }
        else {
            // Rebuild on backwards seek so accumulated environmental animation clocks
            // cannot keep running ahead of the visible playhead.
            if (this.hostTime < 0 || this.elapsed < this.hostTime)
                this.makeHost();
            const volumeTime = volumePreviewTime(entry, this.action, this.elapsed + (this.action === 'idle' ? this.volumeCycleOffset : 0));
            let remaining = volumeTime === undefined ? this.elapsed - this.hostTime : 0;
            do {
                const dt = Math.min(50, Math.max(0, remaining));
                this.visual?.update({ x: 480, y: 350, facing4: this.facing, moving: false, visibility: 1, signal: this.action === 'strike' ? 'strike' : this.action === 'windup' ? 'inflated' : 'idle', deltaMs: dt, volumeTimeMs: volumeTime, attack: {phase:this.action==='windup'||this.action==='strike'||this.action==='recover'?this.action:'idle',progress}, activity:{phase:this.action==='rest'?'rest':this.action==='wake'?'waking':'active',progress:this.action==='wake'?progress:1} });
                remaining -= dt;
            } while (remaining > 0);
            this.hostTime = this.elapsed;
        }
    }
}
