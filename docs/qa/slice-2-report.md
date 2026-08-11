---
slice: 2
date: 2026-08-07
status: CONDITIONAL PASS
blocking-issues: 1
deviations: 2
---

# Slice 2 QA Report: Purification Loop

## Verdict: CONDITIONAL PASS

One blocking issue in MainMenuScene (spec rule 30/31 violation). Two moderate deviations in impact presentation. All core logic (GameState, allocation, impact calculation, module effects, scene transitions, event flow) is correctly implemented.

---

## Blocking Issues

### B1: MainMenuScene does not route to PurificationScene for new game

**Spec reference**: Rule 31 (flow: Menu -> PurificationScene -> Rift); Task T3 Brief ("New Expedition from RiftScene changed to PurificationScene" + "GameState.reset() on new game")

**Actual**: `main-menu-scene.ts` line 33-34 and line 46 still call `this.scene.start('RiftScene')`. No `gameState.reset()` call anywhere in the scene.

**Impact**: New game bypasses the purification scene entirely, skipping the intended loop entry point. GameState from a previous session (if page was not refreshed) persists into the new game.

**Fix**: Change all new-game start calls from `'RiftScene'` to `'PurificationScene'`, and add `gameState.reset()` before the transition. Import `gameState` from `@/managers/game-state`.

---

## Moderate Deviations

### D1: No particle surge during impact (spec rule 23)

**Spec says**: "边界粒子向内涌入 (0.5s)" as part of the impact presentation sequence.

**Actual**: `BoundaryAtmosphere` has no surge/boost method. The impact sequence is: run calculation synchronously -> camera shake -> show result panel.

**Impact**: Reduced dramatic buildup before damage reveal. Purely visual; no logic impact.

**Recommendation**: Add a `surge()` method to BoundaryAtmosphere that temporarily increases particle speed/count for 500ms. Wire it in `enterRift()` before showing the result panel. Low priority - can be deferred to a polish Slice.

### D2: Impact event ordering differs from spec sequence

**Spec says**: IMPACT_STARTED -> visual delay (shake + particles) -> calculate damage -> MODULE_DAMAGED -> IMPACT_RESOLVED -> result panel.

**Actual**: `impactSystem.run()` emits IMPACT_STARTED, calculates, emits MODULE_DAMAGED x2, emits IMPACT_RESOLVED, all synchronously. THEN the scene does shake + panel.

**Impact**: Any future system listening to IMPACT_STARTED for "pre-calculation" effects would fire at the wrong time. Currently no listeners exist, so no functional bug. The player sees shake + panel simultaneously rather than a buildup-then-reveal.

**Recommendation**: Acceptable for Slice 2 validation. If演出 timing matters for feel, refactor in a polish pass: split run() into `prepare()` (emit IMPACT_STARTED, return threat data) and `resolve()` (apply damage, emit results).

---

## Spec Rule Verification (All Pass)

### P - Purification Scene

| Rule | Description | Status | Notes |
| ---- | ----------- | ------ | ----- |
| P1 | Elliptical safe area ~12x10 tiles, player walks | PASS | 14x12 grid, ellipse 5.5x4.5 tiles radius |
| P2 | 2 modules (CORE center, STORAGE right), 32px interact | PASS | INTERACTION_RADIUS=32 |
| P3 | Rift entrance center-top, pulsing teal, E to enter | PASS | Pulsing circle with sin alpha |
| P4 | Boundary particles 20-30, drifting inward | PASS | PARTICLE_COUNT=25 |
| P5 | Apparition every 8-15s, alpha 0->0.3, fade in/hold/out | PASS | 500ms/2000ms/500ms timing correct |
| P6 | Warm grey/beige floor, brighter than rift | PASS | 0x2e2a25 floor, omni vision |
| P7 | Particle density boost toward forecast target, 80% accuracy | PASS | See impact system analysis |

### G - GameState

| Rule | Description | Status | Notes |
| ---- | ----------- | ------ | ----- |
| G8 | Initial: reserve=0, cycle=0, intensity=1.0, hp=80, maxHp=100 | PASS | All match constants |
| G9 | Session-only, no localStorage | PASS | No persistence code |
| G10 | Survived: reserve += kindlingGained; died: 0 | PASS | Conditional in create() |
| G11 | cycle++ on entering rift | PASS | incrementCycle() in transitionToRift() |
| G12 | intensity += 0.15 per impact, cap 2.5 | PASS | incrementIntensity() at end of run() |

### A - Allocation

| Rule | Description | Status | Notes |
| ---- | ----------- | ------ | ----- |
| A13 | E at module -> DOM panel | PASS | openAllocationPanel() |
| A14 | Shows reserve, hp/maxHp, +/- buttons | PASS | Full DOM layout |
| A15 | 1 kindling = 10 hp, clamp to maxHp | PASS | REPAIR_PER_KINDLING=10, Math.min |
| A16 | Confirm: deduct + heal + emit ALLOCATION_CONFIRMED + close | PASS | Correct sequence |
| A17 | Cancel/ESC: close, no deduction | PASS | allocationPanel.close() only |
| A18 | Non-mandatory: can skip straight to rift | PASS | No forced allocation gate |

### I - Impact

| Rule | Description | Status | Notes |
| ---- | ----------- | ------ | ----- |
| I19 | Trigger at rift entrance E press, before scene switch | PASS | enterRift() flow |
| I20 | cycle===0 skips impact | PASS | Returns { skipped: true } |
| I21 | totalDamage = BASE_IMPACT_DAMAGE(25) x intensity | PASS | Correct formula |
| I22 | 65%/35% split between primary/secondary target | PASS | THREAT_FOCUS_RATIO=0.65 |
| I23 | Events: IMPACT_STARTED + MODULE_DAMAGED x2 + IMPACT_RESOLVED | PASS | All emitted (ordering deviation noted above) |
| I24 | hp floor = 0 | PASS | Math.min(damage, mod.hp) |
| I25 | Forecast 80% accurate | PASS | FORECAST_ACCURACY logic verified |

### M - Module Effects

| Rule | Description | Status | Notes |
| ---- | ----------- | ------ | ----- |
| M26 | CORE: 1.0 - (hp/100)*0.30. hp=100->0.70, hp=0->1.0 | PASS | Formula exact match |
| M27 | STORAGE: 1.0 + (hp/100)*0.50. hp=100->1.50, hp=0->1.0 | PASS | Formula exact match |
| M28 | Calculated once before rift transition, as SortieModifiers | PASS | getSortieModifiers() in transitionToRift() |
| M29 | ChaosSystem: BASE_RATE * modifier. LootSystem: value * modifier (floor 1) | PASS | Both correctly applied |

### F - Scene Transitions

| Rule | Description | Status | Notes |
| ---- | ----------- | ------ | ----- |
| F30 | Rift->Purification: RIFT_EXITED -> 600ms -> scene start | PASS | SCENE_TRANSITION_DELAY_MS=600 after emit |
| F31 | Purification->Rift: impact -> result panel -> transition | PASS | enterRift() flow correct |
| F32 | RiftScene receives + applies modifiers | PASS | data.modifiers injected to ChaosSystem/LootSystem |
| F33 | Death: kindlingGained=0, still transitions | PASS | RunController logic correct |

### Boundary Cases

| Case | Status | Notes |
| ---- | ------ | ----- |
| Death return (kindling=0) | PASS | Conditional in create() |
| reserve=0 + both hp=0 | PASS | No game-over; continues with no bonuses |
| Panel open blocks rift entry | PASS | allocationPanel.isOpen() guard |
| Allocation > reserve impossible | PASS | maxAllocatable = Math.min(reserve, maxUseful) |
| Repair > maxHp clamped | PASS | Math.min to maxHp |
| First sortie no impact | PASS | cycle===0 check |
| Both modules at 0 | PASS | Game continues normally |

### Event Flow Completeness

| Event | Producer | Consumer | Verified |
| ----- | -------- | -------- | -------- |
| RIFT_EXITED | RunController | PurificationScene (create data) | PASS |
| ALLOCATION_CONFIRMED | AllocationPanel | (no active consumer yet) | PASS - emitted correctly |
| IMPACT_STARTED | ImpactSystem | PurificationScene (shake) | PASS (timing deviation noted) |
| MODULE_DAMAGED | ImpactSystem | (no active consumer yet) | PASS - emitted correctly |
| IMPACT_RESOLVED | ImpactSystem | (no active consumer yet) | PASS - emitted correctly |
| RIFT_ENTERED | PurificationScene | (no active consumer yet) | PASS - emitted correctly |

---

## Design Observations (for playtest focus)

1. **Quick-retry (R key) on death bypasses purification loop.** RunController.restart() re-starts in the rift without visiting purification. This means a player who always quick-retries after death never experiences the allocation/impact pressure. Consider whether this undermines the "pressure chain" validation goal.

2. **First sortie has NO bonuses at initial hp=80.** chaosRateModifier = 0.76 (not 0.70), kindlingValueModifier = 1.40 (not 1.50). Feels like a slightly degraded start. Intentional per spec (initial hp < max) but verify during playtest that the player notices the difference when modules are repaired to 100.

3. **Rounding in damage split.** At intensity=1.0: total=25, primary=Math.round(25*0.65)=16, secondary=Math.round(25*0.35)=9. Total applied=25. At higher intensities, rounding could cause total applied to be +/-1 from theoretical total. Negligible.

---

## Verification Question Assessment

> "Is the pressure chain (sortie performance -> impact consequence -> sortie condition change) mechanically complete?"

**YES.** The causal chain is fully connected:
- Sortie performance -> kindling collected (LootSystem) -> credited to reserve on return (GameState.addKindling)
- Resource decision -> allocate kindling to modules (AllocationPanel -> GameState)
- Impact consequence -> modules take damage (ImpactSystem -> GameState.applyDamage)
- Condition change -> module hp determines modifiers (getSortieModifiers) -> applied to next rift run (ChaosSystem rate + LootSystem multiplier)

The chain closes: worse module health -> harder rift (faster chaos, less kindling per node) -> less kindling to repair -> harder to maintain modules -> even worse next cycle.

**Structural concerns for playtest**: The "纠结感" (agonizing choice) depends on the economy being tight enough that you cannot fully protect both modules. At intensity=1.0, total damage=25 against initial 80+80=160 total hp. REPAIR_PER_KINDLING=10, so you need 2.5 kindling just to break even on damage (25 hp / 10 = 2.5 kindling). With 8 nodes on the map (values 1-4), a good run might net 8-16 kindling -> enough to over-repair. The pressure may not bite until cycle 3-4 when intensity reaches 1.45-1.60. This is a tuning question, not a structural one.

---

## Required Actions

| Priority | Action | Owner |
| -------- | ------ | ----- |
| BLOCKING | Fix MainMenuScene: route new game to PurificationScene + call gameState.reset() | code agent |
| Low | Add particle surge during impact (D1) | code agent (can defer to polish) |
| Low | Refactor impact timing for dramatic buildup (D2) | code agent (can defer to polish) |
