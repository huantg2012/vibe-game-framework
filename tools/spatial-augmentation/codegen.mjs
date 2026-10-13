/** Authoring CSV -> complete frozen augmentation policy; no per-world code overrides. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validSpatialAugmentationPolicy} from '../../src/generation/world-study/spatial-augmentation-types.ts';
import {NATIVE_VOLUME_FAMILY_SEQUENCE} from '../../src/generation/world-study/native-volume-geometry.ts';
const policyPath='data/rift-spatial-augmentation-policy.csv';
const profilesPath='data/rift-spatial-augmentation-profiles.csv';
const output='src/generated/r100-spatial-augmentation.ts';
const policyHeader='algorithm,version,enabled,reference_sight_px,physical_radius_px,occlusion_radius_px,probe_step_px,hotspot_radius_px,max_rounds,max_candidates_per_round,max_added_solids,max_added_voids,max_removed_base_ratio,max_solid_added_ratio,max_body_center_loss_ratio,min_reachable_ratio,wide_core_radius_px,min_wide_core_retained_ratio,min_largest_open_core_retained_ratio,min_void_separation_px,min_solid_separation_px,minimum_improvement,target_physical_reduction,target_occlusion_reduction,target_blocked_pair_ratio,min_valid_occlusion_pairs,physical_component_min_span_px,physical_component_min_area_px2,reveal_route_min_px,reveal_route_max_px,void_length_min_px,void_length_max_px,void_width_min_px,void_width_max_px,combo_offset_px,repeat_spacing_tolerance_ratio,repeat_angle_tolerance_deg';
const profilesHeader='id,family,construction_version,shape_profile,min_length_px,max_length_px,min_width_px,max_width_px,min_height_px,max_height_px,thickness_px,fold,branches,opening,distortion,rotation_offset_rad';
const sources=[policyPath,profilesPath].map(file=>fs.readFileSync(file,'utf8'));
function parse(source,header){const lines=source.trim().split(/\r?\n/);assert.equal(lines.shift(),header,'Unexpected augmentation CSV header');const keys=header.split(',');assert.equal(new Set(keys).size,keys.length);return lines.map(line=>{const values=line.split(',');assert.equal(values.length,keys.length,'Augmentation CSV column count differs');return Object.fromEntries(keys.map((key,index)=>[key,values[index]]));});}
const [rows,profileRows]=[parse(sources[0],policyHeader),parse(sources[1],profilesHeader)];
assert.equal(rows.length,1,'Exactly one shared policy row is required');
function numeric(value,key){assert(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value),`Invalid numeric augmentation field ${key}`);const result=Number(value);assert(Number.isFinite(result),`Non-finite augmentation field ${key}`);return result;}
const camelCase=key=>key.replace(/_([a-z])/g,(_,character)=>character.toUpperCase());
const row=rows[0];assert(['true','false'].includes(row.enabled),'enabled must be true or false');
const policy={algorithm:row.algorithm,version:numeric(row.version,'version'),enabled:row.enabled==='true',
  sourceHash:createHash('sha256').update(sources.join('\n')).digest('hex'),
  parameters:Object.fromEntries(Object.entries(row).filter(([key])=>!['algorithm','version','enabled'].includes(key)).map(([key,value])=>[camelCase(key),numeric(value,key)])),
  profiles:profileRows.map(profile=>Object.fromEntries(Object.entries(profile).map(([key,value])=>[camelCase(key),['id','family','shape_profile'].includes(key)?value:numeric(value,key)])))};
// The r11 planner augments authored fragment terrain. A standalone v3 shape
// can validate in isolation but cannot coexist with this terrain contract.
for(const profile of policy.profiles)assert.equal(profile.constructionVersion,4,`Augmentation template ${profile.id} must support authored fragment erosion (construction 4)`);
assert(validSpatialAugmentationPolicy(policy),'Augmentation policy or template violates its frozen contract');
assert(NATIVE_VOLUME_FAMILY_SEQUENCE.every(family=>policy.profiles.some(profile=>profile.family===family)),'Every native family requires an explicit augmentation template');
const body=`/** Generated from ${policyPath} and ${profilesPath}; do not edit by hand. */\nimport type { SpatialAugmentationPolicy } from '@/generation/world-study/spatial-augmentation-types';\nexport const SPATIAL_AUGMENTATION_POLICY: SpatialAugmentationPolicy = ${JSON.stringify(policy,null,2)};\n`;
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(output,'utf8'),body,'Generated augmentation policy differs from CSV');
else fs.writeFileSync(output,body);
console.log(JSON.stringify({status:'passed',mode:process.argv.includes('--check')?'check':'generate',profiles:policy.profiles.length,sourceHash:policy.sourceHash,output}));
