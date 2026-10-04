import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const source = 'data/rift-master-materials.csv';
const target = 'src/generated/r100-materials.ts';
const families = ['folded-slab', 'fibre-knot', 'broken-shell', 'granular-ridge', 'membrane-rim', 'gel-flow'];

export function compilePaintedMaterialCSV(raw) {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.shift() !== 'family,source,logical_pixels,world_size,skin_region,cleaved_region,loose_region,solid_source,solid_world_size,solid_skin_region,solid_cut_region,solid_skin_roughness,solid_cut_roughness,solid_gain,solid_cut_gain') throw new Error('Unexpected painted material CSV header');
  const rows = lines.map((line, index) => {
    const values = line.split(',');
    if (values.length !== 15 || values.some(value => value !== value.trim() || value === '')) throw new Error(`Invalid painted material columns at row ${index + 2}`);
    const [family, source, logicalText, worldText, skin, cleaved, loose, solidSource, solidSize, solidSkin, solidCut, skinRoughness, cutRoughness, solidGain, solidCutGain] = values;
    const logical_pixels = Number(logicalText), world_size = Number(worldText);
    if (!families.includes(family)) throw new Error(`Unknown painted material family: ${family}`);
    if (!/^\/assets\/r100-materials\/[a-z0-9-]+-source\.png$/.test(source)) throw new Error(`Invalid painted material source: ${source}`);
    if (!Number.isInteger(logical_pixels) || logical_pixels < 1 || logical_pixels > 2048) throw new Error(`Invalid logical_pixels for ${family}: expected 1–2048`);
    if (!Number.isFinite(world_size) || world_size <= 0) throw new Error(`Invalid world_size for ${family}: expected a positive finite size`);
    const region=(text,name)=>{
      const fields=text.split(':');
      if(fields.some(value=>value===''||value!==value.trim()))throw new Error(`Invalid ${name} region for ${family}`);
      const values=fields.map(Number);
      if(values.length!==4||values.some(value=>!Number.isFinite(value)))throw new Error(`Invalid ${name} region for ${family}`);
      const [x,y,width,height]=values;
      if(x<0||y<0||width<=0||height<=0||x+width>1||y+height>1||width*logical_pixels<8||height*logical_pixels<8)throw new Error(`Out of bounds ${name} region for ${family}`);
      return {x,y,width,height};
    };
    if (!/^\/assets\/r100-materials\/[a-z0-9-]+-source\.png$/.test(solidSource) || source === solidSource) throw new Error(`Invalid or shared solid source: ${solidSource}`);
    const solidWorldSize=Number(solidSize), skinFinish=Number(skinRoughness), cutFinish=Number(cutRoughness), gain=Number(solidGain),cutGain=Number(solidCutGain);
    if(!Number.isFinite(solidWorldSize)||solidWorldSize<=0)throw new Error('Invalid solid_world_size');
    if(![skinFinish,cutFinish].every(n=>Number.isFinite(n)&&n>0&&n<=1)||skinFinish>=cutFinish)throw new Error('Solid skin roughness must be lower than its fracture');
    if(![gain,cutGain].every(n=>Number.isFinite(n)&&n>0&&n<=1.5))throw new Error('Invalid solid_gain,solid_cut_gain');
    return { family, source, logical_pixels, world_size, regions:{skin:region(skin,'skin'),cleaved:region(cleaved,'cleaved'),loose:region(loose,'loose')},
      solid:{source:solidSource,logical_pixels,world_size:solidWorldSize,regions:{skin:region(solidSkin,'solid skin'),cleaved:region(solidCut,'solid cut'),loose:region(solidCut,'solid cut')},skinRoughness:skinFinish,cutRoughness:cutFinish,gain,cutGain} };
  });
  if (rows.length !== families.length || new Set(rows.map(row => row.family)).size !== families.length) throw new Error('Expected one painted material per family');
  if (new Set(rows.map(row => row.source)).size !== rows.length) throw new Error('Each painted material family requires its own source');
  if(new Set(rows.flatMap(row=>[row.source,row.solid.source])).size!==rows.length*2)throw new Error('Ground and solid require independent sources for every family');
  return `// GENERATED from ${source}; edit the CSV, not this file.\nexport const PAINTED_MATERIALS_SOURCE_HASH = '${createHash('sha256').update(raw).digest('hex')}';\nexport const PAINTED_MATERIALS = ${JSON.stringify(rows, null, 2)} as const;\nexport type PaintedMaterialFamily = typeof PAINTED_MATERIALS[number]['family'];\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = compilePaintedMaterialCSV(readFileSync(source, 'utf8'));
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== output) throw new Error('Painted material manifest is stale');
    console.log(families.length+' painted material families: CSV and generated manifest match');
  } else {
    writeFileSync(target, output);
    console.log(`Generated ${target}`);
  }
}
