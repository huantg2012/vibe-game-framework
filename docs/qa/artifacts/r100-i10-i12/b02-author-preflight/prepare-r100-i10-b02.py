from pathlib import Path
import csv, json, shutil, hashlib
root=Path('/Users/yilungao/coh'); dest=Path('/tmp/r100-i10-b02-catalog'); dest.mkdir(exist_ok=True)
rows=[]
def add(id,label,family,base,organization,instances,shapes,polygons,edge):
 row=[id,label,'10','false',family,base,organization,'4','|'.join(':'.join(map(str,i)) for i in instances),'|'.join(shapes),'|'.join(';'.join(f'{x}:{y}' for x,y in p) for p in polygons),str(edge)]; rows.append(row)
def i(f,r,x,y,rot,l,w,h,t=8,fold=.5,branches=3,opening=.7,distortion=.25): return [f,r,x,y,rot,l,w,h,t,fold,branches,opening,distortion]
add('braided-seam','编裂长滩','fibre-knot','crystal-fibre','bands',[
 i('fibre-knot','relief',188,382,0,285,610,5,2),i('fibre-knot','relief',514,390,.025,205,550,4,2),i('fibre-knot','relief',846,378,3.04,260,594,5,2),
 i('fibre-knot','solid',284,210,.32,170,79,35,11,.65,3),i('fibre-knot','solid',784,571,-.5,145,70,26,9,.45,2)],['fracture-fan']*3+['fallen-bundle']*2,[
 [(344,0),(400,0),(400,216),(384,256),(344,256)],[(344,360),(384,360),(400,400),(400,768),(344,768)],
 [(640,0),(696,0),(696,412),(680,448),(640,448)],[(640,568),(680,568),(696,600),(696,768),(640,768)]],8)
add('scalloped-reach','缺唇长岸','broken-shell','ivory-basin','patches',[
 i('broken-shell','relief',558,368,.1,780,500,5,2),i('broken-shell','solid',630,112,.23,172,95,42,12,.63,3),
 i('broken-shell','solid',692,489,-.18,152,91,33,10,.45,3),i('broken-shell','solid',559,639,-1.24,138,90,28,9,.55,2)],['fracture-fan','clamp-bank','clamp-bank','clamp-bank'],[
 [(1024,136),(794,136),(654,180),(630,232),(706,272),(1024,272)],
 [(1024,344),(804,344),(712,396),(738,448),(824,472),(1024,472)],
 [(1024,560),(760,560),(624,598),(596,654),(686,696),(1024,696)]],8)
add('offset-pan','错台浅原','folded-slab','ash-strata','patches',[
 i('folded-slab','relief',438,600,-.02,710,190,4,2),i('folded-slab','relief',496,383,.07,738,145,5,2),i('folded-slab','relief',527,147,3.1,744,156,6,2),
 i('folded-slab','solid',510,613,-.32,159,88,27,8,.48),i('folded-slab','solid',497,344,.29,140,81,34,10,.6),i('folded-slab','solid',790,117,-.13,165,102,24,8,.42)],['fracture-fan']*6,[
 [(0,240),(596,240),(632,256),(616,288),(0,288)],[(776,240),(1024,240),(1024,288),(792,288),(760,268)],
 [(0,472),(260,472),(284,488),(268,520),(0,520)],[(400,472),(1024,472),(1024,520),(416,520),(388,496)]],8)
add('thin-delta','薄脂分汊','gel-flow','ivory-basin','patches',[
 i('gel-flow','relief',560,166,-.08,665,188,5,2),i('gel-flow','relief',516,399,.06,508,133,4,2),i('gel-flow','relief',732,698,0,404,85,4,2),
 i('gel-flow','solid',428,414,-.43,230,150,48,13,.58,3),i('gel-flow','relief',422,487,.52,286,193,6,2)],['clamp-bank','fracture-fan','fracture-fan','clamp-bank','clamp-bank'],[
 [(1024,248),(700,248),(568,280),(540,312),(620,348),(1024,348)],
 [(1024,430),(774,430),(646,462),(626,490),(786,512),(1024,512)],
 [(576,568),(704,544),(786,572),(792,621),(728,642),(584,630),(552,594)]],8)
header=(root/'data/rift-native-worlds.csv').read_text().splitlines()[0]
with open('/tmp/r100-i10-b02-native.csv','w') as f:
 f.write(header+'\n'); csv.writer(f,lineterminator='\n').writerows(rows)
for file in ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']:
 (dest/file).parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(root/file,dest/file)
(dest/'data').mkdir(exist_ok=True)
baseline=(root/'data/rift-native-worlds.csv').read_bytes(); appended=''.join(','.join(row)+'\n' for row in rows).encode()
(dest/'data/rift-native-worlds.csv').write_bytes(baseline+appended)
(dest/'author-plan.json').write_text(json.dumps({'status':'temporary-author-data-only','baselineNativeCsvSha256':hashlib.sha256(baseline).hexdigest(),'ids':[r[0] for r in rows]},indent=2)+'\n')
print(dest)
