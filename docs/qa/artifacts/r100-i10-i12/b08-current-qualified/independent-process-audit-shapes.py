import json,pathlib,hashlib,math,collections,datetime
R=pathlib.Path('/Users/yilungao/coh'); B=R/'docs/qa/artifacts/r100-i10-i12/b08-current-qualified'
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
 active=[x for x in events if x['event']=='known-tool-context-input'];receipts=list(ar['actionReceipts'].values());assert len(active)==len(receipts)
 assert collections.Counter(x['item']['id'] for x in active)==collections.Counter(x['itemId'] for x in receipts)
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
 row={'index':index,'world':a['world'],'grade':a['grade'],'requestedSeed':a['seed'],'effectiveSeed':j['identity']['seed'],'runId':ar['id'],'report':ref(p),'journey':ref(folder/'journey.jsonl'),'entrySave':ref(folder/'1-entry.save.json'),'settledSave':ref(folder/'1-returned.save.json'),'outcome':'non-entry-search-and-extract' if a['searchAndExtract'] else 'empty-extract','actualPickups':pickups,'fieldHp':j['fieldResult']['hp'],'minRecordedSnapshotHp':min(hp),'maxRecordedSnapshotChaos':max(chaos),'fieldChaos':j['fieldResult']['chaos'],'elapsedMs':j['fieldResult']['elapsedMs'],'settledKindling':ar['kindlingGained'],'returnedLootCount':len(ar['returnedIds']),'reserveDelta':after['kindlingReserve']-e['kindlingReserve'],'moduleDamage':modloss,'toolConsumption':tools,'activeToolInputs':len(active),'departurePassiveUses':passive,'searchDecisions':[{'id':q['id'],'decision':q['searchDecision']} for q in j['searches']],'abandonedApproaches':[{'reason':q['reason'],'target':q['target']['id']} for q in events if q['event']=='abandoned-observed-approach'],'frames':[str(q.relative_to(R)) for q in sorted(folder.glob('*.png'))]}
 rows.append(row)

assert s['emptyReturns']==0 and s['searchAndExtractAttempts']==24 and s['deaths']==0
assert len({(r['world'],r['grade'],r['requestedSeed']) for r in rows})==24
assert ref(R/commands['source']['path'])['sha256']==commands['source']['sha256']
assert s['planSha256']==ref(B/'play-summary-plan.json')['sha256']
assert s['sources'][0]['policySha256']==ref(B/'play/policy-freeze.json')['sha256']
assert s['sources'][0]['reportSha256']==ref(B/'play/batch-report.json')['sha256']
for f in ob['files']: assert ref(R/f['path'])['sha256']==f['sha256']
Path=pathlib.Path
Path('/tmp/r100-b08-audited-rows.json').write_text(json.dumps({'rows':rows,'totals':dict(totals)},ensure_ascii=False,indent=2)+'\n')
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
assert all(r['effectiveSeed']==r['requestedSeed'] for r in rows)
assert len({r['runId'] for r in rows})==24
assert sum(r['settledKindling'] for r in rows)==72 and sum(r['returnedLootCount'] for r in rows)==12
for w in plan['worlds']:
 for g in plan['grades']:assert len([r for r in rows if r['world']==w and r['grade']==g and r['outcome']=='non-entry-search-and-extract'])==2
frame_choices=[]
for case,filename,why in [
 (15,'1-search-2.png','最大成本过程的实际薪柴搜取，首目标因敌人太近被放弃后换点；全趟损失90HP并耗尽3件主动工具。'),
 (15,'1-return.png','同一趟带回6薪且假身4/罗盘1/灰牙2全部耗尽、武器消耗7；核对成功与代价并存。'),
 (17,'1-search-1.png','resin-sleeve重档第一seed仅安全节点距入口320.100px，15.18s全HP返回，不足以证明深搜受压。'),
 (18,'1-search-1.png','同world重档第二seed仍仅安全节点320.899px，15.38s全HP返回；保留双种子都偏浅的限制。'),
 (12,'1-search-1.png','silk-catch重档第二seed仅安全节点320.899px，14.80s全HP返回；该档另一原seed到争夺节点624.46px。'),
 (5,'1-search-1.png','grain-weld重档第一seed的原受压搜取：损失30HP、两次假身与2武器耐久，不能用其它全血短趟代表本趟。'),
 (23,'1-search-1.png','第四world shell-threads重档原压力较高过程：40.23s、损失15HP、假身1/灰牙1/武器2，仍完成争夺薪柴搜取。')]:
 row=rows[case-1];p=R/row['report']['path'];fp=p.parent/row['grade']/filename;assert fp.exists()
 frame_choices.append({'case':case,'image':ref(fp),'reason':why,'visuallyReviewedByThisAudit':False})
script=pathlib.Path(__file__)
out={
 'status':'bounded-independent-process-data-pass','reviewer':'identity_shapes','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'只读核对B08原24固定世界/双种子真实输入过程；不等同自然48、视觉/性能/最终324冷续或更晚源资格。',
 'auditScript':ref(script),
 'inputs':[ref(B/x) for x in ['play-summary.json','outcomes.json','play-summary-plan.json','play-commands.json','play/batch-report.json','play/policy-freeze.json','worker-observation-summary.json']],
 'source':commands['source'],
 'coverage':{'uniqueOriginalProcesses':24,'worlds':plan['worlds'],'grades':plan['grades'],'requestedSeeds':plan['seeds'],'attempts':24,'retries':0,'effectiveSeedEqualsRequested':24,'searchAndExtract':24,'emptyReturns':0,'deaths':0,'qualifiedGradePairs':12,'observedEnvironmentErrors':0},
 'integrity':[
  '逐一核对24原report SHA、计划/冻结policy/batch三方固定身份；24个独立runId，两原seed各一次，所有effectiveSeed与requestedSeed相等。',
  '三份总源收据指向3120，manifest SHA、policy SHA、batch SHA、summary-plan SHA均核对；不按当前工作树代替历史冻结源。',
  '24份entry/returned原存档与report逐字段一致；同一active run到settled extract/baseSettled。',
  '独立从entry至field-result节点变化核实际拾取与距原入口距离；污染物返回须同run/node来源且returnedIds/revealedNodes匹配，薪柴须正结算。全部每趟1取1回。',
  'JSONL主动工具输入与actionReceipts按实例数量匹配；carried物品前后扣次匹配，丢失的耗尽物必须原destroyedIds记录。',
  '25份observer原JSONL SHA及事件计数独立复算：额外1份仅preload，真实24 launch/context，72 Worker创建/关闭配对、24 context/browser关闭；24网络汇总0 failed、0 pending、请求响应数一致。无观察事件异常。'],
 'workerObservation':{'files':ob['files'],'recountedEventCounts':dict(observerCounts),'networkSummaries':24,'failedRequests':0,'pendingRequests':0,'interpretation':'本次观察范围无异常；不解释其它历史Worker失败，不替代最终正式冷续与P36独立结论。'},
 'consumptionTotals':dict(totals),
 'economy':{'separateFixedFixtureKindlingTotal':72,'returnedContaminants':12,'activeToolInputs':17,'processesWithoutActiveToolUse':17,'processesWithHpLoss':4,'perExtractModuleDamage':{'CORE':4,'STORAGE':14,'PURIFIER':4}},
 'highestPressure':{'case':15,'world':'resin-sleeve','grade':'medium','requestedSeed':20261005,'minRecordedHp':55,'maxRecordedChaos':98.17696648510072,'elapsedMs':63614.14000000003,'description':'首污染物目标因敌人太近未搜，改取实际争夺薪柴并结算6；假身4/罗盘1/灰牙2用尽销毁，武器消耗7。'},
 'weakDepthCases':[12,17,18],
 'emptyReturns':[],
 'allProcessRows':rows,
 'rootFrameCandidates':frame_choices,
 'findings':[
  {'severity':'evidence-boundary','cases':[12,17,18],'detail':'三个重档过程仅safe节点，距原入口320.899/320.100/320.899px，只超既定320阈值不足1px，14.80/15.18/15.38s、HP145、0主动工具。合法原合同成功，不能推广为深搜/高压证明；resin两个重seed均如此。'},
  {'severity':'experience-boundary','cases':[15],'detail':'全批24成功不代表低成本：该中档损失90HP并耗尽3件工具，带回6薪；原代价保留，不以重档浅部短趟去推断更高档更安全或更划算。'}],
 'limits':[
  'noStateInjection=false是出发前controlledWorld选择披露，controlledBuild=null；不称自然world选择。',
  '每个固定过程复制同一真实成熟存档并按正常流程配备工具，72薪/工具合计来自24独立fixture，非自然连续经营净收益。',
  'HP/chaos extrema仅来自保存的snapshot与终态，不声称逐帧全时序极值。',
  '本审查未打开PNG；只给root明确原帧，视觉/体验结论由root另审。',
  'B08已完成后续队列日志EEXIST由pipeline报告；其不属于此24原游戏过程，本收据不据消息诊断该调度故障。',
  '不修改任何原报告/原种子/阈值，不重跑游戏，不继承到3121或更晚来源。']}
p=B/'independent-process-audit-shapes.json';assert not p.exists();p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('FINAL',ref(p))
