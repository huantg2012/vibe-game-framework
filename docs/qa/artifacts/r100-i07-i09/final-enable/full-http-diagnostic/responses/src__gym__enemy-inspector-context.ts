/** Visual calibration only: production ground, production actors and a real host seat. */
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { Player } from '@/entities/player';
import { schemeDMixed } from '@/entities/form-renderers/scheme-d-mixed';
import type { FormVisual } from '@/entities/form-renderers/form-renderer';
import { generateRiftLayout } from '@/generation/rift-layout';
import { PREVIEW_RECIPES } from '@/generation/recipes';
import { RiftSurfacePainter } from '@/systems/procedural-surface';
import { ContaminationHostSystem } from '@/systems/contamination-host-system';
import { TileGrid } from '@/systems/tile-grid';
import { INSPECTOR_ENTRIES, inspectorForm } from './enemy-inspector-catalog';
import type { PreviewSelection } from './enemy-inspector-preview';
export class EnemyInspectorContext extends Phaser.Scene {
    private selection!: PreviewSelection;
    private readonly surface = new RiftSurfacePainter();
    private readonly player = new Player();
    private readonly hosts = new ContaminationHostSystem();
    private samples: {
        visual: FormVisual;
        x: number;
        y: number;
    }[] = [];
    private hostVisual?: FormVisual;
    private hostId?: string;
    private volumeTime = 0;
    constructor() { super('EnemyInspectorContext'); }
    init(selection: PreviewSelection): void { this.selection = selection; this.samples = []; this.hostId = undefined; this.hostVisual = undefined; this.volumeTime = 0; }
    create(): void {
        const recipe = PREVIEW_RECIPES.find(r => r.fragmentTypeId === this.selection.fragmentTypeId);
        const layout = generateRiftLayout(18, recipe ? { recipeId: recipe.id } : undefined);
        const grid = new TileGrid(layout.tileMap);
        this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);
        this.surface.mount(this, layout.ruins, 'inspector-context-ground', 0);
        // Live construction supplies the production seam, nuclei and footprint;
        // calibration holds its clocks still instead of using the legacy map proxy.
        this.hosts.bindPractice(this, layout.contaminationPins, null, null, () => 1, { liveMotion: true, occluders: grid });
        let center = { ...layout.spawnPoint };
        if (this.selection.form.portfolio !== 'jia') {
            this.hostId = this.hosts.spawnForm(this.selection.form) ?? undefined;
            if (!this.hostId)
                throw new Error('No legal environmental calibration seat');
            const subject = this.hosts.getSubjects().find(s => s.id === this.hostId);
            if (subject)
                center = { ...subject.position };
            if (this.hostId) {
                this.hosts.setSkipPaint(true);
                this.hostVisual = schemeDMixed.attach({ scene: this, form: this.selection.form, seed: this.selection.seed, subjectId: this.hostId,
                    fragmentTypeId: layout.fragmentTypeId, pin: this.hosts.getVisualPin(this.hostId) ?? undefined,
                    isWalkableFloor: (col, row) => grid.isWalkable(col, row),
                    depth: this.selection.form.portfolio === 'bing' ? 1 : 25, textureNamespace: 'context-host' });
                this.hosts.setStepFloors(this.hostId, this.hostVisual.stepFloors ?? []);
            }
        }
        const floor: {
            x: number;
            y: number;
        }[] = [];
        for (let row = 1; row < layout.tileMap.rows - 1; row++)
            for (let col = 1; col < layout.tileMap.cols - 1; col++) {
                const x = (col + .5) * GAME_CONSTANTS.TILE_SIZE, y = (row + .5) * GAME_CONSTANTS.TILE_SIZE;
                if (grid.isWalkableAt(x, y))
                    floor.push({ x, y });
            }
        const used: {
            x: number;
            y: number;
        }[] = [];
        const take = (target: {
            x: number;
            y: number;
        }) => {
            const point = floor.filter(p => used.every(u => Math.hypot(p.x - u.x, p.y - u.y) >= 42)).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
            if (!point)
                throw new Error('No calibration floor seat');
            used.push(point);
            return point;
        };
        const families = INSPECTOR_ENTRIES.filter(e => e.family.portfolio === 'jia');
        for (const [i, entry] of families.entries()) {
            const pos = take({ x: center.x + (i % 3 - 1) * 64, y: center.y + 64 + Math.floor(i / 3) * 64 });
            const visual = schemeDMixed.attach({ scene: this, form: inspectorForm(entry, this.selection.form.coverage), seed: entry.variants[0]!.seed,
                fragmentTypeId: layout.fragmentTypeId, depth: 20 + pos.y / 100000, textureNamespace: 'context-body' });
            this.samples.push({ visual, ...pos });
        }
        const playerAt = take({ x: center.x - 64, y: center.y });
        this.player.create(this, { spawn: playerAt, depth: 22, facing: 'down' });
        this.player.setInputEnabled(false);
        this.hosts.update(0, playerAt, false, 0);
        this.input.keyboard?.disableGlobalCapture();
        const bounds = [...used, center];
        const volume = this.hostId ? this.hosts.getVolumePresenceFrame(this.hostId) : undefined;
        if (volume) bounds.push({ x: volume.rect.x, y: volume.rect.y },
            { x: volume.rect.x + volume.rect.w, y: volume.rect.y + volume.rect.h });
        const minX = Math.min(...bounds.map(p => p.x)) - 70, maxX = Math.max(...bounds.map(p => p.x)) + 70;
        const minY = Math.min(...bounds.map(p => p.y)) - 80, maxY = Math.max(...bounds.map(p => p.y)) + 70;
        this.cameras.main.setBackgroundColor('#101718').setZoom(Math.min(3, 960 / (maxX - minX), 640 / (maxY - minY))).centerOn((minX + maxX) / 2, (minY + maxY) / 2);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            for (const sample of this.samples)
                sample.visual.destroy();
            this.samples = [];
            this.hostVisual?.destroy();
            this.hostVisual = undefined;
            this.hosts.destroy();
            this.player.destroy();
            this.surface.destroy();
        });
    }
    update(_time: number, delta: number): void {
        this.surface.update(delta);
        this.player.update(delta);
        this.player.postUpdate();
        for (const sample of this.samples)
            sample.visual.update({ x: sample.x, y: sample.y, facing4: 'down', moving: false, signal: 'idle', visibility: 1, deltaMs: delta, activity: { phase: 'active', progress: 1 } });
        if (this.hostId && this.hostVisual) {
            // This comparison deliberately shows the full material cycle. Real
            // sensing and danger remain available in the separate arena mode.
            this.volumeTime += Math.min(100, Math.max(0, delta));
            this.hosts.setVolumePreviewTime(this.hostId, this.volumeTime, true);
            const host = this.hosts.getSubjects().find(s => s.id === this.hostId);
            const pin = this.hosts.getVisualPin(this.hostId);
            if (host)
                this.hostVisual.update({ x: pin?.kind === 'cluster' ? pin.x : host.position.x,
                    y: pin?.kind === 'cluster' ? pin.y : host.position.y,
                    facing4: this.hosts.getVisualFacing(this.hostId), moving: false, signal: 'idle', visibility: 1, deltaMs: delta, activity: { phase: 'active', progress: 1 } });
        }
    }
}
