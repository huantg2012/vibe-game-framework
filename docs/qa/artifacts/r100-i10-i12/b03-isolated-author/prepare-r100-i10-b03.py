from pathlib import Path
import csv,json,shutil,hashlib
root=Path('/Users/yilungao/coh');out=Path('/tmp/r100-i10-b03-catalog');out.mkdir(exist_ok=True)
rows=[]
def i(f,r,x,y,a,l,w,h,t=8,fold=.5,branches=3,opening=.7,dist=.25):return [f,r,x,y,a,l,w,h,t,fold,branches,opening,dist]
def add(id,label,f,base,org,instances,shapes):rows.append([id,label,'10','false',f,base,org,'4','|'.join(':'.join(map(str,x)) for x in instances),'|'.join(shapes),'850:32;935:48;946:96;881:112',''])
add('shard-switchback','错片折径','folded-slab','ash-strata','patches',[
 i('folded-slab','solid',338,262,.46,196,110,32),i('folded-slab','solid',520,306,-.43,215,108,42,10,.65),i('folded-slab','solid',371,454,.28,225,125,38,9,.46),i('folded-slab','solid',654,452,-.56,208,102,34,8,.59),i('folded-slab','solid',798,292,.31,163,91,28,7,.4),i('folded-slab','solid',782,588,-.44,181,120,24,7,.44)],['fracture-fan']*6)
add('hollow-wreckage','裂壳散场','broken-shell','ivory-basin','patches',[
 i('broken-shell','solid',386,320,-1.04,255,130,58,14,.62),i('broken-shell','solid',708,370,1.96,245,145,46,12,.48),i('broken-shell','relief',526,228,.28,290,170,5,2,.57),i('broken-shell','relief',566,544,-2.45,335,200,5,2,.38)],['clamp-bank']*4)
add('knotted-run','断结交路','fibre-knot','crystal-fibre','clusters',[
 i('fibre-knot','solid',354,287,.25,160,102,50,13,.58),i('fibre-knot','solid',356,283,1.5,130,75,65,13,.69),i('fibre-knot','solid',448,330,.43,156,69,25,8,.36),
 i('fibre-knot','solid',714,330,-.68,175,102,46,12,.63),i('fibre-knot','solid',706,326,.74,145,80,61,13,.51),i('fibre-knot','solid',785,253,-.8,155,62,28,8,.45),
 i('fibre-knot','solid',463,530,-.21,140,99,45,11,.46),i('fibre-knot','solid',452,535,1.01,110,77,56,12,.65),i('fibre-knot','solid',365,586,-.48,154,64,24,8,.39)],['fallen-bundle']*9)
add('rolled-fragments','卷皮断片','membrane-rim','ivory-basin','bands',[
 i('membrane-rim','solid',300,370,-1.05,190,108,35,8,.72),i('membrane-rim','solid',408,218,-.4,180,98,31,7,.66),i('membrane-rim','solid',610,228,.35,160,96,27,7,.55),i('membrane-rim','solid',770,376,1.0,150,88,23,6,.47),i('membrane-rim','solid',794,563,1.9,134,80,19,5,.38)],['torn-sheet']*5)
base=(root/'data/rift-native-worlds.csv').read_bytes();assert len(base.splitlines())==61
for name in ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']:
 (out/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,out/name)
(out/'data').mkdir(exist_ok=True);text=''.join(','.join(r)+'\n' for r in rows);(out/'data/rift-native-worlds.csv').write_bytes(base+text.encode())
Path('/tmp/r100-i10-b03-native.csv').write_text(base.decode().splitlines()[0]+'\n'+text)
(out/'status.json').write_text(json.dumps({'status':'isolated-author-draft-not-active','baselineNative60Sha256':hashlib.sha256(base).hexdigest(),'worlds':[r[0] for r in rows],'noRuntimeChanges':True,'notArtPassed':True},indent=2)+'\n')
print('Prepared4isolatedB03rows; production60unchanged')
