/** Isolated QA server: immutable copied source/assets, private Vite cache, no HMR.
 * QA_SOURCE_ROOT can point at an earlier snapshot; QA_PATCH_FILES copies only
 * explicitly named fixes from the current worktree for a bounded regression.
 * Ctrl-C stops this owned server; snapshot stays available at the recorded path.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const project=process.cwd(),source=path.resolve(process.env.QA_SOURCE_ROOT??project);
const folder=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'coh-r100-qa-')));
for(const name of ['src','data','public','package.json','tsconfig.json','index.html','r100-gym.html'])fs.cpSync(path.join(source,name),path.join(folder,name),{recursive:true,dereference:true});
const patches=(process.env.QA_PATCH_FILES??'').split(',').filter(Boolean);
for(const name of patches){if(path.isAbsolute(name)||name.split('/').includes('..'))throw Error('Patch path must be project-relative');fs.copyFileSync(path.join(project,name),path.join(folder,name));}
fs.symlinkSync(path.join(project,'node_modules'),path.join(folder,'node_modules'),'dir');
const hashes={};
function walk(dir){for(const entry of fs.readdirSync(path.join(folder,dir),{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else hashes[file]=createHash('sha256').update(fs.readFileSync(path.join(folder,file))).digest('hex');}}
for(const name of ['src','data','public'])walk(name);
for(const name of ['package.json','tsconfig.json','index.html','r100-gym.html'])hashes[name]=createHash('sha256').update(fs.readFileSync(path.join(folder,name))).digest('hex');
const mismatch=[];for(const[file,hash]of Object.entries(hashes)){const original=path.join(patches.includes(file)?project:source,file);if(!fs.existsSync(original)||createHash('sha256').update(fs.readFileSync(original)).digest('hex')!==hash)mismatch.push(file);}
if(mismatch.length)throw Error(`Source changed while snapshotting; do not use ${folder}: ${mismatch.join(', ')}`);
const port=Number(process.env.QA_PORT??3048),out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i03/frozen-current');
fs.mkdirSync(out,{recursive:true});
const server=await createServer({root:folder,configFile:false,cacheDir:path.join(folder,'.vite-cache'),resolve:{alias:{'@':path.join(folder,'src')}},server:{host:'127.0.0.1',port,strictPort:true,open:false,hmr:false,watch:{ignored:['**/*']},fs:{allow:[folder,project]}}});
await server.listen();
fs.writeFileSync(path.join(out,'source-snapshot.json'),JSON.stringify({createdAt:new Date().toISOString(),sourceRoot:source,temporaryRoot:folder,patches,port,pid:process.pid,verifiedCopyHashes:true,method:'Copied source/data/public assets; private cache; no HMR. Snapshots are QA evidence, not independent build approval.',sources:hashes},null,2));
console.log(`Frozen QA server http://127.0.0.1:${port}/ — ${folder}`);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
