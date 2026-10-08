/** Exact finite binary64 fused multiply/add. Historical ARM64 V8 contracted the
 * fdlibm polynomial into FMADD/FMSUB; JS multiply then add rounds twice.
 * Integer alignment and ties-to-even rounding preserve that machine operation. */
const view = new DataView(new ArrayBuffer(8));
function parts(value: number): { coefficient: bigint; exponent: number } {
 view.setFloat64(0,value,false);const bits=view.getBigUint64(0,false),biased=Number((bits>>52n)&2047n);
 const magnitude=(bits&0xfffffffffffffn)|(biased===0?0n:0x10000000000000n);
 return {coefficient:(bits>>63n)?-magnitude:magnitude,exponent:biased===0?-1074:biased-1075};
}
export function exactBinary64Fma(a:number,b:number,c:number):number {
 if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(c))return a*b+c;
 const x=parts(a),y=parts(b),z=parts(c),product=x.coefficient*y.coefficient,pe=x.exponent+y.exponent;
 if(product===0n&&z.coefficient===0n)return a*b+c;
 const exponent=product===0n?z.exponent:z.coefficient===0n?pe:Math.min(pe,z.exponent);
 let integer=(product===0n?0n:product<<BigInt(pe-exponent))+(z.coefficient===0n?0n:z.coefficient<<BigInt(z.exponent-exponent));
 if(integer===0n)return 0;
 const negative=integer<0n;if(negative)integer=-integer;
 const shift=Math.max(0,integer.toString(2).length-53,-1074-exponent);
 if(shift>0){const length=BigInt(shift),rest=integer&((1n<<length)-1n),half=1n<<(length-1n);integer>>=length;
  if(rest>half||(rest===half&&(integer&1n)!==0n))integer++;}
 const result=Number(integer)*2**(exponent+shift);return negative?-result:result;
}

/** Error-free TwoProduct/TwoSum give a narrow interval. Only return when BOTH
 * interval endpoints round to the same binary64; ties/underflow use integers. */
export function binary64Fma(a:number,b:number,c:number):number {
 const product=a*b,sum=product+c;
 if(Math.abs(a)<1e100&&Math.abs(b)<1e100&&Math.abs(product)>1e-100&&Math.abs(sum)>1e-100&&Number.isFinite(sum)){
  const splitA=134217729*a,highA=splitA-(splitA-a),lowA=a-highA;
  const splitB=134217729*b,highB=splitB-(splitB-b),lowB=b-highB;
  const productError=((highA*highB-product)+highA*lowB+lowA*highB)+lowA*lowB;
  const virtual=sum-product,sumError=(product-(sum-virtual))+(c-virtual);
  const correction=productError+sumError,bound=Math.abs(correction)*Number.EPSILON;
  const lower=sum+(correction-bound),upper=sum+(correction+bound);
  if(Object.is(lower,upper))return lower;
 }
 return exactBinary64Fma(a,b,c);
}
