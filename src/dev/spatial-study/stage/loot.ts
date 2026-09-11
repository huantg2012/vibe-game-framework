import * as THREE from 'three';
import type { RiftPresentationView } from './bridge';
import { ellipsoid, noise, roughMaterial, surfaceTexture } from './materials';

interface PileModel { root:THREE.Group; pieces:THREE.Mesh[]; collectedAt:number; wasCollected:boolean; material:THREE.MeshStandardMaterial }

/** Opaque search piles disclose nothing until the production inventory reveals an item. */
export class StageLoot {
  readonly group=new THREE.Group();
  private readonly piles=new Map<string,PileModel>();
  private readonly items=new Map<string,THREE.Group>();
  private readonly iron=roughMaterial(0x8d9288);
  private readonly dark=roughMaterial(0x313933);
  private readonly relic=roughMaterial(0x73847b);
  private readonly up=new THREE.Vector3(0,1,0);
  private readonly normal=new THREE.Vector3(0,1,0);
  constructor(private readonly groundHeightAt:(x:number,y:number)=>number=()=>0){}

  update(frame:RiftPresentationView,elapsedMs:number):void{
    for(const pile of frame.piles){
      let model=this.piles.get(pile.id);
      if(!model){
        const root=new THREE.Group(),material=roughMaterial(0,surfaceTexture(0x777469,pile.id.length*17,'stone'));
        const pieces:THREE.Mesh[]=[];
        for(let i=0;i<8;i++){
          const piece=ellipsoid(3+noise(i,1)*6,1.8+noise(i,2)*3,2+noise(i,3)*5,material,9);
          piece.position.set((noise(i,4)-.5)*22,2+noise(i,5)*3,(noise(i,6)-.5)*15);
          piece.rotation.y=noise(i,7)*4;piece.rotation.z=(noise(i,8)-.5)*.5;
          root.add(piece);pieces.push(piece);
        }
        model={root,pieces,material,collectedAt:Infinity,wasCollected:false};this.piles.set(pile.id,model);this.group.add(root);
      }
      const baseHeight=this.groundHeightAt(pile.position.x,pile.position.y);
      model.root.position.set(pile.position.x,baseHeight,pile.position.y);
      if(pile.collected&&!model.wasCollected){model.collectedAt=elapsedMs;model.wasCollected=true;}
      const age=elapsedMs-model.collectedAt;
      model.root.visible=pile.visibility>0;
      model.material.color.setScalar(Math.max(.16,pile.visibility)*(pile.targeted?1.14:1));
      for(let i=0;i<model.pieces.length;i++){
        const piece=model.pieces[i]!;
        const pieceGround=this.groundHeightAt(pile.position.x+piece.position.x,pile.position.y+piece.position.z)-baseHeight;
        piece.position.y=pieceGround+(2+noise(i,5)*3)*(pile.collected?.35:1)
          +(pile.searching?Math.sin(elapsedMs*.035+i*2)*.35:0)
          +(age>=0&&age<300?Math.sin(age/300*Math.PI)*(3+noise(i,9)*5):0);
        piece.scale.y=(1.8+noise(i,2)*3)*(pile.collected?.45:1);
      }
    }
    for(const item of frame.groundItems){
      let model=this.items.get(item.id);
      if(!model){
        model=new THREE.Group();
        if(item.kind==='weapon'){
          const rod=new THREE.Mesh(new THREE.CylinderGeometry(.9,.8,25,7),this.iron);rod.rotation.x=Math.PI/2;rod.rotation.z=.28;rod.position.y=2.8;model.add(rod);
          const handle=new THREE.Mesh(new THREE.BoxGeometry(2,2,6),this.dark);handle.position.set(0,2.8,-9);model.add(handle);
        }else{
          const relic=ellipsoid(5.5,3.8,4,this.relic,9);relic.position.y=4;model.add(relic);
          const seam=new THREE.Mesh(new THREE.BoxGeometry(1.1,1,6),roughMaterial(0xa1bdb1));seam.position.set(-1,6.8,0);model.add(seam);
        }
        this.items.set(item.id,model);this.group.add(model);
      }
      model.position.set(item.position.x,this.groundHeightAt(item.position.x,item.position.y),item.position.y);
      // The revealed item rests on the local slope; this never rotates its
      // formal pickup position or changes interaction reach.
      const dx=(this.groundHeightAt(item.position.x+1,item.position.y)-this.groundHeightAt(item.position.x-1,item.position.y))/2;
      const dz=(this.groundHeightAt(item.position.x,item.position.y+1)-this.groundHeightAt(item.position.x,item.position.y-1))/2;
      this.normal.set(-dx,1,-dz).normalize();model.quaternion.setFromUnitVectors(this.up,this.normal);
      model.visible=item.visibility>0;
    }
    for(const [id,model]of this.items)if(!frame.groundItems.some(item=>item.id===id))model.visible=false;
  }

  snapshot():Record<string,unknown>{return {
    piles:[...this.piles].map(([id,pile])=>({id,visible:pile.root.visible,position:pile.root.position.toArray()})),
    items:[...this.items].map(([id,item])=>({id,visible:item.visible,position:item.position.toArray()})),
  };}
}
