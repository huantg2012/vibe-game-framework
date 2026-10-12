/** Authoring direction is CSV -> frozen per-world policy, never code -> CSV. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const input='data/rift-search-sites.csv',output='src/generated/r100-search-sites.ts';
const text=fs.readFileSync(input,'utf8'),lines=text.trim().split(/\r?\n/);
assert.equal(lines.shift(),'world_id,version,source_reach_px,environment_score_cap,peel_preference,footprint_profile');
const ids=new Set();
const rows=lines.map(line=>{
 const cells=line.split(',');assert.equal(cells.length,6);
 const [worldId,version,reach,score,peel,footprintProfile]=cells;
 assert(/^[a-z][a-z0-9-]+$/.test(worldId)&&!ids.has(worldId));ids.add(worldId);
 assert.equal(version,'1');assert.equal(footprintProfile,'grounded-material-v1');
 for(const token of [reach,score,peel])assert(/^(?:\d+)(?:\.\d+)?$/.test(token));
 const sourceReachPx=Number(reach),environmentScoreCap=Number(score),peelPreference=Number(peel);
 assert(sourceReachPx>=24&&sourceReachPx<=96&&environmentScoreCap>=0&&environmentScoreCap<=16&&peelPreference>=0&&peelPreference<=1);
 return{version:1,algorithm:'grounded-search-v1',worldId,sourceHash:createHash('sha256').update(line).digest('hex'),sourceReachPx,environmentScoreCap,peelPreference,footprintProfile};
});
const body=`/** Generated from ${input}; do not edit by hand. */\nimport type {R100SearchSitePolicy} from '@/generation/world-study/search-site-types';\nexport const R100_SEARCH_SITE_POLICIES: readonly R100SearchSitePolicy[] = ${JSON.stringify(rows,null,2)};\n`;
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(output,'utf8'),body,'Search-site generated data differs from CSV');
else fs.writeFileSync(output,body);
console.log(`PASS grounded-search policy ${rows.length} worlds${process.argv.includes('--check')?' (checked)':''}`);
