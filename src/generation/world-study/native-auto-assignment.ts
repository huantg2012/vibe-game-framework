/** Bounded initial assignment: coverage obligations and passage compatibility
 * are solved together. No object is moved after a complete plan is accepted. */
export interface NativeAutoAssignmentCandidate {
  readonly variable:number;
  readonly covers:Uint32Array;
}
export interface NativeAutoAssignmentOptions<T extends NativeAutoAssignmentCandidate> {
  readonly domains:readonly (readonly T[])[];
  readonly required:Uint32Array;
  readonly maxStates:number;
  readonly branchLimit:number;
  readonly compatible:(a:T,b:T)=>boolean;
  readonly connected:(candidate:T,depth:number)=>boolean;
  readonly complete:(assignment:readonly T[])=>boolean;
  readonly checkpoint:()=>void;
}
export function assignNativeAutoCoverage<T extends NativeAutoAssignmentCandidate>(options:NativeAutoAssignmentOptions<T>){
  const {domains,required,checkpoint}=options,words=required.length;
  const selected:T[]=[],assigned=new Uint8Array(domains.length);
  let states=0,backtracks=0,coveragePrunes=0,passagePrunes=0,completeChecks=0,uncoveredBit=-1;
  let exhausted=false;
  const includes=(cover:Uint32Array,need:Uint32Array)=>{
    for(let word=0;word<words;word++)if(((cover[word]!&need[word]!)>>>0)!==need[word]!)return false;
    return true;
  };
  const search=(covered:Uint32Array):boolean=>{
    checkpoint();
    if(selected.length===domains.length){completeChecks++;return includes(covered,required)&&options.complete(selected);}
    const pending=domains.map((domain,index)=>assigned[index]?[]:domain.filter(candidate=>selected.every(old=>options.compatible(candidate,old))));
    const need=Uint32Array.from(required,(mask,word)=>mask&~covered[word]!);
    // Forward checking: a point must remain coverable, and if only one
    // remaining object can cover it, that object's domain must honor it.
    for(let pass=0;pass<domains.length;pass++){
      const once=new Uint32Array(words),multiple=new Uint32Array(words),unions=pending.map(()=>new Uint32Array(words));
      for(let variable=0;variable<domains.length;variable++)if(!assigned[variable]){
        if(!pending[variable]!.length){passagePrunes++;return false;}
        const union=unions[variable]!;
        for(const candidate of pending[variable]!)for(let word=0;word<words;word++)union[word]=union[word]!|candidate.covers[word]!;
        for(let word=0;word<words;word++){multiple[word]=multiple[word]!|(once[word]!&union[word]!);once[word]=once[word]!|union[word]!;}
      }
      for(let word=0;word<words;word++)if(((once[word]!&need[word]!)>>>0)!==need[word]!){
        const missing=(need[word]!&~once[word]!)>>>0;
        uncoveredBit=word*32+31-Math.clz32(missing&-missing);coveragePrunes++;return false;
      }
      let reduced=false;
      for(let variable=0;variable<domains.length;variable++)if(!assigned[variable]){
        const forced=Uint32Array.from(need,(mask,word)=>mask&unions[variable]![word]!&~multiple[word]!);
        const old=pending[variable]!;pending[variable]=old.filter(candidate=>includes(candidate.covers,forced));
        if(!pending[variable]!.length){coveragePrunes++;return false;}
        reduced ||= old.length!==pending[variable]!.length;
      }
      if(!reduced)break;checkpoint();
    }
    let variable=-1;
    for(let index=0;index<domains.length;index++)if(!assigned[index]&&(variable<0||pending[index]!.length<pending[variable]!.length))variable=index;
    for(const candidate of pending[variable]!.slice(0,options.branchLimit)){
      checkpoint();if(states>=options.maxStates){exhausted=true;return false;}states++;
      if(!options.connected(candidate,selected.length)){passagePrunes++;continue;}
      selected.push(candidate);assigned[variable]=1;
      const next=Uint32Array.from(covered,(mask,word)=>mask|candidate.covers[word]!);
      if(search(next))return true;
      selected.pop();assigned[variable]=0;backtracks++;
      if(exhausted)return false;
    }
    return false;
  };
  const accepted=search(new Uint32Array(words));
  return {accepted,assignment:accepted?[...selected]:[],states,backtracks,coveragePrunes,passagePrunes,completeChecks,uncoveredBit,exhausted};
}
