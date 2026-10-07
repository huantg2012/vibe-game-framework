import json,pathlib,hashlib,math,collections,datetime
R=pathlib.Path('/Users/yilungao/coh'); B=R/'docs/qa/artifacts/r100-i10-i12/b04-raised-qualified'; D=R/'docs/qa/artifacts/r100-i10-i12/b04-worker-failure-diagnosis'
def read(p): return json.loads(p.read_text())
def ref(p): return {'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
s=read(B/'play-summary-v3.json'); previous=read(B/'play-summary-v2.json'); plan=read(B/'play-summary-plan-v2.json'); policy0=read(B/'play/policy-freeze.json'); diagnosis=read(D/'observed-diagnosis.json')
assert s['attempts']==previous['attempts'] and s['pairs']==previous['pairs'] and s['sources']==previous['sources']
assert {k:(previous.get(k),s.get(k)) for k in set(previous)|set(s) if previous.get(k)!=s.get(k)}.keys()=={'createdAt','emptyReturns','nearEntryOnlyReturns'}
assert s['planSha256']==ref(B/'play-summary-plan-v2.json')['sha256']
expected=[(x['world'],x['grade'],x['seed']) for x in policy0['cases']]; assert len(expected)==len(set(expected))==24
indexByKey={k:i+1 for i,k in enumerate(expected)}
assert [(a['world'],a['grade'],a['seed']) for a in s['attempts']]==expected+[expected[x-1] for x in [12,20,24]]
assert s['status']=='pass' and s['qualifiedGradePairs']==12 and s['completedSeedProcesses']==24 and s['actualAttempts']==27
assert (s['searchAndExtractAttempts'],s['nearEntryOnlyReturns'],s['emptyReturns'],s['deaths'],s['invalidOrIncompleteProcesses'])==(22,2,0,0,3)
source=ref(R/s['sources'][0]['sourceManifest']);manifest=read(R/source['path']);frozen=pathlib.Path(manifest['temporaryRoot']);rawByReport={};batchRefs=[];policyRefs=[]
for si,sourceRow in enumerate(s['sources']):
 folder=R/sourceRow['folder'];policy=read(folder/'policy-freeze.json');batch=read(folder/'batch-report.json')
 assert ref(folder/'policy-freeze.json')['sha256']==sourceRow['policySha256'] and ref(folder/'batch-report.json')['sha256']==sourceRow['reportSha256']
 assert sourceRow['sourceManifest']==source['path'] and sourceRow['sourceManifestSha256']==source['sha256']
 assert policy['manifestSha256']==source['sha256'] and policy['gameUrl']=='http://127.0.0.1:3110/'
 assert pathlib.Path(policy['storage']).read_bytes()==pathlib.Path(policy0['storage']).read_bytes()
 assert hashlib.sha256(pathlib.Path(policy['storage']).read_bytes()).hexdigest()==policy['storageSha256']==policy0['storageSha256']
 if si:
  allowed={'frozenAt','cases','storage','expansion'}
  assert all(policy[k]==policy0[k] for k in set(policy)|set(policy0) if k not in allowed)
  assert policy['expansion']['sha256']==policy0['expansion']['sha256'] and pathlib.Path(policy['expansion']['plan']).read_bytes()==pathlib.Path(policy0['expansion']['plan']).read_bytes()
  assert [(x['world'],x['grade'],x['seed']) for x in policy['cases']]==[expected[[12,20,24][si-1]-1]]
 batchRefs.append(ref(folder/'batch-report.json'));policyRefs.append(ref(folder/'policy-freeze.json'))
 for raw in batch['attempts']:
  key=str((folder/raw['dir']/'report.json').relative_to(R));assert key not in rawByReport;rawByReport[key]=raw
assert len(rawByReport)==27
rows=[];failures=[];totals=collections.Counter();allRefs=[]
for index,a in enumerate(s['attempts'],1):
 p=R/a['report'];r=read(p);j=r['realJourneyAttempts'][0];raw=rawByReport[a['report']];folder=p.parent/a['grade']
 assert len(r['realJourneyAttempts'])==1 and ref(p)['sha256']==a['reportSha256'];allRefs.append(ref(p))
 assert (a['world'],a['grade'],a['seed'])==(raw['world'],raw['grade'],raw['seed'])
 assert r['harnessSha256']==policy0['harnessSha256'] and r['harnessDependencies']==policy0['dependencies'] and r['policyRevision']==15
 assert r['controlledWorld']==a['world'] and r['controlledBuild'] is None
 before=j['before']['state'];assert read(folder/'1-before.save.json')==before
 if not a['processComplete']:
  assert index in [12,20,24] and raw['exitCode']==a['exitCode']==1 and raw['status']=='failed-script' and j['status']=='failed'
  assert all(k not in j for k in ['identity','entrySave','entryState','fieldResult','afterReturn'])
  rejected=read(folder/'1-rejected-state.json');last= json.loads(rejected['lastCompleteRaw'])
  for state in [rejected,last]:
   assert state['inventory']['run']==before['inventory']['run'] and state['inventory']['riftWorldHistory']==before['inventory']['riftWorldHistory']
  replayIndex=24+[12,20,24].index(index);replayPath=R/s['attempts'][replayIndex]['report'];replay=read(replayPath)['realJourneyAttempts'][0]
  assert j['before']==replay['before'] and j['loadout']==replay['loadout'] and j['equipmentChanges']==replay['equipmentChanges']
  assert replay['identity']['generation']['requestedSeed']==a['seed']
  kind='surface-preparation' if index==24 else 'generation'
  assert ('Native surface preparation Worker failed' if index==24 else 'Generation worker failed') in j['failure']
  failures.append({'originalIndex':index,'world':a['world'],'grade':a['grade'],'requestedSeed':a['seed'],'workerKind':kind,'report':ref(p),'beforeSave':ref(folder/'1-before.save.json'),'rejectedState':ref(folder/'1-rejected-state.json'),'journey':ref(folder/'journey.jsonl'),'console':ref(folder/'console.json'),'failure':j['failure'],'startedAt':raw['startedAt'],'endedAt':raw['endedAt'],'replay':ref(replayPath),'beforeAndLoadoutExact':True,'previousRunAndHistoryPreserved':True,'originalCommittedIdentityAbsent':True,'boundary':'Same fixed request/source/before-save, not an equality claim against a nonexistent original committed field identity.'})
  continue
 assert raw['exitCode']==a['exitCode']==0 and raw['status']=='completed-script' and j['status']=='completed-real-input'
 assert j['errors']==[] and j['consoleErrors']==[] and j['noStateInjection'] is False
 identity=j['identity']['generation'];assert identity['requestedSeed']==a['seed'] and identity['package']['algorithmRevision']==6 and identity['package']['id']=='r100-'+a['world'] and identity['package']['grade']==a['grade']
 e=j['entrySave']['state'];after=j['afterReturn']['state'];er=e['inventory']['run'];ar=after['inventory']['run']
 assert read(folder/'1-entry.save.json')==e and read(folder/'1-returned.save.json')==after
 assert er['id']==ar['id'] and er['status']=='active' and ar['status']=='settled' and ar['baseSettled'] is True and ar['outcome']==j['outcome']=='extract'
 events=[json.loads(line) for line in (folder/'journey.jsonl').read_text().splitlines()]
 en={x['id']:x for x in j['entryState']['nodes']};changed=[x for x in j['fieldResult']['nodes'] if x['collected'] and not en[x['id']]['collected']];pickups=[]
 for x in changed:
  n=en[x['id']];dist=math.hypot(n['pos']['x']-j['entryState']['pos']['x'],n['pos']['y']-j['entryState']['pos']['y']);pickups.append({'id':x['id'],'kind':x['kind'],'tier':x['tier'],'distanceFromEntry':dist})
  if x['kind']=='contaminant':
   assert x['id'] in ar['revealedNodes'];assert any(z['id'] in ar['returnedIds'] and z.get('source',{}).get('nodeId')==x['id'] and z.get('source',{}).get('runId')==ar['id'] for z in after['inventory']['items'])
  else:assert ar['kindlingGained']>0
 assert len(changed)==a['actualPickups'] and len(changed)<=3 and sum(x['distanceFromEntry']<=320 for x in pickups)==a['nearEntryPickups']
 assert bool(any(x['distanceFromEntry']>320 for x in pickups))==a['searchAndExtract']
 assert {x['id'] for x in pickups if x['distanceFromEntry']>320}=={x['id'] for x in a['collected']}
 active=[x for x in events if x['event']=='known-tool-context-input'];receipts=list(ar['actionReceipts'].values());assert all(x['used'] in [0,1] for x in active);assert sum(x['used'] for x in active)==len(receipts)
 assert collections.Counter(x['item']['id'] for x in active if x['used']==1)==collections.Counter(x['itemId'] for x in receipts)
 tools=[];ai={z['id']:z for z in after['inventory']['items']}
 for item in e['inventory']['items']:
  if item['location']['kind']!='carried':continue
  data=item[item['kind']];remaining=data.get('usesRemaining',0);end=ai.get(item['id']);final=end[item['kind']].get('usesRemaining',0) if end else 0
  assert final<=remaining and (end is not None or item['id'] in ar['destroyedIds']);used=remaining-final
  if item['kind']=='contaminant':assert used==sum(x['itemId']==item['id'] for x in receipts)
  if used:
   definition=data.get('definitionId',data.get('catalog',{}).get('definitionId'));tools.append({'id':item['id'],'definition':definition,'kind':item['kind'],'before':remaining,'after':final,'used':used,'destroyed':end is None});totals[definition]+=used
 passive=sum(x['usesConsumed'] for x in ar['passiveReceipts']);totals['passive-sight-at-departure']+=passive
 hp=[j['entryState']['hp'],j['fieldResult']['hp']];chaos=[j['entryState']['chaos'],j['fieldResult']['chaos']]
 for x in events:
  q=x.get('state',{})
  if x['event']=='snapshot' and q.get('scene')=='rift':hp.append(q['hp']);chaos.append(q['chaos'])
 entrymods={x['id']:x['hp'] for x in e['modules']};modloss={x['id']:entrymods[x['id']]-x['hp'] for x in after['modules']}
 rows.append({'actualIndex':index,'originalIndex':indexByKey[(a['world'],a['grade'],a['seed'])],'world':a['world'],'grade':a['grade'],'requestedSeed':a['seed'],'effectiveSeed':j['identity']['seed'],'identity':j['identity'],'runId':ar['id'],'report':ref(p),'journey':ref(folder/'journey.jsonl'),'entrySave':ref(folder/'1-entry.save.json'),'settledSave':ref(folder/'1-returned.save.json'),'outcome':'non-entry-search-and-extract' if a['searchAndExtract'] else ('near-entry-extract' if changed else 'empty-extract'),'actualPickups':pickups,'fieldHp':j['fieldResult']['hp'],'minRecordedSnapshotHp':min(hp),'maxRecordedSnapshotChaos':max(chaos),'elapsedMs':j['fieldResult']['elapsedMs'],'settledKindling':ar['kindlingGained'],'returnedLootCount':len(ar['returnedIds']),'reserveDelta':after['kindlingReserve']-e['kindlingReserve'],'moduleDamage':modloss,'toolConsumption':tools,'activeToolInputs':len(active),'consumingToolInputs':sum(x['used'] for x in active),'nonConsumingInputs':[x for x in active if x['used']==0],'departurePassiveUses':passive,'searchDecisions':[{'id':q['id'],'decision':q['searchDecision']} for q in j['searches']],'abandonedApproaches':[{'reason':q['reason'],'target':q['target']['id']} for q in events if q['event']=='abandoned-observed-approach']})
assert len(rows)==24 and len(failures)==3 and len({r['runId'] for r in rows})==24
assert {r['originalIndex'] for r in rows}==set(range(1,25))
def mix32(seed,label):
 h=seed&0xffffffff
 for c in label:h=((h^ord(c))*0x9e3779b9)&0xffffffff
 h^=h>>16;h=(h*0x7feb352d)&0xffffffff;h^=h>>15;return h&0xffffffff
scheduleInputs=[]
for rel in ['src/generation/seed-fork.ts','src/generation/world-study/r100-production-map.ts']:
 p=frozen/rel;assert hashlib.sha256(p.read_bytes()).hexdigest()==manifest['sources'][rel];scheduleInputs.append({'path':str(p),'relativeSourcePath':rel,'sha256':manifest['sources'][rel]})
assert 'attempt < 8' in (frozen/'src/generation/world-study/r100-production-map.ts').read_text()
assert 'r100-native-v3-attempt-${attempt}' in (frozen/'src/generation/world-study/r100-production-map.ts').read_text()
for r in rows:
 schedule=[r['requestedSeed']]+[mix32(r['requestedSeed'],f'r100-native-v3-attempt-{i}') for i in range(1,8)];assert r['effectiveSeed'] in schedule;r['matchingGenerationAttempt']=schedule.index(r['effectiveSeed'])
for w in plan['worlds']:
 for g in ['low','medium','severe']:assert any(r['outcome']=='non-entry-search-and-extract' for r in rows if r['world']==w and r['grade']==g)
assert sum(r['outcome']=='non-entry-search-and-extract' for r in rows)==22 and sum(r['outcome']=='near-entry-extract' for r in rows)==2
# Recount only the three externally observed replays; original failures had no equivalent trace.
observerCounts=collections.Counter();observations=[]
for drow in diagnosis['rows']:
 allEvents=[]
 for f in drow['observations']:
  assert ref(R/f['path'])==f;allEvents.extend(json.loads(x) for x in (R/f['path']).read_text().splitlines())
 for e in allEvents:observerCounts[e['event']]+=1
 responses=[x for x in allEvents if x['event']=='response'];workers=[x for x in allEvents if x['event'].startswith('worker-')]
 assert len(responses)==drow['networkResponses']==657 and all(x['status']<400 for x in responses)
 assert not any(x['event'] in ['requestfailed','pageerror','page-crashed','Target.targetCrashed','console-error'] for x in allEvents)
 assert workers==drow['workerLifecycle'] and len(workers)==6
 assert [x['event'] for x in workers]==['worker-created','worker-closed']*3
 assert [x['url'] for x in workers[::2]]==['http://127.0.0.1:3110/src/generation/rift-generation-worker.ts?worker_file&type=module']*2+['http://127.0.0.1:3110/src/systems/r100-world/surface-preparation-worker.ts?worker_file&type=module']
 assert all(workers[i]['url']==workers[i+1]['url'] and workers[i]['at']<workers[i+1]['at'] for i in [0,2,4])
 assert len([x for x in allEvents if x['event']=='context-closed'])==1
 observations.append({'world':drow['world'],'grade':drow['grade'],'files':drow['observations'],'responses':len(responses),'workerLifecycle':workers,'observerErrors':0})
assert observerCounts['response']==1971 and observerCounts['worker-created']==observerCounts['worker-closed']==9
frames=[]
for originalIndex,filename in [(12,'1-search-1.png'),(20,'1-search-2.png'),(24,'1-search-1.png')]:
 row=next(r for r in rows if r['originalIndex']==originalIndex);p=(R/row['report']['path']).parent/row['grade']/filename
 frames.append({'originalIndex':originalIndex,'image':ref(p),'report':row['report'],'actualPickups':row['actualPickups'],'settledKindling':row['settledKindling'],'returnedLootCount':row['returnedLootCount'],'visuallyReviewedByThisAudit':False})
summary={'completed':len(rows),'retainedFailures':len(failures),'nonEntry':22,'nearOnly':2,'empty':0,'deaths':0,'kindling':sum(r['settledKindling'] for r in rows),'contaminants':sum(r['returnedLootCount'] for r in rows),'activeToolInputs':sum(r['activeToolInputs'] for r in rows),'consumingInputs':sum(r['consumingToolInputs'] for r in rows),'withHpLoss':sum(r['minRecordedSnapshotHp']<145 for r in rows),'withoutActiveToolInputs':sum(r['activeToolInputs']==0 for r in rows)}
for row in rows:print(json.dumps({k:row[k] for k in ['actualIndex','originalIndex','world','grade','outcome','actualPickups','fieldHp','maxRecordedSnapshotChaos','elapsedMs','toolConsumption','settledKindling','returnedLootCount']},ensure_ascii=False))
print('TOTAL',summary,'TOOLS',dict(totals),'OBS',dict(observerCounts))
# Receipt intentionally retains incomplete attempts as failures, rather than replacing source records.
out={'status':'bounded-independent-process-data-pass-with-retained-precommit-worker-failures','reviewer':'identity_shapes','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'B04 原24固定过程与3个原失败同请求补验只读独审；不启动浏览器或生成地图，不改原过程/计划/阈值。','auditScript':ref(pathlib.Path(__file__)),'canonicalSummary':ref(B/'play-summary-v3.json'),'inputs':[ref(B/x) for x in ['play-summary-plan-v2.json','play-summary-v2.json','independent-gameplay-attempt1-review.json','independent-process-draft-error.json']]+[ref(D/x) for x in ['observed-diagnosis.json','original-three-failures.json','node-identity-report.json','cache-isolation.json','root-launcher-repair.json','observer-v2-derivation.json']]+batchRefs+policyRefs,'source':source,'coverage':{'worlds':plan['worlds'],'grades':['low','medium','severe'],'requestedSeeds':[20261005,3075192741],'uniqueFixedRequests':24,'actualAttempts':27,'qualifiedGradePairs':12,**summary},'accountingRepair':{'previousSummary':ref(B/'play-summary-v2.json'),'attemptsPairsSourcesExact':True,'changedFields':['createdAt','emptyReturns','nearEntryOnlyReturns'],'oldEmptyReturns':2,'actualNearEntryOnlyReturns':2,'actualEmptyReturns':0,'boundary':'原008和012补验均已拾取近入口物品并结算，不能称空返。仅重算分类，不重跑游戏、不改变12档对准入。'},'integrity':['四batch/policy与27report逐SHA核对；唯一固定身份24，原012/020/024失败和各一次成功补验全部保留。','3110冻结manifest、原earned-storage字节、policy15/harness及依赖相同；补验只选原失败请求，保留原完整qualification-plan。','三失败缺少committed identity/entry/field/settlement；核前存档、loadout、equipmentChanges相同且失败后旧run/history未提交更新；不声称比较了不存在的原field identity。','24完成过程逐项核requested world/grade/seed/revision6；entry/returned保存原件与report exact，同run active→settled extract/baseSettled。','按entry→terminal实际节点变化核拾取，非预设target；污染物回到同run/node的returnedIds，薪柴实际结算。','主动输入used值按item对账actionReceipts/余次，耗尽销毁、武器与出征被动消耗分别记录。'],'allRawReports':allRefs,'retainedOriginalFailures':failures,'completedProcessRows':rows,'generationSchedule':{'inputs':scheduleInputs,'matchingAttemptByOriginalIndex':{str(r['originalIndex']):r['matchingGenerationAttempt'] for r in rows},'boundary':'仅核有效种子属于冻结8次准入序列；未凭成功推断内部重抽拒绝原因。'},'toolConsumption':dict(totals),'observer':{'diagnosis':ref(D/'observed-diagnosis.json'),'replays':observations,'counts':dict(observerCounts),'boundary':'仅3补验具有外部Worker/network观察；9次创建/关闭按URL/时序核，旧observer没有独立workerId，不能扩写为27次零异常。'},'rootReplayFrames':frames,'highestPressure':max(rows,key=lambda r:r['maxRecordedSnapshotChaos']),'highestElapsed':max(rows,key=lambda r:r['elapsedMs']),'nearEntryOnly':[r for r in rows if r['outcome']=='near-entry-extract'],'limits':['固定controlledWorld/seed、成熟earned-save副本及几何辅助专家路线，noStateInjection=false明确披露；不属于自然48趟或新人体验。','原012/020为generation Worker失败，024为surface Worker失败，均在字段提交前；原始故障无完整网络/目标trace，原因仍未确定，P36不据此关闭。','3补验无观察错误仅证明同冻结输入在该环境可完成；独立缓存、停止闲置服务、外部观察器及时间变化不能反推原失败根因。','初次诊断launcher导入错误作为独立QA执行失败保留，不计游戏case；不与原3Worker错误混合。','两近入口携返不计非入口成功，也不称空返；整批PASS不代表每趟深搜/高压。','奖励为24个独立成熟fixture总量，非连续经济收益；HP/chaos是原记录快照，非全帧遥测或性能结论。','本审未打开PNG；三帧为root已查看的补验原帧路径和SHA，不代签画面/听感。','只绑定3110原过程，不自动覆盖后续源码或最终108/324 runtime门槛。']}
p=B/'independent-process-audit-shapes.json';assert not p.exists();p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('FINAL',ref(p))
