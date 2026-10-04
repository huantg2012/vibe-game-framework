import { validateR100SurfacePreparation, type R100SurfacePreparationInput, type R100SurfacePreparationResponse, type R100SurfacePreparationRequest, type R100SurfacePreparationResult } from './surface-preparation';
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
  if(signal?.aborted)return Promise.reject(new DOMException('Native surface preparation cancelled','AbortError'));
  return new Promise((resolve,reject)=>{
   let worker:R100SurfaceWorkerPort;
   try{worker=this.createWorker();}catch(error){reject(error);return;}
   const id=++sequence;let finished=false;
   const cleanup=():void=>{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();};
   const fail=(reason:unknown):void=>{if(finished)return;finished=true;cleanup();reject(reason);};
   const cancel=():void=>fail(new DOMException('Native surface preparation cancelled','AbortError'));
   const timeout=setTimeout(()=>fail(new DOMException('Native surface preparation exceeded its budget','TimeoutError')),this.timeoutMs);
   worker.onmessage=({data})=>{
    if(finished||data.id!==id)return;
    if('error' in data){fail(new Error(data.error));return;}
    try{validateR100SurfacePreparation(data.result,input);}catch(error){fail(error);return;}
    finished=true;cleanup();resolve(data.result);
   };
   worker.onerror=event=>fail(new Error(event.message||'Native surface preparation Worker failed'));
   worker.onmessageerror=()=>fail(new Error('Native surface preparation transfer failed'));
   signal?.addEventListener('abort',cancel,{once:true});
   if(signal?.aborted){cancel();return;}
   try{worker.postMessage({id,input});}catch(error){fail(error);}
  });
 }
}
