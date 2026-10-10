/** Immutable source snapshot for browser QA while implementation continues. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
const root=process.cwd(),target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'coh-spatial-browser-')));
for(const dir of ['src','data'])fs.cpSync(path.join(root,dir),path.join(target,dir),{recursive:true});
for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.html')||['package.json','tsconfig.json'].includes(name)))fs.copyFileSync(path.join(root,name),path.join(target,name));
for(const name of ['node_modules','public','assets'])fs.symlinkSync(path.join(root,name),path.join(target,name),'dir');
fs.writeFileSync(path.join(target,'vite.config.mjs'),`import {defineConfig} from 'vite';export default defineConfig({cacheDir:${JSON.stringify(path.join(target,'.vite-cache'))},resolve:{alias:{'@':${JSON.stringify(path.join(target,'src'))}}},server:{host:'127.0.0.1',port:${Number(process.env.QA_PORT??3042)},strictPort:true,open:false,hmr:false,fs:{allow:[${JSON.stringify(target)},${JSON.stringify(root)}]}},optimizeDeps:{include:['phaser']}});`);
const hashes={};function scan(dir){for(const entry of fs.readdirSync(path.join(target,dir),{withFileTypes:true})){const file=path.posix.join(dir,entry.name);if(entry.isDirectory())scan(file);else hashes[file]=createHash('sha256').update(fs.readFileSync(path.join(target,file))).digest('hex');}}
scan('src');scan('data');
fs.writeFileSync(path.join(target,'source-snapshot.json'),JSON.stringify({createdAt:new Date().toISOString(),root:target,files:hashes,sharedReadOnlyAssets:[path.join(root,'public'),path.join(root,'assets')],scope:'Code/data frozen copies; static source assets and installed node_modules linked without changes'},null,2));
console.log(target);
