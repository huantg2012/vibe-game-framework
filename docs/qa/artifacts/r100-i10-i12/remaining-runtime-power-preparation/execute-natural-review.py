"""Run the already-dispatched frozen offline reviewer once after natural48 finishes."""
import hashlib
import json
import os
import pathlib
import re
import signal
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone

BASE = pathlib.Path('docs/qa/artifacts/r100-i10-i12')
PREP = BASE / 'remaining-runtime-power-preparation'
SCRIPT = PREP / 'execute-natural-review.py'
COMMAND = PREP / 'natural-review-operator-command.json'
PLAN = BASE / 'final-runtime-command-preparation/commands.json'
PLAN_SHA = '24a0e53e23461cbe5978ee5fa6c0e0b35d323d139c0b36b9e74f6cc790944361'
POWER_REVIEW = PREP / 'root-review.json'
POWER_REVIEW_SHA = '5f410fb6451db5467a6d20667bec3a83715101d39f8a38afe0714c2297807463'
assert sys.argv[1:] == ['--root-dispatch-natural-review']

def now():
    return datetime.now(timezone.utc)

def sha(file):
    return hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()

def read(file):
    return json.loads(pathlib.Path(file).read_text())

def ref(file):
    return {'path': str(file), 'sha256': sha(file)}

def write(file, value):
    with pathlib.Path(file).open('x') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')

def command(argv):
    return subprocess.run(argv, capture_output=True, text=True, check=True, timeout=30).stdout

def processes():
    result = {}
    for line in command(['ps', '-Ao', 'pid=,ppid=,command=']).splitlines():
        fields = line.strip().split(None, 2)
        if len(fields) == 3:
            pid, ppid, argv = fields
            result[int(pid)] = {'pid': int(pid), 'ppid': int(ppid), 'command': argv}
    return result

assert sha(PLAN) == PLAN_SHA and sha(POWER_REVIEW) == POWER_REVIEW_SHA
plan = read(PLAN)
stage = next(row for row in plan['stages'] if row['id'] == 'natural-review')
assert stage['command'] == 'node'
assert stage['env'] == {'TSX_TSCONFIG_PATH': 'tools/contam-preview/tsconfig.json'}
assert stage['args'] == ['--import', 'tsx', 'tools/qa/r100-revision6-review-continuous.mjs',
                         '--input', str(BASE / 'continuous-final108'),
                         '--output', str(BASE / 'continuous-final108/review.json')]
natural_receipt_path = BASE / 'remaining-runtime-power-execution/natural48/execution.json'
natural_receipt = read(natural_receipt_path)
assert natural_receipt['status'] == 'completed-natural48-summary-pending-offline-review'
assert natural_receipt['actualTrips'] == 48 and natural_receipt['exitCode'] == 0
assert natural_receipt['ownedProcessesClosed'] and natural_receipt['ownedAssertionsReleased']
assert natural_receipt['problems'] == [] and natural_receipt['noSystemSleep']
summary_path = BASE / 'continuous-final108/summary.json'
policy_path = BASE / 'continuous-final108/policy-freeze.json'
summary, policy = read(summary_path), read(policy_path)
assert summary['validatedTrips'] == 48 and summary['sourceValid'] is True
assert summary['status'] == 'completed-continuous-samples-pending-review'
assert len(summary['branches']) == 4 and all(row['validatedTrips'] == 12 for row in summary['branches'])
assert policy['review']['tool'] == 'tools/qa/r100-revision6-review-continuous.mjs'
assert policy['review']['toolSha256'] == '28db9ca4224f48e06ea9fadf50521fbff80d58b45d01512c8a29a2fc5b0b57b5'
refs = {str(PLAN): PLAN_SHA, str(POWER_REVIEW): POWER_REVIEW_SHA,
        str(natural_receipt_path): sha(natural_receipt_path), str(summary_path): sha(summary_path),
        str(policy_path): sha(policy_path), str(SCRIPT): sha(SCRIPT), str(COMMAND): sha(COMMAND)}
for row in policy['fixedFiles']:
    refs[row['file']] = row['sha256']
for row in summary['branches']:
    refs[row['report']] = row['reportSha256']
    log_file = BASE / 'continuous-final108' / row['policy'] / row['policy'] / 'journey.jsonl'
    refs[str(log_file)] = sha(log_file)
power_candidate = read(POWER_REVIEW)['candidate']
assert sha(power_candidate['path']) == power_candidate['sha256']
power_plan = read(power_candidate['path'])
refs[power_candidate['path']] = power_candidate['sha256']
for row in power_plan['systemExecutables']:
    refs[row['path']] = row['sha256']
for file, expected in refs.items():
    assert sha(file) == expected, file
source_ref = natural_receipt['source']
assert sha(source_ref['path']) == source_ref['sha256']
assert source_ref['sha256'] == 'e4477ea30d618f8d3f76bab7379961ee5fb8cc668f580c84385626509bdbd1af'
source = read(source_ref['path'])
assert len(source['sources']) == 1397

def verify_source():
    for file, expected in source['sources'].items():
        assert sha(file) == expected, file
        assert sha(pathlib.Path(source['temporaryRoot']) / file) == expected, file

verify_source()
output = pathlib.Path(stage['output'])
audit = BASE / 'remaining-runtime-power-execution/natural-review'
assert not output.exists() and not audit.exists()
audit.mkdir(parents=True)
(audit / 'samples').mkdir()
initial = processes()
before = []
for pid in [os.getpid(), os.getppid()]:
    row = initial.get(pid)
    if row:
        before.append({'pid': row['pid'], 'ppid': row['ppid'],
                       'comm': command(['ps', '-p', str(pid), '-o', 'comm=']).strip()})
write(audit / 'processes-before.json', {'at': now().isoformat(), 'processes': before})
(audit / 'assertions-before.txt').write_text(command(['/usr/bin/pmset', '-g', 'assertions']))
(audit / 'power-log-before.txt').write_text(command(['/usr/bin/pmset', '-g', 'log']))
argv = ['/usr/bin/caffeinate', '-i', '/usr/local/bin/node', *stage['args']]
started = now()
write(audit / 'dispatch.json', {
    'status': 'root-dispatched-original-offline-natural-review-once', 'startedAt': started.isoformat(),
    'rootDispatch': 'Root dispatched the original natural48 summary and original offline review together; no additional browser or gameplay attempt is authorized here.',
    'operatorSource': ref(SCRIPT), 'operatorCommand': ref(COMMAND), 'originalCommandPlan': ref(PLAN),
    'powerProtocolReview': ref(POWER_REVIEW), 'argv': argv, 'envOverrides': stage['env'],
    'frozenRefs': [{'path': file, 'sha256': expected} for file, expected in refs.items()],
    'gameplayAttemptsAdded': 0, 'automaticRetry': False,
})
proc = None
known = {}
owners = set()
problems = []
samples = 0
exit_code = None
with (audit / 'command.log').open('x') as log:
    try:
        proc = subprocess.Popen(argv, cwd=pathlib.Path.cwd(), env={**os.environ, **stage['env']},
                                stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        write(audit / 'launch.json', {'at': now().isoformat(), 'pid': proc.pid, 'ppid': os.getpid(), 'argv': argv})
        deadline = time.monotonic() + 5
        while proc.poll() is None:
            rows = processes()
            owned = {proc.pid}
            for _ in range(20):
                children = {pid for pid, row in rows.items() if row['ppid'] in owned}
                if children <= owned:
                    break
                owned |= children
            related = [row for pid, row in rows.items() if pid in owned]
            for row in related:
                known[row['pid']] = row
            assertions = command(['/usr/bin/pmset', '-g', 'assertions'])
            matched = [int(match[1]) for match in re.finditer(
                r'^\s*pid (\d+)\(caffeinate\):.*\bPreventUserIdleSystemSleep\b.*$', assertions, re.M)
                if int(match[1]) in owned]
            owners.update(matched)
            samples += 1
            write(audit / 'samples' / ('%04d.json' % samples), {'at': now().isoformat(), 'sequence': samples,
                  'processes': related, 'ownedIdleSleepAssertionPids': matched})
            (audit / 'samples' / ('%04d-assertions.txt' % samples)).write_text(assertions)
            if not matched and proc.poll() is None and (owners or time.monotonic() >= deadline):
                raise RuntimeError('Missing scoped idle-sleep assertion while the reviewer remains live')
            time.sleep(0.1 if not owners else 0.5)
        exit_code = proc.wait()
    except BaseException as error:
        problems.append({'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()})
        if proc and proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                exit_code = proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                exit_code = proc.wait(timeout=15)
ended = now()
cleanup_deadline = time.monotonic() + 10
while True:
    rows = processes()
    alive = [row for pid, row in rows.items() if pid in known and row['command'] == known[pid]['command']]
    assertions = command(['/usr/bin/pmset', '-g', 'assertions'])
    remaining = [pid for pid in owners if re.search(
        r'^\s*pid ' + str(pid) + r'\(caffeinate\):.*\bPreventUserIdleSystemSleep\b', assertions, re.M)]
    if (not alive and not remaining) or time.monotonic() >= cleanup_deadline:
        break
    time.sleep(0.2)
(audit / 'assertions-after.txt').write_text(assertions)
write(audit / 'processes-after.json', {'at': now().isoformat(), 'ownedAlive': alive, 'remainingOwnedAssertions': remaining})
if alive or remaining:
    problems.append({'type': 'OwnedResourcesRemain', 'processes': alive, 'assertions': remaining})
if not owners:
    problems.append({'type': 'ScopedAssertionNeverObserved'})
power = command(['/usr/bin/pmset', '-g', 'log'])
(audit / 'power-log-after.txt').write_text(power)
selected, sleeps = [], []
for line in power.splitlines():
    match = re.match(r'^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d{4})\s+(\S+)', line)
    if match:
        at = datetime.strptime(match[1], '%Y-%m-%d %H:%M:%S %z')
        if started.replace(microsecond=0) <= at <= ended:
            selected.append(line)
            if match[2] == 'Sleep':
                sleeps.append(line)
(audit / 'power-log-execution-window.txt').write_text('\n'.join(selected) + '\n')
if sleeps:
    problems.append({'type': 'SleepDuringExecution', 'events': sleeps})
for file, expected in refs.items():
    if sha(file) != expected:
        problems.append({'type': 'FrozenInputChanged', 'path': file})
try:
    assert sha(source_ref['path']) == source_ref['sha256']
    verify_source()
except Exception as error:
    problems.append({'type': 'SourceChanged', 'message': str(error)})
result = read(output) if output.exists() else None
if (exit_code != 0 or not result or result['status'] != 'complete-valid-data-pending-experience-review'
        or result['experienceApproval'] != 'pending' or result['validatedTrips'] != 48
        or result['gradeCounts'] != {'low': 16, 'medium': 16, 'severe': 16}
        or len(result['branches']) != 4 or any(len(row['rows']) != 12 for row in result['branches'])):
    problems.append({'type': 'OfflineReviewNotComplete', 'exitCode': exit_code,
                     'reviewStatus': result.get('status') if result else None})
receipt = {
    'status': 'complete-offline-natural-review-pending-root-experience' if not problems else 'failed-preserved-no-retry',
    'startedAt': started.isoformat(), 'endedAt': ended.isoformat(), 'wallSeconds': (ended-started).total_seconds(),
    'operatorSource': ref(SCRIPT), 'operatorCommand': ref(COMMAND), 'exitCode': exit_code,
    'source': source_ref, 'sourceFilesBeforeAndAfter': 1397,
    'knownProcessTree': list(known.values()), 'ownedIdleAssertionPids': sorted(owners), 'powerSamples': samples,
    'ownedProcessesClosed': not alive, 'ownedAssertionsReleased': not remaining, 'noSystemSleep': not sleeps,
    'review': ref(output) if result else None, 'gameplayAttemptsAdded': 0,
    'mandatoryDiagnosis': result.get('mandatoryDiagnosis', []) if result else [], 'problems': problems,
    'experienceApproval': 'pending-independent-root-review',
    'nextStage': 'Stop for root actual-experience review; budget and lifecycle remain undispatched.', 'automaticRetry': False,
}
write(audit / 'execution.json', receipt)
print(json.dumps({'status': receipt['status'], 'receipt': ref(audit / 'execution.json'), 'problems': problems}), flush=True)
if problems:
    raise SystemExit(1)
