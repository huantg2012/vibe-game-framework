import { executeR100SurfacePreparation, type R100SurfacePreparationRequest, type R100SurfacePreparationResponse } from './surface-preparation';
const worker=self as unknown as {
 onmessage:((event:MessageEvent<R100SurfacePreparationRequest>)=>void)|null;
 postMessage(message:R100SurfacePreparationResponse,transfer?:ArrayBuffer[]):void;
};
worker.onmessage=({data})=>{
 try {
  worker.postMessage({id:data.id,started:true});
  const result=executeR100SurfacePreparation(data.input);
  const buffers=new Set<ArrayBuffer>();
  const collect=(value:unknown):void=>{
   if(ArrayBuffer.isView(value)){buffers.add(value.buffer as ArrayBuffer);return;}
   if(value&&typeof value==='object')for(const item of Object.values(value))collect(item);
  };
  collect(result);
  worker.postMessage({id:data.id,result},[...buffers]);
 }catch(error){worker.postMessage({id:data.id,error:error instanceof Error?error.message:String(error)});}
};
