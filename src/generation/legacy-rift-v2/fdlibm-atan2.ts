/** Historical V8 12.4 arctangent arithmetic, evaluated using explicit binary64
 * operations so a newer browser's Math implementation cannot redefine a save.
 * Source: https://github.com/v8/v8/blob/12.4.254/src/base/ieee754.cc (atan/atan2).
 *
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 * Modified significantly by Google Inc. Copyright 2016 the V8 project authors.
 * TypeScript translation preserves operation grouping; no rounded acceptance.
 */
import { binary64Fma } from './binary64-fma';
const bits = new DataView(new ArrayBuffer(8));
function high(value: number): number { bits.setFloat64(0, value, false); return bits.getInt32(0, false); }
const HI = [4.63647609000806093515e-1,7.85398163397448278999e-1,9.82793723247329054082e-1,1.570796326794896558e0];
const LO = [2.26987774529616870924e-17,3.06161699786838301793e-17,1.39033110312309984516e-17,6.12323399573676603587e-17];
const AT = [3.33333333333329318027e-1,-1.99999999998764832476e-1,1.42857142725034663711e-1,-1.1111110405462355788e-1,
  9.09088713343650656196e-2,-7.69187620504482999495e-2,6.66107313738753120669e-2,-5.83357013379057348645e-2,
  4.97687799461593236017e-2,-3.65315727442169155270e-2,1.62858201153657823623e-2];
export function v8FdlibmAtan(x: number, fused = false): number {
 const hx=high(x),ix=hx&0x7fffffff;let id:number;
 if(ix>=0x44100000){if(Number.isNaN(x))return x+x;return hx>0?HI[3]!+LO[3]!: -HI[3]!-LO[3]!;}
 if(ix<0x3fdc0000){if(ix<0x3e400000&&1e300+x>1)return x;id=-1;}
 else {x=Math.abs(x);if(ix<0x3ff30000){if(ix<0x3fe60000){id=0;x=(fused?binary64Fma(2,x,-1):2*x-1)/(2+x);}else{id=1;x=(x-1)/(x+1);}}
 else if(ix<0x40038000){id=2;x=(x-1.5)/(fused?binary64Fma(1.5,x,1):1+1.5*x);}else{id=3;x=-1/x;}}
 const z=x*x,w=z*z;
 let s1=z*(AT[0]!+w*(AT[2]!+w*(AT[4]!+w*(AT[6]!+w*(AT[8]!+w*AT[10]!)))));
 let s2=w*(AT[1]!+w*(AT[3]!+w*(AT[5]!+w*(AT[7]!+w*AT[9]!))));
 if(fused){let odd=AT[10]!,even=AT[9]!;for(let i=8;i>=0;i-=2)odd=binary64Fma(w,odd,AT[i]!);for(let i=7;i>=1;i-=2)even=binary64Fma(w,even,AT[i]!);s1=z*odd;s2=w*even;}
 if(id<0)return fused?binary64Fma(-x,s1+s2,x):x-x*(s1+s2);
 const answer=HI[id]!-((fused?binary64Fma(x,s1+s2,-LO[id]!):x*(s1+s2)-LO[id]!)-x);return hx<0?-answer:answer;
}
export function v8FdlibmAtan2(y:number,x:number,fused = false):number {
 const hx=high(x),hy=high(y),ix=hx&0x7fffffff,iy=hy&0x7fffffff;
 const pi=3.141592653589793116,piOver2=1.570796326794896558,piOver4=7.85398163397448279e-1,piLo=1.2246467991473531772e-16,tiny=1e-300;
 if(Number.isNaN(x)||Number.isNaN(y))return x+y;
 if(x===1)return v8FdlibmAtan(y,fused);
 let m=((hy>>31)&1)|((hx>>30)&2);
 if(y===0)return m<2?y:m===2?pi+tiny:-pi-tiny;
 if(x===0)return hy<0?-piOver2-tiny:piOver2+tiny;
 if(ix===0x7ff00000){if(iy===0x7ff00000)return m===0?piOver4+tiny:m===1?-piOver4-tiny:m===2?3*piOver4+tiny:-3*piOver4-tiny;
 return m===0?0:m===1?-0:m===2?pi+tiny:-pi-tiny;}
 if(iy===0x7ff00000)return hy<0?-piOver2-tiny:piOver2+tiny;
 const k=(iy-ix)>>20;let z:number;
 if(k>60){z=piOver2+0.5*piLo;m&=1;}else if(hx<0&&k< -60)z=0;else z=v8FdlibmAtan(Math.abs(y/x),fused);
 return m===0?z:m===1?-z:m===2?pi-(z-piLo):(z-piLo)-pi;
}

export const v8Arm64Atan2 = (y:number,x:number):number => v8FdlibmAtan2(y,x,true);
