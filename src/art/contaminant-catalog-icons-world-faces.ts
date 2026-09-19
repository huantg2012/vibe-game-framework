import { MAT, PixelCanvas, type Point } from './contaminant-catalog-icons-pixels';

type Material = Exclude<keyof typeof MAT,'ink'|'seam'>;
type Facet = { material:Material; light:readonly Point[]; shade:readonly Point[] };
const box=(x:number,y:number,w:number,h:number):readonly Point[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const facet=(material:Material,light:readonly Point[],shade:readonly Point[]):Facet=>({material,light,shade});
/** Authored ground-model planes. These coordinates describe parts, not an edge
 * detector: the lit plane may reach the silhouette, but no contour is traced.
 * Opaque material pixels only; holes, silhouette, and foreign detail materials
 * stay intact. UI24 and ability16 have their own drawings and are unchanged.
 */
const FACES:Readonly<Record<string,readonly Facet[]>>={
 amber_beetle:[facet('amber',[[3,5],[20,3],[18,12],[5,19]],[[17,17],[29,12],[28,29],[12,29]])],
 stopped_pocket_watch:[facet('brass',box(3,7,10,14),box(18,13,12,16))],
 sealed_hourglass:[facet('wood',box(5,4,6,22),box(19,8,8,21))],
 brass_monocle:[facet('brass',box(3,3,13,16),box(16,13,12,16))],
 milky_fish_eye:[facet('bone',box(2,4,13,16),[[19,17],[30,16],[26,28],[9,29],[9,23]])],
 doorless_lantern:[facet('iron',box(7,9,6,20),box(20,12,7,18))],
 wax_sealed_button:[facet('wax',box(2,4,15,15),[[19,9],[29,10],[28,28],[5,29],[6,22],[19,23]])],
 double_hole_token:[facet('iron',box(7,2,12,8),box(17,18,8,12))],
 split_tongue_bell:[facet('brass',[[7,8],[17,8],[14,18],[6,25]],box(19,13,10,16))],
 crooked_clay_whistle:[facet('leather',[[4,10],[20,7],[21,13],[11,17],[8,23],[3,20]],box(20,14,9,15))],
 missing_tooth_music_box:[facet('wood',box(3,16,8,14),box(19,19,10,11))],
 lead_type_stamp:[facet('iron',box(2,13,11,14),box(20,18,9,11))],
 broken_eye_scale_weight:[facet('iron',[[9,8],[15,8],[13,21],[8,25],[3,24],[7,15]],box(18,17,11,12)),facet('iron',box(9,2,10,7),box(24,18,5,10))],
 waterlogged_spine:[facet('bone',box(3,4,12,14),[[18,14],[29,20],[28,30],[12,30],[12,22]])],
 silver_back_hand_mirror:[facet('iron',box(3,3,10,21),box(18,17,10,13))],
 empty_photo_frame:[facet('wood',box(4,3,6,23),box(19,10,10,19))],
 inverted_face_mask:[facet('bone',box(5,3,10,16),[[21,8],[28,9],[25,23],[18,30],[9,26],[13,22]])],
 blind_needle_compass:[facet('brass',box(2,12,10,16),box(20,14,10,15))],
 creased_negative:[facet('leather',box(4,3,9,20),box(17,16,12,14))],
 one_eyed_puppet_head:[facet('wood',box(4,3,9,22),box(21,13,8,16))],
 cold_ash_pipe:[facet('wood',box(15,9,7,20),box(23,17,7,13))],
 ceramic_charcoal_box:[facet('ceramic',box(3,13,9,17),box(21,17,10,13))],
 frosted_furnace_core:[facet('iron',box(4,4,8,22),box(19,17,9,13))],
 sealed_flower_calyx:[facet('ceramic',[[3,7],[9,3],[15,9],[13,22],[6,23]],box(20,11,10,18))],
 split_porcelain_spoon:[facet('bone',box(9,12,7,14),[[23,12],[29,18],[28,29],[16,30],[17,24]])],
 salted_vial:[facet('glass',box(7,10,6,19),box(20,15,8,14))],
 bone_clasp_mask:[facet('cloth',box(4,6,10,18),box(19,11,8,16))],
 lead_fastened_breastplate:[facet('iron',box(5,4,8,21),box(19,15,8,13))],
 split_heel_boot:[facet('leather',box(5,2,10,21),box(21,18,9,12))],
 coiled_tape_measure:[facet('brass',box(2,4,11,17),box(17,16,10,12))],
 hollow_loom_shuttle:[facet('wood',[[1,17],[10,8],[23,3],[20,10],[7,23]],box(17,13,12,16))],
 gray_felt_glove:[facet('cloth',box(6,2,12,22),box(18,16,11,14))],
 scorched_scarf:[facet('plum',box(3,2,13,23),box(18,15,9,15))],
 unlined_coat:[facet('leather',box(4,4,9,20),box(20,11,10,18))],
 crooked_hook_needle:[facet('iron',box(8,2,14,25),box(21,3,8,11)),facet('paper',box(3,10,7,13),box(12,17,10,10))],
 wooden_thread_spool:[facet('wood',box(2,5,11,24),box(20,5,10,19))],
 double_clasp_strap:[facet('leather',box(4,10,8,17),box(21,10,8,17)),facet('brass',box(3,2,8,11),box(23,2,8,13))],
 brass_back_buckle:[facet('brass',box(2,7,12,18),box(21,11,9,16))],
 wrinkled_bottom_satchel:[facet('leather',box(2,8,12,19),box(22,12,8,16))],
 reverse_woven_basket:[facet('wood',box(3,11,9,17),box(22,16,8,14))],
 clouded_lens:[facet('glass',box(4,4,11,21),box(19,15,10,14))],
 ceramic_capsule:[facet('ceramic',box(2,6,10,20),box(18,16,11,12)),facet('bone',box(17,7,6,10),box(21,15,8,13))],
 hollow_reed_joint:[facet('wood',[[3,4],[13,2],[20,12],[15,17],[5,13]],box(18,19,11,11))],
 sunken_inkstone:[facet('plum',box(2,3,12,24),box(21,14,8,17))],
 hollow_eyelet:[facet('brass',box(5,3,12,24),box(18,14,11,15))],
 ash_tooth:[facet('bone',box(4,3,10,21),[[18,13],[27,14],[20,25],[15,31],[9,23]])],
 creased_ticket_wallet:[facet('leather',box(3,6,9,20),box(22,4,8,24))],
 paper_spiral:[facet('paper',box(3,4,9,24),box(21,12,8,17))],
 'shell:wax_parcel':[facet('wax',box(2,4,12,20),[[21,8],[29,12],[27,27],[14,30],[11,25],[20,22]])],
 'shell:resin_nodule':[facet('amber',box(2,3,14,21),box(19,14,10,15))],
 'shell:ash_cocoon':[facet('cloth',box(4,6,12,19),box(20,14,10,15))],
 'shell:layered_hide':[facet('leather',box(3,6,12,18),box(20,11,10,17))],
 'shell:ceramic_seal':[facet('ceramic',box(3,4,11,21),box(21,13,8,16))],
 'shell:salt_case':[facet('bone',box(2,8,11,17),box(22,10,8,16))],
 'shell:stitched_pouch':[facet('plum',box(4,9,10,18),box(21,15,7,15))],
 'shell:thin_shell_ovoid':[facet('bone',box(6,3,11,23),[[20,5],[27,10],[26,26],[18,30],[14,25],[19,19]])],
};

const mix=(a:number,b:number,t:number):number=>{let c=0;for(const shift of [16,8,0])c|=Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t)<<shift;return c;};

export function groundMaterialFaces(p:PixelCanvas,id:string):void {
 if(p.size!==32)return;
 const plans=FACES[id];if(!plans)throw new Error(`Missing world-material planes: ${id}`);
 for(const plan of plans){
  const ramp=MAT[plan.material];
  for(const [mode,polygon] of [['light',plan.light],['shade',plan.shade]] as const){
   const mask=new PixelCanvas(32);mask.poly(polygon,1);
   p.cells.forEach((color,i)=>{
    if(color===undefined||mask.cells[i]===undefined)return;
    const tone=(ramp as readonly number[]).indexOf(color);if(tone<0)return;
    // Broad reflected/material planes; never an emissive overlay or extra alpha.
    p.cells[i]=mode==='light'
      ? (tone===0?mix(ramp[2],ramp[3],.5):ramp[3])
      : (tone<=2?mix(ramp[0],0x111b21,.25):ramp[1]);
   });
  }
 }
}
