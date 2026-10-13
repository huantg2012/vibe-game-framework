"""Read-only QA of CSV append-only scope against immutable Git HEAD."""
import csv, hashlib, io, json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

out = Path(sys.argv[1])
assert not out.exists(), 'Fresh report required'
worlds = ['split-rib-causeway', 'gel-rafts', 'sloughed-court']
paths = ['data/rift-native-worlds.csv', 'data/rift-spatial-sector-layouts.csv']
def old(p): return subprocess.check_output(['git', 'show', 'HEAD:'+p]).decode()
def rows(s): return list(csv.DictReader(io.StringIO(s)))
def sha(b): return hashlib.sha256(b).hexdigest()
native_before, native_after = [rows(s) for s in (old(paths[0]), Path(paths[0]).read_text())]
layout_before, layout_after = [rows(s) for s in (old(paths[1]), Path(paths[1]).read_text())]
old_by = {r['world_id']:r for r in native_before}; new_by = {r['world_id']:r for r in native_after}
assert len(old_by) == len(native_before) and len(new_by) == len(native_after)
assert old_by.keys() == new_by.keys()
untouched = [w for w in old_by if w not in worlds]
assert all(old_by[w] == new_by[w] for w in untouched)
assert [r for r in layout_before if r['world_id'] not in worlds] == [r for r in layout_after if r['world_id'] not in worlds]
results=[]
for w in worlds:
    b,a = old_by[w],new_by[w]
    assert all(b[k] == a[k] for k in b if k not in ['instances','shape_profiles'])
    bi,ai=b['instances'].split('|'),a['instances'].split('|')
    bp,ap=b['shape_profiles'].split('|'),a['shape_profiles'].split('|')
    assert ai[:len(bi)]==bi and ap[:len(bp)]==bp and len(ai)==len(ap)
    bl=[r for r in layout_before if r['world_id']==w]; al=[r for r in layout_after if r['world_id']==w]
    assert al[:len(bl)] == bl
    assert len({r['id'] for r in al}) == len(al)
    assert len(ai)-len(bi) == len(al)-len(bl)
    source_counts={}
    for instance in ai:
        t=instance.split(':'); assert len(t)==13 and t[1] in ['solid','relief']
        for v in t[2:]: assert isinstance(float(v),float)
        source_counts[t[1]]=source_counts.get(t[1],0)+1
    for role,count in source_counts.items():
        indices=[int(r['source_index']) for r in al if r['role']==role]
        assert sorted(indices)==list(range(count)), (w,role,indices,count)
    for r,instance in zip(al[len(bl):],ai[len(bi):]):
        t=instance.split(':'); assert t[0] == a['family'] and t[1]=='solid' and r['role']=='solid'
    results.append({'worldId':w,'originalSources':len(bi),'addedSources':len(ai)-len(bi),
        'originalPlacements':len(bl),'addedPlacements':len(al)-len(bl),
        'originalFieldsAndOrderPreserved':True,'uniqueContiguousRoleSourceReferences':True,
        'addedIds':[r['id'] for r in al[len(bl):]],'addedSameFamilySolidOnly':True})
changes=subprocess.check_output(['git','diff','--name-only','--','data','src']).decode().splitlines()
allowed={'data/rift-native-worlds.csv','data/rift-spatial-sector-layouts.csv','src/generated/r100-native-worlds.ts','src/generated/r100-spatial-data.ts'}
assert set(changes)<=allowed, changes
report={'status':'passed','checkedAt':datetime.now(timezone.utc).isoformat(),
    'baselineCommit':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),
    'sources':{p:{'baselineSha256':sha(old(p).encode()),'worktreeSha256':sha(Path(p).read_bytes())} for p in paths},
    'totalNativeRows':len(native_before),'unchangedWorldCount':len(untouched),'unchangedWorldIds':untouched,
    'dataAndSourceChangedFiles':changes,'cases':results,
    'limits':['CSV semantics and source preservation only. Generated footprint and gameplay correctness are separate checks.','Numbers are parsed, not an independent restatement of every production CSV schema.']}
out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'unchangedWorldCount':len(untouched),'cases':results},ensure_ascii=False))
