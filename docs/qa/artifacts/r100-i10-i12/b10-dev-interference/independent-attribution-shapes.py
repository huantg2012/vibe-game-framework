"""Read-only independent checks over retained B10 transport-interference evidence."""
import collections, datetime, hashlib, itertools, json, pathlib
ROOT=pathlib.Path('/Users/yilungao/coh')
BASE=ROOT/'docs/qa/artifacts/r100-i10-i12'
OUT=BASE/'b10-dev-interference'
def read(p): return json.loads(pathlib.Path(p).read_text())
def ref(p):
 p=pathlib.Path(p);return {'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def referenced(r):
 p=ROOT/r['path'];assert ref(p)==r,r;return p
plan=read(OUT/'plan.json'); diag=read(OUT/'diagnosis.json')
for r in [plan['originalCommand'],plan['originalFailure'],plan['diagnosis'],plan['source'],*plan['references']]: referenced(r)
for k in ['observer','events','viteConfig','devSmoke','originalGameReport','originalBatch','originalExecution']:referenced(diag[k])
command=read(referenced(plan['originalCommand']))['play']
policy=read(BASE/'b10-current-qualified/play/policy-freeze.json')
batch=read(referenced(diag['originalBatch']))
assert batch['status']=='stopped-after-failed-attempt' and len(batch['attempts'])==12
casekeys=['world','grade','seed','index','dir','role']
assert [{k:a[k] for k in casekeys} for a in batch['attempts']]==[{k:a[k] for k in casekeys} for a in policy['cases'][:12]]
allowed={'QA_WORLDS','QA_GRADES','QA_SEEDS','QA_OUTPUT_DIR','QA_WORKER_OBSERVER_DIR','QA_WORKER_OBSERVER_FAILURE_FILE'}
for stage,expected in zip(plan['stages'],[policy['cases'][11:12],policy['cases'][12:]]):
 assert stage['command']==command['command'] and stage['args']==command['args']
 assert stage['env'].keys()==command['env'].keys()
 assert all(v==command['env'][k] for k,v in stage['env'].items() if k not in allowed)
 tuples=list(itertools.product(stage['worlds'],stage['grades'],stage['seeds']))
 assert tuples==[(r['world'],r['grade'],r['seed']) for r in expected]
 assert len(tuples)==stage['cases']
original=read(referenced(diag['originalGameReport']))['realJourneyAttempts'][0]
recheckReport=OUT/'012-same-identity-recheck/play/001-crossed-casings-severe-3075192741/report.json'
recheck=read(recheckReport)['realJourneyAttempts'][0]
recheckPolicyPath=OUT/'012-same-identity-recheck/play/policy-freeze.json'; rp=read(recheckPolicyPath)
policyAllowed={'frozenAt','cases','storage','observationFailureFile','expansion'}
assert policy.keys()==rp.keys()
assert all(policy[k]==rp[k] for k in policy if k not in policyAllowed)
assert {k:v for k,v in policy['expansion'].items() if k!='plan'}=={k:v for k,v in rp['expansion'].items() if k!='plan'}
assert pathlib.Path(policy['expansion']['plan']).read_bytes()==pathlib.Path(rp['expansion']['plan']).read_bytes()
assert pathlib.Path(policy['storage']).read_bytes()==pathlib.Path(rp['storage']).read_bytes()
assert original['identity']==recheck['identity']
assert original['before']['state']==recheck['before']['state']
assert original['entryState']['nodes']==recheck['entryState']['nodes']
assert original['identity']['generation']['requestedSeed']==3075192741
assert original['identity']['recipeId']=='r100-native-v3:crossed-casings-severe'
processes=[]
for label,a,p in [('original',original,referenced(diag['originalGameReport'])),('recheck',recheck,recheckReport)]:
 assert a['status']=='completed-real-input' and a['outcome']=='extract' and a['errors']==[] and a['consoleErrors']==[]
 before=a['entrySave']['state']['inventory']['run']; after=a['afterReturn']['state']['inventory']['run']
 assert before['id']==after['id'] and before['status']=='active' and after['status']=='settled'
 assert after['outcome']=='extract' and after['baseSettled'] is True
 newly=[n for n in a['fieldResult']['nodes'] if n['collected'] and not next(x for x in a['entryState']['nodes'] if x['id']==n['id'])['collected']]
 assert [n['id'] for n in newly]==['r100-contaminant-safe-1']
 assert len(after['returnedIds'])==1
 assert after['returnedIds'][0].endswith('_r100-contaminant-safe-1')
 assert any(i['id']==after['returnedIds'][0] and i['source']['runId']==after['id'] and i['source']['nodeId']=='r100-contaminant-safe-1' for i in a['afterReturn']['state']['inventory']['items'])
 processes.append({'kind':label,'report':ref(p),'sameRunSettled':True,'runId':after['id'],'pickupNodes':[n['id'] for n in newly],'returnedIds':after['returnedIds'],'elapsedMs':a['fieldResult']['elapsedMs'],'hp':a['fieldResult']['hp'],'chaos':a['fieldResult']['chaos'],'ownJourneyErrors':0})
raw=referenced(diag['observer']); es=[json.loads(s) for s in raw.read_text().splitlines()]
select=lambda kind:[e for e in es if e['event']==kind]
assert [(e['browserId'],e['contextId'],e['pageId']) for e in select('page-created')]==[(1,1,1),(1,1,2)]
assert len(select('page-navigation'))==1 and select('page-navigation')[0]['url']=='http://127.0.0.1:3120/'
failed=select('requestfailed'); errors=[e for e in select('console') if e['type']=='error']
assert len(failed)==len(errors)==8
assert all(e['url']=='http://127.0.0.1:3188/' and e['failure']['errorText']=='net::ERR_CONNECTION_REFUSED' and e['contextId']==1 for e in failed)
assert all(e['pageId']==2 and e['location']['url']=='http://127.0.0.1:3188/' for e in errors)
assert not select('pageerror')
workers=select('worker-created'); closed=select('worker-closed')
assert len(workers)==len(closed)==3 and {e['workerId'] for e in workers}=={e['workerId'] for e in closed}
assert all(e['pageId']==1 and e['url'].startswith('http://127.0.0.1:3120/') for e in workers)
targets=[(n+1,e) for n,e in enumerate(es) if e['event']=='Target.targetInfoChanged' and e.get('data',{}).get('targetInfo',{}).get('url')=='http://127.0.0.1:3188/']
assert targets
obsPaths=sorted((OUT/'012-same-identity-recheck/worker-observations').glob('*.jsonl')); replayEvents=[json.loads(s) for p in obsPaths for s in p.read_text().splitlines()]
counts=collections.Counter(e['event'] for e in replayEvents)
assert counts['page-created']==counts['page-closed']==counts['context-created']==counts['context-closed']==1
assert counts['worker-created']==counts['worker-closed']==3
assert {e['workerId'] for e in replayEvents if e['event']=='worker-created'}=={e['workerId'] for e in replayEvents if e['event']=='worker-closed'}
assert all(e['url'].startswith('http://127.0.0.1:3120/') for e in replayEvents if e['event'] in ['page-navigation','worker-created'])
assert not any(e['event'] in ['requestfailed','pageerror'] or (e['event']=='console' and e['type']=='error') for e in replayEvents)
assert not (OUT/'012-same-identity-recheck/worker-observation-first-error.json').exists()
replayBatch=read(OUT/'012-same-identity-recheck/play/batch-report.json')
assert replayBatch['status']=='completed-fixed-attempts-pending-review' and len(replayBatch['attempts'])==1 and replayBatch['attempts'][0]['exitCode']==0
sourcePaths=['vite.config.ts','node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js','node_modules/vite/bin/openChrome.applescript','node_modules/vite/dist/client/client.mjs','tools/world-study/r100-frozen-server.mjs','tools/qa/r100-worker-observer.mjs']
receipt={'status':'bounded-attribution-and-fixed-identity-recheck-confirmed','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewer':'identity_shapes','method':'Read-only original JSONL/source/policy/save/report comparison; no browser or map execution. The pipeline continuation is reviewed but its remaining12 completion is not asserted.','inputs':[ref(OUT/n) for n in ['diagnosis.json','plan.json','run.mjs','input-plan-exact.json','012-recheck-observation.json','independent-attribution-draft-error.json']]+[ref(raw),ref(recheckPolicyPath),ref(BASE/'b10-current-qualified/play/policy-freeze.json')]+[ref(ROOT/p) for p in sourcePaths],'conclusion':{'origin':'Owned Vite3188 dev smoke opened a real second page in the same observed QA browser/context. Closing that server left its reconnect ping failing.','notIndicated':['No3120 page navigation to3188','No3120 generation/surface Worker URL rewrite','No cross-context observer misattribution'],'operatorCorrection':'The original dev-smoke statement that no additional browser was involved was inaccurate: the command indirectly opened a page. Original receipt retained with diagnosis correction.','basis':'Original page2 and CDP URL events + operator command/timing + installed Vite openBrowser/AppleScript and client ping implementation. No OS-level osascript trace was captured.','p36':'This specific environment cause does not establish the cause of historical intermittent preentry Worker failures.'},'originalObservation':{'pages':2,'contexts':1,'failedFetches3188':8,'consoleErrorsPage2':8,'gamePage1OwnErrors':0,'matchedWorkers3120':3,'firstFailedAt':failed[0]['at'],'lastFailedAt':failed[-1]['at'],'timeline':[{'line':i+1,**e} for i,e in enumerate(es) if e['event'] in ['page-created','page-navigation']]+[{'line':i,'at':e['at'],'event':e['event'],'targetInfo':e['data']['targetInfo']} for i,e in targets]},'originalAndReplay':processes,'replayObservation':{'inputs':[ref(p) for p in obsPaths],'pages':1,'contexts':1,'workersCreatedAndClosed':3,'failures':0},'inputContinuity':{'originalAttemptedPrefix12Exact':True,'recheckOnlyOriginalIndex':12,'remainingOriginalIndices':list(range(13,25)),'environmentAllowedChanges':sorted(allowed),'sameFrozenSource':plan['source'],'fullGenerationIdentityExact':True,'preDepartureStateExact':True,'earnedStorageBytesExact':True,'policyExceptOutputCaseTimeMetadataExact':True,'sameEntryNodesExact':True,'newRunIdsExpected':'A replay starts a new actual run; each run independently settled its own returned pickup, rather than equating run UUIDs.'},'limitations':['Original012 environment-failed context remains invalid as clean observer evidence despite successful extraction.','No claim that the extra page had zero focus/CPU effect on original012.','Recheck does not replace original012; final accounting should retain25 actual attempts for24 original fixed identities when remaining12 complete.','No natural48, final324, performance, art or historicalP36 approval from this review.'],'reviewDraftError':{'error':"KeyError: 'type' while inspecting observer records before using their actual event field",'scope':'Read-only exploratory summary command only; no game execution, report mutation, or failed gameplay check.'}}
path=OUT/'independent-attribution-shapes.json'
with path.open('x') as f:json.dump(receipt,f,ensure_ascii=False,indent=2);f.write('\n')
print(json.dumps(ref(path)));print('READ-ONLY CHECKS PASS')
