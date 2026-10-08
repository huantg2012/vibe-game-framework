from pathlib import Path
import json,shutil,hashlib
root=Path('/Users/yilungao/coh');dest=root/'docs/qa/artifacts/r100-i10-i12/b11-isolated-author';header=(root/'data/rift-native-worlds.csv').read_text().splitlines()[0];worlds=[]
def R(name,points,bounds=None):return {'name':name,'points':points,'bounds':bounds}
def add(id,label,family,base,org,items,routes,relations):
 instances=[':'.join(map(str,[family,role,x,y,a,l,w,h,t,fold,3,.7,.25])) for shape,role,x,y,a,l,w,h,t,fold in items]
 worlds.append({'row':[id,label,'12','false',family,base,org,'4','|'.join(instances),'|'.join(i[0] for i in items),'850:32;935:48;946:96;881:112',''],'routes':routes,'relations':relations})
add('crushed-seam','压碎层缝','folded-slab','ash-strata','bands',[
 ('fallen-bundle','relief',385,390,.35,410,220,5,2,.34),('fallen-bundle','relief',730,400,-.25,390,205,4,2,.42),
 ('fracture-fan','solid',531,215,.15,150,94,38,10,.57),('compressed-wedge','solid',566,329,-.35,110,92,46,12,.7),('fallen-bundle','solid',585,498,.23,135,98,35,9,.5),('compressed-wedge','solid',542,608,-.36,142,105,30,8,.46)],
 [R('central-wide-break',[[361,421],[551,417],[801,414]],[300,387,865,451]),R('short-fold-at-upper-piece',[[455,296],[530,276],[659,282],[674,362]],[418,252,730,397]),R('quiet-mother-edge',[[294,552],[263,405],[329,247]])],
 {'walkableSurfaceObjects':[1,2],'nearest':'shard-switchback','difference':['两大可走连续无叉低母层贯穿厚短片两侧，仅最上短片保真实裂头，其余是钝压口/短束端，区别六件无母体路障','四片只在缝中央成密段，横向断口穿过中心而非沿序列换侧']})
add('husk-reef','空皮残脊','broken-shell','ivory-basin','patches',[
 ('clamp-bank','solid',340,245,.3,205,115,45,11,.55),('clamp-bank','solid',400,390,-.25,200,100,58,13,.71),('clamp-bank','solid',335,535,.4,180,90,40,10,.48),('clamp-bank','relief',765,435,-.2,360,270,4,2,.35),('clamp-bank','solid',610,423,.05,190,83,37,10,.58)],
 [R('broken-cross-piece-end',[[572,614],[724,502],[740,365],[575,278]],[525,245,786,660]),R('dense-back-alternative',[[243,614],[253,472],[254,322],[244,161]]),R('low-husk-still-bed',[[831,582],[855,434],[843,274]])],
 {'walkableSurfaceObjects':[4],'nearest':'red-vault-fragments','difference':['西侧三背互不连接、东侧一大片倒伏低皮，静密分别占侧','中段短横断体迫使长路绕真实端口，不冒称完整腔或单母弧']})
add('fibre-scree','碎束斜坡','fibre-knot','crystal-fibre','clusters',[
 ('fallen-bundle','solid',368,285,.58,220,120,52,13,.65),('fallen-bundle','solid',419,349,.40,200,112,41,11,.53),('fallen-bundle','solid',330,356,.81,165,98,36,10,.47),
 ('fallen-bundle','solid',722,381,-.65,205,120,54,13,.68),('fallen-bundle','solid',762,459,-.45,195,102,40,11,.51),('fallen-bundle','solid',666,440,-.78,160,93,33,9,.43),
 ('fallen-bundle','relief',430,584,.45,175,90,5,2,.33),('fallen-bundle','relief',681,608,-.52,155,82,4,2,.3)],
 [R('between-opposed-masses',[[563,639],[530,502],[557,385],[526,233]],[465,190,619,678]),R('wide-west-outer',[[249,605],[219,337],[249,193]]),R('low-scree-crossing',[[290,651],[778,664]])],
 {'contacts':[[1,2],[1,3],[2,3],[4,5],[4,6],[5,6]],'walkableSurfaceObjects':[7,8],'nearest':'knotted-run','difference':['两堆各三段同向刚性断束形成整体团界，两堆斜向相反','无三结交路，近路是两个粗团之间的宽曲床；下部屑层全可踩']})
add('gel-rafts','断脂浅片','gel-flow','ivory-basin','patches',[
 ('clamp-bank','relief',350,400,-.45,230,170,4,2,.45),('clamp-bank','relief',352,525,.2,190,140,5,2,.58),('clamp-bank','solid',439,314,-.65,160,130,35,10,.64),
 ('clamp-bank','relief',700,365,.5,260,155,5,2,.43),('clamp-bank','relief',786,510,-.5,200,120,4,2,.32),('clamp-bank','solid',709,565,.3,155,115,45,12,.67)],
 [R('wide-between-groups',[[556,668],[553,492],[549,332],[565,218]],[495,185,615,705]),R('left-low-pieces',[[274,614],[330,498],[337,413],[293,305]]),R('right-thick-end-return',[[844,622],[885,515],[873,368]])],
 {'disjointSolidObjects':[3,6],'walkableSurfaceObjects':[1,2,4,5],'nearest':'wax-tongues','difference':['六块独立断脂片分成两组，每组仅一厚端有阻挡','两组之间整段宽裸床可以直返，低片与裸床可跨而非连体双舌长缝']})
base=(root/'data/rift-native-worlds.csv').read_bytes();text=''.join(','.join(w['row'])+'\n' for w in worlds)
(dest/'native-draft.csv').write_text(header+'\n'+text);(dest/'intent.json').write_text(json.dumps({w['row'][0]:{'batch':'b11','routes':w['routes'],'relations':w['relations']} for w in worlds},ensure_ascii=False,indent=2)+'\n')
(dest/'preparation.json').write_text(json.dumps({'status':'isolated-author-unchecked','formalCatalogSha256':hashlib.sha256(base).hexdigest(),'worlds':[w['row'][0] for w in worlds],'formalDataUnchanged':True},indent=2)+'\n')
out=Path('/tmp/r100-i10-b11-catalog');(out/'data').mkdir(parents=True,exist_ok=True)
for name in ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']:
 (out/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,out/name)
(out/'data/rift-native-worlds.csv').write_bytes(base+text.encode());print('Prepared4isolatedB11rows;formalCSVunchanged')
