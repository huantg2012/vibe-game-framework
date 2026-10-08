import json,pathlib,hashlib,math,collections,datetime
R=pathlib.Path('/Users/yilungao/coh'); B=R/'docs/qa/artifacts/r100-i10-i12/b12-current-qualified'
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

assert s['emptyReturns']==1 and s['searchAndExtractAttempts']==23 and s['deaths']==0
assert len({(r['world'],r['grade'],r['requestedSeed']) for r in rows})==24
assert ref(R/commands['source']['path'])['sha256']==commands['source']['sha256']
assert s['planSha256']==ref(B/'play-summary-plan.json')['sha256']
assert s['sources'][0]['policySha256']==ref(B/'play/policy-freeze.json')['sha256']
assert s['sources'][0]['reportSha256']==ref(B/'play/batch-report.json')['sha256']
for f in ob['files']: assert ref(R/f['path'])['sha256']==f['sha256']
Path=pathlib.Path
Path('/tmp/r100-b12-audited-rows.json').write_text(json.dumps({'rows':rows,'totals':dict(totals)},ensure_ascii=False,indent=2)+'\n')
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
pathlib.Path('/tmp/r100-b12-audited-rows.json').write_text(json.dumps({'rows':rows,'totals':dict(totals),'observerCounts':dict(observerCounts),'source':commands['source']},ensure_ascii=False,indent=2)+'\n')
print('CORE PASS',len(rows))

for a in s['attempts']:
 report=read(R/a['report']);j=report['realJourneyAttempts'][0];checkpoint=j['entrySave']['state']['riftCheckpoint']
 assert checkpoint['identity']==j['identity'] and checkpoint['runId']==j['entrySave']['state']['inventory']['run']['id']
 assert read((R/a['report']).parent/a['grade']/'1-before.save.json')==j['before']['state']
 assert j['entryState']['seed']['seed']==j['identity']['seed']==j['entrySave']['state']['inventory']['run']['dropPlan']['runSeed'];assert j['entryState']['seed']['recipeId']==j['identity']['recipeId']
assert collections.Counter(r['outcome'] for r in rows)=={'non-entry-search-and-extract':23,'empty-extract':1}
print('DETAILS', json.dumps({'summary':{k:s[k] for k in ['searchAndExtractAttempts','emptyReturns','nearEntryOnlyReturns','deaths']},'observer':dict(observerCounts),'moduleDamage':dict(collections.Counter(json.dumps(r['moduleDamage'],sort_keys=True) for r in rows)),'elapsedMax':max(rows,key=lambda r:r['elapsedMs'])['index'],'chaosMax':max(rows,key=lambda r:r['maxRecordedSnapshotChaos'])['index'],'hpMin':min(rows,key=lambda r:r['minRecordedSnapshotHp'])['index'],'kindlingTotal':sum(r['settledKindling'] for r in rows),'lootTotal':sum(r['returnedLootCount'] for r in rows),'inputTotal':sum(r['activeToolInputs'] for r in rows),'usedInputTotal':sum(r['consumingToolInputs'] for r in rows),'noToolProcesses':sum(r['consumingToolInputs']==0 for r in rows),'hpLossProcesses':sum(r['minRecordedSnapshotHp']<145 for r in rows),'generationAttempts':dict(collections.Counter(r['matchingGenerationAttempt'] for r in rows))},ensure_ascii=False))
# Report-only completion; all assertions above use original sources and saved process data.
assert all(r['effectiveSeed']==r['requestedSeed'] for r in rows)
assert all(r['moduleDamage']=={'CORE':4,'STORAGE':14,'PURIFIER':4} for r in rows)
assert [r['index'] for r in rows if r['outcome']=='empty-extract']==[7]
assert all(len(r['actualPickups'])==1 and r['actualPickups'][0]['tier'] in ['contested','deep'] for r in rows if r['index']!=7)
assert sum(r['settledKindling'] for r in rows)==108 and sum(r['returnedLootCount'] for r in rows)==7
assert sum(r['activeToolInputs'] for r in rows)==38 and sum(r['consumingToolInputs'] for r in rows)==35
assert sum(r['minRecordedSnapshotHp']<145 for r in rows)==5 and sum(r['consumingToolInputs']==0 for r in rows)==11
assert totals=={'blind_needle_compass':10,'ash_tooth':12,'passive-sight-at-departure':24,'crowbar_fine_standard':19,'empty_photo_frame':13}
assert rows[6]['settledKindling']==rows[6]['returnedLootCount']==0
outcomes=read(B/'outcomes.json');assert outcomes['summary']==ref(B/'play-summary.json')
assert len(outcomes['outcomes'])==24
for outcome,a in zip(outcomes['outcomes'],s['attempts']):
 for key in ['world','grade','seed','report','reportSha256','actualPickups','nearEntryPickups','searchAndExtract','processComplete']:
  assert outcome[key]==a[key],key
assert ref(R/ob['execution']['path'])==ob['execution']
rootViews=read(B/'root-viewed-frames.json');viewed=set(rootViews['personallyViewed'])
frameChoices=[]
for case,filename,why in [
 (6,'1-search-3.png','double重第二seed放弃敌近污染物后真实到deep薪781.10px，65.66s/损30HP/假身2、罗盘1、灰釉齿2、武器4。'),
 (7,'1-search-3.png','唯一真空返；敌近限制和危险接近保留，77.56s/损105HP、主动7消耗、武器4，不能算近入口搜撤。'),
 (7,'1-field-result.png','同趟0薪0物、HP40；空返后仍有正常模块冲击，不拿全批12pairs通过抹去这次损失。'),
 (12,'1-search-1.png','offset重第二seedcontest532.89px、31.70s全HP无主动工具，是相对低压成功。'),
 (17,'1-search-1.png','pinched重第一seedcontest608.47px、24.58s全HP无主动工具；本world两重档均未证明深入高压。'),
 (18,'1-search-1.png','pinched重第二seedcontest593.35px、25.18s全HP无主动工具；补足两原seed的限定范围。'),
 (22,'1-search-4.png','全批最长90.96s和最高chaos113.86；两敌近目标被拒后真实取得deep薪640.45px。'),
 (22,'1-field-result.png','同趟9薪/HP115，假身4耗尽、罗盘1、灰釉齿1、武器6；另一次灰釉齿按键used0不计消耗。'),
 (24,'1-search-1.png','最后world重第二seed仅contest561.88px、37.77s全HP，仅罗盘1；不能用本world中档最高压趟代签重档压迫。')]:
 row=rows[case-1];p=(R/row['report']['path']).parent/row['grade']/filename;assert p.exists()
 frameChoices.append({'case':case,'image':ref(p),'reason':why,'listedInRootViewedFramesAtAudit':str(p.relative_to(R)) in viewed,'visuallyReviewedByThisAudit':False})
pickups=[p for row in rows for p in row['actualPickups']]
economy={'separateFixedFixtureKindlingTotal':108,'returnedContaminants':7,'activeToolInputs':38,'consumingToolInputs':35,'nonConsumingInputs':3,'processesWithoutActiveToolConsumption':11,'processesWithHpLoss':5,'perExtractModuleDamage':{'CORE':4,'STORAGE':14,'PURIFIER':4}}
out={
 'status':'bounded-independent-process-data-pass','reviewer':'identity_shapes','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'B12原24固定世界/双种子过程只读独审；核原source/identity、实际收集、同run结算、真实消耗及Worker观察。没有运行浏览器/地图，没有改原结果或换seed。',
 'auditScript':ref(pathlib.Path(__file__)),
 'inputs':[ref(B/x) for x in ['play-summary.json','outcomes.json','play-summary-plan.json','play-commands.json','play/batch-report.json','play/policy-freeze.json','worker-observation-summary.json','root-viewed-frames.json']],
 'source':commands['source'],
 'coverage':{'uniqueOriginalProcesses':24,'actualAttempts':24,'worlds':plan['worlds'],'grades':plan['grades'],'requestedSeeds':plan['seeds'],'qualifiedGradePairs':12,'retries':0,'nonEntrySearchAndExtract':23,'nearEntryOnly':0,'trueEmptyReturns':1,'deaths':0,'effectiveSeedEqualsRequested':24},
 'integrity':[
 '原固定计划/policy/batch逐项匹配24唯一请求，全部原reportSHA匹配，24runId唯一。没有通过重抽或补替换改善结果。',
 '3121 manifest与原冻结earned-storage字节SHA匹配；原harnessSHA及逐report依赖完全等于policy，未用当前工作树重算世界。',
 'entry/returned实际存档逐字段等于report；entry checkpoint identity等于完整report identity，checkpoint runId及dropPlan seed对应同趟，24均active→settled/extract/baseSettled。',
 'entry→terminal真实节点变化23趟恰1个contest/deep，距入口479.53–825.40px；污染物有同run/node携返receipt，薪柴有同趟入账。007恰0节点、0薪、0携返物，确为真空返。',
 '38个主动按键中35个used1，逐item匹配actionReceipts与前后余次；005/006/022各一次灰釉齿used0独立保留。武器19耐久、被动出征24次另核，未把按键当实际消费。',
 '25原observer日志逐SHA/事件重数；24context/24page及72带ID Worker创建关闭成对。24network摘要无失败、pending为空、请求响应相等；pageerror/console-error/requestfailed均无。'],
 'generationSchedule':{'inputs':scheduleInputs,'matchingFrozenAttempts':dict(collections.Counter(r['matchingGenerationAttempt'] for r in rows)),'boundary':'24请求/有效seed相等。检查既有8尝试准入规则是身份核对，不推断其它seed表现。'},
 'workerObservation':{'files':ob['files'],'recountedEventCounts':dict(observerCounts),'networkSummaries':24,'matchedWorkers':72,'observerErrors':0,'boundary':'本24受控原过程无观察异常；不倒推历史P36根因，不替代最终324正式冷续/性能/GC。'},
 'economy':economy,'toolConsumption':dict(totals),
 'pickupTierCounts':dict(collections.Counter(p['tier'] for p in pickups)),
 'pickupDistanceRangePx':{'min':min(p['distanceFromEntry'] for p in pickups),'max':max(p['distanceFromEntry'] for p in pickups)},
 'trueEmptyProcess':rows[6],'highestElapsedAndRecordedChaos':rows[21],
 'relativeLowPressureSevereCases':[12,17,18,23,24],'allProcessRows':rows,'rootFrameCandidates':frameChoices,
 'findings':[
 {'severity':'retained-negative-experience','cases':[7],'detail':'low原seed1的77.56s真空返是全批最大HP损失：145→40，耗假身4/罗盘1/灰釉齿2/武器4且0薪0物。原低档另一seed完成非入口搜撤，故原12pairs合同仍满足；不能将007说成成功搜取、近入口搜撤或隐藏它。'},
 {'severity':'bounded-pressure-evidence','cases':[6,10,21,22],'detail':'006、010、021、022有真实HP/工具成本；022中档第二seed是全批最高记录chaos113.86及最长90.96s，后取得deep薪640.45px并带回9薪，假身耗尽。'},
 {'severity':'experience-boundary','cases':[12,17,18,23,24],'detail':'这些重档原过程全HP，pinched两原seed只24–25s且无主动工具；spliced两重只contest约562px，明显弱于该world中档022的深搜。不能宣称每重档都深搜/高压或已经证明等级难度逐局严格单调。'},
 {'severity':'input-accounting','cases':[5,6,22],'detail':'三次已按Q的灰釉齿实际used0，没有对应扣次；记录为不消费输入，不猜未生效原因，不以38按键冒充38次技能消费。'}],
 'limits':[
 'controlledWorld于出发前固定且noStateInjection=false有披露，controlledBuild=null，使用成熟earned-save与几何辅助专家导航；不是自然48。',
 '108薪/7污染物及工具合计来自24独立fixture，不是连续经济净收益。每次模块冲击CORE4/STORAGE14/PURIFIER4另列，包括空返。',
 'HP/chaos取原snapshot与终态，不声称逐帧极值或性能；没有固定世界深搜强保证。',
 '未打开PNG，只提供原路径/hash及root已有亲看列表；不代签视觉/体验/听感。',
 '只绑定3121冻结源及原固定合同，最终enabled108需另source绑定；不关闭迭代。']}
p=B/'independent-process-audit-shapes.json';assert not p.exists();p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('FINAL',ref(p))
