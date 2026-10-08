"""Audit the user-directed budget stop without rewriting the original run."""
import hashlib
import json
import math
import pathlib
import re
import subprocess
from datetime import datetime, timezone

BASE = pathlib.Path('docs/qa/artifacts/r100-i10-i12')
AUDIT = BASE / 'remaining-runtime-power-execution/budget'
OUT = BASE / 'runtime-budget-final108'
SCRIPT = AUDIT / 'finalize-user-directed-sampling-stop.py'
PROFILE = 'playwright_chromiumdev_profile-7tJSAW'


def now():
    return datetime.now(timezone.utc)


def read(path):
    return json.loads(pathlib.Path(path).read_text())


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def ref(path):
    return {'path': str(path), 'sha256': sha(path)}


def write(path, value):
    with pathlib.Path(path).open('x') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')


def write_text(path, text):
    with pathlib.Path(path).open('x') as stream:
        stream.write(text)


def command(argv):
    return subprocess.run(argv, capture_output=True, text=True, check=True, timeout=30).stdout


assert not (AUDIT / 'user-directed-sampling-stop.json').exists()
requested = read(AUDIT / 'user-directed-sampling-stop-request.json')
dispatch = read(AUDIT / 'dispatch.json')
report_path = OUT / 'report.json'
binding_path = OUT / 'source-binding.json'
report_ref = ref(report_path)
binding_ref = ref(binding_path)
report = read(report_path)
binding = read(binding_path)
source = read(binding['finalSource']['path'])
problems = []

# Only persist this run's known process tree or its unique browser profile.
samples = sorted((AUDIT / 'samples').glob('*.json'))
known = {}
for file in samples:
    for process in read(file)['processes']:
        known[process['pid']] = process
rows = []
for line in command(['ps', '-Ao', 'pid=,ppid=,command=']).splitlines():
    fields = line.strip().split(None, 2)
    if len(fields) != 3:
        continue
    pid, ppid, argv = int(fields[0]), int(fields[1]), fields[2]
    known_match = pid in known and argv == known[pid]['command']
    profile_match = PROFILE in argv and not argv.startswith(('/bin/zsh -c', 'python3 -'))
    operator_match = pid == dispatch['operatorPid'] and 'execute-budget.py' in argv
    if known_match or profile_match or operator_match:
        rows.append({'pid': pid, 'ppid': ppid, 'command': argv})
assertions = command(['/usr/bin/pmset', '-g', 'assertions'])
owners = sorted({pid for file in samples for pid in read(file)['ownedIdleSleepAssertionPids']})
remaining_assertions = [pid for pid in owners if re.search(
    r'^\s*pid ' + str(pid) + r'\(caffeinate\):.*\bPreventUserIdleSystemSleep\b', assertions, re.M)]
cleanup_at = now()
write(AUDIT / 'user-stop-processes-after.json', {
    'at': cleanup_at.isoformat(), 'matchingOwnedProcesses': rows,
    'remainingOwnedIdleSleepAssertions': remaining_assertions,
    'knownProcessCountAcrossPriorSamples': len(known), 'uniqueBrowserProfile': PROFILE,
    'unrelatedProcessArgvPersisted': False,
})
write_text(AUDIT / 'user-stop-assertions-after.txt', assertions)
assert not rows and not remaining_assertions, 'Owned runtime resources remain; do not claim release'

power = command(['/usr/bin/pmset', '-g', 'log'])
write_text(AUDIT / 'user-stop-power-log-after.txt', power)
started = datetime.fromisoformat(dispatch['startedAt'])
window = []
sleeps = []
owned_power_events = []
for line in power.splitlines():
    match = re.match(r'^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d{4})\s+(\S+)', line)
    if not match:
        continue
    at = datetime.strptime(match[1], '%Y-%m-%d %H:%M:%S %z')
    if started.replace(microsecond=0) <= at <= cleanup_at:
        window.append(line)
        if match[2] == 'Sleep':
            sleeps.append(line)
        if 'caffeinate' in line and any(re.search(r'\b' + str(pid) + r'\b', line) for pid in owners):
            owned_power_events.append(line)
write_text(AUDIT / 'user-stop-power-log-window.txt', '\n'.join(window) + '\n')

# This fresh check happens after the measurement process and browser have exited.
assert len(source['sources']) == 1397
source_mismatches = []
for path, expected in source['sources'].items():
    for location in [pathlib.Path(path), pathlib.Path(source['temporaryRoot']) / path]:
        if sha(location) != expected:
            source_mismatches.append(str(location))
input_mismatches = []
for frozen in dispatch['frozenRefs']:
    if sha(frozen['path']) != frozen['sha256']:
        input_mismatches.append(frozen['path'])
assert ref(binding['finalSource']['path']) == binding['finalSource']
assert report['worlds'] == binding['worldIds'] and len(report['worlds']) == 108
assert binding['beforeFiles']['files'] == binding['afterFiles']['files'] == 1397
assert binding['beforeRuntimeVerified'] and binding['afterRuntimeVerified'] and binding['servedSourceVerified']
assert binding['beforeServedHashes'] == binding['afterServedHashes']
assert len(binding['beforeServedHashes']) == 1393
assert all(source['sources'].get(path) == digest for path, digest in binding['afterServedHashes'].items())
write(AUDIT / 'source-consistency-after-user-stop.json', {
    'at': now().isoformat(), 'source': binding['finalSource'],
    'workingSourceCount': 1397, 'frozenSourceCount': 1397,
    'sourceMismatches': source_mismatches, 'frozenInputMismatches': input_mismatches,
    'frozenInputCount': len(dispatch['frozenRefs']),
    'originalBinding': binding_ref, 'originalBindingStatus': binding['status'],
    'originalBeforeAndAfterRuntimeVerified': True,
    'originalBeforeAndAfterServedHashesCount': 1393,
    'originalBeforeAndAfterServedHashesEqualManifest': True,
    'httpVerificationProvenance': 'The unchanged original wrapper completed these before/after HTTP checks despite the intentionally interrupted run failing its full-108 contract.',
})
assert not source_mismatches and not input_mismatches

assert report['status'] == binding['status'] == 'failed'
assert report['errors'] == []
assert report['exclusiveWindow'] is True
assert len(report['cases']) == requested['completedAtStopRequest'] == 74
assert len(report['caseProgress']) == 75
assert [row['world'] for row in report['cases']] == report['worlds'][:74]
assert [row['world'] for row in report['caseProgress']] == report['worlds'][:75]
assert report['currentCase']['world'] == report['worlds'][74] == 'felt-wedges'
assert report['currentCase']['index'] == 74
assert report['currentCase']['status'] == 'failed'
assert 'Target page, context or browser has been closed' in report['currentCase']['failure']
assert report['currentCase'] == report['caseProgress'][-1]
assert report['caseProgress'][-1]['finishedAt'] >= requested['requestedAt'].replace('+00:00', 'Z')

complete = []
for index, row in enumerate(report['cases']):
    issues = []
    def require(condition, message):
        if not condition:
            issues.append(message)
    require(row['world'] == report['worlds'][index], 'Original order mismatch')
    require(row['grade'] == 'severe' and row['seed'] == 20261004, 'Original severe seed mismatch')
    for key in ['frames', 'cpu', 'materialSubmit']:
        stats = row[key]
        require(isinstance(stats['count'], int) and stats['count'] > 0, key + ': empty measurements')
        require(all(isinstance(stats[k], (int, float)) and math.isfinite(stats[k]) and stats[k] >= 0
                    for k in ['p50', 'p95', 'p99', 'max', 'over50']), key + ': invalid statistics')
        require(stats['p50'] <= stats['p95'] <= stats['p99'] <= stats['max'], key + ': quantile order')
        require(stats['over50'] <= 1, key + ': invalid over50 fraction')
    require(row['frames']['p95'] <= 20 and row['frames']['p99'] <= 33.4 and row['frames']['over50'] <= .005,
            'Original frame budget exceeded')
    require(row['cpu']['p95'] <= 12 and row['materialSubmit']['p95'] <= 3, 'Original CPU/material budget exceeded')
    require(len(row['positions']) == 12, 'Missing held-key interval observations')
    observations = [row['start'], *row['positions'], row['end']]
    elapsed = row['start']['elapsedMs']
    for sample in observations:
        require(math.isfinite(sample['elapsedMs']) and sample['elapsedMs'] >= elapsed, 'Nonmonotonic runtime clock')
        elapsed = sample['elapsedMs']
        require(sample['ended'] is False and sample['hp'] > 0 and sample['pollutionGrade'] == 'severe',
                'Not all observations were alive severe runtime')
    require(row['duration'] == row['end']['elapsedMs'] - row['start']['elapsedMs'] and row['duration'] >= 60000,
            'Actual alive duration is incomplete')
    require(row['fullAliveDuration'] is True and row['budgetPass'] is True, 'Original complete result did not pass')
    require(report['caseProgress'][index]['status'] == 'passed', 'Original progress did not finish passed')
    image = OUT / (row['world'] + '-end.png')
    require(image.is_file(), 'Missing original end image')
    complete.append({
        'index': index, 'world': row['world'], 'grade': row['grade'], 'seed': row['seed'],
        'reportCasePointer': '/cases/' + str(index), 'durationMs': row['duration'],
        'startedAt': report['caseProgress'][index]['startedAt'], 'finishedAt': report['caseProgress'][index]['finishedAt'],
        'actualIntervalObservations': len(row['positions']), 'minimumObservedHp': min(s['hp'] for s in observations),
        'frameP95Ms': row['frames']['p95'], 'frameP99Ms': row['frames']['p99'],
        'frameOver50Fraction': row['frames']['over50'], 'cpuP95Ms': row['cpu']['p95'],
        'materialP95Ms': row['materialSubmit']['p95'], 'originalBudgetPass': row['budgetPass'],
        'validCompletedSample': not issues, 'issues': issues, 'endImage': ref(image),
    })
    if issues:
        problems.append({'type': 'InvalidCompletedSample', 'world': row['world'], 'issues': issues})

unstarted = [{'index': index, 'world': world, 'grade': 'severe', 'seed': 20261004, 'status': 'not-started-user-directed-stop'}
             for index, world in enumerate(report['worlds']) if index >= 75]
assert len(unstarted) == 33
assert ref(report_path) == report_ref and ref(binding_path) == binding_ref
last_sample = read(samples[-1])
last_sample_at = datetime.fromisoformat(last_sample['at'])
ended = datetime.fromisoformat(binding['endedAt'].replace('Z', '+00:00'))
if sleeps:
    problems.append({'type': 'SystemSleepInAuditWindow', 'events': sleeps})
receipt = {
    'status': 'user-directed-sampling-stop', 'createdAt': now().isoformat(),
    'authority': requested['authority'], 'stopRequest': ref(AUDIT / 'user-directed-sampling-stop-request.json'),
    'originalDispatch': ref(AUDIT / 'dispatch.json'),
    'originalStageRootDispatch': ref(BASE / 'remaining-runtime-power-execution/budget-root-dispatch.json'),
    'auditSource': ref(SCRIPT), 'originalReport': report_ref, 'originalSourceBinding': binding_ref,
    'originalRunStatus': report['status'], 'originalSourceBindingStatus': binding['status'],
    'originalHarnessExitCodeFromBinding': binding['exitCode'], 'originalHarnessSignalFromBinding': binding['signal'],
    'originalFailure': report['failure'], 'originalWrapperFailure': binding['failure'],
    'originalFull108PassClaimed': False, 'originalReportOrHarnessRewritten': False, 'automaticRetry': False,
    'lifecycleStarted': False,
    'measuredScope': 'The first 74 worlds from the previously frozen 108-world order, all severe at original seed 20261004. This is an observed prefix, not a random or statistically representative selection.',
    'completedSampleCount': len(complete), 'validCompletedSampleCount': sum(row['validCompletedSample'] for row in complete),
    'completedSamples': complete,
    'interruptedCase': {
        'index': 74, 'world': 'felt-wedges', 'grade': 'severe', 'seed': 20261004,
        'classification': 'unfinished-due-to-user-directed-stop', 'validCompleteSample': False,
        'originalCaseProgress': report['currentCase'], 'originalMetricRowExists': False,
        'stopRequestedAt': requested['requestedAt'],
        'interpretation': 'The original failed/closed-page result is retained. It followed the recorded operator SIGTERM, and is not counted as a measured performance failure or replaced by a new attempt.',
    },
    'unstartedCount': len(unstarted), 'unstartedCases': unstarted,
    'withoutCompleteMeasurementCount': len(unstarted) + 1,
    'statisticsOverCompletedSamples': {
        'minimumActualAliveMs': min(row['durationMs'] for row in complete),
        'maximumActualAliveMs': max(row['durationMs'] for row in complete),
        'totalActualAliveMs': sum(row['durationMs'] for row in complete),
        'maximumFrameP95Ms': max(row['frameP95Ms'] for row in complete),
        'maximumFrameP99Ms': max(row['frameP99Ms'] for row in complete),
        'maximumFrameOver50Fraction': max(row['frameOver50Fraction'] for row in complete),
        'maximumCpuP95Ms': max(row['cpuP95Ms'] for row in complete),
        'maximumMaterialP95Ms': max(row['materialP95Ms'] for row in complete),
    },
    'sourceConsistency': ref(AUDIT / 'source-consistency-after-user-stop.json'),
    'resourceCleanup': ref(AUDIT / 'user-stop-processes-after.json'),
    'ownedProcessesClosed': True, 'ownedIdleSleepAssertionsReleased': True,
    'powerAudit': {
        'executionStartedAt': dispatch['startedAt'], 'wrapperEndedAt': binding['endedAt'],
        'cleanupVerifiedAt': cleanup_at.isoformat(), 'originalPowerSamples': len(samples),
        'firstOriginalSample': ref(samples[0]), 'lastOriginalSample': ref(samples[-1]),
        'lastOriginalSampleAt': last_sample['at'], 'lastOriginalSampleAssertionPids': last_sample['ownedIdleSleepAssertionPids'],
        'secondsFromLastOriginalSampleToWrapperEnd': (ended-last_sample_at).total_seconds(),
        'scopedCaffeinatePids': owners, 'ownedPowerEventsInSystemLog': owned_power_events,
        'systemPowerLogAfter': ref(AUDIT / 'user-stop-power-log-after.txt'),
        'systemPowerLogWindow': ref(AUDIT / 'user-stop-power-log-window.txt'),
        'systemSleepEventsInWindow': sleeps, 'assertionsAfter': ref(AUDIT / 'user-stop-assertions-after.txt'),
        'limitation': 'The outer operator stopped recording samples after the last original sample; unified exec session 2352 was unavailable on resume, operator PID 94733 was absent, and no original execution.json exists. Its exit code and an uninterrupted sequence of sampled assertions after that point are not claimed. The unchanged wrapper completed source checks; fresh process and power logs independently establish the recorded cleanup and system-Sleep audit.',
    },
    'originalOperatorFinalReceiptExists': (AUDIT / 'execution.json').exists(),
    'originalOperatorExitCode': None, 'problems': problems,
    'qualification': 'Completed-sample measurements and their limits are supplied for root/QA review under the new user-authorized sampling scope; no full-108 budget or remaining-world claim.',
}
write(AUDIT / 'user-directed-sampling-stop.json', receipt)
print(json.dumps({'receipt': ref(AUDIT / 'user-directed-sampling-stop.json'),
                  'completed': len(complete), 'valid': receipt['validCompletedSampleCount'],
                  'interrupted': 'felt-wedges', 'unstarted': len(unstarted),
                  'statistics': receipt['statisticsOverCompletedSamples'], 'problems': problems,
                  'ownedProcessesClosed': True, 'ownedAssertionsReleased': True,
                  'sourceFilesExact': 1397, 'servedHashesBeforeAndAfterExact': 1393}, ensure_ascii=False))
