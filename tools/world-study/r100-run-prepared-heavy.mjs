/** Fixed, precommitted real-input preparation diagnostic; no retries. */
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
const out=path.resolve(process.env.QA_MATRIX_OUT??'docs/qa/artifacts/r100-i03/prepared-heavy-visible-pollution'),config=JSON.parse(fs.readFileSync(out+'/policy-freeze.json','utf8'));
const report={status:'running',cases:[]};const save=()=>fs.writeFileSync(out+'/matrix-report.json',JSON.stringify(report,null,2));save();
for(const c of config.cases){const row={...c,status:'running'};report.cases.push(row);save();
 const child=spawn(process.execPath,['--import','tsx','tools/world-study/r100-real-journeys.mjs'],{cwd:config.root,env:{...process.env,TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json',QA_MANAGEMENT_POLICY:'storage-growth',QA_ENCOUNTER_POLICY:'observed-windows',QA_OFFERING_PREFERENCE:'contaminant-first',QA_ENCOUNTERS:'visible',QA_NATURAL_PREPARATION:'1',QA_GRADES:'severe',QA_RUNS:'1',QA_ORDINAL_START:'1',QA_SEARCH_LIMIT:'8',GAME_URL:'http://127.0.0.1:3062/',QA_OUTPUT_DIR:out+'/'+c.name,QA_WORLD_ID:c.world,QA_SEED:String(c.seed),QA_CONTROLLED_BUILD:c.build},stdio:'inherit'});
 row.exitCode=await new Promise(resolve=>child.once('exit',resolve));row.status=row.exitCode===0?'completed':'failed';save();
}
report.status='completed-all-precommitted-attempts';save();
