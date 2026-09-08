/** I18: registry completeness and measured cost of actual production bakers. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { SORTIE_SUBSTRATE_IDS } from '../../src/generated/contamination-lexicon-data';
import { FAMILY_CAPABILITY_DATA } from '../../src/generated/contamination-family-data';
import { productionModelFor } from '../../src/entities/form-renderers/d/production-models';
import { bakeJiaGenome } from '../../src/entities/form-renderers/d/genome/bake';
import { attachGymFormVisual } from '../../src/entities/form-renderers/d/gym-attach';
import type { FormAttachContext, FormVisual, ContaminationFormRenderer } from '../../src/entities/form-renderers/form-renderer';
const families = FAMILY_CAPABILITY_DATA.filter(f => f.portfolio === 'jia' && SORTIE_SUBSTRATE_IDS.includes(f.substrate));
const report=[];
for(const family of families) {
  const model=productionModelFor(family.substrate);
  assert.ok(model, `${family.substrate} must never fall back to an old static production visual`);
  for(const coverage of ['infiltrate','rewrite','overwrite'] as const) for(const facing4 of ['down','left','up','right'] as const) {
    const req={seed:7,coverage,facing4,phase:'idle' as const,phase01:0};
    const body=model.bake(req);
    const preview=bakeJiaGenome({...req,substrate:family.substrate,signal:'idle'});
    assert.deepEqual(preview.buf,body.buf,'preview and actual model registry must share the same bake');
    assert.deepEqual([body.canvas.w,body.canvas.h,body.canvas.originX,body.canvas.originY],family.substrate === 'insect_remnant' ? [48,48,24,24] : [64,64,32,42]);
    for(const phase of ['idle','walk','alert'] as const) {
      assert.deepEqual(model.bake({...req,phase,phase01:0}).buf,model.bake({...req,phase,phase01:1}).buf,`${family.substrate}/${phase}: continuous loop`);
    }
  }
  // These are cold CPU bakes, not FPS or a renderer benchmark. The adapter's
  // bounded cache and hidden-frame skip are exercised by check:model-animation.
  const samples=[];
  for(let i=0;i<240;i++) {
    const start=performance.now();
    model.bake({seed:i%3,coverage:(['infiltrate','rewrite','overwrite'] as const)[i%3]!,facing4:(['down','left','up','right'] as const)[i%4]!,phase:(['idle','walk','alert','windup','strike','recover'] as const)[i%6]!,phase01:(i%30)/29});
    samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);
  report.push({substrate:family.substrate,samples:samples.length,medianMs:+samples[120]!.toFixed(3),p95Ms:+samples[228]!.toFixed(3)});
}
assert.equal(families.length,6);
assert.equal(productionModelFor('doorframe'),undefined);
assert.equal(productionModelFor('street_wreckage'),undefined);
// The gym must not substitute another paint renderer when "production" is selected.
const calls:FormAttachContext[]=[];
const marker={} as FormVisual;
const renderer={attach:(ctx:FormAttachContext)=>{calls.push(ctx);return marker;}} as ContaminationFormRenderer;
for(const occupancy of ['floor','wall','paint','volume']) {
  const ctx={form:{occupancy,substrate:'ash_veil'}} as unknown as FormAttachContext;
  assert.equal(attachGymFormVisual(renderer,ctx),marker);assert.equal(calls.at(-1),ctx);
}
writeFileSync('docs/qa/iteration-18-evidence/model-bake-cost.json',JSON.stringify({kind:'cold CPU bake on this development machine; not a supported-hardware FPS guarantee',families:report},null,2)+'\n');
console.log('check:production-models PASS: 6 production families, preview parity, all idle/walk/alert loops, 1440 cold bakes, gym dispatcher parity');
