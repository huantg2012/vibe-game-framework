/** Art study only: 16 × 16 pixel symbols, at most two colours per frame. */
const P = { neutral:'#8a8f96', warning:'#e0a848', alien:'#1aad96' };
const clamp = (n,min,max) => Math.max(min,Math.min(max,Number(n)||0));
export const markSize = Object.freeze({width:16,height:16});

function stamp(ctx,x,y,cells,colors) {
  ctx.save();ctx.imageSmoothingEnabled=false;
  const ox=Math.round(x),oy=Math.round(y);
  cells.forEach((row,py)=>[...row].forEach((cell,px)=>{
    if(colors[cell]){ctx.fillStyle=colors[cell];ctx.fillRect(ox+px,oy+py,1,1);}
  }));ctx.restore();
}

export function drawBurden(ctx,x,y,ratio,time=0,feedback=0) {
  const r=clamp(ratio,0,1),full=r>=.985;
  const rows=[
    '................',
    '......NNNN......',
    '.....NN..NN.....',
    '.....N....N.....',
    '....NNNNNNNN....',
    '...N........N...',
    '..N..........N..',
    '..N..........N..',
    '..N..........N..',
    '..N..........N..',
    '..N..........N..',
    '..N..........N..',
    '...N........N...',
    '....NNNNNNNN....',
    '................',
    '................',
  ].map(row=>[...row]);
  // One movable loading line is the only interior mark. No cloth or hardware.
  const lineY=12-Math.round(r*7);
  for(let px=4;px<12;px++)rows[lineY][px]='A';
  if(full){
    for(const py of [7,8,9,10]){rows[py][1]='A';rows[py][14]='A';rows[py][2]='.';rows[py][13]='.';}
  }
  // A one-pixel downward settling motion follows the event, without a glow.
  const settle=feedback>.5?1:0;
  stamp(ctx,x,y+settle,rows.map(row=>row.join('')),{N:P.neutral,A:r>=.875?P.warning:P.neutral});
}

export function drawAssimilation(ctx,x,y,amount,time=0,growing=false) {
  const a=clamp(amount,0,100);
  const base=[
    '................',
    '......NNNN......',
    '.....NNNNNN.....',
    '.....NNNNNN.....',
    '......NNNN......',
    '.......NN.......',
    '....NNNNNNNN....',
    '...NNNNNNNNNN...',
    '..NNNNNNNNNNNN..',
    '..NN..NNNN..NN..',
    '......NNNN......',
    '......NNNN......',
    '.....NN..NN.....',
    '.....NN..NN.....',
    '.....NN..NN.....',
    '................',
  ];
  const cells=base.map(row=>[...row]);
  const body=[];cells.forEach((row,py)=>row.forEach((c,px)=>{if(c==='N')body.push([px,py]);}));
  // A coherent diagonal replacement, not spot texture or additional detail.
  body.sort((p,q)=>(q[0]+q[1]*.32)-(p[0]+p[1]*.32));
  const count=Math.round(a/100*body.length);
  for(let i=0;i<count;i++){const [px,py]=body[i];cells[py][px]='A';}
  if(growing&&a>0&&a<100&&Math.floor(time/650)%2&&count<body.length){
    const [px,py]=body[count];cells[py][px]='A';
  }
  stamp(ctx,x,y,cells.map(row=>row.join('')),{N:P.neutral,A:P.alien});
}
