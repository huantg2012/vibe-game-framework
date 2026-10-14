import fs from 'node:fs';import assert from 'node:assert/strict';
import {nativeSpatialBayHasBodySideClearance} from '../../src/generation/world-study/native-spatial-bay-layout.ts';
const out=process.argv[2];assert(out&&!fs.existsSync(out));const cases=[];
const bay=(rects,outward={x:0,y:-1})=>({bayId:'test',profileId:'test',sourceShore:{points:[],outward},rects});
function check(name,land,placement,expected){const actual=nativeSpatialBayHasBodySideClearance(land,placement.rects,placement);assert.equal(actual,expected,name);cases.push({name,actual,expected});}
check('16px continuous side lip cannot hold body',[[0,0,400,400]],bay([[200,-64,184,320]]),false);
check('20px side lip admits exact body width',[[0,0,400,400]],bay([[200,-64,180,320]]),true);
check('short raw corner chip is not a sustained lip',[[0,0,400,400]],bay([[200,-64,184,80]]),true);
check('orthogonal bay checks tangent width',[[0,0,400,400]],bay([[-64,200,320,184]],{x:-1,y:0}),false);
check('irrelevant rectangle coordinate splits do not hide a long lip',[[0,0,400,400],[0,8,100,8],[0,24,100,8]],bay([[200,-64,184,320]]),false);
const source='docs/qa/artifacts/native-spatial-2026-10-14/geometry-core-shoulder-round1/gel-rafts-20261012-b1.json',receipt=JSON.parse(fs.readFileSync(source));
check('actual reviewed B1 lip rejects without altering its receipt',receipt.proposal.plan.land,receipt.proposal.bays[0],false);
fs.writeFileSync(out,JSON.stringify({scope:'Raw native B side body-clearance prefilter, not final geometry or aesthetic admission',source,cases},null,2)+'\n');console.log(`${cases.length} bay side-clearance cases passed`);
