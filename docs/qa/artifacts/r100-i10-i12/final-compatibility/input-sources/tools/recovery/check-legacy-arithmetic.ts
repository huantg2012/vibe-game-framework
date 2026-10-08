import assert from 'node:assert/strict';
import { v8FdlibmAtan2, v8Arm64Atan2 } from '../../src/generation/legacy-rift-v2/fdlibm-atan2';
import { binary64Fma, exactBinary64Fma } from '../../src/generation/legacy-rift-v2/binary64-fma';
// The integer implementation is independent of the interval fast path.
let seed=0xb031c;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<100000;i++){
 const a=(random()-.5)*2**Math.floor(random()*1600-800),b=(random()-.5)*2**Math.floor(random()*1600-800);
 const c=i%2===0?-a*b:(random()-.5)*2**Math.floor(random()*1600-800);
 assert(Object.is(binary64Fma(a,b,c),exactBinary64Fma(a,b,c)));
}
const edge=[0,-0,Infinity,-Infinity,NaN,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,1,-1];
for(const y of edge)for(const x of edge)for(const arithmetic of [v8FdlibmAtan2,v8Arm64Atan2]) {
 const actual=arithmetic(y,x),expected=Math.atan2(y,x);
 assert(Object.is(actual,expected),`special atan2(${y},${x})`);
}
for(const a of edge)for(const b of edge)for(const c of edge)assert(Object.is(binary64Fma(a,b,c),exactBinary64Fma(a,b,c)));
// Actual installed Node22 ARM64 V8 is the historical machine implementation.
const historicalMachine=process.versions.v8==='12.4.254.21-node.22'&&process.arch==='arm64';
if(process.env.QA_REQUIRE_HISTORICAL_V8==='1')assert(historicalMachine,'explicit historical-machine audit requires the recorded Node binary');
if(historicalMachine)for(let y=-128;y<=128;y++)for(let x=-128;x<=128;x++)assert(Object.is(v8Arm64Atan2(y,x),Math.atan2(y,x)));
assert.equal(v8FdlibmAtan2(-1,7),-0.1418970546041639);
console.log(`PASS 100000 interval/exact FMA cases and signed-zero/infinite/NaN/subnormal edges; historical ARM64 V8 lattice: ${historicalMachine?'66049 exact comparisons':'not available on this runtime (not claimed)'}.`);
