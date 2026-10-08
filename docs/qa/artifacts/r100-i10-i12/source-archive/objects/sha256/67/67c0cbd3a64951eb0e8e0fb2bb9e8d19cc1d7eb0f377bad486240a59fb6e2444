const result = await page.evaluate(() => {
  const s = window.__game.scene.getScene('RiftScene');
  const cam = s.cameras.main, canvas = window.__game.canvas;
  const r = canvas.getBoundingClientRect();
  const ground = [...s.fieldInventory.visuals].map(([id,v]) => {
    const q = cam.matrix.transformPoint(v.x-cam.scrollX,v.y-cam.scrollY);
    return {id,world:{x:v.x,y:v.y},visible:v.visible,alpha:v.alpha,depth:v.depth,
      visibility:s.visibility.getVisibilityAt({x:v.x,y:v.y}),
      logicalScreen:{x:q.x,y:q.y},screen:{x:r.left+q.x*r.width/canvas.width,y:r.top+q.y*r.height/canvas.height}};
  });
  return {url:location.href,paused:s.scene.isPaused(),scripts:[...document.scripts].map(s=>s.src),
    canvas:{width:canvas.width,height:canvas.height,left:r.left,top:r.top,cssWidth:r.width,cssHeight:r.height},
    camera:{zoom:cam.zoom,scrollX:cam.scrollX,scrollY:cam.scrollY,x:cam.x,y:cam.y,width:cam.width,height:cam.height,matrix:{a:cam.matrix.a,b:cam.matrix.b,c:cam.matrix.c,d:cam.matrix.d,e:cam.matrix.e,f:cam.matrix.f}},
    worldPixelScale:cam.zoom*r.width/canvas.width,player:{...s.player.getPosition()},ground,
    nearby:s.fieldInventory.getNearby().map(i=>({id:i.id,location:i.location,catalog:i.contaminant?.catalog}))};
});
fs.writeFileSync(path.join(root,'drop-review','drop-measurement.json'),JSON.stringify(result,null,2));
return result;
