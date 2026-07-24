import type { RawImage } from '../src/types';
export function makeSolid(w: number, h: number, rgba: [number,number,number,number]): RawImage {
  const data = Buffer.alloc(w*h*4);
  for (let i=0;i<w*h;i++) data.set(rgba, i*4);
  return { data, width: w, height: h };
}
export function makeChecker(w:number,h:number,a:[number,number,number,number],b:[number,number,number,number]): RawImage {
  const data = Buffer.alloc(w*h*4);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) data.set((x+y)%2? b:a, (y*w+x)*4);
  return { data, width:w, height:h };
}
