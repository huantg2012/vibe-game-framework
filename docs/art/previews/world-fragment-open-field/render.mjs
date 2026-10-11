import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const dir=path.dirname(fileURLToPath(import.meta.url));
const geometry=JSON.parse(fs.readFileSync(path.join(dir,'geometry.json'),'utf8'));
const [w,h]=geometry.authoringFrame;
const rectangles=(list,fill)=>list.map(([x,y,width,height])=>`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>矩形拼合的世界碎片构型；白色为地面，黑色为空间空洞与外部</title><rect width="${w}" height="${h}" fill="black"/>${rectangles(geometry.landRects,'white')}${rectangles(geometry.voidRects,'black')}</svg>`;
fs.writeFileSync(path.join(dir,'silhouette.svg'),svg+'\n');
await sharp(Buffer.from(svg)).png().toFile(path.join(dir,'silhouette.png'));
const fragment=path.join(dir,'preview.fragment.html');
if(fs.existsSync(fragment)) {
  const source=fs.readFileSync(fragment,'utf8').replace(/(<script type="application\/json" id="fragment-geometry">)[\s\S]*?(<\/script>)/,(_m,a,b)=>a+'\n'+JSON.stringify(geometry)+'\n'+b);
  fs.writeFileSync(fragment,source);
}
console.log('Rendered rectangle unions; synchronized preview geometry');
