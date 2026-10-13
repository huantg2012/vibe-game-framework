"""Audit completed final receipts and their scope; does not rerun generator/build."""
import hashlib,itertools,json,sys
from datetime import datetime,timezone
from pathlib import Path
base=Path('docs/qa/artifacts/stealth-obstacles-2026-10-13')
output=Path(sys.argv[1]);assert not output.exists()
def read(p): return json.loads((base/p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
production=read('root-owned/production-final/report.json')
assert production['status']=='passed' and production['failures']==[]
expected=set(itertools.product(production['worlds'],production['grades'],production['seeds']))
seen=[(c['worldId'],c['grade'],c['seed']) for c in production['cases']]
assert len(seen)==len(set(seen))==18 and set(seen)==expected
source_mismatch=[p for p,h in production['sourceHashes'].items() if sha(p)!=h]
assert source_mismatch==[],source_mismatch
for c in production['cases']:
 assert c['bodies']['bodySize']==20 and c['bodies']['reachableRatio']>=.97
 assert c['enemies']=={'low':2,'medium':3,'severe':4}[c['grade']]
 assert c['kindlingNodes']=={'low':4,'medium':5,'severe':5}[c['grade']]
 assert c['contaminantNodes']=={'low':2,'medium':3,'severe':4}[c['grade']]
 assert all(w['durationMs']>=2400 for w in c['expedition']['patrolWindows'])
 recipe=read(f"root-owned/production-final/{c['worldId']}-{c['grade']}-{c['seed']}/recipe.json")
 assert recipe['package']['algorithmRevision']==10
replay=read('code/after-final-old-replay.json')
assert replay['status']=='passed' and not replay['failures'] and len(replay['cases'])==9
assert len({(c['worldId'],c['grade'],c['seed']) for c in replay['cases']})==9
assert sum('material' in c for c in replay['cases'])==3
negative=read('qa/negative-route-after/summary.json')
assert negative['status']=='failed' and all(c['routeFailures']==['invalid-outside-endpoint'] for c in negative['cases'])
detour_before=read('qa/detour-counterexample-before.json');detour_after=read('qa/detour-counterexample-after.json')
assert detour_before['observed']['reportedPassed'] and not detour_after['observed']['reportedPassed']
files=['root-owned/production-final/report.json','code/after-final-old-replay.json','qa/authoring-preservation-final.json',
 'qa/final-geometry-and-player-void.json','qa/negative-route-after/summary.json','qa/detour-counterexample-before.json','qa/detour-counterexample-after.json']
result={'status':'passed','checkedAt':datetime.now(timezone.utc).isoformat(),'sourceHashesMatchCurrentWorktree':True,
 'productionCases':len(seen),'requestedSeeds':production['seeds'],'completeCartesianProduct':True,
 'minimumReachableBodyRatio':min(c['bodies']['reachableRatio'] for c in production['cases']),
 'minimumPatrolWindowMs':min(w['durationMs'] for c in production['cases'] for w in c['expedition']['patrolWindows']),
 'oldRecipeMapReplays':9,'mediumMaterialFourChannelAndSearchPatchReplays':3,'routeFailureStatusFixed':True,'falseTwoSidedCounterexampleFixed':True,
 'receipts':{p:sha(base/p) for p in files},
 'limits':['Receipt audit of parent/code executions, not a second independent run of all 18 cases or build.',
 'Nine map replays do not mean all nine have four-channel byte replay; only the three medium cases do.',
 'Static/current data/source evidence is not browser runtime, enemy stealth, performance or human visual acceptance.']}
output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
