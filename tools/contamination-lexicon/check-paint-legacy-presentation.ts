/** Real renderer boundary on the user-reported old world. A minimal canvas
 * stores actual material output; only Phaser drawing and Host activity query
 * are stubbed. No fixture implementation of paint shape/visibility is used. */
import assert from 'node:assert/strict';
import type Phaser from 'phaser';
import { attachBingPaintGenome } from '../../src/entities/form-renderers/d/paint-genome/attach';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { createWorldProductionMap } from '../../src/generation/world-study/production-map';
import { TileGrid } from '../../src/systems/tile-grid';
import { mix32 } from '../../src/generation/seed-fork';

const world = createWorldProductionMap('ivory-basin', 'open-scars', 1644663053,
  { contentFragmentTypeId: 'frag-library', paintGeometryVersion: 1 });
const hostGrid = new TileGrid(world.hostTileMap), physical = new TileGrid(world.layout.tileMap);
const textures = new Map<string, { w: number; h: number; data: Uint8ClampedArray }>();
const images: { x: number; y: number }[] = [];
let active = true;
const chain = (): any => { const value = new Proxy({}, { get: () => () => value }); return value; };
const image = (): any => {
  const value = { x: 0, y: 0, setPosition(x: number, y: number) { value.x = x; value.y = y; return proxy; } };
  const proxy = new Proxy(value, { get: (target, key) => Reflect.get(target, key) ?? (() => proxy) });
  images.push(value); return proxy;
};
const scene = {
  add: { graphics: chain, image },
  hosts: { isPaintFloorActive: () => active },
  textures: {
    exists: (key: string) => textures.has(key), remove: (key: string) => textures.delete(key),
    createCanvas: (key: string, w: number, h: number) => {
      const texture = { w, h, data: new Uint8ClampedArray(w * h * 4) }; textures.set(key, texture);
      return { setFilter() {}, refresh() {}, getContext: () => ({
        createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
        putImageData: (pixels: { data: Uint8ClampedArray }) => texture.data.set(pixels.data),
      }) };
    },
  },
} as unknown as Phaser.Scene;

let restoredPixels = 0, tested = 0;
for (const [slot, form] of world.layout.contaminationDraw.forms.filter(form => form.portfolio === 'bing').entries()) {
  const id = `ENM_BING_${String(slot + 1).padStart(2, '0')}`, seat = world.layout.contaminationPins.paintFloors[slot]!;
  const pin = { kind: 'cluster' as const, x: (seat.floorCol + .5) * 32, y: (seat.floorRow + .5) * 32 };
  const seed = mix32(world.layout.seed, id), request = { substrate: form.substrate, coverage: form.coverage, seed,
    continuity: form.continuity, sense: form.lexemes.sense, rhythm: form.lexemes.rhythm,
    fragmentTypeId: world.layout.fragmentTypeId, veinVariant: resolvePaintVeinVariant(form.substrate, seed) };
  const old = bakePaintGenome({ ...request, geometryVersion: 1 });
  const expected = collectPaintGenomeFloorTiles(old.field, old.canvasW, old.canvasH, pin.x, pin.y, 32)
    .filter(cell => hostGrid.isWalkable(cell.col, cell.row));
  const visual = attachBingPaintGenome({ scene, form, seed, subjectId: id, pin, depth: .2,
    fragmentTypeId: world.layout.fragmentTypeId, paintGeometryVersion: 1,
    isWalkableFloor: (col, row) => hostGrid.isWalkable(col, row),
    surfaceFloorAt: point => physical.isWalkableAt(point.x, point.y), surfaceFloorTileSize: physical.tileSize, surfaceVisibilityAt: () => 1 });
  assert.deepEqual(visual.stepFloors, expected, `${id}: original danger registration is byte-for-byte unchanged`);
  const texture = [...textures.values()].at(-1)!;
  const actualImage = images.at(-1)!;
  assert(texture.w > old.canvasW && texture.h > old.canvasH, `${id}: legacy contact contract no longer forces a cropped display`);
  const outside: number[] = [];
  const check = (dead: boolean): void => {
    const left = actualImage.x - texture.w / 2, top = actualImage.y - texture.h / 2;
    for (let y = 0; y < texture.h; y++) for (let x = 0; x < texture.w; x++) {
      const index = (y * texture.w + x) * 4, alpha = texture.data[index + 3]!;
      if (!alpha) continue;
      const wx = left + x + .5, wy = top + y + .5;
      assert(physical.isWalkableAt(wx, wy), `${id}: presentation cannot occupy true VOID`);
      if (Math.abs(wx - pin.x) > old.canvasW / 2 || Math.abs(wy - pin.y) > old.canvasH / 2) {
        if (!dead) { outside.push(index); assert(alpha > 100, `${id}: living extension keeps the material, without an old rectangular faded edge`); }
        else assert.equal(alpha, 100, `${id}: all-dead legacy host leaves a harmless residual extension`);
      }
    }
  };
  const pose = { x: pin.x, y: pin.y, facing4: 'right' as const, moving: false, visibility: 1, signal: 'idle' as const, deltaMs: 0 };
  active = true; visual.update(pose); check(false);
  restoredPixels += outside.length;
  active = false; visual.update(pose); check(true);
  for (const index of outside) assert.equal(texture.data[index + 3], 100, `${id}: no living extension survives when all old hazard cells stop`);
  assert.deepEqual(visual.stepFloors, expected, `${id}: display activity never migrates danger cells`);
  // An independently attached same-seed renderer over unrestricted ground is
  // the full-shape reference. Actual terrain may translate the whole anatomy,
  // but must never delete its lobes or shrink them to fit the old cell set.
  active = true;
  const complete = attachBingPaintGenome({ scene, form, seed, subjectId: id, pin, depth: .2,
    textureNamespace: `reference_${id}`, fragmentTypeId: world.layout.fragmentTypeId, paintGeometryVersion: 1,
    isWalkableFloor: (col, row) => hostGrid.isWalkable(col, row), surfaceFloorAt: () => true,
    surfaceFloorTileSize: physical.tileSize, surfaceVisibilityAt: () => 1 });
  const reference = [...textures.values()].at(-1)!;
  assert(texture.w >= reference.w && texture.h >= reference.h, 'placement may add storage padding, never reduce the complete canvas');
  const occupied = (data: Uint8ClampedArray): number => {
    let count = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) count++; return count;
  };
  for (let frame = 0; frame < 12; frame++) {
    const livePose = { ...pose, signal: frame % 2 ? 'inflated' as const : 'idle' as const, deltaMs: frame === 0 ? 0 : 240 };
    visual.update(livePose); complete.update(livePose);
    assert.equal(occupied(texture.data), occupied(reference.data), `${id}, frame${frame}: every complete anatomical pixel survives terrain placement`);
    const left = actualImage.x - texture.w / 2, top = actualImage.y - texture.h / 2;
    for (let y = 0; y < texture.h; y++) for (let x = 0; x < texture.w; x++) if (texture.data[(y * texture.w + x) * 4 + 3])
      assert(physical.isWalkableAt(left + x + .5, top + y + .5), `${id}, frame${frame}: breathing never enters true VOID`);
  }
  complete.destroy();
  visual.destroy(); tested++;
}
assert(tested >= 7 && restoredPixels > 0, 'the actual reported world recovers material beyond its old canvases');
console.log(`PASS legacy paint presentation: ${tested} reported v1-world hosts keep original danger cells; ${restoredPixels} restored pixels beyond old canvases; ${tested * 12} complete-shape breathing frames retain every material pixel; live material/dead residue and true VOID rules hold.`);
