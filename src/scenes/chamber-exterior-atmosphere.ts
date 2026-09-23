import Phaser from 'phaser';
import { ChamberLightField, type LightSpan } from '../art/chamber-light-field';
import type { ChamberSurfaceMap } from '../art/chamber-surface-map';
import { CHAMBER_EXTERIOR_CONTACTS, type ChamberPolygon } from '../systems/purification-chamber-layout';
import { ChamberPixels } from '../art/purification-chamber-pixels';
import { paintChamberDistantPresence } from '../art/chamber-exterior-pixels';
import { sampleChamberDistantPresence, type ChamberDistantPresence,
  type ChamberExteriorOffset } from './chamber-exterior-motion';

const FULL_FACE: readonly ChamberPolygon[] = [[{x:0,y:0},{x:640,y:0},{x:640,y:400},{x:0,y:400}]];
/** Source apertures follow the visible outer continuation, distinct from the
 * contact root hidden under the maintained wall. */
const CONTACTS = CHAMBER_EXTERIOR_CONTACTS;
const STILL_OFFSET = { x: 0, y: 0 } as const;
const PRESENCE_DEPTH = -57.5;
let atmosphereId = 0;

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
  private readonly presence: Phaser.GameObjects.Image;
  private readonly presenceTexture: string;
  private readonly presenceState: ChamberDistantPresence = { active: false, phase: 0, cycle: 0, alpha: 0, x: 0, y: 0 };
  private readonly flowPoint = { x: 0, y: 0 };
  private destroyed = false;
  private tick = -1;
  private readonly reducedQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  constructor(private readonly scene: Phaser.Scene, albedo: Uint8ClampedArray, surfaces: ChamberSurfaceMap) {
    this.presenceTexture = `chamber-exterior-presence-${++atmosphereId}`;
    const presenceTexture = scene.textures.createCanvas(this.presenceTexture, 80, 96);
    if (!presenceTexture) throw new Error('Unable to allocate distant chamber presence');
    presenceTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    paintChamberDistantPresence(new ChamberPixels(presenceTexture.context));
    presenceTexture.refresh();
    this.presence = scene.add.image(498, 203, this.presenceTexture)
      .setName('chamber-exterior-distant-presence').setDepth(PRESENCE_DEPTH).setAlpha(0).setVisible(false);
    // Emissive seam transport needs a real solid host, not a face pointing at
    // the reflection source. The two are different material masks.
    for (let i = 0; i < this.transportHost.length; i++) this.transportHost[i] = albedo[i * 4 + 3]! > 0 ? 1 : 0;
    this.faces = CONTACTS.map(source => this.field.compileFace(source,albedo,FULL_FACE,
      {surface:{map:surfaces,light:source}}));
    this.light = scene.add.graphics().setName('chamber-exterior-contact-light').setDepth(-49.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.contact = scene.add.graphics().setName('chamber-exterior-seam-transport').setDepth(-49.6);
  }

  update(time: number, reduceMotion = this.reducedQuery?.matches ?? false,
    farOffset: Readonly<ChamberExteriorOffset> = STILL_OFFSET): void {
    if (this.destroyed) return;
    sampleChamberDistantPresence(time, this.presenceState);
    this.presence.setVisible(!reduceMotion && this.presenceState.active)
      .setAlpha(this.presenceState.alpha)
      .setPosition(Math.round(this.presenceState.x + farOffset.x), Math.round(this.presenceState.y + farOffset.y));
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
      const point = this.flowPoint;
      along(source.path,phase/.63,point);
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

  getPresenceState(): ChamberDistantPresence & { visible: boolean; depth: number } {
    return { ...this.presenceState, visible: !this.destroyed && this.presence.visible, depth: PRESENCE_DEPTH };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.light.destroy(); this.contact.destroy(); this.presence.destroy();
    if (this.scene.textures.exists(this.presenceTexture)) this.scene.textures.remove(this.presenceTexture);
  }
}
const surfacesWidth = 640;
function along(points: readonly (readonly [number,number])[],t:number,out:{x:number;y:number}): void {
  const at=Math.min(points.length-1.000001,Math.max(0,t)*(points.length-1));
  const index=Math.floor(at), local=at-index, a=points[index]!, b=points[index+1]!;
  out.x = a[0]+(b[0]-a[0])*local;
  out.y = a[1]+(b[1]-a[1])*local;
}
