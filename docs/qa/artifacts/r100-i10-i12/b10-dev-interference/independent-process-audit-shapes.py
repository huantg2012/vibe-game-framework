import json,pathlib,hashlib,math,collections,datetime,itertools
R=pathlib.Path('/Users/yilungao/coh'); B=R/'docs/qa/artifacts/r100-i10-i12/b10-dev-interference'; ORIGINAL=R/'docs/qa/artifacts/r100-i10-i12/b10-current-qualified'
def read(p):return json.loads(p.read_text())
def ref(p):return {'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
s=read(B/'play-summary.json');plan=read(B/'play-summary-plan.json'); commands=read(ORIGINAL/'play-commands.json');ob=read(B/'worker-observation-summary.json');reconciliation=read(B/'reconciliation.json')
originalPolicy=read(ORIGINAL/'play/policy-freeze.json'); expected=[(x['world'],x['grade'],x['seed']) for x in originalPolicy['cases']];assert len(expected)==24 and len(set(expected))==24
indexByKey={k:i+1 for i,k in enumerate(expected)};rawByReport={}; policies=[];batchRefs=[]
for source in s['sources']:
 folder=R/source['folder'];batch=read(folder/'batch-report.json');policy=read(folder/'policy-freeze.json');policies.append(policy)
 assert ref(folder/'batch-report.json')['sha256']==source['reportSha256'] and ref(folder/'policy-freeze.json')['sha256']==source['policySha256']
 assert source['sourceManifestSha256']==commands['source']['sha256'] and policy['algorithmRevision']==6 and policy['controllerPolicyRevision']==15
 assert policy['harnessSha256']==s['sources'][0]['harnessSha256'] and pathlib.Path(policy['storage']).read_bytes()==pathlib.Path(originalPolicy['storage']).read_bytes()
 for key in ['controllerDerivation','servedCatalog','actualPickupLimit','harnessSha256','wrapperSha256','dependencies','wrapperDependencies','parallelism','resourcePauseFile','stopOnFailure']:
  assert policy[key]==originalPolicy[key],key
 batchRefs.append(ref(folder/'batch-report.json'))
 for raw in batch['attempts']:rawByReport[str((folder/raw['dir']/'report.json').relative_to(R))]=raw
assert len(rawByReport)==len(s['attempts'])==25
assert [(x['world'],x['grade'],x['seed']) for x in s['attempts']]==expected[:12]+expected[11:12]+expected[12:]
assert [x['status'] for x in s['sources']]==['stopped-after-failed-attempt','completed-fixed-attempts-pending-review','completed-fixed-attempts-pending-review']
assert s['status']=='pass' and s['qualifiedGradePairs']==12 and s['completedSeedProcesses']==24 and s['actualAttempts']==25
assert s['planSha256']==ref(B/'play-summary-plan.json')['sha256']; assert ref(R/commands['source']['path'])==commands['source']
assert ob['status']=='complete-with-retained-owned-dev-page-failure' and len(ob['contexts'])==25
assert ob['play']==ref(B/'play-summary.json')
rows=[];totals=collections.Counter();refs=[]
for index,(a,raw) in enumerate([(a,rawByReport[a['report']]) for a in s['attempts']],1):
 p=R/a['report']; r=read(p);assert ref(p)['sha256']==a['reportSha256'];refs.append(ref(p));j=r['realJourneyAttempts'][0]
 assert len(r['realJourneyAttempts'])==1 and raw['exitCode']==0 and raw['status']=='completed-script'
 assert (a['world'],a['grade'],a['seed'])==(raw['world'],raw['grade'],raw['seed'])
 identity=j['identity']['generation']; assert identity['requestedSeed']==a['seed'] and identity['package']['algorithmRevision']==6 and identity['package']['id']=='r100-'+a['world'] and identity['package']['grade']==a['grade']
 assert j['status']=='completed-real-input' and j['errors']==[] and j['consoleErrors']==[] and j['noStateInjection'] is False and r['controlledWorld']==a['world'] and r['controlledBuild'] is None
 folder=p.parent/a['grade'];e=j['entrySave']['state'];after=j['afterReturn']['state'];er=e['inventory']['run'];ar=after['inventory']['run']
 assert read(folder/'1-entry.save.json')==e and read(folder/'1-returned.save.json')==after
 assert er['id']==ar['id'] and er['status']=='active' and ar['status']=='settled' and ar['baseSettled'] is True and ar['outcome']==j['outcome']=='extract'
 events=[json.loads(line) for line in (folder/'journey.jsonl').read_text().splitlines()]
 en={x['id']:x for x in j['entryState']['nodes']};changed=[x for x in j['fieldResult']['nodes'] if x['collected'] and not en[x['id']]['collected']]
 pickups=[]
 for x in changed:
  n=en[x['id']];dist=math.hypot(n['pos']['x']-j['entryState']['pos']['x'],n['pos']['y']-j['entryState']['pos']['y']);pickups.append({'id':x['id'],'kind':x['kind'],'tier':x['tier'],'distanceFromEntry':dist})
  if x['kind']=='contaminant':
   assert x['id'] in ar['revealedNodes'];assert any(z['id'] in ar['returnedIds'] and z.get('source',{}).get('nodeId')==x['id'] and z.get('source',{}).get('runId')==ar['id'] for z in after['inventory']['items'])
  else:assert ar['kindlingGained']>0
 assert len(changed)==a['actualPickups'] and len(changed)<=3
 assert bool(any(x['distanceFromEntry']>320 for x in pickups))==a['searchAndExtract']
 assert {x['id'] for x in pickups if x['distanceFromEntry']>320}=={x['id'] for x in a['collected']}
 active=[x for x in events if x['event']=='known-tool-context-input'];receipts=list(ar['actionReceipts'].values());assert all(x['used'] in [0,1] for x in active);assert sum(x['used'] for x in active)==len(receipts)
 assert collections.Counter(x['item']['id'] for x in active if x['used']==1)==collections.Counter(x['itemId'] for x in receipts)
 tools=[]; ai={z['id']:z for z in after['inventory']['items']}
 for item in e['inventory']['items']:
  if item['location']['kind']!='carried':continue
  data=item[item['kind']];remaining=data.get('usesRemaining',0);end=ai.get(item['id']);final=end[item['kind']].get('usesRemaining',0) if end else 0
  assert final<=remaining and (end is not None or item['id'] in ar['destroyedIds'])
  used=remaining-final
  if item['kind']=='contaminant':assert used==sum(x['itemId']==item['id'] for x in receipts)
  if used:tools.append({'id':item['id'],'definition':data.get('definitionId',data.get('catalog',{}).get('definitionId')),'kind':item['kind'],'before':remaining,'after':final,'used':used,'destroyed':end is None});totals[data.get('definitionId',data.get('catalog',{}).get('definitionId'))]+=used
 passive=sum(x['usesConsumed'] for x in ar['passiveReceipts']);totals['passive-sight-at-departure']+=passive
 hp=[j['entryState']['hp'],j['fieldResult']['hp']];chaos=[j['entryState']['chaos'],j['fieldResult']['chaos']]
 for x in events:
  q=x.get('state',{})
  if x['event']=='snapshot' and q.get('scene')=='rift':hp.append(q['hp']);chaos.append(q['chaos'])
 entrymods={x['id']:x['hp'] for x in e['modules']};modloss={x['id']:entrymods[x['id']]-x['hp'] for x in after['modules']}
 row={'index':index,'world':a['world'],'grade':a['grade'],'requestedSeed':a['seed'],'effectiveSeed':j['identity']['seed'],'runId':ar['id'],'report':ref(p),'journey':ref(folder/'journey.jsonl'),'entrySave':ref(folder/'1-entry.save.json'),'settledSave':ref(folder/'1-returned.save.json'),'outcome':'non-entry-search-and-extract' if a['searchAndExtract'] else ('near-entry-extract' if changed else 'empty-extract'),'actualPickups':pickups,'fieldHp':j['fieldResult']['hp'],'minRecordedSnapshotHp':min(hp),'maxRecordedSnapshotChaos':max(chaos),'fieldChaos':j['fieldResult']['chaos'],'elapsedMs':j['fieldResult']['elapsedMs'],'settledKindling':ar['kindlingGained'],'returnedLootCount':len(ar['returnedIds']),'reserveDelta':after['kindlingReserve']-e['kindlingReserve'],'moduleDamage':modloss,'toolConsumption':tools,'activeToolInputs':len(active),'consumingToolInputs':sum(x['used'] for x in active),'nonConsumingInputs':[x for x in active if x['used']==0],'departurePassiveUses':passive,'searchDecisions':[{'id':q['id'],'decision':q['searchDecision']} for q in j['searches']],'abandonedApproaches':[{'reason':q['reason'],'target':q['target']['id']} for q in events if q['event']=='abandoned-observed-approach'],'frames':[str(q.relative_to(R)) for q in sorted(folder.glob('*.png'))]}
 row['originalIndex']=indexByKey[(a['world'],a['grade'],a['seed'])];row['environmentFailedOriginal']=index==12;row['sameIdentityRecheck']=index==13;rows.append(row)


assert len({(r['world'],r['grade'],r['requestedSeed']) for r in rows})==24
assert len({r['runId'] for r in rows})==25
def mix32(seed,label):
 h=seed&0xffffffff
 for c in label:h=((h^ord(c))*0x9e3779b9)&0xffffffff
 h^=h>>16;h=(h*0x7feb352d)&0xffffffff;h^=h>>15
 return h&0xffffffff
for r in rows:
 schedule=[r['requestedSeed']]+[mix32(r['requestedSeed'],f'r100-native-v3-attempt-{i}') for i in range(1,8)]
 assert r['effectiveSeed'] in schedule
 r['matchingGenerationAttempt']=schedule.index(r['effectiveSeed'])
logical=rows[:11]+rows[12:]
assert len(logical)==24 and [r['originalIndex'] for r in logical]==list(range(1,25))
for group,count in [(rows,24),(logical,23)]:assert sum(r['outcome']=='non-entry-search-and-extract' for r in group)==count
assert sum(r['outcome']=='near-entry-extract' for r in logical)==1 and not any(r['outcome']=='empty-extract' for r in rows)
assert s['searchAndExtractAttempts']==24 and s['nearEntryOnlyReturns']==1 and s['emptyReturns']==s['deaths']==0
assert reconciliation['logicalOutcomes']=={'nonEntry':23,'nearOnly':1,'empty':0,'deaths':0}
for w in plan['worlds']:
 for g in ['low','medium','severe']:assert any(r['outcome']=='non-entry-search-and-extract' for r in logical if r['world']==w and r['grade']==g)
observerCounts=collections.Counter();exceptions=[];networks=[]
for f in ob['files']:
 assert ref(R/f['path'])==f
 events=[json.loads(line) for line in (R/f['path']).read_text().splitlines()]
 workerKey=lambda e:tuple(e.get(k) for k in ['browserId','contextId','pageId','workerId'])
 assert collections.Counter(workerKey(e) for e in events if e['event']=='worker-created')==collections.Counter(workerKey(e) for e in events if e['event']=='worker-closed')
 for e in events:
  observerCounts[e['event']]+=1
  if e['event']=='network-summary':networks.append(e)
  if e['event'] in ['requestfailed','pageerror'] or (e['event']=='console' and e['type']=='error'):exceptions.append({**e,'file':f['path']})
assert exceptions==ob['exceptionEvents'] and len(exceptions)==16
assert {x['file'] for x in exceptions}=={'docs/qa/artifacts/r100-i10-i12/b10-current-qualified/worker-observations/observer-40826.jsonl'}
assert len(networks)==25 and sum(n['failed'] for n in networks)==8 and all(n['pending']==[] for n in networks)
assert observerCounts['worker-created']==observerCounts['worker-closed']==75
assert observerCounts['context-created']==observerCounts['context-closed']==25
assert observerCounts['page-created']==observerCounts['page-closed']==26
assert sum(r['activeToolInputs'] for r in rows)>=sum(r['consumingToolInputs'] for r in rows)
for r in rows:print(json.dumps({k:r[k] for k in ['index','originalIndex','world','grade','requestedSeed','outcome','actualPickups','fieldHp','maxRecordedSnapshotChaos','elapsedMs','settledKindling','returnedLootCount','activeToolInputs','toolConsumption']},ensure_ascii=False))
print('TOTALS',dict(totals))
print('OBS',dict(observerCounts))
pathlib.Path('/tmp/r100-b10-audited-rows.json').write_text(json.dumps({'rows':rows,'logical':logical,'totals':dict(totals),'observerCounts':dict(observerCounts)},ensure_ascii=False,indent=2)+'\n')
# Bind the bounded generation schedule to the actual frozen source, not today's author catalog.
manifest=read(R/commands['source']['path']);frozen=pathlib.Path(manifest['temporaryRoot']);scheduleInputs=[]
for rel in ['src/generation/seed-fork.ts','src/generation/world-study/r100-production-map.ts']:
 p=frozen/rel;assert hashlib.sha256(p.read_bytes()).hexdigest()==manifest['sources'][rel]
 scheduleInputs.append({'path':str(p),'relativeSourcePath':rel,'sha256':manifest['sources'][rel]})
assert 'attempt < 8' in (frozen/'src/generation/world-study/r100-production-map.ts').read_text()
assert 'r100-native-v3-attempt-${attempt}' in (frozen/'src/generation/world-study/r100-production-map.ts').read_text()
for a in s['attempts']:
 report=read(R/a['report']);assert report['harnessSha256']==originalPolicy['harnessSha256'] and report['harnessDependencies']==originalPolicy['dependencies'] and report['policyRevision']==15
for r in reconciliation.values():
 if isinstance(r,dict) and set(r)=={'path','sha256'}:assert ref(R/r['path'])==r
assert all(r['moduleDamage']=={'CORE':4,'STORAGE':14,'PURIFIER':4} for r in rows)
assert [r['originalIndex'] for r in logical if r['matchingGenerationAttempt']!=0]==[16]
assert logical[15]['effectiveSeed']==4005187222 and logical[15]['matchingGenerationAttempt']==1
assert sum(r['settledKindling'] for r in logical)==94 and sum(r['returnedLootCount'] for r in logical)==8
assert sum(r['returnedLootCount'] for r in rows)==9
assert sum(r['activeToolInputs'] for r in logical)==sum(r['consumingToolInputs'] for r in logical)==13
assert sum(r['minRecordedSnapshotHp']<145 for r in logical)==1
frameChoices=[]
for originalIndex,filename,reason in [
 (5,'1-search-1.png','notched重档第一seed仅safe320.100px/14.45s，HP145/0主动工具；不证明深搜高压。'),
 (6,'1-return.png','notched重档第二seed实际safe薪柴272.118px携回4薪，近入口搜撤不是空返，也不能计非入口成功。'),
 (10,'1-search-4.png','最大代价：两处接近因visible-opponent-too-close弃选后，取得deep污染物883.810px；72.98s、HP70、chaos93.180。'),
 (10,'1-return.png','同趟带回1污染物，假身4/灰牙2耗尽销毁，武器5；真实代价不可被整批PASS抹去。'),
 (14,'1-search-1.png','fibre低档第二seed只有safe320.100px/15.62s，全HP无主动工具。'),
 (18,'1-search-1.png','fibre重档第二seed同为safe320.100px/15.20s；其第一seed有争夺搜取，不把单趟弱证据扩为两趟均深搜。'),
 (24,'1-return.png','后12最长38.48s，争夺薪柴593.997px携回6薪、灰牙1、HP145；是完整有代价返程，但非HP受压证明。')]:
 row=next(r for r in logical if r['originalIndex']==originalIndex);p=(R/row['report']['path']).parent/row['grade']/filename;assert p.exists()
 frameChoices.append({'originalIndex':originalIndex,'image':ref(p),'reason':reason,'visuallyReviewedByThisAudit':False})
logicalTotals=dict(totals);logicalTotals['passive-sight-at-departure']=24
out={
 'status':'bounded-independent-process-data-pass-with-retained-environment-failure',
 'reviewer':'identity_shapes','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'B10原24固定身份、25实际过程只读独审。012原环境失败与同身份复测分别保留；不改原门槛/种子/数据，不启动地图或浏览器。',
 'auditScript':ref(pathlib.Path(__file__)),
 'inputs':[ref(B/x) for x in ['play-summary-plan.json','play-summary.json','outcomes.json','worker-observation-summary.json','reconciliation.json','independent-attribution-shapes.json','independent-process-draft-error.json']]+[ref(ORIGINAL/'play-commands.json')]+batchRefs,
 'source':commands['source'],
 'coverage':{'uniqueFixedIdentities':24,'actualAttempts':25,'worlds':plan['worlds'],'grades':['low','medium','severe'],'requestedSeeds':[20261005,3075192741],'qualifiedGradePairs':12,'logicalNonEntrySearchAndExtract':23,'logicalNearEntryOnlyReturns':1,'trueEmptyReturns':0,'deaths':0,'rawNonEntrySearchAndExtractAttempts':24,'environmentFailedOriginalAttempts':1,'sameIdentityRechecks':1},
 'integrity':[
  '原24计划三批对账：原1–12、仅原012复测、原13–24；所有report与policy/batch/来源SHA核对，不按目录数字重新解释原索引。',
  '三批使用相同3120冻结源、已获得存档字节、policy15及controller依赖；25实际report逐项核完整requested world/grade/seed与revision6身份。',
  '25 entry/returned实际save与report字段一致，同run active→settled extract/baseSettled；污染物必须同run/node来源在returnedIds/revealedNodes。',
  '实际收集按entry→field节点变化，而非预定target标签；每趟1实际pickup，013号实际尝试是原012复测而非新增覆盖。',
  '13主动工具输入逐项used=1，按item对账actionReceipt与存档余次；武器、耗尽销毁及出征被动视野另计。',
  '28observer JSONL原SHA与全部事件重数：25contexts/75匹配Worker关闭；额外第26页与16异常全部保留并绑定独立归因。'],
 'generationSchedule':{'inputs':scheduleInputs,'requestedUnchanged':24,'effectiveEqualsRequestedUnique':23,'differentEffectiveSeed':{'originalIndex':16,'world':'fibre-stumpfield','grade':'medium','requestedSeed':3075192741,'effectiveSeed':4005187222,'matchingFrozenAttempt':1},'boundary':'有效种子属于固定8次准入序列；原report未保留生成拒绝原因，不猜该原因，也不把它描述成人工换seed或新的游玩重试。'},
 'observation':{'files':ob['files'],'recountedEventCounts':dict(observerCounts),'contexts':25,'networkSummaries':25,'pages':26,'matchedWorkers':75,'failedRequests':8,'consoleErrors':8,'exceptionEvents':exceptions,'independentAttribution':ref(B/'independent-attribution-shapes.json'),'boundary':'原012第二页3188自动打开/关闭后的ping错误，不得过滤为零异常；清洁同identity复测和原13–24没有异常。历史P36因果仍独立。'},
 'economy':{'logicalSeparateFixtureKindling':94,'logicalReturnedContaminants':8,'rawAttemptKindling':94,'rawAttemptReturnedContaminants':9,'logicalActiveToolInputs':13,'logicalConsumingToolInputs':13,'logicalWithoutActiveToolUse':16,'logicalWithHpLoss':1,'perExtractModuleDamage':{'CORE':4,'STORAGE':14,'PURIFIER':4}},
 'logicalToolConsumption':logicalTotals,'rawAttemptToolConsumption':dict(totals),
 'nearEntryOnly':[r for r in logical if r['outcome']=='near-entry-extract'],
 'highestPressureAndCost':logical[9],
 'weakDepthOriginalIndices':[5,6,11,12,14,18],
 'allActualProcessRows':rows,'logicalProcessSelection':'Use the clean observer replay for original012 current evidence; retain original012 raw successful extraction and environment error as a separate actual attempt, never remove it.',
 'rootFrameCandidates':frameChoices,
 'findings':[
  {'severity':'retained-environment-failure','originalIndex':12,'detail':'原012确实搜撤结算，但其context有真实额外开发页错误。通过同source/input身份复测补清洁观察，不能改写原失败或称25过程全无异常。'},
  {'severity':'evidence-boundary','originalIndices':[5,6],'detail':'notched重档两原seed分别只取safe320.100px与近入口272.118px，全HP且无主动工具。既定一seed非入口门槛满足，不证明该world重档深搜压力。'},
  {'severity':'evidence-boundary','originalIndices':[11,12,14,18],'detail':'crossed两重档及fibre低/重第二seed均为safe320.100–320.899px浅部一取一回；保留实际有限深度。'},
  {'severity':'experience-boundary','originalIndices':[10],'detail':'crossed中档第二seed才出现最大损伤/耗尽：损75HP、假身4/灰牙2销毁、武器5，最终取得深部污染物。不能把此一例代替全world全grade压力验证。'}],
 'limits':[
  '所有controlledWorld固定于出发前、geometry辅助专家导航，noStateInjection=false明确披露，controlledBuild=null；不是自然48抽样或新人可用性。',
  '94薪/8污染物为24独立成熟fixture逻辑总量；25实际多1污染物来自重复012，不是连续经济收益。',
  'HP/chaos为原snapshot/终态观测值，不声称全帧遥测或性能。',
  '未打开PNG，原帧建议只由原数据选取供root亲看，不代签材料/画面/体验。',
  '保留本独审初稿把全部effective/requested强行相等的失败；依真实冻结有界生成规则修正审计，而非修改运行结果。',
  '只绑定3120原过程；不自动通过3121或最终324入口/冷续、108性能、混合GC，也不据此关闭历史P36。']}
p=B/'independent-process-audit-shapes.json';assert not p.exists();p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('FINAL',ref(p))
