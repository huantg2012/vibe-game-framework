import assert from 'node:assert/strict';
import {assignNativeAutoCoverage} from '../../src/generation/world-study/native-auto-assignment.ts';
const mask=(...bits)=>{const result=new Uint32Array(2);for(const bit of bits)result[bit>>>5]|=1<<(bit&31);return result;};
const candidate=(variable,name,bits)=>({variable,name,covers:mask(...bits)});
const a0=candidate(0,'a0',[0,31]),a1=candidate(0,'a1',[0]);
const b0=candidate(1,'b0',[32]),b1=candidate(1,'b1',[31,32]);
const input={domains:[[a0,a1],[b0,b1]],required:mask(0,31,32),maxStates:16,branchLimit:8,
  compatible:()=>true,connected:()=>true,checkpoint:()=>{},
  // Neither one-object change can open this passage: both choices must change.
  complete:selection=>selection.every(c=>c.name.endsWith('1'))};
const joint=assignNativeAutoCoverage(input);
assert(joint.accepted);
assert.deepEqual(joint.assignment.map(c=>c.name),['a1','b1']);
assert(joint.backtracks>0);
assert.deepEqual(assignNativeAutoCoverage(input),joint,'Deterministic assignment including bit 31 and 32');
const impossible=assignNativeAutoCoverage({...input,required:mask(0,31,32,33)});
assert.equal(impossible.accepted,false);
assert.equal(impossible.states,0,'Uncoverable space is rejected before placement');
assert.equal(impossible.uncoveredBit,33);
const forced=assignNativeAutoCoverage({...input,complete:()=>true,domains:[[a1],[b0,b1]]});
assert(forced.accepted);
assert.equal(forced.states,2,'Unique responsibility removes an insufficient candidate before search');
assert(forced.assignment.includes(b1));
const cut=assignNativeAutoCoverage({...input,connected:c=>c!==b1});
assert.equal(cut.accepted,false,'Coverage never overrides passage rejection');
const exhausted=assignNativeAutoCoverage({...input,maxStates:1});
assert.equal(exhausted.accepted,false);
assert.equal(exhausted.states,1);
assert(exhausted.exhausted);
console.log('Joint initial assignment: coordinated choice, exact bit masks, forward coverage, passage veto, determinism and bounded work passed');
