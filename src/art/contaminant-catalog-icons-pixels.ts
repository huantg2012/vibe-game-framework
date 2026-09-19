/** Native, integer pixel painting primitives. Coordinates are authored separately at each size. */
export type CatalogSize = 16 | 24 | 32;
export type Point = readonly [number, number];
export interface CatalogPixels { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }
export const MAT = {
  iron: [0x343e44, 0x64767c, 0x9babaf, 0xd0d6cc],
  brass: [0x5e422d, 0x9b713c, 0xcaa568, 0xefcf90],
  amber: [0x683b23, 0xa86b32, 0xdba14c, 0xf2d38a],
  glass: [0x314b58, 0x557f88, 0x86bab7, 0xd1e0ce],
  bone: [0x5b5750, 0x9c967a, 0xc7c4a2, 0xe3dfc1],
  cloth: [0x343e43, 0x626d6d, 0x8f9890, 0xb8bbaa],
  leather: [0x422f2c, 0x76504a, 0xa67559, 0xc89b75],
  wood: [0x463b2c, 0x7c6445, 0xad8d60, 0xd1b880],
  ceramic: [0x384b4b, 0x597d72, 0x92ad93, 0xd2d1b0],
  paper: [0x665b47, 0x9e9070, 0xcbbd99, 0xe6d8b7],
  wax: [0x655641, 0xa49266, 0xccba87, 0xe9d9a7],
  plum: [0x433744, 0x725662, 0xa78685, 0xd0b6a8],
  ink: 0x263437, seam: 0x527f73,
} as const;

export class PixelCanvas {
  readonly cells: (number | undefined)[];
  readonly protected: Uint8Array;
  anchor: Point;
  constructor(readonly size: CatalogSize) {
    this.cells = Array(size * size); this.protected = new Uint8Array(size * size);
    this.anchor = [Math.floor(size / 2), size - 5];
  }
  dot(x: number, y: number, color?: number): void {
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('Fractional art coordinate');
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) throw new Error(`Pixel outside ${this.size}: ${x},${y}`);
    this.cells[y * this.size + x] = color;
  }
  rect(x: number, y: number, width: number, height: number, color?: number): void {
    for (let yy=y; yy<y+height; yy++) for(let xx=x;xx<x+width;xx++) this.dot(xx,yy,color);
  }
  line(points: readonly Point[], color: number, thickness = 1): void {
    for (let n=1;n<points.length;n++) {
      let [x,y] = points[n-1]!; const [bx,by]=points[n]!;
      const dx=Math.abs(bx-x),sx=x<bx?1:-1,dy=-Math.abs(by-y),sy=y<by?1:-1; let e=dx+dy;
      for(;;) { this.rect(x,y,thickness,thickness,color); if(x===bx&&y===by)break; const e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;} }
    }
  }
  poly(points: readonly Point[], color?: number): void {
    const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
    const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[i]!,b=points[j]!;
        if((a[1]>y+.5)!==(b[1]>y+.5)&&(x+.5)<(b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      }
      if(inside)this.dot(x,y,color);
    }
  }
  ellipse(x: number,y: number,width: number,height: number,color?: number): void {
    for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
      const dx=(xx+.5-width/2)/(width/2),dy=(yy+.5-height/2)/(height/2);
      if(dx*dx+dy*dy<=1)this.dot(x+xx,y+yy,color);
    }
  }
  protect(x:number,y:number,width:number,height:number):void {
    for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++)this.protected[yy*this.size+xx]=1;
  }
  pixels(): CatalogPixels {
    const data=new Uint8ClampedArray(this.size*this.size*4);
    this.cells.forEach((c,i)=>{if(c===undefined)return;data[i*4]=c>>16;data[i*4+1]=(c>>8)&255;data[i*4+2]=c&255;data[i*4+3]=255;});
    return {width:this.size,height:this.size,data};
  }
}
export type ObjectPainter = (p: PixelCanvas) => void;
