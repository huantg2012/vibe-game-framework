from pathlib import Path
import json,shutil,hashlib,csv,io
root=Path('/Users/yilungao/coh'); dest=root/'docs/qa/artifacts/r100-i10-i12/b06-isolated-author'
header=(root/'data/rift-native-worlds.csv').read_text().splitlines()[0]
worlds=[]
def R(name,points,bounds=None):return {'name':name,'points':points,'bounds':bounds}
def add(id,label,family,base,org,shape,items,routes,relations,organization):
 instances=[':'.join(map(str,[family,role,x,y,a,l,w,h,t,fold,3,.7,.25])) for role,x,y,a,l,w,h,t,fold in items]
 worlds.append({'row':[id,label,'11','false',family,base,org,'4','|'.join(instances),'|'.join([shape]*len(items)),'850:32;935:48;946:96;881:112',''],'routes':routes,'relations':relations,'organization':organization})
add('short-fibre-mat','短纤压床','membrane-rim','ivory-basin','patches','compressed-wedge',[
 ('relief',515,320,-.1,400,205,5,2,.52),('relief',695,600,.22,360,200,4,2,.41),('solid',337,340,1.0,245,170,44,12,.68)],
 [R('bare-layer-break',[[420,502],[565,455],[774,444]],[390,418,850,535]),R('thick-edge-short-round',[[284,500],[224,420],[252,228],[445,216]],[175,185,475,535]),R('outer-still-bed',[[846,630],[875,490],[887,268]])],
 {'contacts':[[1,3]],'walkableSurfaceObjects':[1,2],'barePoint':[590,455],'nearest':'felt-basin','difference':['一片厚压肩接大低层，第二低层隔开露床；低层自身可行走','真正绕行由西侧厚压肩形成，其余两处断口只是低皮缺失而非碰撞窄口']},'short-fibre')
add('marrow-break','髓孔断岸','granular-ridge','ash-strata','patches','porous-break',[
 ('solid',440,350,-1.5708,250,165,58,14,.64),('solid',680,390,1.5708,190,145,42,11,.48)],
 [R('facing-fracture-mouth',[[564,528],[564,388],[564,248]],[530,215,608,555]),R('west-outer',[[335,536],[287,334],[355,182]]),R('east-outer',[[787,541],[802,365],[752,225]])],
 {'disjointSolidObjects':[1,2],'nearest':'cork-shelves','difference':['两处局部有底孔断面相向，真20px通口只在两块之间','两短厚芯与左右宽绕取代L形长岸，不以表面黑点制造入口']},'porous-marrow')
add('felt-wedges','毡层挤片','membrane-rim','ivory-basin','clusters','compressed-wedge',[
 ('solid',610,420,.5,240,150,48,12,.71),('solid',525,461,1.8,190,120,37,10,.55),('solid',505,362,3.8,160,110,29,8,.42)],
 [R('torn-end-round',[[610,538],[731,493],[755,361],[635,272]],[585,245,790,565]),R('western-end-gap',[[414,524],[405,435],[386,326],[450,249]],[340,225,465,555]),R('wide-back-bed',[[440,201],[810,205]])],
 {'contacts':[[1,2],[2,3],[1,3]],'nearest':'short-fibre-mat','difference':['三件实体厚楔的宽头聚接、撕端分散朝向，不能穿过压头','两侧绕各自断端再进入北方大床，与大片可走低压层的过程不同']},'short-fibre')
add('pore-bank','孔岸静滩','granular-ridge','ash-strata','bands','porous-break',[
 ('solid',495,365,.12,230,170,64,15,.7),('relief',637,409,.05,350,140,4,2,.45),('relief',736,567,-.15,260,120,5,2,.53)],
 [R('near-bank-turn',[[355,450],[421,491],[596,492],[829,470]],[320,417,870,540]),R('far-still-shore',[[287,227],[524,213],[856,229]]),R('low-fragment-return',[[829,470],[839,567],[669,647]])],
 {'contacts':[[1,2]],'walkableSurfaceObjects':[2,3],'nearest':'marrow-break','difference':['一高短孔岸贴一长低片、另一片断开，低尾可走而高头需绕','远侧横向静滩持续贯通，取代两高岸相对夹出的中道']},'porous-marrow')
base=(root/'data/rift-native-worlds.csv').read_bytes(); text=''.join(','.join(w['row'])+'\n' for w in worlds)
(dest/'native-draft.csv').write_text(header+'\n'+text)
(dest/'intent.json').write_text(json.dumps({w['row'][0]:{'batch':'b06','routes':w['routes'],'relations':w['relations'],'organization':w['organization']} for w in worlds},ensure_ascii=False,indent=2)+'\n')
(dest/'preparation.json').write_text(json.dumps({'status':'isolated-author-unchecked','formalCatalogSha256':hashlib.sha256(base).hexdigest(),'worlds':[w['row'][0] for w in worlds],'formalDataUnchanged':True,'requires':'body and contact checks, later current material source and normal shoulder-light scene review'},ensure_ascii=False,indent=2)+'\n')
out=Path('/tmp/r100-i10-b06-catalog');(out/'data').mkdir(parents=True,exist_ok=True)
for name in ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']:
 (out/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,out/name)
(out/'data/rift-native-worlds.csv').write_bytes(base+text.encode())
print('Prepared4isolatedB06rows; formalCSVunchanged')
