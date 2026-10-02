function isMatter(land:Uint8Array,cols:number,rows:number,c:number,r:number):boolean{return c>=0&&r>=0&&c<cols&&r<rows&&land[r*cols+c]===1;}

/** Supercover grid traversal: native dark void remains opaque to surface reveal. */
export function hasMasterMatterPath(land:Uint8Array,cols:number,rows:number,tileSize:number,x0:number,y0:number,x1:number,y1:number):boolean{
  let col=Math.floor(x0/tileSize),row=Math.floor(y0/tileSize);
  const endCol=Math.floor(x1/tileSize),endRow=Math.floor(y1/tileSize),dx=x1-x0,dy=y1-y0;
  const sx=Math.sign(dx),sy=Math.sign(dy),stepX=dx?tileSize/Math.abs(dx):Infinity,stepY=dy?tileSize/Math.abs(dy):Infinity;
  let nextX=dx?((sx>0?(col+1)*tileSize:col*tileSize)-x0)/dx:Infinity;
  let nextY=dy?((sy>0?(row+1)*tileSize:row*tileSize)-y0)/dy:Infinity;
  for(let steps=0;steps<=cols+rows+2;steps++){
    if(!isMatter(land,cols,rows,col,row))return false;if(col===endCol&&row===endRow)return true;
    if(Math.abs(nextX-nextY)<1e-9){if(!isMatter(land,cols,rows,col+sx,row)||!isMatter(land,cols,rows,col,row+sy))return false;col+=sx;row+=sy;nextX+=stepX;nextY+=stepY;}
    else if(nextX<nextY){col+=sx;nextX+=stepX;}else{row+=sy;nextY+=stepY;}
  }return false;
}
