import Phaser from 'phaser';
import { ChamberLightField, type LightSpan } from '../art/chamber-light-field';
import type { ChamberSurfaceMap } from '../art/chamber-surface-map';
import { CHAMBER_CAMERA, type ChamberPolygon } from '../systems/purification-chamber-layout';

const FULL_FACE: readonly ChamberPolygon[] = [[{x:0,y:0},{x:640,y:0},{x:640,y:400},{x:0,y:400}]];
/** Source apertures sit inside three authored contact seams, never in open space. */
const CONTACTS = [
  {x:81,y:225,radiusX:22,radiusY:33,elevation:45, phase:.17},
  {x:579,y:224,radiusX:31,radiusY:30,elevation:49, phase:.56},
  {x:301,y:106,radiusX:18,radiusY:26,elevation:66, phase:.83},
] as const;
const CONTACT_PATHS = [
  [[72,201],[75,216],[78,227],[91,236]],
  [[586,211],[585,219],[578,228],[566,228],[558,223]],
  [[296,96],[299,104],[304,118]],
] as const;

/** Local seam transport, short contact glints and six material-bound dust motes.
 * No room-wide breathing, far-field star particles, or autonomous layer motion.
 * Pure visual time never consumes the gameplay RNG. All objects have one owner.
 */
export class ChamberExteriorAtmosphere {
  private readonly field = new ChamberLightField();
  private readonly faces: readonly (readonly LightSpan[])[];
  private readonly light: Phaser.GameObjects.Graphics;
  private readonly contact: Phaser.GameObjects.Graphics;
  private readonly middleOcclusion: Phaser.GameObjects.Graphics;
  private tick = -1;
  private readonly reducedQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  constructor(private readonly scene: Phaser.Scene, albedo: Uint8ClampedArray, surfaces: ChamberSurfaceMap) {
    this.faces = CONTACTS.map(source => this.field.compileFace(source,albedo,FULL_FACE,
      {surface:{map:surfaces,light:source}}));
    this.light = scene.add.graphics().setName('chamber-exterior-contact-light').setDepth(-49.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.contact = scene.add.graphics().setName('chamber-exterior-seam-transport').setDepth(-49.6);
    this.middleOcclusion = scene.add.graphics().setName('chamber-exterior-middle-occlusion').setDepth(-54.5);
  }

  update(time: number, reduceMotion = this.reducedQuery?.matches ?? false): void {
    const camera = this.scene.cameras.main;
    // Keep this occlusion attached to the middle plate during actual camera travel.
    this.middleOcclusion.setPosition(
      Math.round((camera.midPoint.x-CHAMBER_CAMERA.x)*.48),
      Math.round((camera.midPoint.y-CHAMBER_CAMERA.y)*.48));
    const tick = reduceMotion ? -2 : Math.floor(time/100);
    if(tick === this.tick) return;
    this.tick = tick;
    this.light.clear(); this.contact.clear(); this.middleOcclusion.clear();
    for(let i=0;i<CONTACTS.length;i++) {
      const source = CONTACTS[i]!;
      const phase = reduceMotion ? .45 : (time/19000 + source.phase)%1;
      // The flow has a long resting interval. Light and visible flow share this envelope.
      const envelope = phase < .63 ? Math.sin(phase/.63*Math.PI) : 0;
      this.field.paint(this.light,this.faces[i]!,0x3a7e87,.055+envelope*.065);
      if(reduceMotion || envelope < .12) continue;
      const point = along(CONTACT_PATHS[i]!,phase/.63);
      this.contact.fillStyle(0x3b8075,.18+envelope*.3);
      this.contact.fillRect(Math.round(point.x),Math.round(point.y),2,1);
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
    // A slow local loss/reveal on the underside of the continuous displaced east mass.
    // This plane is behind the near shoulder and therefore truly disappears behind it.
    if(!reduceMotion) {
      const drift = Math.floor((Math.sin(time*.00013)+1)*2);
      this.middleOcclusion.fillStyle(0x0d1620,.19);
      this.middleOcclusion.fillPoints([
        {x:550,y:120+drift},{x:573,y:125+drift},{x:596,y:129+drift},
        {x:596,y:132+drift},{x:572,y:129+drift},{x:551,y:124+drift},
      ],true);
    }
  }

  private facesContainPixel(source: number,index: number): boolean {
    const x=index%surfacesWidth, y=Math.floor(index/surfacesWidth);
    return this.faces[source]!.some(span => span.y === y && x >= span.x && x < span.x+span.width);
  }

  destroy(): void { this.light.destroy(); this.contact.destroy(); this.middleOcclusion.destroy(); }
}
const surfacesWidth = 640;
function along(points: readonly (readonly [number,number])[],t:number): {x:number;y:number} {
  const at=Math.min(points.length-1.000001,Math.max(0,t)*(points.length-1));
  const index=Math.floor(at), local=at-index, a=points[index]!, b=points[index+1]!;
  return {x:a[0]+(b[0]-a[0])*local,y:a[1]+(b[1]-a[1])*local};
}
