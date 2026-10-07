/** Opt-in source contract tests. Pixel sampling is not a visual approval. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import { ORGANIZATION_MATERIALS } from '../../src/generated/r100-material-organizations';
import { R100_WORLD_APPEARANCES } from '../../src/generated/r100-world-appearance';
import { validR100WorldAppearance, WORLD_MATERIAL_ORGANIZATIONS, type WorldMaterialOrganization } from '../../src/generation/world-study/r100-world-appearance';
import { paintedMaterialDefinition } from '../../src/systems/r100-world/painted-material';
import { compileMaterialOrganizationsCSV } from './generate-material-organizations.mjs';

const csv=readFileSync('data/rift-material-organizations.csv','utf8');
assert.equal(compileMaterialOrganizationsCSV(csv),readFileSync('src/generated/r100-material-organizations.ts','utf8'));
assert.throws(()=>compileMaterialOrganizationsCSV(csv.replace('short-fibre,','unknown,')),/Unknown/);
assert.throws(()=>compileMaterialOrganizationsCSV(csv.replace(',0.82,0.94,',',0.95,0.8,')),/Fracture/);
assert.throws(()=>compileMaterialOrganizationsCSV(csv.replace('0.025:0.025:0.95:0.40','0.5:0.025:0.95:0.40')),/Out of bounds/);
assert.throws(()=>compileMaterialOrganizationsCSV(csv.replace('/assets/r100-materials/short-fibre-solid-source.png','/assets/r100-materials/short-fibre-ground-source.png')),/independent/);
assert.throws(()=>compileMaterialOrganizationsCSV(csv.split('\n').slice(0,2).join('\n')),/Expected one/);
for(const appearance of R100_WORLD_APPEARANCES){
 assert(validR100WorldAppearance(appearance));
 if (R100_WORLD_APPEARANCES.indexOf(appearance) < 52) assert(!Object.hasOwn(appearance,'materialOrganization'),'Accepted original 52 worlds do not implicitly opt in');
 assert(!validR100WorldAppearance({...appearance,materialOrganization:'unknown'}));
 for(const organization of WORLD_MATERIAL_ORGANIZATIONS)assert(validR100WorldAppearance({...appearance,materialOrganization:organization}));
}
for(const family of PAINTED_MATERIALS){
 assert.equal(paintedMaterialDefinition(family.family),family,'Absent selection retains exact family object');
 for(const organization of ORGANIZATION_MATERIALS){
  assert.equal(paintedMaterialDefinition(family.family,organization.organization),organization,'Explicit primary selection chooses the independent atom');
  assert.equal(paintedMaterialDefinition(family.family),family,'A secondary family without selection is not contaminated by a prior selection');
 }
 assert.equal(paintedMaterialDefinition(family.family,'unknown' as WorldMaterialOrganization),undefined,'Unknown organization never silently falls back');
}
const oldPaths=new Set(PAINTED_MATERIALS.flatMap(row=>[row.source,row.solid.source]));
for(const atom of ORGANIZATION_MATERIALS)for(const surface of [atom,atom.solid]){
 assert(!oldPaths.has(surface.source),'New source never overwrites accepted atoms');
 const metadata=await sharp(`public${surface.source}`).metadata();
 assert(metadata.width&&metadata.height&&metadata.width>=surface.logical_pixels&&metadata.height>=surface.logical_pixels);
 const pixels=await sharp(`public${surface.source}`).resize(surface.logical_pixels,surface.logical_pixels).ensureAlpha().raw().toBuffer();
 for(let q=3;q<pixels.length;q+=4)assert.equal(pixels[q],255,'Pigment texture cannot open transparent fake holes');
}
assert.deepEqual(R100_WORLD_APPEARANCES.filter(row=>row.materialOrganization==='short-fibre-loose').map(row=>row.worldId),['short-fibre-mat','felt-wedges','woven-quarters']);
assert.equal(R100_WORLD_APPEARANCES.find(row=>row.worldId==='woven-quarters')?.materialOrganization,'short-fibre-loose');
console.log(`PASS ${ORGANIZATION_MATERIALS.length} independent source pairs; CSV strict negatives, explicit resolver/secondary isolation, original 52 absent opt-ins, exact three-world loose selection, source dimension/opaque pigment. Normal-light art remains pending.`);
