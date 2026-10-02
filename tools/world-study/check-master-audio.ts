/** File/CPU audio contract. This does not decode, listen to, or approve the mix.
 * Run: TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/world-study/check-master-audio.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { MasterMaterialAudio, MASTER_MATERIAL_AUDIO, type MasterAudioDefinition, type MasterAudioPoint, type MasterAudioPort } from '../../src/dev/rift-r100-masters/audio';
import { audioUrlsFor, findAudioAsset } from '../../src/managers/audio-catalog';
import type { PlaySfxConfig } from '../../src/managers/audio-manager';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const FAMILIES=['folded-slab','fibre-knot','broken-shell'] as const;
const ENVIRONMENT_SOURCES=new Set([
  'sfx-suspended-sea-gather','sfx-suspended-sea-contact','sfx-suspended-sea-shell-hit',
  'sfx-suspended-sea-drain','sfx-suspended-sea-fall',
]);
const LISTENER:MasterAudioPoint={x:0,y:0};
const SOURCES:readonly MasterAudioPoint[]=[{x:112,y:0}];
interface Played { readonly key:string; readonly config:PlaySfxConfig }

function fixture(family:MasterAudioDefinition['family']='folded-slab',grade:MasterAudioDefinition['grade']='severe',seed=20261003){
  const calls:Played[]=[],stops:{id:string;fade:number}[]=[],active=new Map<string,Played>();
  let maximumVoices=0;
  const port:MasterAudioPort={
    playSFX(key,config={}){
      // Production reuses its config objects; snapshots must not alias them.
      const call={key,config:{...config}};calls.push(call);
      assert(config.instanceId,'every material voice is owned');
      active.set(config.instanceId,call);maximumVoices=Math.max(maximumVoices,active.size);
    },
    stopInstance(id,fade=0){stops.push({id,fade});active.delete(id);},
  };
  const audio=new MasterMaterialAudio({family,grade,seed},port);
  const update=(time:number,p:number,listener:MasterAudioPoint=LISTENER,sources:readonly MasterAudioPoint[]=SOURCES,enabled=true)=>audio.update(time,p,listener,sources,enabled);
  return{audio,calls,stops,active,update,events:()=>calls.filter(call=>!call.config.loop),maximumVoices:()=>maximumVoices};
}
function cycle(f:ReturnType<typeof fixture>,start=0){
  for(let elapsed=0;elapsed<=19000;elapsed+=20){
    const c=elapsed/19000;
    const pressure=c<.56?0:c<.76?(c-.56)/.2:c<.83?1:Math.max(0,1-(c-.83)/.17);
    f.update(start+elapsed,pressure);
  }
}
function arm(f:ReturnType<typeof fixture>){f.update(0,0);f.update(100,.5);}
function expectRearmed(f:ReturnType<typeof fixture>,start:number){
  const before=f.events().length;
  f.update(start,0);f.update(start+100,.5);f.update(start+200,.9);f.update(start+300,.6);
  assert.equal(f.events().length,before+2,'a subsequent observed cycle emits stress then release');
}

export function checkMasterAudio(){
  const passed:string[]=[];
  const check=(name:string,run:()=>void)=>{run();passed.push(name);};
  for(const family of FAMILIES){
    const recipe=MASTER_MATERIAL_AUDIO[family];
    check(`${family}: registered real dual-format sources`,()=>{
      for(const key of [recipe.gather,recipe.stress,recipe.release]){
        const asset=findAudioAsset(key);assert(asset,`${key} is preloaded`);
        assert.equal(asset.group,'SFX');assert.equal(asset.spatial,'point');
        for(const url of audioUrlsFor(asset)){
          const bytes=readFileSync(resolve(ROOT,'public',url.slice(1)));
          assert(bytes.length>128,`${url} is not an empty placeholder`);
          if(url.endsWith('.ogg'))assert.equal(bytes.subarray(0,4).toString(),'OggS');
          else assert(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===0xff,'MP3 header');
        }
      }
      assert.equal(findAudioAsset(recipe.gather)!.loop,true,'loading source supports a seamless loop');
      assert.equal(findAudioAsset(recipe.stress)!.loop,false,'stress uses an authored one-shot envelope');
      assert.equal(findAudioAsset(recipe.release)!.loop,false,'release has its own tail, not a abruptly cut loop');
    });
    check(`${family}: no damage, reward, enemy or player-action cues`,()=>{
      for(const key of [recipe.gather,recipe.stress,recipe.release])assert(ENVIRONMENT_SOURCES.has(key),key);
    });
    check(`${family}: first half of visible cycle is silent`,()=>{
      const f=fixture(family);for(let t=0;t<10640;t+=20)f.update(t,0);
      assert.equal(f.calls.length,0);f.audio.destroy();
    });
    check(`${family}: one loading phase, stress and release per cycle`,()=>{
      const f=fixture(family);cycle(f);
      assert(f.calls.some(call=>call.config.loop));
      assert.deepEqual(f.events().map(call=>call.key),[recipe.stress,recipe.release]);
      assert.equal(f.audio.snapshot().phase,'quiet');
      assert(![...f.active.values()].some(call=>call.config.loop),'no sustained bed remains');
      cycle(f,19000);assert.equal(f.events().length,4,'quiet rearms the next cycle');f.audio.destroy();
    });
    check(`${family}: low priority, bounded gain and native source attenuation`,()=>{
      const f=fixture(family);cycle(f);
      for(const call of f.calls){
        assert.equal(call.config.priority,'low');assert(call.config.volume!>0&&call.config.volume!<=.23);
        assert(Math.abs(call.config.spatialGain!-5/6)<1e-12);assert.equal(call.config.pan,112/192);
      }
      f.audio.destroy();
    });
    check(`${family}: updates reuse at most two owned voice IDs`,()=>{
      const f=fixture(family);cycle(f);
      assert.equal(new Set(f.calls.map(call=>call.config.instanceId)).size,2);
      assert(f.maximumVoices()<=2);f.audio.destroy();assert.equal(f.active.size,0);
    });
    check(`${family}: explicit pause remains paused during active updates`,()=>{
      const f=fixture(family);arm(f);f.audio.setPaused(true);
      const count=f.calls.length,stops=f.stops.length;
      for(let t=200;t<1000;t+=20)f.update(t,.95);
      f.audio.setPaused(true);assert.equal(f.calls.length,count);assert.equal(f.stops.length,stops);
      assert.equal(f.active.size,0);assert.equal(f.audio.snapshot().paused,true);f.audio.destroy();
    });
    check(`${family}: mid-release resume consumes the partial cycle`,()=>{
      const f=fixture(family);arm(f);f.update(200,.9);f.update(300,.6);assert.equal(f.events().length,2);
      f.audio.setPaused(true);f.audio.setPaused(false);f.update(310,.6);f.update(320,.5);
      assert.equal(f.events().length,2);expectRearmed(f,400);f.audio.destroy();
    });
    check(`${family}: destruction is idempotent and prevents replay`,()=>{
      const f=fixture(family);arm(f);f.update(200,.9);f.audio.destroy();
      const calls=f.calls.length,stops=f.stops.length;f.audio.destroy();
      f.audio.setPaused(false);f.audio.synchronize(300,0);f.update(400,.95);
      assert.equal(f.calls.length,calls);assert.equal(f.stops.length,stops);assert.equal(f.active.size,0);
    });
  }
  check('grade changes strength without changing cue count or priority',()=>{
    const gains:number[]=[];
    for(const grade of ['low','medium','severe'] as const){
      const f=fixture('folded-slab',grade);arm(f);f.update(200,.9);
      assert.equal(f.events().length,1);gains.push(f.events()[0]!.config.volume!);f.audio.destroy();
    }
    assert(Math.abs(gains[0]!/gains[2]!-.6)<1e-12);assert(Math.abs(gains[1]!/gains[2]!-.8)<1e-12);
  });
  check('same seed produces identical envelope despite distinct owners',()=>{
    const a=fixture(),b=fixture();cycle(a);cycle(b);
    const soundOnly=(calls:Played[])=>calls.map(({key,config:{instanceId:_id,...config}})=>({key,...config}));
    assert.deepEqual(soundOnly(a.calls),soundOnly(b.calls));
    assert.notEqual(a.calls[0]!.config.instanceId,b.calls[0]!.config.instanceId);a.audio.destroy();b.audio.destroy();
  });
  check('motion disable stops once and does not silently unpause explicit pause',()=>{
    const f=fixture();arm(f);const before=f.stops.length;
    for(let t=200;t<1400;t+=20)f.update(t,.95,LISTENER,SOURCES,false);
    assert.equal(f.stops.length,before+2,'one loop stop and one transient stop');
    const calls=f.calls.length;f.update(1400,.95);f.update(1500,.6);assert.equal(f.calls.length,calls);
    f.audio.setPaused(true);f.update(1600,0,LISTENER,SOURCES,false);f.update(1700,.9);
    assert.equal(f.calls.length,calls);f.audio.destroy();
  });
  for(const [name,time] of [['forward jump',1000],['backward clock',50]] as const){
    check(`${name} consumes unobserved pressure and rearms after quiet`,()=>{
      const f=fixture();arm(f);const count=f.calls.length;
      f.update(time,.95);f.update(time+100,.6);assert.equal(f.calls.length,count);assert.equal(f.active.size,0);
      expectRearmed(f,time+200);f.audio.destroy();
    });
  }
  check('exactly 500 ms is a regular update, not a suspended-tab backlog',()=>{
    const f=fixture();arm(f);f.update(600,.95);assert.equal(f.events().length,1);f.audio.destroy();
  });
  check('starting in high pressure never invents loading or release',()=>{
    const f=fixture();f.update(0,.95);f.update(100,.6);f.update(200,.3);
    assert.equal(f.calls.length,0);expectRearmed(f,300);f.audio.destroy();
  });
  check('explicit synchronization consumes partial cycle without catch-up',()=>{
    const f=fixture();arm(f);f.audio.synchronize(1500,.6);const count=f.calls.length;
    f.update(1600,.5);assert.equal(f.calls.length,count);expectRearmed(f,1700);f.audio.destroy();
  });
  check('threshold jitter does not duplicate stress or release',()=>{
    const f=fixture();arm(f);
    [.86,.85,.9,.84,.99,.67,.7,.66,.6].forEach((p,i)=>f.update(200+i*20,p));
    assert.equal(f.events().length,2);f.audio.destroy();
  });
  check('audibility uses world distance with full, partial and zero ranges',()=>{
    for(const [distance,gain] of [[0,1],[96,1],[144,.5],[192,0],[240,0]]){
      const f=fixture(),sources=[{x:distance!,y:0}];f.update(0,0,LISTENER,sources);f.update(100,.9,LISTENER,sources);
      if(gain===0)assert.equal(f.calls.length,0);else assert.equal(f.events()[0]!.config.spatialGain,gain);
      f.audio.destroy();
    }
  });
  check('left/right pan follows source and is bounded before cutoff',()=>{
    for(const x of [-180,180]){
      const f=fixture(),sources=[{x,y:0}];f.update(0,0,LISTENER,sources);f.update(100,.9,LISTENER,sources);
      assert.equal(f.events()[0]!.config.pan,Math.sign(x)*.8);f.audio.destroy();
    }
  });
  check('moving into range cannot replay an inaudible stress event',()=>{
    const f=fixture(),sources=[{x:220,y:0}];f.update(0,0,LISTENER,sources);f.update(100,.9,LISTENER,sources);
    f.update(200,.95,{x:150,y:0},sources);assert.equal(f.events().length,0);
    f.update(300,.6,{x:150,y:0},sources);assert.equal(f.events()[0]!.key,MASTER_MATERIAL_AUDIO['folded-slab'].release);
    f.audio.destroy();
  });
  check('one nearest source remains locked through the cycle',()=>{
    const f=fixture(),sources=[{x:40,y:0},{x:-80,y:0}];
    f.update(0,0,LISTENER,sources);f.update(100,.5,LISTENER,sources);
    f.update(200,.9,{x:-70,y:0},sources);assert.equal(f.audio.snapshot().sourceIndex,0);
    assert(f.events()[0]!.config.pan!>0,'sound stays at the causal source, not the new nearest object');
    f.update(300,0,{x:-70,y:0},sources);f.update(400,.5,{x:-70,y:0},sources);
    assert.equal(f.audio.snapshot().sourceIndex,1);f.audio.destroy();
  });
  check('missing and nonfinite source locations never produce audio',()=>{
    const f=fixture();f.update(0,0);f.update(100,.5,LISTENER,[]);
    f.update(200,.95,LISTENER,[{x:NaN,y:0},{x:0,y:Infinity}]);assert.equal(f.calls.length,0);f.audio.destroy();
  });
  check('disappearing source releases the owned loading voice',()=>{
    const f=fixture();arm(f);assert.equal(f.active.size,1);
    f.update(200,.6,LISTENER,[]);assert.equal(f.active.size,0);f.audio.destroy();
  });
  for(const field of ['time','pressure','listener'] as const){
    check(`nonfinite ${field} releases voices and resets recovery`,()=>{
      const f=fixture();arm(f);
      f.update(field==='time'?Infinity:200,field==='pressure'?NaN:.6,field==='listener'?{x:NaN,y:0}:LISTENER);
      assert.equal(f.active.size,0);const count=f.calls.length;f.update(300,.95);f.update(400,.6);
      assert.equal(f.calls.length,count);f.audio.destroy();
    });
  }
  check('pressure outside authored range is safely clamped',()=>{
    const f=fixture();f.update(0,-1);f.update(100,2);f.update(200,-1);
    assert.equal(f.events().length,1);assert.equal(f.audio.snapshot().phase,'quiet');f.audio.destroy();
  });
  check('separate controllers cannot stop another controller’s voice',()=>{
    const a=fixture(),b=fixture('fibre-knot');arm(a);arm(b);a.audio.destroy();
    const aIds=new Set(a.stops.map(stop=>stop.id));assert(b.calls.every(call=>!aIds.has(call.config.instanceId!)));
    assert.equal(b.active.size,1);b.audio.destroy();
  });
  return{status:'pass',checks:passed.length,cases:passed,scope:'File registration/headers and injected-port CPU behavior only; no browser playback, actual listening, final mix or aesthetic approval'};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  console.log(JSON.stringify(checkMasterAudio(),null,2));
}
