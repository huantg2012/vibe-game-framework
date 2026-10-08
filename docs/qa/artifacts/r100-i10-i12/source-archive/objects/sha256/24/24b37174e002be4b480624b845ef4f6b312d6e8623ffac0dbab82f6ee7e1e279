const state = await page.evaluate(() => {
  const root = document.getElementById('dom-ui-root');
  const old = root.style.visibility; root.style.visibility='hidden';
  return {rootVisibility:old};
});
await page.waitForTimeout(100);
await page.screenshot({path:path.join(root,'drop-review','08-paused-world-only-diagnostic.png')});
const previous = await page.evaluate(() => {
  const s=window.__game.scene.getScene('RiftScene');
  return [...s.fieldInventory.visuals].map(([id,v])=>{const was=v.visible;v.visible=false;return {id,was};});
});
await page.waitForTimeout(100);
await page.screenshot({path:path.join(root,'drop-review','09-paused-background-only-diagnostic.png')});
await page.evaluate(({state,previous})=>{
  const s=window.__game.scene.getScene('RiftScene');
  for(const {id,was} of previous)s.fieldInventory.visuals.get(id).visible=was;
  document.getElementById('dom-ui-root').style.visibility=state.rootVisibility;
},{state,previous});
fs.writeFileSync(path.join(root,'drop-review','diagnostic-pair.json'),JSON.stringify({disclosure:'Both frames use the same Esc-paused scene. Temporarily hide DOM overlay for world-only diagnostic; then hide only existing ground-item Graphics.visible for background-only diagnostic; restore both. No game-domain state, source, saved inventory, lighting, actor position or camera mutated.',pair:['08-paused-world-only-diagnostic.png','09-paused-background-only-diagnostic.png'],hiddenVisuals:previous,rootBefore:state},null,2));
return {captured:true,previous};
