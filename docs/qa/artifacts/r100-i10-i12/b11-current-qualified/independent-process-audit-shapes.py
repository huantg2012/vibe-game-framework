import json,pathlib,hashlib,math,collections,datetime
R=pathlib.Path('/Users/yilungao/coh'); B=R/'docs/qa/artifacts/r100-i10-i12/b11-current-qualified'
def read(p):return json.loads(p.read_text())
def ref(p):return {'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
s=read(B/'play-summary.json');batch=read(B/'play/batch-report.json');policy=read(B/'play/policy-freeze.json');plan=read(B/'play-summary-plan.json');commands=read(B/'play-commands.json');ob=read(B/'worker-observation-summary.json')
expected={(w,g,t) for w in plan['worlds'] for g in plan['grades'] for t in plan['seeds']}
assert len(expected)==24 and plan['seeds']==[20261005,3075192741]
assert {(x['world'],x['grade'],x['seed']) for x in batch['attempts']}==expected
assert len(batch['attempts'])==len(policy['cases'])==len(s['attempts'])==24
assert batch['endedAt'] and batch['status']=='completed-fixed-attempts-pending-review'
assert policy['manifestSha256']==commands['source']['sha256'] and policy['algorithmRevision']==6 and policy['controllerPolicyRevision']==15
assert ob['status']=='complete-observation' and ob['exceptionEvents']==[] and len(ob['contexts'])==24
rows=[];totals=collections.Counter(); refs=[]
for index,(a,raw) in enumerate(zip(s['attempts'],batch['attempts']),1):
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
 rows.append(row)

assert s['emptyReturns']==0 and s['searchAndExtractAttempts']==24 and s['deaths']==0
assert len({(r['world'],r['grade'],r['requestedSeed']) for r in rows})==24
assert ref(R/commands['source']['path'])['sha256']==commands['source']['sha256']
assert s['planSha256']==ref(B/'play-summary-plan.json')['sha256']
assert s['sources'][0]['policySha256']==ref(B/'play/policy-freeze.json')['sha256']
assert s['sources'][0]['reportSha256']==ref(B/'play/batch-report.json')['sha256']
for f in ob['files']: assert ref(R/f['path'])['sha256']==f['sha256']
Path=pathlib.Path
Path('/tmp/r100-b11-audited-rows.json').write_text(json.dumps({'rows':rows,'totals':dict(totals)},ensure_ascii=False,indent=2)+'\n')
for r in rows: print(json.dumps({k:r[k] for k in ['index','world','grade','requestedSeed','effectiveSeed','actualPickups','fieldHp','minRecordedSnapshotHp','maxRecordedSnapshotChaos','elapsedMs','settledKindling','returnedLootCount','reserveDelta','activeToolInputs','toolConsumption']},ensure_ascii=False))
print('TOTALS',dict(totals))
# Recount original observer JSONL, not only its derivative status.
observerCounts=collections.Counter();networks=[]
for f in ob['files']:
 for line in (R/f['path']).read_text().splitlines():
  event=json.loads(line);observerCounts[event['event']]+=1
  if event['event']=='network-summary':networks.append(event)
assert dict(observerCounts)==ob['eventCounts']
assert len(networks)==24 and all(n['failed']==0 and n['pending']==[] and n['requests']==n['responses'] for n in networks)
assert {(x['world'],x['grade'],x['seed']) for x in policy['cases']}==expected

assert len({r['runId'] for r in rows})==24
assert s['status']=='pass' and s['qualifiedGradePairs']==12 and s['completedSeedProcesses']==24 and s['actualAttempts']==24
assert s['nearEntryOnlyReturns']==s['invalidOrIncompleteProcesses']==0
assert ob['play']==ref(B/'play-summary.json')
assert dict(observerCounts)==ob['eventCounts']
assert observerCounts['worker-created']==observerCounts['worker-closed']==72
assert observerCounts['context-created']==observerCounts['context-closed']==24
assert observerCounts['page-created']==observerCounts['page-closed']==24
for f in ob['files']:
 events=[json.loads(line) for line in (R/f['path']).read_text().splitlines()]
 key=lambda e:tuple(e.get(k) for k in ['browserId','contextId','pageId','workerId'])
 assert collections.Counter(key(e) for e in events if e['event']=='worker-created')==collections.Counter(key(e) for e in events if e['event']=='worker-closed')
 assert not any(e['event'] in ['requestfailed','pageerror'] or (e['event']=='console' and e['type']=='error') for e in events)
for a in s['attempts']:
 report=read(R/a['report']);assert report['harnessSha256']==policy['harnessSha256'] and report['harnessDependencies']==policy['dependencies'] and report['policyRevision']==15
assert hashlib.sha256(pathlib.Path(policy['storage']).read_bytes()).hexdigest()==policy['storageSha256']
manifest=read(R/commands['source']['path']);frozen=pathlib.Path(manifest['temporaryRoot']);scheduleInputs=[]
for rel in ['src/generation/seed-fork.ts','src/generation/world-study/r100-production-map.ts']:
 p=frozen/rel;assert hashlib.sha256(p.read_bytes()).hexdigest()==manifest['sources'][rel];scheduleInputs.append({'path':str(p),'relativeSourcePath':rel,'sha256':manifest['sources'][rel]})
assert 'attempt < 8' in (frozen/'src/generation/world-study/r100-production-map.ts').read_text()
assert 'r100-native-v3-attempt-${attempt}' in (frozen/'src/generation/world-study/r100-production-map.ts').read_text()
def mix32(seed,label):
 h=seed&0xffffffff
 for c in label:h=((h^ord(c))*0x9e3779b9)&0xffffffff
 h^=h>>16;h=(h*0x7feb352d)&0xffffffff;h^=h>>15;return h&0xffffffff
for r in rows:
 schedule=[r['requestedSeed']]+[mix32(r['requestedSeed'],f'r100-native-v3-attempt-{i}') for i in range(1,8)];assert r['effectiveSeed'] in schedule;r['matchingGenerationAttempt']=schedule.index(r['effectiveSeed'])
pathlib.Path('/tmp/r100-b11-audited-rows.json').write_text(json.dumps({'rows':rows,'totals':dict(totals),'observerCounts':dict(observerCounts),'source':commands['source']},ensure_ascii=False,indent=2)+'\n')
print('CORE PASS',len(rows))
assert all(r['effectiveSeed']==r['requestedSeed'] for r in rows)
assert all(r['moduleDamage']=={'CORE':4,'STORAGE':14,'PURIFIER':4} for r in rows)
assert all(len(r['actualPickups'])==1 and r['actualPickups'][0]['tier'] in ['contested','deep'] for r in rows)
assert sum(r['settledKindling'] for r in rows)==102 and sum(r['returnedLootCount'] for r in rows)==9
assert sum(r['activeToolInputs'] for r in rows)==sum(r['consumingToolInputs'] for r in rows)==34
assert sum(r['minRecordedSnapshotHp']<145 for r in rows)==9 and sum(r['activeToolInputs']==0 for r in rows)==11
for a in s['attempts']:
 report=read(R/a['report']);j=report['realJourneyAttempts'][0];checkpoint=j['entrySave']['state']['riftCheckpoint']
 assert checkpoint['identity']==j['identity'] and checkpoint['runId']==j['entrySave']['state']['inventory']['run']['id']
 assert read((R/a['report']).parent/a['grade']/'1-before.save.json')==j['before']['state']
 assert j['entryState']['seed']['seed']==j['identity']['seed']==j['entrySave']['state']['inventory']['run']['dropPlan']['runSeed'];assert j['entryState']['seed']['recipeId']==j['identity']['recipeId']
for c in ob['contexts']:assert c['workers']==3
frameChoices=[]
for case,filename,why,already in [
 (4,'1-search-5.png','最长106.10s且损75HP；多个目标被敌人拒退后才实际取得deep薪825.40px，假身4耗尽，灰牙1及武器5。',True),
 (18,'1-search-2.png','fibre重档第二seed实际deep薪825.40px，损75HP/chaos106.29；一处深污染物接近持续危险被放弃。',False),
 (18,'1-return.png','同趟携12薪返回、假身2/灰牙1/武器4，核实成功与成本并存。',False),
 (24,'1-search-4.png','全批最高记录chaos118.09：gel重档第二seed85.73s/HP100，早先争夺目标拒退后取deep污染物822.29px。',False),
 (24,'1-return.png','同趟带回1污染物，假身3/灰牙1/武器4；这不是全血低成本重档。',False),
 (23,'1-search-1.png','相邻重档第一seed仅28.45s/HP145/灰牙1，但确实到contest604.04px；此帧可核相对弱压力，不能凭其它重趟代签。',False),
 (12,'1-search-1.png','husk重档第二seed35.10s/HP145/灰牙1，contest553.62px；比同档首seed明显低成本，但不是近入口safe点。',False)]:
 row=rows[case-1];p=(R/row['report']['path']).parent/row['grade']/filename;assert p.exists()
 frameChoices.append({'case':case,'image':ref(p),'reason':why,'listedInRootViewedFramesAtAuditStart':already,'visuallyReviewedByThisAudit':False})
economy={'separateFixedFixtureKindlingTotal':102,'returnedContaminants':9,'activeToolInputs':34,'consumingToolInputs':34,'processesWithoutActiveToolInput':11,'processesWithHpLoss':9,'perExtractModuleDamage':{'CORE':4,'STORAGE':14,'PURIFIER':4}}
out={
 'status':'bounded-independent-process-data-pass','reviewer':'identity_shapes','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'B11原24固定世界/双种子过程只读独审，核原source/identity、实际收集、同run结算、真实消耗及Worker观察。未运行浏览器/地图，未改变原结果。',
 'auditScript':ref(pathlib.Path(__file__)),
 'inputs':[ref(B/x) for x in ['play-summary.json','outcomes.json','play-summary-plan.json','play-commands.json','play/batch-report.json','play/policy-freeze.json','worker-observation-summary.json','independent-process-draft-error.json']],
 'source':commands['source'],
 'coverage':{'uniqueOriginalProcesses':24,'actualAttempts':24,'worlds':plan['worlds'],'grades':plan['grades'],'requestedSeeds':plan['seeds'],'qualifiedGradePairs':12,'retries':0,'nonEntrySearchAndExtract':24,'nearEntryOnly':0,'trueEmptyReturns':0,'deaths':0,'effectiveSeedEqualsRequested':24},
 'integrity':[
 '按原固定计划、policy和batch逐项核24独立请求；原report SHA全匹配，24唯一runId，无换seed补抽。',
 '3121 manifest/policy/batch/harness及report依赖SHA核对；出发earned-storage原字节SHA匹配，不用当前工作树代替冻结来源。',
 '24 entry与returned实际存档逐字段等于report；entry checkpoint identity完整等于report identity，checkpoint runId/dropPlan seed对应当趟。',
 'entry→terminal节点实际变化每趟恰1个；全部contest/deep，距入口480.87–827.26px。污染物带回须同run/node返回记录，薪柴须实际入账；24active→settled extract/baseSettled。',
 '34主动输入均真实used=1，逐item对应actionReceipts/前后余次；耗尽物destroyedIds、武器33耐久和出征被动24次另核，未将输入次数代替消费。',
 '25observer原日志（1纯preload+24真实context）逐SHA和事件重数；24context/24page/72个带ID Worker创建关闭成对，网络0failed/0pending/请求响应数一致。'],
 'generationSchedule':{'inputs':scheduleInputs,'allMatchingFrozenAttempt':0,'boundary':'全部请求/有效种子相等，固定8次内部准入规则只作身份检查，不据此猜其它seed表现。'},
 'workerObservation':{'files':ob['files'],'recountedEventCounts':dict(observerCounts),'networkSummaries':24,'matchedWorkers':72,'observerErrors':0,'boundary':'仅本24受控过程。无观察异常不解释历史P36，也不替代最终324正式入口/冷续或性能/GC资格。'},
 'economy':economy,'toolConsumption':dict(totals),
 'highestElapsedAndHpCost':rows[3],'highestRecordedChaos':rows[23],'additionalHeavySevereProcess':rows[17],
 'relativeLowPressureSevereCases':[12,23],'allProcessRows':rows,'rootFrameCandidates':frameChoices,
 'findings':[
 {'severity':'experience-boundary','cases':[4,15,18,24],'detail':'24成功并非低成本：004最长106.10s/损75HP/假身耗尽，015耗1罗盘，018再损75HP，024最高chaos118.09且取深部污染物。原代价、弃选与最终实得均保留。'},
 {'severity':'evidence-boundary','cases':[12,23],'detail':'相对弱压力重档仍真实到争夺节点553.62/604.04px，但35.10/28.45s全HP且只用灰牙1；不能推广每重档都深搜或高压。'},
 {'severity':'scope-boundary','detail':'本批没有safe/近入口成功，全局最短实得480.87px；这只描述原固定专家过程，不把此结果扩为自然分布/新人路线或收益保证。'}],
 'limits':[
 'controlledWorld固定于出发前且noStateInjection=false披露；controlledBuild=null，使用成熟earned-save及几何辅助专家导航，不是自然48抽样。',
 '102薪/9污染物与工具合计来自24独立fixture，不是连续经济净收益；每次结算的模块损伤也单列。',
 'HP/chaos仅取原snapshot/终态记录，不声称逐帧极值或性能。',
 '未打开PNG，本审只给原帧路径与SHA供root独审，不代签美术/听感/体验。',
 '只绑定3121冻结源，不自行继承到最终enabled108或关闭全迭代。']}
p=B/'independent-process-audit-shapes.json';assert not p.exists();p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('FINAL',ref(p))
