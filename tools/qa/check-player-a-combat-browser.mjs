/** Controlled presentation lifecycle in the actual RiftScene and isolated gym storage.
 * Hazard damage is invoked explicitly; this is not evidence of natural enemy combat. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='docs/qa/artifacts/player-a-production-2026-10-16/combat';
await fs.mkdir(out,{recursive:true});
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={method:'Actual RiftScene, ordinary equipped gym loadout, isolated storage. Explicit public applyHazardHit calls exercise hurt/death presentation; not a natural fight.',checks:[],errors:[]};
try {
  const page=await browser.newPage({viewport:{width:1264,height:1000}});
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:3027/r100-gym.html?world=cinder-ridge&grade=medium&seed=92');
  await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});
  await page.evaluate(async()=>{
    const {audioManager}=await import('/src/managers/audio-manager.ts');
    window.__playerACombatScene=audioManager.game.scene.getScene('RiftScene');
  });
  const first=await page.evaluate(()=>{
    const s=window.__playerACombatScene,a=s.lastLightPlayerPresentation;
    window.__playerABefore={health:s.combat.getHealth(),mask:a.image.mask,textures:[a.texture.key,a.contactTexture.key,a.gloveTexture.key]};
    return {probe:a.getProbe(),accepted:s.combat.applyHazardHit('qa-controlled-hazard',1)};
  });
  assert.equal(first.probe.model,'a');assert(first.probe.weapon.visible);assert(first.accepted);
  await page.waitForFunction(()=>window.__playerACombatScene.lastLightPlayerPresentation.getProbe().hitFlash,null,{timeout:2000});
  const hurt=await page.evaluate(()=>{
    const s=window.__playerACombatScene,a=s.lastLightPlayerPresentation;
    return {health:s.combat.getHealth(),before:window.__playerABefore.health,
      allBodyFlashes:s.player.getHitFlashImages().every(i=>i.tintFill),contactTint:a.contact.tintFill,
      sameMask:a.image.mask===window.__playerABefore.mask,oldBodyVisible:s.player.getSprite().visible};
  });
  assert.equal(hurt.health,hurt.before-1);assert(hurt.allBodyFlashes);assert(!hurt.contactTint);assert(hurt.sameMask);assert(!hurt.oldBodyVisible);
  report.hurt=hurt;report.checks.push('Actual A body and glove flash, contact does not; original mask survives');
  await page.evaluate(()=>window.__playerACombatScene.scene.pause());
  await page.waitForFunction(()=>!window.__playerACombatScene.lastLightPlayerPresentation.getProbe().hitFlash);
  report.checks.push('Scene pause clears body flash');
  await page.evaluate(()=>window.__playerACombatScene.scene.resume());
  await page.waitForFunction(()=>!window.__playerACombatScene.combat.isInvulnerable(),null,{timeout:4000});
  assert.equal(await page.evaluate(()=>window.__playerACombatScene.lastLightPlayerPresentation.getProbe().hitFlash),false);
  await page.keyboard.press('Space');
  const death=await page.evaluate(()=>{
    const s=window.__playerACombatScene;
    const accepted=s.combat.applyHazardHit('qa-controlled-lethal',s.combat.getHealth());
    return {accepted,dead:s.combat.isDead(),phase:s.combat.getAttackState().phase,
      probe:s.lastLightPlayerPresentation.getProbe(),flash:s.player.getHitFlashImages().some(i=>i.tintFill)};
  });
  assert(death.accepted&&death.dead);assert.equal(death.phase,'idle');assert(!death.flash);
  report.death=death;report.checks.push('Lethal hazard cancels swing and clears flash on the same update');
  await page.screenshot({path:`${out}/death.png`});
  await page.evaluate(()=>window.__playerACombatScene.scene.stop());
  await page.waitForFunction(()=>!window.__playerACombatScene.scene.isActive());
  report.texturesReleased=await page.evaluate(()=>window.__playerABefore.textures.every(key=>!window.__playerACombatScene.game.textures.exists(key)));
  assert(report.texturesReleased);assert.deepEqual(report.errors,[]);
  report.checks.push('Scene shutdown releases all owned body/contact/glove canvas textures');
  report.pass=true;
}catch(error){report.pass=false;report.error=String(error);process.exitCode=1;}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));
