import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { bakeBeastModel, beastVariantOf, BEAST_VARIANTS } from '../../src/entities/form-renderers/d/beast-model';
import { bakeWormModel, wormVariantOf, WORM_VARIANTS } from '../../src/entities/form-renderers/d/worm-model';
import { bakeRemnantModel, remnantVariantOf, REMNANT_VARIANTS } from '../../src/entities/form-renderers/d/remnant-model';
import { bakeGrowthModel, growthVariantOf, GROWTH_VARIANTS } from '../../src/entities/form-renderers/d/growth-model';
import { bakeDoorModel, doorVariantOf, DOOR_VARIANTS, bakeWreckageModel, wreckageVariantOf, WRECKAGE_VARIANTS } from '../../src/entities/form-renderers/d/relic-model';
import type { CreatureModelRequest, CreatureModelResult } from '../../src/entities/form-renderers/d/model-raster';

const out = 'docs/art/iteration-18-evidence';
const tiers = ['infiltrate', 'rewrite', 'overwrite'] as const;
const facings = ['down', 'left', 'up', 'right'] as const;
const phases = ['idle', 'walk', 'alert', 'windup', 'strike', 'recover'] as const;
const families = [
  { id: 'beast', bake: bakeBeastModel, variant: beastVariantOf, names: BEAST_VARIANTS },
  { id: 'worm', bake: bakeWormModel, variant: wormVariantOf, names: WORM_VARIANTS },
  { id: 'remnant', bake: bakeRemnantModel, variant: remnantVariantOf, names: REMNANT_VARIANTS },
  { id: 'growth', bake: bakeGrowthModel, variant: growthVariantOf, names: GROWTH_VARIANTS },
  { id: 'door', bake: bakeDoorModel, variant: doorVariantOf, names: DOOR_VARIANTS },
  { id: 'wreckage', bake: bakeWreckageModel, variant: wreckageVariantOf, names: WRECKAGE_VARIANTS },
];
const selectedFamily = process.argv.find(arg => arg.startsWith('--family='))?.split('=')[1];
if (selectedFamily && !families.some(f => f.id === selectedFamily)) throw Error(`Unknown family: ${selectedFamily}`);
await mkdir(out, { recursive: true });
const png = (b: CreatureModelResult['buf']) => sharp(Buffer.from(b.data), { raw: { width: b.w, height: b.h, channels: 4 } }).png().toBuffer();
async function sheet(name: string, columns: number, rows: number, cells: { b: CreatureModelResult['buf']; x: number; y: number }[]) {
  const raw = await sharp({ create: { width: columns * 64, height: rows * 64, channels: 4, background: '#252829' } })
    .composite(await Promise.all(cells.map(async c => ({ input: await png(c.b), left: c.x * 64, top: c.y * 64 })))).png().toBuffer();
  await writeFile(`${out}/${name}-native.png`, raw);
  await sharp(raw).resize(columns * 64 * 3, rows * 64 * 3, { kernel: 'nearest' }).png().toFile(`${out}/${name}-3x.png`);
}
const reports = [];
for (const family of families.filter(f => !selectedFamily || f.id === selectedFamily)) {
  const seeds: number[] = [];
  for (let seed = 0; seeds.filter(v => v !== undefined).length < 3; seed++) if (seeds[family.variant(seed)] === undefined) seeds[family.variant(seed)] = seed;
  await sheet(`${family.id}-directions`, 4, 9, seeds.flatMap((seed, variant) => tiers.flatMap((coverage, tier) => facings.map((facing4, x) => ({ x, y: variant * 3 + tier, b: family.bake({ coverage, seed, facing4, phase: 'idle', phase01: 0 }).buf })))));
  await sheet(`${family.id}-rest`, 6, 3, seeds.flatMap((seed, variant) => tiers.flatMap((coverage, y) => [0, 1].map((restAmount, i) => ({ x: variant * 2 + i, y, b: family.bake({ coverage, seed, facing4: 'right', phase: 'idle', phase01: 0, restAmount }).buf })))));
  for (let variant = 0; variant < 3; variant++) {
    const seed = seeds[variant]!;
    await sheet(`${family.id}-${variant}-phases`, 6, 3, tiers.flatMap((coverage, y) => phases.map((phase, x) => ({ x, y, b: family.bake({ coverage, seed, facing4: 'right', phase, phase01: phase === 'strike' ? 0 : phase === 'recover' ? .5 : .8 }).buf }))));
    await sheet(`${family.id}-${variant}-front-phases`, 6, 3, tiers.flatMap((coverage, y) => phases.map((phase, x) => ({ x, y, b: family.bake({ coverage, seed, facing4: 'down', phase, phase01: phase === 'strike' ? 0 : phase === 'recover' ? .5 : .8 }).buf }))));
    await sheet(`${family.id}-${variant}-walk`, 8, 3, tiers.flatMap((coverage, y) => Array.from({ length: 8 }, (_, x) => ({ x, y, b: family.bake({ coverage, seed, facing4: 'right', phase: 'walk', phase01: x / 8 }).buf }))));
  }
  if (process.argv.includes('--sheets-only')) continue;
  const sampleSeeds = [...new Set([...seeds, 0, 1, 7, 11, 37, 1337, 65535, 4294967295])];
  let frames = 0, minPixels = Infinity, maxPixels = 0, minMargin = Infinity;
  let minSideBodyWidth = Infinity;
  let releaseMinChangedPixels = Infinity, releaseMaxChangedPixels = 0, releaseMaxCentroidShift = 0;
  const colors = new Set<string>();
  const bounds = { minX: 64, minY: 64, maxX: 0, maxY: 0 };
  for (const seed of sampleSeeds) for (const coverage of tiers) for (const facing4 of facings) for (const phase of phases) for (let f = 0; f < 8; f++) {
    const request: CreatureModelRequest = { coverage, facing4, seed, phase, phase01: f / 7 };
    const { buf, canvas } = family.bake(request);
    if (canvas.originX !== 32 || canvas.originY !== 42 || canvas.collision !== 20) throw Error('registration mismatch');
    if (!Buffer.from(buf.data).equals(Buffer.from(family.bake(request).buf.data))) throw Error('nondeterministic');
    let pixels = 0;
    let sideMinX=64,sideMaxX=-1;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4, a = buf.data[i + 3];
      if (a !== 0 && a !== 255) throw Error('non-binary alpha');
      if (!a) continue;
      pixels++; minMargin = Math.min(minMargin, x, y, 63 - x, 63 - y);
      bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
      colors.add(`${buf.data[i]},${buf.data[i + 1]},${buf.data[i + 2]}`);
      // Exclude the threshold: a wide ground slab cannot conceal a paper-thin
      // standing body when facing sideways.
      if (family.id==='door'&&(facing4==='left'||facing4==='right')&&y>=14&&y<=29){sideMinX=Math.min(sideMinX,x);sideMaxX=Math.max(sideMaxX,x);}
    }
    if (pixels < 80) throw Error(`${family.id} implausibly small pose`);
    if (minMargin < 2) throw Error(`${family.id} insufficient margin`);
    if (family.id==='door'&&(facing4==='left'||facing4==='right')) {
      const sideWidth=sideMaxX-sideMinX+1;
      minSideBodyWidth=Math.min(minSideBodyWidth,sideWidth);
      if(sideWidth<12)throw Error(`door standing side body too thin: ${seed}/${coverage}/${facing4}/${phase} ${sideWidth}px`);
    }
    minPixels = Math.min(minPixels, pixels); maxPixels = Math.max(maxPixels, pixels); frames++;
  }
  for (const seed of seeds) for (const coverage of tiers) for (const facing4 of facings) {
    const req = { seed, coverage, facing4 };
    const equal = (a: CreatureModelResult, b: CreatureModelResult) => Buffer.from(a.buf.data).equals(Buffer.from(b.buf.data));
    for (const phase of ['idle', 'walk', 'alert'] as const) if (!equal(family.bake({ ...req, phase, phase01: 0 }), family.bake({ ...req, phase, phase01: 1 }))) throw Error(`${family.id} ${phase} loop seam`);
    // Windup stores weight; strike begins at full extension. Their intentionally
    // different endpoints are measured, not incorrectly required to be equal.
    const held = family.bake({ ...req, phase: 'windup', phase01: 1 }).buf;
    const released = family.bake({ ...req, phase: 'strike', phase01: 0 }).buf;
    let changed=0;
    const centroid=(buf:typeof held):[number,number]=>{let x=0,y=0,n=0;for(let i=0;i<4096;i++)if(buf.data[i*4+3]){x+=i%64;y+=Math.floor(i/64);n++;}return[x/n,y/n];};
    for(let i=0;i<4096;i++)if(held.data[i*4]!==released.data[i*4]||held.data[i*4+1]!==released.data[i*4+1]||held.data[i*4+2]!==released.data[i*4+2]||held.data[i*4+3]!==released.data[i*4+3])changed++;
    if(changed===0)throw Error(`${family.id} absent weight release`);
    const a=centroid(held),b=centroid(released);
    releaseMinChangedPixels=Math.min(releaseMinChangedPixels,changed);releaseMaxChangedPixels=Math.max(releaseMaxChangedPixels,changed);releaseMaxCentroidShift=Math.max(releaseMaxCentroidShift,Math.hypot(a[0]-b[0],a[1]-b[1]));
    if (!equal(family.bake({ ...req, phase: 'strike', phase01: 1 }), family.bake({ ...req, phase: 'recover', phase01: 0 }))) throw Error(`${family.id} attack seam`);
    if (!equal(family.bake({ ...req, phase: 'recover', phase01: 1 }), family.bake({ ...req, phase: 'idle', phase01: 0 }))) throw Error(`${family.id} recovery seam`);
    const active = family.bake({ ...req, phase: 'idle', phase01: 0 });
    if (!equal(active, family.bake({ ...req, phase: 'idle', phase01: 0, restAmount: 0 }))) throw Error(`${family.id} active rest mismatch`);
    const resting = family.bake({ ...req, phase: 'idle', phase01: 0, restAmount: 1 });
    if (equal(active, resting)) throw Error(`${family.id}/${seed}/${coverage}/${facing4} missing visible rest pose`);
    for (const restAmount of [.25, .5, .75, 1]) for (const phase of phases) {
      const {buf}=family.bake({...req,phase,phase01:.5,restAmount});
      for(let i=3;i<buf.data.length;i+=4)if(buf.data[i]!==0&&buf.data[i]!==255)throw Error(`${family.id} invalid rest alpha`);
    }
    for (const restAmount of [.5,1]) for(const phase of ['idle','walk','alert'] as const) if(!equal(family.bake({...req,phase,phase01:0,restAmount}),family.bake({...req,phase,phase01:1,restAmount})))throw Error(`${family.id} resting ${phase} loop seam`);
  }
  reports.push({ family: family.id, variantSeeds: seeds, variants: family.names, frames, minPixels, maxPixels, minMargin, bounds, colors: colors.size, ...(family.id==='door'?{minSideBodyWidth}:{}), deterministic: true, binaryAlpha: true, loopPhases:['idle','walk','alert'], loopSeams: 0, attackRecoverySeams: 0, activeRestZeroEqual: true, restVisible: true, windupRelease:{minChangedPixels:releaseMinChangedPixels,maxChangedPixels:releaseMaxChangedPixels,maxCentroidShift:Number(releaseMaxCentroidShift.toFixed(3)),intentionalContactSnap:true} });
}
if (reports.length > 0) {
  const oldReports = selectedFamily ? JSON.parse(await readFile(`${out}/creature-frame-checks.json`, 'utf8')) as {family:string}[] : [];
  const combined = selectedFamily ? families.map(f=>reports.find(r=>r.family===f.id)??oldReports.find(r=>r.family===f.id)).filter(Boolean) : reports;
  await writeFile(`${out}/creature-frame-checks.json`, JSON.stringify(combined, null, 2) + '\n');
  console.log(JSON.stringify(reports, null, 2));
}
