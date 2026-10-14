/** Six CSV sources -> frozen, explicitly annotated native spatial intentions. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validNativeSpatialFrozenInput,validNativeSpatialPolicy,NATIVE_POLICY_NUMBERS} from '../../src/generation/world-study/native-spatial-validation.ts';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
const schema={
 policy:'algorithm,version,enabled,planning_cell_factor,hole_to_solid_ratio,hole_count_abs_tolerance,hole_count_rel_tolerance,min_solid_count,require_more_holes,region_hole_share_min,region_hole_share_max,comparison_spacings_px,spacing_px,count_tolerance_ratio,area_tolerance_ratio,max_empty_radius_px,deep_empty_threshold_px,max_deep_empty_span_px,min_hole_core_radius_px,min_solid_area_px2,min_solid_span_px,probe_step_px,reference_sight_px,reveal_route_min_px,reveal_route_max_px,max_cover_route_px,wide_radius_px,min_wide_ratio,min_largest_wide_ratio,narrow_width_px,max_narrow_ratio,max_narrow_run_px,encounter_radius_px,min_route_length_px,min_route_encounters,min_route_hole_share,max_route_hole_share,window_size,min_window_holes,max_geometry_evaluations,max_full_candidates',
 worlds:'world_id,enabled,annotation_status,target_walk_area_px2,frame_width_px,frame_height_px,material_axis_rad,land_grammar,land_rect_min_count,land_rect_max_count,land_rect_min_span_px,land_rect_max_span_px,land_rect_min_thickness_px,land_rect_max_thickness_px,land_rect_min_overlap_px,bay_grammar,bay_profile_ids,bay_count_options,land_core_min_count,land_core_max_count,land_shoulder_min_count,land_shoulder_max_count,land_shoulder_min_span_px,land_shoulder_max_span_px,land_shoulder_min_thickness_px,land_shoulder_max_thickness_px,land_shoulder_min_extension_px,land_shoulder_max_extension_px,land_shoulder_attachment',
 'hole-profiles':'id,size_class,weight,min_span_px,max_span_px,min_thickness_px,max_thickness_px,min_rect_count,max_rect_count,min_overlap_ratio,max_overlap_ratio,min_offset_ratio,max_offset_ratio,max_area_px2',
 'bay-profiles':'id,min_rect_count,max_rect_count,min_depth_px,max_depth_px,min_mouth_px,max_mouth_px,min_offset_ratio,max_offset_ratio,min_overlap_ratio,max_overlap_ratio,max_union_span_px,min_removed_land_area_px2,max_removed_land_area_px2,min_final_throat_px,min_backland_px',
 assemblies:'world_id,grade,id,source_instance_ids,attached_relief_ids,source_scale,min_scale,max_scale,rotation_offsets_rad,max_span_px,mode',
 'subordinate-profiles':'id,family,construction_version,shape_profile,min_length_px,max_length_px,min_width_px,max_width_px,min_height_px,max_height_px,thickness_px,fold,branches,opening,distortion,rotation_offset_rad'
};
const textKeys=new Set(['algorithm','world_id','annotation_status','land_grammar','bay_grammar','land_shoulder_attachment','id','size_class','grade','mode','family','shape_profile']);
const textArrayKeys=new Set(['bay_profile_ids']);
const boolKeys=new Set(['enabled','require_more_holes']);
const arrayKeys=new Set(['comparison_spacings_px','source_instance_ids','attached_relief_ids','rotation_offsets_rad','bay_count_options']);
const camel=key=>key.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const number=(value,key)=>{assert(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value),`Invalid numeric ${key}: ${value}`);const n=Number(value);assert(Number.isFinite(n));return n;};
const raw=Object.keys(schema).map(name=>fs.readFileSync(`data/rift-native-spatial-${name}.csv`,'utf8'));
const sourceHash=createHash('sha256').update(raw.join('\n')).digest('hex');
const parsed=Object.entries(schema).map(([name,header],at)=>{
 const lines=raw[at].trim().split(/\r?\n/);assert.equal(lines.shift(),header,`${name} header mismatch`);const keys=header.split(',');
 return lines.map(line=>{const cells=line.split(',');assert.equal(cells.length,keys.length,`${name} column count`);return Object.fromEntries(keys.map((key,i)=>{
  const v=cells[i];let value;if(textKeys.has(key))value=v;else if(textArrayKeys.has(key))value=v===''?[]:v.split('|');else if(boolKeys.has(key)){assert(['true','false'].includes(v));value=v==='true';}else if(arrayKeys.has(key))value=v===''?[]:v.split('|').map(x=>number(x,key));else value=number(v,key);return[camel(key),value];
 }));});
});
assert.equal(parsed[0].length,1);const [policyRow]=parsed[0],policy={...policyRow,sourceHash},[,worlds,holeProfiles,bayProfiles,assemblies,subordinateProfiles]=parsed;
assert(validNativeSpatialPolicy(policy),'Native policy validation failed');
assert.equal(new Set(worlds.map(w=>w.worldId)).size,worlds.length,'Repeated world intent');
for(const world of worlds){
 const nativeWorld=R100_NATIVE_WORLDS.find(w=>w.id===world.worldId);assert(nativeWorld,`Unknown world ${world.worldId}`);
 for(const native of nativeWorld.definitions){const frozen={policy,world,holeProfiles,bayProfiles:bayProfiles.filter(p=>world.bayProfileIds.includes(p.id)),assemblies:assemblies.filter(a=>a.worldId===world.worldId&&(a.grade==='all'||a.grade===native.grade)),subordinateProfiles:subordinateProfiles.filter(p=>p.family===native.family)};assert(validNativeSpatialFrozenInput(frozen,native),`Invalid complete ${world.worldId}/${native.grade} intention`);}
}
for(const assembly of assemblies)assert(worlds.some(w=>w.worldId===assembly.worldId),`Orphan assembly ${assembly.id}`);
for(const profiles of [holeProfiles,bayProfiles,subordinateProfiles])assert.equal(new Set(profiles.map(p=>p.id)).size,profiles.length,'Duplicate profile id');
for(const profile of bayProfiles)assert(worlds.some(w=>w.bayProfileIds.includes(profile.id)),`Orphan bay profile ${profile.id}`);
assert.equal(Object.keys(policy).length,NATIVE_POLICY_NUMBERS.length+5);
const names=['NATIVE_SPATIAL_POLICY','NATIVE_SPATIAL_WORLDS','NATIVE_SPATIAL_HOLE_PROFILES','NATIVE_SPATIAL_BAY_PROFILES','NATIVE_SPATIAL_ASSEMBLIES','NATIVE_SPATIAL_SUBORDINATE_PROFILES'];
const types=['NativeSpatialPolicy','readonly NativeSpatialWorldIntent[]','readonly NativeSpatialHoleProfile[]','readonly NativeSpatialBayProfile[]','readonly NativeSpatialAssembly[]','readonly NativeSpatialSubordinateProfile[]'];
const values=[policy,worlds,holeProfiles,bayProfiles,assemblies,subordinateProfiles];
const body=`/** Generated from data/rift-native-spatial-*.csv. Do not edit. */\nimport type {NativeSpatialPolicy,NativeSpatialWorldIntent,NativeSpatialHoleProfile,NativeSpatialBayProfile,NativeSpatialAssembly,NativeSpatialSubordinateProfile} from '@/generation/world-study/native-spatial-types';\n${names.map((name,i)=>`export const ${name}:${types[i]}=${JSON.stringify(values[i],null,2)};`).join('\n')}\n`;
const output='src/generated/r100-native-spatial.ts';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(output,'utf8'),body,'Native spatial generated data differs');else fs.writeFileSync(output,body);
console.log(JSON.stringify({status:'passed',worlds:worlds.length,assemblies:assemblies.length,holeProfiles:holeProfiles.length,bayProfiles:bayProfiles.length,subordinateProfiles:subordinateProfiles.length,sourceHash,output}));
