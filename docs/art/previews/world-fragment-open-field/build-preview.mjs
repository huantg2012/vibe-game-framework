import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const dir=path.dirname(fileURLToPath(import.meta.url));
const {outputFiles}=await build({entryPoints:[path.join(dir,'preview.mjs')],bundle:true,write:false,format:'iife',target:'es2020',logLevel:'silent'});
const fragment=fs.readFileSync(path.join(dir,'preview.template.html'),'utf8')
  .replace('__GEOMETRY__',fs.readFileSync(path.join(dir,'geometry.json'),'utf8'))
  .replace('__RUNTIME__',()=>outputFiles[0].text.replaceAll('</script','<\\/script'));
fs.writeFileSync(path.join(dir,'preview.fragment.html'),fragment);
if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),fragment);
console.log('Bundled local silhouette preview');
