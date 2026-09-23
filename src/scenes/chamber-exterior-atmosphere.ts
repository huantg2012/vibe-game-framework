import Phaser from 'phaser';
import { ChamberLightField, type LightSpan } from '../art/chamber-light-field';
import type { ChamberSurfaceMap } from '../art/chamber-surface-map';
import { CHAMBER_EXTERIOR_CONTACTS, type ChamberPolygon } from '../systems/purification-chamber-layout';

const FULL_FACE: readonly ChamberPolygon[] = [[{x:0,y:0},{x:640,y:0},{x:640,y:400},{x:0,y:400}]];
/** Source apertures follow the visible outer continuation, distinct from the
 * contact root hidden under the maintained wall. */
const CONTACTS = CHAMBER_EXTERIOR_CONTACTS;

/** Local seam transport, short contact glints and four material-bound dust motes.
 * No room-wide breathing, far-field star particles, or autonomous layer motion.
 * Pure visual time never consumes the gameplay RNG. All objects have one owner.
 */
export class ChamberExteriorAtmosphere {
  private readonly field = new ChamberLightField();
  private readonly faces: readonly (readonly LightSpan[])[];
  private readonly transportHost = new Uint8Array(640 * 400);
  private readonly light: Phaser.GameObjects.Graphics;
  private readonly contact: Phaser.GameObjects.Graphics;
  private tick = -1;
  private readonly reducedQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  constructor(scene: Phaser.Scene, albedo: Uint8ClampedArray, surfaces: ChamberSurfaceMap) {
    // Emissive seam transport needs a real solid host, not a face pointing at
    // the reflection source. The two are different material masks.
    for (let i = 0; i < this.transportHost.length; i++) this.transportHost[i] = albedo[i * 4 + 3]! > 0 ? 1 : 0;
    this.faces = CONTACTS.map(source => this.field.compileFace(source,albedo,FULL_FACE,
      {surface:{map:surfaces,light:source}}));
    this.light = scene.add.graphics().setName('chamber-exterior-contact-light').setDepth(-49.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.contact = scene.add.graphics().setName('chamber-exterior-seam-transport').setDepth(-49.6);
  }

  update(time: number, reduceMotion = this.reducedQuery?.matches ?? false): void {
    const tick = reduceMotion ? -2 : Math.floor(time/100);
    if(tick === this.tick) return;
    this.tick = tick;
    this.light.clear(); this.contact.clear();
    for(let i=0;i<CONTACTS.length;i++) {
      const source = CONTACTS[i]!;
      const phase = reduceMotion ? .45 : (time/19000 + source.phase)%1;
      // The flow has a long resting interval. Light and visible flow share this envelope.
      const envelope = phase < .63 ? Math.sin(phase/.63*Math.PI) : 0;
      this.field.paint(this.light,this.faces[i]!,0x3a7e87,.055+envelope*.065);
      if(reduceMotion || envelope < .12) continue;
      const point = along(source.path,phase/.63);
      const flowX = Math.round(point.x), flowY = Math.round(point.y);
      if (this.hasTransportHost(flowX,flowY)) {
        this.contact.fillStyle(0x3b8075,.18+envelope*.3);
        this.contact.fillRect(flowX,flowY,2,1);
      }
      // One pair detaches within the reflected contact pool, disappearing before the void.
      for(let mote=0;mote<2;mote++) {
        const life = (phase*1.4+mote*.41)%1;
        const x = source.x + (i === 1 ? 1 : -1)*(3+life*8) + mote*2;
        const y = source.y + 4-life*(mote ? 9 : 15);
        const index = Math.round(y)*surfacesWidth+Math.round(x);
        // Reflection needs a real visible solid; this also suppresses free-floating dots.
        if(!this.facesContainPixel(i,index)) continue;
        this.contact.fillStyle(0x7c8987,envelope*Math.sin(life*Math.PI)*.30);
        this.contact.fillRect(Math.round(x),Math.round(y),mote?1:2,1);
      }
    }

  }

  private hasTransportHost(x: number, y: number): boolean {
    return x >= 0 && x + 1 < surfacesWidth && y >= 0 && y < 400
      && !!this.transportHost[y * surfacesWidth + x] && !!this.transportHost[y * surfacesWidth + x + 1];
  }

  private facesContainPixel(source: number,index: number): boolean {
    const x=index%surfacesWidth, y=Math.floor(index/surfacesWidth);
    return this.faces[source]!.some(span => span.y === y && x >= span.x && x < span.x+span.width);
  }

  destroy(): void { this.light.destroy(); this.contact.destroy(); }
}
const surfacesWidth = 640;
function along(points: readonly (readonly [number,number])[],t:number): {x:number;y:number} {
  const at=Math.min(points.length-1.000001,Math.max(0,t)*(points.length-1));
  const index=Math.floor(at), local=at-index, a=points[index]!, b=points[index+1]!;
  return {x:a[0]+(b[0]-a[0])*local,y:a[1]+(b[1]-a[1])*local};
}
