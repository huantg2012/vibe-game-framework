/** Validate archive boundaries and local links without running the game. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,dirname,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const load=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const catalog=await load('docs/reviews/catalog.json');
const {paths}=await load('docs/reviews/relocations.json');
const exports=await load('docs/reading/manifest.json');
const originalExports=await load('docs/qa/artifacts/report-reader-2026-09-21/export-manifest.json');
const out=resolve(root,process.env.ARTIFACT_DIR||'docs/qa/artifacts/review-archive-2026-09-21');
const hash=data=>createHash('sha256').update(data).digest('hex');
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const local=(url,from)=>{
 if(!url||url.startsWith('#')||/^(https?:|data:|mailto:)/.test(url))return null;
 return resolve(dirname(from),decodeURIComponent(url.split(/[?#]/)[0]).replace(/:\d+(?::\d+)?$/,''));
};
assert.equal(new Set(catalog.reports.map(r=>r.id)).size,catalog.reports.length);
const uniquePaths=new Set();
for(const report of catalog.reports){
 assert(report.report.startsWith('docs/reviews/'),'Result outside review archive');
 assert(!uniquePaths.has(report.report),'Duplicate canonical report');uniquePaths.add(report.report);
 for(const path of [report.report,report.summary,report.followUp].filter(Boolean))assert(await exists(resolve(root,path)),path);
 assert(report.title&&report.date&&report.scope&&report.note,'Incomplete archive metadata');
}
for(const ref of catalog.references)assert(await exists(resolve(root,ref.path)),ref.path);
const moves=[];
for(const [oldPath,newPath] of Object.entries(paths)){
 assert(await exists(resolve(root,oldPath)),oldPath+' compatibility entry missing');
 assert(await exists(resolve(root,newPath)),newPath+' canonical file missing');
 const pointer=await readFile(resolve(root,oldPath),'utf8');
 if(oldPath.endsWith('.md'))assert(pointer.includes('仅保留旧链接兼容')&&pointer.split('\n').length<=7,oldPath+' still holds a second result');
 if(oldPath.endsWith('.html'))assert(pointer.includes('http-equiv="refresh"')&&pointer.length<1600,oldPath+' must only redirect');
 if(!oldPath.startsWith('docs/qa/reports/')){
  const original=execFileSync('git',['show',`1c7f2c3:${oldPath}`],{cwd:root});
  moves.push({oldPath,newPath,originalRevision:'1c7f2c3',originalSha256:hash(original),canonicalSha256:hash(await readFile(resolve(root,newPath)))});
 }
}
const sourceParity=[];
for(const report of exports.reports){
 const original=originalExports.reports.find(entry=>entry.source===report.source);
 if(original)assert.equal(original.sourceSha256,report.sourceSha256,report.id+' archived source changed');
 assert.equal(hash(await readFile(resolve(root,report.output))),report.outputSha256,report.id+' stale generated page');
 assert.equal(hash(await readFile(resolve(root,report.source))),report.sourceSha256);
 if(original)sourceParity.push(report.id);
}
const linkIssues=[];let checked=0;
const inspect=async path=>{
 const text=await readFile(path,'utf8');
 const links=extname(path)==='.md'?[...text.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)[^)\n]*\)/g)].map(m=>m[1]):[...text.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(m=>m[1]);
 for(const url of links){const dest=local(url,path);if(!dest)continue;checked++;if(!await exists(dest))linkIssues.push({from:relative(root,path),url});}
};
// Read canonical prose and original HTML only; compiled JS strings are not document links.
for(const report of catalog.reports)await inspect(resolve(root,report.report));
for(const ref of catalog.references)await inspect(resolve(root,ref.path));
for(const path of ['docs/reviews/README.md','docs/qa/README.md','docs/reading/README.md','docs/reviews/index.html','docs/reading/index.html','docs/dev/report-viewer.md'])await inspect(resolve(root,path));
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'archive-check.json'),JSON.stringify({formalReports:catalog.reports.length,references:catalog.references.length,moves,sourceParity,localLinksChecked:checked,linkIssues},null,2)+'\n');
assert.deepEqual(linkIssues,[],'Broken local links in archive');
console.log(JSON.stringify({formalReports:catalog.reports.length,references:catalog.references.length,compatibilityPaths:Object.keys(paths).length,sourceParity:sourceParity.length,localLinksChecked:checked}));
