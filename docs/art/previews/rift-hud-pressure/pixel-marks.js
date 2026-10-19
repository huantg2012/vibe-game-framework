/** Art study only: 16 × 20 hard-pixel symbols, at most two colours per frame. */
const P = { neutral:'#8a8f96', load:'#c8cdd4', warning:'#e0a848', alien:'#1aad96' };
const clamp = (n,min,max) => Math.max(min,Math.min(max,Number(n)||0));
export const markSize = Object.freeze({width:16,height:20});

function stamp(ctx,x,y,cells,colors) {
  ctx.save();ctx.imageSmoothingEnabled=false;
  const ox=Math.round(x),oy=Math.round(y);
  cells.forEach((row,py)=>[...row].forEach((cell,px)=>{
    if(colors[cell]){ctx.fillStyle=colors[cell];ctx.fillRect(ox+px,oy+py,1,1);}
  }));ctx.restore();
}

export function drawBurden(ctx,x,y,ratio,time=0,feedback=0) {
  const r=clamp(ratio,0,1);
  const rows=[
    '................',
    '.....NN...N.....',
    '......NN.NN.....',
    '.......NNN......',
    '......NNNNN.....',
    '......NIIIN.....',
    '.....NIIIIIN....',
    '....NNIIIIIN....',
    '....NIIIIIIIN...',
    '...NNIIIIIIIN...',
    '...NIIIIIIIIN...',
    '...NIIIIIIIIN...',
    '...NIIIIIIIIN...',
    '...NIIIIIIIIN...',
    '....NIIIIIIN....',
    '....NNIIIIN.....',
    '.....NNNNN......',
    '................',
    '................',
    '................',
  ].map(row=>[...row]);
  // Fill the sack's interior, bottom upwards; the tied mouth and edge stay intact.
  const inside=[];
  rows.forEach((row,py)=>row.forEach((cell,px)=>{if(cell==='I')inside.push([px,py]);}));
  inside.sort((p,q)=>q[1]-p[1]||p[0]-q[0]);
  for(let i=0;i<Math.round(r*inside.length);i++){const [px,py]=inside[i];rows[py][px]='A';}
  const settle=feedback>.5?1:0;
  stamp(ctx,x,y+settle,rows.map(row=>row.join('')),{N:P.neutral,A:r>=.875?P.warning:P.load});
}

export function drawAssimilation(ctx,x,y,amount,time=0,growing=false) {
  const a=clamp(amount,0,100);
  const base=[
    '................',
    '.......NNN......',
    '.......NNN......',
    '.......NNN......',
    '........N.......',
    '.....NNNNNN.....',
    '....NNNNNNNN....',
    '....NN.NNNNN....',
    '....NN.NNNNN....',
    '....NN.NNNNN....',
    '....NN.NNNNN....',
    '....NN.NNNNN....',
    '.......NNNN.....',
    '.......NN.NN....',
    '.......NN.NN....',
    '......NN..NN....',
    '......NN..NN....',
    '......NN..NN....',
    '.....NNN..NNN...',
    '................',
  ];
  const cells=base.map(row=>[...row]);
  const body=[];cells.forEach((row,py)=>row.forEach((c,px)=>{if(c==='N')body.push([px,py]);}));
  // A contiguous invasion of the same adult silhouette, without face or texture.
  body.sort((p,q)=>(q[0]+q[1]*.22)-(p[0]+p[1]*.22));
  const count=Math.round(a/100*body.length);
  for(let i=0;i<count;i++){const [px,py]=body[i];cells[py][px]='A';}
  if(growing&&a>0&&a<100&&Math.floor(time/650)%2&&count<body.length){
    const [px,py]=body[count];cells[py][px]='A';
  }
  stamp(ctx,x,y,cells.map(row=>row.join('')),{N:P.neutral,A:P.alien});
}
