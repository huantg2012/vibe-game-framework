import json,pathlib,hashlib,math,collections,datetime
R=pathlib.Path('/Users/yilungao/coh'); B=R/'docs/qa/artifacts/r100-i10-i12/b09-current-qualified'
def read(p):return json.loads(p.read_text())
def ref(p):return {'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
s=read(B/'play-summary-v2.json');batch=read(B/'play/batch-report.json');policy=read(B/'play/policy-freeze.json');plan=read(B/'play-summary-plan.json');commands=read(B/'play-commands.json');ob=read(B/'worker-observation-summary-v2.json')
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

assert s['searchAndExtractAttempts']==22 and s['deaths']==0 and s['emptyReturns']==0 and s['nearEntryOnlyReturns']==2
assert len({(r['world'],r['grade'],r['requestedSeed']) for r in rows})==24
assert ref(R/commands['source']['path'])['sha256']==commands['source']['sha256']
assert s['planSha256']==ref(B/'play-summary-plan.json')['sha256']
assert s['sources'][0]['policySha256']==ref(B/'play/policy-freeze.json')['sha256']
assert s['sources'][0]['reportSha256']==ref(B/'play/batch-report.json')['sha256']
for f in ob['files']: assert ref(R/f['path'])['sha256']==f['sha256']
pathlib.Path('/tmp/r100-b09-audited-rows.json').write_text(json.dumps({'rows':rows,'totals':dict(totals)},ensure_ascii=False,indent=2)+'\n')
for r in rows: print(json.dumps({k:r[k] for k in ['index','world','grade','requestedSeed','effectiveSeed','outcome','actualPickups','fieldHp','minRecordedSnapshotHp','maxRecordedSnapshotChaos','elapsedMs','settledKindling','returnedLootCount','reserveDelta','activeToolInputs','toolConsumption']},ensure_ascii=False))
print('TOTALS',dict(totals))
# Check the derived accounting repair without changing or re-executing a trip.
old=read(B/'play-summary.json');assert old['attempts']==s['attempts'] and old['pairs']==s['pairs']
assert set(k for k in old if old[k]!=s[k])=={'createdAt','emptyReturns'}
assert set(s)-set(old)=={'nearEntryOnlyReturns'}
assert read(B/'outcomes.json')['outcomes']==read(B/'outcomes-v2.json')['outcomes']
oldOb=read(B/'worker-observation-summary.json');assert {k:v for k,v in oldOb.items() if k!='play'}=={k:v for k,v in ob.items() if k!='play'}
assert ob['play']==ref(B/'play-summary-v2.json')
observerCounts=collections.Counter();networks=[]
for f in ob['files']:
 events=[json.loads(line) for line in (R/f['path']).read_text().splitlines()]
 for event in events:
  observerCounts[event['event']]+=1
  if event['event']=='network-summary':networks.append(event)
 workerKey=lambda e:tuple(e.get(k) for k in ['browserId','contextId','pageId','workerId'])
 created=[e for e in events if e['event']=='worker-created'];closed=[e for e in events if e['event']=='worker-closed']
 assert all('workerId' in e for e in created+closed)
 assert collections.Counter(map(workerKey,created))==collections.Counter(map(workerKey,closed))
assert dict(observerCounts)==ob['eventCounts']
assert len(networks)==24 and all(n['failed']==0 and n['pending']==[] and n['requests']==n['responses'] for n in networks)
assert {(x['world'],x['grade'],x['seed']) for x in policy['cases']}==expected
assert all(r['effectiveSeed']==r['requestedSeed'] for r in rows)
assert len({r['runId'] for r in rows})==24
assert all(len(r['actualPickups'])==1 for r in rows)
assert all(r['moduleDamage']=={'CORE':4,'STORAGE':14,'PURIFIER':4} for r in rows)
assert sum(r['settledKindling'] for r in rows)==80 and sum(r['returnedLootCount'] for r in rows)==10
for w in plan['worlds']:
 for g in plan['grades']:assert any(r['outcome']=='non-entry-search-and-extract' for r in rows if r['world']==w and r['grade']==g)
assert [r['index'] for r in rows if r['outcome']=='near-entry-extract']==[14,18]
assert not any(r['outcome']=='empty-extract' for r in rows)
assert sum(len(r['nonConsumingInputs']) for r in rows)==1 and rows[20]['nonConsumingInputs'][0]['used']==0
repairPath=R/'docs/qa/artifacts/r100-i10-i12/near-entry-accounting-repair/result.json';repair=read(repairPath)
for f in repair['tools']:assert ref(R/f['path'])['sha256']==f['sha256']
assert repair['original']==ref(B/'play-summary.json') and repair['corrected']==ref(B/'play-summary-v2.json')
frame_choices=[]
for case,filename,why in [
 (14,'1-return.png','blue-fault低档第二seed实际近入口薪柴携返4薪，距272.118px，不能称空返或计非入口成功。'),
 (18,'1-return.png','blue-fault重档第二seed同样实际近入口4薪携返，与原014一起校正summary分类。'),
 (11,'1-search-1.png','red-vault-fragments重档第一seed仅safe节点320.100px/14.10s，全HP无主动工具，证据最弱。'),
 (12,'1-search-1.png','该world重档第二seed也是safe320.899px/14.60s，全HP无主动工具，双原seed均不证明深搜受压。'),
 (9,'1-search-1.png','该world中档第一seedsafe336.095px/14.65s；中档第二seed同位置336.095px/14.82s，都是浅部单取。'),
 (23,'1-search-2.png','pale-pressure重档第一seed最大压力/成本：损失60HP，假身3/罗盘1/灰牙2及武器3，仍搜取争夺薪柴。'),
 (23,'1-return.png','同趟带回6薪、罗盘和灰牙用尽销毁，真实代价不能由全批PASS掩去。'),
 (21,'1-search-2.png','最长59.16s过程，先一次危险接近弃选后实际搜薪；含一次灰釉齿按键used0，未伪计消耗。')]:
 row=rows[case-1];p=R/row['report']['path'];fp=p.parent/row['grade']/filename;assert fp.exists()
 frame_choices.append({'case':case,'image':ref(fp),'reason':why,'visuallyReviewedByThisAudit':False})
out={
 'status':'bounded-independent-process-data-pass','reviewer':'identity_shapes','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'B09原24固定过程只读独审；原近入口拾取与实际未扣次输入均保留。非自然48、材料艺术/性能/正式冷续签证。',
 'auditScript':ref(pathlib.Path(__file__)),
 'inputs':[ref(B/x) for x in ['play-summary.json','outcomes.json','worker-observation-summary.json','play-summary-v2.json','outcomes-v2.json','worker-observation-summary-v2.json','play-summary-plan.json','play-commands.json','play/batch-report.json','play/policy-freeze.json','independent-audit-draft-errors.json']],
 'source':commands['source'],
 'coverage':{'uniqueOriginalProcesses':24,'worlds':plan['worlds'],'grades':plan['grades'],'requestedSeeds':plan['seeds'],'attempts':24,'retries':0,'effectiveSeedEqualsRequested':24,'nonEntrySearchAndExtract':22,'nearEntryOnlyReturns':2,'trueEmptyReturns':0,'deaths':0,'qualifiedGradePairs':12,'observedEnvironmentErrors':0},
 'classificationRepair':{'receipt':ref(repairPath),'status':'bounded-source-review-accepted','reviewedTools':repair['tools'],'originalSummaryRetained':ref(B/'play-summary.json'),'canonicalSummary':ref(B/'play-summary-v2.json'),'originalAttemptsAndPairsExact':True,'originalOutcomesExact':True,'observerRawAndCountsExact':True,'codeFinding':'emptyReturns仅完整extract且无eligible collected及无actualPickups；nearEntryOnlyReturns仅完整extract且无eligible collected但有actualPickups。policy15明确actual来自entry→terminal同save收据；旧policy13缺actual字段保持原schema。资格/阈值/种子/原过程不变，当前B09修为22非入口+2近入口+0空返。','scope':'只读3行分类及同批v1/v2差异；未执行pipeline14/40合同或旧312，引用其独立执行收据，不冒称本代理重跑。'},
 'integrity':[
  '逐原report SHA核24身份与固定policy/batch；两原seed每world/grade一次，effectiveSeed均相同。',
  '24 entry/returned原save与report逐字段一致，同run active→settled extract/baseSettled；不按目标label或summary布尔代替实际结算。',
  '实际收集基于entry→field节点变化；污染物同run/node来源须在returnedIds/revealedNodes，薪柴正结算。每趟实际一个pickup。',
  '014/018日志预定safe污染物，但实际completedNodeIds、节点变化及settledSave为safe薪柴，各4薪，距入口272.1176px；明确近入口携返不计非入口搜撤。',
  '工具按原事件used值核对，不假定按键即成功：12输入中11扣次＋1 used0，成功逐物计数=actionReceipt=存档耗次。',
  '25observer原JSONL SHA与事件数重算，24contexts/72同ID Worker创建关闭成对；全部network-summary无failed/pending且请求响应数一致。'],
 'workerObservation':{'files':ob['files'],'recountedEventCounts':dict(observerCounts),'networkSummaries':24,'failedRequests':0,'pendingRequests':0,'interpretation':'仅本批无观察异常，不解释其它历史Worker失败或代替正式324。'},
 'consumptionTotals':dict(totals),
 'economy':{'separateFixedFixtureKindlingTotal':80,'returnedContaminants':10,'activeToolInputAttempts':12,'consumingToolInputs':11,'nonConsumingInputs':1,'departurePassiveUses':24,'processesWithoutActiveToolUse':20,'processesWithHpLoss':3,'perExtractModuleDamage':{'CORE':4,'STORAGE':14,'PURIFIER':4}},
 'nonConsumingInput':{'case':21,'event':rows[20]['nonConsumingInputs'][0],'interpretation':'原始灰釉齿Q第二次按键used0，remaining仍1，未产生actionReceipt/扣次。未从数据猜测距离、冷却或其它拒绝原因。'},
 'highestPressure':{'case':23,'world':'pale-pressure','grade':'severe','requestedSeed':20261005,'minRecordedHp':85,'maxRecordedChaos':rows[22]['maxRecordedSnapshotChaos'],'elapsedMs':rows[22]['elapsedMs'],'description':'假身3/罗盘1/灰牙2，武器3，罗盘/灰牙耗尽；实际带回6薪。'},
 'longestProcess':{'case':21,'elapsedMs':rows[20]['elapsedMs']},
 'weakDepthCases':[9,10,11,12,16],
 'nearEntryOnlyRows':[rows[13],rows[17]],'trueEmptyReturns':[],
 'allProcessRows':rows,'rootFrameCandidates':frame_choices,
 'findings':[
  {'severity':'accounting-repaired','cases':[14,18],'detail':'原摘要误将未满足非入口门槛的实际携返归为empty；v2独立核对修正为nearEntryOnly，原attempts/pairs/结果保留。'},
  {'severity':'evidence-boundary','cases':[9,10,11,12,16],'detail':'五趟safe浅部：red中两seed336.095px、red重320.100/320.899px、blue中seed2为320.899px，全部HP145/0主动工具。合法既定阈值成功不等于深搜/高压。'},
  {'severity':'experience-boundary','cases':[21,22,23],'detail':'真正HP损伤集中pale-pressure中两seed/重seed1；其中023损60HP并耗尽两工具。不能按24完成或22非入口主张每world每档都有压力验证。'}],
 'limits':[
  '固定controlledWorld在出发前选择，noStateInjection=false为显式披露；controlledBuild=null。原数据不等同自然世界抽样。',
  '80薪/10污染物/消耗总量来自24独立成熟fixture，不是连续经济净收益或高档持续盈利证明。',
  'HP/chaos仅原snapshot与终态观测极值，不声称全帧遥测。',
  '未打开PNG，候选由原数据挑选供root独立看图，不代签材料/边界/体验。',
  '保留本审计首次工具扣次假设失败及修正解释；未改原report/seed/过程、未重跑游戏。',
  '只绑定3120当时过程，不自动继承3121或最终来源正式冷续/性能/GC。']}
p=B/'independent-process-audit-shapes.json';assert not p.exists();p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('FINAL',ref(p))
