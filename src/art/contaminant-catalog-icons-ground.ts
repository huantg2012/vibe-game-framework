import { MAT as M, PixelCanvas, type ObjectPainter, type CatalogPixels } from './contaminant-catalog-icons-pixels';

/** Eight independently authored 16px models used by real thrown / placed abilities. */
const GROUND:Readonly<Record<string,ObjectPainter>>={
  split_tongue_bell(p){p.rect(7,2,2,3,M.brass[2]);p.poly([[5,5],[10,5],[11,9],[14,12],[3,13],[4,9]],M.brass[1]);p.poly([[5,6],[8,5],[8,10],[4,11]],M.brass[2]);p.ellipse(3,10,11,4,M.brass[0]);p.line([[3,11],[6,10],[12,10]],M.brass[3]);p.rect(8,10,2,3,M.iron[1]);p.dot(7,13,M.iron[2]);},
  crooked_clay_whistle(p){p.line([[5,8],[3,5],[4,2]],M.ceramic[2],2);p.poly([[5,5],[10,4],[14,8],[13,12],[7,14],[3,10]],M.leather[1]);p.poly([[6,5],[10,5],[12,8],[8,10],[4,9]],M.ceramic[2]);p.ellipse(9,9,3,3,M.ink);p.line([[5,10],[7,12],[10,12]],M.leather[2]);},
  missing_tooth_music_box(p){p.poly([[3,3],[11,2],[12,6],[4,7]],M.wood[2]);p.poly([[2,8],[11,6],[13,9],[12,13],[4,14],[2,12]],M.wood[0]);p.poly([[3,8],[11,7],[12,10],[4,11]],M.wood[1]);p.rect(5,8,6,2,M.iron[0]);p.line([[5,8],[6,8]],M.iron[3]);p.line([[9,8],[10,8]],M.iron[2]);p.line([[12,10],[14,10],[14,7]],M.brass[2]);},
  hollow_reed_joint(p){p.poly([[3,4],[6,2],[13,10],[11,14],[8,13]],M.wood[1]);p.line([[4,4],[10,11]],M.wood[3],2);p.ellipse(8,10,5,4,M.wood[0]);p.ellipse(9,11,3,2);p.line([[5,7],[7,5]],M.wood[0]);},
  lead_type_stamp(p){p.poly([[5,3],[9,2],[11,5],[10,8],[8,8],[9,5],[6,5],[6,8],[4,8],[4,5]],M.iron[2]);p.poly([[3,8],[11,7],[14,10],[12,14],[3,13],[2,10]],M.iron[0]);p.poly([[3,8],[11,8],[12,10],[4,11]],M.iron[2]);p.line([[4,12],[8,12],[10,11]],M.iron[1]);},
  broken_eye_scale_weight(p){p.line([[6,5],[6,2],[9,2]],M.iron[2],2);p.poly([[5,5],[9,5],[13,11],[11,14],[4,14],[2,10]],M.iron[0]);p.poly([[5,6],[7,5],[8,12],[4,12],[3,10]],M.iron[2]);p.line([[9,7],[11,10],[10,12]],M.iron[1]);},
  waterlogged_spine(p){p.poly([[2,7],[4,3],[7,4],[7,7],[10,6],[13,8],[13,12],[10,14],[8,12],[5,12],[4,10],[2,11]],M.bone[0]);p.poly([[3,6],[5,4],[7,5],[6,8],[3,8]],M.bone[2]);p.poly([[6,9],[8,7],[11,8],[10,11],[7,12]],M.bone[2]);p.poly([[10,10],[13,9],[12,12],[10,13]],M.bone[1]);p.dot(5,6,M.ink);p.rect(8,9,2,1,M.ink);},
  sunken_inkstone(p){p.poly([[3,3],[12,5],[13,12],[5,14],[2,10]],M.plum[0]);p.poly([[4,4],[11,5],[11,10],[5,12],[3,9]],M.plum[2]);p.poly([[5,6],[10,6],[9,10],[5,10]],M.ink);p.line([[4,4],[9,5]],M.plum[3]);p.line([[5,12],[11,10]],M.plum[1]);},
};
export const CATALOG_GROUND_IDS=Object.freeze(Object.keys(GROUND));
const cache=new Map<string,CatalogPixels>();
export function paintCatalogGround(definitionId:string):CatalogPixels|undefined {
  const painter=GROUND[definitionId];if(!painter)return undefined;
  let result=cache.get(definitionId);if(!result){const p=new PixelCanvas(16);painter(p);result=p.pixels();cache.set(definitionId,result);}return result;
}
