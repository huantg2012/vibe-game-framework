import { validateR100SurfacePreparation, type R100SurfacePreparationInput, type R100SurfacePreparationResponse, type R100SurfacePreparationRequest, type R100SurfacePreparationResult } from './surface-preparation';
import { requestWorker } from '@/utils/worker-request';
export interface R100SurfaceWorkerPort {
 onmessage:((event:MessageEvent<R100SurfacePreparationResponse>)=>void)|null;
 onerror:((event:ErrorEvent)=>void)|null;
 onmessageerror:((event:MessageEvent)=>void)|null;
 postMessage(message:R100SurfacePreparationRequest):void;
 terminate():void;
}
export type R100SurfaceWorkerFactory=()=>R100SurfaceWorkerPort;
let sequence=0;
const browserWorker:R100SurfaceWorkerFactory=()=>new Worker(new URL('./surface-preparation-worker.ts',import.meta.url),{type:'module',name:'r100-surface-preparation'});
/** Dedicated short-lived Worker; abort/timeout terminate computation, not just
 * the promise. Cached world/material inputs are cloned, never detached. */
export class R100SurfacePreparationClient {
 constructor(private readonly createWorker:R100SurfaceWorkerFactory=browserWorker,private readonly timeoutMs=60000){
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>60000)throw new Error('Invalid native preparation timeout');
 }
 prepare(input:R100SurfacePreparationInput,signal?:AbortSignal):Promise<R100SurfacePreparationResult>{
  return requestWorker(this.createWorker,{id:++sequence,input},data=>{
   if('error' in data)throw new Error(data.error);
   if(!('result' in data))throw new Error('Malformed surface preparation response');
   validateR100SurfacePreparation(data.result,input);
   return data.result;
  },{signal,timeoutMs:this.timeoutMs,label:'Native surface preparation'});
 }
}
