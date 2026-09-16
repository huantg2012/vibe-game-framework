const route=await page.evaluate(()=>{
  const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid,p=s.player.getPosition(),e=s.extraction.extractionPoint.position;
  const start=[Math.floor(p.x/g.tileSize),Math.floor(p.y/g.tileSize)],end=[Math.floor(e.x/g.tileSize),Math.floor(e.y/g.tileSize)];
  const q=[start],parents=new Map([[start.join(','),null]]);
  for(let i=0;i<q.length;i++){
    const [x,y]=q[i];if(x===end[0]&&y===end[1])break;
    for(const [dx,dy] of [[1,0],[0,-1],[-1,0],[0,1]]){
      const nx=x+dx,ny=y+dy,k=[nx,ny].join(',');
      if(g.isWalkable(nx,ny)&&!parents.has(k)){parents.set(k,[x,y]);q.push([nx,ny]);}
    }
  }
  if(!parents.has(end.join(',')))throw Error('No connected exit');
  const path=[];
  for(let p=end;p;p=parents.get(p.join(',')))path.push({x:(p[0]+.5)*g.tileSize,y:(p[1]+.5)*g.tileSize});
  return path.reverse();
});
steps.push({name:'route-planned-readonly',route});
await hold('Escape',100);await hold('Space',100);await hold('Tab',100);
await shot('04-inventory');await hold('Escape',100);
for(let i=1;i<route.length;i++){
  for(let n=0;n<22;n++){
    const s=await snapshot();
    if(s.ended)throw Error('Run ended before exit: '+s.reason);
    if(!s.player)throw Error('No active player');
    const dx=route[i].x-s.player.x,dy=route[i].y-s.player.y;
    if(Math.hypot(dx,dy)<3)break;
    const h=Math.abs(dx)>Math.abs(dy),d=h?dx:dy,k=h?(d>0?'d':'a'):(d>0?'s':'w');
    await hold(k,Math.max(35,Math.min(220,Math.abs(d)/80*900)));
    if(n===21)throw Error('Movement blocked at waypoint '+i);
  }
  if(i===20)await shot('05-rift-walking');
  if(i%15===0)console.log('walked',i,'/',route.length);
}
await shot('06-exit');await hold('e',160);await page.waitForTimeout(850);
await shot('07-extraction');await hold('r',160);
await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));
await page.waitForTimeout(600);
return {state:await shot('08-returned'),errors,httpErrors};
