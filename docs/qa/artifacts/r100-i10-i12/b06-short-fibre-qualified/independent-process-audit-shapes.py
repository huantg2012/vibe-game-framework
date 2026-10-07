import json,pathlib,hashlib,math,collections,datetime
R=pathlib.Path('/Users/yilungao/coh'); B=R/'docs/qa/artifacts/r100-i10-i12/b06-short-fibre-qualified'
def read(p):return json.loads(p.read_text())
def ref(p):return {'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
s=read(B/'play-summary.json');batch=read(B/'play/batch-report.json');policy=read(B/'play/policy-freeze.json');plan=read(B/'play-summary-plan.json');commands=read(B/'play-commands.json');ob=read(B/'worker-observation-summary.json')
expected={(w,g,t) for w in plan['worlds'] for g in plan['grades'] for t in plan['seeds']}
assert len(expected)==12 and plan['seeds']==[20261005,3075192741]
assert {(x['world'],x['grade'],x['seed']) for x in batch['attempts']}==expected
assert len(batch['attempts'])==len(policy['cases'])==len(s['attempts'])==12
assert batch['endedAt'] and batch['status']=='completed-fixed-attempts-pending-review'
assert policy['manifestSha256']==commands['source']['sha256'] and policy['algorithmRevision']==6 and policy['controllerPolicyRevision']==15
assert ob['status']=='complete-observation' and ob['exceptionEvents']==[] and len(ob['contexts'])==12
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

assert s['emptyReturns']==0 and s['searchAndExtractAttempts']==12 and s['deaths']==0
assert len({(r['world'],r['grade'],r['requestedSeed']) for r in rows})==12
assert ref(R/commands['source']['path'])['sha256']==commands['source']['sha256']
assert s['planSha256']==ref(B/'play-summary-plan.json')['sha256']
assert s['sources'][0]['policySha256']==ref(B/'play/policy-freeze.json')['sha256']
assert s['sources'][0]['reportSha256']==ref(B/'play/batch-report.json')['sha256']
for f in ob['files']: assert ref(R/f['path'])['sha256']==f['sha256']
pathlib.Path('/tmp/r100-p34-audited-rows.json').write_text(json.dumps({'rows':rows,'totals':dict(totals)},ensure_ascii=False,indent=2)+'\n')
for r in rows: print(json.dumps({k:r[k] for k in ['index','world','grade','requestedSeed','effectiveSeed','actualPickups','fieldHp','minRecordedSnapshotHp','maxRecordedSnapshotChaos','elapsedMs','settledKindling','returnedLootCount','reserveDelta','activeToolInputs','toolConsumption']},ensure_ascii=False))
print('TOTALS',dict(totals))
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
assert len(networks)==12 and all(n['failed']==0 and n['pending']==[] and n['requests']==n['responses'] for n in networks)
assert {(x['world'],x['grade'],x['seed']) for x in policy['cases']}==expected
assert all(r['effectiveSeed']==r['requestedSeed'] for r in rows)
assert len({r['runId'] for r in rows})==12
assert all(len(r['actualPickups'])==1 and r['actualPickups'][0]['tier']=='contested' for r in rows)
assert all(r['fieldHp']==r['minRecordedSnapshotHp']==145 and r['activeToolInputs']==0 and r['toolConsumption']==[] for r in rows)
assert all(r['moduleDamage']=={'CORE':4,'STORAGE':14,'PURIFIER':4} for r in rows)
assert sum(r['settledKindling'] for r in rows)==48 and sum(r['returnedLootCount'] for r in rows)==4
snapshot=read(R/commands['source']['path']);materialPath='src/generated/r100-package-manifest.ts';materialSource=pathlib.Path(snapshot['temporaryRoot'])/materialPath
materialSha=hashlib.sha256(materialSource.read_bytes()).hexdigest();assert materialSha==snapshot['sources'][materialPath]
materialText=materialSource.read_text();marker='export const R100_MATERIAL_DEPENDENCIES:';body=materialText.split(marker,1)[1].split(' = ',1)[1].strip();assert body.endswith(';');frozenMaterials=json.loads(body[:-1])
for a in s['attempts']:
 j=read(R/a['report'])['realJourneyAttempts'][0];g=j['identity']['generation']
 assert g['appearance']['materialOrganization']=='short-fibre-loose'
 assert all(v['shapeProfile']=='compressed-wedge' for v in g['nativeDefinition']['instances'])
 assert set(g['package']['materials'])=={'membrane-rim','organization:short-fibre-loose'}
 assert all(v==frozenMaterials[k] for k,v in g['package']['materials'].items())
frame_choices=[]
for case,filename,why in [
 (5,'1-search-1.png','本批记录最高混乱的原重档过程，终态chaos52.318，但全HP、0主动消耗；不要仅按档位称高压。'),
 (8,'1-far-exploration.png','本批最长原过程39.25s，felt低档第二seed，实收争夺节点距入口520px；检路线组织而非把低档时长当高压。'),
 (11,'1-search-1.png','felt重档第一seed约26.02s，HP145、0主动工具、chaos36.119，属于低代价固定单取过程。'),
 (12,'1-search-1.png','felt重档第二seed约24.88s，HP145、0主动工具、chaos35.591；与第一seed一并保留未展示压力应对的边界。')]:
 row=rows[case-1];p=R/row['report']['path'];fp=p.parent/row['grade']/filename;assert fp.exists()
 frame_choices.append({'case':case,'image':ref(fp),'reason':why,'visuallyReviewedByThisAudit':False})
out={
 'status':'bounded-independent-process-data-pass','reviewer':'identity_shapes','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'P34短纤两world原12固定世界/双种子实际过程的只读独审；不是材料艺术审批或自然48趟/性能/正式冷续。',
 'auditScript':ref(pathlib.Path(__file__)),
 'inputs':[ref(B/x) for x in ['play-summary.json','outcomes.json','play-summary-plan.json','play-commands.json','play/batch-report.json','play/policy-freeze.json','worker-observation-summary.json']],
 'source':commands['source'],
 'materialBinding':{'frozenSourceFile':materialPath,'sha256':materialSha,'matchesSnapshot':True,'materialOrganization':'short-fibre-loose','geometryProfiles':['compressed-wedge'],'materials':{k:frozenMaterials[k] for k in ['membrane-rim','organization:short-fibre-loose']},'matchingActualRecipes':12,'scope':'实际recipe与冻结3120材料依赖相符，不采用未注册compressed-felt细绳候选；不据此代签肉眼读法。'},
 'coverage':{'uniqueOriginalProcesses':12,'worlds':plan['worlds'],'grades':plan['grades'],'requestedSeeds':plan['seeds'],'attempts':12,'retries':0,'effectiveSeedEqualsRequested':12,'searchAndExtract':12,'emptyReturns':0,'deaths':0,'qualifiedGradePairs':6,'observedEnvironmentErrors':0},
 'integrity':[
  '12原report SHA、计划/policy/batch身份一致，两原seed逐world逐档一次；12独立runId，effectiveSeed均等于requestedSeed。',
  '3120 source manifest SHA、policy SHA、batch SHA和summary-plan SHA匹配；材料依赖另从不可变源生成文件逐值核对。',
  '12份entry/returned原save等于report state；同一active run到settled extract/baseSettled。',
  '每趟实际一个争夺节点由未收集变收集，距入口520–640.05px；污染物同run/node来源进入returnedIds/revealedNodes，薪柴正结算。',
  'JSONL没有主动工具输入且actionReceipts为0，carried武器/工具扣次为0；每趟仅被动视野消耗1。',
  '13observer原JSONL SHA/事件计数重算：其中1份仅preload，12真实context，36 Worker同ID创建/关闭配对、12context/browser关闭；网络0failed/0pending、请求响应数量一致。'],
 'workerObservation':{'files':ob['files'],'recountedEventCounts':dict(observerCounts),'networkSummaries':12,'failedRequests':0,'pendingRequests':0,'interpretation':'仅本次观察范围无异常；不推断其它历史Worker错误根因，不替代最终324。'},
 'consumptionTotals':dict(totals),
 'economy':{'separateFixedFixtureKindlingTotal':48,'returnedContaminants':4,'activeToolInputs':0,'weaponUses':0,'departurePassiveUses':12,'processesWithoutActiveToolUse':12,'processesWithHpLoss':0,'perExtractModuleDamage':{'CORE':4,'STORAGE':14,'PURIFIER':4}},
 'highestRecordedChaos':{'case':5,'world':'short-fibre-mat','grade':'severe','requestedSeed':20261005,'chaos':rows[4]['maxRecordedSnapshotChaos'],'hp':145,'elapsedMs':rows[4]['elapsedMs']},
 'longestProcess':{'case':8,'world':'felt-wedges','grade':'low','requestedSeed':3075192741,'elapsedMs':rows[7]['elapsedMs']},
 'emptyReturns':[],'allProcessRows':rows,'rootFrameCandidates':frame_choices,
 'findings':[{'severity':'experience-boundary','cases':list(range(1,13)),'detail':'全12皆HP145且无主动工具/武器消耗；四重档也是24.63–28.25s单取返场。可证明原固定路线收集结算，不能证明压力下抉择、工具价值或长趟资源承受。实际节点均争夺且≥520px，此处没有B08那种贴320px阈值的浅部safe节点。'}],
 'limits':[
  'noStateInjection=false明确披露出发前controlledWorld选择，controlledBuild=null，不称自然世界抽样。',
  '48薪/4污染物与被动扣次来自12份独立成熟存档复制，不是自然连续经营净收益或工具供给可持续性。',
  '最高chaos/最低HP只覆盖保存snapshot与终态，不是全帧遥测极值。',
  '本审查未打开PNG，原帧仅供root后续独立肉眼复看；材料及光照验收独立。',
  '原完整输入与输出均未修改，无补抽/重跑；不继承为3121或最终来源的正式冷续、性能、GC。']}
p=B/'independent-process-audit-shapes.json';assert not p.exists();p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('FINAL',ref(p))
