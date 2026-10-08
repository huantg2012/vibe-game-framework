"""Root's independent final-source audit; retains the original bounded visual scope."""
import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BASE = Path('docs/qa/artifacts/r100-i10-i12')
seen = {}

def read_bytes(file):
    file = Path(file)
    target = ROOT / file
    raw = target.read_bytes()
    if target in seen:
        assert raw == seen[target], f'Concurrent mutation: {file}'
    seen[target] = raw
    return raw

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def ref(file):
    return {'path': str(file), 'sha256': digest(read_bytes(file))}

def read(receipt):
    raw = read_bytes(receipt['path'])
    assert digest(raw) == receipt['sha256'], receipt['path']
    return json.loads(raw)

def save(file, value):
    with (ROOT / file).open('x') as output:
        json.dump(value, output, ensure_ascii=False, indent=2)
        output.write('\n')

candidate_ref = ref(BASE / 'final-art-review.bound-candidate.json')
candidate = read(candidate_ref)
inputs = read(candidate['bindingInputs'])
audit_ref = ref(BASE / 'final-art-binding-audit.json')
audit = read(audit_ref)
assert audit['candidate'] == candidate_ref
assert audit['inputs'] == candidate['bindingInputs']
original = read(inputs['candidate'])
plan = read(inputs['observedImmutablePlan'])
historical = read(inputs['historicalBinding'])
inheritance = read(inputs['old52Inheritance'])
frozen = read(inputs['finalSource'])
packages = read(inputs['finalPackageIndex'])
qualification = read(inputs['qualificationPlan'])
baseline = set(qualification['baseline']['worlds'])
assert len(baseline) == 52
assert inheritance['reviewer'] == 'root' and inheritance['status'] == 'bounded-pass'
assert candidate['finalSource'] == plan['finalSource'] == inputs['finalSource']
assert candidate['finalSourceSha256'] == inputs['finalSource']['sha256']
assert candidate['finalPackageIndex'] == plan['packages'] == inputs['finalPackageIndex']
assert len(candidate['worlds']) == len(original['worlds']) == len(packages['worlds']) == 108
assert frozen['verifiedCopyHashes'] and frozen['patches'] == []

edges = {r['path']: (r, read(r)) for r in plan['continuity'] + historical['continuity']}
assert len(edges) == 31
for receipt, edge in edges.values():
    assert edge['status'] == 'pass'
    read(edge['before']); read(edge['after'])
inheritance_path = inputs['old52Inheritance']['path']
assert inheritance_path not in edges
package_by_id = {w['worldId']: w for w in packages['worlds']}
original_by_id = {w['worldId']: w for w in original['worlds']}
assert set(package_by_id) == set(original_by_id) == {w['worldId'] for w in candidate['worlds']}
all_dependencies = {}
bound_count = 0
for world in candidate['worlds']:
    world_id = world['worldId']
    previous = original_by_id[world_id]
    for field in ['scope', 'limitations', 'historicalEvidence', 'authorEvidence', 'rootEvidence']:
        assert world.get(field) == previous.get(field), f'Expanded/replaced original observation: {world_id}/{field}'
    assert world['independentReviewer'] == 'root'
    assert world['scope'] and world['limitations']
    package = package_by_id[world_id]['dependencyManifest']
    manifest = read({'path': package['path'], 'sha256': package['hash']})
    assert manifest['worldId'] == world_id
    assert manifest['algorithm'] == {'id': 'r100-native', 'version': 3, 'revision': 6}
    assert world['dependencyHash'] == package['hash']
    assert package_by_id[world_id]['grades'] == ['low', 'medium', 'severe']
    for dependency in manifest['dependencies']:
        if dependency['path'] in all_dependencies:
            assert all_dependencies[dependency['path']] == dependency['sha256']
        all_dependencies[dependency['path']] = dependency['sha256']
    assert len(world['evidence']) == len(previous['evidence'])
    for index, evidence in enumerate(world['evidence']):
        read(evidence)
        prior_evidence = previous['evidence'][index]
        for field in ['path', 'sha256', 'sourceManifest', 'sourceManifestSha256', 'role']:
            assert evidence.get(field) == prior_evidence.get(field), (world_id, index, field)
        current = {'path': evidence['sourceManifest'], 'sha256': evidence['sourceManifestSha256']}
        read(current)
        binding = evidence['finalBinding']
        assert binding['target'] == inputs['finalSource']
        assert binding['inputs'] == candidate['bindingInputs']
        for route_ref in binding['continuity']:
            if route_ref['path'] == inheritance_path:
                assert route_ref == inputs['old52Inheritance'] and world_id in baseline
                edge = inheritance
            else:
                assert route_ref['path'] in edges, 'Unapproved art edge, including play-only edge'
                approved_ref, edge = edges[route_ref['path']]
                assert route_ref == approved_ref
                assert world_id in {row['worldId'] for row in edge['worlds']}
            assert current == edge['before'], f'Disconnected route: {world_id}'
            current = edge['after']
        assert current == inputs['finalSource'], f'Route fails to reach actual final source: {world_id}'
        bound_count += 1
assert bound_count == 260
assert len(all_dependencies) == 307
manifest_only = []
for file, expected in all_dependencies.items():
    assert digest(read_bytes(file)) == expected, f'Changed package dependency: {file}'
    if file in frozen['sources']:
        assert frozen['sources'][file] == expected
        assert digest(read_bytes(Path(frozen['temporaryRoot']) / file)) == expected
    else:
        manifest_only.append(file)
assert manifest_only == ['package-lock.json']
assert all_dependencies['package-lock.json'] == '97189266199c56f2f04f5054f01620aa6b866f2e676450abbca415ed2f7cfe88'
assert len(inputs['historicalOnlySupersededEvidence']) == 2
assert all(row['worldId'] == 'cleft-tableland' for row in inputs['historicalOnlySupersededEvidence'])
for reference in inputs['supplementaryIndependentProcessReviews']:
    read(reference)
for file, raw in seen.items():
    assert file.read_bytes() == raw, f'Concurrent mutation: {file}'

now = datetime.now(timezone.utc).isoformat()
review_path = BASE / 'final-art-root-review.json'
review = {
    'status': 'bounded-internal-pass', 'reviewer': 'root', 'at': now,
    'candidate': candidate_ref, 'bindingInputs': candidate['bindingInputs'], 'bindingAudit': audit_ref,
    'finalSource': inputs['finalSource'], 'packages': inputs['finalPackageIndex'],
    'scope': 'Independent source/package disposition of the existing bounded author and root normal-view reviews. All original per-world scope and limitations are retained verbatim; no fresh visual observation is claimed by this metadata audit.',
    'method': ['Read the final candidate, the original candidate and binding audit.',
               'Independently traversed every receipt route by exact source SHA, per-world coverage and edge adjacency; allowed only standard continuity and the explicitly reviewed baseline52 inheritance.',
               'Checked every package manifest, exact final dependencies, unchanged observation scope/history and final evidence identities.',
               'Re-read all consumed files before signing; no status from a pending candidate is treated as a prior pass.'],
    'results': {'worlds': 108, 'activeArtBindings': bound_count, 'standardEdges': 31,
                'explicitHistoricalInheritanceEdges': 1, 'playOnlyEdgesUsed': 0,
                'packageDependencies': 307, 'frozenPackageDependencies': 306,
                'manifestOnlyDependencies': manifest_only, 'originalScopesUnchanged': True,
                'supersededCleftReceiptsHistoricalOnly': 2, 'freshPngViews': 0,
                'uniqueConsumedFiles': len(seen)},
    'limitations': candidate['bindingLimits'],
    'humanApproval': 'pending; no original human approval is extended to the complete revision6 candidate',
    'audioListening': 'not-reviewed; R100-R10 remains an I14 release blocker',
}
save(review_path, review)
final = copy.deepcopy(candidate)
final['status'] = 'bounded-internal-pass'
final['reviewer'] = final['bindingReviewedBy'] = 'root'
final['reviewedAt'] = now
final['rootBindingReview'] = ref(review_path)
final['finalBindingStatus'] = 'bounded-internal-source-and-package-pass'
final['scope'] = review['scope']
final['summary']['rootDispositionPendingWorlds'] = 0
final['summary']['boundedInternalPassWorlds'] = 108
final['outstanding'] = ['Production, runtime, performance, complete gameplay and final ledger qualification remain separate evidence.', 'Human aesthetic approval and actual audio listening remain pending I14 release review.']
for world in final['worlds']:
    world['status'] = 'bounded-internal-pass'
    world['pending'] = []
    world['finalBinding']['status'] = 'bounded-internal-pass'
    world['finalBinding']['reviewer'] = 'root'
    world['finalBinding']['rootReview'] = final['rootBindingReview']
    for evidence in world['evidence']:
        evidence['applicability'] = 'source-continuity-verified-bounded-internal-pass'
        evidence['finalBinding']['status'] = 'source-continuity-verified-bounded-internal-pass'
save(BASE / 'final-art-review.json', final)
print(json.dumps({'review': ref(review_path), 'finalArt': ref(BASE / 'final-art-review.json'), 'worlds': 108, 'bindings': bound_count}))
