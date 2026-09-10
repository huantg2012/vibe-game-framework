/** Native 24px inventory objects. The residue and the tool share one material identity.
 * Hand-authored pixels, independent of Phaser/DOM. No generic bottle, rarity tint or glyph.
 */
import type { ContaminantType } from '../types/game-types';

export const CONTAMINANT_ICON_IDS = ['solidify','ruminate','scatter','retrograde','delay','siphon','expand','resonate','overwrite','erode','muffle','kindle','stitch','compress','mirror','echo','abyss','combust'] as const satisfies readonly ContaminantType[];
type Point = readonly [number, number];
type Ink = 's'|'d'|'m'|'l'|'h'|'t'|'g'|'b';
// Shared worn mineral/iron ramp and local contamination seams. Never an icon-wide glow.
const PALETTE: Record<Ink, string> = { s:'#272d2b', d:'#444d47', m:'#687366', l:'#939b85', h:'#bdc2a4', t:'#245a50', g:'#398a72', b:'#78b79a' };
export type ContaminantArtQuality = 'ordinary'|'good'|'fine'|'excellent';
export const CONTAMINANT_ART_QUALITIES = ['ordinary','good','fine','excellent'] as const;
export const CONTAMINANT_SAMPLE_IDS = ['solidify','scatter','retrograde','muffle','expand','mirror','kindle','combust','delay','siphon','stitch','compress','abyss'] as const satisfies readonly ContaminantType[];
export interface ContaminantIconPixels { readonly width: 24; readonly height: 24; readonly data: Uint8ClampedArray }
export interface ContaminantWorldPixels { readonly width: 32; readonly height: 32; readonly data: Uint8ClampedArray }
class Pixels {
  readonly cells: (Ink|undefined)[];
  constructor(readonly size:24|32=24) { this.cells=Array(size*size); }
  private coord(v:number) { return Math.round(v*this.size/24); }
  dot(x:number,y:number,c?:Ink) { const a=this.coord(x),b=this.coord(y),w=Math.max(1,this.coord(x+1)-a),h=Math.max(1,this.coord(y+1)-b);for(let j=b;j<b+h;j++)for(let i=a;i<a+w;i++){if(i<0||i>=this.size||j<0||j>=this.size)throw new Error('Contaminant object exceeds canvas');this.cells[j*this.size+i]=c;} }
  rect(x:number,y:number,w:number,h:number,c?:Ink) {for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.dot(i,j,c);}
  line(p:readonly Point[],c:Ink){for(let n=1;n<p.length;n++){let [x,y]=p[n-1]!;const [bx,by]=p[n]!;const dx=Math.abs(bx-x),sx=x<bx?1:-1,dy=-Math.abs(by-y),sy=y<by?1:-1;let e=dx+dy;for(;;){this.dot(x,y,c);if(x===bx&&y===by)break;const ee=2*e;if(ee>=dy){e+=dy;x+=sx;}if(ee<=dx){e+=dx;y+=sy;}}}}
  poly(points:readonly Point[],c:Ink){const p=points.map(([x,y])=>[this.coord(x),this.coord(y)] as const);for(let y=1;y<this.size-1;y++)for(let x=1;x<this.size-1;x++){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i]!,b=p[j]!;if((a[1]>y+.5)!==(b[1]>y+.5)&&x+.5<(b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])+a[0])inside=!inside;}if(inside)this.cells[y*this.size+x]=c;}}
}
const DRAW: Record<ContaminantType,(p:Pixels)=>void> = {
  // A locked mineral cleft: broad sheared base, one long splinter, cold internal seam.
  solidify:p=>{p.poly([[4,17],[7,7],[11,3],[14,9],[18,6],[21,16],[16,21],[7,20]],'d');p.poly([[7,16],[8,8],[11,4],[12,15],[10,19]],'l');p.poly([[13,12],[17,8],[18,17],[14,19]],'m');p.line([[11,5],[12,11],[10,15],[12,18]],'h');p.line([[14,9],[13,15],[15,18]],'g');p.line([[5,18],[9,20],[16,20]],'s');p.dot(14,14,'b');},
  // Hollow grinding jaw: heavy stony outer curve with opposed tooth fragments.
  ruminate:p=>{p.poly([[4,7],[8,3],[16,4],[20,8],[20,17],[16,21],[8,20],[3,15]],'d');p.poly([[5,8],[8,5],[14,5],[18,8],[16,10],[9,9],[6,14],[8,18],[5,16]],'m');p.poly([[9,11],[15,9],[18,12],[15,17],[9,17],[7,14]],'s');p.poly([[8,8],[10,8],[11,12],[9,13]],'l');p.poly([[14,7],[16,8],[14,12],[13,11]],'l');p.poly([[10,18],[10,15],[12,14],[13,18]],'l');p.line([[17,11],[17,15],[14,18]],'g');p.dot(15,16,'b');},
  // Three pieces of a broken lamina, separated by real transparent air.
  scatter:p=>{p.poly([[4,6],[11,3],[11,10],[7,13],[3,10]],'m');p.poly([[14,4],[20,8],[18,15],[13,12]],'d');p.poly([[8,15],[11,12],[16,16],[14,21],[6,20]],'m');p.line([[4,6],[9,4],[10,8]],'l');p.line([[15,5],[19,8],[17,10]],'l');p.line([[8,16],[10,14],[14,17]],'h');p.line([[7,11],[10,9]],'g');p.line([[14,19],[15,17]],'g');p.dot(20,18,'m');p.dot(3,15,'d');},
  // A bent memory ribbon doubled back upon itself; an incomplete physical coil.
  retrograde:p=>{p.line([[18,6],[13,3],[7,5],[4,10],[5,16],[10,20],[17,18],[20,13]],'d');p.line([[17,7],[13,5],[8,7],[6,11],[7,15],[11,18],[16,16],[17,12],[14,9],[10,10],[10,13],[13,14]],'m');p.line([[17,6],[13,4],[8,6],[5,11],[6,15],[10,19]],'l');p.line([[12,18],[16,16],[17,12]],'g');p.line([[10,11],[11,13],[13,13]],'b');p.rect(18,12,3,2,'d');p.dot(13,6,'s');},
  // Split time-amber, with a small suspended fragment caught between two shelves.
  delay:p=>{p.poly([[5,4],[18,3],[20,7],[15,10],[8,9],[4,7]],'m');p.poly([[8,15],[16,15],[20,20],[5,21],[3,18]],'d');p.poly([[7,16],[15,16],[18,19],[5,19]],'m');p.line([[5,4],[17,4],[19,6]],'l');p.line([[5,18],[9,16],[15,17]],'l');p.rect(10,11,3,2,'g');p.dot(11,10,'b');p.dot(11,14,'t');p.line([[16,7],[14,9]],'g');p.dot(18,18,'s');},
  // A siphoning root/hollow tube, with a bent intake and a knotted reservoir.
  siphon:p=>{p.poly([[5,3],[10,3],[11,8],[9,12],[10,16],[16,17],[17,13],[15,10],[17,7],[20,8],[20,16],[17,21],[9,20],[5,16],[6,10],[7,7]],'d');p.line([[6,4],[9,4],[9,8],[7,12],[8,17],[12,19],[16,19]],'l');p.line([[18,9],[18,15],[15,17],[11,17]],'g');p.rect(6,4,3,2,'s');p.dot(18,9,'b');p.line([[12,19],[11,21]],'m');},
  // Thin porous stone expanded around several large voids.
  expand:p=>{p.poly([[8,3],[16,4],[20,8],[20,15],[16,21],[7,20],[3,15],[4,8]],'m');p.poly([[9,6],[14,6],[16,9],[13,12],[8,10]],'s');p.poly([[9,6],[14,6],[14,9],[10,10]],'d');p.rect(10,7,3,3);p.rect(6,13,4,4);p.rect(14,13,4,5);p.rect(17,8,3,3);p.line([[8,4],[13,4],[15,6]],'l');p.line([[4,10],[4,14],[6,18]],'l');p.line([[11,13],[12,17],[11,20]],'g');p.dot(12,15,'b');},
  // Worn resonating fork, one tine broken short, a taut strand bridges its arms.
  resonate:p=>{p.poly([[4,4],[7,3],[8,12],[12,14],[16,11],[16,4],[19,5],[19,13],[14,18],[14,22],[10,22],[10,18],[5,15]],'d');p.line([[5,5],[6,12],[10,16],[12,17],[17,12],[17,5]],'l');p.line([[7,8],[16,8]],'t');p.line([[8,9],[15,9]],'g');p.dot(12,9,'b');p.rect(11,18,2,3,'m');p.dot(18,6,'s');},
  // Several overwritten slate leaves with misregistered corners and incised seams.
  overwrite:p=>{p.poly([[5,4],[17,3],[19,15],[8,18]],'d');p.poly([[3,8],[14,6],[18,18],[6,21]],'s');p.poly([[6,6],[19,6],[20,18],[8,20]],'m');p.line([[7,6],[18,6],[19,12]],'l');p.line([[9,9],[15,9],[15,12],[18,12]],'s');p.line([[8,14],[12,14],[12,17],[18,17]],'t');p.line([[12,14],[12,17],[15,17]],'g');p.dot(12,15,'b');p.dot(17,8,'d');},
  // Iron eaten from one edge, leaving a ragged porous comb.
  erode:p=>{p.poly([[5,4],[17,4],[20,7],[17,10],[20,12],[17,15],[18,18],[13,21],[5,18],[3,10]],'m');p.poly([[4,8],[8,5],[9,17],[6,19],[4,14]],'d');p.line([[6,4],[16,5],[18,7]],'l');p.rect(12,7,3,3,'s');p.rect(10,13,3,3,'s');p.rect(16,10,5,2);p.rect(15,16,5,2);p.line([[15,8],[15,11],[13,12],[14,15]],'g');p.dot(12,19,'t');p.dot(17,13,'b');},
  // A dense, folded muffling felt, blunt edges and quiet nested folds.
  muffle:p=>{p.poly([[5,5],[15,3],[20,8],[19,18],[10,21],[4,17],[3,10]],'d');p.poly([[5,8],[14,5],[17,8],[8,12],[8,18],[5,15]],'m');p.poly([[9,12],[18,9],[17,17],[10,19]],'s');p.line([[5,7],[13,4],[17,7]],'l');p.line([[9,14],[15,12],[15,16],[11,17]],'d');p.line([[5,12],[6,17],[9,19]],'t');p.dot(8,18,'g');p.dot(11,6,'d');},
  // One self-consuming charred splinter; its ember is teal, never an ordinary flame.
  kindle:p=>{p.poly([[10,2],[14,5],[13,9],[17,12],[16,18],[12,22],[7,19],[6,14],[9,10]],'d');p.poly([[10,5],[12,6],[11,12],[14,14],[12,19],[9,19],[8,15]],'m');p.line([[10,5],[10,10],[8,14]],'l');p.line([[11,11],[12,14],[10,17],[12,19]],'g');p.dot(12,15,'b');p.line([[14,17],[14,19],[12,21]],'s');p.dot(18,17,'d');p.dot(6,21,'m');},
  // Two unlike ceramic scraps forcibly held together by exposed crossing threads.
  stitch:p=>{p.poly([[4,5],[10,3],[11,18],[6,20],[3,13]],'m');p.poly([[15,5],[20,8],[19,19],[14,21],[13,11]],'d');p.line([[4,7],[8,4],[9,8]],'l');p.line([[16,6],[19,8],[18,14]],'l');for(const y of [8,12,16]){p.dot(9,y,'s');p.dot(15,y+1,'s');p.line([[9,y],[15,y+1]],y===12?'g':'l');}p.line([[11,7],[12,19]],'t');p.dot(12,13,'b');},
  // A squat, compressed lead weight, heavy stacked planes and an embedded loop.
  compress:p=>{p.line([[9,7],[9,4],[11,3],[14,4],[15,7]],'m');p.poly([[7,8],[16,7],[20,16],[18,20],[5,21],[3,17]],'d');p.poly([[7,8],[16,8],[18,12],[5,13]],'l');p.poly([[5,14],[19,13],[18,17],[5,18]],'m');p.line([[5,19],[17,18]],'s');p.line([[8,11],[13,11],[15,12]],'h');p.line([[9,14],[13,14],[14,17]],'g');p.dot(13,15,'b');},
  // A jagged mirrored shard with a chipped backing and one broad reflected plane.
  mirror:p=>{p.poly([[6,6],[15,2],[20,8],[16,12],[18,17],[10,22],[4,17],[6,13],[3,10]],'d');p.poly([[7,6],[14,4],[17,8],[14,11],[15,16],[10,19],[7,15]],'m');p.poly([[8,7],[14,5],[12,10],[9,13],[7,12]],'h');p.line([[7,14],[10,17],[14,14]],'l');p.line([[14,7],[12,12],[14,14]],'t');p.dot(12,11,'g');p.line([[5,17],[10,21],[16,17]],'s');},
  // Fossil resonance shell: a large open mouth with diminishing mineral ribs.
  echo:p=>{p.poly([[5,7],[11,3],[17,5],[21,11],[19,18],[12,21],[6,18],[3,12]],'d');p.poly([[6,8],[11,5],[16,7],[18,12],[16,17],[11,18],[7,15]],'m');p.line([[5,10],[6,7],[11,4],[17,6],[20,11]],'l');p.line([[8,9],[11,7],[15,9],[16,13],[13,16],[10,15]],'l');p.line([[10,10],[13,10],[14,12],[12,13]],'t');p.dot(13,11,'b');p.poly([[4,12],[7,13],[9,18],[6,18]],'s');p.line([[17,15],[16,18],[12,20]],'g');},
  // An irregular hollow nodule: the void is real transparent negative space.
  abyss:p=>{p.poly([[8,3],[16,4],[20,9],[21,15],[16,20],[9,22],[3,16],[4,8]],'d');p.poly([[8,5],[15,5],[18,9],[17,15],[13,19],[8,18],[5,13]],'m');p.poly([[10,7],[14,7],[17,11],[15,16],[11,18],[7,14],[8,10]],'s');p.rect(10,9,4,7);p.rect(8,11,8,3);p.line([[9,6],[15,6],[18,10]],'l');p.line([[7,15],[10,18],[14,17]],'g');p.dot(14,16,'b');p.dot(18,17,'s');},
  // Collapsed ash cup with brittle radiating ribs and a submerged cold ember.
  combust:p=>{p.poly([[3,11],[7,7],[9,3],[12,8],[18,5],[18,10],[22,13],[18,19],[9,21],[4,17]],'d');p.poly([[5,13],[10,9],[16,10],[19,14],[16,18],[10,19]],'m');p.poly([[8,12],[13,10],[17,13],[15,17],[10,17]],'s');p.line([[5,12],[9,9],[8,5]],'l');p.line([[13,9],[17,7],[16,11]],'m');p.line([[6,16],[10,19],[16,18],[19,14]],'l');p.line([[10,14],[12,12],[15,13],[13,16]],'g');p.dot(12,14,'b');p.dot(20,20,'m');p.dot(4,20,'d');},
};

/** The material survives every quality. Higher quality preserves a more complete
 * impossible structure: repeated edge, trapped interval, returning fold. No badges. */
const SAMPLE_DRAW: Partial<Record<ContaminantType,(p:Pixels,q:number)=>void>> = {
  solidify(p,q) {
    // A broken piece of cast stone; its falling shear remains attached out of alignment.
    p.poly([[5,8],[9,5],[15,6],[18,9],[17,17],[13,20],[5,18],[3,14]],'d');
    p.poly([[5,8],[9,6],[15,7],[17,10],[12,12],[4,11]],'l');
    p.poly([[4,12],[12,13],[13,19],[6,17]],'m');
    p.line([[13,13],[17,11],[16,16],[13,19]],'s');
    p.line([[6,9],[9,8],[13,9]],'h');
    p.dot(7,14,'d');p.dot(9,17,'l');p.dot(15,15,'m');
    p.line([[7,12],[10,13],[10,15]],'t');
    p.dot(10,13,'g');
    if(q>=1){p.rect(4,12,13,1);p.line([[5,13],[10,14],[12,13]],'g');p.poly([[18,12],[20,11],[21,15],[18,17]],'m');}
    if(q>=2){p.poly([[7,3],[13,3],[16,5],[11,7],[6,6]],'m');p.line([[7,3],[12,3],[14,4]],'h');p.rect(5,16,8,1);p.line([[6,17],[10,18]],'g');}
    if(q>=3){p.poly([[15,3],[18,4],[19,7],[17,8],[15,6]],'l');p.line([[17,5],[18,6]],'g');p.rect(9,10,1,2);p.dot(9,12,'b');p.poly([[3,18],[7,20],[6,22],[3,20]],'m');}
  },
  scatter(p,q) {
    // Thin laminated roofing: one silhouette is trying to occupy several nearby places.
    const shift=q>=2?2:1;
    p.poly([[6+shift,5],[17+shift,6],[20,13],[15+shift,19],[6+shift,17]],'s');
    if(q>=1)p.line([[9,4],[18,5],[20,12],[18,17]],'t');
    if(q>=2)p.line([[10,2],[20,4],[21,11]],'g');
    p.poly([[4,7],[13,4],[17,8],[16,17],[9,20],[4,16]],'d');
    p.poly([[5,7],[12,5],[15,8],[10,12],[5,12]],'l');
    p.poly([[5,13],[10,13],[15,10],[14,16],[9,18],[5,16]],'m');
    p.line([[5,8],[11,6],[14,8]],'h');
    p.line([[7,14],[11,15],[14,13]],'s');
    p.line([[6,10],[9,9]],'m');p.dot(7,16,'l');
    p.line([[15,10],[15,16],[10,19]],'g');
    if(q>=1){p.line([[17,10],[17,17],[12,20]],'m');p.dot(13,19,'b');}
    if(q>=3){p.line([[2,8],[2,16],[7,21],[12,21]],'m');p.line([[19,13],[19,18],[15,21]],'g');p.rect(6,11,8,1);}
  },
  retrograde(p,q) {
    // An abraded threshold plate. Repeated depressions are footprints, never writing/runes.
    p.poly([[9,3],[15,4],[18,8],[14,20],[8,22],[5,17]],'s');
    p.poly([[9,3],[14,4],[16,8],[12,19],[8,20],[6,17]],'m');
    p.line([[9,4],[7,12],[7,17],[9,19]],'l');
    p.line([[10,5],[13,6],[14,8]],'h');
    p.poly([[10,8],[12,7],[13,9],[11,12],[9,11]],'d');
    p.rect(9,13,2,3,'s');p.dot(11,13,'t');p.dot(9,16,'g');
    if(q>=1){p.poly([[13,13],[15,12],[15,15],[13,18],[12,17]],'t');p.line([[14,13],[13,15]],'g');}
    if(q>=2){p.poly([[17,4],[19,5],[20,8],[17,12],[15,12],[17,8]],'d');p.line([[17,5],[18,7],[16,10]],'l');p.line([[8,18],[11,18]],'g');}
    if(q>=3){p.line([[5,10],[4,15],[5,19],[7,21]],'m');p.rect(8,11,7,1);p.line([[9,12],[11,13],[13,12]],'g');p.dot(13,8,'b');}
  },
  muffle(p,q) {
    // Frayed cloth, folded into a throat that contains an extra fold where no space remains.
    p.poly([[5,6],[14,4],[19,9],[17,17],[20,20],[12,21],[7,19],[3,20],[5,13]],'d');
    p.poly([[5,7],[13,5],[17,8],[10,11],[7,16],[4,18]],'m');
    p.line([[6,7],[12,5],[16,7]],'l');
    p.poly([[10,12],[18,9],[16,16],[13,18],[8,18]],'s');
    p.line([[7,12],[7,17],[11,20],[16,19]],'m');
    p.line([[10,13],[14,12],[13,15]],'d');
    p.line([[6,9],[8,8]],'d');p.dot(9,7,'m');p.dot(10,6,'d');p.line([[5,15],[6,13]],'l');
    p.line([[5,16],[4,20]],'l');p.dot(7,21,'d');p.dot(17,21,'m');
    if(q>=1){p.line([[10,14],[13,13],[15,14],[13,17],[10,18]],'t');p.dot(12,17,'g');}
    if(q>=2){p.poly([[16,4],[20,6],[21,11],[19,14],[18,12],[19,8]],'m');p.line([[18,6],[20,9],[19,11]],'l');p.line([[9,15],[10,17],[12,18]],'g');}
    if(q>=3){p.poly([[3,8],[4,4],[8,3],[7,6],[5,8]],'d');p.line([[4,5],[7,4]],'l');p.line([[11,11],[15,10],[16,12],[14,16]],'g');p.dot(14,11,'b');}
  },
  expand(p,q) {
    // A split river stone with an absent bite; a narrow rear bridge defies the missing volume.
    p.poly([[7,4],[14,3],[19,7],[21,13],[18,19],[10,21],[4,17],[3,10]],'d');
    p.poly([[7,5],[14,4],[18,7],[15,10],[9,10],[5,13],[4,10]],'l');
    p.poly([[5,14],[9,16],[15,16],[19,13],[17,18],[10,19],[5,16]],'m');
    p.rect(3,11,13,3);p.rect(3,14,7,1);
    p.line([[9,10],[14,9],[18,10],[18,14],[15,16]],'s');
    p.line([[10,15],[15,15],[16,13]],'t');p.dot(15,14,'g');
    if(q>=1){p.rect(3,10,8,1);p.line([[5,9],[8,8]],'h');p.line([[10,16],[14,17],[17,15]],'g');}
    if(q>=2){p.rect(16,11,2,3);p.line([[19,9],[20,12],[18,16]],'l');p.poly([[4,18],[7,20],[7,22],[3,20]],'m');}
    if(q>=3){p.rect(9,4,1,5);p.poly([[7,2],[10,2],[10,3],[6,4]],'m');p.line([[11,5],[13,5]],'h');p.dot(16,15,'b');p.line([[7,16],[8,18]],'g');}
  },
  mirror(p,q) {
    // A salvaged window shard, carrying a reflection separated from its chipped backing.
    p.poly([[5,8],[13,3],[18,5],[17,10],[20,15],[12,21],[6,18],[7,13]],'s');
    p.poly([[6,8],[13,4],[16,6],[15,11],[18,15],[12,19],[8,17],[9,12]],'d');
    p.poly([[7,8],[12,5],[14,6],[11,11],[8,12]],'l');
    p.line([[8,8],[12,6]],'h');
    p.line([[8,10],[13,7]],'m');p.line([[13,5],[15,6],[14,10]],'l');
    p.poly([[11,12],[14,10],[16,14],[13,17],[10,16]],'m');
    p.line([[10,14],[12,12],[13,13],[13,16]],'t');
    p.line([[11,16],[14,14]],'l');p.dot(13,15,'h');
    if(q>=1){p.line([[12,9],[14,8],[15,10],[14,13]],'g');p.line([[8,17],[11,19],[14,17]],'l');}
    if(q>=2){p.poly([[17,3],[20,5],[21,11],[19,13],[18,10],[19,6]],'m');p.line([[19,5],[20,8]],'l');p.line([[12,13],[14,12],[15,15]],'g');}
    if(q>=3){p.line([[3,8],[4,14],[3,16],[8,20]],'m');p.line([[5,8],[6,12]],'g');p.rect(8,10,8,1);p.dot(14,14,'b');p.line([[11,18],[14,19],[16,17]],'t');}
  },
  kindle(p,q) {
    // An empty shell laid on its side: flared mouth left, thick ribbed back right.
    // The mouth opens through the silhouette rather than reading as an eye in a stone.
    p.poly([[3,12],[7,8],[12,5],[17,4],[21,8],[21,12],[18,15],[14,18],[8,21],[3,19]],'d');
    p.poly([[8,9],[12,6],[17,5],[19,8],[16,12],[10,15],[5,17],[4,14]],'m');
    p.line([[8,9],[12,6],[17,5],[19,7]],'l');
    p.poly([[3,13],[7,11],[11,12],[12,15],[9,19],[4,20],[3,18]],'s');
    p.poly([[4,14],[7,13],[9,14],[9,17],[6,19],[4,18]],'d');
    p.line([[3,12],[6,11],[9,11],[11,13],[11,16],[8,20],[4,20]],'l');
    p.line([[5,12],[7,12]],'h');
    p.line([[12,8],[15,8],[17,10],[16,13]],'d');
    p.line([[12,9],[14,9],[15,11]],'l');
    p.line([[17,7],[19,9],[18,12]],'l');
    p.line([[6,16],[8,15],[8,17]],'t');
    if(q>=1){p.line([[6,14],[8,14],[9,16],[7,18]],'g');p.line([[13,14],[16,12],[18,13]],'m');}
    if(q>=2){p.poly([[18,2],[21,4],[22,8],[20,10],[20,6],[17,4]],'d');p.line([[19,3],[21,6]],'l');p.line([[12,16],[15,15],[17,12]],'g');}
    if(q>=3){p.poly([[2,10],[5,8],[9,7],[8,9],[4,11],[2,14]],'m');p.line([[3,10],[6,8]],'l');p.line([[5,15],[7,14],[9,15],[8,18],[6,19]],'g');p.dot(7,16,'b');p.rect(13,9,1,3);}
  },
  combust(p,q) {
    // Dense cinder, not a vessel. A branching buried seam presses against broken plates.
    p.poly([[4,10],[9,5],[15,6],[19,10],[18,17],[14,20],[6,19],[3,15]],'s');
    p.poly([[5,10],[9,6],[14,7],[16,10],[12,12],[7,12]],'m');
    p.poly([[5,13],[11,12],[16,10],[17,15],[13,18],[7,17]],'d');
    p.line([[6,9],[9,6],[13,7]],'l');
    p.line([[6,14],[8,17],[12,18]],'m');
    p.dot(8,8,'d');p.dot(11,9,'d');p.dot(15,13,'m');
    p.line([[8,11],[10,12],[10,15],[13,17]],'s');
    p.line([[10,13],[13,12],[15,10]],'t');
    p.line([[10,13],[10,15],[12,16]],'g');
    if(q>=1){p.poly([[15,5],[18,6],[20,10],[18,12],[17,8]],'d');p.line([[17,6],[19,9]],'m');p.line([[9,12],[10,13],[13,12]],'g');p.rect(8,18,5,1);}
    if(q>=2){p.poly([[4,7],[7,4],[11,3],[12,5],[8,6],[6,10]],'d');p.line([[5,7],[8,4],[10,4]],'l');p.line([[11,12],[12,14],[15,15]],'g');p.dot(11,13,'b');}
    if(q>=3){p.poly([[18,14],[21,13],[21,17],[18,21],[13,22],[16,19]],'d');p.line([[20,15],[19,18],[17,20]],'l');p.line([[8,10],[10,11],[13,10],[15,11]],'g');p.rect(4,12,4,1);}
  },
  delay(p,q) {
    // A torn grain pouch, cinched at the top. The spill hangs BELOW its real broken mouth.
    // Vertical cloth + isolated grains distinguish it from a stone / hourglass emblem.
    p.poly([[8,3],[12,2],[15,4],[14,7],[17,11],[16,15],[12,16],[7,14],[5,10],[8,6]],'d');
    p.poly([[8,4],[11,3],[12,6],[9,9],[8,13],[6,10]],'m');
    p.poly([[11,8],[14,7],[16,11],[14,13],[10,13]],'m');
    p.line([[8,4],[10,3],[13,4]],'l');
    p.line([[7,9],[8,7]],'l');p.line([[10,7],[13,6]],'s');
    p.poly([[8,12],[12,13],[15,11],[14,15],[11,14],[9,16],[7,14]],'s');
    p.line([[8,13],[10,14]],'l');p.dot(14,13,'l');
    p.dot(10,17,'m');p.dot(13,19,'l');p.dot(8,20,'d');p.rect(10,21,2,1,'m');
    p.dot(11,16,'t');
    if(q>=1){p.rect(11,12,1,3);p.line([[15,9],[16,11],[15,14]],'t');p.dot(10,17,'g');p.dot(15,18,'m');p.dot(11,19,'l');}
    if(q>=2){p.poly([[17,8],[19,10],[18,14],[16,16],[17,12]],'d');p.line([[18,10],[18,12]],'l');p.dot(7,17,'l');p.dot(14,21,'g');p.line([[11,4],[12,5]],'h');}
    if(q>=3){p.line([[5,7],[4,10],[6,13]],'m');p.rect(7,10,2,1);p.dot(12,18,'b');p.dot(17,20,'m');p.dot(8,18,'g');p.rect(13,8,1,2);p.line([[14,7],[16,8]],'l');}
  },
  siphon(p,q) {
    // A discarded clinging shell: skewed ribbed back right, a concave grip opening left.
    // There is no central eye, vessel mouth or regular radial shell pattern.
    p.poly([[11,3],[16,4],[20,8],[21,14],[18,19],[12,21],[8,19],[7,16],[10,17],[14,16],[15,12],[13,8],[8,7]],'d');
    p.poly([[11,4],[15,5],[18,8],[18,13],[15,18],[11,19],[9,17],[13,17],[15,13],[13,8],[9,6]],'m');
    p.line([[11,4],[14,5],[17,8]],'l');
    p.line([[16,7],[18,10],[18,13],[16,16]],'l');
    p.line([[16,11],[19,11]],'s');p.line([[15,15],[18,16]],'s');
    p.line([[13,8],[14,11],[13,15]],'s');
    p.poly([[7,7],[11,6],[13,8],[11,9],[8,9],[5,12],[4,10]],'m');
    p.line([[7,7],[10,7]],'l');
    p.line([[12,17],[9,16],[6,17],[5,19]],'m');
    p.line([[12,15],[11,16],[8,15]],'t');p.dot(11,16,'g');
    if(q>=1){p.line([[8,10],[7,12],[8,14],[11,14]],'d');p.line([[9,10],[8,12],[10,13]],'g');p.line([[5,18],[7,18]],'l');}
    if(q>=2){p.poly([[18,3],[21,6],[22,10],[20,10],[19,6],[16,4]],'d');p.line([[19,4],[21,7]],'m');p.rect(16,13,3,1);p.line([[16,14],[18,15]],'g');}
    if(q>=3){p.poly([[10,2],[13,2],[14,3],[10,4],[7,6],[5,6]],'m');p.line([[7,5],[9,3]],'l');p.line([[6,12],[6,14],[8,15]],'l');p.rect(12,18,3,1);p.dot(10,13,'b');}
  },
  stitch(p,q) {
    // A slanting hank with two loose ends, not four radiating limbs. Wide overlapping
    // thread faces make the over/under knot readable at 24px without an insect silhouette.
    p.poly([[7,3],[11,4],[15,9],[16,14],[13,18],[8,17],[5,13],[6,9],[8,7],[5,5]],'d');
    p.line([[7,4],[10,5],[13,9],[14,13],[12,16],[9,15],[7,12],[8,9],[10,8]],'m');
    p.line([[7,4],[10,5],[12,8]],'l');
    p.line([[6,9],[5,12],[8,16],[12,18],[15,15],[15,11],[12,8]],'m');
    p.line([[6,10],[6,12],[8,15],[10,16]],'l');
    p.line([[10,9],[8,11],[9,13],[12,14],[14,12]],'s');
    p.line([[10,10],[9,11],[10,13],[12,13]],'l');p.dot(10,11,'h');
    p.line([[12,14],[15,17],[17,21]],'d');
    p.line([[12,15],[14,17],[16,21]],'m');p.line([[14,18],[15,20]],'l');
    p.line([[8,16],[8,17],[10,18]],'m');p.line([[8,17],[9,18]],'l');
    p.line([[11,15],[12,16]],'t');
    if(q>=1){p.line([[13,9],[16,9],[18,12],[17,15],[14,16]],'d');p.line([[15,10],[17,12],[16,14]],'m');p.line([[10,15],[12,16],[14,14]],'g');p.rect(12,8,1,1);}
    if(q>=2){p.line([[4,8],[3,11],[4,14],[6,16]],'m');p.line([[4,9],[4,12],[5,14]],'l');p.rect(7,15,1,1);p.line([[7,16],[8,17]],'g');}
    if(q>=3){p.line([[13,3],[15,5],[15,7]],'d');p.line([[13,4],[14,5],[14,6]],'l');p.rect(14,11,2,1);p.line([[15,12],[14,14]],'g');p.dot(12,13,'b');p.line([[18,15],[19,18],[20,19]],'m');}
  },
  compress(p,q) {
    // Thick off-centre stone with a lower face pulled downward. No broad cap or floating cone.
    p.poly([[7,5],[12,3],[17,6],[18,12],[16,19],[12,22],[7,19],[5,13],[4,8]],'s');
    p.poly([[7,5],[12,4],[16,6],[15,9],[9,10],[5,8]],'m');
    p.poly([[5,9],[9,11],[15,10],[16,15],[13,20],[9,18],[7,14]],'d');
    p.poly([[6,10],[9,11],[10,17],[8,17],[6,13]],'m');
    p.line([[7,5],[11,4],[14,5]],'l');p.line([[7,7],[10,6],[12,7]],'h');
    p.line([[14,10],[14,14],[12,18],[12,21]],'s');
    p.line([[10,12],[11,15],[11,19]],'t');p.dot(11,16,'g');
    p.dot(8,12,'d');p.dot(14,12,'m');
    if(q>=1){p.line([[15,13],[14,18],[13,21]],'m');p.rect(10,19,1,2);p.line([[11,14],[12,17],[12,20]],'g');}
    if(q>=2){p.poly([[3,11],[5,12],[7,17],[6,20],[4,18]],'d');p.line([[4,13],[5,16],[5,18]],'l');p.rect(8,9,3,1);p.line([[11,10],[13,10]],'g');}
    if(q>=3){p.poly([[18,10],[20,12],[19,16],[17,20],[16,21],[17,16]],'d');p.line([[19,12],[18,16],[17,18]],'m');p.rect(12,6,1,2);p.dot(12,18,'b');p.line([[14,17],[14,20]],'g');}
  },
  abyss(p,q) {
    // A small dull bead eclipsed from BEHIND by an incomplete thick shutter.
    // Single material hemisphere + offset black crescent, never concentric pupil/iris.
    p.poly([[10,4],[16,4],[20,8],[21,14],[17,19],[11,20],[8,17],[14,17],[17,13],[17,9],[13,6],[8,7]],'s');
    p.line([[12,4],[16,5],[19,8],[20,12]],'d');
    p.poly([[6,8],[10,6],[14,8],[16,12],[14,16],[10,18],[6,16],[4,12]],'d');
    p.poly([[6,8],[10,7],[13,9],[13,12],[10,13],[6,12]],'m');
    p.line([[6,9],[8,7],[11,8]],'l');p.dot(8,8,'h');
    p.poly([[12,10],[16,11],[15,15],[11,17],[8,16],[12,14]],'s');
    p.line([[14,8],[15,10],[15,12]],'t');
    p.line([[6,14],[8,16],[10,17]],'m');
    if(q>=1){p.line([[17,7],[18,10],[18,13],[16,16]],'t');p.line([[17,11],[17,14]],'g');p.rect(10,16,2,1);}
    if(q>=2){p.poly([[7,4],[11,3],[15,3],[17,4],[13,5],[9,5],[6,7]],'d');p.line([[9,4],[13,4]],'m');p.rect(18,12,3,1);p.line([[18,14],[16,17]],'m');}
    if(q>=3){p.poly([[3,15],[6,18],[10,20],[8,22],[4,20],[2,17]],'d');p.line([[4,17],[6,19],[8,20]],'m');p.rect(13,5,1,3);p.line([[13,8],[14,10]],'g');p.dot(14,11,'b');}
  },
};
const pixelsCache = new Map<string,Pixels>();
function grid(type:ContaminantType,quality:ContaminantArtQuality='ordinary',size:24|32=24):Pixels {
  const key=`${type}:${quality}:${size}`;
  let p=pixelsCache.get(key);
  if(!p){p=new Pixels(size);const sample=SAMPLE_DRAW[type];if(sample)sample(p,CONTAMINANT_ART_QUALITIES.indexOf(quality));else DRAW[type](p);pixelsCache.set(key,p);}
  return p;
}
function rgba(p:Pixels):Uint8ClampedArray {
  const data=new Uint8ClampedArray(p.size*p.size*4);
  p.cells.forEach((ink,index)=>{if(!ink)return;const rgb=Number.parseInt(PALETTE[ink].slice(1),16);data[index*4]=rgb>>16;data[index*4+1]=(rgb>>8)&255;data[index*4+2]=rgb&255;data[index*4+3]=255;});
  return data;
}
export function contaminantIconPixels(type:ContaminantType,quality:ContaminantArtQuality='ordinary'):ContaminantIconPixels {
  return {width:24,height:24,data:rgba(grid(type,quality))};
}
/** Native geometric rasterization at 32px; never enlarges the 24px image. */
export function contaminantWorldPixels(type:ContaminantType,quality:ContaminantArtQuality='ordinary'):ContaminantWorldPixels {
  return {width:32,height:32,data:rgba(grid(type,quality,32))};
}
export function contaminantIconSvg(type:ContaminantType,quality:ContaminantArtQuality='ordinary'):string {
  const cells=grid(type,quality).cells;let rects='';
  for(let y=0;y<24;y++)for(let x=0;x<24;){const ink=cells[y*24+x];if(!ink){x++;continue;}let end=x+1;while(end<24&&cells[y*24+end]===ink)end++;rects+=`<rect x="${x}" y="${y}" width="${end-x}" height="1" fill="${PALETTE[ink]}"/>`;x=end;}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" shape-rendering="crispEdges">${rects}</svg>`;
}
const urlCache=new Map<string,string>();
export function contaminantIconUrl(type:ContaminantType,quality:ContaminantArtQuality='ordinary'):string {
  const key=`${type}:${quality}`;let url=urlCache.get(key);if(!url){url=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(contaminantIconSvg(type,quality))}`;urlCache.set(key,url);}return url;
}
