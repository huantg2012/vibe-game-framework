"""Compact completed recovery evidence. Read-only with respect to game/source/raws."""
import argparse
import collections
import hashlib
import json
import pathlib
import shutil

parser = argparse.ArgumentParser()
parser.add_argument("--raw-root", type=pathlib.Path, default=pathlib.Path("/private/tmp/coh-i22-base-loop/docs/qa/artifacts/iteration-22"))
parser.add_argument("--output-root", type=pathlib.Path, default=pathlib.Path("docs/qa/artifacts/iteration-22"))
args = parser.parse_args()
A = args.raw_root / "recovery-2026-09-12T17-16-25-560Z"
B = args.raw_root / "recovery-2026-09-12T17-32-19-112Z"
roots = {"A": A, "B": B}
manifest = {}


def digest(raw):
    return hashlib.sha256(raw.encode() if isinstance(raw, str) else raw).hexdigest()


def canonical(value):
    return digest(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def ref(group, name):
    key = group + "/" + name
    if key not in manifest:
        raw = (roots[group] / name).read_bytes()
        manifest[key] = {"bytes": len(raw), "sha256": digest(raw)}
    return key


def read(group, name):
    ref(group, name)
    return json.loads((roots[group] / name).read_text())


def check(name, condition, observed=None):
    assert condition, name
    result = {"assertion": name, "result": "pass"}
    if observed is not None:
        result["observed"] = observed
    return result


def item_values(inventory):
    result = []
    for item in inventory["items"]:
        value = item.get("weapon", item.get("contaminant"))
        result.append({"id": item["id"], "location": item["location"], "stage": value["stage"],
                       "uses": value["usesRemaining"], "charges": value["impactCharges"]})
    return sorted(result, key=lambda item: item["id"])


def saved_projection(save):
    checkpoint = save["riftCheckpoint"]
    state = checkpoint["state"]
    health = {enemy["id"]: enemy["health"] for enemy in state["combat"]["enemies"] if enemy["alive"]}
    return {"runId": checkpoint["runId"], "elapsedMs": checkpoint["elapsedMs"],
            "position": state["player"]["position"], "hp": state["combat"]["health"],
            "chaos": state["chaos"]["value"], "kindling": state["search"]["carried"],
            "remainingPiles": sum(not node["collected"] for node in state["search"]["nodes"]),
            "inventorySha256Canonical": canonical(save["inventory"]), "items": item_values(save["inventory"]),
            "aliveEnemies": sorted([{"id": enemy["id"], "position": enemy["entity"]["position"],
                                      "hp": health[enemy["id"]]} for enemy in state["ai"]["enemies"]], key=lambda item: item["id"])}


def ready_projection(ready):
    rift, session = ready["rift"], ready["session"]
    return {"runId": session["runId"], "elapsedMs": rift["elapsedMs"], "position": rift["player"],
            "hp": rift["hp"], "chaos": rift["chaos"], "kindling": rift["kindling"],
            "remainingPiles": rift["search"]["remaining"],
            "inventorySha256Canonical": canonical(session["inventory"]), "items": item_values(session["inventory"]),
            "aliveEnemies": sorted([{"id": enemy["id"], "position": enemy["position"], "hp": enemy["hp"]}
                                    for enemy in rift["enemies"]], key=lambda item: item["id"])}


def reload_case(group, label, interpretation):
    name = label + "-after-transport.json"
    transport = read(group, name)
    saved, ready = json.loads(transport["start"]), transport["firstReady"]
    left, right = saved_projection(saved), ready_projection(ready)
    assertions = [check("firstReady matches saved " + field, left[field] == right[field]) for field in left]
    assertions.append(check("entire inventory equality, including quality/source/equipment/lifecycle", saved["inventory"] == ready["session"]["inventory"]))
    assert ready["activeScene"] == "RiftScene"
    lures = saved["riftCheckpoint"]["state"]["tools"]["lures"]
    presented_count = ready["space"]["presentation"]["effects"]["soundLures"]
    assertions.append(check("active lure count is presented on firstReady", len(lures) == presented_count, presented_count))
    return {"case": group + "/" + label, "status": "pass", "interpretation": interpretation,
            "basis": [ref(group, name)], "loadedRawSha256": digest(transport["start"]),
            "savedEqualsFirstReady": left, "savedActiveLures": lures, "assertions": assertions}


def base_projection(snapshot):
    session = snapshot["session"]
    return {key: session[key] for key in ["game", "tide", "inventory", "growth", "stability", "forecast"]}


def base_brief(snapshot):
    session = snapshot["session"]
    return {"phase": session["phase"], "runId": session["runId"], "cycle": session["game"]["cycle"],
            "modules": {item["id"]: item["hp"] for item in session["game"]["modules"]},
            "reserve": session["game"]["kindlingReserve"], "tide": session["tide"],
            "inventorySha256Canonical": canonical(session["inventory"]), "equipment": session["inventory"]["equipment"],
            "baseSettled": session["inventory"]["run"].get("baseSettled", False)}


def source_and_errors(group):
    evidence = read(group, "evidence.json")
    source = read(group, "source-start.json")
    final = evidence.get("sourceAfter")
    if final is not None:
        assert source == evidence["sourceBefore"]
        assert source["files"] == final["files"]
        assert evidence["sourceChanged"] == []
    return {"basis": [ref(group, "evidence.json"), ref(group, "source-start.json")],
            "startHead": source["head"], "hashedFiles": len(source["files"]),
            "fullManifestUnchanged": True if final else None,
            "integrityLimit": None if final else "A aborted before finish; no final source snapshot. Do not infer full-run source immutability.",
            "saveSentinelUnchanged": evidence.get("saveSentinelUnchanged"),
            "recordedPageErrors": evidence["errors"], "recordedResponseFailures": evidence["resourceFailures"],
            "consoleErrors": [{"message": key, "count": count} for key, count in collections.Counter(evidence.get("consoleErrors", [])).items()],
            "consoleLimit": "Console 404 entries lack a URL in the recording. Response failure list is empty; do not label the console entirely clean or infer which asset failed.",
            "retainedDriverFailures": evidence["failures"], "earnedSetup": evidence["earnedSetup"]}


def trace_coverage(group):
    # Files from one document are cumulative snapshots. Select the longest trace per
    # loaded-start SHA to avoid presenting repeated prefixes as extra coverage.
    groups = {}
    for file in sorted(roots[group].glob("*-trace.json")):
        transport_name = file.name.replace("-trace.json", "-transport.json")
        if not (roots[group] / transport_name).exists():
            continue
        transport, trace = read(group, transport_name), read(group, file.name)
        epoch = digest(transport["start"] or "")
        if epoch not in groups or len(trace["samples"]) > len(groups[epoch][1]["samples"]):
            groups[epoch] = (file.name, trace)
    rows = []
    for epoch, (name, trace) in sorted(groups.items()):
        illegal = sum(not all(sample["physical"]) for sample in trace["samples"])
        assert illegal == 0 and not trace["sampleErrors"]
        rows.append({"loadedStartSha256": epoch, "basis": ref(group, name), "samples": len(trace["samples"]),
                     "illegalBodySamples": illegal, "sampleErrors": trace["sampleErrors"]})
    return {"method": "Longest cumulative trace per loaded-start raw SHA. Four corner checks on actual 20x20 body, sampled at 100ms; not every rendered/physics frame.",
            "samples": sum(row["samples"] for row in rows), "epochs": rows, "illegalBodySamples": 0,
            "limit": "The final trace alone covers only the document after the last reload; earlier documents are checked from their separate raw trace files."}


ae, be = read("A", "evidence.json"), read("B", "evidence.json")
postmortem = read("A", "postmortem.json")
cases_a = [reload_case("A", label, meaning) for label, meaning in [
    ("02-pure-fuel", "Pure fuel was already gathered; no re-award or position/time reset."),
    ("04-active-lure", "One active earned shell lure and its consumed use survive reload; not proof of tactical lure advantage."),
    ("05-loot-and-combat", "Loot/source IDs and actual environmental injury survive reload. This label does not prove combat; both enemies remain alive."),
    ("06-real-combat", "Real combat, HP61, crowbar69 durability, and exactly one surviving enemy are preserved; killed watcher is not respawned."),
]]

afail = read("A", "11-retry-candidate-transport.json")
anoretry = read("A", "12-retry-succeeded-transport.json")
acandidate = next(write["bytes"] for write in reversed(afail["writes"]) if write["failed"])
asuccess_count = sum(not write["failed"] and write["bytes"] == acandidate for write in anoretry["writes"])
assert asuccess_count == 0

frozen1, frozen2 = read("B", "02-failed-frame.json"), read("B", "03-still-frozen.json")
failed = read("B", "04-retry-success-failed-transport.json")
retried = read("B", "04-retry-success-retried-transport.json")
candidate = next(write["bytes"] for write in reversed(failed["writes"]) if write["failed"])
new_writes = retried["writes"][len(failed["writes"]):]
assert retried["writes"][:len(failed["writes"])] == failed["writes"]
candidate_save = json.loads(candidate)
cs = candidate_save["riftCheckpoint"]["state"]
shell_id = "CTM_95887fae-6cf6-474c-a589-04ba7e137d6a"
uses = lambda inventory: next(item["contaminant"]["usesRemaining"] for item in inventory["items"] if item["id"] == shell_id)
before_inventory = json.loads(failed["current"])["inventory"]
after_inventory = json.loads(retried["current"])["inventory"]
retry_case = {"case": "B/04-retry-same-candidate", "status": "pass",
              "basis": [ref("B", name) for name in ["02-failed-frame.json", "03-still-frozen.json", "04-retry-success-failed-transport.json", "04-retry-success-retried-transport.json"]],
              "candidateSha256": digest(candidate), "candidateBytes": len(candidate.encode()),
              "candidateElapsedMs": candidate_save["riftCheckpoint"]["elapsedMs"],
              "newWrites": [{"at": write["at"], "failed": write["failed"], "sha256": digest(write["bytes"])} for write in new_writes],
              "assertions": [check("failed frame is entirely unchanged during wait", frozen1["session"] == frozen2["session"] and frozen1["frame"] == frozen2["frame"] and frozen1["space"] == frozen2["space"]),
                             check("first retry commits the exact frozen candidate bytes", not new_writes[0]["failed"] and new_writes[0]["bytes"] == candidate),
                             check("same candidate has exactly one successful write", sum(not write["failed"] and write["bytes"] == candidate for write in retried["writes"]) == 1),
                             check("no second skill use during retry", [uses(before_inventory), uses(candidate_save["inventory"]), uses(after_inventory)] == [4, 3, 3], [4, 3, 3]),
                             check("pending effect is one actual 6000ms lure", len(cs["tools"]["lures"]) == 1 and cs["tools"]["lures"][0]["remainingMs"] == 6000)]}

effect_reload = reload_case("B", "05-reloaded-after-retry", "Retried charge3, crowbar69, actual loot IDs, surviving enemy and remaining lure life restore without another use or a fresh 6000ms lifetime.")
transport5 = read("B", "05-reloaded-after-retry-after-transport.json")
start5 = json.loads(transport5["start"])["riftCheckpoint"]
live5 = transport5["liveCheckpoint"]
lure_start, lure_live = start5["state"]["tools"]["lures"][0], live5["state"]["tools"]["lures"][0]
effect_reload["assertions"].extend([
    check("lure presentation ID/source position preserved after first live frames", lure_start["presentationId"] == lure_live["presentationId"] and lure_start["position"] == lure_live["position"]),
    check("lure remaining time decreases by actual elapsed delta", abs((lure_start["remainingMs"] - lure_live["remainingMs"]) - (live5["elapsedMs"] - start5["elapsedMs"])) < 0.001,
          {"remainingBeforeMs": lure_start["remainingMs"], "remainingAfterMs": lure_live["remainingMs"], "elapsedDeltaMs": live5["elapsedMs"] - start5["elapsedMs"]}),
])

end7, end8 = read("B", "07-abandoned.json"), read("B", "08-terminal-still.json")
terminal_case = {"case": "B/07-08-terminal-freeze", "status": "pass", "basis": [ref("B", "07-abandoned.json"), ref("B", "08-terminal-still.json")],
                 "elapsedMs": end7["rift"]["elapsedMs"], "assertions": [check("explicit abandon settled with zero reward", end7["session"]["inventory"]["run"]["outcome"] == "abandon" and end7["session"]["inventory"]["run"]["kindlingGained"] == 0),
                 check("run, actor positions, HP, chaos and inventory stay fixed", end7["rift"] == end8["rift"] and end7["session"] == end8["session"]),
                 check("live enemies and active tool snapshots stay fixed", end7["frame"]["enemies"] == end8["frame"]["enemies"] and end7["frame"]["tools"] == end8["frame"]["tools"]),
                 check("water and shell stop with the terminal run", end7["space"]["water"] == end8["space"]["water"] and end7["space"]["shell"] == end8["space"]["shell"])],
                 "limit": "Presentation sequence/render counters may change; equality refers to actual gameplay state, positions and effect clocks."}

base10, base11 = read("B", "10-returned-base.json"), read("B", "11-base-reload.json")
base_case = {"case": "B/10-11-return-and-reload", "status": "pass", "basis": [ref("B", "10-returned-base.json"), ref("B", "11-base-reload.json"), ref("B", "11-base-reload-after-transport.json")],
             "state": base_brief(base11), "assertions": [check("R reaches real base without A's destroyed-world exception", base10["activeScene"] == "PurificationScene" and base10["session"]["phase"] == "base"),
             check("reload preserves every persistent base field", base_projection(base10) == base_projection(base11)),
             check("base settlement marked once, no extra cycle", base11["session"]["game"]["cycle"] == 6 and base11["session"]["inventory"]["run"]["baseSettled"])],
             "transientDifferences": [key for key in base10["session"] if base10["session"][key] != base11["session"][key]]}

entry15, entry16 = read("B", "15-entry-paused.json"), read("B", "16-entry-abandoned-frozen.json")
entry = entry15["space"]["entry"]
entry_case = {"case": "B/15-16-actual-entry-abandon", "status": "pass", "basis": [ref("B", "15-entry-paused.json"), ref("B", "16-entry-abandoned-frozen.json"), ref("B", "evidence.json")],
              "entryElapsedMs": entry["elapsedMs"], "assertions": [check("actual Rift entry paused before handoff", entry15["activeScene"] == "RiftScene" and entry15["paused"] and entry["active"] and 466 < entry["elapsedMs"] < 467),
              check("explicit confirmation ends run without advancing entry clock", entry16["session"]["inventory"]["run"]["outcome"] == "abandon" and entry16["space"]["entry"]["elapsedMs"] == entry["elapsedMs"] and not entry16["space"]["entry"]["active"]),
              check("no movement or gameplay time in abandoned entry", entry16["rift"]["elapsedMs"] == 0 and entry16["rift"]["player"] == entry15["rift"]["player"] and entry16["rift"]["enemies"] == entry15["rift"]["enemies"])]}

base17, base18 = read("B", "17-terminal-reload-base.json"), read("B", "18-base-reload-once.json")
tr17, tr18 = read("B", "17-terminal-reload-base-after-transport.json"), read("B", "18-base-reload-once-after-transport.json")
receipt = json.loads(tr17["start"])
replacement = base17["session"]["inventory"]["equipment"]["weaponId"]
replacement_case = {"case": "B/17-18-terminal-receipt-and-once-only-replacement", "status": "pass",
                    "basis": [ref("B", name) for name in ["17-terminal-reload-base.json", "18-base-reload-once.json", "17-terminal-reload-base-after-transport.json", "18-base-reload-once-after-transport.json"]],
                    "state": base_brief(base17), "replacementId": replacement,
                    "assertions": [check("reload starts with a real unsettled-base terminal receipt", receipt["riftCheckpoint"]["state"]["phase"] == "settled" and not receipt["inventory"]["run"].get("baseSettled", False)),
                    check("first reload performs base settlement and clears terminal receipt", base17["session"]["phase"] == "base" and base17["session"]["inventory"]["run"]["baseSettled"] and json.loads(tr17["current"]).get("riftCheckpoint") is None),
                    check("next reload does not reroll impact or reward", base_projection(base17) == base_projection(base18)),
                    check("same run-derived replacement ID exists exactly once", replacement == "WPN_replacement:" + base17["session"]["runId"] and sum(item["id"] == replacement for item in base18["session"]["inventory"]["items"]) == 1),
                    check("next firstReady preserves entire saved inventory", json.loads(tr18["start"])["inventory"] == tr18["firstReady"]["session"]["inventory"])]}

next19 = read("B", "19-next-run-moves.json")
next_case = {"case": "B/19-new-run-receives-input", "status": "pass", "basis": [ref("B", "19-next-run-moves.json"), ref("B", "evidence.json")],
             "runId": next19["session"]["runId"], "position": next19["rift"]["player"], "elapsedMs": next19["rift"]["elapsedMs"],
             "assertions": [check("new run, cycle8 and carried replacement", next19["session"]["runId"] != base18["session"]["runId"] and next19["session"]["game"]["cycle"] == 8 and next19["session"]["inventory"]["equipment"]["weaponId"] == replacement),
             check("actual W input moves north from spawn after entry", not next19["space"]["entry"]["active"] and next19["rift"]["player"]["y"] < 944 and next19["rift"]["elapsedMs"] > 0)]}

assert len(be["failures"]) == 2
mislabels_b = {}
for label in ["12-next-entry-paused", "13-entry-abandon", "14-actual-entry-pause"]:
    snapshot = read("B", label + ".json")
    assert snapshot["activeScene"] == "PurificationScene" and snapshot["session"]["phase"] == "departing"
    mislabels_b[label] = {"basis": ref("B", label + ".json"), "actualScene": "PurificationScene", "actualPhase": "departing", "status": "not-an-entry-pass"}

source_a, source_b = source_and_errors("A"), source_and_errors("B")
coverage_a, coverage_b = trace_coverage("A"), trace_coverage("B")
idx_a = {entry["file"]: entry["sha256"] for entry in ae["sourceBefore"]["files"]}
idx_b = {entry["file"]: entry["sha256"] for entry in be["sourceBefore"]["files"]}
changed = sorted(key for key in idx_a.keys() | idx_b.keys() if idx_a.get(key) != idx_b.get(key))
assert digest(pathlib.Path(ae["earnedSetup"]["path"]).read_bytes()) == ae["earnedSetup"]["sha256"]
assert digest(pathlib.Path(be["earnedSetup"]["path"]).read_bytes()) == be["earnedSetup"]["sha256"]

base_original = args.output_root / "base-journey-2026-09-12T16-32-31-769Z" / "base-journey-summary.json"
base_copy = args.output_root / "base-journey-summary.json"
args.output_root.mkdir(parents=True, exist_ok=True)
if base_copy.exists():
    assert base_copy.read_bytes() == base_original.read_bytes(), "Refuse to overwrite differing existing base summary"
else:
    shutil.copyfile(base_original, base_copy)

summary = {"schemaVersion": 1, "status": "final-core-browser-cases-pass-with-retained-initial-defects-and-driver-mistakes",
           "method": "Read-only summary of ROOT's already finished real keyboard/mouse/reload tests. No browser or gameplay changes by this summarizer. Each assertion references SHA-tracked raw evidence.",
           "rawRoots": {group: str(root) for group, root in roots.items()},
           "A": {"status": "partial-pass-with-defects", "sourceAndErrors": source_a, "reloadCases": cases_a,
                 "postmortem": {"basis": ref("A", "postmortem.json"), **postmortem},
                 "retryFailure": {"status": "failed-in-A-fixed-in-B", "candidateSha256": digest(acandidate), "successfulCandidateCommits": asuccess_count,
                                  "basis": [ref("A", "11-retry-candidate-transport.json"), ref("A", "12-retry-succeeded-transport.json"), ref("A", "evidence.json")],
                                  "interpretation": "First QA selector was incorrect; actual retry button then proved unreachable because canvas intercepted pointer events. Label 12 is not a successful retry."},
                 "returnFailure": {"status": "failed-in-A-fixed-in-B", "basis": ref("A", "postmortem.json"), "interpretation": "R shutdown dereferenced a destroyed Arcade world and aborted the driver. Evidence pageerror array was saved before this fault; empty array does not negate postmortem."},
                 "bodySampling": coverage_a},
           "B": {"status": "final-core-pass", "sourceAndErrors": source_b,
                 "cases": [retry_case, effect_reload, terminal_case, base_case, entry_case, replacement_case, next_case],
                 "misleadingLabels": mislabels_b,
                 "testInstructionErrors": {"count": 2, "basis": ref("B", "evidence.json"), "interpretation": "Two abandon UI commands were issued while still paused in the PurificationScene departure transition; no such menu exists there. Commands timed out. Real entry case is 15/16, not 12/13. No game bug inferred from these two locator failures."},
                 "bodySampling": coverage_b, "finalTraceOnly": be["trace"],
                 "finalEvidence": [ref("B", name) for name in ["final-save.json", "final-transport.json", "final-trace.json", "trace.json", "journey-record.json"]]},
           "versions": {"AtoBChangedFiles": changed, "originalMatrixAndMemoryJourney": "Earlier 16/16 matrix and five-trip memory journey ran on separate frozen source versions. They were not all replayed on final recovery source. B verifies targeted recovery fixes only.",
                        "sourceIntegrityClaim": "B's full 438-file start/end manifests are identical. A has no end manifest after abort. Do not transfer B's unchanged-source claim to A or older matrix runs.",
                        "postRuntimeIntegration": "ROOT reports aggregate 10-group checks and build passed on main after integration. This summary task does not rerun them; check ROOT's main QA report. The documented post-runtime notice overflow style adjustment is not a fresh browser pass."},
           "baseJourneySummaryCopy": {"file": "base-journey-summary.json", "sha256": digest(base_copy.read_bytes()), "identicalTo": str(base_original), "originalUnmodified": True},
           "notBrowserValidatedHere": ["Precise shell diversion deadlines and all water boundary milliseconds", "Full-bag plus last-use/last-durability combined cases", "Every five-family effect final tick and concurrent multi-target budget", "Long-term four-A supply, balance or second-world production", "Firefox/Safari compatibility or release performance", "Sound listening or aesthetic/player-fun approval"],
           "coverageBoundary": "Shell deadlines, all final-use variants and admission/persistence invariants belong to the separately run programmatic groups. Earlier real water/death, routes and base journey remain separately versioned evidence; they are not new recovery-browser cases.",
           "audio": "Not recorded or listened during these two reload runs.", "rawManifest": manifest}
encoded = (json.dumps(summary, ensure_ascii=False, indent=2) + "\n").encode()
assert len(encoded) < 150_000, len(encoded)
destination = args.output_root / "recovery-summary.json"
destination.write_bytes(encoded)
print(json.dumps({"summary": str(destination), "bytes": len(encoded), "sha256": digest(encoded), "A_reloadCases": len(cases_a), "B_cases": len(summary["B"]["cases"]),
                  "bodySamplesA": coverage_a["samples"], "bodySamplesB": coverage_b["samples"], "baseCopySha256": digest(base_copy.read_bytes())}, ensure_ascii=False))
