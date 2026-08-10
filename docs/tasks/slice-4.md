---
status: ACTIVE
slice: 4
created-by: director agent
created-when: 2026-08-11
---

# Slice 4 Task Briefs: Data Pipeline + Defense Engine + Common Tier

> Verification question: Does the data-driven contaminant pipeline correctly load and differentiate per-type behavior? Does activating defense effects (damage reduction + side effects) make slotting decisions meaningfully different? Do passive tools create a distinct playstyle from active tools?

## Scope Summary

- **P0**: CSV build pipeline, defense effect engine, passive tool architecture, expand to 18 types, 6 new common-tier tool implementations
- **P1**: Chaos milestone visuals (backlog), rift collapse scene transition (backlog)
- **NOT**: Fine/rare tools, second enemy, new upgrades, art sprites, C3 tool VFX

## Design Takeaways (from CSV analysis)

**Defense categories** (5 archetypes determining application logic):
| Category | Behavior |
| -------- | -------- |
| 纯减伤 | Flat damage reduction, simple side effect |
| 经济收益 | Lower reduction + resource return |
| 伤害转化 | High reduction but damage re-appears as a debuff on next sortie |
| 加速/催化 | Low reduction but accelerates charge→tool transformation |
| 模块增益 | Moderate reduction + buff to module effectiveness |

**Passive vs Active tools**:
- Active (key press): solidify, ruminate, retrograde, kindle, stitch (common); delay, expand, compress, mirror, echo (fine); resonate, overwrite, erode, abyss, combust (rare)
- Passive (auto-trigger): scatter, muffle (common); siphon (fine)

**Charge multiplication**: kindle has `defense_charge_mult: 2.0` (charges accumulate 2x faster = transforms sooner). All others are 1.0 except ruminate (1.5).

---

## Tasks

### T1: CSV Build Pipeline

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | - |
| Est. | 2h |

**Brief**: Create a build-time script that reads `data/contaminants.csv` and `data/upgrades.csv`, outputs typed TypeScript files to `src/generated/`.

**Requirements**:
- Script location: `tools/csv-codegen/generate.mjs` (Node, no external deps beyond `csv-parse` or manual split)
- Output: `src/generated/contaminant-data.ts` (typed array + lookup map) and `src/generated/upgrade-data.ts`
- Generated interfaces must capture all CSV columns with correct types (number for numerics, string for text)
- Add `npm run codegen` script to package.json; must run before `tsc`
- Add `src/generated/` to `.gitignore` (regenerated on build) OR check in generated files (prefer check-in for simplicity in this project)
- Include a header comment `// AUTO-GENERATED from data/*.csv — do not edit manually`

**Generated type shape (contaminants)**:
```typescript
export interface ContaminantDef {
  id: string;                    // e.g. 'solidify'
  rarity: 'common' | 'fine' | 'rare';
  displayNameDefense: string;
  descriptionDefense: string;
  defenseCategory: string;       // 纯减伤 | 经济收益 | 伤害转化 | 加速/催化 | 模块增益
  defenseReduction: number;      // 0-1
  defenseSideEffect: string;
  sideEffectDuration: string;
  defenseChargeMult: number;
  displayNameTool: string;
  descriptionTool: string;
  toolType: 'active' | 'passive';
  toolUses: number;
  toolRangePx: number;
  toolDurationMs: number;
  narrativeOrigin: string;
}
```

**Acceptance**: `npm run codegen` produces valid .ts that passes `tsc --noEmit`. All 18 entries present.

---

### T2: Type Expansion + Generated Data Integration

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | T1 |
| Est. | 1.5h |

**Brief**: Expand the type system to 18 contaminant types and wire generated data into runtime.

**Changes**:
1. `src/types/game-types.ts` — expand `ContaminantType` union to include all 18 IDs
2. `src/config/contaminant-descriptions.ts` — replace hardcoded 10-entry record with re-export from generated data (or delete file and have consumers import from `src/generated/contaminant-data.ts`)
3. `src/systems/contaminant-node-system.ts` — replace `SLICE3_TYPES` with array of all common-tier types (7): solidify, ruminate, scatter, retrograde, muffle, kindle, stitch
4. `src/systems/contaminant-system.ts` — update `USES` lookup to read from generated data (`toolUses` field) instead of just rarity-based constant; keep rarity-based as fallback
5. `src/config/constants.ts` — keep CONTAMINANT section but remove `USES` (now data-driven); add `CONTAMINANT.COMMON_TYPES` list for node spawning
6. Ensure `Contaminant` interface gains optional field for `chargeMult` (from CSV `defense_charge_mult`)

**Acceptance**: `tsc --noEmit` passes. Node system spawns from 7 common types. Save/load round-trips new type values.

---

### T3: Defense Effect Engine Architecture

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | T2 |
| Est. | 3h |

**Brief**: Build the defense effect application system that runs during each impact cycle.

**New file**: `src/systems/defense-effect-system.ts`

**Architecture**:
```
impact-system.run()
  → calculates raw damage per module
  → calls defenseEffectSystem.applyDefenses(rawDamages, slottedContaminants)
  → returns modified damages (reduced) + side effect queue
  → impact-system applies modified damages
  → side effects stored for next sortie (via gameState or event)
```

**Core interface**:
```typescript
interface DefenseApplication {
  modifiedDamages: Map<string, number>;      // moduleId -> reduced damage
  sideEffects: SideEffect[];                 // queued for next sortie
  chargesApplied: Map<string, number>;       // contaminantId -> charges this impact
  specialEvents: string[];                   // for UI feedback (e.g. "shatter", "nullify")
}

interface SideEffect {
  type: 'chaos_bonus' | 'speed_mod' | 'vision_mod' | 'stability_loss' | 'kindling_return' | 'upgrade_discount';
  value: number;
  duration?: string;  // 'next_sortie' | 'one_impact' | 'instant'
}
```

**Category dispatch logic** (reads `defenseCategory` from generated data):
- 纯减伤: `finalDamage = rawDamage * (1 - reduction)`
- 经济收益: same reduction + emit kindling return event
- 伤害转化: `finalDamage = rawDamage * (1 - reduction)`, store converted amount as next-sortie debuff
- 加速/催化: lower reduction but charges applied = `chargeCost * chargeMult`
- 模块增益: reduction + buff module effect values

**Charge multiplication**: When applying impact charges, use `contaminantDef.defenseChargeMult` instead of flat 1/3.

**Acceptance**: Unit-testable pure function. Impact system calls it. Defense slots with contaminants reduce actual module damage. No regression on existing 3-type behavior.

---

### T4: Defense Effects — Common Tier Implementation

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | T3 |
| Est. | 3h |

**Brief**: Implement all 7 common-tier defense behaviors per CSV spec.

| Type | Reduction | Category | Side Effect | Special |
| ---- | --------- | -------- | ----------- | ------- |
| solidify | 35% | 纯减伤 | Shatter cycle: every 3rd impact drops to 20% for 1 impact | Track shatter counter per contaminant |
| ruminate | 30% | 经济收益 | Next sortie initial chaos +5 | Return 2 kindling to reserve |
| scatter | 50% | 纯减伤 | Next sortie initial chaos +3 | Split damage equally across ALL modules (override focus) |
| retrograde | 15% | 加速/催化 | Wrong prediction: next sortie vision -5% | On correct forecast prediction: upgrade cost -20% |
| muffle | 30% | 纯减伤 | Next sortie enemy near-perception +15% | Forecast shown 1 round earlier |
| kindle | 15% | 加速/催化 | Next sortie initial chaos +4 | chargeMult = 2.0 (transforms in half the impacts) |
| stitch | 25% | 模块增益 | Next sortie speed -10% | After damage, equalize module HP (transfer 20% of diff from high to low) |

**Implementation notes**:
- Side effects stored as `SideEffect[]` on gameState, consumed at sortie start
- "Next sortie initial chaos +N" modifies chaos START_VALUE for that run only
- "Shatter cycle" requires per-contaminant counter (add to Contaminant interface or track in defense system)
- scatter's "split to all modules" overrides the primary/secondary focus logic

**Acceptance**: Each defense type demonstrably reduces damage differently. Side effects apply on next sortie. Kindle transforms faster (2 normal impacts or 1 crest). Scatter distributes damage evenly.

---

### T5: Passive Tool Architecture

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | T2 |
| Est. | 2h |

**Brief**: Extend `tool-system.ts` to support passive tools that trigger on game events.

**Design**:
- Passive tools are equipped in sortie loadout slots just like active tools
- They do NOT respond to key presses — `useSlot()` returns false for passive types
- Instead, they register event hooks on creation (via the scene's event flow)
- Each trigger decrements `usesRemaining`; when 0, tool breaks (same lifecycle)
- HUD shows passive tools with a different indicator (e.g., "auto" label + remaining triggers)

**New abstractions**:
```typescript
interface PassiveToolHook {
  contaminantId: string;
  type: ContaminantType;
  triggerCondition: string;  // for documentation
  onCheck: (context: PassiveCheckContext) => boolean;  // returns true if triggered
}

interface PassiveCheckContext {
  enemyId?: string;
  event: string;  // 'perception_start' | 'enemy_killed' | 'proximity'
  // ... extensible
}
```

**Integration points**:
- `tool-system.create()` — register passive hooks based on loadout
- `tool-system.checkPassives(event, context)` — called by scene at relevant moments
- Scene calls `checkPassives('perception_start', { enemyId })` when an enemy transitions to suspicious

**Acceptance**: Passive tool in loadout slot does NOT fire on key press. Passive triggers consume uses. HUD distinguishes active vs passive slots. Tool breaks correctly at 0 uses.

---

### T6: Common Active Tools — ruminate / retrograde / kindle / stitch

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | T2 |
| Est. | 4h |

**Brief**: Implement 4 new active tool effects (solidify already done).

**ruminate** (反刍之口):
- Target: nearest empty kindling node (already collected) within range
- Effect: recover 1 kindling from it; mark node as "ruminated" (cannot re-use)
- Uses: 4
- Visual: brief green pulse on node

**retrograde** (残响标记):
- Target: nearest enemy in view
- Effect: mark enemy for 12s; marked enemy shows position even outside FOV + patrol route visible as dotted line
- Uses: 4
- Visual: purple outline on enemy + patrol path dots
- Range: unlimited (nearest in current visibility)

**kindle** (燃素弹):
- Target: area at cursor/facing direction, radius 2 tiles (64px)
- Effect: enemies in radius get 3s perception overload (patrol = confused freeze, chase = lose target lock)
- Uses: 5
- Visual: orange burst expanding circle
- Range: 64px from player

**stitch** (缝合线):
- Target: 2 points (first use sets point A, second activates between A and player position)
- Effect: perception barrier 10s; enemies crossing it get perception state forced down one level; triggers once per enemy
- Uses: 4 (each "pair" = 1 use)
- Visual: faint line between points, pulse on trigger
- Range: 96px for point placement
- Duration: 10s

**Implementation pattern**: Follow existing solidify/delay/erode pattern — each gets:
1. Constants (duration, range, radius)
2. Active effect state interface
3. `apply[Type]()` method
4. `update[Type](deltaMs)` method
5. Integration into `rebuildDebuffs()` where applicable

**Acceptance**: Each tool fires on key press, produces correct effect, consumes uses, breaks at 0. Visuals indicate active effect. No AI system internals modified (debuff descriptors only).

---

### T7: Common Passive Tools — scatter / muffle

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | T5 |
| Est. | 2h |

**Brief**: Implement 2 passive tool effects using the passive architecture from T5.

**scatter** (碎影):
- Trigger: when any enemy transitions from patrol to suspicious (perception_start event)
- Effect: that enemy's perception fill speed -30% for 15s
- Cooldown: 15s after each trigger (one trigger at a time)
- Uses: 5
- Note: does NOT require key press

**muffle** (消声步):
- Trigger: always active while equipped
- Effect: enemies' near-distance 360-degree detection is disabled against player; only vision cone detection works
- Break condition: after 5 times an enemy would have detected player via near-distance (= 5 uses)
- Uses: 5
- Note: the "trigger" is counted each time the system detects that near-distance would have fired but was blocked

**Integration with AI**:
- scatter: scene checks passive hooks when AI emits perception state change
- muffle: AI system's near-distance check needs a "suppressed" flag readable from tool debuffs (extend ToolDebuffs interface)

**Acceptance**: scatter triggers on enemy suspicion without key press, slows their perception fill. muffle disables near-distance detection, counts blocked detections, breaks after 5. Both show remaining uses in HUD.

---

### T8: Integration Wiring + Node System

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | T3, T4, T5, T6, T7 |
| Est. | 2h |

**Brief**: Wire all new systems together and ensure the full loop works.

**Checklist**:
1. `impact-system.ts` calls `defenseEffectSystem.applyDefenses()` and uses modified damages
2. Side effects from defense are stored on gameState and consumed at sortie start
3. `rift-scene.ts` calls `toolSystem.checkPassives()` at appropriate AI state change moments
4. `contaminant-node-system.ts` spawns from full common pool (7 types)
5. Node rarity roll still respects weights but type roll now picks from tier-appropriate pool
6. `save-manager.ts` handles new contaminant types + side effect queue
7. `purification-scene.ts` impact result panel shows defense effect details (which type reduced how much)
8. HUD updates for passive tool indicator
9. `contaminant-descriptions.ts` replaced by generated data or updated to 18 entries
10. Ensure fine/rare types that appear (via rarity roll) can be picked up and stored even though their tools aren't implemented yet — they work as defense-only until Slice 5

**Acceptance**: Full sortie loop: pick up common contaminant -> slot in defense -> impact reduces damage per type -> transforms -> equip as tool (active or passive) -> use in rift -> breaks. Save/load preserves everything.

---

### T9: Chaos Milestone Visuals [P1, Backlog]

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | - (independent) |
| Est. | 1.5h |

**Brief**: Add visual + narrative feedback at chaos thresholds 50/75/100.

**Source**: backlog-issues.md item 1.

**Design**:
- At chaos 50: screen edge amber glow + brief text "...不安开始渗透" (1.5s fade)
- At chaos 75: screen edge red pulse + text "...边界在颤抖" (1.5s fade) + subtle camera shake
- At chaos 100: full screen flash + text "...裂隙正在注视你" (2s) + sustained screen edge distortion

**Implementation**:
- Listen to `CHAOS_CHANGED` event; track last-crossed threshold
- Each threshold fires only once per sortie (reset on sortie start)
- Visual: Phaser graphics overlay (vignette rect) + text object + optional camera shake
- Text uses narrative style consistent with existing scene transition text

**Acceptance**: Each threshold triggers exactly once per sortie, shows visual + text, does not obstruct gameplay.

---

### T10: Rift Collapse Transition [P1, Backlog]

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | :red_circle: |
| Depends | - (independent) |
| Est. | 1.5h |

**Brief**: Replace plain black screen + text with a visual "rift collapse" effect when exiting rift.

**Source**: backlog-issues.md item 2.

**Design**:
- Trigger: on successful extraction OR on death/chaos overflow
- Effect sequence (approx 1.5s total):
  1. Camera zoom-in slightly (1.0 -> 1.1 over 0.3s)
  2. Teal/purple flash (full screen, 0.2s)
  3. Radial "shrink" mask closing from edges to center (0.8s)
  4. Brief distortion text: "裂隙坍缩..." or "你被裂隙吞噬..." (based on success/failure)
  5. Fade to black -> scene transition
- Must not add > 2s to the existing transition time

**Implementation**:
- Create a reusable `riftCollapseTransition(scene, success)` utility
- Uses Phaser camera effects (zoom, flash, fade) + graphics mask
- Called in extraction-system's exit flow and death flow before scene switch

**Acceptance**: Both extraction and death trigger the collapse effect. Total transition stays under 2.5s. No plain black screen remains.

---

### T11: QA Verification

| Field | Value |
| ----- | ----- |
| Agent | qa |
| Dispatch | :green_circle: |
| Depends | T1-T10 |
| Est. | 1h |

**Brief**: Full spec-vs-implementation verification for Slice 4.

**Check matrix**:
- [ ] `npm run codegen` produces valid TypeScript from CSV (18 contaminants, 3 upgrades)
- [ ] ContaminantType union = 18 members
- [ ] Rift node system spawns all 7 common types with correct rarity weighting
- [ ] Defense slot with solidify reduces damage by 35%; with kindle by 15%
- [ ] kindle's chargeMult=2 causes transformation in 2 normal impacts (not 3)
- [ ] scatter defense splits damage evenly across modules
- [ ] stitch defense equalizes module HP after impact
- [ ] Side effects apply on next sortie start (chaos bonus, speed mod, etc.)
- [ ] Passive tool (scatter) triggers on enemy perception_start, no key press
- [ ] Passive tool (muffle) blocks near-distance detection, breaks after 5
- [ ] Active tools (ruminate/retrograde/kindle/stitch) function per spec
- [ ] Tool uses decrement; tool breaks at 0
- [ ] Chaos milestones fire at 50/75/100, once per sortie
- [ ] Rift collapse transition plays on extraction and death
- [ ] Save/load round-trips all new contaminant types
- [ ] Fine/rare types can be acquired and stored (defense works) even without tool implementation
- [ ] No regression: solidify/delay/erode tools still function

---

## Dependency Graph

```
T1 (CSV pipeline)
 └→ T2 (type expansion)
     ├→ T3 (defense engine arch)
     │   └→ T4 (defense impl common)
     │       └→ T8 (integration)
     ├→ T5 (passive tool arch)
     │   └→ T7 (passive tools)
     │       └→ T8
     └→ T6 (active tools)
         └→ T8
              └→ T11 (QA)

T9 (chaos milestones) ──→ T11
T10 (rift collapse) ───→ T11
```

T9 and T10 are independent of the contaminant pipeline and can run in parallel with T3-T8.

---

## Risks & Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Defense engine interacts badly with existing impact math | T3 is architected as a pure function layer BETWEEN raw damage calc and HP application; existing impact logic untouched |
| Passive tool hooks into AI may break AI encapsulation | Use debuff descriptor pattern (same as active tools); AI internals never modified |
| scatter's "split to all modules" contradicts existing 2-module system | If only 2 modules exist, split = 50/50 (which is simpler than current 70/30 focus) |
| CSV codegen adds build complexity | Script is zero-dependency Node; checked-in output means devs without Node can still build |
