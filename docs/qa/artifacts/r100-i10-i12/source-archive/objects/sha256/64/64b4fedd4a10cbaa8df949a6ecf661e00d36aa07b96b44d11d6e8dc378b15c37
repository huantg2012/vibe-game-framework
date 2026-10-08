import { CATALOG_OBJECTS } from './contaminant-catalog-icons-objects';
import { SECONDARY_OBJECTS } from './contaminant-catalog-icons-secondary';
import { CATALOG_SHELLS, paintRemnant } from './contaminant-catalog-icons-shells';
import { PixelCanvas, type CatalogPixels } from './contaminant-catalog-icons-pixels';
import { paintCatalogGround } from './contaminant-catalog-icons-ground';
import { groundMaterialFaces } from './contaminant-catalog-icons-world-faces';
export { CATALOG_GROUND_IDS } from './contaminant-catalog-icons-ground';

export type CatalogIconRef = { readonly kind:'shell'; readonly appearanceId:string } | { readonly kind:'item'; readonly definitionId:string; readonly appearanceId?:string };
export type { CatalogPixels } from './contaminant-catalog-icons-pixels';
const OBJECTS={...CATALOG_OBJECTS,...SECONDARY_OBJECTS};
export const CATALOG_ART_ITEM_IDS=Object.freeze(Object.keys(OBJECTS));
export const CATALOG_ART_APPEARANCE_IDS=Object.freeze(Object.keys(CATALOG_SHELLS));
const cache=new Map<string,CatalogPixels>();
const anchors=new Map<string,readonly[number,number]>();
function key(ref:CatalogIconRef,size:number):string {return ref.kind==='shell'?`${size}:shell:${ref.appearanceId}`:`${size}:item:${ref.definitionId}:${ref.appearanceId??''}`;}
/** Keep only remnant components joined to the material. Negative-space identity is inviolate. */
function remnantAt(p:PixelCanvas,remnant:PixelCanvas,anchor:readonly[number,number]):Map<number,number>{
  const size=p.size,dx=anchor[0]-remnant.anchor[0],dy=anchor[1]-remnant.anchor[1],pending=new Map<number,number>();
  remnant.cells.forEach((c,i)=>{if(c===undefined)return;const x=i%size+dx,y=Math.floor(i/size)+dy;
    if(x<=0||y<=0||x>=size-1||y>=size-1)return;
    const j=y*size+x;if(p.cells[j]===undefined&&!p.protected[j])pending.set(j,c);
  });
  const joined=new Map<number,number>(),queue=[...pending.keys()].filter(i=>[i-1,i+1,i-size,i+size].some(j=>p.cells[j]!==undefined));
  for(let n=0;n<queue.length;n++){const i=queue[n]!;if(joined.has(i))continue;const c=pending.get(i);if(c===undefined)continue;joined.set(i,c);
    for(const j of [i-1,i+1,i-size,i+size])if(pending.has(j)&&!joined.has(j))queue.push(j);
  }
  return joined;
}
/** One common seam per object/size, evaluated against all eight reusable fragments, never per result. */
function seamAnchor(p:PixelCanvas,id:string,size:24|32):readonly[number,number]{
  const k=`${id}:${size}`,saved=anchors.get(k);if(saved)return saved;
  const remnants=CATALOG_ART_APPEARANCE_IDS.map(a=>paintRemnant(a,size));let best:readonly[number,number]|undefined,bestScore=Infinity;
  for(let y=2;y<size-3;y++)for(let x=2;x<size-2;x++){
    const i=y*size+x;if(p.cells[i]===undefined||p.protected[i])continue;
    const counts=remnants.map(r=>remnantAt(p,r,[x,y]).size);if(Math.min(...counts)<5)continue;
    const distance=(x-p.anchor[0])**2+(y-p.anchor[1])**2;
    const score=distance+Math.max(...counts)*.12;
    if(score<bestScore){best=[x,y];bestScore=score;}
  }
  if(!best)throw new Error(`No continuous remnant seam for ${id}/${size}`);
  anchors.set(k,best);return best;
}
export function catalogArtCanvas(ref:CatalogIconRef,size:24|32):PixelCanvas {
  const p=new PixelCanvas(size),id=ref.kind==='shell'?ref.appearanceId:ref.definitionId;
  const painters=ref.kind==='shell'?CATALOG_SHELLS:OBJECTS;
  const painter=Object.prototype.hasOwnProperty.call(painters,id)?painters[id]:undefined;
  if(!painter)throw new Error(`Missing catalog artwork: ${ref.kind}/${id}`);
  painter(p);
  groundMaterialFaces(p,ref.kind==='shell'?`shell:${id}`:id);
  if(ref.kind==='item'&&ref.appearanceId){
    const anchor=seamAnchor(p,id,size);p.anchor=anchor;
    for(const [i,c] of remnantAt(p,paintRemnant(ref.appearanceId,size),anchor))p.cells[i]=c;
  }
  return p;
}
function pixels(ref:CatalogIconRef,size:24|32):CatalogPixels {
  const k=key(ref,size);let result=cache.get(k);if(!result){result=catalogArtCanvas(ref,size).pixels();cache.set(k,result);}return result;
}
export function catalogIconPixels(ref:CatalogIconRef):CatalogPixels{return pixels(ref,24);}
export function catalogWorldPixels(ref:CatalogIconRef):CatalogPixels{return pixels(ref,32);}
/** Center-origin 16px ability object. Other items do not manufacture a placed prop. */
export function catalogGroundPixels(ref:CatalogIconRef):CatalogPixels|undefined{return ref.kind==='item'?paintCatalogGround(ref.definitionId):undefined;}
export const groundPixels=catalogGroundPixels;
export function catalogRemnantPixels(appearanceId:string,size:24|32=24):CatalogPixels{return paintRemnant(appearanceId,size).pixels();}
export function catalogIconSvg(ref:CatalogIconRef):string {
  const p=catalogIconPixels(ref);let rects='';
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;){const i=(y*p.width+x)*4;if(!p.data[i+3]){x++;continue;}
    const color=(p.data[i]!<<16)|(p.data[i+1]!<<8)|p.data[i+2]!;let end=x+1;
    while(end<p.width){const j=(y*p.width+end)*4;if(p.data[j+3]!==255||((p.data[j]!<<16)|(p.data[j+1]!<<8)|p.data[j+2]!)!==color)break;end++;}
    rects+=`<rect x="${x}" y="${y}" width="${end-x}" height="1" fill="#${color.toString(16).padStart(6,'0')}"/>`;x=end;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" shape-rendering="crispEdges">${rects}</svg>`;
}
const urls=new Map<string,string>();
export function catalogIconUrl(ref:CatalogIconRef):string {const k=key(ref,24);let url=urls.get(k);if(!url){url=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(catalogIconSvg(ref))}`;urls.set(k,url);}return url;}
