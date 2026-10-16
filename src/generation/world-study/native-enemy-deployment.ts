/** Departure freezes the actual forms before Host footprint and AI admission.
 * Saved forms are validated structurally; recovery never reselects today's CSV. */
import type {ContaminationForm} from '@/generation/contamination-draw';
import type {PollutionGrade} from './pollution-grade';

export interface NativeEnemyDeployment {
  readonly version:1;
  readonly worldId:string;
  readonly grade:PollutionGrade;
  readonly sourceHash:string;
  readonly infiltrator:ContaminationForm;
  readonly rewriter:ContaminationForm;
  readonly paint:ContaminationForm;
}
const keys=(value:object,expected:readonly string[]):boolean=>Object.keys(value).length===expected.length&&expected.every(key=>Object.prototype.hasOwnProperty.call(value,key));
function validForm(value:unknown,role:'infiltrator'|'rewriter'|'paint',paintCoverage:string):boolean {
  if(!value||typeof value!=='object'||Array.isArray(value)||!keys(value,['substrate','coverage','continuity','occupancy','portfolio','lexemes']))return false;
  const form=value as ContaminationForm,paint=role==='paint',lexemes=form.lexemes;
  if(!lexemes||!keys(lexemes,['motion','sense','rhythm','contact']))return false;
  return form.substrate===(paint?'fungal_mat':'human_remnant')
    &&form.coverage===(paint?paintCoverage:role==='rewriter'?'rewrite':'infiltrate')
    &&form.continuity===(paint?'colony':'monolith')&&form.occupancy===(paint?'paint':'floor')&&form.portfolio===(paint?'bing':'jia')
    &&lexemes.motion===(paint?'motion_cluster':'motion_patrol')
    &&lexemes.sense===(paint?'sense_touch':role==='rewriter'?'sense_hear':'sense_cone')
    &&lexemes.rhythm===(paint?'rhythm_cluster':'rhythm_open')
    &&lexemes.contact===(paint?'contact_step_chaos':'contact_melee_three');
}
/** Version 1 deliberately admits only the two reviewed world/form contracts. */
export function validNativeEnemyDeployment(value:unknown,worldId:string,grade:PollutionGrade,paintCoverage:string):value is NativeEnemyDeployment {
  if(!value||typeof value!=='object'||Array.isArray(value)||!keys(value,['version','worldId','grade','sourceHash','infiltrator','rewriter','paint']))return false;
  const input=value as NativeEnemyDeployment;
  return ['crystal-fibre','ruptured-film'].includes(worldId)&&input.version===1&&input.worldId===worldId&&input.grade===grade
    &&/^[0-9a-f]{64}$/.test(input.sourceHash)&&['infiltrate','rewrite','overwrite'].includes(paintCoverage)
    &&validForm(input.infiltrator,'infiltrator',paintCoverage)&&validForm(input.rewriter,'rewriter',paintCoverage)&&validForm(input.paint,'paint',paintCoverage);
}
