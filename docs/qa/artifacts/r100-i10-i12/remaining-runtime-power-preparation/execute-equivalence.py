"""Execute only the root-dispatched equivalence stage once; keep its frozen utility unchanged."""
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
SCRIPT = PREP / 'execute-equivalence.py'
REVIEW = PREP / 'root-review.json'
REVIEW_SHA = '5f410fb6451db5467a6d20667bec3a83715101d39f8a38afe0714c2297807463'
assert sys.argv[1:] == ['--root-dispatch-equivalence']

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

def existing_qa(row):
    argv = row['command']
    if argv.startswith(('/bin/zsh -c', 'python3 -')):
        return False
    return ('tools/qa/r100-i09-final-probe.mjs' in argv
            or 'tools/world-study/check-r100-browser-equivalence.mjs' in argv
            or 'playwright_chromiumdev_profile-' in argv
            or argv.startswith(('/usr/bin/caffeinate', 'caffeinate ')))

assert sha(REVIEW) == REVIEW_SHA
review = read(REVIEW)
assert review['status'] == 'operational-protocol-approved-awaiting-stage-dispatch'
assert sha(review['candidate']['path']) == review['candidate']['sha256']
plan = read(review['candidate']['path'])
stage = next(item for item in plan['stages'] if item['id'] == 'equivalence')
assert stage['argv'][2:] == stage['unchangedOriginalStage']['args']
assert stage['argv'][:2] == ['-i', '/usr/local/bin/node']
assert stage['envOverrides'] == {'GAME_URL': 'http://127.0.0.1:3122/', 'NODE_OPTIONS': '', 'DEBUG': ''}
refs = {}

def collect(value):
    if isinstance(value, dict):
        if 'path' in value and 'sha256' in value:
            before = refs.setdefault(value['path'], value['sha256'])
            assert before == value['sha256']
        for item in value.values():
            collect(item)
    elif isinstance(value, list):
        for item in value:
            collect(item)

collect(plan)
refs[str(REVIEW)] = REVIEW_SHA
refs[str(SCRIPT)] = sha(SCRIPT)
refs[str(PREP / 'equivalence-operator-command.json')] = sha(PREP / 'equivalence-operator-command.json')
for file, expected in refs.items():
    assert sha(file) == expected, file
source = read(plan['finalSource']['path'])
assert len(source['sources']) == 1397

def verify_source():
    for file, expected in source['sources'].items():
        assert sha(file) == expected, file
        assert sha(pathlib.Path(source['temporaryRoot']) / file) == expected, file

verify_source()
initial = processes()
assert not [row for row in initial.values() if existing_qa(row)]
listener = command(['lsof', '-nP', '-iTCP:3122', '-sTCP:LISTEN'])
assert re.search(r'^node\s+76518\s', listener, re.M)
audit = pathlib.Path(stage['operationalAuditDirectoryMustBeAbsent'])
out = pathlib.Path(stage['outputMustBeAbsent'])
assert not audit.exists() and not out.exists()
audit.mkdir(parents=True)
(audit / 'samples').mkdir()
(audit / 'listener-before.txt').write_text(listener)
# Unrelated/shared ancestors retain PID/PPID/comm only, never their argv.
before = []
for pid in [os.getpid(), os.getppid(), 76518]:
    row = initial.get(pid)
    if row:
        before.append({'pid': row['pid'], 'ppid': row['ppid'],
                       'comm': command(['ps', '-p', str(pid), '-o', 'comm=']).strip()})
write(audit / 'processes-before.json', {'at': now().isoformat(), 'operatorPid': os.getpid(),
                                      'operatorPpid': os.getppid(), 'processes': before})
(audit / 'assertions-before.txt').write_text(command(['/usr/bin/pmset', '-g', 'assertions']))
(audit / 'power-log-before.txt').write_text(command(['/usr/bin/pmset', '-g', 'log']))
started = now()
argv = [stage['executable'], *stage['argv']]
write(audit / 'dispatch.json', {
    'status': 'root-dispatched-equivalence-once', 'startedAt': started.isoformat(),
    'rootDispatch': 'Root explicitly dispatched equivalence342 after its gallery Chrome closed; this records that message and does not invent a signed protocol.',
    'rootOperationalReview': ref(REVIEW), 'candidate': review['candidate'], 'operatorSource': ref(SCRIPT),
    'operatorCommand': ref(PREP / 'equivalence-operator-command.json'), 'argv': argv,
    'envOverrides': stage['envOverrides'], 'source': plan['finalSource'],
    'frozenRefs': [{'path': file, 'sha256': expected} for file, expected in refs.items()],
    'sourceFilesBefore': 1397, 'operatorPid': os.getpid(), 'operatorPpid': os.getppid(),
    'exclusiveHeavyCpuAndQaBrowser': True, 'automaticRetry': False,
})
log = (audit / 'command.log').open('x')
proc = None
owners = set()
known = {}
problems = []
samples = 0
exit_code = None
try:
    proc = subprocess.Popen(argv, cwd=stage['cwd'], env={**os.environ, **stage['envOverrides']},
                            stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    write(audit / 'launch.json', {'at': now().isoformat(), 'pid': proc.pid, 'ppid': os.getpid(), 'argv': argv})
    print(json.dumps({'status': 'launched-equivalence-once', 'pid': proc.pid, 'at': now().isoformat()}), flush=True)
    deadline = time.monotonic() + 5
    next_sample = time.monotonic()
    browser_seen = False
    while proc.poll() is None:
        if time.monotonic() >= next_sample:
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
                browser_seen |= 'playwright_chromiumdev_profile-' in row['command']
            assertions = command(['/usr/bin/pmset', '-g', 'assertions'])
            matched = [int(match[1]) for match in re.finditer(
                r'^\s*pid (\d+)\(caffeinate\):.*\bPreventUserIdleSystemSleep\b.*$', assertions, re.M)
                if int(match[1]) in owned]
            owners.update(matched)
            samples += 1
            write(audit / 'samples' / ('%04d.json' % samples), {
                'at': now().isoformat(), 'sequence': samples, 'launchPid': proc.pid,
                'processes': related, 'ownedIdleSleepAssertionPids': matched,
            })
            (audit / 'samples' / ('%04d-assertions.txt' % samples)).write_text(assertions)
            if not matched and proc.poll() is None and (owners or time.monotonic() >= deadline):
                raise RuntimeError('Missing scoped idle-sleep assertion while the utility remains live')
            # Short startup samples capture the actual Node/Chrome child PIDs, then remain lightweight.
            next_sample = time.monotonic() + (30 if browser_seen else 1)
        time.sleep(0.2)
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
finally:
    log.close()
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
    selected = []
    sleeps = []
    for line in power.splitlines():
        match = re.match(r'^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d{4})\s+(\S+)', line)
        if not match:
            continue
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
        verify_source()
    except Exception as error:
        problems.append({'type': 'SourceChanged', 'message': str(error)})
    binding = read(out / 'source-binding.json') if (out / 'source-binding.json').exists() else None
    report = read(out / 'browser-equivalence.json') if (out / 'browser-equivalence.json').exists() else None
    if exit_code != 0 or not binding or binding['status'] != 'pass':
        problems.append({'type': 'FrozenProbeNotPassed', 'exitCode': exit_code, 'bindingStatus': binding.get('status') if binding else None})
    if not report or report['status'] != 'pass' or len(report['results']) != 342:
        problems.append({'type': 'IncompleteEquivalence', 'status': report.get('status') if report else None})
    elif (sum(row['revision'] == 6 for row in report['results']) != 324
          or sum(row['revision'] == 1 for row in report['results']) != 18
          or not all(row['exactIdentity'] and row['actual'] == row['expected'] for row in report['results'])):
        problems.append({'type': 'EquivalenceIdentityMismatch'})
    receipt = {
        'status': 'pass-equivalence342' if not problems else 'failed-preserved-no-retry',
        'startedAt': started.isoformat(), 'endedAt': ended.isoformat(), 'wallSeconds': (ended-started).total_seconds(),
        'operatorSource': ref(SCRIPT), 'operatorCommand': ref(PREP / 'equivalence-operator-command.json'),
        'rootReview': ref(REVIEW), 'source': plan['finalSource'], 'sourceFilesBeforeAndAfter': 1397,
        'exitCode': exit_code, 'launchPid': proc.pid if proc else None, 'knownProcessTree': list(known.values()),
        'ownedIdleAssertionPids': sorted(owners), 'powerSamples': samples, 'noSystemSleep': not sleeps,
        'ownedProcessesClosed': not alive, 'ownedAssertionsReleased': not remaining,
        'sourceBinding': ref(out / 'source-binding.json') if binding else None,
        'report': ref(out / 'browser-equivalence.json') if report else None,
        'actualIdentities': len(report['results']) if report else 0, 'problems': problems,
        'nextStage': 'Stop here; root reviews and dispatches the next stage separately.', 'automaticRetry': False,
    }
    write(audit / 'execution.json', receipt)
    print(json.dumps({'status': receipt['status'], 'receipt': ref(audit / 'execution.json'), 'problems': problems}), flush=True)
    if problems:
        raise SystemExit(1)
