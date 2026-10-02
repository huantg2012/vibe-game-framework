import type { PlaySfxConfig } from '@/managers/audio-manager';
import type { NativeVolumeFamily } from '@/generation/world-study/native-volume-geometry';

export interface MasterAudioPoint { readonly x:number; readonly y:number }
export interface MasterAudioDefinition {
  readonly family:NativeVolumeFamily;
  readonly grade:'low'|'medium'|'severe';
  readonly seed:number;
}
export interface MasterAudioPort {
  playSFX(key:string,config?:PlaySfxConfig):void;
  stopInstance(instanceId:string,fadeOut?:number):void;
}
export interface MasterMaterialAudioRecipe {
  readonly gather:string;
  readonly stress:string;
  readonly release:string;
  readonly gatherGain:number;
  readonly stressGain:number;
  readonly releaseGain:number;
}

/** Existing environmental friction/resistance sounds from the file-backed
 * suspended-sea material bank. Gameplay damage, search and success cues are
 * deliberately excluded: an ambient pressure cycle must not imply an outcome.
 * These are reused sources, not three new bespoke material banks. */
export const MASTER_MATERIAL_AUDIO:Readonly<Record<NativeVolumeFamily,MasterMaterialAudioRecipe>>={
  'folded-slab':{
    gather:'sfx-suspended-sea-gather',stress:'sfx-suspended-sea-shell-hit',release:'sfx-suspended-sea-drain',
    gatherGain:.11,stressGain:.22,releaseGain:.095,
  },
  'fibre-knot':{
    gather:'sfx-suspended-sea-contact',stress:'sfx-suspended-sea-drain',release:'sfx-suspended-sea-fall',
    gatherGain:.07,stressGain:.16,releaseGain:.045,
  },
  'broken-shell':{
    gather:'sfx-suspended-sea-contact',stress:'sfx-suspended-sea-shell-hit',release:'sfx-suspended-sea-drain',
    gatherGain:.065,stressGain:.16,releaseGain:.055,
  },
};
const clamp=(n:number,a=0,b=1):number=>Math.max(a,Math.min(b,n));
let instanceSequence=0;

/** A consumer of the exact visible pressure cycle. Roughly the first half of
 * each cycle is silent. One nearest contact owns the whole event, preventing
 * every construction from producing the same clap at the same time.
 *
 * The host owns AudioManager.bind/unlock/pauseAll/resumeAll. This class owns only
 * its two voices. Injecting the port keeps lifecycle/cycle tests browser-free. */
export class MasterMaterialAudio {
  private readonly recipe:MasterMaterialAudioRecipe;
  private readonly loopConfig:PlaySfxConfig;
  private readonly eventConfig:PlaySfxConfig;
  private readonly loopId:string;
  private readonly eventId:string;
  private readonly gradeGain:number;
  private readonly variation:number;
  private previousTime:number|null=null;
  private previousPressure=0;
  private peakPressure=0;
  private sourceIndex=-1;
  private readonly source={x:0,y:0};
  private loopActive=false;
  private stressPlayed=false;
  private releasePlayed=false;
  private paused=false;
  private inactive=false;
  private disposed=false;
  private phase:'quiet'|'loading'|'stress'|'release'='quiet';
  private lastEvent:string|null=null;
  private eventCount=0;
  private gain=0;
  private pan=0;

  constructor(readonly definition:MasterAudioDefinition,private readonly port:MasterAudioPort){
    this.recipe=MASTER_MATERIAL_AUDIO[definition.family];
    this.gradeGain=definition.grade==='low'?.60:definition.grade==='medium'?.80:1;
    this.variation=.94+((Math.imul(definition.seed|0,48271)>>>0)%997)/997*.06;
    const owner=`r100-material:${++instanceSequence}`;
    this.loopId=`${owner}:load`;this.eventId=`${owner}:transient`;
    this.loopConfig={volume:0,pan:0,spatialGain:0,loop:true,priority:'low',instanceId:this.loopId};
    this.eventConfig={volume:0,pan:0,spatialGain:0,loop:false,priority:'low',instanceId:this.eventId};
  }

  update(timeMs:number,pressure:number,listener:MasterAudioPoint,sources:readonly MasterAudioPoint[],active=true):void{
    if(this.disposed)return;
    if(this.paused)return;
    if(!active){if(!this.inactive){this.stopOwned();this.previousTime=null;}this.inactive=true;return;}
    this.inactive=false;
    if(!Number.isFinite(timeMs)||!Number.isFinite(pressure)||!Number.isFinite(listener.x)||!Number.isFinite(listener.y)){
      this.stopOwned();this.previousTime=null;return;
    }
    const p=clamp(pressure),previous=this.previousTime;
    this.previousTime=timeMs;
    // Recovery, tab suspension and external clock jumps never replay a backlog.
    if(previous===null||timeMs<previous||timeMs-previous>500){
      this.stopOwned();this.previousPressure=p;this.peakPressure=p;
      // Starting/restoring midway has no observed loading cause. Consume that
      // partial cycle; the next quiet interval rearms both one-shot cues.
      this.stressPlayed=p>.025;this.releasePlayed=p>.025;this.sourceIndex=-1;
      if(p>.025)this.selectSource(listener,sources);
      return;
    }
    if(p<=.025){
      this.stopLoop(.12);this.phase='quiet';this.peakPressure=0;
      this.stressPlayed=false;this.releasePlayed=false;this.sourceIndex=-1;
      this.previousPressure=p;return;
    }
    if(this.sourceIndex<0)this.selectSource(listener,sources);
    const current=sources[this.sourceIndex];
    if(!current||!Number.isFinite(current.x)||!Number.isFinite(current.y)){
      this.stopOwned();this.sourceIndex=-1;this.previousPressure=p;return;
    }
    this.source.x=current.x;this.source.y=current.y;
    const distance=Math.hypot(current.x-listener.x,current.y-listener.y);
    // Existing point-source contract: native 32px tile, full to 3 tiles, silent
    // outside 6. Explicit gain/pan goes via playSFX, not playSpatialSFX, so the
    // material bank's point-source attenuation is applied exactly once.
    this.gain=clamp((192-distance)/96);
    this.pan=clamp((current.x-listener.x)/192,-.8,.8);
    this.peakPressure=Math.max(this.peakPressure,p);
    const falling=p<this.previousPressure-.00001;
    if(!this.stressPlayed&&this.previousPressure<.86&&p>=.86){
      this.stopLoop(.09);this.once(this.recipe.stress,this.recipe.stressGain);
      this.stressPlayed=true;this.phase='stress';
    }else if(!this.releasePlayed&&falling&&p<.68&&this.peakPressure>.28){
      this.stopLoop(.12);this.once(this.recipe.release,this.recipe.releaseGain);
      this.releasePlayed=true;this.phase='release';
    }else if(!this.stressPlayed&&!this.releasePlayed&&!falling){
      this.phase='loading';
      const envelope=clamp((p-.06)/.8);
      if(envelope>.01&&this.gain>.001){
        this.loopConfig.volume=this.recipe.gatherGain*this.gradeGain*this.variation*envelope*envelope;
        this.loopConfig.spatialGain=this.gain;this.loopConfig.pan=this.pan;
        this.port.playSFX(this.recipe.gather,this.loopConfig);this.loopActive=true;
      }else this.stopLoop(.10);
    }else this.stopLoop(.12);
    this.previousPressure=p;
  }

  private selectSource(listener:MasterAudioPoint,sources:readonly MasterAudioPoint[]):void{
    let best=-1,distance=Infinity;
    for(let i=0;i<sources.length;i++){
      const point=sources[i]!;if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
      const d=(point.x-listener.x)**2+(point.y-listener.y)**2;if(d<distance){best=i;distance=d;}
    }
    this.sourceIndex=best;
  }
  private once(key:string,volume:number):void{
    // Even a skipped distant event is consumed by the pressure state. Walking
    // back into earshot must not produce a late stress cue without visible cause.
    if(this.gain<=.001)return;
    this.port.stopInstance(this.eventId,0);
    this.eventConfig.volume=volume*this.gradeGain*this.variation;
    this.eventConfig.spatialGain=this.gain;this.eventConfig.pan=this.pan;
    this.port.playSFX(key,this.eventConfig);this.lastEvent=key;this.eventCount++;
  }
  private stopLoop(fade:number):void{
    if(!this.loopActive)return;
    this.port.stopInstance(this.loopId,fade);this.loopActive=false;
  }
  private stopOwned():void{
    this.stopLoop(0);this.port.stopInstance(this.eventId,0);this.phase='quiet';
    this.gain=0;this.pan=0;
  }
  setPaused(paused:boolean):void{
    if(this.disposed||this.paused===paused)return;
    this.paused=paused;this.stopOwned();this.previousTime=null;
  }
  /** Optional recovery hook. Set the clock before the next update, and consume
   * the current pressure peak rather than interpreting restore as a new cycle. */
  synchronize(timeMs:number,pressure:number):void{
    if(this.disposed)return;
    this.stopOwned();this.previousTime=Number.isFinite(timeMs)?timeMs:null;
    this.previousPressure=this.peakPressure=clamp(Number.isFinite(pressure)?pressure:0);
    this.stressPlayed=this.previousPressure>.025;this.releasePlayed=this.stressPlayed;
    this.sourceIndex=-1;
  }
  snapshot():Readonly<Record<string,unknown>>{
    return{family:this.definition.family,grade:this.definition.grade,phase:this.phase,
      paused:this.paused,disposed:this.disposed,clock:this.previousTime,pressure:this.previousPressure,
      sourceIndex:this.sourceIndex,source:{...this.source},gain:this.gain,pan:this.pan,
      loop:this.loopActive?this.recipe.gather:null,lastEvent:this.lastEvent,eventCount:this.eventCount,
      maximumOwnedVoices:2,priority:'low',runtimeSynthesis:false};
  }
  destroy():void{
    if(this.disposed)return;this.stopOwned();this.disposed=true;this.sourceIndex=-1;
  }
}
