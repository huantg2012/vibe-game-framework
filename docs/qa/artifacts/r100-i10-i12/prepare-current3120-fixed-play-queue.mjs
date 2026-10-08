import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i10-i12/';
const ref=file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const stages=[
 {id:'B06-porous-original-remaining11',folder:'b06-porous-repaired-play',runner:'run.mjs',args:['--exclusive-window'],cases:11,plan:'plan.json',output:'execution.json',completedStatus:'completed-original11'},
 {id:'B07-original24',folder:'b07-refined-qualified',runner:'run-play.mjs',args:[],cases:24,plan:'play-commands.json',output:'play-execution.json',completedStatus:'completed-script'},
 {id:'B08-original24',folder:'b08-current-qualified',runner:'run-play.mjs',args:[],cases:24,plan:'play-commands.json',output:'play-execution.json',completedStatus:'completed-script'},
 {id:'B06-short-fibre-original12',folder:'b06-short-fibre-qualified',runner:'run-play.mjs',args:[],cases:12,plan:'play-commands.json',output:'play-execution.json',completedStatus:'completed-script'},
].map(x=>({...x,runner:ref(base+x.folder+'/'+x.runner),plan:ref(base+x.folder+'/'+x.plan),output:base+x.folder+'/'+x.output}));
const value={schemaVersion:1,status:'prepared-awaiting-explicit-browser-handoff',source:ref(base+'p34-and-b09-b10-refined-source/source-snapshot.json'),stages,
 continuation:'B09 and B10 original24 each are next, prepared separately once their remaining normal-view review receipts exist. This plan does not approve those pending reviews.',
 limits:'One Chrome, one case at a time; each child must close and retain its report before any next stage. An error halts the queue, without automatic retry or alternate seed. No original successful journey is repeated.'};
const file=base+'current3120-fixed-play-queue-plan.json';assert(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
