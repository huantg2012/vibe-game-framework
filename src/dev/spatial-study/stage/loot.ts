import * as THREE from 'three';
import type { RiftPresentationView } from './bridge';
import { ellipsoid, noise, roughMaterial, surfaceTexture } from './materials';
import { renderCrowbarPixels } from '@/art/crowbar-pixels';
import { contaminantWorldPixels, CONTAMINANT_ICON_IDS } from '@/art/contaminant-icons';
import { WEAPON_DATA } from '@/generated/weapon-data';
import type { LegacyContaminantType } from '@/types/game-types';

interface PileModel { root:THREE.Group; pieces:THREE.Mesh[]; collectedAt:number; wasCollected:boolean; material:THREE.MeshStandardMaterial }
interface ItemModel { root: THREE.Group; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; signature: string; definitionId: string }
export interface StageNativePile {
  readonly root: THREE.Group;
  update(pile: RiftPresentationView['piles'][number], elapsedMs: number): void;
}
export type StagePileFactory = (pile: RiftPresentationView['piles'][number]) => StageNativePile;

/** Opaque search piles disclose nothing until the production inventory reveals an item. */
export class StageLoot {
  readonly group=new THREE.Group();
  private readonly piles=new Map<string,PileModel>();
  private readonly items=new Map<string,ItemModel>();
  private readonly nativePiles=new Map<string,StageNativePile>();
  constructor(private readonly groundHeightAt:(x:number,y:number)=>number=()=>0,
    private readonly isFloor:(x:number,y:number)=>boolean=()=>true,
    private readonly createPile?: StagePileFactory,
    private readonly dynamicSupport=false){}

  update(frame:RiftPresentationView,elapsedMs:number):void{
    for(const pile of frame.piles){
      if(this.createPile){
        let native=this.nativePiles.get(pile.id);
        if(!native){native=this.createPile(pile);this.nativePiles.set(pile.id,native);this.group.add(native.root);}
        native.update(pile,elapsedMs);continue;
      }
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
      const signature = `${item.definitionId}:${item.quality ?? 'ordinary'}:${item.position.x}:${item.position.y}`;
      if(!model){
        const root = new THREE.Group(), material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
        const mesh = new THREE.Mesh(this.itemGeometry(item), material); mesh.name = `field-object:${item.definitionId}`;
        root.add(mesh); model = { root, mesh, signature, definitionId: item.definitionId };
        this.items.set(item.id,model);this.group.add(root);
      } else if (model.signature !== signature) {
        model.mesh.geometry.dispose(); model.mesh.geometry = this.itemGeometry(item);
        model.signature = signature; model.definitionId = item.definitionId;
      }
      model.root.position.set(item.position.x,this.groundHeightAt(item.position.x,item.position.y),item.position.y);
      if(this.dynamicSupport){
        const positions=model.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const base=model.root.position.y;
        for(let index=0;index<positions.count;index++) positions.setY(index,
          this.groundHeightAt(item.position.x+positions.getX(index),item.position.y+positions.getZ(index))-base+.8);
        positions.needsUpdate=true;
        model.mesh.geometry.computeBoundingSphere();
      }
      model.mesh.material.color.setScalar(Math.max(0, item.visibility));
      model.root.visible=item.visibility>0;
    }
    for(const [id,model]of this.items)if(!frame.groundItems.some(item=>item.id===id))model.root.visible=false;
  }

  /** Native authored object pixels laid onto actual support, never a generic rod/stone.
   * Geometry is built only on reveal or a real inventory location change. */
  private itemGeometry(item: RiftPresentationView['groundItems'][number]): THREE.BufferGeometry {
    const definition = item.kind === 'weapon' ? WEAPON_DATA[item.definitionId] : null;
    if (item.kind === 'weapon' && !definition) throw new Error(`Unknown field weapon ${item.definitionId}`);
    if (item.kind === 'contaminant' && !CONTAMINANT_ICON_IDS.includes(item.definitionId as LegacyContaminantType))
      throw new Error(`Unknown field object ${item.definitionId}`);
    const pixels = definition ? renderCrowbarPixels(definition.quality, definition.variant, 'world')
      : contaminantWorldPixels(item.definitionId as LegacyContaminantType, item.quality ?? 'ordinary');
    const positions: number[] = [], colours: number[] = [], colour = new THREE.Color();
    const base = this.groundHeightAt(item.position.x, item.position.y);
    for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
      const at = (y * pixels.width + x) * 4;
      if (!pixels.data[at + 3]) continue;
      const px = item.kind === 'weapon' ? y - pixels.height / 2 : x - pixels.width / 2;
      const pz = item.kind === 'weapon' ? x - pixels.width / 2 : y - pixels.height / 2;
      let supported = true;
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]])
        supported &&= this.isFloor(item.position.x + px + dx!, item.position.y + pz + dz!);
      if (!supported) continue;
      colour.setRGB(pixels.data[at]! / 255, pixels.data[at + 1]! / 255, pixels.data[at + 2]! / 255, THREE.SRGBColorSpace);
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
        const gx = px + dx!, gz = pz + dz!;
        positions.push(gx, this.groundHeightAt(item.position.x + gx, item.position.y + gz) - base + .8, gz);
        colours.push(colour.r, colour.g, colour.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    return geometry;
  }

  snapshot():Record<string,unknown>{return {
    piles:[...this.piles].map(([id,pile])=>({id,visible:pile.root.visible,position:pile.root.position.toArray()})),
    nativePiles:[...this.nativePiles].map(([id,pile])=>({id,visible:pile.root.visible,position:pile.root.position.toArray()})),
    items:[...this.items].map(([id,item])=>({id,definitionId:item.definitionId,visible:item.root.visible,position:item.root.position.toArray()})),
  };}
}
