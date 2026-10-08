"""Run the two predeclared final controlled matrices against frozen source."""
import hashlib
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BASE = Path('docs/qa/artifacts/r100-i10-i12')
OUTPUT = BASE / 'controlled-matrices-final108'
RECEIPTS = BASE / 'final-controlled-execution'
SOURCE = BASE / 'final-source/source-snapshot.json'
PLAN = BASE / 'qualification-plan.json'
PREPARER = Path('tools/qa/prepare-r100-controlled-matrices.mjs')

def now():
    return datetime.now(timezone.utc).isoformat()

def sha(file):
    return hashlib.sha256((ROOT / file).read_bytes()).hexdigest()

def ref(file):
    return {'path': str(file), 'sha256': sha(file)}

assert sha(PREPARER) == '652a68a425c08eff106faf973c48df886e7e874bca6641814c14312eb8885829'
assert not (ROOT / OUTPUT).exists() and not (ROOT / RECEIPTS).exists()
source_ref = ref(SOURCE)
assert source_ref['sha256'] == 'e4477ea30d618f8d3f76bab7379961ee5fb8cc668f580c84385626509bdbd1af'
source = json.loads((ROOT / SOURCE).read_text())
plan_ref = ref(PLAN)
assert plan_ref['sha256'] == 'd493aeb9d26b4758c90434c8c5a8cdfb74fb581800a2c37a50ae3b2eb91f0c25'
(ROOT / RECEIPTS).mkdir()
result = {'status': 'running', 'startedAt': now(), 'finalSource': source_ref,
          'qualificationPlan': plan_ref, 'preparer': ref(PREPARER),
          'resourceWindow': 'Root sole heavy CPU while runtime owns non-performance production Chrome; equivalence waits until this window is released.',
          'stages': [], 'limits': 'Controlled ability and recorded-renderer contracts only; no actual GPU, natural play, audio or human visual approval.'}

def save():
    (ROOT / RECEIPTS / 'execution.json').write_text(json.dumps(result, indent=2) + '\n')

def verify(commands=None):
    assert ref(SOURCE) == source_ref and ref(PLAN) == plan_ref
    for file, expected in source['sources'].items():
        assert sha(Path(source['temporaryRoot']) / file) == expected, file
        assert sha(Path(file)) == expected, file
    if commands:
        assert ref(OUTPUT / 'commands.json') == result['commands']
        for item in commands['copiedInputs']:
            assert sha(Path(item['original'])) == item['sha256']
            assert sha(Path(item['target'])) == item['sha256']
        for stage in commands['commands']:
            assert ref(Path(stage['executor']['path'])) == stage['executor']
    return {'sourceFiles': len(source['sources']), 'workingTreeAndFrozenExact': True, 'sourceAndPlanExact': True, 'at': now()}

def run(stage_id, command, cwd, env, commands=None):
    stage = {'id': stage_id, 'command': command, 'cwd': str(cwd), 'startedAt': now(), 'before': verify(commands)}
    result['stages'].append(stage); save()
    start = time.monotonic()
    log = RECEIPTS / (stage_id + '.log')
    with (ROOT / log).open('x') as out:
        process = subprocess.run(command, cwd=cwd, env=env, stdout=out, stderr=subprocess.STDOUT)
    stage.update(exitCode=process.returncode, durationSeconds=round(time.monotonic()-start, 6), finishedAt=now(), log=ref(log))
    stage['after'] = verify(commands)
    save()
    print(json.dumps({'stage': stage_id, 'exitCode': process.returncode, 'seconds': stage['durationSeconds']}), flush=True)
    if process.returncode:
        result['status'] = 'failed'; save()
        raise SystemExit(process.returncode)

environment = os.environ.copy()
environment.pop('QA_WORLDS', None)
run('prepare', ['node', str(PREPARER), '--source', str(SOURCE), '--output', str(OUTPUT)], ROOT, environment)
result['commands'] = ref(OUTPUT / 'commands.json')
commands = json.loads((ROOT / OUTPUT / 'commands.json').read_text())
assert commands['frozenRuntime']['sha256'] == source_ref['sha256']
for stage in commands['commands']:
    assert stage['finalCoverageCompiled'] is True
    env = environment.copy()
    for key in stage['unsetEnvironment']:
        env.pop(key, None)
    run(stage['kind'], [stage['command'], *stage['args']], stage['cwd'], env, commands)
    result[stage['kind']] = ref(OUTPUT / (stage['kind'] + '-report.json'))
result['status'] = 'pass'
result['finishedAt'] = now()
save()
print(json.dumps({'execution': ref(RECEIPTS / 'execution.json'), 'status': 'pass'}), flush=True)
