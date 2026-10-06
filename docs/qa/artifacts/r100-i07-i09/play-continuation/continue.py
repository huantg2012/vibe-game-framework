"""One authorized serial handoff. No gameplay policy, retries or seeds are chosen here.

Run only after the gallery's sole-browser window has been explicitly returned.
Every output is new; failures stop this scheduler and remain available for review.
"""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[5]
BASE = Path('docs/qa/artifacts/r100-i07-i09')
OUT = BASE / 'play-continuation'
WRAPPER = 'tools/qa/r100-i07-i09-coverage.mjs'
HARNESS = 'tools/qa/r100-i07-i09-journey.mjs'
PLAN = BASE / 'play-queue/plan.json'
OLD = BASE / 'legacy20-play-serial-v13'
RECHECK16 = BASE / 'legacy20-play-recheck-016-v13'
RECHECK77 = BASE / 'legacy20-play-recheck-077-078-v13'
PARENT = 97333
SCHEDULER = 97338
PAUSE = '/tmp/coh-r100-i07-i09-20261005.pause'
V13_SHA = '6e2b8d76a7e03a08e7b774d2465954e51636f8ceb2467dfdc880702541e3587f'


def read(file):
    return json.loads(Path(file).read_text())


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def processes():
    rows = subprocess.check_output(['ps', '-axo', 'pid,ppid,stat,command'], text=True).splitlines()[1:]
    return {int(parts[0]): {'ppid': int(parts[1]), 'stat': parts[2], 'command': parts[3]}
            for line in rows if len(parts := line.strip().split(None, 3)) == 4}


def no_browser():
    found = [p for p in processes().values()
             if 'playwright_chromiumdev_profile-' in p['command']
             or ('node --import tsx ' + HARNESS) in p['command']]
    assert not found, 'Wait for the owned QA browser and journey process to close'


def completed(folder, count, allow_original_failures=False):
    policy, report = read(folder / 'policy-freeze.json'), read(folder / 'batch-report.json')
    assert report['status'] == 'completed-fixed-attempts-pending-review'
    assert len(report['attempts']) == len(policy['cases']) == count
    assert sorted(x['dir'] for x in report['attempts']) == sorted(x['dir'] for x in policy['cases'])
    assert all(x.get('endedAt') and isinstance(x.get('exitCode'), int) for x in report['attempts'])
    if not allow_original_failures:
        assert all(x['exitCode'] == 0 for x in report['attempts']), f'{folder}: retain failure before proceeding'
    return report


def validate_start():
    assert sha(HARNESS) == V13_SHA
    old = completed(OLD, 120, True)
    assert [x['index'] for x in old['attempts'] if x['exitCode'] != 0] == [16, 77, 78]
    retry = completed(RECHECK16, 1)
    original_identity = read(OLD / old['attempts'][15]['dir'] / 'report.json')['realJourneyAttempts'][0]['identity']
    retry_identity = read(RECHECK16 / retry['attempts'][0]['dir'] / 'report.json')['realJourneyAttempts'][0]['identity']
    assert original_identity == retry_identity, '016 recheck must preserve the whole committed identity'
    p = processes()
    assert PARENT in p and 'Python' in p[PARENT]['command']
    assert p[SCHEDULER]['ppid'] == PARENT and p[SCHEDULER]['stat'].startswith('T')
    assert p[SCHEDULER]['command'] == 'node ' + WRAPPER
    assert not RECHECK77.exists(), 'Never overwrite an earlier retry'
    assert not Path(PAUSE).exists(), 'Respect a pending exclusive resource window'
    no_browser()


os.chdir(ROOT)
if '--check' in sys.argv:
    validate_start()
    print('PASS continuation preflight: old120 closed, exact016 identity, stopped owned scheduler, browser closed')
    sys.exit(0)

validate_start()
receipt = OUT / 'execution.json'
assert not receipt.exists(), 'Never overwrite a previous continuation execution'
fixed_paths = [str(Path(__file__).resolve()), HARNESS, WRAPPER, str(PLAN),
               'tools/qa/r100-i07-i09-play-queue.mjs', 'tools/qa/r100-play-qualification.mjs']
fixed = [{'path': p, 'sha256': sha(p)} for p in fixed_paths]
state = {'version': 1, 'status': 'running', 'startedAt': now(), 'pid': os.getpid(),
         'fixedFiles': fixed, 'stages': [], 'method': 'Serial exact retries, independent old20 qualification, existing stopped queue, then approved144. No new source enablement or final acceptance.'}


def save():
    temporary = receipt.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(receipt)


def stable():
    for row in fixed:
        assert sha(row['path']) == row['sha256'], f"Changed scheduling input: {row['path']}"


def command(stage, argv, env=None):
    stable()
    row = {'stage': stage, 'startedAt': now(), 'argv': argv, 'status': 'running'}
    state['stages'].append(row)
    save()
    print('START', stage, flush=True)
    with (OUT / f'{stage}.log').open('x') as log:
        child = subprocess.Popen(argv, env=env, stdout=log, stderr=subprocess.STDOUT)
        row['pid'] = child.pid
        save()
        row['exitCode'] = child.wait()
    row['endedAt'] = now()
    row['status'] = 'pass' if row['exitCode'] == 0 else 'failed'
    save()
    print('END', stage, row['exitCode'], flush=True)
    assert row['exitCode'] == 0, f'{stage} failed; original evidence retained'


save()
try:
    env = dict(os.environ)
    env.update(GAME_URL='http://127.0.0.1:3089/', QA_SOURCE_MANIFEST=str(BASE / 'b01-final-source/source-snapshot.json'),
               QA_OUTPUT_DIR=str(RECHECK77), QA_CONCURRENCY='1', QA_RESOURCE_PAUSE_FILE=PAUSE,
               QA_WORLDS='pressed-dunes', QA_GRADES='severe', QA_SEEDS='20261005,3075192741')
    command('recheck-077-078', ['node', WRAPPER], env)
    completed(RECHECK77, 2)
    no_browser()

    worlds = list(dict.fromkeys(row['world'] for row in read(OLD / 'policy-freeze.json')['cases']))
    summary_plan = OUT / 'old20-summary-plan.json'
    summary_plan.write_text(json.dumps({'version': 1, 'worlds': worlds, 'batches': list(map(str, [OLD, RECHECK16, RECHECK77]))}, indent=2) + '\n')
    command('old20-qualification', ['node', 'tools/qa/r100-play-qualification.mjs', '--plan', str(summary_plan), '--output', str(OUT / 'old20-summary.json')])
    assert read(OUT / 'old20-summary.json')['qualifiedGradePairs'] == 60

    stable()
    p = processes()
    assert p[SCHEDULER]['ppid'] == PARENT and p[SCHEDULER]['stat'].startswith('T')
    assert p[SCHEDULER]['command'] == 'node ' + WRAPPER
    no_browser()
    row = {'stage': 'existing-b01-b02', 'pid': SCHEDULER, 'parentPid': PARENT, 'status': 'running', 'startedAt': now()}
    state['stages'].append(row)
    save()
    os.kill(SCHEDULER, signal.SIGCONT)
    print('RESUME', SCHEDULER, flush=True)
    while PARENT in processes():
        time.sleep(2)
    for folder, count in [('b01-other-play-v13', 18), ('b01-rib-upper-play-v13', 4), ('b02-play-v13', 24)]:
        completed(BASE / folder, count)
    no_browser()
    row.update(status='pass', endedAt=now())
    save()
    command('remaining144', ['node', 'tools/qa/r100-i07-i09-play-queue.mjs', '--run', '--plan', str(PLAN), '--output', str(BASE / 'play-queue/execution')])
    state['status'] = 'completed-fixed-play-pending-qualification-and-review'
except Exception as error:
    state['status'] = 'stopped-on-failure'
    state['failure'] = repr(error)
    print('STOP', repr(error), flush=True)
    sys.exitCode = 1
finally:
    state['endedAt'] = now()
    save()
sys.exit(getattr(sys, 'exitCode', 0))
