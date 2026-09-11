import * as THREE from 'three';
import { STAGE_HEIGHT, STAGE_WIDTH } from './materials';
import type { PresentationPoint } from './bridge';

export function createStageCamera(width:number,height:number):THREE.OrthographicCamera{
  const span=Math.max(width*1.05,1060),viewHeight=span*STAGE_HEIGHT/STAGE_WIDTH;
  const camera=new THREE.OrthographicCamera(-span/2,span/2,viewHeight/2,-viewHeight/2,1,3000);
  const elevation=THREE.MathUtils.degToRad(35),focus=new THREE.Vector3(width*.5,50,height*.49);
  camera.position.set(focus.x,focus.y+Math.sin(elevation)*1300,focus.z+Math.cos(elevation)*1300);
  camera.lookAt(focus);camera.updateMatrixWorld(true);return camera;
}

const projected=new THREE.Vector3();
export function projectStagePoint(camera:THREE.Camera,point:Readonly<PresentationPoint>,out:PresentationPoint,height=0):void{
  projected.set(point.x,height,point.y).project(camera);
  out.x=(projected.x+1)*STAGE_WIDTH/2;out.y=(1-projected.y)*STAGE_HEIGHT/2;
}
