import type { RiftDevFixture } from '@/scenes/rift-scene';
import { createStageSightGrid } from '../spatial-study/stage/sight-grid';
import { createLivingLandmassPresentation } from './presentation';
import { createLivingSearchVisual } from './search-visual';
import { LivingLandmassRuntime } from './runtime';
import type { LivingLandmassWorld } from './world';

export interface LivingLandmassFixtureOptions {
  readonly onReturn:()=>void;
  readonly onPause:()=>void;
  readonly onRuntime:(runtime:LivingLandmassRuntime)=>void;
  readonly recordEvent:(event:string,payload:unknown)=>void;
}
export function createLivingLandmassFixture(world:LivingLandmassWorld,options:LivingLandmassFixtureOptions):RiftDevFixture{
  return{createLayout:()=>world.layout,onReturn:options.onReturn,onPause:options.onPause,
    extractionGlowRadius:8,createSightGrid:createStageSightGrid,entryDurationMs:world.entryDurationMs,freezeAfterEnd:true,
    atmosphereKey:'amb-rift-alien-atmosphere',worldSurface:'runtime',footstepMaterial:'soil',
    createSearchObjectVisual:createLivingSearchVisual,configureCamera:camera=>camera.setZoom(1.35),
    createRuntime:context=>{const runtime=new LivingLandmassRuntime(context,world,options.recordEvent,createLivingLandmassPresentation);
      options.onRuntime(runtime);return runtime;}};
}
