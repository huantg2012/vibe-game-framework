// IMMUTABLE pre-R100 generation executor. Source: ac9ddd7fab04202d629a97293ffeeb19f71acaec.
// Reproduce with tools/recovery/freeze-legacy-generation.mjs; do not regenerate from current sources.
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/config/constants.ts
var GAME_CONSTANTS = {
  /** Tile size in pixels */
  TILE_SIZE: 32,
  /** Camera. Zoom 1.5 on a 960x640 canvas gives a ~640x427 logical viewport = ~20x13 tiles (DEC-009). */
  CAMERA: {
    ZOOM: 1.5
  },
  /** Player movement (docs/specs/system-movement-vision.md, section M) */
  PLAYER: {
    SPEED: 80,
    // px/s base speed = 2.5 tiles/s (tuned down for deliberate stealth feel)
    MAX_HEALTH: 100,
    INVENTORY_SLOTS: 4,
    MOVE_ACCEL_TIME: 0.08,
    // s from standstill to full speed
    MOVE_DECEL_TIME: 0.1,
    // s from full speed to standstill
    FACING_TURN_RATE: 1080,
    // deg/s the vision cone swings toward the input direction
    FACING_QUANT_HYSTERESIS: 5,
    // deg of dead zone around the 45 degree facing4 boundaries
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 sprite
    SPEED_MOD_MIN: 0.5
    // floor on the multiplied speed modifier stack
  },
  /**
   * Presentation-only gait (art-direction §3.3). Does not change facingAngle,
   * facing4 snap timing, speeds, or colliders.
   */
  ACTOR_MOTION: {
    FRAME_COUNT: 4,
    TURN_MS: 180,
    LAG_PX: 3,
    LAG_ALPHA: 0.38,
    MOVE_SPEED_FLOOR: 6,
    // px/s; below this the idle cycle plays
    PLAYER_IDLE_FPS: 4,
    PLAYER_WALK_FPS: 8,
    INFILTRATOR_IDLE_FPS: 4,
    INFILTRATOR_WALK_FPS: 4,
    // puppet hitch supplies the step; keep the sheet slow
    REWRITER_IDLE_FPS: 4,
    REWRITER_WALK_FPS: 6
  },
  /** Chaos system (docs/specs/system-chaos-scavenge-extract.md) */
  CHAOS: {
    START_VALUE: 0,
    MAX_VALUE: 100,
    // HUD gauge max (value CAN exceed this)
    HARD_CAP: 150,
    BASE_RATE: 0.5,
    // points per second (DEC-024: calibrated for 80 px/s travel)
    THRESHOLD_1: 50,
    THRESHOLD_2: 75,
    THRESHOLD_3: 100,
    COMBAT_BONUS: 5,
    DETECTION_BONUS: 3,
    DETECTION_BONUS_COOLDOWN: 1e4,
    // ms per-enemy cooldown on detection chaos
    CHASE_RATE_MULT: 2,
    EMIT_STEP: 1,
    // minimum delta before emitting CHAOS_CHANGED
    MODULATOR_STEP: 1
    // minimum delta before calling onModulate callback
  },
  /** Loot / kindling nodes (docs/specs/system-chaos-scavenge-extract.md) */
  LOOT: {
    /** 迭代 10 起退役，见 spec 规则 14。名义参数，代码无引用；由 SEARCH_RADIUS 取代。 */
    PICKUP_RADIUS: 16,
    NODE_COUNT: 8,
    VALUE_SAFE: 1,
    VALUE_CONTESTED: 2,
    VALUE_DEEP: 4,
    SEARCH_CHANNEL_MS: 1200,
    SEARCH_RADIUS: 48,
    SEARCH_NOISE_RADIUS: 96,
    SEARCH_NOISE_LEVEL: "suspicious"
  },
  /** Extraction point (docs/specs/system-chaos-scavenge-extract.md) */
  EXTRACTION: {
    TRIGGER_RADIUS: 48,
    KEY: "E",
    SETTLE_DELAY_MS: 600,
    RESTART_KEY: "R"
  },
  /**
   * Visibility / FOV (docs/specs/system-movement-vision.md, section V).
   * Models a forward cone unioned with an ambient ring, with three fixed-width edge
   * bands. The older single-radius + edge-softness model was replaced rather than
   * extended, so the two parameter sets never coexist.
   */
  VISIBILITY: {
    RADIUS_FORWARD: 224,
    // px straight ahead (7 tiles); must exceed every profile sightRange (I1)
    RADIUS_AMBIENT: 80,
    // px all around (2.5 tiles) = the lamp the player carries
    CONE_HALF_ANGLE: 50,
    // deg half-angle of the full-range sector
    CONE_FALLOFF_ANGLE: 30,
    // deg of transition from forward range down to ambient
    MIN_SOLID_RADIUS: 48,
    // px that stay fully lit no matter what
    EDGE_BAND_WIDTH: 32,
    // px per gradient band (1 tile, art-direction 4.3)
    BAND_ALPHAS: [1, 0.6, 0.2],
    // visibility of core / middle / outer band
    ERASE_ALPHAS: [1, 0.5, 0.2],
    // per-layer erase strength producing those alphas
    RAY_COUNT: 60,
    // architecture ceiling
    RAY_SPLIT_FORWARD: 40,
    // rays inside the cone sector
    RAY_SPLIT_AMBIENT: 20,
    // rays across the remaining angles
    RAY_COUNT_DEGRADED: 40,
    // first degradation step
    RAY_SPLIT_FORWARD_DEGRADED: 28,
    RAY_SPLIT_AMBIENT_DEGRADED: 12,
    MIN_RADIUS_SCALE: 0.4,
    // hard floor for the chaos radius modulator
    CACHE_POS_EPSILON: 0.5,
    // px of movement tolerated before the cache is dropped
    CACHE_ANGLE_EPSILON: 0.5,
    // deg of rotation tolerated before the cache is dropped
    BUDGET_MS: 2,
    // per-frame raycasting budget
    DEGRADE_SAMPLE_FRAMES: 30,
    // consecutive frames over budget before degrading
    /** Void outside the field of view */
    VOID_COLOR: 526860,
    VOID_NOISE_ALPHA: 0.04,
    VOID_NOISE_TILE: 64,
    // px noise texture size
    VOID_NOISE_SCROLL: 2,
    // px/s drift
    /** Warm lamp the player carries - the only warm light inside a rift */
    PLAYER_LAMP_COLOR: 9067562,
    PLAYER_LAMP_ALPHA: 0.12,
    /**
     * Flashlight beam: an additive warm pool pushed forward along facing and clipped to
     * the vision cone by the darkness mask. This is what makes the forward cone read as
     * "lit by a flashlight" rather than merely "revealed" (A-G3 / DEC-018 beam gain).
     */
    FLASHLIGHT_COLOR: 11047018,
    // pale warm; a saturated brown would wash the cold floor out
    FLASHLIGHT_ALPHA: 0.16,
    // low enough that fragment L1 (clinic/metro/soil) still reads under the cone
    FLASHLIGHT_FORWARD_FRAC: 0.34,
    // push the pool centre this fraction of forward range ahead
    FLASHLIGHT_RADIUS_FRAC: 0.85,
    // pool radius as a fraction of forward range
    /** Glow bleeding through the darkness (Slice 1: extraction point only) */
    GLOW_LEAK_ALPHA: 0.25,
    GLOW_LEAK_RADIUS: 48,
    /** Chaos corruption of the vision edge */
    CORRUPTION_COLOR: 1748374,
    CORRUPTION_MAX_MIX: 0.6,
    // alpha of the teal band at corruption 1.0
    CORRUPTION_MAX_DEPTH: 0.35,
    // fraction of the range teal can eat at corruption 1.0
    CORRUPTION_JITTER_PX: 4,
    CORRUPTION_JITTER_HZ: 6,
    /**
     * Overflow (chaos > 100) full-screen teal wash. Persistent base stays well below the
     * old 0.08 epilepsy cap; the jump is a discrete ~2 s pulse (not a strobe), so its
     * peak can read as a "skip" without a rapid flash train.
     */
    FLICKER_BASE_ALPHA: 0.05,
    FLICKER_JUMP_ALPHA: 0.16,
    FLICKER_JUMP_PERIOD_MS: 2200,
    FLICKER_JUMP_WIDTH_MS: 140,
    /** Extra teal bite / edge jitter scale at screenFlicker = 1.0 */
    OVERFLOW_CORRUPTION_DEPTH_BOOST: 0.4,
    OVERFLOW_JITTER_BOOST: 1,
    /** Purification point overrides (omni mode) */
    PURIFY_RADIUS: 400,
    PURIFY_RAY_COUNT: 90
  },
  /**
   * Enemy AI (docs/specs/system-enemy-ai.md, "数值结构"). Every AI number lives here;
   * none are inlined in the systems.
   *
   * Six of these values are load-bearing relations rather than free parameters - the
   * balance invariants I1-I6 that make stealth playable at all. `config/invariants.ts`
   * asserts them at boot so tuning cannot silently break one.
   *
   * The old `SIGHT_ANGLE: 90 // cone half-angle` key was removed rather than kept: its
   * meaning split into a core cone and a peripheral band, and three overlapping angle
   * parameters would have been three ways to be wrong.
   */
  AI: {
    // --- movement and body (shared; per-role speeds live in data/enemies.csv) ---
    TURN_RATE: 360,
    // deg/s; a third of the player's, which is what makes flanking work (I6)
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 infiltrator sprite
    SEPARATION_RADIUS: 24,
    // px; soft repulsion instead of enemy-vs-enemy physics
    SEPARATION_WEIGHT: 0.35,
    // how strongly separation bends the movement direction
    STANDOFF_DISTANCE: 30,
    // px; where a chaser stops. Must stay under COMBAT.ATTACK_RANGE
    STANDOFF_BAND: 4,
    // px of tolerance around it (26..34)
    STANDOFF_ADJUST_SPEED: 60,
    // px/s used to back off when the player crowds it
    // --- perception (shared; cone / hearing radii / weights live in data/enemies.csv) ---
    DETECT_FILL_TIME: 0.45,
    // s of clear sight to go from 0 to certain; then × visionWeight
    HEAR_FILL_TIME: 2,
    // s of hearing fill baseline; then × hearingWeight × moveMult
    HEARING_STILL_CAP: 0.2,
    // still-hearing cannot push detection past this (below 0.35)
    HEAR_ALERT_THRESHOLD: 0.7,
    // rewriter T0-4b: hearing can push to ALERT, never CHASE
    DETECT_DIST_FACTOR_NEAR: 1.6,
    // detection rate multiplier at point blank
    DETECT_DIST_FACTOR_FAR: 0.5,
    // ...and at the edge of sight range
    DETECT_ZONE_FACTOR_PERIPH: 0.45,
    // peripheral vision fills far slower than the core cone
    SUSPICION_THRESHOLD: 0.35,
    // detection at which it stops and turns - the player's warning
    REACQUIRE_THRESHOLD: 0.5,
    // lower bar to re-lock while already searching
    DETECT_DECAY_RATE: 0.67,
    // per s; ~1.5 s to clear after breaking sight
    DETECT_DECAY_ALERT_SCALE: 0.5,
    // decays half as fast while searching: it is holding a grudge
    HEARING_JITTER: 32,
    // px of positional fuzz, so hearing is not a wall-hack locator
    PERCEPTION_TICK_MS: 100,
    // 10 Hz perception; one raycast per enemy per tick
    PERCEPTION_TICK_MS_FAR: 200,
    // 5 Hz beyond ACTIVE_RANGE (rule N8)
    // --- timers (section "计时器") ---
    LOS_GRACE_MS: 400,
    // how long a chase survives with no line of sight
    LOST_PLAYER_DURATION: 5e3,
    // ms of ALERT searching
    ALERT_DURATION: 3e3,
    // ms a SUSPICIOUS enemy stays wary with no new stimulus
    CHASE_ABANDON_RANGE: 320,
    // px past which an unseen chase is given up
    WAYPOINT_PAUSE_MS: 1200,
    // dwell at a patrol waypoint - the player's window to slip past
    SCAN_HOLD_MS: 600,
    // dwell on each scan heading
    SEARCH_HOLD_MS: 800,
    // dwell at each ALERT search point
    EXTRAPOLATE_SEC: 0.6,
    // how far ahead of the last sighting to guess - punishes running straight
    SEARCH_SPREAD: 96,
    // px radius of the random third search point
    ALERT_EMIT_COOLDOWN_MS: 1e3,
    // suppression window for repeated same-level ENEMY_ALERT
    SUSPICIOUS_TURN_HOLD_MS: 200,
    // minimum standstill when turning to look (rule B2, ">= 0.2 s")
    SCAN_SWEEP_ANGLE: 45,
    // deg to each side when scanning in place
    SCAN_SWEEP_PERIOD_MS: 1500,
    // full left-right-left sweep period
    FACING_ARRIVE_EPSILON: 6,
    // deg within which a turn counts as completed
    // --- pathfinding and performance (section "寻路与性能") ---
    MAX_PATHS_PER_FRAME: 1,
    // architecture hard rule
    REPATH_INTERVAL_MS: 500,
    REPATH_INTERVAL_MS_FAR: 1e3,
    // for requests past SIMPLE_PATH_RANGE (rule N5)
    REPATH_MOVE_THRESHOLD: 48,
    // px of target movement that earns an early chase repath
    SIMPLE_PATH_RANGE: 384,
    // px past which a request drops to the lowest priority
    ASTAR_MAX_NODES: 3e3,
    // expansion ceiling; real cap is the 5ms budget, not node count. Worst cross-map search measured 1050 nodes / 0.31ms, so 3000 stays well under 5ms and leaves RETURN headroom (DEC-022)
    PATH_FAIL_LIMIT: 3,
    // consecutive failures before giving up on the goal
    ACTIVE_RANGE: 640,
    // px; beyond this the FSM runs at 5 Hz and never asks for a path
    ARRIVE_EPSILON: 8,
    // px within which a path point counts as reached
    MAX_ACTIVE_ENEMIES: 8,
    // Slice 1 uses 4; more than this means the map data is wrong
    MAX_PATH_POINTS: 64,
    // capacity of a per-enemy dynamic path buffer
    DT_CLAMP_MS: 100,
    // stops a backgrounded tab from teleporting enemies on return
    /**
     * Stuck watchdog. Rule N4 skips A* whenever the target is in line of sight, but a
     * clear sight line does not prove a 20 px body fits through the diagonal seam it
     * crosses. Instead of pre-emptively restricting N4 to 3 tiles, we detect the
     * symptom (wanting to move but not moving) and fall back to a real path.
     */
    STUCK_REPATH_MS: 400,
    STUCK_PATH_PREFERENCE_MS: 2e3,
    // how long a stuck enemy keeps preferring A* over straight lines
    STUCK_PROGRESS_FRACTION: 0.25,
    // actual/desired speed below which we count as stuck
    // --- placeholder presentation (section "占位期表现", art-direction 12) ---
    BODY_COLOR: 13386820,
    // "low tier enemy"; encodes tier, never state
    INDICATOR_COLOR: 2811592,
    // contamination teal; state lives here
    SUSPICIOUS_BREATH_HZ_MIN: 1.5,
    // breathing rate at the suspicion threshold...
    SUSPICIOUS_BREATH_HZ_MAX: 3,
    // ...and at full certainty (rule R3)
    ALERT_BLINK_HZ: 3,
    // blinking = searching
    AFTERIMAGE_INTERVAL_MS: 100,
    AFTERIMAGE_LIFETIME_MS: 300,
    AFTERIMAGE_ALPHA: 0.3,
    AFTERIMAGE_SLOTS: 4,
    // ring buffer per enemy; lifetime/interval + 1
    /** Rule R5's fallback visualisation. The cone drawing itself is not implemented yet. */
    DEBUG_SHOW_VISION_CONE: false
  },
  /** Map generation */
  MAP: {
    WIDTH: 80,
    // tiles (larger to accommodate multiple fragments)
    HEIGHT: 80,
    // tiles
    /** Voronoi partitioning */
    FRAGMENT_COUNT_MIN: 4,
    FRAGMENT_COUNT_MAX: 6,
    FRAGMENT_MIN_AREA: 150,
    // minimum tiles per fragment
    /** Cellular automata */
    CA_ITERATIONS: 5,
    // smoothing passes
    CA_WALL_THRESHOLD: 4,
    // cells with >= N wall neighbors become wall
    CA_INITIAL_FILL: 0.45,
    // initial random fill ratio (lower = more open)
    /** Fracture connections between fragments */
    FRACTURE_WIDTH: 2,
    // tiles (narrow passage width)
    FRACTURE_MAX_PER_EDGE: 2
    // max connections between two adjacent fragments
  },
  /**
   * Slice 6 C1 land outline. Rectangular tile buffer; walkable land must not fill it.
   * 80×80 MAP.* numbers stay architecture placeholders — do not use them for this generator.
   */
  GENERATION: {
    BUFFER_COLS: 64,
    BUFFER_ROWS: 42,
    MAX_OUTLINE_ATTEMPTS: 28,
    LAND_FILL_MIN: 0.24,
    LAND_FILL_MAX: 0.48,
    BORDER_RING: 2,
    /** Fraction of the outer ring that may be land. Higher = island hugging the rectangle. */
    BORDER_OCCUPANCY_MAX: 0.12,
    /** Land / axis-aligned bbox. Circles sit near 0.78; filled rectangles sit near 1. */
    BBOX_FILL_MAX: 0.8,
    /**
     * Share of land cells that touch void. Large blobs naturally sit lower;
     * this only rejects near-solid blocks (a 1-cell frame around a filled rect).
     */
    ROUGHNESS_MIN: 0.08,
    /** bbox must leave at least this many leftover cells on width+height combined. */
    MIN_BBOX_SLACK: 8,
    MAX_EDGES_TOUCHING: 3,
    MAX_RUIN_ATTEMPTS: 40,
    MIN_FEATURE_SEPARATION: 7,
    WALL_RATIO_MIN: 0.018,
    WALL_RATIO_MAX: 0.22,
    /** Largest leftover open rectangle (tiles). Bigger than this reads as an empty plaza. */
    YARD_AREA_MAX: 64
  },
  /** Purification point (docs/specs/system-purification-impact.md) */
  PURIFICATION: {
    /** Spatial layout */
    MAP_COLS: 14,
    // tiles
    MAP_ROWS: 12,
    // tiles
    INTERACTION_RADIUS: 32,
    // pixels for module/rift-entrance interaction
    /** Module state */
    MODULE_INITIAL_HP: 70,
    /** Tier-0 repair cap / effect denominator baseline (DEC-064). */
    MODULE_BASE_MAX_HP: 100,
    /** Alias of MODULE_BASE_MAX_HP so older call sites still compile. */
    MODULE_MAX_HP: 100,
    /** Each thicken tier adds this many maxHp to every module. */
    MODULE_MAX_HP_PER_TIER: 15,
    /** Highest purchasable thicken tier (maxHp = 100 + 15*3 = 145). */
    MODULE_MAX_HP_TIERS: 3,
    // Thickening purchase costs are authored alongside all other growth steps
    // in data/growth-route.csv, not a separate system-constant price ladder.
    /** All three module effects use this HP reference; thickening does not raise it. */
    MODULE_EFFECT_HP_REF: 100,
    /** Starting chaos when purifier hp = 0 (full integrity → 0). */
    CHAOS_HARD_START: 50,
    REPAIR_PER_KINDLING: 4,
    // 1 kindling = this many hp (tuned for scarcity)
    /** Impact system (intensity now driven by TideSystem, see TIDE constants) */
    BASE_IMPACT_DAMAGE: 30,
    THREAT_FOCUS_RATIO: 0.65,
    // primary target gets this fraction of total damage
    FORECAST_ACCURACY: 0.8,
    // particle prediction accuracy
    /** combust defense mechanic (DEC-030): fixed threshold, not derived from
     * BASE_IMPACT_DAMAGE, so tide-driven damage swings don't shift the trigger point.
     * Value chosen to equal ~2x BASE_IMPACT_DAMAGE(30) per the CSV's "约等于2次满额冲击". */
    COMBUST_BURN_THRESHOLD: 60,
    /** Module effects */
    MAX_CORE_REDUCTION: 0.3,
    // chaosRate reduction at full hp
    MAX_STORAGE_BONUS: 0.5,
    // kindling value bonus at full hp
    /** resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%".
     * A flat bump to both caps above while at least one resonate sits in a defense slot -
     * not a multiplier, so it reads the same way the CSV states it ("+10%" alongside two
     * numbers already expressed as flat percentages). "不叠加" is enforced by storing this
     * as a single on/off flag (`GameState.isResonateBonusActive()`), not a per-item count. */
    RESONATE_MODULE_CAP_BONUS: 0.1,
    /** siphon (Slice 5 gap-fill): "装备期间所有薪柴修复模块的效率翻倍(1薪柴=8hp)" - same
     * "装备期间" derivation pattern as RESONATE_MODULE_CAP_BONUS above (owned by
     * `ContaminantSystem.syncRepairEfficiencyMult()` + `GameState`, not a per-impact
     * defense-engine effect), since the CSV names it a standing equip-state bonus rather
     * than a one-impact trigger. 4 (REPAIR_PER_KINDLING) * 2.0 = 8, matching the CSV. */
    SIPHON_REPAIR_EFFICIENCY_MULT: 2,
    /** Boundary atmosphere */
    ATMOSPHERE: {
      PARTICLE_COUNT: 50,
      // active boundary particles
      PARTICLE_ALPHA_MIN: 0.06,
      PARTICLE_ALPHA_MAX: 0.25,
      PARTICLE_SPEED: 8,
      // px/s slow inward drift
      APPARITION_INTERVAL_MIN: 8e3,
      // ms
      APPARITION_INTERVAL_MAX: 15e3,
      APPARITION_DURATION: 3e3,
      // ms (0.5s fade in + 2s hold + 0.5s fade out)
      APPARITION_MAX_SIMULTANEOUS: 3
    },
    /** Dynamic boundary shape (polar pressure blob) */
    BOUNDARY: {
      SHRINK_AT_MAX_INTENSITY: 0.72,
      // tideScale at intensity 3.0 (boundary loses up to 28%)
      PRESSURE_PRIMARY_AMP: 0.2,
      // max inward push fraction (primary Gaussian lobe)
      PRESSURE_SECONDARY_AMP: 0.1,
      // secondary lobe amplitude
      PRESSURE_LOBE_SIGMA: 0.7,
      // radians; width of each Gaussian lobe
      PRESSURE_CREST_BONUS: 0.4,
      // +40% amplitude during crest phase
      PRESSURE_EBB_FACTOR: 0.6,
      // amplitude multiplier during ebb phase
      SAFE_MARGIN_TILES: 1,
      // minimum distance from any interaction point to boundary
      GRADIENT_INNER_START: 0.8,
      // fraction of R where darkening begins
      GRADIENT_MEMBRANE_START: 0.95,
      // fraction where "membrane" teal band begins
      GRADIENT_OUTER_END: 1.15,
      // fraction where full void begins
      /**
       * B4 (Slice 5): the old BREATH_BASE_ALPHA/AMP/FREQ/CREST_FREQ_MULT/EBB_AMP_MULT
       * keys described a single global sinusoidal pulse from a "whole-boundary breathing"
       * design that DEC-028 (Slice 4.5) replaced with localized pressure impacts
       * (`src/systems/boundary-breath.ts`). Those 5 keys had zero consumers and were
       * removed; this nested object holds boundary-breath.ts's real tuning knobs
       * (previously inlined as top-of-file `const`s there) instead. Values unchanged.
       */
      BREATH: {
        SAMPLE_COUNT: 72,
        // angular resolution of the membrane/impact draw
        MAX_IMPACTS: 5,
        // max simultaneous localized impacts
        ARC_HALF_MIN: 0.4,
        // rad; narrowest impact arc half-width
        ARC_HALF_MAX: 0.8,
        // rad; widest impact arc half-width
        SPAWN_DIST_MIN: 14,
        // px; closest impact spawn distance outside the membrane
        SPAWN_DIST_MAX: 30,
        // px; farthest impact spawn distance
        IMPACT_DURATION_MIN: 1800,
        // ms; shortest single-impact lifetime
        IMPACT_DURATION_MAX: 3500,
        // ms; longest single-impact lifetime
        SPAWN_INTERVAL_MIN: 400,
        // ms; shortest gap between new impacts
        SPAWN_INTERVAL_MAX: 1200,
        // ms; longest gap between new impacts (x0.6 during crest)
        WAVE_COLOR: 936511,
        // dark desaturated teal, the inbound wave arcs
        MEMBRANE_COLOR: 1735274,
        // the boundary membrane line itself
        DEFORM_MAX_PX: 8
        // px; max inward push of the membrane at impact center
      }
    },
    /** Scene transition timing */
    IMPACT_RESULT_DISPLAY_MS: 2e3,
    SCENE_TRANSITION_DELAY_MS: 600
  },
  /**
   * Combat (docs/specs/system-combat.md, "数值结构"). Every combat number lives here.
   *
   * The system is a price list, not a fight: the point is that the player can work out
   * what swinging costs before swinging. Three of these relations carry that promise and
   * are asserted at boot by `config/invariants.ts` (K1/K2/K3/K5) - notably
   * `ENEMY_MAX_HEALTH` being an exact multiple of `PLAYER_DAMAGE`, which is what makes
   * "three hits" a fact rather than an average.
   *
   * When combat turns out too cheap in playtesting, the spec's tuning order is
   * `CHAOS.COMBAT_BONUS` and `NOISE_HIT_RADIUS` first, `ENEMY_MAX_HEALTH` second, and
   * `PLAYER_DAMAGE` never (weakening it makes combat expensive *and* unpleasant).
   */
  COMBAT: {
    // --- player attack (section "玩家攻击") ---
    PLAYER_DAMAGE: 25,
    ATTACK_COOLDOWN: 500,
    // ms, counted from the input instant, parallel to the phases
    ATTACK_RANGE: 40,
    // px centre-to-centre; must exceed ENEMY_ATTACK_RANGE (K2)
    ATTACK_HALF_ANGLE: 60,
    // deg -> a 120 deg forward sector
    ATTACK_WINDUP_MS: 100,
    // the player's side of the commitment
    ATTACK_ACTIVE_MS: 50,
    // ~3 frames; exists to tolerate frame jitter, not to widen the hit
    ATTACK_RECOVERY_MS: 70,
    ATTACK_SLOW_MS: 220,
    // derived: windup + active + recovery (asserted, not free)
    ATTACK_SELF_SLOW: 0.35,
    // move speed while swinging - the "cost" that lands on feel
    ATTACK_MIN_ANGLE_BYPASS: 16,
    // px within which the angle test is meaningless and skipped
    /** Key name in `Phaser.Input.Keyboard.KeyCodes`. Read by RiftScene, which owns input. */
    ATTACK_KEY: "SPACE",
    // --- infiltrator (section "敌人（渗透体）") ---
    ENEMY_MAX_HEALTH: 75,
    // = 3 x PLAYER_DAMAGE exactly (K1, DEC-012)
    ENEMY_DAMAGE_BASE: 15,
    ENEMY_ATTACK_RANGE: 38,
    // px; between AI.STANDOFF_DISTANCE and ATTACK_RANGE (K2)
    ENEMY_ATTACK_HALF_ANGLE: 60,
    // deg; symmetric with the player's
    ENEMY_ATTACK_WINDUP_MS: 350,
    // the player's dodge window - the whole of "controllable" (K3)
    ENEMY_ATTACK_COOLDOWN_MS: 1200,
    ENEMY_FIRST_ATTACK_DELAY_MS: 300,
    // "caught up with you" and "hit you" stay two events
    ENEMY_ATTACK_TOKENS: 2,
    // enemies allowed in windup at once; caps unavoidable damage
    ENEMY_HIT_FLASH_MS: 80,
    ENEMY_DEATH_FX_MS: 180,
    // presentation only; the enemy is gone from logic at 0 ms
    // --- player health and hits (section "玩家生命值与受击") ---
    PLAYER_IFRAME_MS: 400,
    // stops two enemies resolving on one frame for 30 damage
    PLAYER_HIT_FLASH_MS: 100,
    // --- noise: the exposure half of the price (section "噪声") ---
    NOISE_SWING_RADIUS: 96,
    // px (3 tiles), 'suspicious' - a whiff is heard, not billed
    NOISE_HIT_RADIUS: 160,
    // px (5 tiles), 'alert' - the main reason a fight is loud
    NOISE_KILL_RADIUS: 192,
    // px (6 tiles), 'alert'
    /**
     * Placeholder presentation (spec V2). White is on loan here: it currently means
     * "player / extraction point" in art-direction 12, and using thin white lines and
     * flashes for combat actions is still awaiting art sign-off (spec escalate 1 and 2).
     * Treat these as stand-ins, not as the visual language.
     */
    FX_COLOR: 16777215,
    ATTACK_FAN_FX_MS: 60,
    // how long the swing outline stays up (spec V2)
    PLAYER_FLASH_PAD: 6,
    // px the hit flash overshoots the body; see report on white-on-white
    FX_POOL_SIZE: 12
    // preallocated flash/death sprites: 8 enemies + headroom
  },
  /**
   * Contamination lexicon (DEC-076). Morph tables stay in CSV.
   * These are system constants: core HP, chaos prices, draw retry, encounter timing.
   */
  CONTAMINATION: {
    CORE_MAX_HEALTH: 50,
    ADJACENT_STRIKE_DAMAGE: 15,
    ADJACENT_STRIKE_WINDUP_MS: 350,
    PAINT_STEP_CHAOS_REST: 2,
    PAINT_STEP_CHAOS_INFLATED: 4,
    VOLUME_CHAOS_PER_SEC: 1,
    VOLUME_SIGHT_MULT: 0.7,
    DRAW_RETRY_LIMIT: 12,
    ENCOUNTER_COOLDOWN_MS: 6e4,
    ENCOUNTER_GAP_MS: 2500,
    ENCOUNTER_HOLD_MS: 2500,
    VOLUME_DEPTH: 40,
    COLONY_NUCLEUS_COUNT_MIN: 2,
    COLONY_NUCLEUS_COUNT_MAX: 3,
    COLONY_NUCLEUS_MIN_TILE_GAP: 3
  },
  /** Audio */
  AUDIO: {
    MAX_SIMULTANEOUS_SFX: 8,
    DEFAULT_SFX_VOLUME: 0.7,
    DEFAULT_BGM_VOLUME: 0.4,
    DEFAULT_AMBIENT_VOLUME: 0.5
  },
  /** Tide system (docs/specs/system-growth-tide.md, section T) */
  TIDE: {
    TIDES: [
      { floor: 1, peak: 1.6, riseCycles: 3, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.2 },
      { floor: 1.2, peak: 2, riseCycles: 4, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.5 },
      { floor: 1.5, peak: 2.4, riseCycles: 4, crestCycles: 2, ebbCycles: 2, ebbTarget: 1.8 },
      { floor: 1.8, peak: 2.8, riseCycles: 4, crestCycles: 2, ebbCycles: 3, ebbTarget: 2 },
      { floor: 2, peak: 3, riseCycles: 5, crestCycles: Infinity, ebbCycles: 0, ebbTarget: 2 }
    ],
    CREST_CHARGE_COST: 3,
    // impact charge cost during Crest phase
    NORMAL_CHARGE_COST: 1,
    // impact charge cost during Rise/Ebb phases
    TRANSFORM_THRESHOLD: 3
    // charges needed to transform defense -> tool
  },
  // Growth / permanent upgrades (docs/specs/system-growth-tide.md, section G):
  // Definitions come from data/upgrades.csv; all step costs come from
  // data/growth-route.csv (including thickening). Both generate upgrade-data.ts
  // under the CSV source rule — no constants block here
  // by design; growth-system.ts reads UPGRADE_DATA directly.
  /** Contaminant system (docs/specs/system-growth-tide.md, section CN) */
  CONTAMINANT: {
    NODES_PER_MAP: 3,
    // contaminant pickup nodes per rift map
    RARITY_WEIGHTS: { common: 60, fine: 30, rare: 10 },
    DEFENSE_SLOTS: 1,
    // base slot; each growth_defense_slot level adds +1
    SORTIE_SLOTS: 3,
    // base slots (2 active + 1 passive); growth_sortie_slot adds +1 active
    MAX_DEFENSE_SLOTS: 4,
    // DEFENSE_SLOTS + max growth_defense_slot bonus (maxLevel 3)
    MAX_SORTIE_SLOTS: 4,
    // SORTIE_SLOTS + max growth_sortie_slot bonus (maxLevel 1)
    USES: { common: 5, fine: 3, rare: 2 },
    // uses remaining after transformation
    /** echo defense mechanic: "单件因此最多+2" — per-tool cap on echo bonus grants. */
    ECHO_MAX_TOOL_USE_BONUS: 2,
    /**
     * Hotkeys for the active sortie slots, in slot order. The passive slot (always the
     * last unlocked slot, see `contaminantSystem.getSortiePassiveSlotIndex()`) never gets
     * an entry here - it has no hotkey by design. G was picked for the 3rd slot
     * (growth_sortie_slot, Slice 5 T5) because it sits directly beside F on the keyboard,
     * the same "one key past the movement cluster" reach as Q/F already use, and every
     * other neighbour (E/R/T) is already taken by extraction/restart/nothing-reserved-but-
     * awkward. Single source of truth for both the RiftScene binding and any UI that needs
     * to render the real key label.
     */
    SORTIE_ACTIVE_KEYS: ["Q", "F", "G"]
  },
  /** Purification stability (docs/specs/system-growth-tide.md, section S) */
  STABILITY: {
    MAX: 100,
    GAIN_EXTRACT: 1,
    // successful extraction (calibrated: ~35 cycles to cap)
    GAIN_GROWTH: 1,
    // purchased an upgrade
    GAIN_CREST_SURVIVED: 3,
    // survived a full Crest with no module at zero
    GAIN_TIDE_ADVANCE: 5,
    // tide advanced to next number
    LOSS_MODULE_ZERO: -1
    // a module reached 0 hp
  },
  /**
   * Fine/Rare active+passive tool numbers not already carried by
   * `src/generated/contaminant-data.ts` (radius/duration/uses read straight from the CSV
   * at the point of use instead of being re-hardcoded here - see `docs/design-notes/
   * slice3-sortie-tools.md`). Everything below is either a multiplier/amount the CSV
   * description states in prose (`data/contaminants.csv`, `description_tool` column) or,
   * where flagged, a placeholder-tier number the CSV leaves unspecified (Slice 5 T1).
   */
  TOOLS: {
    /** compress: "半径2格内敌人移速-60%" */
    COMPRESS_SPEED_MULT: 0.4,
    /** resonate: "弹回3格并眩晕2秒" */
    RESONATE_KNOCKBACK_PX: 96,
    RESONATE_STUN_MS: 2e3,
    /** overwrite: "感知范围缩小50%" */
    OVERWRITE_PERCEPTION_MULT: 0.5,
    /** combust: "感知范围-50%"(烈焰遮蔽视线) */
    COMBUST_PERCEPTION_MULT: 0.5,
    /** combust: "每秒受到持续伤害" - CSV gives no amount; placeholder tuned so an enemy
     * that stays the full 8s duration dies (75 hp / 15 = 5 ticks), matching the tool's
     * rare-tier power level. Flagged for design confirmation (see delivery report). */
    COMBUST_DAMAGE_PER_TICK: 15,
    COMBUST_TICK_MS: 1e3,
    /** mirror: "被敌人接触后碎裂消失" - CSV gives no contact radius; placeholder tuned to
     * roughly one enemy body width. Flagged for design confirmation. */
    MIRROR_CONTACT_RADIUS: 20,
    /** abyss: "使用后5秒内混乱增速+50%" - a second timing value the CSV's single
     * `tool_duration_ms` column cannot carry (that field holds the 10s reveal instead). */
    ABYSS_CHAOS_BOOST_MULT: 1.5,
    ABYSS_CHAOS_BOOST_MS: 5e3,
    /** siphon: "吸取2点薪柴且...混乱值增速减半" */
    SIPHON_KINDLING_GAIN: 2,
    SIPHON_CHAOS_REDUCTION_MULT: 0.5
  },
  /** Persistent save (docs/specs/system-growth-tide.md, section P) */
  SAVE: {
    KEY: "coh-save-v1",
    VERSION: 2
  }
};

// src/entities/form-renderers/d/environment-pixels.ts
var ENV_INK = {
  seam: [20, 28, 28],
  shadow: [36, 46, 44],
  body: [64, 79, 73],
  ridge: [100, 117, 103],
  ash: [112, 113, 102],
  ashShadow: [59, 65, 62],
  oil: [29, 39, 39],
  oilRidge: [69, 94, 86],
  metal: [88, 91, 83],
  rust: [92, 75, 60],
  teal: [54, 154, 132],
  lit: [128, 198, 168]
};
function stageOf(c) {
  return c === "infiltrate" ? 0 : c === "rewrite" ? 1 : 2;
}
function activityOf(p) {
  return p?.activity?.phase === "rest" ? 0 : p?.activity?.phase === "waking" ? p.activity.progress : 1;
}
function putPixel(out, w, h, x, y, ink, alpha = 255) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  out[i] = ink[0];
  out[i + 1] = ink[1];
  out[i + 2] = ink[2];
  out[i + 3] = alpha;
}
function cluster(x, y, seed) {
  let n = Math.imul(Math.floor(x / 3) + seed, 374761393) ^ Math.imul(Math.floor(y / 2) + 11, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return (n >>> 0) % 11;
}

// src/entities/form-renderers/d/paint-genome/material.ts
function paintSurfaceMaterial(out, field, w, h, substrate, coverage, seed, elapsedMs = 0, pose) {
  out.fill(0);
  const stage = stageOf(coverage), activity = activityOf(pose);
  const phase = elapsedMs * Math.PI * 2 / 2400;
  const inflated = pose?.signal === "inflated";
  const lift = activity * (inflated ? 1 : 0.45);
  const cx = w * 0.5, cy = h * 0.5;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, v = field[i];
    if (v < 0.1) continue;
    const r = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
    const north = field[i - w] < 0.1, south = field[i + w] < 0.1;
    const edge = north || south || field[i - 1] < 0.1 || field[i + 1] < 0.1;
    let ink = ENV_INK.shadow, alpha = 255;
    if (substrate === "fungal_mat") {
      const fold = (Math.floor(y * 0.65 + Math.sin(x * 0.16 + stage * 0.3) * (3 + stage) + Math.sin(y * 0.09) * 2 + Math.sin(phase - y * 0.08) * lift * 1.8) % 7 + 7) % 7;
      ink = fold <= 1 ? ENV_INK.seam : fold === 2 ? ENV_INK.ridge : fold < 5 ? ENV_INK.body : ENV_INK.shadow;
      if (north) ink = ENV_INK.ridge;
      if (south) ink = ENV_INK.seam;
      if (cluster(x, y, seed) === 3 && fold > 2 && fold < 5) ink = ENV_INK.shadow;
      if (stage > 0 && Math.abs(Math.sin(a * (3 + stage) + r * 0.08)) < 0.1 && fold === 2) ink = ENV_INK.teal;
    } else if (substrate === "oil_film") {
      const ribbon = Math.floor(y + Math.sin(x * 0.11 + stage * 0.4) * (2 + stage) + Math.sin(phase) * lift * 2) % 12;
      ink = ENV_INK.oil;
      if (north) ink = ENV_INK.oilRidge;
      else if (south) ink = ENV_INK.seam;
      else if (ribbon === 2 && cluster(x, y, seed) < 7) ink = ENV_INK.oilRidge;
      else if (ribbon === 3 && cluster(x, y, seed) < 4) ink = ENV_INK.body;
      if (stage > 0 && ribbon === 8 && Math.floor(x / 5) % 3 === 1) ink = ENV_INK.shadow;
      if (stage === 2 && ribbon === 9 && Math.floor(x / 4) % 5 === 0) ink = ENV_INK.teal;
    } else {
      const shear = Math.round(Math.sin(phase + y * 0.12) * lift * (1 + stage));
      const fold = (y + Math.floor(x / 8) * (stage + 1) + shear + 1e3) % 8;
      ink = fold === 0 ? ENV_INK.seam : fold < 3 ? ENV_INK.ash : fold < 5 ? ENV_INK.ashShadow : ENV_INK.shadow;
      if (north) ink = ENV_INK.ash;
      if (south) ink = ENV_INK.seam;
      if (cluster(x, y, seed) === 5 && fold > 2) ink = ENV_INK.ashShadow;
      if (stage > 0 && fold === 1 && Math.floor(x / 4) % 7 === 0) ink = ENV_INK.teal;
    }
    if (edge && cluster(x, y, seed) < 2) ink = ENV_INK.shadow;
    if (v >= 0.78) ink = activity > 0.35 ? ENV_INK.teal : ENV_INK.body;
    if (activity < 0.3 && ink === ENV_INK.teal) ink = ENV_INK.body;
    if (ink === ENV_INK.teal && inflated) ink = ENV_INK.lit;
    putPixel(out, w, h, x, y, ink, alpha);
  }
}

// src/generated/rift-fragment-data.ts
var RIFT_FRAGMENT_DATA = {
  "frag-outdoor": {
    id: "frag-outdoor",
    displayName: "\u6237\u5916\u571F\u58E4",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 4,
    jogAmp: 1,
    gapCount: 0,
    gapPlacement: "",
    turnCount: 0,
    turnCorner: "",
    capKind: "stub",
    facingPolicy: "random",
    join: "single",
    surfaceMaterial: "soil",
    enabled: true,
    floorBv: 26,
    floorBiasR: 0.88,
    floorBiasG: 1.02,
    floorBiasB: 0.82,
    stainKey: "frag-outdoor",
    stainThreshold: 0.72,
    stainStrength: 0.4,
    grimeAmp: 0.5,
    macroAmp: 0.32,
    scratchPer1000px2: 0.55,
    fleckPer1000px2: 1.25,
    scratchAngle: "free",
    scratchDispersion: 0,
    wallBv: 24,
    wallBiasR: 1,
    wallBiasG: 0.88,
    wallBiasB: 0.75,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 12,
    featureCountMax: 24
  },
  "frag-clinic": {
    id: "frag-clinic",
    displayName: "\u533B\u9662\u5B9E\u9A8C\u5BA4",
    coverage: "remnant",
    massGrammar: "enclosure",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "end",
    turnCount: 2,
    turnCorner: "right",
    capKind: "none",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "tile",
    enabled: true,
    floorBv: 28,
    floorBiasR: 0.86,
    floorBiasG: 0.92,
    floorBiasB: 1.08,
    stainKey: "shadow-grey",
    stainThreshold: 0.78,
    stainStrength: 0.25,
    grimeAmp: 0.28,
    macroAmp: 0.18,
    scratchPer1000px2: 0.7,
    fleckPer1000px2: 0.55,
    scratchAngle: "orthogonal",
    scratchDispersion: 0,
    wallBv: 30,
    wallBiasR: 0.82,
    wallBiasG: 0.9,
    wallBiasB: 1.05,
    featureWidthTiles: 1,
    featureLengthTiles: 5,
    featureCountMin: 14,
    featureCountMax: 22
  },
  "frag-metro": {
    id: "frag-metro",
    displayName: "\u5730\u94C1\u5DE5\u4E1A",
    coverage: "remnant",
    massGrammar: "slab",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "center",
    turnCount: 0,
    turnCorner: "",
    capKind: "pier",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "metal",
    enabled: true,
    floorBv: 24,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "brick-dark",
    stainThreshold: 0.68,
    stainStrength: 0.35,
    grimeAmp: 0.42,
    macroAmp: 0.28,
    scratchPer1000px2: 0.45,
    fleckPer1000px2: 0.9,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.15,
    wallBv: 26,
    wallBiasR: 1.1,
    wallBiasG: 0.82,
    wallBiasB: 0.68,
    featureWidthTiles: 2,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-library": {
    id: "frag-library",
    displayName: "\u65E7\u56FE\u4E66\u9986",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 6,
    jogAmp: 1,
    gapCount: 2,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "none",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "wood",
    enabled: true,
    floorBv: 26,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-library",
    stainThreshold: 0.6,
    stainStrength: 0.3,
    grimeAmp: 0.34,
    macroAmp: 0.2,
    scratchPer1000px2: 0.8,
    fleckPer1000px2: 0.7,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.35,
    wallBv: 24,
    wallBiasR: 1.02,
    wallBiasG: 0.93,
    wallBiasB: 0.68,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-residential": {
    id: "frag-residential",
    displayName: "\u5C45\u6C11\u533A\u516C\u5BD3",
    coverage: "remnant",
    massGrammar: "cluster",
    jogPeriod: 2,
    jogAmp: 1,
    gapCount: 3,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "widen",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "plaster",
    enabled: false,
    floorBv: 28,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-residential",
    stainThreshold: 0.7,
    stainStrength: 0.3,
    grimeAmp: 0.38,
    macroAmp: 0.24,
    scratchPer1000px2: 0.4,
    fleckPer1000px2: 0.4,
    scratchAngle: "orthogonal",
    scratchDispersion: 0.6,
    wallBv: 30,
    wallBiasR: 1.02,
    wallBiasG: 0.96,
    wallBiasB: 0.79,
    featureWidthTiles: 2,
    featureLengthTiles: 5,
    featureCountMin: 18,
    featureCountMax: 24
  }
};
var ENABLED_RIFT_FRAGMENTS = Object.values(RIFT_FRAGMENT_DATA).filter((row) => row.enabled);

// src/generation/atmosphere.ts
function at(cols, col, row) {
  return row * cols + col;
}
function hash01(col, row, salt) {
  let h = col * 374761393 + row * 668265263 + salt * 2147483647 | 0;
  h = Math.imul(h ^ h >> 13, 1274126177) | 0;
  return ((h ^ h >> 16) >>> 0) / 4294967296;
}
function exteriorVoidMask(land, cols, rows) {
  const ext = new Uint8Array(land.length);
  const stack = [];
  const mark = (i) => {
    if (i < 0 || i >= land.length || land[i] || ext[i]) return;
    ext[i] = 1;
    stack.push(i);
  };
  for (let col = 0; col < cols; col++) {
    mark(at(cols, col, 0));
    mark(at(cols, col, rows - 1));
  }
  for (let row = 0; row < rows; row++) {
    mark(at(cols, 0, row));
    mark(at(cols, cols - 1, row));
  }
  while (stack.length > 0) {
    const i = stack.pop();
    const col = i % cols;
    const row = i / cols | 0;
    if (col > 0) mark(i - 1);
    if (col < cols - 1) mark(i + 1);
    if (row > 0) mark(i - cols);
    if (row < rows - 1) mark(i + cols);
  }
  return ext;
}
function distField(source, cols, rows) {
  const inf = cols + rows + 1;
  const dist = new Float32Array(source.length);
  dist.fill(inf);
  const q = [];
  for (let i = 0; i < source.length; i++) {
    if (!source[i]) continue;
    dist[i] = 0;
    q.push(i);
  }
  let head = 0;
  while (head < q.length) {
    const i = q[head++];
    const col = i % cols;
    const row = i / cols | 0;
    const nd = dist[i] + 1;
    const push = (j) => {
      if (nd < dist[j]) {
        dist[j] = nd;
        q.push(j);
      }
    };
    if (col > 0) push(i - 1);
    if (col < cols - 1) push(i + 1);
    if (row > 0) push(i - cols);
    if (row < rows - 1) push(i + cols);
  }
  return dist;
}
function sampleScalar(field, cols, rows, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const g = (c, r) => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return 0;
    return field[r * cols + c];
  };
  return g(x0, y0) * (1 - tx) * (1 - ty) + g(x0 + 1, y0) * tx * (1 - ty) + g(x0, y0 + 1) * (1 - tx) * ty + g(x0 + 1, y0 + 1) * tx * ty;
}
function buildOccluders(spec, cols, rows, windX, windY, rng) {
  if (spec.skyShadow <= 0.04) return [];
  const restCx = cols * 0.5;
  const restCy = rows * 0.5;
  const occluders = [
    {
      restCx,
      restCy,
      ux: windX,
      uy: windY,
      length: 8 + spec.skyShadow * 10,
      halfWidth: 1.5 + spec.skyShadow * 2.6,
      softness: 1.1 + spec.skyShadow * 1.3,
      strength: 0.4 + spec.skyShadow * 0.28,
      travel: 2 + spec.skyShadow * 3.8
    }
  ];
  if (spec.skyShadow > 0.48) {
    const perpX = -windY;
    const perpY = windX;
    const side = rng.next() < 0.5 ? -1 : 1;
    occluders.push({
      restCx: restCx - windX * (7 + spec.skyShadow * 4) + perpX * side * (2.2 + rng.next() * 2),
      restCy: restCy - windY * (7 + spec.skyShadow * 4) + perpY * side * (2.2 + rng.next() * 2),
      ux: windX,
      uy: windY,
      length: 3 + spec.skyShadow * 4.5,
      halfWidth: 0.9 + spec.skyShadow * 1.4,
      softness: 0.9 + spec.skyShadow * 0.6,
      strength: 0.2 + spec.skyShadow * 0.16,
      travel: 1.6 + spec.skyShadow * 2.4
    });
  }
  return occluders;
}
function blurFog(fog, cols, rows) {
  const next = new Float32Array(fog.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      let acc = fog[i] * 0.4;
      let w = 0.4;
      if (col > 0) {
        acc += fog[i - 1] * 0.15;
        w += 0.15;
      }
      if (col < cols - 1) {
        acc += fog[i + 1] * 0.15;
        w += 0.15;
      }
      if (row > 0) {
        acc += fog[i - cols] * 0.15;
        w += 0.15;
      }
      if (row < rows - 1) {
        acc += fog[i + cols] * 0.15;
        w += 0.15;
      }
      next[i] = acc / w;
    }
  }
  fog.set(next);
}
function advectFog(fog, cols, rows, windX, windY) {
  const src = new Float32Array(fog);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      const sampled = sampleScalar(src, cols, rows, col - windX * 1.5, row - windY * 1.5);
      fog[i] = fog[i] * 0.62 + sampled * 0.38;
    }
  }
}
function buildAtmosphere(land, walls, cols, rows, spec, glitches, rng) {
  const phase = rng.next();
  const angle = rng.next() * Math.PI * 2;
  const windX = Math.cos(angle);
  const windY = Math.sin(angle);
  const slideSpan = Math.hypot(cols, rows) * 0.72;
  const occluders = buildOccluders(spec, cols, rows, windX, windY, rng);
  const exterior = exteriorVoidMask(land, cols, rows);
  const hollow = new Uint8Array(land.length);
  for (let i = 0; i < land.length; i++) {
    if (!land[i] && !exterior[i]) hollow[i] = 1;
  }
  const distExt = distField(exterior, cols, rows);
  const distHollow = distField(hollow, cols, rows);
  const distLand = distField(land, cols, rows);
  const distWall = distField(walls, cols, rows);
  const poolSum = spec.poolRim + spec.poolHollow + spec.poolOpen;
  const wRim = poolSum > 0 ? spec.poolRim / poolSum : 0.48;
  const wHollow = poolSum > 0 ? spec.poolHollow / poolSum : 0.34;
  const wOpen = poolSum > 0 ? spec.poolOpen / poolSum : 0.18;
  const fog = new Float32Array(land.length);
  const inf = cols + rows + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      const grain = 0.78 + 0.44 * hash01(col, row, 91);
      if (!land[i]) {
        if (hollow[i]) fog[i] = spec.fog * 0.95 * grain;
        else fog[i] = spec.fog * 0.8 * Math.max(0, 1 - distLand[i] / 3.5) * grain;
        continue;
      }
      const rim = Math.max(0, 1 - distExt[i] / 4);
      const pit = distHollow[i] >= inf - 1 ? 0 : Math.max(0, 1 - distHollow[i] / 3);
      const open = Math.min(1, Math.max(0, (distWall[i] - 1) / 3.5));
      let v = spec.fog * (wRim * rim + wHollow * pit + wOpen * open) * grain;
      if (walls[i]) v *= 0.28;
      fog[i] = v;
    }
  }
  if (spec.seep > 0) {
    for (const g of glitches) {
      const i = at(cols, g.col, g.row);
      if (i < 0 || i >= fog.length) continue;
      fog[i] = Math.min(1, fog[i] + spec.seep * 0.18);
    }
  }
  blurFog(fog, cols, rows);
  blurFog(fog, cols, rows);
  advectFog(fog, cols, rows, windX, windY);
  const motes = [];
  const floors = [];
  let weightSum = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (!land[i] || walls[i]) continue;
      const w = fog[i] * fog[i];
      floors.push({ col, row, fog: fog[i] });
      weightSum += w;
    }
  }
  const want = spec.motes;
  if (floors.length > 0 && weightSum > 0) {
    let guard = 0;
    while (motes.length < want && guard++ < want * 12) {
      let pick = rng.next() * weightSum;
      let cell = floors[0];
      for (const f of floors) {
        pick -= f.fog * f.fog;
        if (pick <= 0) {
          cell = f;
          break;
        }
      }
      const drift = 0.15 + rng.next() * 0.55;
      motes.push({
        kind: "mote",
        col: cell.col + 0.5 + windX * drift,
        row: cell.row + 0.5 + windY * drift,
        radiusTiles: 0.1 + cell.fog * 0.1,
        strength: 0.36 + rng.next() * 0.38 + cell.fog * 0.24
      });
    }
  }
  if (spec.seep > 0) {
    for (const g of glitches) {
      motes.push({
        kind: "glow",
        col: g.col + 0.5,
        row: g.row + 0.5,
        radiusTiles: 0.9 + spec.seep * 1.2,
        strength: 0.18 + spec.seep * 0.5
      });
    }
  }
  return { phase, slideSpan, windX, windY, occluders, fog, motes };
}

// src/utils/random.ts
var SeededRandom = class {
  constructor(seed) {
    __publicField(this, "state");
    this.state = seed;
  }
  /**
   * Get next random float in [0, 1).
   */
  next() {
    this.state |= 0;
    this.state = this.state + 1831565813 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /**
   * Standard normal N(0, 1) via Box-Muller. Consumes two next() samples.
   */
  nextGaussian() {
    const u1 = Math.max(1e-12, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
  }
  /**
   * Get random integer in [min, max] (inclusive).
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  /**
   * Get random float in [min, max).
   */
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }
  /**
   * Pick a random element from an array.
   */
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }
  /**
   * Shuffle an array in place (Fisher-Yates).
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
};

// src/generation/seed-fork.ts
function mix32(seed, label) {
  let h = seed >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 2654435769);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2146121005);
  h ^= h >>> 15;
  return h >>> 0;
}
function forkMapRngs(seed, recipeId, attempt = 0) {
  return {
    outlineSeed: seed >>> 0,
    structureRng: new SeededRandom(mix32(seed, `structure:${recipeId}:${attempt}`)),
    coverRng: new SeededRandom(mix32(seed, `cover:${recipeId}:${attempt}`)),
    densityRng: new SeededRandom(mix32(seed, `density:${recipeId}:${attempt}`)),
    scatterRng: new SeededRandom(mix32(seed, `scatter:${recipeId}`)),
    atmosphereRng: new SeededRandom(mix32(seed, `atmosphere:${recipeId}`))
  };
}

// src/generation/fragment-roll.ts
var CONTAMINATION_AGES = ["new", "standard", "ancient"];
var RUIN_SEVERITIES = ["intact", "broken", "eaten"];
function rollFragmentAxes(seed) {
  const rng = new SeededRandom(mix32(seed, "fragment-roll"));
  return {
    contaminationAge: CONTAMINATION_AGES[rng.nextInt(0, CONTAMINATION_AGES.length - 1)],
    ruinSeverity: RUIN_SEVERITIES[rng.nextInt(0, RUIN_SEVERITIES.length - 1)]
  };
}

// src/generation/palette-quantize.ts
var PALETTE_HEX = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE = PALETTE_HEX.map(hexToRgb);
var TEAL_FAMILY_HEX = [
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#b0fff5",
  "#4adf8a",
  "#1a7a9a"
];
var TEAL_FAMILY = TEAL_FAMILY_HEX.map(hexToRgb);
var TEAL_FAMILY_SET = new Set(TEAL_FAMILY_HEX);
var TEAL_SUBSET_DEEP_MID_HEX = ["#0e4a3f", "#1a6b5c", "#1a7a9a"];
var TEAL_SUBSET_CORE_HEX = ["#1aad96"];
var TEAL_SUBSET_GLOW_HEX = ["#2ae6c8"];
var TEAL_SUBSET_DEEP_MID = TEAL_SUBSET_DEEP_MID_HEX.map(hexToRgb);
var TEAL_SUBSET_CORE = TEAL_SUBSET_CORE_HEX.map(hexToRgb);
var TEAL_SUBSET_GLOW = TEAL_SUBSET_GLOW_HEX.map(hexToRgb);
var L3_WARM_HEX = ["#8a5c2a", "#c4873a"];
var L4_GLOW_HEX = ["#e0a848"];
var UI_HEX = ["#8a8f96", "#c8cdd4", "#2a2d32", "#0f1114"];
var DANGER_HEX = ["#cc3333"];
var WARNING_HEX = ["#b89040"];
var DEBRIS_HEX = ["#50463c", "#5d483e", "#4f4835"];
var DEBRIS_HEX_SET = new Set(DEBRIS_HEX);
var L1_EXCLUDED_HEX = /* @__PURE__ */ new Set([
  ...TEAL_FAMILY_HEX,
  ...L3_WARM_HEX,
  ...L4_GLOW_HEX,
  ...UI_HEX,
  ...DANGER_HEX,
  ...WARNING_HEX
]);
var L1_MEAN_MAX = 55;
var CHROMA_TIE_EPS = 1e-9;
function hexToRgb(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function meanRgb(rgb) {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}
function sameRgb(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function rgbDist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}
function chromaDir(rgb) {
  const m = Math.max(1e-6, meanRgb(rgb));
  return [rgb[0] / m, rgb[1] / m, rgb[2] / m];
}
function chromaDist2(a, b) {
  const da = chromaDir(a);
  const db = chromaDir(b);
  return (da[0] - db[0]) ** 2 + (da[1] - db[1]) ** 2 + (da[2] - db[2]) ** 2;
}
function temperatureGroup(r, g, b) {
  if (r - b >= 6) return "WARM";
  if (b - r >= 6) return "COOL";
  if (g >= r + 2 && g >= b + 2) return "OLIVE";
  return "NEUTRAL";
}
function buildL1Pools() {
  const pools = {
    WARM: [],
    COOL: [],
    OLIVE: [],
    NEUTRAL: []
  };
  for (let i = 0; i < PALETTE_HEX.length; i++) {
    const hex = PALETTE_HEX[i];
    if (L1_EXCLUDED_HEX.has(hex)) continue;
    const rgb = PALETTE[i];
    if (meanRgb(rgb) > L1_MEAN_MAX) continue;
    pools[temperatureGroup(rgb[0], rgb[1], rgb[2])].push(rgb);
  }
  return pools;
}
var L1_POOL_MUTABLE = buildL1Pools();
var L1_POOL = {
  WARM: L1_POOL_MUTABLE.WARM,
  COOL: L1_POOL_MUTABLE.COOL,
  OLIVE: L1_POOL_MUTABLE.OLIVE,
  NEUTRAL: L1_POOL_MUTABLE.NEUTRAL
};
function pickByChroma(target, candidates) {
  let best = candidates[0];
  let bestChroma = Infinity;
  let bestRgb = Infinity;
  for (const c of candidates) {
    const chroma = chromaDist2(c, target);
    const rgbD = rgbDist2(c, target);
    if (chroma < bestChroma - CHROMA_TIE_EPS) {
      best = c;
      bestChroma = chroma;
      bestRgb = rgbD;
    } else if (Math.abs(chroma - bestChroma) <= CHROMA_TIE_EPS && rgbD < bestRgb) {
      best = c;
      bestRgb = rgbD;
    }
  }
  return best;
}
function unused(candidates, used) {
  return candidates.filter((c) => !used.some((u) => sameRgb(u, c)));
}
function quantizeInGroup(targetRgb, subset, used = []) {
  const remaining = unused(subset, used);
  if (remaining.length > 0) {
    return pickByChroma(targetRgb, remaining);
  }
  console.warn(
    "[palette-quantize] candidate pool empty after used-filter; falling back to NEUTRAL L1 pool"
  );
  const neutralFree = unused(L1_POOL.NEUTRAL, used);
  if (neutralFree.length > 0) {
    return pickByChroma(targetRgb, neutralFree);
  }
  console.warn(
    "[palette-quantize] NEUTRAL L1 pool also exhausted; returning a NEUTRAL cell, not full-palette nearest"
  );
  const neutral = L1_POOL.NEUTRAL;
  if (neutral.length > 0) {
    return pickByChroma(targetRgb, neutral);
  }
  return PALETTE[0];
}

// src/generation/preview-paint.ts
var PALETTE_HEX2 = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE2 = PALETTE_HEX2.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16)
]);
var PALETTE_WITHOUT_DEBRIS = PALETTE2.filter(
  (_rgb, i) => !DEBRIS_HEX_SET.has(PALETTE_HEX2[i])
);
var PALETTE_HEX_SET = new Set(PALETTE_HEX2.map((h) => h.toLowerCase()));
function clamp255(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}
var CLUSTER_TEAL_RGB = [
  ...TEAL_SUBSET_DEEP_MID,
  ...TEAL_SUBSET_CORE,
  ...TEAL_SUBSET_GLOW
];
function clamp01(n) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === rn) h = (gn - bn) / d % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max < 1e-6 ? 0 : d / max, v: max };
}
function hsvToRgb(h, s, v) {
  const hh = (h % 1 + 1) % 1;
  const c = v * s;
  const x = c * (1 - Math.abs(hh * 6 % 2 - 1));
  const m = v - c;
  const i = hh * 6 | 0;
  let r = 0;
  let g = 0;
  let b = 0;
  if (i === 0) {
    r = c;
    g = x;
  } else if (i === 1) {
    r = x;
    g = c;
  } else if (i === 2) {
    g = c;
    b = x;
  } else if (i === 3) {
    g = x;
    b = c;
  } else if (i === 4) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function toRgb(t) {
  return [clamp255(t[0]), clamp255(t[1]), clamp255(t[2])];
}
function clampHueWindow(h) {
  return h < 0.42 ? 0.42 : h > 0.56 ? 0.56 : h;
}
function deriveContamRamp(def, age, seed) {
  const floorRgb = [
    clamp255(def.floorBv * def.floorBiasR),
    clamp255(def.floorBv * def.floorBiasG),
    clamp255(def.floorBv * def.floorBiasB)
  ];
  const fh = rgbToHsv(floorRgb[0], floorRgb[1], floorRgb[2]);
  const wh = rgbToHsv(def.wallBv * def.wallBiasR, def.wallBv * def.wallBiasG, def.wallBv * def.wallBiasB);
  const mapHue = fh.s < 0.06 && wh.s < 0.06 ? 0.48 : fh.s >= wh.s ? fh.h : wh.h;
  const mapV = fh.v * 0.6 + wh.v * 0.4;
  const mapS = fh.s > wh.s ? fh.s : wh.s;
  const rng = new SeededRandom(mix32(seed, "contam-ramp"));
  const ageShift = age === "new" ? -0.07 : age === "ancient" ? 0.08 : 0;
  const hue = clampHueWindow(0.48 + (mapHue - 0.48) * 0.52 + ageShift + (rng.next() - 0.5) * 0.05);
  const sat = clamp01(0.5 + mapS * 0.38 + (age === "ancient" ? 0.08 : 0) + (rng.next() - 0.5) * 0.05);
  const val = clamp01(Math.max(0.36, mapV + 0.18) + (rng.next() - 0.5) * 0.04);
  const deepRgb = toRgb(hsvToRgb(hue, sat * 0.82, val * 0.68));
  const midRgb = toRgb(hsvToRgb(hue, sat, val * 0.95));
  const coreRgb = toRgb(hsvToRgb(hue, sat * 0.78, clamp01(val * 1.2)));
  const glowRgb = toRgb(hsvToRgb(hue, sat * 0.46, clamp01(val * 1.42)));
  const deep = quantizeInGroup(deepRgb, TEAL_SUBSET_DEEP_MID, []);
  const mid = quantizeInGroup(midRgb, TEAL_SUBSET_DEEP_MID, [deep]);
  const core = quantizeInGroup(coreRgb, TEAL_SUBSET_CORE, [deep, mid]);
  const glow = quantizeInGroup(glowRgb, TEAL_SUBSET_GLOW, [deep, mid, core]);
  return { deep, mid, core, glow };
}

// src/entities/form-renderers/d/fragment-ramp.ts
var LEXICON_DEFAULT_FRAGMENT = "frag-clinic";
function fragmentDef(fragmentTypeId) {
  return RIFT_FRAGMENT_DATA[fragmentTypeId] ?? RIFT_FRAGMENT_DATA[LEXICON_DEFAULT_FRAGMENT];
}
function deriveFragmentContamRamp(fragmentTypeId) {
  const def = fragmentDef(fragmentTypeId);
  const seed = mix32(0, `gym-frag-ramp:${def.id}`);
  return deriveContamRamp(def, "standard", seed);
}

// src/entities/form-renderers/d/paint-genome/topology.ts
var OIL_FILM_ID = "oil_film";
function oilFilmProductionVeinVariant(seed) {
  return mix32(seed, "oil_film_variant") % 3 + 3;
}
function resolvePaintVeinVariant(substrate, seed, explicit) {
  if (explicit !== void 0) return explicit;
  if (substrate === OIL_FILM_ID) return oilFilmProductionVeinVariant(seed);
  return void 0;
}
var STAGE = {
  infiltrate: 0,
  rewrite: 1,
  overwrite: 2
};
var PaintRng = class {
  constructor(seed, label) {
    __publicField(this, "s");
    this.s = mix32(seed, label) | 1;
  }
  next() {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  int(lo, hi) {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
};
function topologyOf(substrate) {
  if (substrate === "oil_film") return "vein_tree";
  if (substrate === "ash_veil") return "holed_veil";
  return "lobe_mass";
}
function makePaintField(w, h, logicalSpan) {
  return { v: new Float32Array(w * h), w, h, ...logicalSpan === void 0 ? {} : { logicalSpan } };
}
function authoredSpan(field) {
  return field.logicalSpan ?? Math.min(field.w, field.h);
}
function add(f, x, y, amt) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= f.w || iy >= f.h) return;
  const i = iy * f.w + ix;
  if (amt > f.v[i]) f.v[i] = amt;
}
function disc(f, cx, cy, r, amt) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > r2) continue;
      add(f, x, y, amt * (1 - Math.sqrt(d2) / (r + 1e-3)) + amt * 0.2);
    }
  }
}
function dot(f, cx, cy, r, amt) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      add(f, x, y, amt);
    }
  }
}
function dotFlat(f, cx, cy, ang, radAlong, radPerp, amt) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pad = Math.max(radAlong, radPerp) + 1;
  const a2 = radAlong * radAlong;
  const p2 = radPerp * radPerp;
  for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
    for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const along = dx * c + dy * s;
      const perp = -dx * s + dy * c;
      if (along * along / a2 + perp * perp / p2 > 1) continue;
      add(f, x, y, amt);
    }
  }
}
function carveDisc(f, cx, cy, r) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) f.v[y * f.w + x] = 0;
    }
  }
}
function radialCrack(f, cx, cy, ang, r0, r1, halfW) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pad = r1 + halfW + 1;
  for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
    for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      const dx = x - cx;
      const dy = y - cy;
      const along = dx * c + dy * s;
      const perp = -dx * s + dy * c;
      if (along < r0 || along > r1) continue;
      if (Math.abs(perp) > halfW) continue;
      f.v[y * f.w + x] = 0;
    }
  }
}
function stroke(f, x0, y0, x1, y1, r, amt) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    dot(f, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, amt);
  }
}
function senseAngleOf(sense) {
  if (sense === "sense_scent") return Math.PI * 2 / 3;
  if (sense === "sense_domain") return Math.PI * 4 / 3;
  if (sense === "sense_hear") return Math.PI / 2;
  if (sense === "sense_narrow") return 0.18;
  if (sense === "sense_reverse") return Math.PI;
  if (sense === "sense_cone") return -Math.PI / 2;
  return 0;
}
function rhythmKnobsOf(rhythm) {
  if (rhythm === "rhythm_pulse") {
    return { lobeExtra: 3, lobeAmp: 0.4, branchMul: 1.35, zigzag: 0.78, veilHoles: 2, veilWarp: 0.3 };
  }
  if (rhythm === "rhythm_sleep") {
    return { lobeExtra: -1, lobeAmp: 0.14, branchMul: 0.62, zigzag: 0.16, veilHoles: 0, veilWarp: 0.08 };
  }
  if (rhythm === "rhythm_cluster") {
    return { lobeExtra: 1, lobeAmp: 0.28, branchMul: 1.08, zigzag: 0.42, veilHoles: 1, veilWarp: 0.2 };
  }
  return { lobeExtra: 0, lobeAmp: 0.22, branchMul: 1, zigzag: 0.3, veilHoles: 0, veilWarp: 0.14 };
}
function placementsOf(f, continuity, topo, senseAng, rng) {
  const cx = f.w / 2;
  const cy = f.h / 2;
  const span = authoredSpan(f);
  const tree = topo === "vein_tree";
  if (continuity === "monolith") {
    return [{ cx, cy, scale: 1 }];
  }
  if (continuity === "shards") {
    const n = 3 + rng.int(0, 1);
    const out2 = [];
    for (let i = 0; i < n; i++) {
      const a = senseAng + i / n * Math.PI * 2 + (rng.next() - 0.5) * 0.35;
      const d = span * (0.3 + rng.next() * 0.06);
      out2.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: 0.3 + rng.next() * 0.05
      });
    }
    return out2;
  }
  if (continuity === "field") {
    const out2 = [{ cx, cy, scale: 1.18 }];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = senseAng + i / n * Math.PI * 2 + rng.next() * 0.25;
      const d = span * (0.4 + rng.next() * 0.05);
      out2.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: 0.4 + rng.next() * 0.05
      });
    }
    return out2;
  }
  const nSat = 3;
  const out = [{ cx, cy, scale: tree ? 0.5 : 0.8 }];
  const satScale = tree ? 0.48 : 0.36;
  for (let i = 0; i < nSat; i++) {
    const a = senseAng + (i + 1) / (nSat + 1) * Math.PI * 2 + (rng.next() - 0.5) * 0.1;
    const d = span * 0.46;
    out.push({
      cx: cx + Math.cos(a) * d,
      cy: cy + Math.sin(a) * d,
      scale: satScale
    });
  }
  return out;
}
function lobeMass(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const R = Math.max(7, authoredSpan(f) * 0.33 * scale);
  const lobes = Math.max(3, 4 + knobs.lobeExtra);
  const amp = knobs.lobeAmp;
  const phi = senseAng;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const bound = R * (1 + amp * Math.cos(lobes * a + phi));
      if (d > bound) continue;
      add(f, x, y, 1 - d / bound * 0.45);
    }
  }
  if (stage < 1) return;
  const kids = stage === 1 ? 5 : 6;
  for (let i = 0; i < kids; i++) {
    const a = senseAng + i / kids * Math.PI * 2 + rng.next() * 0.18;
    const push = 1.34 + rng.next() * 0.28;
    disc(f, cx + Math.cos(a) * R * push, cy + Math.sin(a) * R * push, R * (0.3 + rng.next() * 0.1), 0.96);
  }
  const notchA = senseAng + Math.PI * 0.55;
  carveDisc(f, cx + Math.cos(notchA) * R * 1.02, cy + Math.sin(notchA) * R * 1.02, R * 0.42);
  if (stage < 2) return;
  radialCrack(f, cx, cy, senseAng + 0.4, R * 0.48, R * 1.4, Math.max(3.2, 3.8 * scale));
  radialCrack(f, cx, cy, senseAng + 1.85, R * 0.48, R * 1.35, Math.max(2.8, 3.4 * scale));
  radialCrack(f, cx, cy, senseAng + 3.3, R * 0.55, R * 1.25, Math.max(2.4, 3 * scale));
}
function veinTree(f, rng, stage, cx, cy, scale, senseAng, knobs, variant) {
  if (variant === 0) {
    veinTreeFlat(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 2) {
    veinTreeConverge(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 3) {
    oilFilmBeads(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 4) {
    oilFilmSmear(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 5) {
    oilFilmRimPool(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  const thick = Math.max(0.85, 1.2 * scale);
  const loopR = Math.max(1.9, 2.15 * scale);
  const baseLen = authoredSpan(f) * 0.34 * scale;
  const maxDepth = 2 + stage;
  const zigzag = knobs.zigzag;
  const ends = [];
  const walk = (x, y, ang, len, t, depth) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(5, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const rad = Math.max(0.65, t * (1 - s / (steps * 1.9)));
      dot(f, px, py, rad, 0.9);
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    let kids = depth === 0 ? stage >= 1 ? 4 : 2 : stage >= 1 ? 2 : 1;
    kids = Math.max(1, Math.round(kids * knobs.branchMul));
    if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
    const spread = 0.95 + stage * 0.4;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.28;
      walk(px, py, fork, len * (0.55 + rng.next() * 0.18), t * 0.74, depth + 1);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0);
  if (stage >= 1) {
    const side = senseAng + (rng.next() < 0.5 ? 1.25 : -1.25);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.28,
      cy + Math.sin(senseAng) * baseLen * 0.28,
      side,
      baseLen * 0.85,
      thick * 0.82,
      0
    );
  }
  if (stage < 2 || ends.length < 2) return;
  const pairs = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y);
      if (d < 8 || d > 26) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const used = /* @__PURE__ */ new Set();
  let loops = 0;
  for (const p of pairs) {
    if (loops >= 2) break;
    if (used.has(p.i) || used.has(p.j)) continue;
    used.add(p.i);
    used.add(p.j);
    stroke(f, ends[p.i].x, ends[p.i].y, ends[p.j].x, ends[p.j].y, loopR, 0.9);
    loops += 1;
  }
}
function veinTreeFlat(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const thick = Math.max(0.95, 1.15 * scale);
  const loopR = Math.max(1.1, 1.25 * scale);
  const baseLen = authoredSpan(f) * 0.36 * scale;
  const maxDepth = 2 + stage;
  const zigzag = knobs.zigzag * 0.18;
  const ends = [];
  const walk = (x, y, ang, len, t, depth) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(6, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const fade = 1 - s / (steps * 1.55);
      const radAlong = Math.max(1.2, t * 1.9 * fade);
      const radPerp = Math.max(0.28, t * 0.36 * fade);
      dotFlat(f, px, py, a, radAlong, radPerp, 0.9);
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    let kids = depth === 0 ? stage >= 1 ? 3 : 2 : stage >= 1 ? 2 : 1;
    kids = Math.max(1, Math.round(kids * knobs.branchMul * 0.85));
    if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
    const spread = 0.7 + stage * 0.28;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.12;
      walk(px, py, fork, len * (0.58 + rng.next() * 0.12), t * 0.7, depth + 1);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0);
  if (stage >= 1) {
    const side = senseAng + (rng.next() < 0.5 ? 0.85 : -0.85);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.22,
      cy + Math.sin(senseAng) * baseLen * 0.22,
      side,
      baseLen * 0.72,
      thick * 0.7,
      0
    );
  }
  if (stage < 2 || ends.length < 2) return;
  const pairs = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y);
      if (d < 10 || d > 22) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((left, right) => left.d - right.d);
  const used = /* @__PURE__ */ new Set();
  let loops = 0;
  for (const p of pairs) {
    if (loops >= 1) break;
    if (used.has(p.i) || used.has(p.j)) continue;
    used.add(p.i);
    used.add(p.j);
    const ang = Math.atan2(ends[p.j].y - ends[p.i].y, ends[p.j].x - ends[p.i].x);
    const steps = Math.max(1, Math.ceil(p.d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      dotFlat(
        f,
        ends[p.i].x + (ends[p.j].x - ends[p.i].x) * t,
        ends[p.i].y + (ends[p.j].y - ends[p.i].y) * t,
        ang,
        loopR * 1.4,
        loopR * 0.35,
        0.88
      );
    }
    loops += 1;
  }
}
function veinTreeConverge(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const thick = Math.max(1.05, 1.4 * scale);
  const baseLen = authoredSpan(f) * 0.38 * scale;
  const maxDepth = 1 + (stage >= 1 ? 1 : 0);
  const zigzag = knobs.zigzag * 0.28;
  const trunk = [];
  const ends = [];
  const walk = (x, y, ang, len, t, depth, recordTrunk) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(6, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const rad = Math.max(0.75, t * (1 - s / (steps * 2.6)));
      dot(f, px, py, rad, 0.9);
      if (recordTrunk) trunk.push({ x: px, y: py });
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    const kids = depth === 0 ? 2 : 1;
    const spread = 0.48 + stage * 0.12;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.1;
      walk(px, py, fork, len * (0.6 + rng.next() * 0.08), t * 0.58, depth + 1, false);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0, true);
  if (stage >= 2 && knobs.branchMul > 0.9) {
    const side = senseAng + (rng.next() < 0.5 ? 0.55 : -0.55);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.18,
      cy + Math.sin(senseAng) * baseLen * 0.18,
      side,
      baseLen * 0.55,
      thick * 0.62,
      1,
      false
    );
  }
  for (const end of ends) {
    let bestX = trunk[0]?.x ?? cx;
    let bestY = trunk[0]?.y ?? cy;
    let bestD = Infinity;
    for (const p of trunk) {
      const d = Math.hypot(end.x - p.x, end.y - p.y);
      if (d < bestD) {
        bestD = d;
        bestX = p.x;
        bestY = p.y;
      }
    }
    if (bestD > 5 && bestD < 30) {
      stroke(f, end.x, end.y, bestX, bestY, Math.max(0.65, thick * 0.42), 0.86);
    }
  }
}
function oilFilmBeads(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.35;
  const merge = stage >= 2 ? 1.32 : 1;
  const beads = [];
  const rMain = Math.max(5.5, span * 0.16 * s) * merge;
  beads.push({ x: cx, y: cy, r: rMain, fine: false });
  const rMed = Math.max(2.4, span * 0.055 * s) * merge;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const a = senseAng + side * (0.65 + rng.next() * 0.45) + (rng.next() - 0.5) * 0.28 * (0.6 + knobs.zigzag);
    const d = rMain * (0.95 + rng.next() * 0.2);
    beads.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: rMed,
      fine: false
    });
  }
  const nFine = 4 + stage;
  const dFineMin = rMain * 1.3;
  const dFineMax = span * 0.34 * s;
  for (let i = 0; i < nFine; i++) {
    const a = senseAng + ((i + 0.5) / nFine - 0.5) * 2.1 + (rng.next() - 0.5) * 0.55;
    const spanD = Math.max(0, dFineMax - dFineMin);
    const d = dFineMin + rng.next() * spanD;
    if (d < rMain) continue;
    beads.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: Math.max(1.05, span * 0.018 * s) * merge,
      fine: true
    });
  }
  const sum = new Float32Array(f.w * f.h);
  for (const b of beads) {
    const reach = b.r * 2.2;
    const pad = reach + 1;
    for (let y = Math.floor(b.y - pad); y <= b.y + pad; y++) {
      for (let x = Math.floor(b.x - pad); x <= b.x + pad; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const t = 1 - Math.hypot(x - b.x, y - b.y) / reach;
        if (t <= 0) continue;
        sum[y * f.w + x] = sum[y * f.w + x] + t * t;
      }
    }
  }
  for (let i = 0; i < sum.length; i++) {
    const field = sum[i];
    const x = i % f.w;
    const y = i / f.w | 0;
    if (field >= 0.62) add(f, x, y, 0.9);
    else if (field >= 0.4) add(f, x, y, 0.66);
    else if (field >= 0.26) add(f, x, y, 0.3);
  }
  for (const b of beads) {
    if (b.fine) {
      dot(f, b.x, b.y, b.r, 1.38);
    } else if (b.r >= 2.2) {
      disc(f, b.x, b.y, b.r * 0.35, 1.45);
    }
  }
  if (stage < 2 || beads.length < 3) return;
  const pool = beads[0];
  const far = beads.slice(1).map((b, i) => ({ b, i, d: Math.hypot(b.x - pool.x, b.y - pool.y) })).sort((left, right) => right.d - left.d).slice(0, 2);
  for (const g of far) {
    if (g.d < 6 || g.d > 30) continue;
    stroke(f, pool.x, pool.y, g.b.x, g.b.y, Math.max(0.9, 1.1 * s), 0.66);
  }
}
function oilFilmSmear(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.6;
  const strokes = 1 + stage;
  for (let i = 0; i < strokes; i++) {
    const side = i > 0;
    const baseA = senseAng + (i - (strokes - 1) / 2) * (0.5 + knobs.zigzag * 0.4) + (rng.next() - 0.5) * 0.2;
    const len = span * (0.5 + rng.next() * 0.08) * s * (side ? 0.72 : 1);
    const curl = (rng.next() - 0.5) * 0.9;
    const wHead = Math.max(4.4, 6.8 * s) * (side ? 0.48 : 1);
    const wTail = Math.max(0.55, 0.8 * s);
    const amtMul = side ? 0.55 : 1;
    let px = cx - Math.cos(baseA) * len * 0.42;
    let py = cy - Math.sin(baseA) * len * 0.42;
    const steps = Math.max(8, Math.round(len));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const a = baseA + curl * t;
      px += Math.cos(a);
      py += Math.sin(a);
      const w = wHead + (wTail - wHead) * t;
      const amt = 1.42 * (1 - t * 0.62) * amtMul;
      disc(f, px, py, w * 2.6, 0.4);
      disc(f, px, py, w, amt);
    }
  }
}
function oilFilmRimPool(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.35;
  const blobs = 1 + (stage >= 2 ? 1 : 0);
  const at14 = (x, y) => x < 0 || y < 0 || x >= f.w || y >= f.h ? 0 : f.v[y * f.w + x];
  for (let b = 0; b < blobs; b++) {
    const ba = senseAng + b * 1.9 + (rng.next() - 0.5) * 0.4;
    const bd = b === 0 ? 0 : span * 0.2 * scale;
    const bx = cx + Math.cos(ba) * bd;
    const by = cy + Math.sin(ba) * bd;
    const R = Math.max(8, span * (0.28 + stage * 0.03) * s);
    const h1 = rng.next() * Math.PI * 2;
    const h2 = rng.next() * Math.PI * 2;
    const a1 = 0.08 + knobs.veilWarp * 0.4 + rng.next() * 0.04;
    const a2 = 0.05 + rng.next() * 0.05;
    const pad = R * 1.35 + 1;
    const x0 = Math.floor(bx - pad);
    const x1 = Math.ceil(bx + pad);
    const y0 = Math.floor(by - pad);
    const y1 = Math.ceil(by + pad);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - bx, y - by);
        const ang = Math.atan2(y - by, x - bx);
        const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
        if (d > bound) continue;
        if (d > bound - 2.2 && d <= bound - 1) add(f, x, y, 0.48);
        else add(f, x, y, 0.34);
      }
    }
    const gathers = 1 + stage;
    for (let g = 0; g < gathers; g++) {
      const ga = rng.next() * Math.PI * 2;
      const gd = rng.next() * R * 0.45;
      disc(f, bx + Math.cos(ga) * gd, by + Math.sin(ga) * gd, Math.max(1.1, R * 0.12), 0.38);
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - bx, y - by);
        const ang = Math.atan2(y - by, x - bx);
        const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
        if (d > bound) continue;
        if (!(at14(x + 1, y) < 0.1 || at14(x - 1, y) < 0.1 || at14(x, y + 1) < 0.1 || at14(x, y - 1) < 0.1)) {
          continue;
        }
        const amt = 1.52 * (0.62 + 0.38 * (0.5 + 0.5 * Math.cos(ang - senseAng)));
        add(f, x, y, amt);
      }
    }
  }
}
function addEllipseRing(f, cx, cy, rx, ry, irx, iry, warp, k, phi, rot, amt, gapCount = 0, gapFrac = 0) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pad = Math.max(rx, ry) + 2;
  const x0 = Math.max(0, Math.floor(cx - pad));
  const x1 = Math.min(f.w - 1, Math.ceil(cx + pad));
  const y0 = Math.max(0, Math.floor(cy - pad));
  const y1 = Math.min(f.h - 1, Math.ceil(cy + pad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      const a = Math.atan2(ly, lx);
      if (gapCount > 0 && gapFrac > 0) {
        const t = ((a - phi) / (Math.PI * 2) + 8) % 1;
        const u = t * gapCount % 1;
        if (u < gapFrac) continue;
      }
      const bound = 1 + warp * Math.cos(k * a + phi);
      const outerD = Math.hypot(lx / rx, ly / ry);
      if (outerD > bound) continue;
      const innerD = Math.hypot(lx / Math.max(0.5, irx), ly / Math.max(0.5, iry));
      if (innerD < bound) continue;
      add(f, x, y, amt);
    }
  }
}
function holedVeil(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const grow = stage === 1 ? 1.28 : 1;
  const rx = Math.max(10, span * 0.42 * scale * grow);
  const ry = Math.max(8, span * (stage === 1 ? 0.24 : 0.3) * scale * (stage === 1 ? 1.08 : 1));
  const ringW = stage === 0 ? Math.max(3.8, 4.8 * scale) : Math.max(3.4, 3.9 * scale);
  const irx = Math.max(3, rx - ringW);
  const iry = Math.max(3, ry - ringW);
  const k = 3 + (knobs.lobeExtra > 1 ? 2 : 0);
  const gaps = stage === 1 ? 5 : 0;
  const gapFrac = stage === 1 ? 0.42 : 0;
  addEllipseRing(f, cx, cy, rx, ry, irx, iry, knobs.veilWarp, k, senseAng, senseAng, 0.9, gaps, gapFrac);
  if (stage >= 2 && scale >= 0.4) {
    const holes = 4 + knobs.veilHoles;
    const midRx = (rx + irx) * 0.5;
    const midRy = (ry + iry) * 0.5;
    for (let i = 0; i < holes; i++) {
      const a = senseAng + i / holes * Math.PI * 2 + rng.next() * 0.08;
      carveDisc(f, cx + Math.cos(a) * midRx, cy + Math.sin(a) * midRy, ringW * 1.35);
    }
  }
  if (stage < 2) return;
  const nrx = rx * 0.68;
  const nry = ry * 0.68;
  const nestedW = Math.max(3.2, 3.6 * scale);
  addEllipseRing(
    f,
    cx,
    cy,
    nrx,
    nry,
    Math.max(2, nrx - nestedW),
    Math.max(2, nry - nestedW),
    knobs.veilWarp * 0.55,
    k,
    senseAng + 0.5,
    senseAng,
    0.94
  );
}
function drawUnit(f, topo, rng, stage, p, senseAng, knobs, variant) {
  if (topo === "lobe_mass") lobeMass(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
  else if (topo === "vein_tree") veinTree(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs, variant);
  else holedVeil(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
}
function materialColony(f, p, seed, stage, ash) {
  const span = authoredSpan(f) * p.scale;
  const count = ash ? 4 + stage : 5 + stage * 2;
  const rng = new PaintRng(seed, ash ? "ash-lamina" : "fungal-shelves");
  for (let k = 0; k < count; k++) {
    const angle = rng.next() * Math.PI * 2;
    const cx = p.cx + Math.cos(angle) * span * 0.16, cy = p.cy + Math.sin(angle) * span * 0.12;
    const rx = span * (ash ? 0.25 : 0.17) * (1 + rng.next() * 0.3), ry = span * (ash ? 0.055 : 0.12) * (1 + rng.next() * 0.3);
    for (let y = Math.floor(cy - ry * 1.5); y <= cy + ry * 1.5; y++) for (let x = Math.floor(cx - rx * 1.3); x <= cx + rx * 1.3; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const warp = Math.sin(dx * 7 + k) * (0.08 + stage * 0.05) + Math.sin(dy * 5 + k) * 0.05;
      if (dx * dx + dy * dy > 1 + warp) continue;
      if (stage > 0 && Math.sin(dx * 5 + dy * 2 + k) > 0.91 && Math.abs(dx) > 0.4) continue;
      add(f, x, y, 0.55 + Math.max(0, 1 - dx * dx - dy * dy) * 0.4);
    }
  }
}
function fillPaintTopology(field, opts) {
  const topo = topologyOf(opts.substrate);
  const coverage = opts.coverage;
  const continuity = opts.continuity ?? "colony";
  const sense = opts.sense ?? "sense_touch";
  const rhythm = opts.rhythm ?? "rhythm_open";
  const veinTag = opts.veinVariant === void 0 ? "" : `:v${opts.veinVariant}`;
  const rng = new PaintRng(opts.seed, `paint:${topo}:${coverage}:${continuity}:${sense}:${rhythm}${veinTag}`);
  const senseAng = senseAngleOf(sense);
  const knobs = rhythmKnobsOf(rhythm);
  const stage = STAGE[coverage];
  const placements = placementsOf(field, continuity, topo, senseAng, rng);
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const unitRng = new PaintRng(
      mix32(opts.seed, `u:${i}`),
      `paint-unit:${topo}:${coverage}:${sense}:${rhythm}${veinTag}`
    );
    if (opts.substrate === "fungal_mat" || opts.substrate === "ash_veil")
      materialColony(field, p, mix32(opts.seed, `material:${i}`), stage, opts.substrate === "ash_veil");
    else drawUnit(field, topo, unitRng, stage, p, senseAng, knobs, opts.veinVariant);
  }
  return topo;
}

// src/entities/form-renderers/d/paint-genome/bake.ts
var PAINT_GROWTH_UNIT_CAP = 12;
var PAINT_INFLATED_AMP = 0.18;
function paintGenomeCanvasOf(continuity = "colony") {
  const field = continuity === "field";
  return { w: field ? 144 : 88, h: field ? 144 : 88 };
}
function collectPaintGenomeFloorTiles(field, w, h, originX, originY, tileSize) {
  const left = originX - w * 0.5;
  const top = originY - h * 0.5;
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (field[y * w + x] < 0.1) continue;
      const col = Math.floor((left + x + 0.5) / tileSize);
      const row = Math.floor((top + y + 0.5) / tileSize);
      const key = `${col},${row}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ col, row });
    }
  }
  return out;
}
function reserveBreathingFootprint(field, w, h, radius) {
  const horizontal = new Uint8Array(field.length);
  const result = new Float32Array(field.length);
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let x = -radius; x < w; x++) {
      const incoming = x + radius;
      if (incoming < w && field[y * w + incoming] >= 0.1) count++;
      const outgoing = x - radius - 1;
      if (outgoing >= 0 && field[y * w + outgoing] >= 0.1) count--;
      if (x >= 0) horizontal[y * w + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = -radius; y < h; y++) {
      const incoming = y + radius;
      if (incoming < h) count += horizontal[incoming * w + x];
      const outgoing = y - radius - 1;
      if (outgoing >= 0) count -= horizontal[outgoing * w + x];
      if (y >= 0 && count > 0) result[y * w + x] = 1;
    }
  }
  return result;
}
function topologyCanvas(req) {
  const continuity = req.continuity ?? "colony";
  const authored = paintGenomeCanvasOf(continuity);
  const options = {
    substrate: req.substrate,
    coverage: req.coverage,
    seed: req.seed,
    continuity,
    sense: req.sense ?? "sense_touch",
    rhythm: req.rhythm ?? "rhythm_open",
    veinVariant: req.veinVariant
  };
  if (req.geometryVersion === 1) {
    const field = makePaintField(authored.w, authored.h);
    return { field, topology: fillPaintTopology(field, options) };
  }
  let padding = Math.max(authored.w, authored.h);
  for (let attempt = 0; attempt < 4; attempt++, padding *= 2) {
    const field = makePaintField(
      authored.w + padding * 2,
      authored.h + padding * 2,
      Math.min(authored.w, authored.h)
    );
    const topology = fillPaintTopology(field, options);
    let minX = field.w, minY = field.h, maxX = -1, maxY = -1;
    for (let y = 0; y < field.h; y++) for (let x = 0; x < field.w; x++) {
      if (field.v[y * field.w + x] < 0.1) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const clearance2 = Math.ceil(Math.hypot(maxX - minX + 1, maxY - minY + 1) * PAINT_INFLATED_AMP) + 4;
    if (maxX < 0 || Math.min(minX, minY, field.w - 1 - maxX, field.h - 1 - maxY) >= clearance2)
      return { field, topology };
  }
  throw new Error(`[paint-genome] complete geometry exceeds bounded canvas: ${req.substrate}/${continuity}/${req.seed}`);
}
var CORE_TEALS = [
  [26, 173, 150],
  [42, 230, 200],
  [60, 255, 212]
];
function snapBright(rgb) {
  let best = CORE_TEALS[0];
  let bestD = Infinity;
  for (const p of CORE_TEALS) {
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
function fragmentRamp(fragmentTypeId) {
  const ramp = deriveFragmentContamRamp(fragmentTypeId);
  return {
    deep: ramp.deep,
    mid: ramp.mid,
    core: snapBright(ramp.core),
    glow: snapBright(ramp.glow)
  };
}
var STAGE2 = {
  infiltrate: 0,
  rewrite: 1,
  overwrite: 2
};
function applyFilmSheen(field) {
  const { v, w, h } = field;
  const next = new Float32Array(v);
  const at14 = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return v[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const cur = v[i];
      const n = at14(x, y - 1);
      const s = at14(x, y + 1);
      const e = at14(x + 1, y);
      const west = at14(x - 1, y);
      const emptyN = (n < 0.1 ? 1 : 0) + (s < 0.1 ? 1 : 0) + (e < 0.1 ? 1 : 0) + (west < 0.1 ? 1 : 0);
      if (cur >= 0.1) {
        if (emptyN >= 3) next[i] = 1;
        else if (emptyN >= 1) next[i] = Math.max(cur, 0.86);
      } else if (n >= 0.1 || s >= 0.1 || e >= 0.1 || west >= 0.1) {
        next[i] = 0.26;
      }
    }
  }
  v.set(next);
}
function lobeCountOf(rhythm) {
  if (rhythm === "rhythm_pulse") return 7;
  if (rhythm === "rhythm_sleep") return 3;
  if (rhythm === "rhythm_cluster") return 5;
  return 4;
}
function pickGrowthUnit(x, y, topology, unitCount, ox, oy, innerR, outerR) {
  if (unitCount <= 1) return 0;
  let nearest = 0;
  let nearestD = Infinity;
  for (let i = 0; i < unitCount; i++) {
    const dx = x - ox[i];
    const dy = y - oy[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD) {
      nearestD = d2;
      nearest = i;
    }
  }
  if (topology !== "holed_veil") return nearest;
  const originX = ox[nearest];
  const originY = oy[nearest];
  const r = Math.hypot(x - originX, y - originY);
  let band = nearest;
  let bestErr = Infinity;
  for (let i = 0; i < unitCount; i++) {
    const dOx = ox[i] - originX;
    const dOy = oy[i] - originY;
    if (dOx * dOx + dOy * dOy > 144) continue;
    const mid = 0.5 * (innerR[i] + outerR[i]);
    const err = Math.abs(r - mid);
    if (err < bestErr) {
      bestErr = err;
      band = i;
    }
  }
  return band;
}
function collectBeadPeaks(field, w, h) {
  const raw = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const v = field[i];
      if (v < 0.42) continue;
      let higher = 0;
      for (let oyOff = -2; oyOff <= 2; oyOff++) {
        for (let oxOff = -2; oxOff <= 2; oxOff++) {
          if (oxOff === 0 && oyOff === 0) continue;
          if (field[(y + oyOff) * w + (x + oxOff)] > v + 1e-6) higher += 1;
        }
      }
      if (higher > 0) continue;
      raw.push({ x: x + 0.5, y: y + 0.5, v });
    }
  }
  raw.sort((a, b) => b.v - a.v || a.y - b.y || a.x - b.x);
  const kept = [];
  const minD2 = 49;
  const floor = raw[0] !== void 0 ? raw[0].v * 0.72 : 1;
  for (const p of raw) {
    if (p.v < floor) break;
    if (kept.some((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < minD2)) continue;
    kept.push(p);
    if (kept.length >= PAINT_GROWTH_UNIT_CAP) break;
  }
  return kept;
}
function assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR) {
  const unitIndex = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      unitIndex[y * w + x] = pickGrowthUnit(
        x + 0.5,
        y + 0.5,
        topology,
        unitCount,
        ox,
        oy,
        innerR,
        outerR
      );
    }
  }
  return unitIndex;
}
function buildBeadGrowthGuide(field, w, h, topology, sense, rhythm) {
  const senseAngle = senseAngleOf(sense);
  const lobeCount = lobeCountOf(rhythm);
  const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const span = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const peaks = collectBeadPeaks(field, w, h);
  let unitCount = 0;
  for (const p of peaks) {
    ox[unitCount] = p.x;
    oy[unitCount] = p.y;
    unitCount += 1;
  }
  if (unitCount === 0) {
    ox[0] = w * 0.5;
    oy[0] = h * 0.5;
    span[0] = Math.min(w, h) * 0.2;
    outerR[0] = span[0];
    unitCount = 1;
  }
  const unitIndex = assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR);
  if (peaks.length > 0) {
    const maxR = new Float32Array(unitCount);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (field[i] < 0.1) continue;
        const u = unitIndex[i];
        const r = Math.hypot(x + 0.5 - ox[u], y + 0.5 - oy[u]);
        if (r > maxR[u]) maxR[u] = r;
      }
    }
    for (let u = 0; u < unitCount; u++) {
      span[u] = Math.max(1.5, maxR[u]);
      outerR[u] = span[u];
    }
  }
  return {
    topology,
    veinVariant: 3,
    senseAngle,
    lobeCount,
    unitCount,
    ox,
    oy,
    span,
    innerR,
    outerR,
    unitIndex
  };
}
function buildPaintGrowthGuide(field, w, h, topology, sense, rhythm, veinVariant) {
  if (veinVariant === 3) return buildBeadGrowthGuide(field, w, h, topology, sense, rhythm);
  const senseAngle = senseAngleOf(sense);
  const lobeCount = lobeCountOf(rhythm);
  const cs = Math.cos(senseAngle);
  const sn = Math.sin(senseAngle);
  const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const span = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const visited = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comp = new Int32Array(w * h);
  let unitCount = 0;
  const rimPool = veinVariant === 5;
  for (let start = 0; start < w * h; start++) {
    if (visited[start] || field[start] < 0.1) continue;
    let top = 0;
    let n = 0;
    stack[top++] = start;
    visited[start] = 1;
    let sumX = 0;
    let sumY = 0;
    let minAlong = Infinity;
    let rootX = 0;
    let rootY = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    while (top > 0) {
      const p = stack[--top];
      comp[n++] = p;
      const x = p % w;
      const y = p / w | 0;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const along = x * cs + y * sn;
      if (along < minAlong) {
        minAlong = along;
        rootX = x;
        rootY = y;
      }
      for (let oyOff = -1; oyOff <= 1; oyOff++) {
        for (let oxOff = -1; oxOff <= 1; oxOff++) {
          if (oxOff === 0 && oyOff === 0) continue;
          const nx = x + oxOff;
          const ny = y + oyOff;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (visited[q] || field[q] < 0.1) continue;
          visited[q] = 1;
          stack[top++] = q;
        }
      }
    }
    if (n < 8 || unitCount >= PAINT_GROWTH_UNIT_CAP) continue;
    let ux;
    let uy;
    if (topology === "vein_tree" && !rimPool) {
      ux = rootX + 0.5;
      uy = rootY + 0.5;
    } else if (topology === "holed_veil") {
      ux = (minX + maxX) * 0.5 + 0.5;
      uy = (minY + maxY) * 0.5 + 0.5;
    } else {
      ux = sumX / n + 0.5;
      uy = sumY / n + 0.5;
    }
    let minR = Infinity;
    let maxR = 0;
    let maxAlongRel = 0;
    for (let k = 0; k < n; k++) {
      const p = comp[k];
      const px = p % w + 0.5;
      const py = (p / w | 0) + 0.5;
      const r = Math.hypot(px - ux, py - uy);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      const alongRel = (px - ux) * cs + (py - uy) * sn;
      if (alongRel > maxAlongRel) maxAlongRel = alongRel;
    }
    if (maxR < 2) continue;
    ox[unitCount] = ux;
    oy[unitCount] = uy;
    span[unitCount] = topology === "vein_tree" && !rimPool ? Math.max(1, maxAlongRel) : maxR;
    innerR[unitCount] = topology === "holed_veil" ? minR : 0;
    outerR[unitCount] = maxR;
    unitCount += 1;
  }
  if (unitCount === 0) {
    ox[0] = w * 0.5;
    oy[0] = h * 0.5;
    span[0] = Math.min(w, h) * 0.33;
    innerR[0] = span[0] * 0.5;
    outerR[0] = span[0];
    unitCount = 1;
  }
  const unitIndex = assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR);
  return {
    topology,
    veinVariant,
    senseAngle,
    lobeCount,
    unitCount,
    ox,
    oy,
    span,
    innerR,
    outerR,
    unitIndex
  };
}
function compactPaintCanvas(field, growth, continuity) {
  const clearance2 = Math.ceil(Math.max(...growth.span, ...growth.outerR) * PAINT_INFLATED_AMP) + 2;
  const minimum = paintGenomeCanvasOf(continuity);
  let reachX = 0, reachY = 0;
  for (let y = 0; y < field.h; y++) for (let x = 0; x < field.w; x++) {
    if (field.v[y * field.w + x] < 0.1) continue;
    reachX = Math.max(reachX, Math.abs(x - field.w / 2), Math.abs(x + 1 - field.w / 2));
    reachY = Math.max(reachY, Math.abs(y - field.h / 2), Math.abs(y + 1 - field.h / 2));
  }
  const w = Math.min(field.w, Math.max(minimum.w, 2 * Math.ceil(reachX + clearance2 + 2)));
  const h = Math.min(field.h, Math.max(minimum.h, 2 * Math.ceil(reachY + clearance2 + 2)));
  if (w === field.w && h === field.h) return { field, growth, clearance: clearance2 };
  const shiftX = (field.w - w) / 2, shiftY = (field.h - h) / 2;
  const cropped = makePaintField(w, h, field.logicalSpan);
  const unitIndex = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const begin = (y + shiftY) * field.w + shiftX;
    cropped.v.set(field.v.subarray(begin, begin + w), y * w);
    unitIndex.set(growth.unitIndex.subarray(begin, begin + w), y * w);
  }
  const ox = new Float32Array(growth.ox), oy = new Float32Array(growth.oy);
  for (let i = 0; i < growth.unitCount; i++) {
    ox[i] = ox[i] - shiftX;
    oy[i] = oy[i] - shiftY;
  }
  return { field: cropped, growth: { ...growth, ox, oy, unitIndex }, clearance: clearance2 };
}
function bakePaintGenome(req) {
  const sense = req.sense ?? "sense_touch";
  const rhythm = req.rhythm ?? "rhythm_open";
  const geometryVersion = req.geometryVersion ?? 2;
  const { field, topology } = topologyCanvas(req);
  const { w, h } = field;
  const stage = STAGE2[req.coverage];
  const ramp = fragmentRamp(req.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT);
  const veinTag = req.veinVariant === void 0 ? "" : `:v${req.veinVariant}`;
  const rngLabel = `paint-core:${topology}:${req.coverage}:${sense}:${rhythm}${veinTag}`;
  let s = mix32(req.seed, rngLabel) | 1;
  const next = () => {
    let x = s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s = x >>> 0;
    return s / 4294967296;
  };
  const pickInt = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  for (let i = 0; i < field.v.length; i++) field.v[i] = field.v[i] * 0.58;
  if (req.veinVariant === 1 && topology === "vein_tree") applyFilmSheen(field);
  const beadGrowth = req.veinVariant === 3 ? buildPaintGrowthGuide(field.v, w, h, topology, sense, rhythm, 3) : void 0;
  const lit = [];
  for (let i = 0; i < field.v.length; i++) if (field.v[i] > 0.3) lit.push(i);
  const cores = 3 + stage * 4;
  for (let n = 0; n < cores && lit.length > 0; n++) {
    const i = lit[pickInt(0, lit.length - 1)];
    field.v[i] = 1;
    const x = i % w;
    const y = i / w | 0;
    if (n % 2 === 0 && x + 1 < w) field.v[i + 1] = 0.82;
    if (n % 3 === 0 && y + 1 < h) field.v[i + w] = 0.82;
  }
  const rawGrowth = beadGrowth ?? buildPaintGrowthGuide(field.v, w, h, topology, sense, rhythm, req.veinVariant);
  const compact = geometryVersion === 1 ? { field, growth: rawGrowth, clearance: 0 } : compactPaintCanvas(field, rawGrowth, req.continuity ?? "colony");
  const body = compact.field, growth = compact.growth;
  const out = new Uint8ClampedArray(body.w * body.h * 4);
  paintSurfaceMaterial(out, body.v, body.w, body.h, req.substrate, req.coverage, req.seed);
  const terrainFootprintField = geometryVersion === 1 ? body.v : reserveBreathingFootprint(body.v, body.w, body.h, compact.clearance);
  return {
    buf: { data: out, w: body.w, h: body.h },
    field: body.v,
    terrainFootprintField,
    geometryVersion,
    ramp,
    topology,
    growth,
    canvasW: body.w,
    canvasH: body.h
  };
}

// src/generated/contamination-family-data.ts
var CONTAMINATION_ENCOUNTER_DATA = {
  "frag-outdoor": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 4
  },
  "frag-clinic": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 3
  },
  "frag-metro": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 3
  },
  "frag-library": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 3
  },
  "frag-residential": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 3
  }
};
var FAMILY_CAPABILITY_DATA = [
  {
    "id": "organic_remnant_jia",
    "substrate": "organic_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_patrol"
  },
  {
    "id": "lamp_pillar_jia",
    "substrate": "lamp_pillar",
    "portfolio": "jia",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "doorframe_yi",
    "substrate": "doorframe",
    "portfolio": "yi",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_touch",
      "sense_narrow",
      "sense_hear"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_adjacent_strike"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "wall_rust_yi",
    "substrate": "wall_rust",
    "portfolio": "yi",
    "motion": [
      "motion_wall",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_touch",
      "sense_narrow",
      "sense_hear"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_adjacent_strike"
    ],
    "infiltrateMotion": "motion_wall"
  },
  {
    "id": "fungal_mat_bing",
    "substrate": "fungal_mat",
    "portfolio": "bing",
    "motion": [
      "motion_cluster"
    ],
    "sense": [
      "sense_touch"
    ],
    "rhythm": [
      "rhythm_cluster"
    ],
    "contact": [
      "contact_step_chaos"
    ],
    "infiltrateMotion": "motion_cluster"
  },
  {
    "id": "oil_film_bing",
    "substrate": "oil_film",
    "portfolio": "bing",
    "motion": [
      "motion_cluster"
    ],
    "sense": [
      "sense_touch"
    ],
    "rhythm": [
      "rhythm_cluster"
    ],
    "contact": [
      "contact_step_chaos"
    ],
    "infiltrateMotion": "motion_cluster"
  },
  {
    "id": "stalk_clump_jia",
    "substrate": "stalk_clump",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_turn"
  },
  {
    "id": "railing_post_jia",
    "substrate": "railing_post",
    "portfolio": "jia",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "ash_veil_bing",
    "substrate": "ash_veil",
    "portfolio": "bing",
    "motion": [
      "motion_cluster"
    ],
    "sense": [
      "sense_touch"
    ],
    "rhythm": [
      "rhythm_cluster"
    ],
    "contact": [
      "contact_step_chaos"
    ],
    "infiltrateMotion": "motion_cluster"
  },
  {
    "id": "sound_echo_ding",
    "substrate": "sound_echo",
    "portfolio": "ding",
    "motion": [
      "motion_anchor",
      "motion_wind",
      "motion_trail"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "light_scatter_ding",
    "substrate": "light_scatter",
    "portfolio": "ding",
    "motion": [
      "motion_anchor",
      "motion_wind",
      "motion_trail"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_trail"
  },
  {
    "id": "space_interval_ding",
    "substrate": "space_interval",
    "portfolio": "ding",
    "motion": [
      "motion_anchor",
      "motion_wind",
      "motion_trail"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "street_wreckage_jia",
    "substrate": "street_wreckage",
    "portfolio": "jia",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "insect_remnant_jia",
    "substrate": "insect_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_patrol"
  },
  {
    "id": "mammal_remnant_jia",
    "substrate": "mammal_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_patrol"
  },
  {
    "id": "worm_remnant_jia",
    "substrate": "worm_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_turn"
  },
  {
    "id": "human_remnant_jia",
    "substrate": "human_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_patrol"
  },
  {
    "id": "gas_mass_ding",
    "substrate": "gas_mass",
    "portfolio": "ding",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "mist_bank_ding",
    "substrate": "mist_bank",
    "portfolio": "ding",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "dust_swarm_ding",
    "substrate": "dust_swarm",
    "portfolio": "ding",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  }
];
var CONTAMINATION_DIALECT_DATA = {
  "frag-outdoor": {
    "substrates": [
      [
        "fungal_mat",
        3
      ],
      [
        "ash_veil",
        3
      ],
      [
        "oil_film",
        3
      ],
      [
        "organic_remnant",
        2
      ],
      [
        "stalk_clump",
        2
      ],
      [
        "sound_echo",
        2
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "gas_mass",
        2
      ],
      [
        "mist_bank",
        3
      ],
      [
        "dust_swarm",
        3
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  },
  "frag-clinic": {
    "substrates": [
      [
        "organic_remnant",
        1
      ],
      [
        "stalk_clump",
        1
      ],
      [
        "ash_veil",
        1
      ],
      [
        "sound_echo",
        1
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "fungal_mat",
        0
      ],
      [
        "oil_film",
        0
      ],
      [
        "gas_mass",
        3
      ],
      [
        "mist_bank",
        2
      ],
      [
        "dust_swarm",
        1
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  },
  "frag-metro": {
    "substrates": [
      [
        "oil_film",
        2
      ],
      [
        "ash_veil",
        2
      ],
      [
        "sound_echo",
        2
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "organic_remnant",
        0
      ],
      [
        "fungal_mat",
        0
      ],
      [
        "stalk_clump",
        0
      ],
      [
        "gas_mass",
        3
      ],
      [
        "mist_bank",
        2
      ],
      [
        "dust_swarm",
        3
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  },
  "frag-library": {
    "substrates": [
      [
        "organic_remnant",
        2
      ],
      [
        "sound_echo",
        2
      ],
      [
        "stalk_clump",
        1
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "fungal_mat",
        1
      ],
      [
        "oil_film",
        1
      ],
      [
        "ash_veil",
        1
      ],
      [
        "gas_mass",
        1
      ],
      [
        "mist_bank",
        2
      ],
      [
        "dust_swarm",
        4
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  },
  "frag-residential": {
    "substrates": [
      [
        "organic_remnant",
        3
      ],
      [
        "stalk_clump",
        3
      ],
      [
        "oil_film",
        2
      ],
      [
        "ash_veil",
        1
      ],
      [
        "sound_echo",
        1
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "fungal_mat",
        0
      ],
      [
        "gas_mass",
        2
      ],
      [
        "mist_bank",
        2
      ],
      [
        "dust_swarm",
        2
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  }
};

// src/generated/contamination-lexicon-data.ts
var SUBSTRATE_DATA = {
  organic_remnant: {
    id: "organic_remnant",
    displayToken: "\u6709\u673A\u6B8B\u5F71",
    residualVerb: "\u8D70",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith", "shards"],
    enabledScope: "sortie"
  },
  lamp_pillar: {
    id: "lamp_pillar",
    displayToken: "\u706F\u67F1",
    residualVerb: "\u4EAE",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith"],
    enabledScope: "gym"
  },
  doorframe: {
    id: "doorframe",
    displayToken: "\u95E8\u6846",
    residualVerb: "\u5F00\u5408",
    legalOccupancies: ["wall"],
    sortieLegalOccupancies: ["wall"],
    legalContinuities: ["monolith"],
    enabledScope: "gym"
  },
  wall_rust: {
    id: "wall_rust",
    displayToken: "\u5899\u9508",
    residualVerb: "\u6E17",
    legalOccupancies: ["wall"],
    sortieLegalOccupancies: ["wall"],
    legalContinuities: ["monolith", "colony"],
    enabledScope: "gym"
  },
  fungal_mat: {
    id: "fungal_mat",
    displayToken: "\u83CC\u6BEF",
    residualVerb: "\u94FA",
    legalOccupancies: ["paint"],
    sortieLegalOccupancies: ["paint"],
    legalContinuities: ["colony", "field"],
    enabledScope: "sortie"
  },
  oil_film: {
    id: "oil_film",
    displayToken: "\u6CB9\u819C",
    residualVerb: "\u6CBE",
    legalOccupancies: ["paint"],
    sortieLegalOccupancies: ["paint"],
    legalContinuities: ["monolith", "colony", "field"],
    enabledScope: "sortie"
  },
  stalk_clump: {
    id: "stalk_clump",
    displayToken: "\u6B8B\u830E",
    residualVerb: "\u6447",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith", "shards"],
    enabledScope: "sortie"
  },
  railing_post: {
    id: "railing_post",
    displayToken: "\u680F\u67F1",
    residualVerb: "\u62E6",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith"],
    enabledScope: "gym"
  },
  ash_veil: {
    id: "ash_veil",
    displayToken: "\u7070\u5E55",
    residualVerb: "\u8986",
    legalOccupancies: ["paint"],
    sortieLegalOccupancies: ["paint"],
    legalContinuities: ["monolith", "colony", "field"],
    enabledScope: "sortie"
  },
  sound_echo: {
    id: "sound_echo",
    displayToken: "\u4F59\u54CD",
    residualVerb: "\u54CD",
    legalOccupancies: ["volume"],
    sortieLegalOccupancies: ["volume"],
    legalContinuities: ["monolith", "field"],
    enabledScope: "sortie"
  },
  light_scatter: {
    id: "light_scatter",
    displayToken: "\u6563\u5149",
    residualVerb: "\u6298",
    legalOccupancies: ["volume"],
    sortieLegalOccupancies: ["volume"],
    legalContinuities: ["monolith", "field"],
    enabledScope: "gym"
  },
  space_interval: {
    id: "space_interval",
    displayToken: "\u95F4\u8DDD",
    residualVerb: "\u6324",
    legalOccupancies: ["volume"],
    sortieLegalOccupancies: ["volume"],
    legalContinuities: ["monolith", "field"],
    enabledScope: "gym"
  },
  street_wreckage: {
    id: "street_wreckage",
    displayToken: "\u8857\u5177\u6B8B\u9AB8",
    residualVerb: "\u7ACB",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith"],
    enabledScope: "gym"
  },
  insect_remnant: {
    id: "insect_remnant",
    displayToken: "\u866B",
    residualVerb: "\u722C",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith"],
    enabledScope: "sortie"
  },
  mammal_remnant: {
    id: "mammal_remnant",
    displayToken: "\u54FA\u4E73\u52A8\u7269",
    residualVerb: "\u8D70",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith"],
    enabledScope: "sortie"
  },
  worm_remnant: {
    id: "worm_remnant",
    displayToken: "\u5927\u53F7\u8815\u866B",
    residualVerb: "\u62F1",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith"],
    enabledScope: "sortie"
  },
  human_remnant: {
    id: "human_remnant",
    displayToken: "\u4EBA\u5F62\u6B8B\u4F59",
    residualVerb: "\u8D70",
    legalOccupancies: ["floor"],
    sortieLegalOccupancies: ["floor"],
    legalContinuities: ["monolith"],
    enabledScope: "sortie"
  },
  gas_mass: {
    id: "gas_mass",
    displayToken: "\u6C14\u56E2",
    residualVerb: "\u6D8C",
    legalOccupancies: ["volume"],
    sortieLegalOccupancies: ["volume"],
    legalContinuities: ["monolith", "field"],
    enabledScope: "sortie"
  },
  mist_bank: {
    id: "mist_bank",
    displayToken: "\u96FE\u56E2",
    residualVerb: "\u6F2B",
    legalOccupancies: ["volume"],
    sortieLegalOccupancies: ["volume"],
    legalContinuities: ["monolith", "field"],
    enabledScope: "sortie"
  },
  dust_swarm: {
    id: "dust_swarm",
    displayToken: "\u5C18\u7D6E\u7FA4",
    residualVerb: "\u65CB",
    legalOccupancies: ["volume"],
    sortieLegalOccupancies: ["volume"],
    legalContinuities: ["monolith", "field"],
    enabledScope: "sortie"
  }
};
var PORTFOLIO_DATA = {
  jia: {
    id: "jia",
    displayToken: "\u5360\u5730",
    continuity: "monolith",
    occupancy: "floor",
    legalContinuities: ["monolith"],
    pinLayer: "waypoints",
    canChase: true,
    blockWalk: true,
    defaultContact: "contact_melee_three",
    detectionPulse: true
  },
  yi: {
    id: "yi",
    displayToken: "\u5360\u5899",
    continuity: "monolith",
    occupancy: "wall",
    legalContinuities: ["monolith"],
    pinLayer: "wall_edge",
    canChase: false,
    blockWalk: false,
    defaultContact: "contact_adjacent_strike",
    detectionPulse: true
  },
  bing: {
    id: "bing",
    displayToken: "\u5360\u6F06",
    continuity: "colony",
    occupancy: "paint",
    legalContinuities: ["colony", "field"],
    pinLayer: "cluster_core",
    canChase: false,
    blockWalk: false,
    defaultContact: "contact_step_chaos",
    detectionPulse: false
  },
  ding: {
    id: "ding",
    displayToken: "\u5360\u7A7A",
    continuity: "field",
    occupancy: "volume",
    legalContinuities: ["field", "monolith"],
    pinLayer: "corridor_aabb",
    canChase: false,
    blockWalk: false,
    defaultContact: "contact_volume_chaos",
    detectionPulse: false
  }
};
var LEXEME_DATA = {
  motion_patrol: {
    id: "motion_patrol",
    slot: "motion",
    displayToken: "\u5DE1\u8DEF",
    legalPortfolios: ["jia"],
    rewrites: []
  },
  motion_turn: {
    id: "motion_turn",
    slot: "motion",
    displayToken: "\u8F6C\u9762",
    legalPortfolios: ["jia", "yi"],
    rewrites: []
  },
  motion_coalesce: {
    id: "motion_coalesce",
    slot: "motion",
    displayToken: "\u51DD\u805A",
    legalPortfolios: ["jia"],
    rewrites: []
  },
  motion_wall: {
    id: "motion_wall",
    slot: "motion",
    displayToken: "\u6CBF\u58C1",
    legalPortfolios: ["yi"],
    rewrites: []
  },
  motion_anchor: {
    id: "motion_anchor",
    slot: "motion",
    displayToken: "\u56FA\u7740",
    legalPortfolios: ["jia", "yi", "bing", "ding"],
    rewrites: []
  },
  motion_cluster: {
    id: "motion_cluster",
    slot: "motion",
    displayToken: "\u7C07\u6816",
    legalPortfolios: ["bing"],
    rewrites: []
  },
  motion_wind: {
    id: "motion_wind",
    slot: "motion",
    displayToken: "\u968F\u98CE",
    legalPortfolios: ["bing", "ding"],
    rewrites: []
  },
  motion_trail: {
    id: "motion_trail",
    slot: "motion",
    displayToken: "\u62D6\u5C3E",
    legalPortfolios: ["ding"],
    rewrites: []
  },
  sense_cone: {
    id: "sense_cone",
    slot: "sense",
    displayToken: "\u89C6\u9525",
    legalPortfolios: ["jia"],
    rewrites: []
  },
  sense_hear: {
    id: "sense_hear",
    slot: "sense",
    displayToken: "\u542C\u566A",
    legalPortfolios: ["jia", "yi"],
    rewrites: []
  },
  sense_narrow: {
    id: "sense_narrow",
    slot: "sense",
    displayToken: "\u7A84\u89C6",
    legalPortfolios: ["jia", "yi"],
    rewrites: []
  },
  sense_touch: {
    id: "sense_touch",
    slot: "sense",
    displayToken: "\u89E6\u5730",
    legalPortfolios: ["yi", "bing"],
    rewrites: []
  },
  sense_scent: {
    id: "sense_scent",
    slot: "sense",
    displayToken: "\u55C5\u6DF7\u4E71",
    legalPortfolios: ["bing", "ding"],
    rewrites: []
  },
  sense_domain: {
    id: "sense_domain",
    slot: "sense",
    displayToken: "\u9886\u57DF",
    legalPortfolios: ["bing", "ding"],
    rewrites: []
  },
  sense_reverse: {
    id: "sense_reverse",
    slot: "sense",
    displayToken: "\u53CD\u89C6",
    legalPortfolios: ["ding"],
    rewrites: []
  },
  rhythm_open: {
    id: "rhythm_open",
    slot: "rhythm",
    displayToken: "\u5E38\u5F00",
    legalPortfolios: ["jia", "yi", "bing", "ding"],
    rewrites: []
  },
  rhythm_sleep: {
    id: "rhythm_sleep",
    slot: "rhythm",
    displayToken: "\u7761\u7720",
    legalPortfolios: ["jia", "yi"],
    rewrites: []
  },
  rhythm_pulse: {
    id: "rhythm_pulse",
    slot: "rhythm",
    displayToken: "\u8109\u51B2",
    legalPortfolios: ["jia", "yi", "bing", "ding"],
    rewrites: []
  },
  rhythm_cluster: {
    id: "rhythm_cluster",
    slot: "rhythm",
    displayToken: "\u968F\u7C07\u547C\u5438",
    legalPortfolios: ["bing"],
    rewrites: []
  },
  rhythm_sky: {
    id: "rhythm_sky",
    slot: "rhythm",
    displayToken: "\u968F\u5929\u7A7A\u76F8",
    legalPortfolios: ["ding"],
    rewrites: []
  },
  contact_melee_three: {
    id: "contact_melee_three",
    slot: "contact",
    displayToken: "\u4E09\u5200\u8FD1\u6218",
    legalPortfolios: ["jia"],
    rewrites: [{ portfolio: "yi", lexeme: "contact_adjacent_strike" }, { portfolio: "bing", lexeme: "contact_step_chaos" }, { portfolio: "ding", lexeme: "contact_volume_chaos" }]
  },
  contact_adjacent_strike: {
    id: "contact_adjacent_strike",
    slot: "contact",
    displayToken: "\u90BB\u683C\u62BD\u6253",
    legalPortfolios: ["yi"],
    rewrites: []
  },
  contact_step_chaos: {
    id: "contact_step_chaos",
    slot: "contact",
    displayToken: "\u8E29\u8E0F\u6DF7\u4E71",
    legalPortfolios: ["bing"],
    rewrites: []
  },
  contact_volume_chaos: {
    id: "contact_volume_chaos",
    slot: "contact",
    displayToken: "\u573A\u5185\u52A0\u901F\u6DF7\u4E71",
    legalPortfolios: ["ding"],
    rewrites: []
  }
};
var UTTERANCE_DATA = {
  door_still_closing: {
    id: "door_still_closing",
    internalLabel: "\u95E8\u8FD8\u60F3\u5173",
    onScreenMark: "\u5F00\u5408",
    coverage: "infiltrate",
    substrate: "doorframe",
    portfolio: "yi",
    continuity: "monolith",
    occupancy: "wall",
    motion: "motion_anchor",
    sense: "sense_touch",
    rhythm: "rhythm_pulse",
    contact: "contact_adjacent_strike"
  },
  eye_in_the_seam: {
    id: "eye_in_the_seam",
    internalLabel: "\u7F1D\u91CC\u7684\u773C",
    onScreenMark: "\u7F1D\u4EAE",
    coverage: "overwrite",
    substrate: "wall_rust",
    portfolio: "yi",
    continuity: "monolith",
    occupancy: "wall",
    motion: "motion_anchor",
    sense: "sense_narrow",
    rhythm: "rhythm_open",
    contact: "contact_adjacent_strike"
  },
  cluster_lung: {
    id: "cluster_lung",
    internalLabel: "\u7C07\u7684\u80BA",
    onScreenMark: "\u5728\u6DA8",
    coverage: "rewrite",
    substrate: "fungal_mat",
    portfolio: "bing",
    continuity: "field",
    occupancy: "paint",
    motion: "motion_cluster",
    sense: "sense_touch",
    rhythm: "rhythm_cluster",
    contact: "contact_step_chaos"
  },
  corridor_watching: {
    id: "corridor_watching",
    internalLabel: "\u8D70\u5ECA\u5728\u770B\u4F60",
    onScreenMark: "\u56DE\u5934",
    coverage: "overwrite",
    substrate: "space_interval",
    portfolio: "ding",
    continuity: "field",
    occupancy: "volume",
    motion: "motion_anchor",
    sense: "sense_reverse",
    rhythm: "rhythm_sky",
    contact: "contact_volume_chaos"
  }
};
var STOP_LOSS_DATA = {
  monolith_infiltrate: {
    id: "monolith_infiltrate",
    continuity: "monolith",
    coverage: "infiltrate",
    family: "core_strike",
    corePolicy: "exposed",
    legalOccupancies: ["floor", "wall", "paint", "volume"]
  },
  monolith_rewrite: {
    id: "monolith_rewrite",
    continuity: "monolith",
    coverage: "rewrite",
    family: "core_strike",
    corePolicy: "standard",
    legalOccupancies: ["floor", "wall", "paint", "volume"]
  },
  monolith_overwrite: {
    id: "monolith_overwrite",
    continuity: "monolith",
    coverage: "overwrite",
    family: "core_strike",
    corePolicy: "obscured",
    legalOccupancies: ["floor", "wall", "paint", "volume"]
  },
  colony_infiltrate: {
    id: "colony_infiltrate",
    continuity: "colony",
    coverage: "infiltrate",
    family: "scatter_rejoin",
    corePolicy: "exposed",
    legalOccupancies: ["paint", "wall"]
  },
  colony_rewrite: {
    id: "colony_rewrite",
    continuity: "colony",
    coverage: "rewrite",
    family: "scatter_rejoin",
    corePolicy: "standard",
    legalOccupancies: ["paint", "wall"]
  },
  colony_overwrite: {
    id: "colony_overwrite",
    continuity: "colony",
    coverage: "overwrite",
    family: "scatter_rejoin",
    corePolicy: "obscured",
    legalOccupancies: ["paint", "wall"]
  },
  field_infiltrate: {
    id: "field_infiltrate",
    continuity: "field",
    coverage: "infiltrate",
    family: "unkillable",
    corePolicy: "none",
    legalOccupancies: ["paint", "volume"]
  },
  field_rewrite: {
    id: "field_rewrite",
    continuity: "field",
    coverage: "rewrite",
    family: "unkillable",
    corePolicy: "none",
    legalOccupancies: ["paint", "volume"]
  },
  field_overwrite: {
    id: "field_overwrite",
    continuity: "field",
    coverage: "overwrite",
    family: "unkillable",
    corePolicy: "none",
    legalOccupancies: ["paint", "volume"]
  }
};

// src/generation/contamination-draw.ts
var PAINT_HOST_COUNT_RANGE = {
  new: [3, 5],
  standard: [6, 8],
  ancient: [9, 12]
};
function rollPaintHostCount(layoutSeed, age) {
  const range = PAINT_HOST_COUNT_RANGE[age];
  const lo = range[0];
  const hi = range[1];
  const rng = new SeededRandom(mix32(layoutSeed, "paint-count"));
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}
var RETRY = GAME_CONSTANTS.CONTAMINATION.DRAW_RETRY_LIMIT;
var SLOTS = ["motion", "sense", "rhythm", "contact"];
var COVERAGES = ["infiltrate", "rewrite", "overwrite"];
var INFILTRATOR_FORM = {
  substrate: "organic_remnant",
  coverage: "infiltrate",
  continuity: "monolith",
  occupancy: "floor",
  portfolio: "jia",
  lexemes: {
    motion: "motion_patrol",
    sense: "sense_cone",
    rhythm: "rhythm_open",
    contact: "contact_melee_three"
  }
};
var REWRITER_FORM = {
  substrate: "organic_remnant",
  coverage: "rewrite",
  continuity: "monolith",
  occupancy: "floor",
  portfolio: "jia",
  lexemes: {
    motion: "motion_patrol",
    sense: "sense_hear",
    rhythm: "rhythm_open",
    contact: "contact_melee_three"
  }
};
function occupanciesForScope(sub, scope) {
  return scope === "sortie" ? sub.sortieLegalOccupancies : sub.legalOccupancies;
}
function dialectOf(fragmentTypeId) {
  return CONTAMINATION_DIALECT_DATA[fragmentTypeId] ?? { substrates: [], wallHostWeight: 0, volumeHostWeight: 0 };
}
function pickWeighted(rng, items) {
  let total = 0;
  for (const [, w] of items) total += w;
  if (total <= 0) return null;
  let roll = rng.next() * total;
  for (const [id, w] of items) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return items[items.length - 1]?.[0] ?? null;
}
function lexemesFor(slot, portfolio) {
  return Object.values(LEXEME_DATA).filter((row) => row.slot === slot && row.legalPortfolios.includes(portfolio)).map((row) => row.id);
}
function familyCapabilityFor(substrate, portfolio) {
  return FAMILY_CAPABILITY_DATA.find((row) => row.substrate === substrate && row.portfolio === portfolio);
}
function motionChoicesFor(substrate, portfolio, coverage) {
  const family = familyCapabilityFor(substrate, portfolio);
  if (!family) return [];
  return coverage === "infiltrate" ? [family.infiltrateMotion] : family.motion;
}
function floorMotionFor(form) {
  const choices = motionChoicesFor(form.substrate, form.portfolio, form.coverage);
  const motion = choices.includes(form.lexemes.motion) ? form.lexemes.motion : choices[0];
  return motion === "motion_patrol" || motion === "motion_turn" ? motion : "motion_anchor";
}
function supportsRuntimeForm(form) {
  const family = familyCapabilityFor(form.substrate, form.portfolio);
  const port = PORTFOLIO_DATA[form.portfolio];
  const sub = SUBSTRATE_DATA[form.substrate];
  return !!family && sub?.enabledScope === "sortie" && form.occupancy === port.occupancy && sub.sortieLegalOccupancies.includes(form.occupancy) && sub.legalContinuities.includes(form.continuity) && port.legalContinuities.includes(form.continuity) && SLOTS.every((slot) => family[slot].includes(form.lexemes[slot])) && motionChoicesFor(form.substrate, form.portfolio, form.coverage).includes(form.lexemes.motion);
}
function inScope(sub, scope) {
  return scope === "gym" || sub.enabledScope === "sortie";
}
function legalSubstrates(portfolio, fragmentTypeId, scope) {
  const occupancy = PORTFOLIO_DATA[portfolio].occupancy;
  const dialect = dialectOf(fragmentTypeId);
  const out = [];
  for (const [id, w] of dialect.substrates) {
    const sub = SUBSTRATE_DATA[id];
    if (!sub || w <= 0) continue;
    if (!inScope(sub, scope)) continue;
    if (!occupanciesForScope(sub, scope).includes(occupancy)) continue;
    const contOk = sub.legalContinuities.some(
      (c) => PORTFOLIO_DATA[portfolio].legalContinuities.includes(c)
    );
    if (!contOk) continue;
    out.push([id, w]);
  }
  return out;
}
function pickContinuity(rng, portfolio, substrate) {
  const port = PORTFOLIO_DATA[portfolio];
  const sub = SUBSTRATE_DATA[substrate];
  if (!sub) return null;
  const inter = port.legalContinuities.filter((c) => sub.legalContinuities.includes(c));
  if (inter.length === 0) return null;
  if (inter.includes(port.continuity) && rng.next() < 0.7) return port.continuity;
  return rng.pick(inter);
}
function formFromUtterance(id) {
  const u = UTTERANCE_DATA[id];
  if (!u) return null;
  return {
    substrate: u.substrate,
    coverage: u.coverage,
    continuity: u.continuity,
    occupancy: u.occupancy,
    portfolio: u.portfolio,
    lexemes: { motion: u.motion, sense: u.sense, rhythm: u.rhythm, contact: u.contact },
    utteranceId: u.id
  };
}
function utteranceAllowed(form, scope) {
  if (scope === "gym") return true;
  const sub = SUBSTRATE_DATA[form.substrate];
  return sub?.enabledScope === "sortie" && supportsRuntimeForm(form);
}
function slotChoices(slot, substrate, coverage, opts) {
  const family = familyCapabilityFor(substrate, opts.portfolio);
  let choices = (opts.scope ?? "sortie") === "sortie" ? slot === "motion" ? motionChoicesFor(substrate, opts.portfolio, coverage) : family?.[slot] ?? [] : lexemesFor(slot, opts.portfolio);
  if (slot === "motion") {
    if (opts.scope === "gym" && coverage === "infiltrate" && family) choices = [family.infiltrateMotion];
    if (opts.motion) choices = choices.filter((id) => id === opts.motion);
    if (opts.forbidMotion) choices = choices.filter((id) => !opts.forbidMotion.includes(id));
  }
  if (slot === "rhythm") {
    if (opts.rhythm) choices = choices.filter((id) => id === opts.rhythm);
    if (opts.forbidRhythm) choices = choices.filter((id) => !opts.forbidRhythm.includes(id));
  }
  if (slot === "sense") {
    if (opts.sense) choices = choices.filter((id) => id === opts.sense);
    if (opts.forbidSense) choices = choices.filter((id) => !opts.forbidSense.includes(id));
  }
  return choices;
}
function tryDrawOne(rng, opts) {
  const port = PORTFOLIO_DATA[opts.portfolio];
  const scope = opts.scope ?? "sortie";
  const gymSub = scope === "gym" && opts.substrate ? SUBSTRATE_DATA[opts.substrate] : void 0;
  const legal = gymSub ? occupanciesForScope(gymSub, scope).includes(port.occupancy) && gymSub.legalContinuities.some((c) => port.legalContinuities.includes(c)) ? [[gymSub.id, 1]] : [] : legalSubstrates(opts.portfolio, opts.fragmentTypeId, scope).filter(([id]) => !opts.substrate || id === opts.substrate);
  const candidates = legal.filter(([id]) => !opts.forbidSubstrate?.includes(id));
  const viableCoverages = (opts.coverage ? [opts.coverage] : COVERAGES).filter((coverage2) => candidates.some(([id]) => SLOTS.every((slot) => slotChoices(slot, id, coverage2, opts).length > 0)));
  if (viableCoverages.length === 0) return null;
  if (opts.preferUtterance) {
    const matching = Object.values(UTTERANCE_DATA).filter((u) => {
      if (u.portfolio !== opts.portfolio || !viableCoverages.includes(u.coverage) || !candidates.some(([id]) => id === u.substrate)) return false;
      const form = formFromUtterance(u.id);
      return !!form && utteranceAllowed(form, scope) && SLOTS.every((slot) => slotChoices(slot, u.substrate, u.coverage, opts).includes(form.lexemes[slot]));
    });
    if (matching.length > 0 && rng.next() < 0.35) return formFromUtterance(rng.pick(matching).id);
  }
  const coverage = opts.coverage ?? pickWeighted(rng, viableCoverages.map((id) => [id, id === "infiltrate" ? 5 : id === "rewrite" ? 3 : 2]));
  const pool = candidates.filter(([id]) => SLOTS.every((slot) => slotChoices(slot, id, coverage, opts).length > 0));
  const substrate = pickWeighted(rng, pool);
  if (!substrate) return null;
  const continuity = pickContinuity(rng, opts.portfolio, substrate);
  if (!continuity) return null;
  const lexemes = { motion: "", sense: "", rhythm: "", contact: "" };
  for (const slot of SLOTS) lexemes[slot] = rng.pick([...slotChoices(slot, substrate, coverage, opts)]);
  return { substrate, coverage, continuity, occupancy: port.occupancy, portfolio: opts.portfolio, lexemes };
}
function drawOne(rng, opts) {
  for (let i = 0; i < RETRY; i++) {
    const form = tryDrawOne(rng, opts);
    if (form) return form;
  }
  return null;
}
function pickYiOrDing(rng, pins) {
  const dialect = dialectOf(pins.fragmentTypeId);
  const yiOk = pins.hasWallEdges && dialect.wallHostWeight > 0 && legalSubstrates("yi", pins.fragmentTypeId, "sortie").length > 0;
  const dingOk = pins.hasCorridors && dialect.volumeHostWeight > 0 && legalSubstrates("ding", pins.fragmentTypeId, "sortie").length > 0;
  if (!yiOk && !dingOk) return null;
  if (yiOk && !dingOk) return "yi";
  if (!yiOk && dingOk) return "ding";
  const total = dialect.wallHostWeight + dialect.volumeHostWeight;
  if (total <= 0) return null;
  const roll = rng.next() * total;
  return dialect.volumeHostWeight > dialect.wallHostWeight ? roll < dialect.volumeHostWeight ? "ding" : "yi" : roll < dialect.wallHostWeight ? "yi" : "ding";
}
function drawSortie(rng, pins) {
  const warnings = [];
  const forms = [];
  const jiaCount = pins.hearingAxisTaken ? 0 : rng.nextInt(2, 3);
  const alt = pickYiOrDing(rng, pins);
  if (!alt) warnings.push("no legal production environment host with a matching pin; skipped yi/ding");
  let hearingOnAlt = false;
  if (alt === "yi") {
    const encounter = CONTAMINATION_ENCOUNTER_DATA[pins.fragmentTypeId];
    const preferWallHear = !pins.hearingAxisTaken && !!encounter && rng.next() * (encounter.hearingWallWeight + encounter.hearingFloorWeight) < encounter.hearingWallWeight;
    const withHear = preferWallHear ? drawOne(rng, {
      portfolio: "yi",
      fragmentTypeId: pins.fragmentTypeId,
      forbidSubstrate: pins.hasWallOpenings === false ? ["doorframe"] : void 0,
      preferUtterance: true,
      sense: "sense_hear"
    }) : null;
    if (withHear) {
      forms.push(withHear);
      hearingOnAlt = true;
    } else {
      const any = drawOne(rng, {
        portfolio: "yi",
        fragmentTypeId: pins.fragmentTypeId,
        forbidSubstrate: pins.hasWallOpenings === false ? ["doorframe"] : void 0,
        forbidSense: ["sense_hear"],
        preferUtterance: true
      });
      if (any) forms.push(any);
      else warnings.push("yi draw failed after retries");
    }
  } else if (alt === "ding") {
    const ding = drawOne(rng, {
      portfolio: "ding",
      fragmentTypeId: pins.fragmentTypeId,
      preferUtterance: true
    });
    if (ding) forms.push(ding);
    else warnings.push("ding draw failed after retries");
  }
  for (let i = 0; i < jiaCount; i++) {
    const extractGate = i === 0;
    const needHear = !hearingOnAlt && i === 1;
    const forbidHear = hearingOnAlt || extractGate;
    const form = extractGate ? drawOne(rng, {
      portfolio: "jia",
      fragmentTypeId: pins.fragmentTypeId,
      coverage: "infiltrate",
      rhythm: "rhythm_open",
      motion: "motion_patrol",
      sense: "sense_cone"
    }) : drawOne(rng, {
      portfolio: "jia",
      fragmentTypeId: pins.fragmentTypeId,
      motion: "motion_patrol",
      sense: needHear ? "sense_hear" : void 0,
      forbidSense: forbidHear ? ["sense_hear"] : needHear ? void 0 : ["sense_hear"]
    });
    if (!form) {
      warnings.push(`jia[${i}] draw failed after retries`);
      continue;
    }
    if (extractGate) forms.unshift(form);
    else forms.push(form);
  }
  if (pins.paintCount > 0) {
    const bing = drawOne(rng, {
      portfolio: "bing",
      fragmentTypeId: pins.fragmentTypeId,
      preferUtterance: true
    });
    if (bing) {
      for (let i = 0; i < pins.paintCount; i++) forms.push(bing);
    } else {
      warnings.push("bing draw failed after retries");
    }
  }
  const hearCount = forms.filter((f) => f.lexemes.sense === "sense_hear").length;
  if (pins.hearingAxisTaken) {
    if (hearCount !== 0) warnings.push(`hearing axis already taken but draw produced ${hearCount}`);
  } else if (hearCount !== 1) {
    const jiaIdx = forms.findIndex((f) => f.portfolio === "jia" && f.lexemes.sense !== "sense_cone");
    if (hearCount === 0 && jiaIdx >= 0) {
      const patched = drawOne(rng, {
        portfolio: "jia",
        fragmentTypeId: pins.fragmentTypeId,
        sense: "sense_hear",
        motion: "motion_patrol",
        coverage: "rewrite"
      });
      if (patched) forms[jiaIdx] = patched;
    }
    const again = forms.filter((f) => f.lexemes.sense === "sense_hear").length;
    if (again !== 1) warnings.push(`hearing axis count ${again} (want 1)`);
  }
  return { forms, warnings };
}

// src/generation/outline-mask.ts
var DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
function at2(cols, col, row) {
  return row * cols + col;
}
function inBounds(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function landOrOobNeighbors8(land, cols, rows, col, row) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds(cols, rows, nx, ny) || land[at2(cols, nx, ny)]) n++;
    }
  }
  return n;
}
function largestComponent(land, cols, rows) {
  const seen = new Uint8Array(cols * rows);
  let best = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at2(cols, col, row);
      if (!land[i] || seen[i]) continue;
      const stack = [i];
      seen[i] = 1;
      const cells = [];
      while (stack.length > 0) {
        const cur = stack.pop();
        cells.push(cur);
        const c = cur % cols;
        const r = cur / cols | 0;
        for (const [dx, dy] of DIRS4) {
          const nx = c + dx;
          const ny = r + dy;
          if (!inBounds(cols, rows, nx, ny)) continue;
          const ni = at2(cols, nx, ny);
          if (seen[ni] || !land[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (cells.length > best.length) best = cells;
    }
  }
  const out = new Uint8Array(cols * rows);
  for (const i of best) out[i] = 1;
  return out;
}
function measureOutline(land, cols, rows) {
  const ring = GAME_CONSTANTS.GENERATION.BORDER_RING;
  let landCount2 = 0;
  let minCol = cols;
  let minRow = rows;
  let maxCol = -1;
  let maxRow = -1;
  let ringLand = 0;
  let roughCells = 0;
  const edgeHas = [false, false, false, false];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at2(cols, col, row)]) continue;
      landCount2++;
      if (col < minCol) minCol = col;
      if (row < minRow) minRow = row;
      if (col > maxCol) maxCol = col;
      if (row > maxRow) maxRow = row;
      if (col < ring || row < ring || col >= cols - ring || row >= rows - ring) {
        ringLand++;
      }
      if (col === 0) edgeHas[0] = true;
      if (col === cols - 1) edgeHas[1] = true;
      if (row === 0) edgeHas[2] = true;
      if (row === rows - 1) edgeHas[3] = true;
      let touchesVoid = false;
      for (const [dx, dy] of DIRS4) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds(cols, rows, nx, ny) || !land[at2(cols, nx, ny)]) {
          touchesVoid = true;
          break;
        }
      }
      if (touchesVoid) roughCells++;
    }
  }
  const width = landCount2 === 0 ? 0 : maxCol - minCol + 1;
  const height = landCount2 === 0 ? 0 : maxRow - minRow + 1;
  const bboxArea = Math.max(1, width * height);
  const innerW = Math.max(0, cols - ring * 2);
  const innerH = Math.max(0, rows - ring * 2);
  const ringCells = cols * rows - innerW * innerH;
  return {
    landCount: landCount2,
    fillRatio: landCount2 / (cols * rows),
    bbox: {
      minCol: landCount2 === 0 ? 0 : minCol,
      minRow: landCount2 === 0 ? 0 : minRow,
      maxCol: landCount2 === 0 ? 0 : maxCol,
      maxRow: landCount2 === 0 ? 0 : maxRow,
      width,
      height
    },
    bboxFill: landCount2 / bboxArea,
    borderOccupancy: ringCells === 0 ? 0 : ringLand / ringCells,
    edgesTouching: edgeHas.filter(Boolean).length,
    roughness: landCount2 === 0 ? 0 : roughCells / landCount2
  };
}
function evaluateOutline(land, cols, rows) {
  const g = GAME_CONSTANTS.GENERATION;
  const metrics = measureOutline(land, cols, rows);
  const reasons = [];
  if (metrics.landCount === 0) reasons.push("empty");
  if (metrics.fillRatio < g.LAND_FILL_MIN) reasons.push("too-small");
  if (metrics.fillRatio > g.LAND_FILL_MAX) reasons.push("fills-buffer");
  if (metrics.borderOccupancy > g.BORDER_OCCUPANCY_MAX) reasons.push("hugs-frame");
  if (metrics.bboxFill > g.BBOX_FILL_MAX) reasons.push("filled-rectangle");
  if (metrics.roughness < g.ROUGHNESS_MIN) reasons.push("smooth-box");
  if (metrics.edgesTouching > g.MAX_EDGES_TOUCHING) reasons.push("touches-all-sides");
  const slack = cols - metrics.bbox.width + (rows - metrics.bbox.height);
  if (slack < g.MIN_BBOX_SLACK) reasons.push("flush-with-buffer");
  const nibbled = metrics.bbox.width >= cols - 4 && metrics.bbox.height >= rows - 4 && metrics.bboxFill > 0.72;
  if (nibbled) reasons.push("nibbled-rectangle");
  if (reasons.length > 0) {
    return { ok: false, reasons, metrics };
  }
  return { ok: true, reasons: [], metrics };
}
function growErode(rng, cols, rows) {
  const land = new Uint8Array(cols * rows);
  const walkers = 4 + rng.nextInt(0, 2);
  for (let s = 0; s < walkers; s++) {
    let x = Math.floor(cols * (0.24 + rng.next() * 0.52));
    let y = Math.floor(rows * (0.24 + rng.next() * 0.52));
    const steps = 130 + rng.nextInt(0, 110);
    for (let i = 0; i < steps; i++) {
      land[at2(cols, x, y)] = 1;
      const horizontal = rng.next() < 0.6;
      if (horizontal) x += rng.next() < 0.5 ? 1 : -1;
      else y += rng.next() < 0.5 ? 1 : -1;
      x = Math.max(3, Math.min(cols - 4, x));
      y = Math.max(3, Math.min(rows - 4, y));
    }
  }
  const growIters = 8 + rng.nextInt(0, 3);
  for (let iter = 0; iter < growIters; iter++) {
    const next = new Uint8Array(land);
    for (let y = 2; y < rows - 2; y++) {
      for (let x = 2; x < cols - 2; x++) {
        const n = landOrOobNeighbors8(land, cols, rows, x, y);
        if (!land[at2(cols, x, y)] && n >= 3 && rng.next() < 0.7) {
          next[at2(cols, x, y)] = 1;
        }
      }
    }
    land.set(next);
  }
  const erodeIters = 4 + rng.nextInt(0, 2);
  for (let iter = 0; iter < erodeIters; iter++) {
    const next = new Uint8Array(land);
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const n = landOrOobNeighbors8(land, cols, rows, x, y);
        if (land[at2(cols, x, y)] && n <= 2) next[at2(cols, x, y)] = 0;
      }
    }
    land.set(next);
  }
  return largestComponent(land, cols, rows);
}
function toTileMap(land, cols, rows) {
  const tiles = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < cols; col++) {
      line.push(land[at2(cols, col, row)] ? 1 /* FLOOR */ : 3 /* VOID */);
    }
    tiles.push(line);
  }
  return {
    cols,
    rows,
    tileSize: GAME_CONSTANTS.TILE_SIZE,
    tiles
  };
}
function tryGenerateOutlineOnce(attemptSeed, cols = GAME_CONSTANTS.GENERATION.BUFFER_COLS, rows = GAME_CONSTANTS.GENERATION.BUFFER_ROWS) {
  const rng = new SeededRandom(attemptSeed);
  const land = growErode(rng, cols, rows);
  const verdict = evaluateOutline(land, cols, rows);
  if (!verdict.ok) return verdict;
  return {
    seed: attemptSeed,
    attempt: 0,
    cols,
    rows,
    tileSize: GAME_CONSTANTS.TILE_SIZE,
    land,
    tileMap: toTileMap(land, cols, rows),
    metrics: verdict.metrics
  };
}
function generateOutline(seed) {
  const cols = GAME_CONSTANTS.GENERATION.BUFFER_COLS;
  const rows = GAME_CONSTANTS.GENERATION.BUFFER_ROWS;
  const max = GAME_CONSTANTS.GENERATION.MAX_OUTLINE_ATTEMPTS;
  let last = null;
  for (let attempt = 0; attempt < max; attempt++) {
    const attemptSeed = seed + attempt * 2654435769 >>> 0;
    const result = tryGenerateOutlineOnce(attemptSeed, cols, rows);
    if ("tileMap" in result) {
      return { ...result, seed, attempt };
    }
    last = result;
  }
  const why = last?.reasons.join(", ") ?? "unknown";
  throw new Error(
    `generateOutline: seed ${seed} produced no usable land after ${max} attempts (${why})`
  );
}

// src/generation/terrain-safe-volume-seat.ts
function isMaterialVolume(substrate) {
  return substrate === "gas_mass" || substrate === "mist_bank" || substrate === "dust_swarm";
}
function findTerrainSafeVolumeSeat(corridors, isWalkable) {
  let best, bestArea = 0;
  for (const box of corridors) {
    const width = box.maxCol - box.minCol + 1;
    const heights = new Int32Array(width), stack = new Int32Array(width + 1);
    for (let row = box.minRow; row <= box.maxRow; row++) {
      for (let col = 0; col < width; col++) heights[col] = isWalkable(box.minCol + col, row) ? heights[col] + 1 : 0;
      let top = -1;
      for (let right = 0; right <= width; right++) {
        const height = right === width ? 0 : heights[right];
        while (top >= 0 && heights[stack[top]] > height) {
          const h = heights[stack[top--]], left = top < 0 ? 0 : stack[top] + 1, w = right - left;
          if (h < 2 || w < 2) continue;
          const area = h * w, minCol = box.minCol + left, minRow = row - h + 1;
          if (area < bestArea || area === bestArea && best && (minRow > best.minRow || minRow === best.minRow && minCol >= best.minCol)) continue;
          bestArea = area;
          best = {
            minCol,
            minRow,
            maxCol: box.minCol + right - 1,
            maxRow: row,
            coreCol: minCol + Math.floor((w - 1) / 2),
            coreRow: minRow + Math.floor((h - 1) / 2)
          };
        }
        stack[++top] = right;
      }
    }
  }
  return best;
}

// src/generation/wall-host-placement.ts
function doorwayWallSeats(edges, grid) {
  const seats = [];
  const walls = new Set(edges.flatMap((edge) => edge.tiles.map((t) => `${t.col},${t.row}`)));
  for (const edge of edges) {
    const floors = new Set(edge.strikeFloors.map((f) => `${f.col},${f.row}`));
    for (const tile of edge.tiles) for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const col = tile.col + nx, row = tile.row + ny;
      if (!floors.has(`${col},${row}`) || grid.isOpaque(col, row)) continue;
      const tx = -ny, ty = nx;
      const end = [1, -1].some((sign) => floors.has(`${tile.col + tx * sign},${tile.row + ty * sign}`) && !grid.isOpaque(tile.col + tx * sign, tile.row + ty * sign) && floors.has(`${col + tx * sign},${row + ty * sign}`) && !grid.isOpaque(col + tx * sign, row + ty * sign) && walls.has(`${tile.col - tx * sign},${tile.row - ty * sign}`));
      let passage = false;
      for (let width = 1; width <= 3; width++) {
        if (!floors.has(`${tile.col + nx * width},${tile.row + ny * width}`) && grid.isOpaque(tile.col + nx * width, tile.row + ny * width)) break;
        const beyond = width + 1;
        if (walls.has(`${tile.col + nx * beyond},${tile.row + ny * beyond}`)) {
          passage = !grid.isOpaque(col + tx, row + ty) && !grid.isOpaque(col - tx, row - ty);
          break;
        }
      }
      if (end || passage) seats.push({ tiles: [tile], strikeFloors: [{ col, row }] });
    }
  }
  return seats;
}

// src/generated/enemy-data.ts
var ENEMY_DATA = {
  infiltrator: {
    role: "infiltrator",
    displayName: "\u6E17\u900F\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 55,
    sightRangePeriph: 90,
    sightHalfAnglePeriph: 90,
    chaseSightRange: 210,
    hearingRange: 100,
    hearingMoveMult: 1,
    hearingStillRange: 0,
    hearingWallFactor: 0.6,
    visionWeight: 1,
    hearingWeight: 0,
    hearingMaxPush: "suspicious",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  },
  rewriter: {
    role: "rewriter",
    displayName: "\u6539\u5199\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 32,
    sightRangePeriph: 56,
    sightHalfAnglePeriph: 50,
    chaseSightRange: 210,
    hearingRange: 150,
    hearingMoveMult: 2,
    hearingStillRange: 40,
    hearingWallFactor: 0.6,
    visionWeight: 0.45,
    hearingWeight: 1,
    hearingMaxPush: "alert",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  }
};

// src/generation/connectivity.ts
var DIRS42 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
function at3(cols, col, row) {
  return row * cols + col;
}
function inBounds2(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function labelFloors(land, walls, cols, rows) {
  const total = cols * rows;
  const labels = new Int32Array(total);
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (!land[i] || walls[i] || labels[i]) continue;
    count++;
    const stack = [i];
    labels[i] = count;
    while (stack.length > 0) {
      const cur = stack.pop();
      const col = cur % cols;
      const row = cur / cols | 0;
      for (const [dx, dy] of DIRS42) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds2(cols, rows, nx, ny)) continue;
        const ni = at3(cols, nx, ny);
        if (labels[ni] || !land[ni] || walls[ni]) continue;
        labels[ni] = count;
        stack.push(ni);
      }
    }
  }
  return { labels, count };
}
function countWalkableComponents(land, walls, cols, rows) {
  return labelFloors(land, walls, cols, rows).count;
}
function leftoverDisconnectedCount(land, walls, cols, rows) {
  const { labels, count } = labelFloors(land, walls, cols, rows);
  if (count <= 1) return 0;
  const sizes = new Array(count + 1).fill(0);
  for (let i = 0; i < labels.length; i++) sizes[labels[i]]++;
  let best = 0;
  for (let k = 1; k <= count; k++) if (sizes[k] > best) best = sizes[k];
  let floor = 0;
  for (let i = 0; i < land.length; i++) if (land[i] && !walls[i]) floor++;
  return floor - best;
}
function openSealedFloors(land, walls, cols, rows, keep) {
  let punched = 0;
  for (let iter = 0; iter < 48; iter++) {
    const { labels, count } = labelFloors(land, walls, cols, rows);
    if (count <= 1) return punched;
    const sizes = new Array(count + 1).fill(0);
    for (let i = 0; i < labels.length; i++) sizes[labels[i]]++;
    let main = 1;
    for (let k = 2; k <= count; k++) if (sizes[k] > sizes[main]) main = k;
    let both = -1;
    let leftoverOnly = -1;
    for (let i = 0; i < walls.length; i++) {
      if (!walls[i] || !land[i]) continue;
      if (keep && keep[i]) continue;
      const col = i % cols;
      const row = i / cols | 0;
      let touchMain = false;
      let touchLeftover = false;
      for (const [dx, dy] of DIRS42) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds2(cols, rows, nx, ny)) continue;
        const id = labels[at3(cols, nx, ny)];
        if (id === main) touchMain = true;
        else if (id > 0) touchLeftover = true;
      }
      if (touchMain && touchLeftover) {
        both = i;
        break;
      }
      if (touchLeftover && leftoverOnly < 0) leftoverOnly = i;
    }
    const hit = both >= 0 ? both : leftoverOnly;
    if (hit < 0) return punched;
    walls[hit] = 0;
    punched++;
  }
  return punched;
}
function assertSingleWalkable(land, walls, cols, rows, label) {
  const n = countWalkableComponents(land, walls, cols, rows);
  if (n === 1) return;
  throw new Error(`${label}: walkable components = ${n}, need 1`);
}

// src/generation/masses.ts
function at4(cols, col, row) {
  return row * cols + col;
}
function maxOpenYardRect(land, walls, cols, rows) {
  const hist = new Array(cols).fill(0);
  let best = { col: 0, row: 0, width: 0, height: 0, area: 0 };
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at4(cols, col, row);
      hist[col] = land[i] && !walls[i] ? hist[col] + 1 : 0;
    }
    const stack = [];
    for (let col = 0; col <= cols; col++) {
      const h = col < cols ? hist[col] : 0;
      while (stack.length > 0 && hist[stack[stack.length - 1]] > h) {
        const hh = hist[stack.pop()];
        const left = stack.length > 0 ? stack[stack.length - 1] + 1 : 0;
        const width = col - left;
        const area = hh * width;
        if (area > best.area) {
          best = { col: left, row: row - hh + 1, width, height: hh, area };
        }
      }
      if (col < cols) stack.push(col);
    }
  }
  return best;
}
function maxOpenYard(land, walls, cols, rows) {
  return maxOpenYardRect(land, walls, cols, rows).area;
}

// src/generation/cover.ts
var WALL_RATIO_CAP = 0.18;
function at5(cols, col, row) {
  return row * cols + col;
}
function inBounds3(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function isFloor(land, walls, cols, rows, col, row) {
  if (!inBounds3(cols, rows, col, row)) return false;
  const i = at5(cols, col, row);
  return !!land[i] && !walls[i];
}
function landCount(land) {
  let n = 0;
  for (let i = 0; i < land.length; i++) if (land[i]) n++;
  return n;
}
function wallCount(walls) {
  let n = 0;
  for (let i = 0; i < walls.length; i++) if (walls[i]) n++;
  return n;
}
function voidDist(land, cols, rows, col, row) {
  let best = cols + rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (land[at5(cols, c, r)]) continue;
      const d = Math.abs(c - col) + Math.abs(r - row);
      if (d < best) best = d;
    }
  }
  return best;
}
function abutsReservedWall(walls, reserved, cols, rows, col, row) {
  for (const [dx, dy] of ROOT_DIRS) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds3(cols, rows, nc, nr)) continue;
    const i = at5(cols, nc, nr);
    if (reserved[i] && walls[i]) return true;
  }
  return false;
}
function tryAddWalls(land, walls, cols, rows, cells, avoid) {
  if (cells.length === 0) return false;
  const trial = new Uint8Array(walls);
  let stamped = 0;
  for (const cell of cells) {
    if (!isFloor(land, walls, cols, rows, cell.col, cell.row)) continue;
    const i = at5(cols, cell.col, cell.row);
    if (avoid && avoid[i]) continue;
    if (avoid && abutsReservedWall(walls, avoid, cols, rows, cell.col, cell.row)) continue;
    trial[i] = 1;
    stamped++;
  }
  if (stamped === 0) return false;
  if (countWalkableComponents(land, trial, cols, rows) !== 1) return false;
  walls.set(trial);
  return true;
}
function tryPunchLand(land, walls, cols, rows, cells, avoid) {
  if (cells.length === 0) return false;
  const trialLand = new Uint8Array(land);
  const trialWalls = new Uint8Array(walls);
  for (const cell of cells) {
    const i = at5(cols, cell.col, cell.row);
    if (!land[i]) return false;
    if (avoid && avoid[i]) return false;
    trialLand[i] = 0;
    trialWalls[i] = 0;
  }
  const empty = new Uint8Array(land.length);
  if (countWalkableComponents(trialLand, empty, cols, rows) !== 1) return false;
  if (countWalkableComponents(trialLand, trialWalls, cols, rows) !== 1) return false;
  land.set(trialLand);
  walls.set(trialWalls);
  return true;
}
function paintAround(land, walls, cols, rows, near, role, radius) {
  const paint = [];
  const seen = /* @__PURE__ */ new Set();
  for (const cell of near) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const col = cell.col + dx;
        const row = cell.row + dy;
        if (!isFloor(land, walls, cols, rows, col, row)) continue;
        const i = at5(cols, col, row);
        if (seen.has(i)) continue;
        seen.add(i);
        paint.push({ col, row, role });
      }
    }
  }
  return paint;
}
function pickFloor(land, walls, cols, rows, rng, used, minDist, preferOpen) {
  const yard = maxOpenYardRect(land, walls, cols, rows);
  const candidates = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < minDist)) continue;
      if (preferOpen) {
        const inYard = col >= yard.col && col < yard.col + yard.width && row >= yard.row && row < yard.row + yard.height;
        if (!inYard && yard.area > 8) continue;
      }
      candidates.push({ col, row });
    }
  }
  if (candidates.length === 0) {
    if (preferOpen) return pickFloor(land, walls, cols, rows, rng, used, minDist, false);
    return null;
  }
  return candidates[rng.nextInt(0, candidates.length - 1)];
}
function clumpCells(seed, rng) {
  const w = rng.nextInt(2, 3);
  const h = rng.nextInt(2, 3);
  const cells = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) cells.push({ col: seed.col + dx, row: seed.row + dy });
  }
  return cells;
}
function wallNormal(walls, cols, rows, col, row) {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ]) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds3(cols, rows, nc, nr)) continue;
    if (walls[at5(cols, nc, nr)]) return { dx, dy };
  }
  return null;
}
function pickAbutting(land, walls, cols, rows, rng, used, minDist) {
  const candidates = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      if (!wallNormal(walls, cols, rows, col, row)) continue;
      if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < minDist)) continue;
      candidates.push({ col, row });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[rng.nextInt(0, candidates.length - 1)];
}
function abutMass(kind, seed, walls, cols, rows, rng) {
  const n = wallNormal(walls, cols, rows, seed.col, seed.row);
  if (kind === "clump" || !n) return clumpCells(seed, rng);
  const alongX = n.dy !== 0;
  const long = rng.nextInt(4, 6);
  const cells = [];
  for (let a = 0; a < long; a++) {
    for (let t = 0; t < 2; t++) {
      const col = alongX ? seed.col + a : seed.col - n.dx * t;
      const row = alongX ? seed.row - n.dy * t : seed.row + a;
      cells.push({ col, row });
    }
  }
  return cells;
}
function remainsCells(seed, rng) {
  return clumpCells(seed, rng).slice(0, rng.nextInt(3, 4));
}
var ROOT_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
function boleCells(seed) {
  return [
    { col: seed.col, row: seed.row },
    { col: seed.col + 1, row: seed.row },
    { col: seed.col, row: seed.row + 1 },
    { col: seed.col + 1, row: seed.row + 1 }
  ];
}
function canPlaceBole(land, walls, cols, rows, seed, clearRing) {
  const bole = boleCells(seed);
  for (const cell of bole) {
    if (!isFloor(land, walls, cols, rows, cell.col, cell.row)) return false;
  }
  const mine = new Set(bole.map((c) => `${c.col},${c.row}`));
  for (const cell of bole) {
    if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return false;
  }
  if (!clearRing) return true;
  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      const col = seed.col + dx;
      const row = seed.row + dy;
      if (!inBounds3(cols, rows, col, row)) continue;
      if (walls[at5(cols, col, row)]) return false;
    }
  }
  return true;
}
function growRoots(land, walls, cols, rows, seed, rng) {
  const order = [...ROOT_DIRS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  const rootN = rng.nextInt(3, 4);
  const seen = new Set(boleCells(seed).map((c) => `${c.col},${c.row}`));
  const roots = [];
  for (let r = 0; r < rootN; r++) {
    const [dx, dy] = order[r];
    const len = rng.nextInt(2, 4);
    let col = dx > 0 ? seed.col + 1 : dx < 0 ? seed.col : seed.col + (rng.next() < 0.5 ? 0 : 1);
    let row = dy > 0 ? seed.row + 1 : dy < 0 ? seed.row : seed.row + (rng.next() < 0.5 ? 0 : 1);
    const arm = [];
    for (let k = 0; k < len; k++) {
      col += dx;
      row += dy;
      if (!isFloor(land, walls, cols, rows, col, row)) break;
      if (touchesForeignWall(walls, cols, rows, col, row, seen)) break;
      const key = `${col},${row}`;
      if (seen.has(key) || arm.some((c) => `${c.col},${c.row}` === key)) continue;
      arm.push({ col, row });
    }
    if (arm.length < 2) continue;
    for (const cell of arm) {
      seen.add(`${cell.col},${cell.row}`);
      roots.push(cell);
    }
  }
  return roots;
}
function growStump(land, walls, cols, rows, seed, clearRing, rng) {
  if (!canPlaceBole(land, walls, cols, rows, seed, clearRing)) return null;
  const bole = boleCells(seed);
  const roots = growRoots(land, walls, cols, rows, seed, rng);
  const mine = new Set([...bole, ...roots].map((c) => `${c.col},${c.row}`));
  for (const cell of [...bole, ...roots]) {
    if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return { bole, roots: [] };
  }
  return { bole, roots };
}
function touchesForeignWall(walls, cols, rows, col, row, mine) {
  for (const [dx, dy] of ROOT_DIRS) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds3(cols, rows, nc, nr)) continue;
    if (!walls[at5(cols, nc, nr)]) continue;
    if (!mine.has(`${nc},${nr}`)) return true;
  }
  return false;
}
function markStumpReserve(reserved, cols, rows, seed, cells) {
  const stamp2 = (col, row) => {
    if (!inBounds3(cols, rows, col, row)) return;
    reserved[at5(cols, col, row)] = 1;
  };
  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -1; dx <= 2; dx++) stamp2(seed.col + dx, seed.row + dy);
  }
  for (const cell of cells) {
    stamp2(cell.col, cell.row);
    stamp2(cell.col + 1, cell.row);
    stamp2(cell.col - 1, cell.row);
    stamp2(cell.col, cell.row + 1);
    stamp2(cell.col, cell.row - 1);
  }
}
function collectStumpSites(land, walls, cols, rows, used, blocked, clearRing) {
  const seeds = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < 10)) continue;
      if (blocked.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < 2)) continue;
      const seed = { col, row };
      if (!canPlaceBole(land, walls, cols, rows, seed, clearRing)) continue;
      seeds.push(seed);
    }
  }
  return seeds;
}
function scoreStumpSite(land, walls, cols, rows, seed) {
  const yard = maxOpenYardRect(land, walls, cols, rows);
  const inYard = seed.col >= yard.col && seed.col < yard.col + yard.width && seed.row >= yard.row && seed.row < yard.row + yard.height;
  const nearWall2 = wallNormal(walls, cols, rows, seed.col, seed.row) ? 20 : 0;
  return (inYard ? 8 : 0) + nearWall2 + voidDist(land, cols, rows, seed.col, seed.row);
}
function pickStumpSite(land, walls, cols, rows, used, blocked, rng) {
  for (const clearRing of [true, false]) {
    const sites = collectStumpSites(land, walls, cols, rows, used, blocked, clearRing);
    if (sites.length === 0) continue;
    const ranked = sites.map((seed2) => ({ seed: seed2, score: scoreStumpSite(land, walls, cols, rows, seed2) })).sort((a, b) => b.score - a.score);
    const cut = Math.max(1, ranked.length * 0.4 | 0);
    const pool = ranked.slice(0, cut);
    const seed = pool[rng.nextInt(0, pool.length - 1)].seed;
    const grown = growStump(land, walls, cols, rows, seed, clearRing, rng);
    if (grown) return { seed, bole: grown.bole, roots: grown.roots };
  }
  return null;
}
function hollowCells(land, walls, cols, rows, seed, rng) {
  const rad = rng.nextInt(1, 2);
  const cells = [];
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad + 1) continue;
      const col = seed.col + dx;
      const row = seed.row + dy;
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      cells.push({ col, row });
    }
  }
  return cells;
}
function applyCover(land, walls, cols, rows, spec, rng) {
  const paint = [];
  const used = [];
  const reserved = new Uint8Array(land.length);
  const place = (cells, around, radius) => {
    if (!tryAddWalls(land, walls, cols, rows, cells, reserved)) return false;
    used.push(cells[0]);
    if (around) paint.push(...paintAround(land, walls, cols, rows, cells, around, radius));
    return true;
  };
  const blocked = [];
  for (let t = 0; t < spec.trees; t++) {
    let placed = false;
    for (let tryN = 0; tryN < 20 && !placed; tryN++) {
      const site = pickStumpSite(land, walls, cols, rows, used, blocked, rng);
      if (!site) break;
      const withRoots = site.bole.concat(site.roots);
      const cells = tryAddWalls(land, walls, cols, rows, withRoots, reserved) ? withRoots : tryAddWalls(land, walls, cols, rows, site.bole, reserved) ? site.bole : null;
      if (!cells) {
        blocked.push(site.seed);
        continue;
      }
      used.push(site.seed);
      markStumpReserve(reserved, cols, rows, site.seed, cells);
      for (const cell of site.bole) {
        const i = at5(cols, cell.col, cell.row);
        if (land[i] && walls[i]) paint.push({ col: cell.col, row: cell.row, role: "stump" });
      }
      if (cells.length > site.bole.length) {
        for (const cell of site.roots) {
          const i = at5(cols, cell.col, cell.row);
          if (land[i] && walls[i]) paint.push({ col: cell.col, row: cell.row, role: "root" });
        }
      }
      placed = true;
    }
  }
  for (let r = 0; r < spec.remains; r++) {
    const seed = pickAbutting(land, walls, cols, rows, rng, used, 6) ?? pickFloor(land, walls, cols, rows, rng, used, 7, false);
    if (!seed) break;
    place(remainsCells(seed, rng), "wreck", 1);
  }
  for (let h = 0; h < spec.hollows; h++) {
    let placed = false;
    for (let tryN = 0; tryN < 24 && !placed; tryN++) {
      const seed = pickFloor(land, walls, cols, rows, rng, used, 8, false);
      if (!seed) break;
      if (voidDist(land, cols, rows, seed.col, seed.row) < 3) continue;
      const cells = hollowCells(land, walls, cols, rows, seed, rng);
      if (tryPunchLand(land, walls, cols, rows, cells, reserved)) {
        used.push(seed);
        placed = true;
      }
    }
  }
  const cycle = spec.cycle.length > 0 ? spec.cycle : ["clump", "plate"];
  const cutN = Math.min(spec.cuts, 4);
  for (let c = 0; c < cutN; c++) {
    const landN = landCount(land);
    const ratio = landN === 0 ? 0 : wallCount(walls) / landN;
    if (ratio >= WALL_RATIO_CAP) break;
    const kind = cycle[c % cycle.length] === "stub" ? "clump" : cycle[c % cycle.length];
    const seed = pickAbutting(land, walls, cols, rows, rng, used, 5);
    if (!seed) break;
    const cells = abutMass(kind, seed, walls, cols, rows, rng);
    if (place(cells, null, 0)) continue;
    place(clumpCells(seed, rng), null, 0);
  }
  return paint;
}
function stumpTouchesStone(walls, cols, rows, paint) {
  const wood = paint.filter((c) => c.role === "stump" || c.role === "root");
  const mine = new Set(wood.map((c) => `${c.col},${c.row}`));
  for (const cell of wood) {
    if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return true;
  }
  return false;
}
function countBoles(paint, walls, cols) {
  const stumps = paint.filter((c) => {
    if (c.role !== "stump") return false;
    if (!walls || cols === void 0) return true;
    return !!walls[c.row * cols + c.col];
  });
  let n = 0;
  const seen = /* @__PURE__ */ new Set();
  for (const cell of stumps) {
    for (const [ox, oy] of [
      [0, 0],
      [-1, 0],
      [0, -1],
      [-1, -1]
    ]) {
      const c0 = cell.col + ox;
      const r0 = cell.row + oy;
      const key = `${c0},${r0}`;
      if (seen.has(key)) continue;
      const has = (dc, dr) => stumps.some((c) => c.col === c0 + dc && c.row === r0 + dr);
      if (has(0, 0) && has(1, 0) && has(0, 1) && has(1, 1)) {
        seen.add(key);
        n++;
      }
    }
  }
  return n;
}

// src/generation/silhouette.ts
var DIRS43 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
function at6(cols, col, row) {
  return row * cols + col;
}
function inBounds4(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function woodMask(cols, rows, paint) {
  const wood = new Uint8Array(cols * rows);
  for (const cell of paint) {
    if (cell.role !== "stump" && cell.role !== "root") continue;
    if (!inBounds4(cols, rows, cell.col, cell.row)) continue;
    wood[at6(cols, cell.col, cell.row)] = 1;
  }
  return wood;
}
function isStone(walls, wood, cols, col, row) {
  const i = at6(cols, col, row);
  return !!walls[i] && !wood[i];
}
function isFloor2(land, walls, cols, col, row) {
  const i = at6(cols, col, row);
  return !!land[i] && !walls[i];
}
function thickStoneMask(walls, wood, cols, rows) {
  const thick = new Uint8Array(walls.length);
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      if (isStone(walls, wood, cols, col, row) && isStone(walls, wood, cols, col + 1, row) && isStone(walls, wood, cols, col, row + 1) && isStone(walls, wood, cols, col + 1, row + 1)) {
        thick[at6(cols, col, row)] = 1;
        thick[at6(cols, col + 1, row)] = 1;
        thick[at6(cols, col, row + 1)] = 1;
        thick[at6(cols, col + 1, row + 1)] = 1;
      }
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at6(cols, col, row);
      if (wood[i] && walls[i]) thick[i] = 1;
    }
  }
  return thick;
}
function maxThinRun(walls, wood, thick, cols, rows) {
  const thin = (col, row) => {
    if (!inBounds4(cols, rows, col, row)) return false;
    const i = at6(cols, col, row);
    return !!walls[i] && !wood[i] && !thick[i];
  };
  let best = 0;
  for (let row = 0; row < rows; row++) {
    let run = 0;
    for (let col = 0; col <= cols; col++) {
      if (col < cols && thin(col, row)) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
  }
  for (let col = 0; col < cols; col++) {
    let run = 0;
    for (let row = 0; row <= rows; row++) {
      if (row < rows && thin(col, row)) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
  }
  return best;
}
function narrowSlotCount(land, walls, wood, cols, rows) {
  const stone = (c, r) => inBounds4(cols, rows, c, r) && isStone(walls, wood, cols, c, r);
  const floor = (c, r) => inBounds4(cols, rows, c, r) && isFloor2(land, walls, cols, c, r);
  let n = 0;
  const seen = /* @__PURE__ */ new Set();
  const mark = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    n++;
  };
  for (let row = 0; row < rows; row++) {
    for (let gap = 1; gap <= 2; gap++) {
      let run = 0;
      for (let col = 0; col <= cols; col++) {
        const ok = col < cols && stone(col, row) && stone(col, row + gap + 1) && Array.from({ length: gap }, (_, k) => floor(col, row + 1 + k)).every(Boolean);
        if (ok) {
          run++;
          if (run === 4) mark(`h:${row}:${gap}:${col - 3}`);
        } else run = 0;
      }
    }
  }
  for (let col = 0; col < cols; col++) {
    for (let gap = 1; gap <= 2; gap++) {
      let run = 0;
      for (let row = 0; row <= rows; row++) {
        const ok = row < rows && stone(col, row) && stone(col + gap + 1, row) && Array.from({ length: gap }, (_, k) => floor(col + 1 + k, row)).every(Boolean);
        if (ok) {
          run++;
          if (run === 4) mark(`v:${col}:${gap}:${row - 3}`);
        } else run = 0;
      }
    }
  }
  return n;
}
function perpFloorSpan(land, walls, cols, rows, col, row, horizontal) {
  if (horizontal) {
    let a2 = row;
    while (a2 - 1 >= 0 && isFloor2(land, walls, cols, col, a2 - 1)) a2--;
    let b2 = row;
    while (b2 + 1 < rows && isFloor2(land, walls, cols, col, b2 + 1)) b2++;
    const span2 = b2 - a2 + 1;
    const walled2 = (a2 - 1 < 0 || !!walls[at6(cols, col, a2 - 1)]) && (b2 + 1 >= rows || !!walls[at6(cols, col, b2 + 1)]);
    return { span: span2, walled: walled2 };
  }
  let a = col;
  while (a - 1 >= 0 && isFloor2(land, walls, cols, a - 1, row)) a--;
  let b = col;
  while (b + 1 < cols && isFloor2(land, walls, cols, b + 1, row)) b++;
  const span = b - a + 1;
  const walled = (a - 1 < 0 || !!walls[at6(cols, a - 1, row)]) && (b + 1 >= cols || !!walls[at6(cols, b + 1, row)]);
  return { span, walled };
}
function maxWalledAlley(land, walls, cols, rows) {
  let best = 0;
  for (let row = 0; row < rows; row++) {
    let run = 0;
    for (let col = 0; col <= cols; col++) {
      const ok = col < cols && isFloor2(land, walls, cols, col, row) && (() => {
        const p = perpFloorSpan(land, walls, cols, rows, col, row, true);
        return p.walled && p.span >= 2 && p.span <= 4;
      })();
      if (ok) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
  }
  for (let col = 0; col < cols; col++) {
    let run = 0;
    for (let row = 0; row <= rows; row++) {
      const ok = row < rows && isFloor2(land, walls, cols, col, row) && (() => {
        const p = perpFloorSpan(land, walls, cols, rows, col, row, false);
        return p.walled && p.span >= 2 && p.span <= 4;
      })();
      if (ok) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
  }
  return best;
}
function oneWideStep(land, walls, wood, cols, rows, col, row, dx, dy) {
  const nc = col + dx;
  const nr = row + dy;
  if (!inBounds4(cols, rows, nc, nr) || !isFloor2(land, walls, cols, nc, nr)) return false;
  const horiz = dx !== 0;
  const p = perpFloorSpan(land, walls, cols, rows, nc, nr, horiz);
  if (p.span !== 1 || !p.walled) return false;
  const sideA = horiz ? [nc, nr - 1] : [nc - 1, nr];
  const sideB = horiz ? [nc, nr + 1] : [nc + 1, nr];
  const stoneA = inBounds4(cols, rows, sideA[0], sideA[1]) && isStone(walls, wood, cols, sideA[0], sideA[1]);
  const stoneB = inBounds4(cols, rows, sideB[0], sideB[1]) && isStone(walls, wood, cols, sideB[0], sideB[1]);
  return stoneA && stoneB;
}
function threeWayAlleyCount(land, walls, wood, cols, rows) {
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFloor2(land, walls, cols, col, row)) continue;
      let arms = 0;
      for (const [dx, dy] of DIRS43) {
        if (oneWideStep(land, walls, wood, cols, rows, col, row, dx, dy)) arms++;
      }
      if (arms >= 3) n++;
    }
  }
  return n;
}
function openYardWithEdgeCover(land, walls, thick, cols, rows) {
  const SIZE = 6;
  for (let row = 0; row <= rows - SIZE; row++) {
    for (let col = 0; col <= cols - SIZE; col++) {
      let open = true;
      for (let r = row; r < row + SIZE && open; r++) {
        for (let c = col; c < col + SIZE; c++) {
          const i = at6(cols, c, r);
          if (!land[i] || walls[i]) {
            open = false;
            break;
          }
        }
      }
      if (!open) continue;
      for (let r = row - 2; r < row + SIZE + 2; r++) {
        for (let c = col - 2; c < col + SIZE + 2; c++) {
          if (!inBounds4(cols, rows, c, r)) continue;
          const inside = c >= col && c < col + SIZE && r >= row && r < row + SIZE;
          if (inside) continue;
          if (thick[at6(cols, c, r)]) return true;
        }
      }
    }
  }
  return false;
}
function measureSilhouette(land, walls, cols, rows, paint = []) {
  const wood = woodMask(cols, rows, paint);
  const thick = thickStoneMask(walls, wood, cols, rows);
  let landN = 0;
  let wallN = 0;
  let stoneN = 0;
  let thickN = 0;
  for (let i = 0; i < land.length; i++) {
    if (land[i]) landN++;
    if (!walls[i]) continue;
    wallN++;
    if (wood[i]) {
      if (thick[i]) thickN++;
      continue;
    }
    stoneN++;
    if (thick[i]) thickN++;
  }
  const thickRatio = wallN === 0 ? 1 : thickN / wallN;
  return {
    thinRun: maxThinRun(walls, wood, thick, cols, rows),
    thickRatio,
    narrowSlots: narrowSlotCount(land, walls, wood, cols, rows),
    threeWayAlleys: threeWayAlleyCount(land, walls, wood, cols, rows),
    openYardCovered: openYardWithEdgeCover(land, walls, thick, cols, rows),
    longAlley: maxWalledAlley(land, walls, cols, rows),
    wallRatio: landN === 0 ? 0 : wallN / landN
  };
}
function silhouetteFails(m) {
  if (m.thinRun > 6) return `thin run ${m.thinRun} > 6`;
  if (m.thickRatio < 0.5) return `thick ratio ${m.thickRatio.toFixed(2)} < 0.5`;
  if (m.narrowSlots > 0) return `narrow slots ${m.narrowSlots}`;
  if (m.threeWayAlleys > 0) return `three-way alleys ${m.threeWayAlleys}`;
  if (!m.openYardCovered) return "no 6x6 yard with edge cover";
  if (m.longAlley > 8) return `walled alley ${m.longAlley} > 8`;
  if (m.wallRatio > 0.18 + 1e-6) return `wall ratio ${(m.wallRatio * 100).toFixed(1)}% > 18%`;
  return null;
}

// src/generation/stealth-density.ts
var DIRS44 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
var WALL_FILL_CAP = 0.17;
var WALL_HARD_CAP = 0.18;
var P90_TARGET = 7;
var P90_GATE = 8;
var YARD_TARGET = 96;
var YARD_GATE = 112;
var FAR_COVER = 7;
var FAR_BLOB_GATE = 48;
var PLAZA = 6;
var MIN_STAMP = 4;
function at7(cols, col, row) {
  return row * cols + col;
}
function inBounds5(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function isFloor3(land, walls, cols, rows, col, row) {
  if (!inBounds5(cols, rows, col, row)) return false;
  const i = at7(cols, col, row);
  return !!land[i] && !walls[i];
}
function wallRatio(land, walls) {
  let landN = 0;
  let wallN = 0;
  for (let i = 0; i < land.length; i++) {
    if (land[i]) landN++;
    if (walls[i]) wallN++;
  }
  return landN === 0 ? 0 : wallN / landN;
}
function rect(ox, oy, w, h) {
  const cells = [];
  for (let row = oy; row < oy + h; row++) {
    for (let col = ox; col < ox + w; col++) cells.push({ col, row });
  }
  return cells;
}
function voidDistField(land, cols, rows) {
  const dist = new Int16Array(land.length);
  dist.fill(32767);
  const q = [];
  for (let i = 0; i < land.length; i++) {
    if (land[i]) continue;
    dist[i] = 0;
    q.push(i);
  }
  for (let head = 0; head < q.length; head++) {
    const i = q[head];
    const col = i % cols;
    const row = i / cols | 0;
    const d = dist[i];
    for (const [dx, dy] of DIRS44) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds5(cols, rows, nc, nr)) continue;
      const ni = at7(cols, nc, nr);
      if (dist[ni] <= d + 1) continue;
      dist[ni] = d + 1;
      q.push(ni);
    }
  }
  return dist;
}
function nearestWallField(land, walls, cols, rows) {
  const dist = new Int16Array(land.length);
  dist.fill(32767);
  const q = [];
  for (let i = 0; i < land.length; i++) {
    if (!land[i] || !walls[i]) continue;
    dist[i] = 0;
    q.push(i);
  }
  for (let head = 0; head < q.length; head++) {
    const i = q[head];
    const col = i % cols;
    const row = i / cols | 0;
    const d = dist[i];
    for (const [dx, dy] of DIRS44) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds5(cols, rows, nc, nr)) continue;
      const ni = at7(cols, nc, nr);
      if (!land[ni] || dist[ni] <= d + 1) continue;
      dist[ni] = d + 1;
      q.push(ni);
    }
  }
  return dist;
}
function coverDistanceField(land, walls, cols, rows, paint = []) {
  const wood = woodMask(cols, rows, paint);
  const thick = thickStoneMask(walls, wood, cols, rows);
  const dist = new Float32Array(land.length);
  dist.fill(1e9);
  const q = [];
  for (let i = 0; i < land.length; i++) {
    if (!thick[i] || !walls[i]) continue;
    dist[i] = 0;
    q.push(i);
  }
  for (let head = 0; head < q.length; head++) {
    const i = q[head];
    const col = i % cols;
    const row = i / cols | 0;
    const d = dist[i];
    for (const [dx, dy] of DIRS44) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds5(cols, rows, nc, nr)) continue;
      const ni = at7(cols, nc, nr);
      if (!land[ni] || dist[ni] <= d + 1) continue;
      dist[ni] = d + 1;
      q.push(ni);
    }
  }
  return dist;
}
function measureCoverReach(land, walls, cols, rows, paint = []) {
  const dist = coverDistanceField(land, walls, cols, rows, paint);
  const vals = [];
  for (let i = 0; i < land.length; i++) {
    if (!land[i] || walls[i]) continue;
    const d = dist[i];
    if (d > 1e8) continue;
    vals.push(d);
  }
  vals.sort((a, b) => a - b);
  const median = vals.length === 0 ? 99 : vals[vals.length / 2 | 0];
  const p90 = vals.length === 0 ? 99 : vals[Math.min(vals.length - 1, vals.length * 0.9 | 0)];
  const seen = new Uint8Array(land.length);
  let farBlob = 0;
  for (let i = 0; i < land.length; i++) {
    if (seen[i] || !land[i] || walls[i] || dist[i] <= FAR_COVER || dist[i] > 1e8) continue;
    let n = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const cur = stack.pop();
      n++;
      const col = cur % cols;
      const row = cur / cols | 0;
      for (const [dx, dy] of DIRS44) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds5(cols, rows, nc, nr)) continue;
        const ni = at7(cols, nc, nr);
        if (seen[ni] || !land[ni] || walls[ni] || dist[ni] <= FAR_COVER || dist[ni] > 1e8) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (n > farBlob) farBlob = n;
  }
  return { median, p90, farBlob };
}
function coverReachFails(m, maxYard = 0, rimRing = false) {
  if (m.p90 > P90_GATE + 1e-6) return `cover p90 ${m.p90.toFixed(1)} > ${P90_GATE}`;
  if (m.farBlob > FAR_BLOB_GATE) return `cover far-blob ${m.farBlob} > ${FAR_BLOB_GATE}`;
  if (!rimRing && maxYard > YARD_GATE) return `open yard ${maxYard} > ${YARD_GATE}`;
  return null;
}
function stealthSpecFor(recipe) {
  const g = recipe.structure.grammar;
  const plateish = recipe.cover.cycle.includes("plate");
  return {
    allowDivider: g === "ridge" || g === "orthoRidge" || g === "twinRidge" || g === "pads" || g === "plates" || g === "hunks",
    maxDividers: g === "orthoRidge" || g === "pads" || g === "plates" || g === "hunks" ? 1 : 2,
    rimRing: g === "rim",
    preferPlate: plateish && g !== "plates" && g !== "hunks",
    maxFlangesPerMass: g === "plates" ? 1 : 2,
    minGap: g === "shear" || g === "plates" ? 5 : 4
  };
}
function blockedCell(ctx, col, row) {
  const { cols, rows, keepWood, plaza } = ctx;
  if (!inBounds5(cols, rows, col, row)) return true;
  const i = at7(cols, col, row);
  if (keepWood[i] || plaza[i]) return true;
  for (const [dx, dy] of DIRS44) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds5(cols, rows, nc, nr)) continue;
    if (keepWood[at7(cols, nc, nr)]) return true;
  }
  return false;
}
function tryStamp(ctx, cells) {
  const { land, walls, cols, rows, paint } = ctx;
  if (wallRatio(land, walls) >= WALL_HARD_CAP) return false;
  const trial = new Uint8Array(walls);
  let n = 0;
  for (const cell of cells) {
    if (!isFloor3(land, trial, cols, rows, cell.col, cell.row)) continue;
    if (blockedCell(ctx, cell.col, cell.row)) continue;
    trial[at7(cols, cell.col, cell.row)] = 1;
    n++;
  }
  if (n < MIN_STAMP) return false;
  if (wallRatio(land, trial) > WALL_HARD_CAP + 1e-6) return false;
  if (countWalkableComponents(land, trial, cols, rows) !== 1) return false;
  const sil = measureSilhouette(land, trial, cols, rows, paint);
  if (silhouetteFails(sil)) return false;
  walls.set(trial);
  return true;
}
function markPlaza(ctx, col, row) {
  const { cols, rows, plaza } = ctx;
  for (let r = row; r < row + PLAZA; r++) {
    for (let c = col; c < col + PLAZA; c++) {
      if (!inBounds5(cols, rows, c, r)) continue;
      plaza[at7(cols, c, r)] = 1;
    }
  }
}
function reservePlaza(ctx) {
  const { land, walls, cols, rows, paint, spec, voidDist: voidDist2 } = ctx;
  const wood = woodMask(cols, rows, paint);
  const thick = thickStoneMask(walls, wood, cols, rows);
  let best = null;
  for (let row2 = 0; row2 <= rows - PLAZA; row2++) {
    for (let col2 = 0; col2 <= cols - PLAZA; col2++) {
      let open = true;
      let minVoid = 999;
      for (let r = row2; r < row2 + PLAZA && open; r++) {
        for (let c = col2; c < col2 + PLAZA; c++) {
          const i = at7(cols, c, r);
          if (!land[i] || walls[i]) {
            open = false;
            break;
          }
          if (voidDist2[i] < minVoid) minVoid = voidDist2[i];
        }
      }
      if (!open) continue;
      let edged = false;
      for (let r = row2 - 2; r < row2 + PLAZA + 2 && !edged; r++) {
        for (let c = col2 - 2; c < col2 + PLAZA + 2; c++) {
          if (!inBounds5(cols, rows, c, r)) continue;
          const inside = c >= col2 && c < col2 + PLAZA && r >= row2 && r < row2 + PLAZA;
          if (inside) continue;
          if (thick[at7(cols, c, r)]) {
            edged = true;
            break;
          }
        }
      }
      if (!edged) continue;
      const score = minVoid;
      if (!best || score > best.score) best = { col: col2, row: row2, score };
    }
  }
  if (best) {
    markPlaza(ctx, best.col, best.row);
    return;
  }
  if (spec.rimRing) {
    let deep = null;
    for (let row2 = 0; row2 <= rows - PLAZA; row2++) {
      for (let col2 = 0; col2 <= cols - PLAZA; col2++) {
        let open = true;
        let minVoid = 999;
        for (let r = row2; r < row2 + PLAZA && open; r++) {
          for (let c = col2; c < col2 + PLAZA; c++) {
            const i = at7(cols, c, r);
            if (!land[i] || walls[i]) {
              open = false;
              break;
            }
            if (voidDist2[i] < minVoid) minVoid = voidDist2[i];
          }
        }
        if (!open) continue;
        if (!deep || minVoid > deep.score) deep = { col: col2, row: row2, score: minVoid };
      }
    }
    if (deep) markPlaza(ctx, deep.col, deep.row);
    return;
  }
  const yard = maxOpenYardRect(land, walls, cols, rows);
  if (yard.width < PLAZA || yard.height < PLAZA) return;
  const col = yard.col + Math.max(0, (yard.width - PLAZA) / 2 | 0);
  const row = yard.row + Math.max(0, (yard.height - PLAZA) / 2 | 0);
  markPlaza(ctx, col, row);
}
function dividerCells(yard, endEastOrSouth) {
  const gap = 6;
  const thick = 2;
  const cells = [];
  if (yard.width >= yard.height) {
    const row0 = yard.row + Math.max(5, Math.min(yard.height - 7, (yard.height - thick) / 2 | 0));
    const run = Math.max(6, yard.width - gap);
    const start = endEastOrSouth ? 0 : yard.width - run;
    for (let k = 0; k < run; k++) {
      for (let t = 0; t < thick; t++) {
        cells.push({ col: yard.col + start + k, row: row0 + t });
      }
    }
  } else {
    const col0 = yard.col + Math.max(5, Math.min(yard.width - 7, (yard.width - thick) / 2 | 0));
    const run = Math.max(6, yard.height - gap);
    const start = endEastOrSouth ? 0 : yard.height - run;
    for (let k = 0; k < run; k++) {
      for (let t = 0; t < thick; t++) {
        cells.push({ col: col0 + t, row: yard.row + start + k });
      }
    }
  }
  return cells;
}
function placeDividers(ctx) {
  if (!ctx.spec.allowDivider || ctx.spec.rimRing) return;
  for (let n = 0; n < ctx.spec.maxDividers; n++) {
    const yard = maxOpenYardRect(ctx.land, ctx.walls, ctx.cols, ctx.rows);
    if (yard.area < 88) break;
    if (yard.width < 12 || yard.height < 12) break;
    const end = ctx.rng.next() < 0.5;
    if (tryStamp(ctx, dividerCells(yard, end))) continue;
    if (tryStamp(ctx, dividerCells(yard, !end))) continue;
    break;
  }
}
function wallComponents(ctx) {
  const { land, walls, cols, rows } = ctx;
  const seen = new Uint8Array(walls.length);
  const out = [];
  for (let i = 0; i < walls.length; i++) {
    if (!walls[i] || !land[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    const cells = [i];
    while (stack.length > 0) {
      const cur = stack.pop();
      const col = cur % cols;
      const row = cur / cols | 0;
      for (const [dx, dy] of DIRS44) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds5(cols, rows, nc, nr)) continue;
        const ni = at7(cols, nc, nr);
        if (seen[ni] || !walls[ni] || !land[ni]) continue;
        seen[ni] = 1;
        stack.push(ni);
        cells.push(ni);
      }
    }
    out.push(cells);
  }
  return out;
}
function flangeTouchesForeign(ctx, cells, mother) {
  const { walls, cols, rows } = ctx;
  const self = new Set(cells.map((c) => at7(cols, c.col, c.row)));
  for (const cell of cells) {
    let onMother = false;
    for (const [dx, dy] of DIRS44) {
      const ni = inBounds5(cols, rows, cell.col + dx, cell.row + dy) ? at7(cols, cell.col + dx, cell.row + dy) : -1;
      if (ni >= 0 && mother.has(ni)) onMother = true;
    }
    if (onMother) continue;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dc === 0 && dr === 0) continue;
        const nc = cell.col + dc;
        const nr = cell.row + dr;
        if (!inBounds5(cols, rows, nc, nr)) continue;
        const ni = at7(cols, nc, nr);
        if (!walls[ni]) continue;
        if (mother.has(ni) || self.has(ni)) continue;
        if (Math.abs(dc) + Math.abs(dr) <= 3) return true;
      }
    }
  }
  return false;
}
function placeFlanges(ctx) {
  const comps = wallComponents(ctx).filter((c) => c.length >= 6);
  for (const comp of comps) {
    const mother = new Set(comp);
    const tips = [];
    for (const i of comp) {
      const col = i % ctx.cols;
      const row = i / ctx.cols | 0;
      for (const [dx, dy] of DIRS44) {
        let open = 0;
        for (let k = 1; k <= 5; k++) {
          if (!isFloor3(ctx.land, ctx.walls, ctx.cols, ctx.rows, col + dx * k, row + dy * k)) break;
          if (blockedCell(ctx, col + dx * k, row + dy * k)) break;
          open++;
        }
        if (open < 4) continue;
        if (ctx.spec.rimRing) {
          const baseV = ctx.voidDist[at7(ctx.cols, col, row)];
          const tipV = ctx.voidDist[at7(ctx.cols, col + dx * 4, row + dy * 4)];
          if (tipV <= baseV) continue;
        }
        tips.push({ col, row, dx, dy, open });
      }
    }
    tips.sort((a, b) => b.open - a.open);
    let placed = 0;
    for (const tip of tips) {
      if (placed >= ctx.spec.maxFlangesPerMass) break;
      const cells = [];
      const px = -tip.dy;
      const py = tip.dx;
      for (let k = 1; k <= 4; k++) {
        const col = tip.col + tip.dx * k;
        const row = tip.row + tip.dy * k;
        cells.push({ col, row });
        cells.push({ col: col + px, row: row + py });
      }
      if (flangeTouchesForeign(ctx, cells, mother)) continue;
      if (tryStamp(ctx, cells)) placed++;
    }
  }
}
function inRimRing(ctx, col, row) {
  if (!ctx.spec.rimRing) return true;
  const d = ctx.voidDist[at7(ctx.cols, col, row)];
  return d >= 2 && d <= 10;
}
function pickSplitInYard(ctx, minWall, skip) {
  const { land, walls, cols, rows } = ctx;
  const yard = maxOpenYardRect(land, walls, cols, rows);
  const dist = nearestWallField(land, walls, cols, rows);
  let best = null;
  for (let row = yard.row; row < yard.row + yard.height - 3; row++) {
    for (let col = yard.col; col < yard.col + yard.width - 3; col++) {
      if (skip.has(at7(cols, col, row))) continue;
      if (blockedCell(ctx, col, row)) continue;
      if (!inRimRing(ctx, col, row)) continue;
      if (!isFloor3(land, walls, cols, rows, col, row)) continue;
      const d = dist[at7(cols, col, row)];
      if (d < minWall) continue;
      if (!best || d > best.dist) best = { col, row, dist: d };
    }
  }
  return best ? { col: best.col, row: best.row } : null;
}
function farthestFloor(ctx) {
  const { land, walls, cols, rows } = ctx;
  const dist = nearestWallField(land, walls, cols, rows);
  let best = null;
  for (let row = 0; row < rows - 2; row++) {
    for (let col = 0; col < cols - 2; col++) {
      if (blockedCell(ctx, col, row)) continue;
      if (!inRimRing(ctx, col, row)) continue;
      if (!isFloor3(land, walls, cols, rows, col, row)) continue;
      const d = dist[at7(cols, col, row)];
      if (!best || d > best.dist) best = { col, row, dist: d };
    }
  }
  return best;
}
function stampFamily(ctx, seed) {
  const { rng, spec } = ctx;
  if (spec.preferPlate) {
    const long = rng.nextInt(4, 5);
    const horizontal = rng.next() < 0.5;
    const cells = horizontal ? rect(seed.col, seed.row, long, 2) : rect(seed.col, seed.row, 2, long);
    if (tryStamp(ctx, cells)) return true;
  }
  const w = rng.nextInt(3, 4);
  const h = rng.nextInt(3, 4);
  if (tryStamp(ctx, rect(seed.col, seed.row, w, h))) return true;
  return tryStamp(ctx, rect(seed.col, seed.row, 3, 3));
}
function fillHoles(ctx) {
  const skip = /* @__PURE__ */ new Set();
  for (let n = 0; n < 48; n++) {
    const ratio = wallRatio(ctx.land, ctx.walls);
    if (ratio >= WALL_FILL_CAP) break;
    const reach = measureCoverReach(ctx.land, ctx.walls, ctx.cols, ctx.rows, ctx.paint);
    const yard = maxOpenYard(ctx.land, ctx.walls, ctx.cols, ctx.rows);
    if (yard <= YARD_TARGET && reach.p90 <= P90_TARGET) break;
    const gap = yard > YARD_TARGET ? Math.min(4, ctx.spec.minGap) : ctx.spec.minGap;
    let seed = pickSplitInYard(ctx, gap, skip);
    const far = farthestFloor(ctx);
    if (!seed && far && far.dist > gap && !skip.has(at7(ctx.cols, far.col, far.row))) {
      seed = { col: Math.max(0, far.col - 1), row: Math.max(0, far.row - 1) };
    }
    if (!seed) break;
    if (stampFamily(ctx, seed)) continue;
    skip.add(at7(ctx.cols, seed.col, seed.row));
    if (far) skip.add(at7(ctx.cols, far.col, far.row));
  }
}
function applyStealthDensity(land, walls, cols, rows, paint, keepWood, rng, spec) {
  const ctx = {
    land,
    walls,
    cols,
    rows,
    paint,
    keepWood,
    plaza: new Uint8Array(land.length),
    voidDist: voidDistField(land, cols, rows),
    rng,
    spec
  };
  placeDividers(ctx);
  reservePlaza(ctx);
  fillHoles(ctx);
  placeFlanges(ctx);
  fillHoles(ctx);
}

// src/generation/structure-grammars.ts
var DIRS45 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
var DIRS8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
];
function at8(cols, col, row) {
  return row * cols + col;
}
function inBounds6(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function isLand(land, cols, rows, col, row) {
  return inBounds6(cols, rows, col, row) && !!land[at8(cols, col, row)];
}
function landBBox(land, cols, rows) {
  let minC = cols;
  let minR = rows;
  let maxC = 0;
  let maxR = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at8(cols, col, row)]) continue;
      if (col < minC) minC = col;
      if (row < minR) minR = row;
      if (col > maxC) maxC = col;
      if (row > maxR) maxR = row;
    }
  }
  return { minC, minR, maxC, maxR, width: maxC - minC + 1, height: maxR - minR + 1 };
}
function thicken2(spine, land, cols, rows) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const cell of spine) {
    for (const extra of solidRect(cell.col, cell.row, 2, 2, land, cols, rows)) {
      const i = at8(cols, extra.col, extra.row);
      if (seen.has(i)) continue;
      seen.add(i);
      out.push(extra);
    }
  }
  return out;
}
function stamp(walls, cells, cols) {
  for (const cell of cells) walls[at8(cols, cell.col, cell.row)] = 1;
}
function raiseNear(land, walls, cols, rows, near, radius) {
  const paint = [];
  const seen = /* @__PURE__ */ new Set();
  for (const cell of near) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const col = cell.col + dx;
        const row = cell.row + dy;
        if (!isLand(land, cols, rows, col, row)) continue;
        const i = at8(cols, col, row);
        if (walls[i] || seen.has(i)) continue;
        seen.add(i);
        paint.push({ col, row, role: "debris" });
      }
    }
  }
  return paint;
}
function pickLand(land, cols, rows, rng, n, minDist, filter) {
  const all = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at8(cols, col, row)]) continue;
      const cell = { col, row };
      if (filter && !filter(cell)) continue;
      all.push(cell);
    }
  }
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 600 && all.length > 0) {
    const cell = all[rng.nextInt(0, all.length - 1)];
    if (out.some((p) => Math.abs(p.col - cell.col) + Math.abs(p.row - cell.row) < minDist)) continue;
    out.push(cell);
  }
  return out;
}
function nearVoid(land, cols, rows, col, row) {
  for (const [dx, dy] of DIRS45) {
    if (!isLand(land, cols, rows, col + dx, row + dy)) return true;
  }
  return false;
}
function pickInterior(land, cols, rows, rng, inset = 3) {
  const box = landBBox(land, cols, rows);
  const hits = [];
  const minC = box.minC + inset;
  const maxC = box.maxC - inset;
  const minR = box.minR + inset;
  const maxR = box.maxR - inset;
  for (let row = minR; row <= maxR; row++) {
    for (let col = minC; col <= maxC; col++) {
      if (isLand(land, cols, rows, col, row)) hits.push({ col, row });
    }
  }
  if (hits.length === 0) return pickLand(land, cols, rows, rng, 1, 1)[0] ?? null;
  return hits[rng.nextInt(0, hits.length - 1)];
}
function walkLimited(land, cols, rows, start, dx, dy, len, rng, bend) {
  const cells = [];
  const seen = /* @__PURE__ */ new Set();
  let col = start.col;
  let row = start.row;
  let ux = dx;
  let uy = dy;
  const bendAt = bend ? len / 2 | 0 : -1;
  for (let step = 0; step < len; step++) {
    const key = `${col},${row}`;
    if (!seen.has(key) && isLand(land, cols, rows, col, row)) {
      seen.add(key);
      cells.push({ col, row });
    }
    if (step === bendAt) {
      const left = rng.next() < 0.5;
      const nx = left ? -uy : uy;
      const ny = left ? ux : -ux;
      ux = nx;
      uy = ny;
    }
    let nc = col + ux;
    let nr = row + uy;
    if (bend && rng.next() < 0.28) {
      nc += rng.next() < 0.5 ? -uy : uy;
      nr += rng.next() < 0.5 ? ux : -ux;
    }
    if (!isLand(land, cols, rows, nc, nr)) {
      const opts = [];
      for (const [sx, sy] of DIRS8) {
        if (isLand(land, cols, rows, col + sx, row + sy) && !seen.has(`${col + sx},${row + sy}`)) {
          opts.push({ col: col + sx, row: row + sy });
        }
      }
      if (opts.length === 0) break;
      const pick = opts[rng.nextInt(0, opts.length - 1)];
      nc = pick.col;
      nr = pick.row;
    }
    col = nc;
    row = nr;
  }
  return cells;
}
function heading(rng) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];
  const d = dirs[rng.nextInt(0, dirs.length - 1)];
  return { dx: d[0], dy: d[1] };
}
function splitGap(spine, gapAt, gap) {
  return spine.filter((_, i) => i < gapAt || i >= gapAt + gap);
}
function solidRect(ox, oy, w, h, land, cols, rows) {
  const cells = [];
  for (let row = oy; row < oy + h; row++) {
    for (let col = ox; col < ox + w; col++) {
      if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
    }
  }
  return cells;
}
function buildRidge(outline, rng, spec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint = [];
  const start = pickInterior(land, cols, rows, rng, 4);
  if (!start) return { walls, paint };
  const { dx, dy } = heading(rng);
  const len = rng.nextInt(7, 10);
  const spine = walkLimited(land, cols, rows, start, dx, dy, len, rng, true);
  const gapped = splitGap(spine, Math.max(2, (spine.length / 2 | 0) - 1), 2);
  stamp(walls, thicken2(gapped, land, cols, rows), cols);
  const nugs = 1 + (rng.next() < spec.density ? 1 : 0);
  for (const seed of pickLand(land, cols, rows, rng, nugs, 6)) {
    if (Math.abs(seed.col - start.col) + Math.abs(seed.row - start.row) > 8) continue;
    stamp(walls, solidRect(seed.col, seed.row, rng.nextInt(2, 3), rng.nextInt(2, 3), land, cols, rows), cols);
  }
  paint.push(...raiseNear(land, walls, cols, rows, gapped, 2));
  return { walls, paint };
}
function buildShear(outline, rng, spec) {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const walls = new Uint8Array(land.length);
  const paint = [];
  const vertical = box.height >= box.width * 0.7;
  const segments = 2 + (spec.density > 0.55 ? 1 : 0);
  const lipLen = rng.nextInt(4, 7);
  const thick = Math.max(2, spec.thickness);
  const gap = thick + 3 + (rng.next() < 0.5 ? 1 : 0);
  const axis0 = vertical ? box.minR + 3 + rng.nextInt(0, Math.max(1, box.height - lipLen - 8)) : box.minC + 3 + rng.nextInt(0, Math.max(1, box.width - lipLen - 8));
  const cross = vertical ? box.minC + (box.width / 2 | 0) - (gap / 2 | 0) : box.minR + (box.height / 2 | 0) - (gap / 2 | 0);
  for (let s = 0; s < segments; s++) {
    const stagger = s * (lipLen + 1);
    const along = axis0 + stagger;
    const shift = s % 2 * gap;
    const cells = [];
    for (let k = 0; k < lipLen; k++) {
      for (let t = 0; t < thick; t++) {
        const col = vertical ? cross + shift + t : along + k;
        const row = vertical ? along + k : cross + shift + t;
        if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
      }
    }
    stamp(walls, cells, cols);
    paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  }
  return { walls, paint };
}
function buildHunks(outline, rng, spec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint = [];
  const n = 3 + (spec.density > 0.6 ? 2 : 1);
  const seeds = pickLand(land, cols, rows, rng, n, 7);
  for (const seed of seeds) {
    const w = rng.nextInt(2, 4);
    const h = rng.nextInt(2, 4);
    const cells = solidRect(seed.col, seed.row, w, h, land, cols, rows);
    stamp(walls, cells, cols);
    paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  }
  return { walls, paint };
}
function buildRim(outline, rng, spec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint = [];
  const n = 2 + (spec.density > 0.6 ? 1 : 0);
  const seeds = pickLand(land, cols, rows, rng, n, 8, (c) => nearVoid(land, cols, rows, c.col, c.row));
  for (const seed of seeds) {
    const alongEdge = [seed];
    let col = seed.col;
    let row = seed.row;
    for (let step = 0; step < rng.nextInt(5, 8); step++) {
      let next = null;
      for (const [dx, dy] of DIRS45) {
        const nc = col + dx;
        const nr = row + dy;
        if (!isLand(land, cols, rows, nc, nr)) continue;
        if (!nearVoid(land, cols, rows, nc, nr)) continue;
        if (alongEdge.some((c) => c.col === nc && c.row === nr)) continue;
        next = { col: nc, row: nr };
        break;
      }
      if (!next) break;
      alongEdge.push(next);
      col = next.col;
      row = next.row;
    }
    stamp(walls, thicken2(alongEdge, land, cols, rows), cols);
    paint.push(...raiseNear(land, walls, cols, rows, alongEdge, 1));
  }
  return { walls, paint };
}
function buildOrthoRidge(outline, rng, spec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint = [];
  const start = pickInterior(land, cols, rows, rng, 4);
  if (!start) return { walls, paint };
  const arm = rng.nextInt(4, 6);
  const thick = Math.max(2, spec.thickness);
  const horizFirst = rng.next() < 0.5;
  const sH = rng.next() < 0.5 ? 1 : -1;
  const sV = rng.next() < 0.5 ? 1 : -1;
  const cells = [];
  const addArm = (dx, dy) => {
    for (let k = 0; k < arm; k++) {
      for (let t = 0; t < thick; t++) {
        const col = start.col + dx * k + (dy !== 0 ? t : 0);
        const row = start.row + dy * k + (dx !== 0 ? t : 0);
        if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
      }
    }
  };
  if (horizFirst) {
    addArm(sH, 0);
    addArm(0, sV);
  } else {
    addArm(0, sV);
    addArm(sH, 0);
  }
  stamp(walls, cells, cols);
  paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  return { walls, paint };
}
function buildTwinRidge(outline, rng, spec) {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const walls = new Uint8Array(land.length);
  const paint = [];
  const horiz = box.width >= box.height;
  const len = rng.nextInt(5, 6);
  const thick = Math.max(2, spec.thickness);
  const spacing = 3;
  const cx = box.minC + (box.width / 2 | 0) - ((horiz ? len : thick) / 2 | 0);
  const cy = box.minR + (box.height / 2 | 0) - ((horiz ? thick : len) / 2 | 0);
  const cells = [];
  for (let beam = 0; beam < 2; beam++) {
    const off = beam * (thick + spacing);
    for (let k = 0; k < len; k++) {
      for (let t = 0; t < thick; t++) {
        const col = horiz ? cx + k : cx + off + t;
        const row = horiz ? cy + off + t : cy + k;
        if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
      }
    }
  }
  stamp(walls, cells, cols);
  paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  return { walls, paint };
}
function buildPlates(outline, rng, spec) {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const walls = new Uint8Array(land.length);
  const paint = [];
  const horiz = box.width >= box.height;
  const n = 2 + (spec.density > 0.65 ? 1 : 0);
  const thick = Math.max(2, spec.thickness);
  const spacing = 4;
  for (let i = 0; i < n; i++) {
    const len = rng.nextInt(5, 8);
    const cells = [];
    if (horiz) {
      const row = box.minR + 3 + i * (thick + spacing);
      const start = box.minC + 2 + rng.nextInt(0, 4) + i % 2 * 2;
      for (let k = 0; k < len; k++) {
        for (let w = 0; w < thick; w++) {
          const col = start + k;
          const r = row + w;
          if (isLand(land, cols, rows, col, r)) cells.push({ col, row: r });
        }
      }
    } else {
      const col = box.minC + 3 + i * (thick + spacing);
      const start = box.minR + 2 + rng.nextInt(0, 4) + i % 2 * 2;
      for (let k = 0; k < len; k++) {
        for (let w = 0; w < thick; w++) {
          const c = col + w;
          const row = start + k;
          if (isLand(land, cols, rows, c, row)) cells.push({ col: c, row });
        }
      }
    }
    stamp(walls, cells, cols);
    paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  }
  return { walls, paint };
}
function landInRect(land, cols, rows, minC, minR, w, h) {
  let n = 0;
  for (let row = minR; row < minR + h; row++) {
    for (let col = minC; col < minC + w; col++) {
      if (isLand(land, cols, rows, col, row)) n++;
    }
  }
  return n;
}
function buildPads(outline, rng, spec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint = [];
  const want = spec.density > 0.9 ? 2 : 1;
  const placed = [];
  let guard = 0;
  while (placed.length < want && guard++ < 400) {
    const w = rng.nextInt(8, 10);
    const h = rng.nextInt(7, 9);
    const seed = pickInterior(land, cols, rows, rng, 3);
    if (!seed) break;
    const minC = seed.col - (w / 2 | 0);
    const minR = seed.row - (h / 2 | 0);
    if (landInRect(land, cols, rows, minC, minR, w, h) < w * h * 0.72) continue;
    if (placed.some((p) => Math.abs(p.col - seed.col) + Math.abs(p.row - seed.row) < 10)) continue;
    placed.push(seed);
    const open = rng.nextInt(0, 3);
    const cells = [];
    const ring = 2;
    for (let row = minR; row < minR + h; row++) {
      for (let col = minC; col < minC + w; col++) {
        if (!isLand(land, cols, rows, col, row)) continue;
        const onN = row < minR + ring;
        const onS = row >= minR + h - ring;
        const onW = col < minC + ring;
        const onE = col >= minC + w - ring;
        const onEdge = onN || onS || onW || onE;
        if (!onEdge) {
          paint.push({ col, row, role: "interior" });
          continue;
        }
        if (open === 0 && onN) continue;
        if (open === 1 && onE) continue;
        if (open === 2 && onS) continue;
        if (open === 3 && onW) continue;
        cells.push({ col, row });
      }
    }
    stamp(walls, cells, cols);
  }
  return { walls, paint };
}
function buildStructure(outline, rng, spec) {
  switch (spec.grammar) {
    case "ridge":
      return buildRidge(outline, rng, spec);
    case "shear":
      return buildShear(outline, rng, spec);
    case "hunks":
      return buildHunks(outline, rng, spec);
    case "rim":
      return buildRim(outline, rng, spec);
    case "orthoRidge":
      return buildOrthoRidge(outline, rng, spec);
    case "plates":
      return buildPlates(outline, rng, spec);
    case "twinRidge":
      return buildTwinRidge(outline, rng, spec);
    case "pads":
      return buildPads(outline, rng, spec);
  }
}

// src/generation/draft-pipeline.ts
var MAX_STRUCTURE_ATTEMPTS = 36;
var ROLE_RANK = {
  glitch: 5,
  stump: 4,
  root: 4,
  wreck: 4,
  organic: 3,
  vegetation: 3,
  debris: 2,
  interior: 1
};
var DIRS46 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
function at9(cols, col, row) {
  return row * cols + col;
}
function inBounds7(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function mergePaint(into, extra, cols, rows) {
  const best = /* @__PURE__ */ new Map();
  for (const cell of into.concat(extra)) {
    if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) continue;
    const i = at9(cols, cell.col, cell.row);
    const prev = best.get(i);
    if (!prev || ROLE_RANK[cell.role] >= ROLE_RANK[prev.role]) best.set(i, cell);
  }
  into.length = 0;
  for (const cell of best.values()) into.push(cell);
}
function floorCells(land, walls, cols, rows) {
  const out = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at9(cols, col, row);
      if (land[i] && !walls[i]) out.push({ col, row, i });
    }
  }
  return out;
}
function nearWall(walls, cols, rows, col, row) {
  for (const [dx, dy] of DIRS46) {
    const nx = col + dx;
    const ny = row + dy;
    if (!inBounds7(cols, rows, nx, ny)) continue;
    if (walls[at9(cols, nx, ny)]) return true;
  }
  return false;
}
function nearStump(stumps, col, row) {
  for (const [dx, dy] of DIRS46) {
    if (stumps.has(`${col + dx},${row + dy}`)) return true;
  }
  return stumps.has(`${col},${row}`);
}
function nearVoid2(land, cols, rows, col, row) {
  for (const [dx, dy] of DIRS46) {
    const nx = col + dx;
    const ny = row + dy;
    if (!inBounds7(cols, rows, nx, ny) || !land[at9(cols, nx, ny)]) return true;
  }
  return false;
}
function scatterPaint(land, walls, cols, rows, recipe, rng, stumps) {
  const paint = [];
  const floors = floorCells(land, walls, cols, rows);
  const kind = recipe.scatter.kind;
  for (const cell of floors) {
    const rim = nearVoid2(land, cols, rows, cell.col, cell.row);
    const wall = nearWall(walls, cols, rows, cell.col, cell.row);
    const byStump = nearStump(stumps, cell.col, cell.row);
    let vegChance = recipe.scatter.vegetation;
    if (kind === "none") vegChance = 0;
    if (kind === "rimMoss") vegChance = rim ? recipe.scatter.vegetation : recipe.scatter.vegetation * 0.15;
    if (kind === "thicket") vegChance = wall ? recipe.scatter.vegetation * 1.6 : recipe.scatter.vegetation * 0.35;
    if (kind === "aisleLitter") vegChance = wall ? recipe.scatter.vegetation : 0;
    if (kind === "grassPads") vegChance = wall ? recipe.scatter.vegetation * 0.4 : recipe.scatter.vegetation;
    if (byStump) vegChance *= 0.08;
    if (vegChance > 0 && rng.next() < vegChance) {
      paint.push({ col: cell.col, row: cell.row, role: "vegetation" });
    }
    let wreckChance = recipe.scatter.wreck;
    if (kind === "aisleLitter") wreckChance = wall ? recipe.scatter.wreck * 1.4 : recipe.scatter.wreck;
    if (kind === "grassPads") wreckChance = wall ? 0 : recipe.scatter.wreck;
    if (wreckChance > 0 && rng.next() < wreckChance) {
      paint.push({ col: cell.col, row: cell.row, role: "wreck" });
    }
  }
  const glitchWant = recipe.scatter.glitch;
  const candidates = floors.filter((c) => nearWall(walls, cols, rows, c.col, c.row));
  const pool = candidates.length > 0 ? candidates : floors;
  const used = /* @__PURE__ */ new Set();
  let guard = 0;
  while (used.size < glitchWant && guard++ < 80 && pool.length > 0) {
    const cell = pool[rng.nextInt(0, pool.length - 1)];
    if (used.has(cell.i)) continue;
    used.add(cell.i);
    paint.push({ col: cell.col, row: cell.row, role: "glitch" });
  }
  return paint;
}
function toTileMap2(land, walls, cols, rows, tileSize) {
  const tiles = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < cols; col++) {
      const i = at9(cols, col, row);
      if (!land[i]) line.push(3 /* VOID */);
      else if (walls[i]) line.push(0 /* WALL */);
      else line.push(1 /* FLOOR */);
    }
    tiles.push(line);
  }
  return { cols, rows, tileSize, tiles };
}
function generateRecipeDraft(seed, recipe) {
  const base = generateOutline(seed);
  const cols = base.cols;
  const rows = base.rows;
  const land = new Uint8Array(base.land);
  const { scatterRng, atmosphereRng } = forkMapRngs(seed, recipe.id);
  let walls = new Uint8Array(land.length);
  let structurePaint = [];
  let attempt = 0;
  let ok = false;
  let lastWhy = "no attempt";
  for (; attempt < MAX_STRUCTURE_ATTEMPTS; attempt++) {
    land.set(base.land);
    const forked = forkMapRngs(seed, recipe.id, attempt);
    const built = buildStructure({ ...base, land }, forked.structureRng, recipe.structure);
    walls = new Uint8Array(built.walls);
    structurePaint = built.paint;
    openSealedFloors(land, walls, cols, rows);
    if (countWalkableComponents(land, walls, cols, rows) !== 1) {
      lastWhy = "structure walkable != 1";
      continue;
    }
    const coverPaint = applyCover(land, walls, cols, rows, recipe.cover, forked.coverRng);
    for (let i = 0; i < walls.length; i++) if (!land[i]) walls[i] = 0;
    const keepWood = new Uint8Array(walls.length);
    for (const cell of coverPaint) {
      if (cell.role !== "stump" && cell.role !== "root") continue;
      keepWood[at9(cols, cell.col, cell.row)] = 1;
    }
    openSealedFloors(land, walls, cols, rows, keepWood);
    if (countWalkableComponents(land, walls, cols, rows) !== 1) {
      lastWhy = "cover walkable != 1";
      continue;
    }
    if (stumpTouchesStone(walls, cols, rows, coverPaint)) {
      lastWhy = "stump touches stone";
      continue;
    }
    if (recipe.cover.trees >= 1 && countBoles(coverPaint, walls, cols) < 1) {
      lastWhy = "missing bole";
      continue;
    }
    const painted = structurePaint.concat(coverPaint);
    const spec = stealthSpecFor(recipe);
    applyStealthDensity(
      land,
      walls,
      cols,
      rows,
      painted,
      keepWood,
      forked.densityRng,
      spec
    );
    for (let i = 0; i < walls.length; i++) if (!land[i]) walls[i] = 0;
    openSealedFloors(land, walls, cols, rows, keepWood);
    if (countWalkableComponents(land, walls, cols, rows) !== 1) {
      lastWhy = "density walkable != 1";
      continue;
    }
    if (stumpTouchesStone(walls, cols, rows, coverPaint)) {
      lastWhy = "stump touches stone after density";
      continue;
    }
    const sil = measureSilhouette(land, walls, cols, rows, painted);
    const silFail = silhouetteFails(sil);
    if (silFail) {
      lastWhy = silFail;
      continue;
    }
    const reach = measureCoverReach(land, walls, cols, rows, painted);
    const yardNow = maxOpenYard(land, walls, cols, rows);
    const reachFail = coverReachFails(reach, yardNow, spec.rimRing);
    if (reachFail) {
      lastWhy = reachFail;
      continue;
    }
    structurePaint = painted;
    ok = true;
    break;
  }
  const label = `generateRecipeDraft ${recipe.id} seed ${seed}`;
  if (!ok) {
    throw new Error(`${label}: no connected structure after ${MAX_STRUCTURE_ATTEMPTS} attempts (${lastWhy})`);
  }
  assertSingleWalkable(land, walls, cols, rows, label);
  const paint = structurePaint.filter((c) => {
    const i = at9(cols, c.col, c.row);
    if (!land[i]) return false;
    if (walls[i]) return c.role === "stump" || c.role === "root";
    return true;
  });
  mergePaint(
    paint,
    scatterPaint(
      land,
      walls,
      cols,
      rows,
      recipe,
      scatterRng,
      new Set(
        paint.filter((c) => c.role === "stump" || c.role === "root").map((c) => `${c.col},${c.row}`)
      )
    ),
    cols,
    rows
  );
  const glitches = paint.filter((c) => c.role === "glitch");
  const atmosphere = buildAtmosphere(
    land,
    walls,
    cols,
    rows,
    recipe.atmosphere,
    glitches,
    atmosphereRng
  );
  let wallCount2 = 0;
  let landCount2 = 0;
  for (let i = 0; i < land.length; i++) {
    if (land[i]) landCount2++;
    if (walls[i]) wallCount2++;
  }
  const tileMap = toTileMap2(land, walls, cols, rows, base.tileSize);
  return {
    seed,
    attempt,
    fragmentTypeId: recipe.fragmentTypeId,
    outline: { ...base, land, tileMap },
    walls,
    features: [{ kind: "ridge", cells: [], paint }],
    tileMap,
    metrics: {
      wallCount: wallCount2,
      wallRatio: landCount2 === 0 ? 0 : wallCount2 / landCount2,
      featureCount: 1,
      leftoverConnected: leftoverDisconnectedCount(land, walls, cols, rows) === 0
    },
    overlays: atmosphere.motes,
    atmosphere
  };
}

// src/generation/dual-path.ts
var DIRS47 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
var DUAL_PATH_MIN_LENGTH_RATIO = 1.15;
function at10(cols, col, row) {
  return row * cols + col;
}
function inBounds8(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function bfs(walk, cols, rows, start) {
  const dist = new Int32Array(walk.length).fill(-1);
  const parent = new Int32Array(walk.length).fill(-1);
  if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
  const queue = [start];
  dist[start] = 0;
  let q = 0;
  while (q < queue.length) {
    const cur = queue[q++];
    const col = cur % cols;
    const row = cur / cols | 0;
    const d = dist[cur];
    for (const [dx, dy] of DIRS47) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds8(cols, rows, nx, ny)) continue;
      const ni = at10(cols, nx, ny);
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      parent[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, parent };
}
function reconstruct(parent, start, goal) {
  if (goal < 0 || parent[goal] === void 0) return [];
  const path = [];
  let cur = goal;
  const guard = parent.length + 2;
  let n = 0;
  while (cur !== start && cur >= 0 && n++ < guard) {
    path.push(cur);
    cur = parent[cur];
  }
  if (cur !== start) return [];
  path.push(start);
  path.reverse();
  return path;
}
function wallNeighborCount(walls, cols, rows, cell) {
  const col = cell % cols;
  const row = cell / cols | 0;
  let n = 0;
  for (const [dx, dy] of DIRS47) {
    const nx = col + dx;
    const ny = row + dy;
    if (!inBounds8(cols, rows, nx, ny)) continue;
    if (walls[at10(cols, nx, ny)]) n++;
  }
  return n;
}
function openRatio(path, walls, cols, rows) {
  if (path.length === 0) return 0;
  let open = 0;
  for (const cell of path) {
    if (wallNeighborCount(walls, cols, rows, cell) <= 1) open++;
  }
  return open / path.length;
}
function fail(reason, extra) {
  return {
    ok: false,
    reason,
    mainSteps: extra?.mainSteps ?? -1,
    altSteps: extra?.altSteps ?? -1,
    mainOpenRatio: extra?.mainOpenRatio ?? 0,
    altOpenRatio: extra?.altOpenRatio ?? 0
  };
}
function evaluateDualPath(walk, walls, cols, rows, spawn, extract) {
  if (spawn === extract) return fail("no dual-path");
  if (spawn < 0 || extract < 0 || spawn >= walk.length || extract >= walk.length) {
    return fail("no dual-path");
  }
  if (!walk[spawn] || !walk[extract]) return fail("no dual-path");
  const mainSearch = bfs(walk, cols, rows, spawn);
  const mainSteps = mainSearch.dist[extract];
  if (mainSteps < 0) return fail("no dual-path");
  const mainPath = reconstruct(mainSearch.parent, spawn, extract);
  if (mainPath.length < 2) return fail("no dual-path", { mainSteps });
  const blocked = new Uint8Array(walk);
  for (const cell of mainPath) {
    if (cell !== spawn && cell !== extract) blocked[cell] = 0;
  }
  const altSearch = bfs(blocked, cols, rows, spawn);
  const altSteps = altSearch.dist[extract];
  if (altSteps < 0) return fail("no dual-path", { mainSteps });
  const altPath = reconstruct(altSearch.parent, spawn, extract);
  if (altPath.length < 2) return fail("no dual-path", { mainSteps, altSteps });
  if (altSteps < mainSteps * DUAL_PATH_MIN_LENGTH_RATIO) {
    return fail("no dual-path", { mainSteps, altSteps });
  }
  const mainOpenRatio = openRatio(mainPath, walls, cols, rows);
  const altOpenRatio = openRatio(altPath, walls, cols, rows);
  const mainIsShorter = mainSteps <= altSteps;
  const shortOpen = mainIsShorter ? mainOpenRatio : altOpenRatio;
  const longOpen = mainIsShorter ? altOpenRatio : mainOpenRatio;
  if (!(shortOpen > longOpen)) {
    return fail("no dual-path", { mainSteps, altSteps, mainOpenRatio, altOpenRatio });
  }
  return {
    ok: true,
    reason: "",
    mainSteps,
    altSteps,
    mainOpenRatio,
    altOpenRatio
  };
}

// src/generation/recipes.ts
var PREVIEW_RECIPES = [
  {
    id: "ridge-soil",
    label: "\u541E\u6CA1\u8936\u810A",
    fragmentTypeId: "frag-outdoor",
    structure: { grammar: "ridge", density: 0.55, gapiness: 0.45, thickness: 2, align: "free" },
    cover: { align: "free", trees: 2, remains: 2, hollows: 1, cuts: 2, cycle: ["clump", "plate"] },
    scatter: { kind: "thicket", vegetation: 0.12, wreck: 0.04, glitch: 2 },
    atmosphere: { skyShadow: 0.68, fog: 0.82, motes: 36, seep: 0.28, poolRim: 0.35, poolHollow: 0.25, poolOpen: 0.4 }
  },
  {
    id: "shear-soil",
    label: "\u571F\u58E4\u6495\u7F1D",
    fragmentTypeId: "frag-outdoor",
    structure: { grammar: "shear", density: 0.5, gapiness: 0.4, thickness: 2, align: "free" },
    cover: { align: "free", trees: 1, remains: 2, hollows: 2, cuts: 2, cycle: ["clump", "plate"] },
    scatter: { kind: "thicket", vegetation: 0.1, wreck: 0.03, glitch: 3 },
    atmosphere: { skyShadow: 0.72, fog: 0.76, motes: 28, seep: 0.38, poolRim: 0.28, poolHollow: 0.5, poolOpen: 0.22 }
  },
  {
    id: "hunks-soil",
    label: "\u56ED\u7F18\u6B8B\u4F53",
    fragmentTypeId: "frag-outdoor",
    structure: { grammar: "hunks", density: 0.7, gapiness: 0.5, thickness: 2, align: "free" },
    cover: { align: "free", trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ["clump"] },
    scatter: { kind: "thicket", vegetation: 0.08, wreck: 0.07, glitch: 1 },
    atmosphere: { skyShadow: 0.58, fog: 0.7, motes: 24, seep: 0.22, poolRim: 0.42, poolHollow: 0.28, poolOpen: 0.3 }
  },
  {
    id: "rim-soil",
    label: "\u6CBF\u7F18\u6B8B\u4F53",
    fragmentTypeId: "frag-outdoor",
    structure: { grammar: "rim", density: 0.8, gapiness: 0.4, thickness: 2, align: "free" },
    cover: { align: "free", trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ["clump"] },
    scatter: { kind: "rimMoss", vegetation: 0.14, wreck: 0.05, glitch: 2 },
    atmosphere: { skyShadow: 0.64, fog: 0.92, motes: 32, seep: 0.32, poolRim: 0.7, poolHollow: 0.2, poolOpen: 0.1 }
  },
  {
    id: "ridge-clinic",
    label: "\u65E0\u83CC\u6298\u810A",
    fragmentTypeId: "frag-clinic",
    structure: { grammar: "orthoRidge", density: 0.75, gapiness: 0.28, thickness: 2, align: "free" },
    cover: { align: "free", trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ["clump", "plate"] },
    scatter: { kind: "none", vegetation: 0, wreck: 0.03, glitch: 2 },
    atmosphere: { skyShadow: 0.82, fog: 0.16, motes: 6, seep: 0.22, poolRim: 0.2, poolHollow: 0.15, poolOpen: 0.65 }
  },
  {
    id: "shear-clinic",
    label: "\u74F7\u9762\u9519\u4F4D",
    fragmentTypeId: "frag-clinic",
    structure: { grammar: "shear", density: 0.55, gapiness: 0.28, thickness: 2, align: "free" },
    cover: { align: "free", trees: 0, remains: 2, hollows: 2, cuts: 2, cycle: ["clump"] },
    scatter: { kind: "none", vegetation: 0, wreck: 0.05, glitch: 3 },
    atmosphere: { skyShadow: 0.78, fog: 0.2, motes: 8, seep: 0.36, poolRim: 0.18, poolHollow: 0.22, poolOpen: 0.6 }
  },
  {
    id: "shear-metro",
    label: "\u9508\u677F\u6495\u7F1D",
    fragmentTypeId: "frag-metro",
    structure: { grammar: "shear", density: 0.55, gapiness: 0.4, thickness: 2, align: "free" },
    cover: { align: "free", trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ["plate", "clump"] },
    scatter: { kind: "none", vegetation: 0, wreck: 0.06, glitch: 3 },
    atmosphere: { skyShadow: 0.52, fog: 0.24, motes: 18, seep: 0.88, poolRim: 0.25, poolHollow: 0.2, poolOpen: 0.55 }
  },
  {
    id: "hunks-metro",
    label: "\u5D4C\u677F\u6B8B\u4F53",
    fragmentTypeId: "frag-metro",
    structure: { grammar: "plates", density: 0.7, gapiness: 0.35, thickness: 2, align: "free" },
    cover: { align: "free", trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ["plate", "clump"] },
    scatter: { kind: "none", vegetation: 0, wreck: 0.08, glitch: 1 },
    atmosphere: { skyShadow: 0.42, fog: 0.2, motes: 12, seep: 0.48, poolRim: 0.22, poolHollow: 0.18, poolOpen: 0.6 }
  },
  {
    id: "ridge-library",
    label: "\u65AD\u6881\u6B8B\u810A",
    fragmentTypeId: "frag-library",
    structure: { grammar: "twinRidge", density: 0.7, gapiness: 0.35, thickness: 2, align: "free" },
    cover: { align: "free", trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ["clump"] },
    scatter: { kind: "aisleLitter", vegetation: 0.04, wreck: 0.06, glitch: 2 },
    atmosphere: { skyShadow: 0.6, fog: 0.56, motes: 22, seep: 0.26, poolRim: 0.3, poolHollow: 0.25, poolOpen: 0.45 }
  },
  {
    id: "hunks-residential",
    label: "\u5B85\u57FA\u6B8B\u4F53",
    fragmentTypeId: "frag-residential",
    structure: { grammar: "pads", density: 0.8, gapiness: 0.35, thickness: 2, align: "free" },
    cover: { align: "free", trees: 1, remains: 2, hollows: 1, cuts: 1, cycle: ["clump"] },
    scatter: { kind: "grassPads", vegetation: 0.09, wreck: 0.08, glitch: 2 },
    atmosphere: { skyShadow: 0.55, fog: 0.66, motes: 18, seep: 0.22, poolRim: 0.38, poolHollow: 0.22, poolOpen: 0.4 }
  }
];
function recipeById(id) {
  const hit = PREVIEW_RECIPES.find((r) => r.id === id);
  if (!hit) throw new Error(`unknown recipe ${id}`);
  return hit;
}
var NEIGHBORHOOD = 0.3;
function jitterScalar(rng, value, min = 0, max = 1) {
  const scaled = value * (1 - NEIGHBORHOOD + rng.next() * 2 * NEIGHBORHOOD);
  return scaled < min ? min : scaled > max ? max : scaled;
}
function jitterCount(rng, value, min, max) {
  const n = Math.round(jitterScalar(rng, value, min, max));
  return n < min ? min : n > max ? max : n;
}
function jitterRecipe(anchor, seed) {
  const rng = new SeededRandom(mix32(seed, `jitter:${anchor.id}`));
  return {
    ...anchor,
    structure: {
      ...anchor.structure,
      density: jitterScalar(rng, anchor.structure.density),
      gapiness: jitterScalar(rng, anchor.structure.gapiness)
    },
    cover: {
      ...anchor.cover,
      trees: anchor.cover.trees === 0 ? 0 : jitterCount(rng, anchor.cover.trees, 1, 3),
      remains: jitterCount(rng, anchor.cover.remains, 1, 4),
      hollows: jitterCount(rng, anchor.cover.hollows, 0, 3),
      cuts: jitterCount(rng, anchor.cover.cuts, 0, 4)
    },
    scatter: {
      ...anchor.scatter,
      vegetation: jitterScalar(rng, anchor.scatter.vegetation),
      wreck: jitterScalar(rng, anchor.scatter.wreck),
      glitch: jitterCount(rng, anchor.scatter.glitch, 0, 6)
    },
    atmosphere: {
      skyShadow: jitterScalar(rng, anchor.atmosphere.skyShadow),
      fog: jitterScalar(rng, anchor.atmosphere.fog),
      motes: jitterCount(rng, anchor.atmosphere.motes, 0, 48),
      seep: jitterScalar(rng, anchor.atmosphere.seep),
      poolRim: jitterScalar(rng, anchor.atmosphere.poolRim),
      poolHollow: jitterScalar(rng, anchor.atmosphere.poolHollow),
      poolOpen: jitterScalar(rng, anchor.atmosphere.poolOpen)
    }
  };
}

// src/generated/contamination-body-data.ts
var BODY_PROFILE_DATA = {
  "insect_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "human_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "mammal_remnant": {
    "moveScale": 1.1,
    "windupMs": 550,
    "cooldownMs": 1400,
    "rangePx": 38,
    "halfAngleDeg": 35
  },
  "worm_remnant": {
    "moveScale": 0.6,
    "windupMs": 650,
    "cooldownMs": 1500,
    "rangePx": 38,
    "halfAngleDeg": 25
  },
  "organic_remnant": {
    "moveScale": 0.7,
    "windupMs": 700,
    "cooldownMs": 1600,
    "rangePx": 36,
    "halfAngleDeg": 75
  },
  "stalk_clump": {
    "moveScale": 0.5,
    "windupMs": 750,
    "cooldownMs": 1750,
    "rangePx": 36,
    "halfAngleDeg": 80
  },
  "street_wreckage": {
    "moveScale": 0,
    "windupMs": 800,
    "cooldownMs": 1800,
    "rangePx": 38,
    "halfAngleDeg": 80
  }
};

// src/generation/static-body-access.ts
var SAMPLE_STEP = 4;
var EPSILON = 1e-3;
var PLAYER_HALF = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
var BODY_CLEARANCE = PLAYER_HALF + GAME_CONSTANTS.AI.BODY_SIZE / 2;
var STATIC_SUBSTRATES = Object.keys(BODY_PROFILE_DATA).filter((id) => BODY_PROFILE_DATA[id].moveScale === 0);
function isStaticFloorBody(spawn) {
  return spawn.form?.occupancy === "floor" && BODY_PROFILE_DATA[spawn.form.substrate]?.moveScale === 0;
}
function checkStaticBodyAccess(input) {
  const bodies = input.enemySpawns.filter(isStaticFloorBody);
  if (bodies.length === 0) return { reachable: true, blockedTargetIds: [], sampledPositions: 0 };
  const { grid, spawnPoint, targets } = input;
  const tile = grid.tileSize;
  if (tile < GAME_CONSTANTS.PLAYER.BODY_SIZE || tile % SAMPLE_STEP !== 0) {
    throw new Error("Static body access requires tiles at least player-sized and aligned to navigation samples");
  }
  const width = grid.cols * tile / SAMPLE_STEP + 1;
  const height = grid.rows * tile / SAMPLE_STEP + 1;
  const free = new Uint8Array(width * height);
  const reached = new Uint8Array(free.length);
  const queue = new Int32Array(free.length);
  for (let row = 0; row < height; row++) {
    const y = row * SAMPLE_STEP;
    for (let col = 0; col < width; col++) {
      const x = col * SAMPLE_STEP;
      const left = Math.floor((x - PLAYER_HALF + EPSILON) / tile);
      const right = Math.floor((x + PLAYER_HALF - EPSILON) / tile);
      const top = Math.floor((y - PLAYER_HALF + EPSILON) / tile);
      const bottom = Math.floor((y + PLAYER_HALF - EPSILON) / tile);
      if (!grid.isWalkable(left, top) || !grid.isWalkable(right, top) || !grid.isWalkable(left, bottom) || !grid.isWalkable(right, bottom)) continue;
      let blocked = false;
      for (const body of bodies) {
        const bx = (body.spawn.col + 0.5) * tile;
        const by = (body.spawn.row + 0.5) * tile;
        if (Math.abs(x - bx) < BODY_CLEARANCE - EPSILON && Math.abs(y - by) < BODY_CLEARANCE - EPSILON) {
          blocked = true;
          break;
        }
      }
      if (!blocked) free[row * width + col] = 1;
    }
  }
  const startCol = spawnPoint.x / SAMPLE_STEP, startRow = spawnPoint.y / SAMPLE_STEP;
  const start = startRow * width + startCol;
  if (!Number.isInteger(startCol) || !Number.isInteger(startRow) || !free[start]) {
    return { reachable: false, blockedTargetIds: targets.map((target) => target.id), sampledPositions: free.length };
  }
  let head = 0, tail = 1;
  queue[0] = start;
  reached[start] = 1;
  const enqueue = (index) => {
    if (index >= 0 && index < free.length && free[index] && !reached[index]) {
      reached[index] = 1;
      queue[tail++] = index;
    }
  };
  while (head < tail) {
    const index = queue[head++];
    const col = index % width;
    if (col > 0) enqueue(index - 1);
    if (col + 1 < width) enqueue(index + 1);
    enqueue(index - width);
    enqueue(index + width);
  }
  const blockedTargetIds = [];
  for (const target of targets) {
    let reachable = false;
    const minCol = Math.max(0, Math.ceil((target.position.x - target.radius) / SAMPLE_STEP));
    const maxCol = Math.min(width - 1, Math.floor((target.position.x + target.radius) / SAMPLE_STEP));
    const minRow = Math.max(0, Math.ceil((target.position.y - target.radius) / SAMPLE_STEP));
    const maxRow = Math.min(height - 1, Math.floor((target.position.y + target.radius) / SAMPLE_STEP));
    for (let row = minRow; row <= maxRow && !reachable; row++) for (let col = minCol; col <= maxCol && !reachable; col++) {
      if (reached[row * width + col] && (col * SAMPLE_STEP - target.position.x) ** 2 + (row * SAMPLE_STEP - target.position.y) ** 2 <= target.radius ** 2) reachable = true;
    }
    if (!reachable) blockedTargetIds.push(target.id);
  }
  return { reachable: blockedTargetIds.length === 0, blockedTargetIds, sampledPositions: free.length };
}
function ensureStaticBodyAccess(input, rng, fragmentTypeId) {
  if (checkStaticBodyAccess(input).reachable) return input.enemySpawns;
  const corrected = [...input.enemySpawns];
  for (let i = 0; i < corrected.length; i++) {
    const spawn = corrected[i];
    if (!isStaticFloorBody(spawn)) continue;
    const previous = spawn.form;
    const options = {
      portfolio: previous.portfolio,
      fragmentTypeId,
      coverage: previous.coverage,
      sense: previous.lexemes.sense,
      rhythm: previous.lexemes.rhythm,
      forbidSubstrate: STATIC_SUBSTRATES
    };
    const form = drawOne(rng, { ...options, forbidMotion: ["motion_patrol"] }) ?? drawOne(rng, { ...options, motion: "motion_patrol" });
    if (!form) return null;
    corrected[i] = { ...spawn, form };
    if (checkStaticBodyAccess({ ...input, enemySpawns: corrected }).reachable) return corrected;
  }
  return null;
}

// src/generation/contamination-pins.ts
var DIRS48 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
function at11(cols, col, row) {
  return row * cols + col;
}
function inBounds9(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function isFloor4(map, col, row) {
  return map.tiles[row]?.[col] === 1 /* FLOOR */;
}
function isWall(map, col, row) {
  return map.tiles[row]?.[col] === 0 /* WALL */;
}
function collectWallEdges(map) {
  const { cols, rows } = map;
  const edge = [];
  const strike = /* @__PURE__ */ new Map();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isWall(map, col, row)) continue;
      const floors = [];
      for (const [dx, dy] of DIRS48) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds9(cols, rows, nc, nr) || !isFloor4(map, nc, nr)) continue;
        floors.push({ col: nc, row: nr });
      }
      if (floors.length === 0) continue;
      const i = at11(cols, col, row);
      edge.push(i);
      const set = /* @__PURE__ */ new Set();
      for (const f of floors) set.add(`${f.col},${f.row}`);
      strike.set(i, set);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const lines = [];
  const edgeSet = new Set(edge);
  for (const start of edge) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const tiles = [];
    const floors = /* @__PURE__ */ new Set();
    while (stack.length > 0) {
      const cur = stack.pop();
      const col = cur % cols;
      const row = cur / cols | 0;
      tiles.push({ col, row });
      for (const key of strike.get(cur) ?? []) floors.add(key);
      for (const [dx, dy] of DIRS48) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds9(cols, rows, nc, nr)) continue;
        const ni = at11(cols, nc, nr);
        if (!edgeSet.has(ni) || seen.has(ni)) continue;
        seen.add(ni);
        stack.push(ni);
      }
    }
    if (tiles.length === 0 || floors.size === 0) continue;
    lines.push({
      tiles,
      strikeFloors: [...floors].map((key) => {
        const [c, r] = key.split(",");
        return { col: Number(c), row: Number(r) };
      })
    });
  }
  lines.sort((a, b) => b.tiles.length - a.tiles.length);
  return lines;
}
function spanAlong(map, col, row, dx, dy) {
  const { cols, rows } = map;
  let n = 0;
  let c = col + dx;
  let r = row + dy;
  while (inBounds9(cols, rows, c, r) && isFloor4(map, c, r) && n < 12) {
    n++;
    c += dx;
    r += dy;
  }
  return n;
}
function collectCorridors(map) {
  const { cols, rows } = map;
  const tile = map.tileSize;
  const mark = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFloor4(map, col, row)) continue;
      const xSpan = 1 + spanAlong(map, col, row, 1, 0) + spanAlong(map, col, row, -1, 0);
      const ySpan = 1 + spanAlong(map, col, row, 0, 1) + spanAlong(map, col, row, 0, -1);
      if (Math.min(xSpan, ySpan) <= 4 && Math.max(xSpan, ySpan) >= 3) {
        mark[at11(cols, col, row)] = 1;
      }
    }
  }
  const seen = new Uint8Array(cols * rows);
  const boxes = [];
  for (let i = 0; i < mark.length; i++) {
    if (!mark[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    let minCol = cols;
    let minRow = rows;
    let maxCol = 0;
    let maxRow = 0;
    let sumC = 0;
    let sumR = 0;
    let n = 0;
    const cells = [];
    while (stack.length > 0) {
      const cur = stack.pop();
      const col = cur % cols;
      const row = cur / cols | 0;
      cells.push(cur);
      n++;
      sumC += col;
      sumR += row;
      if (col < minCol) minCol = col;
      if (row < minRow) minRow = row;
      if (col > maxCol) maxCol = col;
      if (row > maxRow) maxRow = row;
      for (const [dx, dy] of DIRS48) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds9(cols, rows, nc, nr)) continue;
        const ni = at11(cols, nc, nr);
        if (!mark[ni] || seen[ni]) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (n < 6) continue;
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    if (Math.min(width, height) > 5) continue;
    const cx = Math.round(sumC / n);
    const cy = Math.round(sumR / n);
    let core = at11(cols, cx, cy);
    if (!mark[core]) core = cells[0];
    boxes.push({
      minCol,
      minRow,
      maxCol,
      maxRow,
      coreCol: core % cols,
      coreRow: core / cols | 0
    });
  }
  boxes.sort((a, b) => {
    const aa = (a.maxCol - a.minCol + 1) * (a.maxRow - a.minRow + 1);
    const bb = (b.maxCol - b.minCol + 1) * (b.maxRow - b.minRow + 1);
    return bb - aa;
  });
  return boxes.slice(0, 8);
}
var PAINT_PINS_SHORT = "paint pins short";
function paintHostSpacingLadder(paintCount) {
  return paintCount >= 9 ? [5, 4, 3] : [6, 4, 3];
}
function chebyshevCells(aCol, aRow, bCol, bRow) {
  return Math.max(Math.abs(aCol - bCol), Math.abs(aRow - bRow));
}
function walkBits(map) {
  const { cols, rows } = map;
  const walk = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (isFloor4(map, col, row)) walk[at11(cols, col, row)] = 1;
    }
  }
  return walk;
}
function neighborWalkCount(walk, cols, rows, col, row) {
  let n = 0;
  for (const [dx, dy] of DIRS48) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds9(cols, rows, nc, nr)) continue;
    if (walk[at11(cols, nc, nr)]) n++;
  }
  return n;
}
function bfsFrom(walk, cols, rows, start) {
  const dist = new Int16Array(walk.length);
  const parent = new Int32Array(walk.length);
  dist.fill(-1);
  parent.fill(-1);
  if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
  const queue = [start];
  dist[start] = 0;
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const col = cur % cols;
    const row = cur / cols | 0;
    const d = dist[cur];
    for (const [dx, dy] of DIRS48) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds9(cols, rows, nc, nr)) continue;
      const ni = at11(cols, nc, nr);
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      parent[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, parent };
}
function reconstructPath(parent, start, goal) {
  if (goal < 0 || parent[goal] === void 0) return [];
  if (goal !== start && parent[goal] < 0) return [];
  const path = [];
  let cur = goal;
  while (cur >= 0) {
    path.push(cur);
    if (cur === start) break;
    cur = parent[cur];
  }
  if (path[path.length - 1] !== start) return [];
  path.reverse();
  return path;
}
function greedyKindlingCells(walk, cols, rows, spawn, extract, kindling) {
  const { parent } = bfsFrom(walk, cols, rows, spawn);
  const cells = /* @__PURE__ */ new Set();
  const take = (goal) => {
    for (const cell of reconstructPath(parent, spawn, goal)) cells.add(cell);
  };
  take(extract);
  for (const node of kindling) {
    if (node.tier !== "contested" && node.tier !== "deep") continue;
    if (!inBounds9(cols, rows, node.col, node.row)) continue;
    take(at11(cols, node.col, node.row));
  }
  return cells;
}
function isBannedPaintSeat(col, row, spawnCol, spawnRow, extractCol, extractRow, kindlingCells, cols) {
  if (chebyshevCells(col, row, spawnCol, spawnRow) <= 3) return true;
  if (chebyshevCells(col, row, extractCol, extractRow) <= 3) return true;
  return kindlingCells.has(at11(cols, col, row));
}
function rankSeats(cells, walk, cols, rows, greedy, dist, banned) {
  const seats = [];
  const seen = /* @__PURE__ */ new Set();
  for (const cell of cells) {
    if (seen.has(cell) || !walk[cell]) continue;
    seen.add(cell);
    const col = cell % cols;
    const row = cell / cols | 0;
    if (banned(col, row)) continue;
    const neighbors = neighborWalkCount(walk, cols, rows, col, row);
    seats.push({
      cell,
      col,
      row,
      onGreedy: greedy.has(cell),
      throatScore: 4 - neighbors,
      neighbors,
      dist: dist[cell]
    });
  }
  seats.sort((a, b) => {
    const throatA = a.neighbors === 2 ? 1 : 0;
    const throatB = b.neighbors === 2 ? 1 : 0;
    if (throatB !== throatA) return throatB - throatA;
    if (a.dist !== b.dist) return a.dist - b.dist;
    if (b.throatScore !== a.throatScore) return b.throatScore - a.throatScore;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return seats;
}
function pickSpaced(seats, count, minChebyshev) {
  const picked = [];
  for (const seat of seats) {
    let ok = true;
    for (const other of picked) {
      if (chebyshevCells(seat.col, seat.row, other.col, other.row) < minChebyshev) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    picked.push(seat);
    if (picked.length === count) return picked;
  }
  return null;
}
function ringAround(cells, walk, cols, rows, radius) {
  const out = /* @__PURE__ */ new Set();
  for (const cell of cells) {
    const col = cell % cols;
    const row = cell / cols | 0;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) > radius) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (!inBounds9(cols, rows, nc, nr)) continue;
        const ni = at11(cols, nc, nr);
        if (walk[ni]) out.add(ni);
      }
    }
  }
  return out;
}
function reachableFloors(dist) {
  const out = [];
  for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) out.push(i);
  return out;
}
function toPins(seats) {
  return seats.map((seat) => ({
    floorCol: seat.col,
    floorRow: seat.row,
    onGreedy: seat.onGreedy,
    throatScore: seat.throatScore
  }));
}
function placePaintFloorPins(map, input) {
  const n = input.paintCount;
  if (n <= 0) return [];
  const { cols, rows } = map;
  if (!inBounds9(cols, rows, input.spawnCol, input.spawnRow)) {
    return `${PAINT_PINS_SHORT} (need ${n}, spawn out of bounds)`;
  }
  const walk = walkBits(map);
  const spawn = at11(cols, input.spawnCol, input.spawnRow);
  const extract = at11(cols, input.extractCol, input.extractRow);
  const { dist } = bfsFrom(walk, cols, rows, spawn);
  const greedy = greedyKindlingCells(walk, cols, rows, spawn, extract, input.kindling);
  const kindlingCells = /* @__PURE__ */ new Set();
  for (const node of input.kindling) {
    if (!inBounds9(cols, rows, node.col, node.row)) continue;
    kindlingCells.add(at11(cols, node.col, node.row));
  }
  const banned = (col, row) => isBannedPaintSeat(col, row, input.spawnCol, input.spawnRow, input.extractCol, input.extractRow, kindlingCells, cols);
  const pathSeats = rankSeats(greedy, walk, cols, rows, greedy, dist, banned);
  const ringSeats = rankSeats(ringAround(greedy, walk, cols, rows, 2), walk, cols, rows, greedy, dist, banned);
  const islandSeats = rankSeats(reachableFloors(dist), walk, cols, rows, greedy, dist, banned);
  const stages = [pathSeats, ringSeats, islandSeats];
  const spacings = paintHostSpacingLadder(n);
  for (const seats of stages) {
    for (const spacing of spacings) {
      const picked = pickSpaced(seats, n, spacing);
      if (picked) return toPins(picked);
    }
  }
  let best = 0;
  for (const seats of stages) {
    const trial = pickSpaced(seats, n, 3);
    if (trial) best = Math.max(best, trial.length);
    best = Math.max(best, Math.min(seats.length, n));
  }
  return `${PAINT_PINS_SHORT} (need ${n}, max placed ${best})`;
}
function collectContaminationPins(map, paint) {
  const paintFloors = placePaintFloorPins(map, paint);
  if (typeof paintFloors === "string") return paintFloors;
  return {
    wallEdges: collectWallEdges(map),
    paintFloors,
    corridorAabbs: collectCorridors(map)
  };
}

// src/systems/tile-grid.ts
var TileGrid = class {
  constructor(map) {
    __publicField(this, "cols");
    __publicField(this, "rows");
    __publicField(this, "tileSize");
    __publicField(this, "widthPx");
    __publicField(this, "heightPx");
    __publicField(this, "data");
    __publicField(this, "_version", 0);
    this.cols = map.cols;
    this.rows = map.rows;
    this.tileSize = map.tileSize;
    this.widthPx = map.cols * map.tileSize;
    this.heightPx = map.rows * map.tileSize;
    this.data = new Uint8Array(map.cols * map.rows);
    for (let row = 0; row < map.rows; row++) {
      const sourceRow = map.tiles[row];
      if (!sourceRow || sourceRow.length !== map.cols) {
        throw new Error(`TileGrid: row ${row} does not have ${map.cols} tiles`);
      }
      for (let col = 0; col < map.cols; col++) {
        this.data[row * map.cols + col] = sourceRow[col];
      }
    }
  }
  get version() {
    return this._version;
  }
  /**
   * Returns `TileType.WALL` for out-of-bounds so callers never need bounds checks.
   * In-bounds VOID stays VOID (unwalkable; opaque via `isOpaque`).
   */
  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0 /* WALL */;
    return this.data[row * this.cols + col];
  }
  isOpaque(col, row) {
    const tile = this.getTile(col, row);
    return tile === 0 /* WALL */ || tile === 3 /* VOID */;
  }
  isWalkable(col, row) {
    const tile = this.getTile(col, row);
    return tile === 1 /* FLOOR */ || tile === 2 /* FRACTURE */;
  }
  /** True when the world position falls inside a walkable tile. */
  isWalkableAt(x, y) {
    return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }
  /** Mutates a tile and bumps `version` so caches (vision, paths) invalidate. */
  setTile(col, row, tile) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    if (this.data[index] === tile) return;
    this.data[index] = tile;
    this._version++;
  }
  /** Writes the centre of a tile into `out` (no allocation). */
  tileToWorld(col, row, out) {
    out.x = col * this.tileSize + this.tileSize / 2;
    out.y = row * this.tileSize + this.tileSize / 2;
    return out;
  }
  /** Writes the tile containing a world position into `out` (no allocation). */
  worldToTile(x, y, out) {
    out.col = Math.floor(x / this.tileSize);
    out.row = Math.floor(y / this.tileSize);
    return out;
  }
};

// src/scenes/rift-map-data.ts
var RIFT_MAP_ASCII = [
  "################################################",
  "#..............................................#",
  "#.....##..............X.........###............#",
  "#.....###.........##..............##..P..##....#",
  "#..........##...............##.................#",
  "#.......J....##.......................K...##...#",
  "#.....##...........###........##...............#",
  "#.........##.............##............##......#",
  "#..7........###........##..........###.........#",
  "#...####..........######.........##............#",
  "#...###..........##....##...........6..........#",
  "#.Q......##.........##...........##............#",
  "#.........##.............###...................#",
  "#.....C...##........5....###..........D........#",
  "#...####..........##.....##....................#",
  "#..##.........##..........##..........###......#",
  "#......###............##.......###.............#",
  "#.....E...##.....##...................##.......#",
  "#......####..........##............4.....##....#",
  "#..............####.........##...........##....#",
  "#..##..........###..........##....R...###......#",
  "#.............##...............##...F.....8....#",
  "#...........##............##...................#",
  "#.......##........##........##.................#",
  "#.....H.......##...................G...##......#",
  "#...........3........##...........##...........#",
  "#....##.....A.................2......B.........#",
  "#........##...........1............##..........#",
  "#.....................S..........##............#",
  "#....##....................##..................#",
  "#..............................................#",
  "################################################"
];
var KINDLING_TIERS = {
  "1": "safe",
  "2": "safe",
  "3": "safe",
  "4": "contested",
  "5": "contested",
  "6": "contested",
  "7": "deep",
  "8": "deep"
};
var CONTAMINANT_MARKER_CHARS = ["P", "Q", "R"];
var PATROL_UNITS = [
  {
    id: "ENM_INF_01",
    waypointChars: "AB",
    mode: "pingpong",
    facing: 0,
    role: "spawn area sweep; east-west patrol covering the open ground between safe kindling and the transition zone"
  },
  {
    id: "ENM_INF_02",
    waypointChars: "CD",
    mode: "pingpong",
    facing: 0,
    role: "upper contested area; sweeps east-west through the debris field, guards KDL_05 and approach to deep zone"
  },
  {
    id: "ENM_INF_03",
    waypointChars: "EFGH",
    mode: "loop",
    facing: 0,
    role: "rectangular loop in the transition zone; covers the C-shape ruin and cliff ridge areas, guards KDL_04 and KDL_08 approaches"
  },
  {
    id: "ENM_INF_04",
    waypointChars: "JK",
    mode: "pingpong",
    facing: 0,
    scanAngles: [180, 0],
    role: "top zone gate; sweeps east-west in the extraction approach \u2014 the last obstacle before exit"
  }
];
var LANDMARKS = [
  { id: "LMK_POOL", col: 28, row: 6, style: "pool" },
  { id: "LMK_SCRATCHES", col: 20, row: 26, style: "scratches" },
  { id: "LMK_RUBBLE", col: 8, row: 15, style: "rubble" },
  { id: "LMK_CRACK", col: 40, row: 18, style: "crack" },
  { id: "LMK_SCORCH", col: 30, row: 4, style: "scorch" },
  { id: "LMK_CRYSTALS", col: 41, row: 9, style: "crystals" },
  { id: "LMK_BLOODTRAIL", col: 22, row: 22, style: "bloodtrail" },
  { id: "LMK_RUNE", col: 6, row: 19, style: "rune" }
];
function parseRiftMap() {
  const tileSize = GAME_CONSTANTS.TILE_SIZE;
  const rows = RIFT_MAP_ASCII.length;
  const cols = RIFT_MAP_ASCII[0].length;
  const tiles = [];
  const markers = /* @__PURE__ */ new Map();
  for (let row = 0; row < rows; row++) {
    const line = RIFT_MAP_ASCII[row];
    if (line.length !== cols) {
      throw new Error(`rift-map-data: row ${row} has ${line.length} chars, expected ${cols}`);
    }
    const tileRow = new Array(cols);
    for (let col = 0; col < cols; col++) {
      const char = line[col];
      tileRow[col] = char === "#" ? 0 /* WALL */ : 1 /* FLOOR */;
      if (char !== "#" && char !== ".") {
        if (markers.has(char)) {
          throw new Error(`rift-map-data: marker '${char}' appears more than once`);
        }
        markers.set(char, {
          x: col * tileSize + tileSize / 2,
          y: row * tileSize + tileSize / 2
        });
      }
    }
    tiles.push(tileRow);
  }
  const requireMarker = (char) => {
    const position = markers.get(char);
    if (!position) throw new Error(`rift-map-data: missing marker '${char}'`);
    return position;
  };
  const kindlingNodes = Object.keys(KINDLING_TIERS).sort().map((char) => ({
    id: `KDL_0${char}`,
    tier: KINDLING_TIERS[char],
    position: requireMarker(char)
  }));
  const contaminantNodes = CONTAMINANT_MARKER_CHARS.map((char, idx) => ({
    id: `CTM_NODE_0${idx + 1}`,
    position: requireMarker(char)
  }));
  const enemySpawns = PATROL_UNITS.map((unit) => {
    const waypoints = unit.waypointChars.split("").map((char) => {
      const position = requireMarker(char);
      return {
        col: Math.floor(position.x / tileSize),
        row: Math.floor(position.y / tileSize)
      };
    });
    return {
      id: unit.id,
      type: "infiltrator",
      spawn: waypoints[0],
      facing: unit.facing,
      patrol: {
        waypoints,
        mode: unit.mode,
        pauseMs: unit.pauseMs,
        scanAngles: unit.scanAngles
      }
    };
  });
  const tileMap = { cols, rows, tileSize, tiles };
  return {
    tileMap,
    grid: new TileGrid(tileMap),
    layout: {
      spawnPoint: requireMarker("S"),
      extractionPoint: {
        id: "EXIT_01",
        position: requireMarker("X"),
        triggerRadius: GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS
      },
      kindlingNodes,
      contaminantNodes,
      enemySpawns,
      landmarks: LANDMARKS
    }
  };
}
var RIFT_MAP = parseRiftMap();

// src/utils/grid-raycast.ts
function createRayHit() {
  return { x: 0, y: 0, dist: 0, hit: false };
}
var CORNER_MARGIN = 1;
var losScratch = createRayHit();
function castRayDirection(grid, originX, originY, dirX, dirY, maxDist, out) {
  const tileSize = grid.tileSize;
  let col = Math.floor(originX / tileSize);
  let row = Math.floor(originY / tileSize);
  if (grid.isOpaque(col, row)) {
    out.x = originX;
    out.y = originY;
    out.dist = 0;
    out.hit = true;
    return out;
  }
  const stepCol = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepRow = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
  const invX = stepCol !== 0 ? 1 / Math.abs(dirX) : Infinity;
  const invY = stepRow !== 0 ? 1 / Math.abs(dirY) : Infinity;
  const deltaX = tileSize * invX;
  const deltaY = tileSize * invY;
  let nextX = stepCol > 0 ? ((col + 1) * tileSize - originX) * invX : stepCol < 0 ? (originX - col * tileSize) * invX : Infinity;
  let nextY = stepRow > 0 ? ((row + 1) * tileSize - originY) * invY : stepRow < 0 ? (originY - row * tileSize) * invY : Infinity;
  const maxSteps = grid.cols + grid.rows + 2;
  for (let step = 0; step < maxSteps; step++) {
    const throughVertex = stepCol !== 0 && stepRow !== 0 && Math.abs(nextX - nextY) <= CORNER_MARGIN;
    if (throughVertex) {
      const dist2 = nextX < nextY ? nextX : nextY;
      if (dist2 > maxDist) break;
      if (grid.isOpaque(col + stepCol, row) && grid.isOpaque(col, row + stepRow)) {
        return writeHit(out, originX, originY, dirX, dirY, dist2, true);
      }
      col += stepCol;
      row += stepRow;
      nextX += deltaX;
      nextY += deltaY;
      if (grid.isOpaque(col, row)) {
        return writeHit(out, originX, originY, dirX, dirY, dist2, true);
      }
      continue;
    }
    let dist;
    if (nextX < nextY) {
      dist = nextX;
      if (dist > maxDist) break;
      col += stepCol;
      nextX += deltaX;
    } else {
      dist = nextY;
      if (dist > maxDist) break;
      row += stepRow;
      nextY += deltaY;
    }
    if (grid.isOpaque(col, row)) {
      return writeHit(out, originX, originY, dirX, dirY, dist, true);
    }
  }
  return writeHit(out, originX, originY, dirX, dirY, maxDist, false);
}
function hasLineOfSight(grid, from, to, maxDist) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  if (length < 1e-6) {
    return !grid.isOpaque(Math.floor(from.x / grid.tileSize), Math.floor(from.y / grid.tileSize));
  }
  if (maxDist !== void 0 && length > maxDist) return false;
  castRayDirection(grid, from.x, from.y, deltaX / length, deltaY / length, length, losScratch);
  return !losScratch.hit || losScratch.dist >= length - 1e-3;
}
function writeHit(out, originX, originY, dirX, dirY, dist, hit) {
  out.x = originX + dirX * dist;
  out.y = originY + dirY * dist;
  out.dist = dist;
  out.hit = hit;
  return out;
}

// src/generation/rift-layout.ts
var MAX_ISLAND_ATTEMPTS = 32;
var MAX_PLACE_ATTEMPTS = 20;
var SIGHT_PX = ENEMY_DATA.infiltrator.sightRange;
var TILE = GAME_CONSTANTS.TILE_SIZE;
var EXTRACT_EPS = 1;
var DIRS49 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
var LANDMARK_STYLES = [
  "pool",
  "scratches",
  "rubble",
  "crack",
  "scorch",
  "crystals",
  "bloodtrail",
  "rune"
];
var forbiddenExtract = RIFT_MAP.layout.extractionPoint.position;
function at12(cols, col, row) {
  return row * cols + col;
}
function inBounds10(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function worldOf(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}
function sameWorld(a, b) {
  return Math.abs(a.x - b.x) < EXTRACT_EPS && Math.abs(a.y - b.y) < EXTRACT_EPS;
}
function colOf(cols, i) {
  return i % cols;
}
function rowOf(cols, i) {
  return i / cols | 0;
}
function pickRecipeAnchor(seed, islandAttempt) {
  const enabledIds = new Set(ENABLED_RIFT_FRAGMENTS.map((row) => row.id));
  const live = PREVIEW_RECIPES.filter((recipe) => enabledIds.has(recipe.fragmentTypeId));
  if (live.length === 0) throw new Error("pickRecipe: no enabled fragment recipes");
  const types = [];
  for (const recipe of live) {
    if (!types.includes(recipe.fragmentTypeId)) types.push(recipe.fragmentTypeId);
  }
  const typeId = types[new SeededRandom(mix32(seed, "fragment-type")).nextInt(0, types.length - 1)];
  const ofType = live.filter((recipe) => recipe.fragmentTypeId === typeId);
  const pool = islandAttempt < 6 && ofType.length > 0 ? ofType : live;
  return pool[new SeededRandom(mix32(seed, `recipe:${islandAttempt}`)).nextInt(0, pool.length - 1)];
}
function pickRecipe(seed, islandAttempt) {
  return jitterRecipe(pickRecipeAnchor(seed, islandAttempt), islandSeed(seed, islandAttempt));
}
function resolveRecipe(seed, islandAttempt, options) {
  const anchor = options?.recipeId ? recipeById(options.recipeId) : pickRecipeAnchor(seed, islandAttempt);
  if (options?.jitter === false) return anchor;
  return jitterRecipe(anchor, islandSeed(seed, islandAttempt));
}
function islandSeed(seed, islandAttempt) {
  if (islandAttempt === 0) return seed >>> 0;
  return mix32(seed, `island:${islandAttempt}`);
}
function walkBits2(grid) {
  const bits = new Uint8Array(grid.cols * grid.rows);
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.isWalkable(col, row)) bits[at12(grid.cols, col, row)] = 1;
    }
  }
  return bits;
}
function wallBits(grid) {
  const bits = new Uint8Array(grid.cols * grid.rows);
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.getTile(col, row) === 0 /* WALL */) bits[at12(grid.cols, col, row)] = 1;
    }
  }
  return bits;
}
function bfs2(walk, cols, rows, start) {
  const dist = new Int32Array(walk.length).fill(-1);
  const parent = new Int32Array(walk.length).fill(-1);
  if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
  const queue = [start];
  dist[start] = 0;
  let q = 0;
  while (q < queue.length) {
    const cur = queue[q++];
    const col = colOf(cols, cur);
    const row = rowOf(cols, cur);
    const d = dist[cur];
    for (const [dx, dy] of DIRS49) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds10(cols, rows, nx, ny)) continue;
      const ni = at12(cols, nx, ny);
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      parent[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, parent };
}
function farthest(dist) {
  let best = -1;
  let bestD = -1;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
function reconstruct2(parent, start, goal) {
  if (goal < 0 || parent[goal] === void 0) return [];
  const path = [];
  let cur = goal;
  const guard = parent.length + 2;
  let n = 0;
  while (cur !== start && cur >= 0 && n++ < guard) {
    path.push(cur);
    cur = parent[cur];
  }
  if (cur !== start) return [];
  path.push(start);
  path.reverse();
  return path;
}
function pathDistField(walk, cols, rows, path) {
  const dist = new Int32Array(walk.length).fill(-1);
  const queue = [];
  for (const i of path) {
    if (!walk[i]) continue;
    dist[i] = 0;
    queue.push(i);
  }
  let q = 0;
  while (q < queue.length) {
    const cur = queue[q++];
    const col = colOf(cols, cur);
    const row = rowOf(cols, cur);
    const d = dist[cur];
    for (const [dx, dy] of DIRS49) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds10(cols, rows, nx, ny)) continue;
      const ni = at12(cols, nx, ny);
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }
  return dist;
}
function manhattan(cols, a, b) {
  return Math.abs(colOf(cols, a) - colOf(cols, b)) + Math.abs(rowOf(cols, a) - rowOf(cols, b));
}
function pickRewriterExtraIndex(extraWps, contested, deep, cols) {
  if (extraWps.length === 0) return -1;
  const greedy = [...contested, ...deep];
  let best = 0;
  let bestDist = Infinity;
  extraWps.forEach((wps, idx) => {
    let d = Infinity;
    for (const wp of wps) {
      if (greedy.length === 0) {
        d = 0;
        break;
      }
      for (const cell of greedy) d = Math.min(d, manhattan(cols, wp, cell));
    }
    if (d < bestDist) {
      bestDist = d;
      best = idx;
    }
  });
  return best;
}
function worldDistCells(cols, a, b) {
  const dx = (colOf(cols, a) - colOf(cols, b)) * TILE;
  const dy = (rowOf(cols, a) - rowOf(cols, b)) * TILE;
  return Math.hypot(dx, dy);
}
var losFrom = { x: 0, y: 0 };
var losTo = { x: 0, y: 0 };
function cellSees(grid, from, to, maxPx) {
  const cols = grid.cols;
  if (worldDistCells(cols, from, to) > maxPx) return false;
  const a = worldOf(colOf(cols, from), rowOf(cols, from));
  const b = worldOf(colOf(cols, to), rowOf(cols, to));
  losFrom.x = a.x;
  losFrom.y = a.y;
  losTo.x = b.x;
  losTo.y = b.y;
  return hasLineOfSight(grid, losFrom, losTo, maxPx);
}
function nearAny(cols, cell, taken, minSep) {
  for (const t of taken) {
    if (manhattan(cols, cell, t) < minSep) return true;
  }
  return false;
}
function pickSeparated(rng, cols, pool, taken, count, minSep) {
  const order = pool.slice();
  rng.shuffle(order);
  const picked = [];
  const mine = /* @__PURE__ */ new Set();
  for (const cell of order) {
    if (taken.has(cell) || mine.has(cell)) continue;
    if (nearAny(cols, cell, taken, minSep) || nearAny(cols, cell, mine, minSep)) continue;
    picked.push(cell);
    mine.add(cell);
    if (picked.length === count) return picked;
  }
  return null;
}
function firstWalkable(walk) {
  for (let i = 0; i < walk.length; i++) if (walk[i]) return i;
  return -1;
}
function collectBand(dist, lo, hi) {
  const out = [];
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (d >= lo && d <= hi) out.push(i);
  }
  return out;
}
function samplesAlong(walk, cols, rows, waypoints, loop) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const add2 = (i) => {
    if (seen.has(i)) return;
    seen.add(i);
    out.push(i);
  };
  for (const wp of waypoints) add2(wp);
  const hops = loop ? waypoints.length : Math.max(0, waypoints.length - 1);
  for (let h = 0; h < hops; h++) {
    const a = waypoints[h];
    const b = waypoints[(h + 1) % waypoints.length];
    const { parent, dist } = bfs2(walk, cols, rows, a);
    if (dist[b] < 0) continue;
    const path = reconstruct2(parent, a, b);
    for (const i of path) add2(i);
  }
  return out;
}
function anySees(grid, samples, cell, maxPx) {
  for (const s of samples) {
    if (cellSees(grid, s, cell, maxPx)) return true;
  }
  return false;
}
function coveredFraction(grid, samples, cells, maxPx) {
  if (cells.length === 0) return 0;
  let n = 0;
  for (const c of cells) if (anySees(grid, samples, c, maxPx)) n++;
  return n / cells.length;
}
function facingDeg(cols, from, to) {
  const dx = colOf(cols, to) - colOf(cols, from);
  const dy = rowOf(cols, to) - rowOf(cols, from);
  return Math.atan2(dy, dx) * 180 / Math.PI;
}
function makeWalkableMask(grid) {
  return {
    cols: grid.cols,
    rows: grid.rows,
    isWalkable: (col, row) => grid.isWalkable(col, row)
  };
}
function offsetBeside(walk, cols, rows, cell, rng) {
  const col = colOf(cols, cell);
  const row = rowOf(cols, cell);
  const order = [0, 1, 2, 3];
  rng.shuffle(order);
  for (const k of order) {
    const [dx, dy] = DIRS49[k];
    const nx = col + dx * 2;
    const ny = row + dy * 2;
    if (!inBounds10(cols, rows, nx, ny)) continue;
    const ni = at12(cols, nx, ny);
    if (walk[ni]) return ni;
  }
  for (const k of order) {
    const [dx, dy] = DIRS49[k];
    const nx = col + dx;
    const ny = row + dy;
    if (!inBounds10(cols, rows, nx, ny)) continue;
    const ni = at12(cols, nx, ny);
    if (walk[ni]) return ni;
  }
  return cell;
}
function placeOnIsland(grid, walk, walls, rng, routePolicy = "legacy") {
  const cols = grid.cols;
  const rows = grid.rows;
  const origin = firstWalkable(walk);
  if (origin < 0) return "no floor";
  const fromOrigin = bfs2(walk, cols, rows, origin);
  const poleA = farthest(fromOrigin.dist);
  if (poleA < 0) return "no pole A";
  const fromA = bfs2(walk, cols, rows, poleA);
  const poleB = farthest(fromA.dist);
  if (poleB < 0) return "no pole B";
  const diameter = fromA.dist[poleB];
  const minPole = Math.max(16, Math.floor(diameter * 0.55));
  if (diameter < minPole) return `poles too close (${diameter})`;
  const farA = collectBand(fromA.dist, Math.floor(diameter * 0.85), diameter);
  const swap = rng.next() < 0.5;
  let spawn = swap ? poleB : poleA;
  let extract = swap ? poleA : poleB;
  const extractPool = farA.length > 0 ? farA : [poleB];
  const tryExtract = extractPool[rng.nextInt(0, extractPool.length - 1)];
  const fromTry = bfs2(walk, cols, rows, tryExtract);
  const spawnPool = collectBand(fromTry.dist, Math.floor(diameter * 0.85), diameter);
  if (spawnPool.length > 0) {
    extract = tryExtract;
    spawn = spawnPool[rng.nextInt(0, spawnPool.length - 1)];
  }
  const fromSpawn = bfs2(walk, cols, rows, spawn);
  if (fromSpawn.dist[extract] < minPole) return "spawn/extract not far enough";
  const path = reconstruct2(fromSpawn.parent, spawn, extract);
  if (path.length < 12) return `path too short (${path.length})`;
  const dual = evaluateDualPath(walk, walls, cols, rows, spawn, extract);
  if (routePolicy === "open-world" ? dual.altSteps < 0 : !dual.ok) return dual.reason;
  const extractPos = worldOf(colOf(cols, extract), rowOf(cols, extract));
  if (sameWorld(extractPos, forbiddenExtract)) return "extract matches handwritten X";
  const distFromExtract = bfs2(walk, cols, rows, extract).dist;
  const distFromSpawn = bfs2(walk, cols, rows, spawn).dist;
  const toPath = pathDistField(walk, cols, rows, path);
  const lastLen = Math.max(4, Math.min(10, Math.floor(path.length * 0.25)));
  const lastStretch = path.filter((i) => {
    const d = distFromExtract[i];
    return d >= 1 && d <= lastLen;
  });
  if (lastStretch.length < 3) return "last stretch too small";
  const gateBand = path.filter((i) => {
    const d = distFromExtract[i];
    return d >= 6 && d <= 14;
  });
  if (gateBand.length < 2) return "no gate band";
  const gateA = gateBand[Math.floor(gateBand.length * 0.25)];
  const gateB = gateBand[Math.floor(gateBand.length * 0.75)];
  if (gateA === gateB || manhattan(cols, gateA, gateB) < 3) return "gate waypoints too close";
  const gateWps = [gateA, gateB];
  if (anySees(grid, gateWps, extract, SIGHT_PX)) return "gate sees extract";
  const gateSamples = samplesAlong(walk, cols, rows, gateWps, false);
  if (coveredFraction(grid, gateSamples, lastStretch, SIGHT_PX) < 0.45) {
    return "gate does not cover last stretch";
  }
  const patrolCount = rng.nextInt(3, 4);
  const extraNeeded = patrolCount - 1;
  const extraWps = [];
  const midLo = 0.22;
  const midHi = 0.68;
  for (let p = 0; p < extraNeeded; p++) {
    const t0 = midLo + (midHi - midLo) * p / Math.max(1, extraNeeded);
    const t1 = t0 + (midHi - midLo) / Math.max(2, extraNeeded * 1.5);
    const i0 = path[Math.max(0, Math.min(path.length - 1, Math.floor(path.length * t0)))];
    const i1 = path[Math.max(0, Math.min(path.length - 1, Math.floor(path.length * t1)))];
    let a = offsetBeside(walk, cols, rows, i0, rng);
    let b = offsetBeside(walk, cols, rows, i1, rng);
    if (a === b) b = offsetBeside(walk, cols, rows, path[Math.min(path.length - 1, path.indexOf(i1) + 4 | 0)] ?? i1, rng);
    if (a === b || manhattan(cols, a, b) < 4) return "mid patrol too short";
    if (distFromSpawn[a] < 8 || distFromSpawn[b] < 8) return "mid patrol too close to spawn";
    if (distFromExtract[a] < lastLen + 3 || distFromExtract[b] < lastLen + 3) {
      return "mid patrol overlaps last stretch";
    }
    extraWps.push([a, b]);
  }
  const allWaypoints = [...gateWps, ...extraWps.flat()];
  if (anySees(grid, allWaypoints, extract, SIGHT_PX)) return "a patrol sees extract";
  if (anySees(grid, allWaypoints, spawn, SIGHT_PX)) return "a patrol sees spawn";
  for (const wps of extraWps) {
    const samples = samplesAlong(walk, cols, rows, wps, false);
    if (coveredFraction(grid, samples, lastStretch, SIGHT_PX) > 0.25) {
      return "second patrol covers last stretch";
    }
  }
  const sweepGroups = [gateSamples, ...extraWps.map((wps) => samplesAlong(walk, cols, rows, wps, false))];
  const allSweep = sweepGroups.flat();
  const inSweep = (cell) => anySees(grid, allSweep, cell, SIGHT_PX);
  const occupied = /* @__PURE__ */ new Set([spawn, extract, ...allWaypoints]);
  const floors = [];
  for (let i = 0; i < walk.length; i++) if (walk[i]) floors.push(i);
  const safePool = floors.filter(
    (i) => !occupied.has(i) && toPath[i] >= 0 && toPath[i] <= 2 && distFromSpawn[i] >= 3 && distFromExtract[i] >= 10 && !inSweep(i)
  );
  const contestedPool = floors.filter(
    (i) => !occupied.has(i) && inSweep(i) && distFromExtract[i] >= 8 && distFromSpawn[i] >= 8
  );
  const deepPool = floors.filter(
    (i) => !occupied.has(i) && toPath[i] >= 5 && distFromExtract[i] >= 8 && distFromSpawn[i] >= 8
  );
  const deep = pickSeparated(rng, cols, deepPool, occupied, 2, 3);
  if (!deep) return `deep kindling short (${deepPool.length})`;
  for (const i of deep) occupied.add(i);
  const contested = pickSeparated(rng, cols, contestedPool, occupied, 3, 3);
  if (!contested) return `contested kindling short (${contestedPool.length})`;
  for (const i of contested) occupied.add(i);
  const safe = pickSeparated(rng, cols, safePool, occupied, 3, 3);
  if (!safe) return `safe kindling short (${safePool.length})`;
  for (const i of safe) occupied.add(i);
  const kindling = [];
  const pushTier = (cells, tier, startId) => {
    cells.forEach((cell, idx) => {
      const id = startId + idx;
      kindling.push({
        id: `KDL_0${id}`,
        tier,
        position: worldOf(colOf(cols, cell), rowOf(cols, cell))
      });
    });
  };
  pushTier(safe, "safe", 1);
  pushTier(contested, "contested", 4);
  pushTier(deep, "deep", 7);
  const contaminantPool = floors.filter(
    (i) => !occupied.has(i) && distFromSpawn[i] >= 4 && distFromExtract[i] >= 6
  );
  const contaminantsCells = pickSeparated(rng, cols, contaminantPool, occupied, 3, 4);
  if (!contaminantsCells) return `contaminants short (${contaminantPool.length})`;
  for (const i of contaminantsCells) occupied.add(i);
  const contaminants = contaminantsCells.map((cell, idx) => ({
    id: `CTM_NODE_0${idx + 1}`,
    tier: deepPool.includes(cell) ? "deep" : contestedPool.includes(cell) ? "contested" : "safe",
    position: worldOf(colOf(cols, cell), rowOf(cols, cell))
  }));
  const enemies = [];
  const pushPatrol = (id, wps, type) => {
    enemies.push({
      id,
      type,
      spawn: { col: colOf(cols, wps[0]), row: rowOf(cols, wps[0]) },
      facing: facingDeg(cols, wps[0], wps[1] ?? wps[0]),
      patrol: {
        waypoints: wps.map((i) => ({ col: colOf(cols, i), row: rowOf(cols, i) })),
        mode: "pingpong",
        pauseMs: GAME_CONSTANTS.AI.WAYPOINT_PAUSE_MS
      }
    });
  };
  pushPatrol("ENM_INF_01", gateWps, "infiltrator");
  const rewriterExtra = pickRewriterExtraIndex(extraWps, contested, deep, cols);
  extraWps.forEach((wps, idx) => {
    const rewriter = idx === rewriterExtra;
    pushPatrol(rewriter ? "ENM_RWR_01" : `ENM_INF_0${idx + 2}`, wps, rewriter ? "rewriter" : "infiltrator");
  });
  if (enemies.filter((e) => e.type === "rewriter").length !== 1) {
    return "rewriter count not 1";
  }
  const landmarkPool = floors.filter((i) => !occupied.has(i) && toPath[i] >= 0);
  const landmarkCount = rng.nextInt(2, 4);
  const landmarkCells = pickSeparated(rng, cols, landmarkPool, occupied, landmarkCount, 5) ?? [];
  const landmarks = landmarkCells.map((cell, idx) => ({
    id: `LMK_${idx + 1}`,
    col: colOf(cols, cell),
    row: rowOf(cols, cell),
    style: LANDMARK_STYLES[idx % LANDMARK_STYLES.length]
  }));
  return { spawn, extract, kindling, contaminants, enemies, landmarks };
}
function jiaRoleFromForm(form) {
  return form.lexemes.sense === "sense_hear" ? "rewriter" : "infiltrator";
}
function attachLexiconForms(rng, fragmentTypeId, placed, drawn) {
  const warnings = [...drawn.warnings];
  const hostForms = drawn.forms.filter((form) => form.portfolio !== "jia");
  const hearingOnWall = hostForms.some((form) => form.lexemes.sense === "sense_hear");
  const requirePatrol = (hearing, gate = false) => {
    const form = drawOne(rng, {
      portfolio: "jia",
      fragmentTypeId,
      motion: "motion_patrol",
      sense: gate ? "sense_cone" : hearing ? "sense_hear" : void 0,
      forbidSense: hearing ? void 0 : ["sense_hear"],
      coverage: gate ? "infiltrate" : void 0,
      rhythm: gate ? "rhythm_open" : void 0
    });
    if (!form) throw new Error(`No legal patrol for ${fragmentTypeId}/${hearing ? "hear" : "visual"}/${gate ? "gate" : "any"}`);
    return form;
  };
  let sentryTaken = false;
  const enemySpawns = placed.map((spawn, index) => {
    let form;
    if (index === 0) form = requirePatrol(false, true);
    else if (spawn.type === "rewriter") form = requirePatrol(!hearingOnWall);
    else {
      const sentry = sentryTaken ? null : drawOne(rng, {
        portfolio: "jia",
        fragmentTypeId,
        forbidSense: ["sense_hear"],
        forbidMotion: ["motion_patrol"]
      });
      if (sentry) {
        form = sentry;
        sentryTaken = true;
      } else form = requirePatrol(false);
    }
    return { ...spawn, form, type: jiaRoleFromForm(form) };
  });
  const rewriterCount = enemySpawns.filter((e) => e.type === "rewriter").length;
  const expectedRewriters = hearingOnWall ? 0 : 1;
  if (rewriterCount !== expectedRewriters) warnings.push(`jia rewriter count ${rewriterCount} (want ${expectedRewriters})`);
  const jiaForms = enemySpawns.map((e) => e.form).filter((f) => f !== void 0);
  return {
    enemySpawns,
    contaminationDraw: {
      forms: [...jiaForms, ...hostForms],
      warnings
    }
  };
}
function deployRiftContents(seed, draft, options) {
  if (draft.tileMap.tileSize !== TILE) throw new Error("Production content placement requires 32px logical cells");
  const inputSeed = seed >>> 0;
  const roll = options;
  let lastWhy = "no placement";
  const grid = new TileGrid(draft.tileMap);
  const walk = walkBits2(grid);
  const walls = wallBits(grid);
  let floorCount = 0;
  for (let i = 0; i < walk.length; i++) if (walk[i]) floorCount++;
  if (floorCount < 80) {
    lastWhy = `too few floors (${floorCount})`;
    return lastWhy;
  }
  for (let place = 0; place < MAX_PLACE_ATTEMPTS; place++) {
    const rng = new SeededRandom(mix32(inputSeed, `${options.placementTag ?? "place:0"}:${place}`));
    const placed = placeOnIsland(grid, walk, options.routeObstructions ?? walls, rng, options.routePolicy);
    if (typeof placed === "string") {
      lastWhy = placed;
      continue;
    }
    const spawnPoint = worldOf(colOf(grid.cols, placed.spawn), rowOf(grid.cols, placed.spawn));
    const extractionPoint = {
      id: "EXIT_01",
      position: worldOf(colOf(grid.cols, placed.extract), rowOf(grid.cols, placed.extract)),
      triggerRadius: GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS
    };
    if (sameWorld(extractionPoint.position, forbiddenExtract)) {
      lastWhy = "extract matches handwritten X";
      continue;
    }
    const paintCount = rollPaintHostCount(inputSeed, roll.contaminationAge);
    const spawnCol = colOf(grid.cols, placed.spawn);
    const spawnRow = rowOf(grid.cols, placed.spawn);
    const extractCol = colOf(grid.cols, placed.extract);
    const extractRow = rowOf(grid.cols, placed.extract);
    let contaminationPins = collectContaminationPins(draft.tileMap, {
      spawnCol,
      spawnRow,
      extractCol,
      extractRow,
      kindling: placed.kindling.map((node) => {
        const col = Math.floor(node.position.x / TILE);
        const row = Math.floor(node.position.y / TILE);
        return { col, row, tier: node.tier };
      }),
      paintCount
    });
    if (typeof contaminationPins === "string") {
      console.warn(`[contamination-pins] seed ${inputSeed} retry: ${contaminationPins}`);
      lastWhy = contaminationPins;
      continue;
    }
    const lexiconRng = new SeededRandom(mix32(options.lexiconSeed ?? inputSeed, "lexicon"));
    const drawn = drawSortie(lexiconRng, {
      fragmentTypeId: draft.fragmentTypeId,
      paintCount,
      hasWallEdges: contaminationPins.wallEdges.length > 0,
      hasWallOpenings: doorwayWallSeats(contaminationPins.wallEdges, grid).length > 0,
      hasCorridors: contaminationPins.corridorAabbs.length > 0
    });
    if (drawn.forms.some((form) => form.portfolio === "ding" && isMaterialVolume(form.substrate))) {
      const seat = findTerrainSafeVolumeSeat(contaminationPins.corridorAabbs, (col, row) => grid.isWalkable(col, row));
      if (!seat) {
        lastWhy = "material volume has no legal 2x2 local corridor seat";
        continue;
      }
      contaminationPins = { ...contaminationPins, corridorAabbs: [seat] };
    }
    const bound = attachLexiconForms(
      lexiconRng,
      draft.fragmentTypeId,
      placed.enemies,
      drawn
    );
    const safeEnemySpawns = ensureStaticBodyAccess({
      grid,
      spawnPoint,
      enemySpawns: bound.enemySpawns,
      targets: [
        { id: extractionPoint.id, position: extractionPoint.position, radius: extractionPoint.triggerRadius },
        ...placed.kindling.map((node) => ({ id: node.id, position: node.position, radius: GAME_CONSTANTS.LOOT.SEARCH_RADIUS })),
        ...placed.contaminants.map((node) => ({ id: node.id, position: node.position, radius: GAME_CONSTANTS.LOOT.SEARCH_RADIUS }))
      ]
    }, lexiconRng, draft.fragmentTypeId);
    if (!safeEnemySpawns) {
      lastWhy = "static bodies block player access after legal redraw";
      continue;
    }
    const safeDraw = safeEnemySpawns === bound.enemySpawns ? bound.contaminationDraw : {
      forms: [...safeEnemySpawns.map((enemy) => enemy.form), ...bound.contaminationDraw.forms.filter((form) => form.portfolio !== "jia")],
      warnings: bound.contaminationDraw.warnings
    };
    const layout = {
      seed: inputSeed,
      fragmentTypeId: draft.fragmentTypeId,
      recipeId: options.recipeId,
      contaminationAge: roll.contaminationAge,
      ruinSeverity: roll.ruinSeverity,
      tileMap: draft.tileMap,
      ruins: {
        ...draft,
        contaminationAge: roll.contaminationAge,
        ruinSeverity: roll.ruinSeverity
      },
      walkableMask: makeWalkableMask(grid),
      spawnPoint,
      extractionPoint,
      kindlingNodes: placed.kindling,
      contaminantNodes: placed.contaminants,
      enemySpawns: safeEnemySpawns,
      landmarks: placed.landmarks,
      contaminationPins,
      contaminationDraw: safeDraw
    };
    if (options.postprocess) {
      const processed = options.postprocess(layout);
      if (typeof processed === "string") {
        lastWhy = processed;
        continue;
      }
      return processed;
    }
    return layout;
  }
  return lastWhy;
}
function generateRiftLayout(seed, options) {
  const inputSeed = seed >>> 0;
  const rolled = rollFragmentAxes(inputSeed);
  const roll = {
    contaminationAge: options?.contaminationAge ?? rolled.contaminationAge,
    ruinSeverity: options?.ruinSeverity ?? rolled.ruinSeverity
  };
  let lastWhy = "no attempt";
  for (let island = 0; island < MAX_ISLAND_ATTEMPTS; island++) {
    const recipe = options ? resolveRecipe(inputSeed, island, options) : pickRecipe(inputSeed, island);
    const draftSeed = islandSeed(inputSeed, island);
    let draft;
    try {
      draft = generateRecipeDraft(draftSeed, recipe);
    } catch (err) {
      lastWhy = err instanceof Error ? err.message : String(err);
      continue;
    }
    const deployed = deployRiftContents(inputSeed, draft, {
      recipeId: recipe.id,
      ...roll,
      placementTag: `place:${island}`
    });
    if (typeof deployed !== "string") return deployed;
    lastWhy = deployed;
  }
  throw new Error(
    `generateRiftLayout: seed ${inputSeed} failed after ${MAX_ISLAND_ATTEMPTS} island attempts \xD7 ${MAX_PLACE_ATTEMPTS} placements (${lastWhy})`
  );
}

// src/systems/ai/physical-grid.ts
var BODY_CLEARANCE_EPSILON = 1e-6;
function bodyHasSupport(walk, center3, halfWidth, halfHeight) {
  if (![center3.x, center3.y, halfWidth, halfHeight].every(Number.isFinite) || halfWidth < 0 || halfHeight < 0 || center3.x - halfWidth < 0 || center3.y - halfHeight < 0 || center3.x + halfWidth > walk.cols * walk.tileSize || center3.y + halfHeight > walk.rows * walk.tileSize) return false;
  const insetX = Math.min(halfWidth, BODY_CLEARANCE_EPSILON), insetY = Math.min(halfHeight, BODY_CLEARANCE_EPSILON);
  const firstCol = Math.floor((center3.x - halfWidth + insetX) / walk.tileSize);
  const lastCol = Math.floor((center3.x + halfWidth - insetX) / walk.tileSize);
  const firstRow = Math.floor((center3.y - halfHeight + insetY) / walk.tileSize);
  const lastRow = Math.floor((center3.y + halfHeight - insetY) / walk.tileSize);
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) if (!walk.isWalkable(col, row)) return false;
  }
  return true;
}
function bodyDisplacementFraction(walk, center3, halfWidth, halfHeight, dx, dy) {
  if (!Number.isFinite(center3.x) || !Number.isFinite(center3.y) || !Number.isFinite(halfWidth) || !Number.isFinite(halfHeight) || !Number.isFinite(dx) || !Number.isFinite(dy) || halfWidth < 0 || halfHeight < 0) return 0;
  if (dx === 0 && dy === 0) return 0;
  const size = walk.tileSize, epsilon = BODY_CLEARANCE_EPSILON;
  const firstCol = Math.max(-1, Math.floor((Math.min(center3.x, center3.x + dx) - halfWidth) / size));
  const lastCol = Math.min(walk.cols, Math.floor((Math.max(center3.x, center3.x + dx) + halfWidth) / size));
  const firstRow = Math.max(-1, Math.floor((Math.min(center3.y, center3.y + dy) - halfHeight) / size));
  const lastRow = Math.min(walk.rows, Math.floor((Math.max(center3.y, center3.y + dy) + halfHeight) / size));
  let fraction = 1;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      if (col >= 0 && row >= 0 && col < walk.cols && row < walk.rows && walk.isWalkable(col, row)) continue;
      const minX = col * size - halfWidth + epsilon, maxX = (col + 1) * size + halfWidth - epsilon;
      const minY = row * size - halfHeight + epsilon, maxY = (row + 1) * size + halfHeight - epsilon;
      let entry = 0, exit = fraction;
      if (dx === 0) {
        if (center3.x <= minX || center3.x >= maxX) continue;
      } else {
        const a = (minX - center3.x) / dx, b = (maxX - center3.x) / dx;
        entry = Math.max(entry, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
      if (dy === 0) {
        if (center3.y <= minY || center3.y >= maxY) continue;
      } else {
        const a = (minY - center3.y) / dy, b = (maxY - center3.y) / dy;
        entry = Math.max(entry, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
      if (entry < exit && exit > 0) fraction = Math.min(fraction, entry);
    }
  }
  return fraction < 1 ? Math.max(0, fraction - 1e-4 / Math.max(Math.abs(dx), Math.abs(dy))) : 1;
}

// src/systems/contamination-host-live.ts
function resolveStopLoss(form) {
  const row = STOP_LOSS_DATA[`${form.continuity}_${form.coverage}`];
  if (!row) return "illegal";
  if (!row.legalOccupancies.includes(form.occupancy)) return "illegal";
  if (PORTFOLIO_DATA[form.portfolio].blockWalk && row.family === "unkillable") return "illegal";
  return {
    family: row.family,
    corePolicy: row.corePolicy,
    hittable: row.family !== "unkillable"
  };
}
function chebyshevTiles(a, b) {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}
function pickSpreadSeats(floors, want, gap) {
  if (floors.length === 0 || want <= 0) return [];
  if (want === 1) return [{ ...floors[0] }];
  let pair = null;
  let pairDistance = -1;
  let triple = null;
  let tripleGap = -1, tripleSpread = -1;
  for (let a = 0; a < floors.length; a++) for (let b = a + 1; b < floors.length; b++) {
    const ab = chebyshevTiles(floors[a], floors[b]);
    if (ab < gap) continue;
    if (ab > pairDistance) {
      pairDistance = ab;
      pair = [a, b];
    }
    if (want < 3) continue;
    for (let c = b + 1; c < floors.length; c++) {
      const ac = chebyshevTiles(floors[a], floors[c]), bc = chebyshevTiles(floors[b], floors[c]);
      const minimum = Math.min(ab, ac, bc), spread = ab + ac + bc;
      if (minimum < gap) continue;
      if (minimum > tripleGap || minimum === tripleGap && spread > tripleSpread) {
        tripleGap = minimum;
        tripleSpread = spread;
        triple = [a, b, c];
      }
    }
  }
  const selected = triple ?? pair;
  return selected ? selected.map((i) => ({ ...floors[i] })) : [{ ...floors[0] }];
}
function colonyNucleusSeatsInFloors(floors, countMin, countMax, preferGap, fallbackGap) {
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const floor of floors) {
    const key = `${floor.col},${floor.row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ col: floor.col, row: floor.row });
  }
  if (unique.length === 0) return [];
  const want = Math.max(countMin, Math.min(countMax, 3));
  unique.sort((a, b) => a.row - b.row || a.col - b.col);
  for (const gap of [preferGap, fallbackGap, 1]) {
    const seats = pickSpreadSeats(unique, want, gap);
    if (seats.length >= countMin) return seats;
  }
  return [];
}

// src/generated/rift-world-profile-data.ts
var WORLD_PROFILE_DATA = [
  {
    "id": "ash-strata",
    "label": "\u65E0\u5F69\u5C42\u539F",
    "description": "\u6C89\u79EF\u5C42\u7247\u4E0E\u5931\u8272\u65AD\u9762",
    "material": "strata",
    "surface": {
      "substrate": "strata",
      "coating": "strata",
      "organization": "bands",
      "coverage": 0.46,
      "wear": 0.52,
      "deposits": 0.52,
      "scale": 1.1,
      "relief": 0.52,
      "contrast": 0.75,
      "regionScale": 1.15,
      "quietness": 0.48,
      "formScale": 1.3,
      "fragmentation": 0.65,
      "accentCoverage": 0.02
    },
    "palette": {
      "void": 592137,
      "shadow": 1381653,
      "floorDeep": 2302755,
      "floor": 3421236,
      "floorLight": 4539717,
      "materialDark": 3158064,
      "materialMid": 5855577,
      "materialLight": 7895160,
      "faceLight": 10066329,
      "accentDim": 5395026,
      "accent": 11184810,
      "accentLight": 13421772,
      "peak": 15658734,
      "actorDark": 1842204,
      "actorMid": 12237498,
      "actorLight": 16777215,
      "ground": 3421236,
      "groundLight": 4539717,
      "groundDark": 2302755,
      "wall": 5855577,
      "wallLight": 10066329,
      "wallDark": 3158064
    }
  },
  {
    "id": "crystal-fibre",
    "label": "\u6676\u5316\u6797\u5E8A",
    "description": "\u7EA4\u7EF4\u5E8A\u6CBF\u7EDF\u4E00\u65B9\u5411\u6676\u5316",
    "material": "crystal",
    "surface": {
      "substrate": "strata",
      "coating": "crystal",
      "organization": "clusters",
      "coverage": 0.66,
      "wear": 0.43,
      "deposits": 0.42,
      "scale": 0.95,
      "relief": 0.58,
      "contrast": 0.85,
      "regionScale": 1.1,
      "quietness": 0.5,
      "formScale": 1.5,
      "fragmentation": 0.32,
      "accentCoverage": 0.18
    },
    "palette": {
      "void": 856090,
      "shadow": 1449e3,
      "floorDeep": 2303798,
      "floor": 3158599,
      "floorLight": 4472919,
      "materialDark": 3488592,
      "materialMid": 5001839,
      "materialLight": 7173782,
      "faceLight": 10136256,
      "accentDim": 5326174,
      "accent": 7956100,
      "accentLight": 11444401,
      "peak": 14476773,
      "actorDark": 2433318,
      "actorMid": 11702376,
      "actorLight": 15584925,
      "ground": 3158599,
      "groundLight": 4472919,
      "groundDark": 2303798,
      "wall": 5001839,
      "wallLight": 10136256,
      "wallDark": 3488592
    }
  },
  {
    "id": "ivory-basin",
    "label": "\u5438\u5149\u91C9\u539F",
    "description": "\u539A\u91C9\u6C89\u79EF\u4E0E\u5438\u5149\u7ED3\u8282",
    "material": "glaze",
    "surface": {
      "substrate": "strata",
      "coating": "glaze",
      "organization": "patches",
      "coverage": 0.54,
      "wear": 0.57,
      "deposits": 0.55,
      "scale": 1.2,
      "relief": 0.5,
      "contrast": 0.72,
      "regionScale": 1.4,
      "quietness": 0.55,
      "formScale": 1.6,
      "fragmentation": 0.42,
      "accentCoverage": 0.11
    },
    "palette": {
      "void": 1448997,
      "shadow": 2699322,
      "floorDeep": 7367527,
      "floor": 11182476,
      "floorLight": 12564125,
      "materialDark": 4868945,
      "materialMid": 7695973,
      "materialLight": 9799795,
      "faceLight": 13813675,
      "accentDim": 6443617,
      "accent": 8809848,
      "accentLight": 11639443,
      "peak": 15590084,
      "actorDark": 2369326,
      "actorMid": 4936539,
      "actorLight": 12750939,
      "ground": 11182476,
      "groundLight": 12564125,
      "groundDark": 7367527,
      "wall": 7695973,
      "wallLight": 13813675,
      "wallDark": 4868945
    }
  },
  {
    "id": "carmine-lacquer",
    "label": "\u7329\u91C9\u5C42\u539F",
    "description": "\u9971\u548C\u7EDB\u91C9\u4E0E\u9752\u84DD\u88F8\u5E8A",
    "material": "glaze",
    "surface": {
      "substrate": "strata",
      "coating": "glaze",
      "organization": "patches",
      "coverage": 0.68,
      "wear": 0.28,
      "deposits": 0.55,
      "scale": 1.2,
      "relief": 0.5,
      "contrast": 0.65,
      "regionScale": 1.4,
      "quietness": 0.46,
      "formScale": 1.45,
      "fragmentation": 0.42,
      "accentCoverage": 0.14
    },
    "palette": {
      "void": 1448997,
      "shadow": 1512231,
      "floorDeep": 1320759,
      "floor": 2315112,
      "floorLight": 4361364,
      "materialDark": 5247786,
      "materialMid": 9774917,
      "materialLight": 13980262,
      "faceLight": 15963525,
      "accentDim": 2441094,
      "accent": 3571652,
      "accentLight": 7522780,
      "peak": 16764589,
      "actorDark": 2369326,
      "actorMid": 4936539,
      "actorLight": 12750939,
      "ground": 2315112,
      "groundLight": 4361364,
      "groundDark": 1320759,
      "wall": 9774917,
      "wallLight": 15963525,
      "wallDark": 5247786
    }
  },
  {
    "id": "cobalt-gold",
    "label": "\u94B4\u84DD\u91D1\u8109",
    "description": "\u94B4\u84DD\u6676\u5C42\u4E0E\u91D1\u8272\u5171\u751F\u6C89\u79EF",
    "material": "crystal",
    "surface": {
      "substrate": "strata",
      "coating": "crystal",
      "organization": "bands",
      "coverage": 0.62,
      "wear": 0.34,
      "deposits": 0.58,
      "scale": 0.95,
      "relief": 0.58,
      "contrast": 0.85,
      "regionScale": 1.2,
      "quietness": 0.42,
      "formScale": 1.4,
      "fragmentation": 0.35,
      "accentCoverage": 0.44
    },
    "palette": {
      "void": 856090,
      "shadow": 1449e3,
      "floorDeep": 1056331,
      "floor": 2309512,
      "floorLight": 4221904,
      "materialDark": 6961177,
      "materialMid": 11889444,
      "materialLight": 14131528,
      "faceLight": 15781518,
      "accentDim": 1785949,
      "accent": 3052190,
      "accentLight": 8112572,
      "peak": 16773308,
      "actorDark": 2433318,
      "actorMid": 11702376,
      "actorLight": 15584925,
      "ground": 2309512,
      "groundLight": 4221904,
      "groundDark": 1056331,
      "wall": 11889444,
      "wallLight": 15781518,
      "wallDark": 6961177
    }
  }
];

// src/generation/world-study/profiles.ts
var WORLD_PROFILES = WORLD_PROFILE_DATA;
function worldProfileById(id) {
  const profile = WORLD_PROFILES.find((value) => value.id === id);
  if (!profile) throw new Error(`Unknown world profile: ${id}`);
  return profile;
}

// src/generation/world-study/open-space.ts
function validateWorldOrganization(value) {
  if (!value || !Number.isFinite(value.axis) || !Number.isFinite(value.coherence) || value.coherence < 0 || value.coherence > 1)
    throw new Error("Invalid world organization axis/coherence");
}
function clearanceField(mask, cols, rows) {
  const distance = new Uint16Array(mask.length), queue = new Int32Array(mask.length);
  let head = 0, tail = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) {
      distance[i] = 0;
      queue[tail++] = i;
    } else distance[i] = 65535;
  }
  while (head < tail) {
    const cell = queue[head++], x = cell % cols, y = Math.floor(cell / cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, next = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || distance[next] <= distance[cell] + 1) continue;
      distance[next] = distance[cell] + 1;
      queue[tail++] = next;
    }
  }
  return distance;
}
function erodeOpenLand(land, cols, rows, rng, profile, organization) {
  if (organization) validateWorldOrganization(organization);
  const walls = new Uint8Array(land.length), excluded = new Uint8Array(land.length);
  const coastDistance = clearanceField(land, cols, rows), area = land.reduce((sum, value) => sum + value, 0);
  const target = Math.round(area * profile.voidFraction);
  const basin = { x: rng.nextFloat(cols * 0.4, cols * 0.6), y: rng.nextFloat(rows * 0.4, rows * 0.6) };
  const centres = Array.from({ length: 3 }, () => ({
    x: basin.x + rng.nextFloat(-cols * 0.1, cols * 0.1),
    y: basin.y + rng.nextFloat(-rows * 0.1, rows * 0.1)
  }));
  const sampledMainAngle = rng.nextFloat(0, Math.PI);
  const mainAngle = organization?.axis ?? sampledMainAngle, shapePhase = rng.nextFloat(0, Math.PI * 2);
  let carved = 0, pits = 0, fractures = 0;
  for (let attempt = 0; attempt < 1800 && carved < target; attempt++) {
    const clustered = rng.next() < profile.clustering, centre = rng.pick(centres);
    const cx = clustered ? centre.x + rng.nextGaussian() * cols * 0.12 : rng.nextFloat(cols * 0.13, cols * 0.87);
    const cy = clustered ? centre.y + rng.nextGaussian() * rows * 0.12 : rng.nextFloat(rows * 0.13, rows * 0.87);
    if (clustered && ((cx - basin.x) / (cols * 0.3)) ** 2 + ((cy - basin.y) / (rows * 0.31)) ** 2 > 1) continue;
    const fracture = rng.next() < profile.crackFraction;
    const scale = profile.holeScale * (rng.next() < 0.27 ? rng.nextFloat(1.1, 1.4) : rng.nextFloat(0.72, 1));
    const rx = rng.nextFloat(fracture ? 4.6 : 2.8, fracture ? 7 : 4.6) * scale;
    const ry = rng.nextFloat(fracture ? 1.45 : 2.25, fracture ? 2.3 : 3.9) * scale;
    const angle = mainAngle + rng.nextFloat(-Math.PI, Math.PI) * (1 - profile.directionality);
    const cosine = Math.cos(angle), sine = Math.sin(angle), phase = rng.nextFloat(0, 6.28) + shapePhase;
    const extent = Math.ceil(Math.max(rx, ry) * 1.2 + 1), cells = [];
    let clear = true;
    for (let y = Math.floor(cy - extent); y <= cy + extent; y++) for (let x = Math.floor(cx - extent); x <= cx + extent; x++) {
      const dx = x - cx, dy = y - cy, u = (dx * cosine + dy * sine) / rx;
      const v = (-dx * sine + dy * cosine) / ry + Math.sin(u * 2.1 + phase) * (fracture ? 0.21 : 0.09);
      const polar = Math.atan2(v, u);
      const boundary = 1 + Math.sin(polar * 3 + phase) * 0.2 + Math.sin(polar * 5 - phase) * 0.06;
      if (u * u + v * v > boundary) continue;
      const cell = y * cols + x;
      if (x < 0 || y < 0 || x >= cols || y >= rows || coastDistance[cell] < 6 || excluded[cell]) {
        clear = false;
        continue;
      }
      cells.push(cell);
    }
    if (!clear || cells.length < 8 || carved + cells.length > target * 1.12) continue;
    for (const cell of cells) {
      walls[cell] = 1;
      const x = cell % cols, y = Math.floor(cell / cols);
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) excluded[ny * cols + nx] = 1;
      }
    }
    carved += cells.length;
    if (fracture) fractures++;
    else pits++;
  }
  return { walls, targetFraction: profile.voidFraction, actualFraction: carved / area, pits, fractures };
}

// src/generation/world-study/shape.ts
var cache = /* @__PURE__ */ new WeakMap();
function smooth(mask, cols, rows) {
  const output = new Float32Array(mask.length);
  const weights = [1, 2, 1];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    let value = 0;
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const nx = col + x, ny = row + y;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) value += mask[ny * cols + nx] * weights[x + 1] * weights[y + 1];
    }
    output[row * cols + col] = mask[row * cols + col] * 0.45 + value / 16 * 0.55;
  }
  return output;
}
function fieldsFor(sample) {
  let fields = cache.get(sample);
  if (!fields) {
    fields = { land: smooth(sample.land, sample.cols, sample.rows), walls: smooth(sample.walls, sample.cols, sample.rows) };
    cache.set(sample, fields);
  }
  return fields;
}
function at13(sample, field, x, y) {
  if (x < 0 || y < 0 || x >= sample.cols * sample.tileSize || y >= sample.rows * sample.tileSize) return false;
  const gx = x / sample.tileSize - 0.5, gy = y / sample.tileSize - 0.5;
  const col = Math.floor(gx), row = Math.floor(gy), tx = gx - col, ty = gy - row;
  const cell = (c, r) => c < 0 || r < 0 || c >= sample.cols || r >= sample.rows ? 0 : field[r * sample.cols + c];
  const top = cell(col, row) * (1 - tx) + cell(col + 1, row) * tx;
  const bottom = cell(col, row + 1) * (1 - tx) + cell(col + 1, row + 1) * tx;
  return top * (1 - ty) + bottom * ty >= 0.5;
}
function worldLandAt(sample, x, y) {
  return at13(sample, fieldsFor(sample).land, x, y);
}
function worldWallAt(sample, x, y) {
  return at13(sample, fieldsFor(sample).walls, x, y);
}

// src/generation/world-study/support.ts
var cache2 = /* @__PURE__ */ new WeakMap();
function getWorldSupportGrid(sample) {
  const existing = cache2.get(sample);
  if (existing) return existing;
  const tileSize = 8;
  const cols = sample.cols * sample.tileSize / tileSize, rows = sample.rows * sample.tileSize / tileSize;
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) throw new Error("World support dimensions must align to 8px");
  const walkable = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = col * tileSize + tileSize / 2, y = row * tileSize + tileSize / 2;
    walkable[row * cols + col] = worldLandAt(sample, x, y) && !worldWallAt(sample, x, y) ? 1 : 0;
  }
  const result = { cols, rows, tileSize, walkable };
  cache2.set(sample, result);
  return result;
}
function canStandWorld(sample, x, y, halfSize = 10) {
  const grid = getWorldSupportGrid(sample);
  const left = Math.floor((x - halfSize + 1e-3) / grid.tileSize), right = Math.floor((x + halfSize - 1e-3) / grid.tileSize);
  const top = Math.floor((y - halfSize + 1e-3) / grid.tileSize), bottom = Math.floor((y + halfSize - 1e-3) / grid.tileSize);
  for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows || !grid.walkable[row * grid.cols + col]) return false;
  }
  return true;
}

// src/generation/world-study/space-quality.ts
var DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];
var CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
var OPEN_SPACE_LIMITS = {
  broadFloorRatio: 0.56,
  multidirectionalRatio: 0.43,
  localOpenRatio: 0.18,
  coreCoverage: 0.985,
  maximumAlleyCells: 14
};
function connected(mask, cols, rows, start) {
  const parent = new Int32Array(mask.length).fill(-1), cells = [];
  if (start < 0 || !mask[start]) return { cells, parent };
  cells.push(start);
  parent[start] = start;
  for (let head = 0; head < cells.length; head++) {
    const cell = cells[head], x = cell % cols, y = Math.floor(cell / cols);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx, ny = y + dy, next = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !mask[next] || parent[next] !== -1) continue;
      parent[next] = cell;
      cells.push(next);
    }
  }
  return { cells, parent };
}
function openSpaceBodyFits(sample, x, y) {
  return canStandWorld(sample, x, y);
}
function bodyRoute(sample, parent, start, goal) {
  if (parent[goal] === -1) return false;
  const { cols, tileSize: tile } = sample;
  let cell = goal;
  while (cell !== start) {
    const previous = parent[cell];
    if (previous < 0 || previous === cell) return false;
    const x = (cell % cols + 0.5) * tile, y = (Math.floor(cell / cols) + 0.5) * tile;
    const px = (previous % cols + 0.5) * tile, py = (Math.floor(previous / cols) + 0.5) * tile;
    for (let offset = 0; offset <= tile; offset += 2) {
      if (!openSpaceBodyFits(sample, x + (px - x) * offset / tile, y + (py - y) * offset / tile)) return false;
    }
    cell = previous;
  }
  return openSpaceBodyFits(sample, sample.spawn.x, sample.spawn.y);
}
function evaluateOpenSpace(sample) {
  const { cols, rows, tileSize, land, walls } = sample, failures = [];
  const floor = Uint8Array.from(land, (value, i) => value && !walls[i] ? 1 : 0);
  const distance = clearanceField(floor, cols, rows), coast = clearanceField(land, cols, rows);
  const core = Uint8Array.from(floor, (value, i) => value && distance[i] >= 3 ? 1 : 0);
  const open = new Uint8Array(floor.length), alley = new Uint8Array(floor.length);
  const start = Math.floor(sample.spawn.y / tileSize) * cols + Math.floor(sample.spawn.x / tileSize);
  const goal = Math.floor(sample.exit.y / tileSize) * cols + Math.floor(sample.exit.x / tileSize);
  let floorCells2 = 0, coreCells = 0, openCells = 0, landCells = 0;
  const ray = (x, y, dx, dy) => {
    for (let step = 1; step <= 12; step++) {
      const nx = x + dx * step, ny = y + dy * step, cell = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return { length: step - 1, wall: false };
      if (!floor[cell]) return { length: step - 1, wall: walls[cell] === 1 };
    }
    return { length: 12, wall: false };
  };
  for (let cell = 0; cell < floor.length; cell++) {
    landCells += land[cell];
    if (!floor[cell]) continue;
    floorCells2++;
    coreCells += core[cell];
    const x = cell % cols, y = Math.floor(cell / cols);
    let openAxes = 0, pinched = false, longAxis = false;
    for (const [dx, dy] of DIRECTIONS) {
      const left = ray(x, y, dx, dy), right = ray(x, y, -dx, -dy);
      if (left.length >= 4 && right.length >= 4 && left.length + right.length >= 13) openAxes++;
      if (left.wall && right.wall && left.length + right.length + 1 <= 8) pinched = true;
      if (left.length + right.length >= 18) longAxis = true;
    }
    if (openAxes >= 2) {
      open[cell] = 1;
      openCells++;
    }
    if (coast[cell] >= 6 && pinched && longAxis && openAxes < 2) alley[cell] = 1;
  }
  const allReach = connected(floor, cols, rows, start), coreReach = connected(core, cols, rows, start);
  if (allReach.cells.length !== floorCells2) failures.push("Disconnected supported floor");
  const broadFloorRatio = coreCells / Math.max(1, floorCells2), coreCoverage = coreReach.cells.length / Math.max(1, coreCells);
  const multidirectionalRatio = openCells / Math.max(1, floorCells2);
  if (broadFloorRatio < OPEN_SPACE_LIMITS.broadFloorRatio) failures.push("Too little broad floor");
  if (coreCoverage < OPEN_SPACE_LIMITS.coreCoverage) failures.push("Narrow bottleneck splits broad floor");
  if (multidirectionalRatio < OPEN_SPACE_LIMITS.multidirectionalRatio) failures.push("Too little multidirectional open space");
  let minX = cols, minY = rows, maxX = 0, maxY = 0;
  for (const cell of coreReach.cells) {
    const x = cell % cols, y = Math.floor(cell / cols);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (minX > cols * 0.24 || maxX < cols * 0.76 || minY > rows * 0.25 || maxY < rows * 0.75)
    failures.push("Broad floor does not cross the interior in both axes");
  let worstLocalOpenRatio = 1;
  for (let y = 12; y < rows - 12; y += 8) for (let x = 12; x < cols - 12; x += 8) {
    if (coast[y * cols + x] < 9) continue;
    let count = 0, opened = 0;
    for (let dy = -8; dy < 8; dy++) for (let dx = -8; dx < 8; dx++) {
      const cell = (y + dy) * cols + x + dx;
      if (floor[cell]) {
        count++;
        opened += open[cell];
      }
    }
    if (count >= 96) worstLocalOpenRatio = Math.min(worstLocalOpenRatio, opened / count);
  }
  if (worstLocalOpenRatio < OPEN_SPACE_LIMITS.localOpenRatio) failures.push("Locally corridor-dominated interior");
  let longestAlley = 0;
  for (let cell = 0; cell < alley.length; cell++) {
    if (!alley[cell]) continue;
    const x = cell % cols, y = Math.floor(cell / cols);
    for (const [dx, dy] of DIRECTIONS) {
      let length = 1;
      while (x + dx * length >= 0 && x + dx * length < cols && y + dy * length >= 0 && y + dy * length < rows && alley[(y + dy * length) * cols + x + dx * length]) length++;
      longestAlley = Math.max(longestAlley, length);
    }
  }
  if (longestAlley > OPEN_SPACE_LIMITS.maximumAlleyCells) failures.push("Long alley between tears");
  const continuous = bodyRoute(sample, coreReach.parent, start, goal);
  if (!continuous) failures.push("No continuous broad-body spawn/exit route");
  return {
    accepted: failures.length === 0,
    failures,
    floorCells: floorCells2,
    voidFraction: 1 - floorCells2 / Math.max(1, landCells),
    broadFloorRatio,
    multidirectionalRatio,
    worstLocalOpenRatio,
    coreCoverage,
    longestAlley,
    bodyRoute: continuous
  };
}

// src/generated/rift-world-space-data.ts
var WORLD_SPACE_DATA = [
  {
    "id": "open-scars",
    "label": "\u758F\u843D\u8680\u5751",
    "voidFraction": 0.09,
    "crackFraction": 0.2,
    "holeScale": 1,
    "directionality": 0.2,
    "clustering": 0.25
  },
  {
    "id": "fracture-fields",
    "label": "\u65AD\u88C2\u8352\u91CE",
    "voidFraction": 0.115,
    "crackFraction": 0.7,
    "holeScale": 1.1,
    "directionality": 0.65,
    "clustering": 0.65
  }
];

// src/generation/world-study/space-profile.ts
var SPACE_PROFILES = WORLD_SPACE_DATA;
var SPACE_LIMITS = {
  voidFraction: [0.04, 0.18],
  crackFraction: [0, 1],
  holeScale: [0.65, 1.4],
  directionality: [0, 1],
  clustering: [0, 1]
};
function validateSpaceProfile(profile) {
  if (!profile || !profile.id || !profile.label) throw new Error("Space profile needs an id and label");
  for (const key of Object.keys(SPACE_LIMITS)) {
    const [min, max] = SPACE_LIMITS[key], value = profile[key];
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error(`Space ${key} must be in [${min}, ${max}], got ${value}`);
  }
}
function spaceProfileForTopology(topology) {
  const id = topology === "loops" ? "open-scars" : "fracture-fields";
  const profile = SPACE_PROFILES.find((value) => value.id === id);
  if (!profile) throw new Error(`Missing space preset ${id}`);
  validateSpaceProfile(profile);
  return profile;
}

// src/generation/world-study/layout.ts
var COLS = 112;
var ROWS = 76;
var TILE_SIZE = 16;
var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function splitSeed(seed, salt) {
  let value = Math.imul(seed ^ salt, 73244475);
  value = Math.imul(value ^ value >>> 16, 73244475);
  return (value ^ value >>> 16) >>> 0;
}
function flood(mask, start) {
  const queue = [start];
  const seen = new Uint8Array(mask.length);
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const col = cell % COLS, row = Math.floor(cell / COLS);
    for (const [dx, dy] of DIRS) {
      const x = col + dx, y = row + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const next = y * COLS + x;
      if (mask[next] && !seen[next]) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  return queue;
}
function components(mask) {
  const remaining = new Uint8Array(mask);
  const result = [];
  for (let cell = 0; cell < remaining.length; cell++) {
    if (!remaining[cell]) continue;
    const part = flood(remaining, cell);
    for (const index of part) remaining[index] = 0;
    result.push(part);
  }
  return result.sort((a, b) => b.length - a.length);
}
function clearance(mask, col, row, radius) {
  for (let y = row - radius; y <= row + radius; y++) for (let x = col - radius; x <= col + radius; x++) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS || !mask[y * COLS + x]) return false;
  }
  return true;
}
function makeLand(seed) {
  const rng = new SeededRandom(splitSeed(seed, 2167264849));
  const phases = Array.from({ length: 4 }, () => rng.nextFloat(0, Math.PI * 2));
  const land = new Uint8Array(COLS * ROWS);
  const cx = COLS / 2 + rng.nextFloat(-2, 2), cy = ROWS / 2 + rng.nextFloat(-1, 1);
  for (let row = 2; row < ROWS - 2; row++) for (let col = 2; col < COLS - 2; col++) {
    const x = (col - cx) / 50, y = (row - cy) / 32;
    const angle = Math.atan2(y, x);
    const coast = 1 + 0.055 * Math.sin(angle * 3 + phases[0]) + 0.036 * Math.sin(angle * 5 + phases[1]) + 0.025 * Math.sin(angle * 9 + phases[2]) + 0.015 * Math.sin(angle * 17 + phases[3]);
    if (Math.hypot(x, y) < coast) land[row * COLS + col] = 1;
  }
  return land;
}
function formationsOf(walls) {
  return components(walls).map((cells, id) => {
    let cx = 0, cy = 0;
    for (const cell of cells) {
      cx += cell % COLS;
      cy += Math.floor(cell / COLS);
    }
    cx /= cells.length;
    cy /= cells.length;
    let xx = 0, yy = 0, xy = 0;
    for (const cell of cells) {
      const dx = cell % COLS - cx, dy = Math.floor(cell / COLS) - cy;
      xx += dx * dx;
      yy += dy * dy;
      xy += dx * dy;
    }
    return { id, cells, center: { x: (cx + 0.5) * TILE_SIZE, y: (cy + 0.5) * TILE_SIZE }, angle: 0.5 * Math.atan2(2 * xy, xx - yy) };
  });
}
var diagnostics = /* @__PURE__ */ new WeakMap();
var MAX_SPACE_ATTEMPTS = 12;
function generateWorldSample(profileId, topologyId, seed, spaceProfile, organization) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("World seed must be an unsigned 32-bit integer");
  if (topologyId !== "loops" && topologyId !== "channels") throw new Error(`Unknown topology: ${topologyId}`);
  const profile = typeof profileId === "string" ? worldProfileById(profileId) : profileId;
  const space = spaceProfile ?? spaceProfileForTopology(topologyId);
  validateSpaceProfile(space);
  if (organization) validateWorldOrganization(organization);
  const land = makeLand(seed);
  const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
  const fieldRng = new SeededRandom(splitSeed(seed, 2300139489));
  const phase = fieldRng.nextFloat(0, Math.PI * 2), axis = fieldRng.nextFloat(-0.7, 0.7);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const index = row * COLS + col;
    flowAngle[index] = organization ? organization.axis + (1 - organization.coherence) * (0.45 * Math.sin(row * 0.09 + phase) + 0.15 * Math.cos(col * 0.06 + phase)) : axis + 0.45 * Math.sin(row * 0.09 + phase) + 0.15 * Math.cos(col * 0.06 + phase);
    deposition[index] = 0.5 + 0.24 * Math.sin(col * 0.077 + row * 0.04 + phase) + 0.22 * Math.cos(row * 0.13 - col * 0.032 + phase);
  }
  let reason = "No erosion candidate";
  for (let attempt = 0; attempt < MAX_SPACE_ATTEMPTS; attempt++) {
    const rng = new SeededRandom(splitSeed(seed, 559290765 + attempt * 2654435761));
    const erosion = erodeOpenLand(land, COLS, ROWS, rng, space, organization), walls = erosion.walls;
    if (erosion.actualFraction < space.voidFraction * 0.85) {
      reason = "Requested erosion density could not fit broad spacing";
      continue;
    }
    const floor = Uint8Array.from(land, (value, index) => value && !walls[index] ? 1 : 0);
    const seats = [];
    for (let cell = 0; cell < floor.length; cell++)
      if (floor[cell] && clearance(floor, cell % COLS, Math.floor(cell / COLS), 2)) seats.push(cell);
    if (seats.length < 2) {
      reason = "No broad spawn/exit seats";
      continue;
    }
    const nearest = (targetX, targetY) => {
      let best = seats[0], bestDistance = Infinity;
      for (const cell of seats) {
        const dx = cell % COLS - targetX, dy = Math.floor(cell / COLS) - targetY, distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = cell;
        }
      }
      return best;
    };
    const point = (cell) => ({ x: (cell % COLS + 0.5) * TILE_SIZE, y: (Math.floor(cell / COLS) + 0.5) * TILE_SIZE });
    const sample = {
      profile,
      topologyId,
      seed,
      cols: COLS,
      rows: ROWS,
      tileSize: TILE_SIZE,
      land,
      walls,
      spawn: point(nearest(25, 55)),
      exit: point(nearest(87, 19)),
      formations: formationsOf(walls),
      flowAngle,
      deposition
    };
    const quality = evaluateOpenSpace(sample);
    if (!quality.accepted) {
      reason = quality.failures.join("; ");
      continue;
    }
    diagnostics.set(sample, { space, attempt, pits: erosion.pits, fractures: erosion.fractures, quality });
    return sample;
  }
  throw new Error(`Open-space generation rejected after ${MAX_SPACE_ATTEMPTS} bounded attempts (${space.id}, seed ${seed}): ${reason}`);
}

// src/generation/world-study/region-field.ts
function compositionOf(recipe) {
  return {
    organization: recipe.organization ?? "patches",
    regionScale: recipe.regionScale ?? 1,
    quietness: recipe.quietness ?? 0.42,
    formScale: recipe.formScale ?? 1,
    fragmentation: recipe.fragmentation ?? 0.45,
    accentCoverage: recipe.accentCoverage ?? 0.1
  };
}

// src/generation/world-study/world-scenery.ts
function attachWorldScenery(sample, conditions, landmarks, tileSize) {
  const scenery = landmarks.map((landmark, i) => {
    const x = (landmark.col + 0.5) * tileSize, y = (landmark.row + 0.5) * tileSize;
    const cell = Math.min(sample.land.length - 1, Math.floor(y / sample.tileSize) * sample.cols + Math.floor(x / sample.tileSize));
    return {
      id: landmark.id,
      x,
      y,
      angle: sample.flowAngle[cell] ?? 0,
      radius: conditions.scenery.radiusPx * (i === 0 ? 1 : 0.94),
      kind: conditions.scenery.kind,
      density: conditions.scenery.density,
      seed: mix32(conditions.streams.material, `landmark:${landmark.id}`),
      motion: conditions.scenery.motion
    };
  });
  return { ...sample, scenery };
}

// src/generation/world-study/surface-field.ts
function validateSurfaceRecipe(recipe) {
  if (!recipe || !["strata", "crystal", "glaze"].includes(recipe.substrate) || !["strata", "crystal", "glaze"].includes(recipe.coating)) throw new Error("Unsupported material operator");
  const composition = compositionOf(recipe);
  if (!["patches", "bands", "clusters"].includes(composition.organization)) throw new Error("Invalid region organization");
  for (const key of ["regionScale", "quietness", "formScale", "fragmentation", "accentCoverage"]) {
    const value = composition[key], isScale = key === "regionScale" || key === "formScale";
    if (!Number.isFinite(value) || value < (isScale ? 0.5 : 0) || value > (isScale ? 2 : 1)) throw new Error(`Invalid composition ${key}`);
  }
  for (const key of ["coverage", "wear", "deposits", "scale", "relief", "contrast"]) {
    const value = recipe[key], min = key === "scale" ? 0.5 : 0, max = key === "scale" ? 2 : 1;
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid surface ${key}: ${value}`);
  }
}

// src/generation/world-study/world-conditions.ts
var WORLD_CONTESTED_MIN_THREAT = 0.18;
var STREAMS = ["world", "layout", "material", "placement", "encounters", "motion"];
var RULES = ["deposition", "fracture", "aggregation"];
var CAPABILITIES = /* @__PURE__ */ new Set([
  "surface:strata",
  "surface:crystal",
  "surface:glaze",
  "field:direction",
  "support:single-plane",
  "support:grid8",
  "body:aabb20",
  "void:opaque",
  "organization:patches",
  "organization:bands",
  "organization:clusters",
  "collision:dynamic",
  "space:multilevel"
]);
var UINT_MAX = 4294967295;
var uint = (value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= UINT_MAX;
var inRange = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
var blend = (from, to, amount) => from + (to - from) * amount;
var clauseValid = (value) => typeof value === "string" && value.length <= 200 && value.split("|").every((capability) => CAPABILITIES.has(capability));
function validClauses(value) {
  return Array.isArray(value) && value.length <= 16 && new Set(value).size === value.length && value.every(clauseValid);
}
function worldConditionStreams(seed) {
  if (!uint(seed)) throw new Error("Invalid world conditions seed");
  return Object.freeze(Object.fromEntries(STREAMS.map((name) => [name, mix32(seed, `world-conditions-v1:${name}`)])));
}
function worldOrganizationOf(conditions) {
  if (!validWorldConditions(conditions)) throw new Error("Invalid world organization conditions");
  return Object.freeze({
    axis: mix32(conditions.streams.world, "organization-axis") / 4294967296 * Math.PI,
    coherence: conditions.parameters.coherence
  });
}
function worldCapabilities(profile, space) {
  validateSurfaceRecipe(profile.surface);
  validateSpaceProfile(space);
  return /* @__PURE__ */ new Set([
    "support:single-plane",
    "support:grid8",
    "body:aabb20",
    "void:opaque",
    "field:direction",
    "organization:patches",
    "organization:bands",
    "organization:clusters",
    `surface:${profile.surface.substrate}`,
    `surface:${profile.surface.coating}`
  ]);
}
function worldConditionCompatibility(program, capabilities) {
  if (!validClauses(program.requiredCapabilities) || !validClauses(program.excludedCapabilities))
    throw new Error("Unsupported world capability clause");
  const matches = (clause) => clause.split("|").some((capability) => capabilities.has(capability));
  const missing = program.requiredCapabilities.filter((clause) => !matches(clause));
  const conflicts = program.excludedCapabilities.filter(matches);
  return { compatible: !missing.length && !conflicts.length, missing, conflicts };
}
function validWorldConditions(value) {
  try {
    if (!value || typeof value !== "object") return false;
    const c = value, p = c.parameters, s = c.semantic, v = c.scenery;
    const streams = worldConditionStreams(c.seed);
    if (c.version !== 1 || c.programVersion !== 1 || !uint(c.seed) || !RULES.includes(c.rule) || typeof c.programId !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(c.programId) || typeof c.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(c.sourceHash) || !validClauses(c.requiredCapabilities) || !c.requiredCapabilities.length || !validClauses(c.excludedCapabilities) || !p || !inRange(p.strength, 0, 1) || !inRange(p.coherence, 0, 1) || !inRange(p.scale, 0.5, 2) || !c.streams || !STREAMS.every((name) => uint(c.streams[name]) && c.streams[name] === streams[name]) || !s || s.bodySizePx !== 20 || s.supportStepPx !== 8 || s.voidBlocksSight !== true || s.sceneryBlocksMovement !== false || !inRange(s.minimumDeepDetourPx, 0, 2048) || !inRange(s.safeMaxThreat, 0, 1) || !inRange(s.routeThreatPenalty, 0, 64) || s.minimumDeepDetourPx <= 0 || s.routeThreatPenalty <= 0 || s.safeMaxThreat >= WORLD_CONTESTED_MIN_THREAT || !v || !["strata-fold", "crystal-fan", "glaze-basin"].includes(v.kind) || v.scale !== p.scale || !inRange(v.radiusPx, 32, 128) || !inRange(v.density, 0, 1) || !v.motion || v.motion.kind !== (c.rule === "fracture" ? "shear" : c.rule === "aggregation" ? "pulse" : "settle") || !inRange(v.motion.amplitude, 0, 1.5) || !inRange(v.motion.periodSeconds, 7, 30) || !Array.isArray(c.fallbackSeeds) || !c.fallbackSeeds.length || c.fallbackSeeds.length > 32 || new Set(c.fallbackSeeds).size !== c.fallbackSeeds.length || !c.fallbackSeeds.every(uint)) return false;
    return true;
  } catch {
    return false;
  }
}
function applyWorldConditions(profile, space, conditions) {
  if (!validWorldConditions(conditions)) throw new Error("Invalid frozen world conditions");
  const compatibility = worldConditionCompatibility(conditions, worldCapabilities(profile, space));
  if (!compatibility.compatible) throw new Error(`Incompatible world conditions: missing=${compatibility.missing.join(";")} conflicts=${compatibility.conflicts.join(";")}`);
  const expectedScenery = profile.surface.coating === "crystal" ? "crystal-fan" : profile.surface.coating === "glaze" ? "glaze-basin" : "strata-fold";
  if (conditions.scenery.kind !== expectedScenery) throw new Error("Scenery does not match frozen surface capability");
  const base = profile.surface, composition = compositionOf(base), { strength: s, coherence: c, scale } = conditions.parameters;
  const common = { regionScale: blend(composition.regionScale, scale, 0.65), formScale: blend(composition.formScale, scale, 0.5) };
  const holeScale = blend(space.holeScale, 0.65 + (scale - 0.5) / 1.5 * 0.75, 0.35);
  let surface, nextSpace;
  if (conditions.rule === "deposition") {
    surface = {
      ...base,
      ...common,
      organization: "bands",
      deposits: blend(base.deposits, 1, s * 0.5),
      wear: blend(base.wear, 0, s * 0.25),
      quietness: blend(composition.quietness, 0.7, s * 0.4),
      fragmentation: blend(composition.fragmentation, 0, c * 0.5)
    };
    nextSpace = {
      ...space,
      holeScale,
      crackFraction: blend(space.crackFraction, 0, s * 0.55),
      directionality: blend(space.directionality, c, 0.6),
      clustering: blend(space.clustering, c, 0.3)
    };
  } else if (conditions.rule === "fracture") {
    surface = {
      ...base,
      ...common,
      organization: "bands",
      wear: blend(base.wear, 1, s * 0.45),
      coverage: blend(base.coverage, 0, s * 0.18),
      fragmentation: blend(composition.fragmentation, 1, s * 0.65),
      quietness: blend(composition.quietness, 0.4, s * 0.3)
    };
    nextSpace = {
      ...space,
      holeScale,
      crackFraction: blend(space.crackFraction, 1, s * 0.7),
      directionality: blend(space.directionality, c, 0.8),
      clustering: blend(space.clustering, 0, s * 0.3)
    };
  } else {
    surface = {
      ...base,
      ...common,
      organization: "clusters",
      coverage: blend(base.coverage, 1, s * 0.25),
      deposits: blend(base.deposits, 1, s * 0.4),
      fragmentation: blend(composition.fragmentation, 0, c * 0.35),
      quietness: blend(composition.quietness, 0.75, s * 0.35)
    };
    nextSpace = {
      ...space,
      holeScale,
      crackFraction: blend(space.crackFraction, 0, s * 0.4),
      directionality: blend(space.directionality, c, 0.35),
      clustering: blend(space.clustering, 1, s * 0.65)
    };
  }
  validateSurfaceRecipe(surface);
  validateSpaceProfile(nextSpace);
  return { profile: { ...profile, palette: { ...profile.palette }, surface }, space: nextSpace };
}

// src/generated/contamination-capability-data.ts
var BEHAVIOR_PROFILE_DATA = {
  "rhythm_open": {
    "restMs": 0,
    "wakeMs": 0,
    "activeMs": 0,
    "releaseMs": 0,
    "rangeScale": 1,
    "coneDeg": 0
  },
  "rhythm_sleep": {
    "restMs": 0,
    "wakeMs": 600,
    "activeMs": 0,
    "releaseMs": 0,
    "rangeScale": 1,
    "coneDeg": 0
  },
  "rhythm_pulse": {
    "restMs": 2400,
    "wakeMs": 600,
    "activeMs": 3600,
    "releaseMs": 0,
    "rangeScale": 1,
    "coneDeg": 0
  },
  "sense_narrow": {
    "restMs": 0,
    "wakeMs": 0,
    "activeMs": 0,
    "releaseMs": 0,
    "rangeScale": 1.15,
    "coneDeg": 70
  },
  "sense_reverse": {
    "restMs": 0,
    "wakeMs": 300,
    "activeMs": 0,
    "releaseMs": 600,
    "rangeScale": 1,
    "coneDeg": 0
  }
};

// src/generation/world-study/semantic-deployment.ts
var SemanticDeploymentError = class extends Error {
  constructor(reason) {
    super(`Semantic deployment: ${reason}`);
    this.name = "SemanticDeploymentError";
  }
};
var MIN_ROUTE_DETOUR = 64;
var MIN_EXPOSURE_REDUCTION = 0.2;
var CONTESTED_THREAT = WORLD_CONTESTED_MIN_THREAT;
var DIRS2 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function adjacent(g, cell) {
  const x = cell % g.cols, y = Math.floor(cell / g.cols), out = [];
  for (const [dx, dy] of DIRS2) {
    const xx = x + dx, yy = y + dy, next = yy * g.cols + xx;
    if (xx >= 0 && yy >= 0 && xx < g.cols && yy < g.rows && g.walk[next]) out.push(next);
  }
  return out;
}
function center(g, cell) {
  return { x: (cell % g.cols + 0.5) * g.tile, y: (Math.floor(cell / g.cols) + 0.5) * g.tile };
}
function cellAt(g, p) {
  return Math.floor(p.y / g.tile) * g.cols + Math.floor(p.x / g.tile);
}
function gridDistance(g, a, b) {
  return Math.abs(a % g.cols - b % g.cols) + Math.abs(Math.floor(a / g.cols) - Math.floor(b / g.cols));
}
function flood2(g, starts) {
  const distance = new Int32Array(g.walk.length).fill(-1), parent = new Int32Array(g.walk.length).fill(-1);
  const queue = [];
  for (const cell of starts) if (g.walk[cell] && distance[cell] < 0) {
    distance[cell] = 0;
    queue.push(cell);
  }
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    for (const next of adjacent(g, cell)) if (distance[next] < 0) {
      distance[next] = distance[cell] + 1;
      parent[next] = cell;
      queue.push(next);
    }
  }
  return { distance, parent };
}
function reconstruct3(parent, start, goal) {
  const out = [goal];
  while (out[out.length - 1] !== start) {
    const next = parent[out[out.length - 1]];
    if (next < 0 || out.length > parent.length) return [];
    out.push(next);
  }
  return out.reverse();
}
function shortestPaths(g, start, threat, penalty = 0) {
  const distance = new Float64Array(g.walk.length).fill(Infinity), parent = new Int32Array(g.walk.length).fill(-1);
  const heap = [];
  const push = (cell, cost) => {
    let i = heap.length;
    heap.push({ cell, cost });
    while (i > 0) {
      const p = i - 1 >> 1;
      if (heap[p].cost <= cost) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = { cell, cost };
  };
  const pop = () => {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
        if (last.cost <= heap[child].cost) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  for (const cell of typeof start === "number" ? [start] : start) {
    distance[cell] = 0;
    push(cell, 0);
  }
  while (heap.length) {
    const item = pop();
    if (item.cost !== distance[item.cell]) continue;
    for (const next of diagonalAdjacent(g, item.cell)) {
      const a = center(g, item.cell), b = center(g, next);
      const edge = Math.hypot(a.x - b.x, a.y - b.y);
      const cost = item.cost + edge * (1 + penalty * (threat ? (threat[item.cell] + threat[next]) / 2 : 0));
      if (cost + 1e-7 >= distance[next]) continue;
      distance[next] = cost;
      parent[next] = item.cell;
      push(next, cost);
    }
  }
  return { distance, parent };
}
function diagonalAdjacent(g, cell) {
  const out = adjacent(g, cell), x = cell % g.cols, y = Math.floor(cell / g.cols);
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
    const xx = x + dx, yy = y + dy, next = yy * g.cols + xx;
    if (xx >= 0 && yy >= 0 && xx < g.cols && yy < g.rows && g.walk[next] && g.walk[y * g.cols + xx] && g.walk[yy * g.cols + x]) out.push(next);
  }
  return out;
}
function routeMetrics(g, path, threat) {
  let exposure = 0, length = 0;
  for (let i = 1; i < path.length; i++) {
    const a = center(g, path[i - 1]), b = center(g, path[i]);
    const edge = Math.hypot(a.x - b.x, a.y - b.y);
    length += edge;
    exposure += edge * (threat[path[i - 1]] + threat[path[i]]) / 2;
  }
  return { points: path.map((cell) => center(g, cell)), lengthPx: length, exposurePx: exposure };
}
function patrolSamples(g, enemy) {
  const form = enemy.form ?? (enemy.type === "rewriter" ? REWRITER_FORM : INFILTRATOR_FORM);
  const motion = floorMotionFor(form), spawn = enemy.spawn.row * g.cols + enemy.spawn.col;
  if (motion !== "motion_patrol" || enemy.patrol.mode === "static" || enemy.patrol.waypoints.length < 2)
    return [{ cell: spawn, heading: enemy.facing * Math.PI / 180, turns: motion === "motion_turn" }];
  const result = [];
  const wp = enemy.patrol.waypoints.map((p) => p.row * g.cols + p.col);
  const legs = enemy.patrol.mode === "loop" ? wp.length : wp.length - 1;
  for (let i = 0; i < legs; i++) {
    const from = wp[i], to = wp[(i + 1) % wp.length];
    const path = reconstruct3(flood2(g, [from]).parent, from, to);
    if (!path.length) throw new SemanticDeploymentError(`${enemy.id} has no patrol route`);
    for (let j = 0; j < path.length; j++) {
      const cell = path[j], a = center(g, path[Math.max(0, j - 1)]), b = center(g, path[Math.min(path.length - 1, j + 1)]);
      const heading2 = Math.atan2(b.y - a.y, b.x - a.x);
      result.push({ cell, heading: heading2, turns: false });
      if (enemy.patrol.mode === "pingpong") result.push({ cell, heading: heading2 + Math.PI, turns: false });
    }
  }
  return result;
}
function buildThreat(g, grid, enemies) {
  const field = new Float32Array(g.walk.length), sources = [];
  for (const enemy of enemies) {
    const form = enemy.form ?? (enemy.type === "rewriter" ? REWRITER_FORM : INFILTRATOR_FORM);
    const profile = ENEMY_DATA[enemy.type], narrow = form.lexemes.sense === "sense_narrow" ? BEHAVIOR_PROFILE_DATA.sense_narrow : void 0;
    const range = profile.sightRange * (narrow?.rangeScale ?? 1), halfAngle = (narrow ? narrow.coneDeg / 2 : profile.sightHalfAngleCore) * Math.PI / 180;
    const hearing = profile.hearingRange, samples = patrolSamples(g, enemy), local = new Float32Array(field.length);
    sources.push({ id: enemy.id, motion: floorMotionFor(form), samples: samples.length, sightRange: range, hearingRange: hearing });
    const radius = Math.ceil(Math.max(range, hearing) / g.tile);
    for (const sample of samples) {
      const from = center(g, sample.cell), sx = sample.cell % g.cols, sy = Math.floor(sample.cell / g.cols);
      for (let y = Math.max(0, sy - radius); y <= Math.min(g.rows - 1, sy + radius); y++) for (let x = Math.max(0, sx - radius); x <= Math.min(g.cols - 1, sx + radius); x++) {
        const cell = y * g.cols + x;
        if (!g.walk[cell]) continue;
        const point = center(g, cell), distance = Math.hypot(point.x - from.x, point.y - from.y);
        if (distance > Math.max(range, hearing)) continue;
        const los = hasLineOfSight(grid, from, point, Math.max(range, hearing));
        const bearing = Math.atan2(point.y - from.y, point.x - from.x);
        const offset = Math.abs(Math.atan2(Math.sin(bearing - sample.heading), Math.cos(bearing - sample.heading)));
        const sweep = sample.turns ? GAME_CONSTANTS.AI.SCAN_SWEEP_ANGLE * Math.PI / 180 : 0;
        const inCone = offset <= halfAngle + sweep;
        const peripheral = !narrow && distance <= profile.sightRangePeriph && offset <= profile.sightHalfAnglePeriph * Math.PI / 180 + sweep;
        const visual = los && distance <= range && (inCone || peripheral) ? (0.25 + 0.75 * (1 - distance / range)) * (inCone ? 1 : 0.5) : 0;
        const heardRange = hearing * (los ? 1 : profile.hearingWallFactor);
        const heard = distance <= heardRange ? (profile.hearingWeight > 0 ? 0.28 : 0.08) * (1 - distance / heardRange) : 0;
        local[cell] = Math.max(local[cell], visual, heard);
      }
    }
    for (let i = 0; i < field.length; i++) field[i] = 1 - (1 - field[i]) * (1 - local[i]);
  }
  return { field, sources };
}
function evaluateDeployment(layout, conditions, terrain) {
  const contract = conditions.semantic, grid = new TileGrid(layout.tileMap);
  if (grid.tileSize !== 32) throw new SemanticDeploymentError("requires the conservative 32px deployment grid");
  if (layout.kindlingNodes.length !== 8 || layout.contaminantNodes.length !== 3)
    throw new SemanticDeploymentError("requires exactly eight kindling and three contaminant identities");
  if (!Number.isFinite(contract.minimumDeepDetourPx) || contract.minimumDeepDetourPx <= 0 || !Number.isFinite(contract.safeMaxThreat) || contract.safeMaxThreat < 0 || contract.safeMaxThreat >= CONTESTED_THREAT || !Number.isFinite(contract.routeThreatPenalty) || contract.routeThreatPenalty <= 0)
    throw new SemanticDeploymentError("invalid frozen semantic contract");
  const g = { cols: grid.cols, rows: grid.rows, tile: grid.tileSize, walk: new Uint8Array(grid.cols * grid.rows) };
  for (let i = 0; i < g.walk.length; i++) g.walk[i] = grid.isWalkable(i % g.cols, Math.floor(i / g.cols)) ? 1 : 0;
  const routeGraph = { ...g, walk: g.walk.slice() };
  for (const enemy of layout.enemySpawns.filter(isStaticFloorBody)) routeGraph.walk[enemy.spawn.row * g.cols + enemy.spawn.col] = 0;
  const spawn = cellAt(g, layout.spawnPoint), exit = cellAt(g, layout.extractionPoint.position);
  const fromSpawn = shortestPaths(routeGraph, spawn), fromExit = shortestPaths(routeGraph, exit);
  const shortPath = reconstruct3(fromSpawn.parent, spawn, exit);
  if (!shortPath.length) throw new SemanticDeploymentError("static roster disconnects exit");
  const { field: threat, sources } = buildThreat(g, grid, layout.enemySpawns);
  const shortRoute = routeMetrics(g, shortPath, threat);
  let safePath = [], lowExposureRoute;
  for (const multiplier of [1, 2, 4]) {
    const path = reconstruct3(shortestPaths(routeGraph, spawn, threat, contract.routeThreatPenalty * multiplier).parent, spawn, exit);
    const route = routeMetrics(g, path, threat);
    if (route.lengthPx >= shortRoute.lengthPx + MIN_ROUTE_DETOUR && route.exposurePx <= shortRoute.exposurePx * (1 - MIN_EXPOSURE_REDUCTION)) {
      safePath = path;
      lowExposureRoute = route;
      break;
    }
  }
  if (!lowExposureRoute) throw new SemanticDeploymentError("no longer, materially lower-exposure route");
  const toSafe = flood2(routeGraph, safePath).distance;
  const approach = new Float32Array(threat.length);
  for (let i = 0; i < approach.length; i++) if (routeGraph.walk[i]) {
    const legThreat = (parents) => {
      let cell = i, distance = 0, peak = threat[i];
      while (parents[cell] >= 0 && distance < 3 * g.tile) {
        const next = parents[cell], a = center(g, cell), b = center(g, next);
        distance += Math.hypot(a.x - b.x, a.y - b.y);
        peak = Math.max(peak, threat[next]);
        cell = next;
      }
      return peak;
    };
    approach[i] = Math.min(legThreat(fromSpawn.parent), legThreat(fromExit.parent));
  }
  const occupied = [spawn, exit, ...layout.enemySpawns.map((e) => e.spawn.row * g.cols + e.spawn.col)];
  const extra = (cell) => fromSpawn.distance[cell] + fromExit.distance[cell] - fromSpawn.distance[exit];
  const candidates = [];
  for (let i = 0; i < g.walk.length; i++) if (routeGraph.walk[i] && Number.isFinite(fromSpawn.distance[i]) && fromSpawn.distance[i] >= 4 * g.tile && fromExit.distance[i] >= 5 * g.tile) candidates.push(i);
  const coarseDeep = candidates.filter((cell) => extra(cell) >= contract.minimumDeepDetourPx && approach[cell] >= CONTESTED_THREAT);
  const interaction = terrain && coarseDeep.length >= 3 ? measureInteractionAreas(layout, terrain) : void 0;
  const deepChecks = /* @__PURE__ */ new Map();
  const deep = coarseDeep.filter((cell) => {
    if (!terrain) return true;
    const check = interaction?.at(center(g, cell));
    if (check) deepChecks.set(cell, check);
    return check !== void 0 && check.minimumExtraPx >= contract.minimumDeepDetourPx && check.minimumApproachThreat >= CONTESTED_THREAT;
  });
  const contested = candidates.filter((cell) => threat[cell] >= CONTESTED_THREAT && fromSpawn.distance[cell] >= 7 * g.tile && fromExit.distance[cell] >= 8 * g.tile && extra(cell) < contract.minimumDeepDetourPx * 0.85);
  const safe = candidates.filter((cell) => threat[cell] <= contract.safeMaxThreat && toSafe[cell] <= 2);
  const select = (pool, count, score, name) => {
    const selected = [];
    for (let i = 0; i < count; i++) {
      const available = pool.filter((cell2) => occupied.every((other) => gridDistance(g, cell2, other) >= 3) && (name !== "deep" || selected.every((other) => gridDistance(g, cell2, other) >= 6)));
      available.sort((a, b) => {
        const spacing = (cell2) => selected.length ? Math.min(...selected.map((other) => gridDistance(g, cell2, other))) * 3 : 0;
        return score(b) + spacing(b) - score(a) - spacing(a) || a - b;
      });
      if (!available.length) throw new SemanticDeploymentError(`insufficient separated ${name} seats (${pool.length})`);
      const cell = available[0];
      selected.push(cell);
      occupied.push(cell);
    }
    return selected;
  };
  const deepCells = select(deep, 3, (cell) => Math.min(extra(cell), contract.minimumDeepDetourPx * 2) / g.tile + approach[cell] * 12, "deep");
  const contestedCells = select(contested, 4, (cell) => 18 - Math.abs(threat[cell] - 0.45) * 20, "contested");
  const safeCells = select(safe, 4, (cell) => -toSafe[cell] * 3 - threat[cell] * 30 + Math.min(fromSpawn.distance[cell] / g.tile, 18) * 0.15, "safe");
  const assigned = [safeCells.slice(0, 3), contestedCells.slice(0, 3), deepCells.slice(0, 2)];
  const tiers = ["safe", "contested", "deep"];
  const nodeDiagnostics = [];
  const record = (id, tier, cell) => {
    const checked = tier === "deep" ? deepChecks.get(cell) : void 0;
    nodeDiagnostics.push({
      id,
      tier,
      threat: threat[cell],
      approachThreat: checked?.minimumApproachThreat ?? approach[cell],
      extraTravelPx: checked?.minimumExtraPx ?? extra(cell),
      costBasis: checked ? "interaction-area" : "conservative-node-center",
      ...checked ? { interactionSeats: checked.seats } : {}
    });
  };
  let index = 0;
  const kindlingNodes = assigned.flatMap((cells, t) => cells.map((cell) => {
    const previous = layout.kindlingNodes[index++];
    if (!previous) throw new SemanticDeploymentError("expected eight kindling identities");
    record(previous.id, tiers[t], cell);
    return { ...previous, tier: tiers[t], position: center(g, cell) };
  }));
  const itemCells = [safeCells[3], contestedCells[3], deepCells[2]];
  const contaminantNodes = layout.contaminantNodes.map((node, i) => {
    const cell = itemCells[i];
    if (cell === void 0) throw new SemanticDeploymentError("expected three contaminant identities");
    record(node.id, tiers[i], cell);
    return { ...node, tier: tiers[i], position: center(g, cell) };
  });
  const landmarkSeats = [];
  const addLandmark = (anchor, purpose, style) => {
    const cells = floodRadius(routeGraph, anchor, 3).filter((cell) => occupied.every((other) => gridDistance(g, cell, other) >= 3) && landmarkSeats.every((other) => gridDistance(g, cell, other.cell) >= 5));
    cells.sort((a, b) => gridDistance(g, a, anchor) - gridDistance(g, b, anchor) || a - b);
    if (!cells.length) throw new SemanticDeploymentError(`no readable ${purpose} landmark seat`);
    landmarkSeats.push({ cell: cells[0], purpose, style });
  };
  const turns = safePath.filter((cell, i) => i > 2 && i < safePath.length - 3 && cell - safePath[i - 1] !== safePath[i + 1] - cell);
  const mainTurn = turns[Math.floor(turns.length / 2)] ?? safePath[Math.floor(safePath.length / 2)];
  addLandmark(mainTurn, "turn", "scratches");
  const deepEntryPath = reconstruct3(fromSpawn.parent, spawn, deepCells[0]);
  addLandmark(deepEntryPath[Math.max(0, deepEntryPath.length - 5)], "deep-approach", "crystals");
  addLandmark(safePath[Math.max(0, safePath.length - 5)], "exit-approach", "rubble");
  const landmarks = landmarkSeats.map((seat, i) => ({
    id: `LMK_${i + 1}`,
    col: seat.cell % g.cols,
    row: Math.floor(seat.cell / g.cols),
    style: seat.style
  }));
  return { layout: { ...layout, kindlingNodes, contaminantNodes, landmarks }, diagnostics: {
    version: 1,
    encounterAdjustments: [],
    shortRoute,
    lowExposureRoute,
    exposureReduction: 1 - lowExposureRoute.exposurePx / shortRoute.exposurePx,
    extraRoutePx: lowExposureRoute.lengthPx - shortRoute.lengthPx,
    nodes: nodeDiagnostics,
    landmarks: landmarkSeats.map((seat, i) => ({ id: landmarks[i].id, purpose: seat.purpose })),
    threatSources: sources
  } };
}
function floodRadius(g, start, radius) {
  const seen = /* @__PURE__ */ new Set([start]), queue = [{ cell: start, distance: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const { cell, distance } = queue[i];
    if (distance >= radius) continue;
    for (const next of adjacent(g, cell)) if (!seen.has(next)) {
      seen.add(next);
      queue.push({ cell: next, distance: distance + 1 });
    }
  }
  return [...seen];
}
function applySemanticDeployment(layout, conditions, terrain) {
  let originalFailure;
  try {
    return evaluateDeployment(layout, conditions, terrain);
  } catch (error) {
    if (!(error instanceof SemanticDeploymentError)) throw error;
    originalFailure = error;
  }
  const grid = new TileGrid(layout.tileMap), tile = grid.tileSize;
  if (tile !== 32 || layout.enemySpawns.length < 2) throw originalFailure;
  const g = { cols: grid.cols, rows: grid.rows, tile, walk: new Uint8Array(grid.cols * grid.rows) };
  for (let i = 0; i < g.walk.length; i++) g.walk[i] = grid.isWalkable(i % g.cols, Math.floor(i / g.cols)) ? 1 : 0;
  const spawn = cellAt(g, layout.spawnPoint), exit = cellAt(g, layout.extractionPoint.position);
  const fromSpawn = shortestPaths(g, spawn), fromExit = shortestPaths(g, exit), direct = fromSpawn.distance[exit];
  const path = reconstruct3(fromSpawn.parent, spawn, exit);
  if (!path.length || !Number.isFinite(conditions.semantic.minimumDeepDetourPx)) throw originalFailure;
  const extra = (cell) => fromSpawn.distance[cell] + fromExit.distance[cell] - direct;
  const deepArea = [];
  for (let i = 0; i < g.walk.length; i++) if (g.walk[i] && Number.isFinite(fromSpawn.distance[i]) && extra(i) >= conditions.semantic.minimumDeepDetourPx - tile * 2 && fromSpawn.distance[i] >= 10 * tile && fromExit.distance[i] >= 12 * tile) deepArea.push(i);
  const capacity = /* @__PURE__ */ new Map();
  for (const cell of deepArea) capacity.set(cell, floodRadius(g, cell, 4).filter((p) => extra(p) >= conditions.semantic.minimumDeepDetourPx).length);
  const ranked = deepArea.filter((cell) => (capacity.get(cell) ?? 0) >= 12).sort((a, b) => capacity.get(b) - capacity.get(a) || extra(a) - extra(b) || a - b);
  const anchors = [];
  for (const cell of ranked) {
    if (anchors.every((other) => gridDistance(g, cell, other) >= 6)) anchors.push(cell);
    if (anchors.length === 6) break;
  }
  const eligible = layout.enemySpawns.slice(1).sort((a, b) => Number(floorMotionFor(a.form ?? INFILTRATOR_FORM) === "motion_patrol") - Number(floorMotionFor(b.form ?? INFILTRATOR_FORM) === "motion_patrol") || a.id.localeCompare(b.id));
  let attempts = 0, lastFailure = String(originalFailure);
  for (const anchor of anchors) for (const enemy of eligible) {
    if (++attempts > 12) break;
    if (layout.enemySpawns.some((other) => other.id !== enemy.id && gridDistance(g, anchor, other.spawn.row * g.cols + other.spawn.col) < 4)) continue;
    const position = center(g, anchor), nearest = [...path].sort((a, b) => gridDistance(g, anchor, a) - gridDistance(g, anchor, b) || a - b)[0];
    const inward = center(g, nearest), facing = Math.atan2(position.y - inward.y, position.x - inward.x) * 180 / Math.PI;
    let waypoints = [{ col: anchor % g.cols, row: Math.floor(anchor / g.cols) }];
    const motion = floorMotionFor(enemy.form ?? (enemy.type === "rewriter" ? REWRITER_FORM : INFILTRATOR_FORM));
    if (motion === "motion_patrol") {
      const fromAnchor = shortestPaths(g, anchor);
      const end = ranked.filter((cell) => fromAnchor.distance[cell] >= 5 * tile && fromAnchor.distance[cell] <= 10 * tile && layout.enemySpawns.every((other) => other.id === enemy.id || gridDistance(g, cell, other.spawn.row * g.cols + other.spawn.col) >= 3)).sort((a, b) => capacity.get(b) - capacity.get(a) || fromAnchor.distance[a] - fromAnchor.distance[b] || a - b)[0];
      if (end === void 0) continue;
      const corridor = reconstruct3(flood2(g, [anchor]).parent, anchor, end);
      if (!corridor.length || corridor.some((cell) => fromSpawn.distance[cell] < 8 * tile || fromExit.distance[cell] < 10 * tile)) continue;
      waypoints = [waypoints[0], { col: end % g.cols, row: Math.floor(end / g.cols) }];
    }
    const moved = {
      ...enemy,
      spawn: waypoints[0],
      facing,
      patrol: { ...enemy.patrol, mode: motion === "motion_patrol" ? "pingpong" : "static", waypoints }
    };
    const movedThreat = buildThreat(g, grid, [moved]).field;
    if (movedThreat[spawn] > 1e-3 || movedThreat[exit] > 1e-3 || path.some((cell) => fromExit.distance[cell] <= 5 * tile && movedThreat[cell] >= CONTESTED_THREAT)) continue;
    const enemies = layout.enemySpawns.map((value) => value.id === enemy.id ? moved : value);
    try {
      const result = evaluateDeployment({ ...layout, enemySpawns: enemies }, conditions, terrain);
      return { ...result, diagnostics: { ...result.diagnostics, encounterAdjustments: [{
        id: enemy.id,
        from: center(g, enemy.spawn.row * g.cols + enemy.spawn.col),
        to: position
      }] } };
    } catch (error) {
      if (!(error instanceof SemanticDeploymentError)) throw error;
      lastFailure = error.message;
    }
  }
  throw new SemanticDeploymentError(`initial and ${Math.min(attempts, 12)} bounded encounter seats rejected; ${lastFailure}`);
}
function measureInteractionAreas(layout, terrain) {
  const grid = new TileGrid(terrain.tileMap), tile = grid.tileSize, offset = terrain.coordinateOffset;
  if (tile !== 8 || !Number.isFinite(offset.x) || !Number.isFinite(offset.y))
    throw new SemanticDeploymentError("interaction admission requires the actual 8px terrain and coordinate offset");
  const g = { cols: grid.cols, rows: grid.rows, tile, walk: new Uint8Array(grid.cols * grid.rows) };
  const point = (p) => ({ x: p.x + offset.x, y: p.y + offset.y });
  const coarse = {
    cols: layout.tileMap.cols,
    rows: layout.tileMap.rows,
    tile: layout.tileMap.tileSize,
    walk: Uint8Array.from(layout.tileMap.tiles.flat(), (value) => value === 1 /* FLOOR */ || value === 2 /* FRACTURE */ ? 1 : 0)
  };
  const fineSeat = (p) => {
    const world = point({ x: (p.col + 0.5) * coarse.tile, y: (p.row + 0.5) * coarse.tile });
    return { col: Math.floor(world.x / tile), row: Math.floor(world.y / tile) };
  };
  const enemies = layout.enemySpawns.map((enemy) => {
    const waypoints = [];
    for (let leg = 1; leg < enemy.patrol.waypoints.length; leg++) {
      const a = enemy.patrol.waypoints[leg - 1], b = enemy.patrol.waypoints[leg];
      const start = a.row * coarse.cols + a.col, goal = b.row * coarse.cols + b.col;
      const route = reconstruct3(flood2(coarse, [start]).parent, start, goal);
      const bends = route.filter((cell, i) => i === 0 || i === route.length - 1 || cell - route[i - 1] !== route[i + 1] - cell);
      for (const cell of bends) {
        const seat = fineSeat({ col: cell % coarse.cols, row: Math.floor(cell / coarse.cols) });
        const last = waypoints[waypoints.length - 1];
        if (!last || last.col !== seat.col || last.row !== seat.row) waypoints.push(seat);
      }
    }
    if (!waypoints.length) waypoints.push(fineSeat(enemy.spawn));
    return { ...enemy, spawn: fineSeat(enemy.spawn), patrol: { ...enemy.patrol, waypoints } };
  });
  const staticBodies = enemies.filter(isStaticFloorBody).map((enemy) => center(g, enemy.spawn.row * g.cols + enemy.spawn.col));
  const half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2, clearance2 = half + GAME_CONSTANTS.AI.BODY_SIZE / 2;
  for (let cell = 0; cell < g.walk.length; cell++) {
    const p = center(g, cell);
    g.walk[cell] = bodyHasSupport(grid, p, half, half) && !staticBodies.some((body) => Math.abs(p.x - body.x) < clearance2 - 1e-3 && Math.abs(p.y - body.y) < clearance2 - 1e-3) ? 1 : 0;
  }
  const spawn = cellAt(g, point(layout.spawnPoint)), exit = point(layout.extractionPoint.position), exitSeats = [];
  for (let cell = 0; cell < g.walk.length; cell++) if (g.walk[cell]) {
    const p = center(g, cell);
    if (Math.hypot(p.x - exit.x, p.y - exit.y) <= layout.extractionPoint.triggerRadius) exitSeats.push(cell);
  }
  if (!g.walk[spawn] || !exitSeats.length) throw new SemanticDeploymentError("actual body cannot enter or use extraction area");
  const fromSpawn = shortestPaths(g, spawn), toExit = shortestPaths(g, exitSeats), direct = toExit.distance[spawn];
  if (!Number.isFinite(direct)) throw new SemanticDeploymentError("actual body has no extraction route");
  const senseGraph = { ...g, walk: Uint8Array.from({ length: g.walk.length }, (_, cell) => grid.isWalkable(cell % g.cols, Math.floor(cell / g.cols)) ? 1 : 0) };
  const { field: threat } = buildThreat(senseGraph, grid, enemies);
  const legThreat = (cell, parents) => {
    let travelled = 0, peak = threat[cell];
    while (parents[cell] >= 0 && travelled < 96) {
      const next = parents[cell], a = center(g, cell), b = center(g, next);
      travelled += Math.hypot(a.x - b.x, a.y - b.y);
      peak = Math.max(peak, threat[next]);
      cell = next;
    }
    return peak;
  };
  return { at(node) {
    const target = point(node), radius = GAME_CONSTANTS.LOOT.SEARCH_RADIUS;
    let minimumExtraPx = Infinity, minimumApproachThreat = Infinity, seats = 0;
    const left = Math.max(0, Math.ceil((target.x - radius) / tile - 0.5));
    const right = Math.min(g.cols - 1, Math.floor((target.x + radius) / tile - 0.5));
    const top = Math.max(0, Math.ceil((target.y - radius) / tile - 0.5));
    const bottom = Math.min(g.rows - 1, Math.floor((target.y + radius) / tile - 0.5));
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      const cell = row * g.cols + col, p = center(g, cell);
      if (!g.walk[cell] || !Number.isFinite(fromSpawn.distance[cell]) || !Number.isFinite(toExit.distance[cell]) || Math.hypot(p.x - target.x, p.y - target.y) > radius || !hasLineOfSight(grid, p, target, radius + 1e-3)) continue;
      seats++;
      minimumExtraPx = Math.min(minimumExtraPx, fromSpawn.distance[cell] + toExit.distance[cell] - direct);
      minimumApproachThreat = Math.min(minimumApproachThreat, legThreat(cell, fromSpawn.parent), legThreat(cell, toExit.parent));
    }
    return seats ? { minimumExtraPx, minimumApproachThreat, seats } : void 0;
  } };
}

// src/generation/world-study/production-recipe.ts
function validWorldFallbackSeeds(value) {
  return Array.isArray(value) && value.length <= 32 && new Set(value).size === value.length && value.every((seed) => Number.isSafeInteger(seed) && seed >= 0 && seed <= 4294967295);
}
var COLOR_ROLES = ["void", "shadow", "floorDeep", "floor", "floorLight", "materialDark", "materialMid", "materialLight", "faceLight", "accentDim", "peak", "actorDark", "actorMid", "actorLight", "ground", "groundLight", "groundDark", "wall", "wallLight", "wallDark", "accent", "accentLight"];
var named = (value) => typeof value === "string" && value.length > 0 && value.length <= 200;
function validWorldProductionRecipe(value) {
  try {
    if (!value || typeof value !== "object") return false;
    const recipe = value, profile = recipe.profile;
    if (recipe.version !== 1 && recipe.version !== 2 || recipe.paintGeometryVersion !== void 0 && recipe.paintGeometryVersion !== 1 && recipe.paintGeometryVersion !== 2 || !Number.isSafeInteger(recipe.requestedSeed) || recipe.requestedSeed < 0 || recipe.requestedSeed > 4294967295 || !profile || !named(profile.id) || !named(profile.label) || typeof profile.description !== "string" || profile.description.length > 2e3 || !["strata", "crystal", "glaze"].includes(profile.material) || !profile.palette || !COLOR_ROLES.every((key) => Number.isSafeInteger(profile.palette[key]) && profile.palette[key] >= 0 && profile.palette[key] <= 16777215) || !recipe.space || !named(recipe.space.id) || !named(recipe.space.label) || !named(recipe.contentFragmentTypeId) || !CONTAMINATION_DIALECT_DATA[recipe.contentFragmentTypeId]) return false;
    validateSurfaceRecipe(profile.surface);
    validateSpaceProfile(recipe.space);
    if (recipe.version === 2 && (recipe.paintGeometryVersion !== 2 || !validWorldConditions(recipe.conditions) || recipe.conditions.seed !== recipe.requestedSeed || !validWorldFallbackSeeds(recipe.conditions.fallbackSeeds))) return false;
    return true;
  } catch {
    return false;
  }
}

// src/generation/world-study/production-map.ts
var HOST_TILE = GAME_CONSTANTS.TILE_SIZE;
var HALF_BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
var STATIC_CLEARANCE = HALF_BODY + GAME_CONSTANTS.AI.BODY_SIZE / 2;
var MAX_ATTEMPTS = 8;
var RETRY_STRIDE = 104729;
var DIRECTIONS2 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function center2(grid, cell) {
  return { x: (cell % grid.cols + 0.5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + 0.5) * grid.tileSize };
}
function tileMapOf(bits, cols, rows, tileSize) {
  return { cols, rows, tileSize, tiles: Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_2, col) => bits[row * cols + col] ? 1 /* FLOOR */ : 3 /* VOID */)) };
}
function hostFloorOf(sample) {
  const fine = getWorldSupportGrid(sample), scale = HOST_TILE / fine.tileSize;
  const cols = fine.cols / scale, rows = fine.rows / scale;
  if (!Number.isInteger(scale) || !Number.isInteger(cols) || !Number.isInteger(rows))
    throw new Error("World support must align with the 32px Host grid");
  const floor = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    let supported = true;
    for (let y = 0; y < scale && supported; y++) for (let x = 0; x < scale; x++)
      if (!fine.walkable[(row * scale + y) * fine.cols + col * scale + x]) {
        supported = false;
        break;
      }
    floor[row * cols + col] = supported ? 1 : 0;
  }
  const seen = new Uint8Array(floor.length);
  let largest = [];
  for (let first = 0; first < floor.length; first++) {
    if (!floor[first] || seen[first]) continue;
    const queue = [first];
    seen[first] = 1;
    for (let at14 = 0; at14 < queue.length; at14++) {
      const cell = queue[at14], col = cell % cols, row = Math.floor(cell / cols);
      for (const [dx, dy] of DIRECTIONS2) {
        const x = col + dx, y = row + dy, next = y * cols + x;
        if (x < 0 || y < 0 || x >= cols || y >= rows || !floor[next] || seen[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    if (queue.length > largest.length) largest = queue;
  }
  floor.fill(0);
  for (const cell of largest) floor[cell] = 1;
  return { floor, tileMap: tileMapOf(floor, cols, rows, HOST_TILE) };
}
function ruinsOf(seed, fragmentTypeId, tileMap, land) {
  const { cols, rows, tileSize } = tileMap;
  return {
    seed,
    attempt: 0,
    fragmentTypeId,
    tileMap,
    outline: { seed, attempt: 0, cols, rows, tileSize, land, tileMap, metrics: measureOutline(land, cols, rows) },
    walls: new Uint8Array(land.length),
    features: [],
    metrics: { wallCount: 0, wallRatio: 0, featureCount: 0, leftoverConnected: true }
  };
}
function patrolRoute(grid, waypoints) {
  if (waypoints.length < 2) return [...waypoints];
  const result = [];
  for (let leg = 1; leg < waypoints.length; leg++) {
    const from = waypoints[leg - 1], to = waypoints[leg];
    const start = from.row * grid.cols + from.col, goal = to.row * grid.cols + to.col;
    const parent = new Int32Array(grid.cols * grid.rows).fill(-1), queue = [start];
    parent[start] = start;
    for (let at14 = 0; at14 < queue.length && parent[goal] === -1; at14++) {
      const cell = queue[at14], col = cell % grid.cols, row = Math.floor(cell / grid.cols);
      for (const [dx, dy] of DIRECTIONS2) {
        const x = col + dx, y = row + dy, next = y * grid.cols + x;
        if (!grid.isWalkable(x, y) || parent[next] !== -1) continue;
        parent[next] = cell;
        queue.push(next);
      }
    }
    if (parent[goal] === -1) throw new Error("No conservative body-safe patrol route");
    const path = [goal];
    while (path[path.length - 1] !== start) path.push(parent[path[path.length - 1]]);
    path.reverse();
    result.push(...leg === 1 ? path : path.slice(1));
  }
  return result.filter((cell, i) => i === 0 || i === result.length - 1 || cell - result[i - 1] !== result[i + 1] - cell).map((cell) => ({ col: cell % grid.cols, row: Math.floor(cell / grid.cols) }));
}
function bakeHost(layout, slot) {
  const form = layout.contaminationDraw.forms.filter((form2) => form2.portfolio === "bing")[slot];
  const seed = mix32(layout.seed, `ENM_BING_${String(slot + 1).padStart(2, "0")}`);
  return bakePaintGenome({
    substrate: form.substrate,
    coverage: form.coverage,
    seed,
    continuity: form.continuity,
    sense: form.lexemes.sense,
    rhythm: form.lexemes.rhythm,
    fragmentTypeId: layout.fragmentTypeId,
    veinVariant: resolvePaintVeinVariant(form.substrate, seed),
    geometryVersion: layout.paintGeometryVersion ?? 1
  });
}
function seatCompletePaint(layout, grid, excludeItems = false, protectedRoute = []) {
  const tileAt = (point) => ({ col: Math.floor(point.x / HOST_TILE), row: Math.floor(point.y / HOST_TILE) });
  const spawn = tileAt(layout.spawnPoint);
  const exit = tileAt(layout.extractionPoint.position);
  const fuel = new Set([...layout.kindlingNodes, ...excludeItems ? layout.contaminantNodes : []].map((node) => {
    const cell = tileAt(node.position);
    return `${cell.col},${cell.row}`;
  }));
  const routeClearance = /* @__PURE__ */ new Set();
  const protect = (point) => {
    const cell = tileAt(point);
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) routeClearance.add(`${cell.col + x},${cell.row + y}`);
  };
  for (let i = 0; i < protectedRoute.length; i++) {
    const b = protectedRoute[i], a = protectedRoute[Math.max(0, i - 1)];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (HOST_TILE / 2)));
    for (let step = 0; step <= steps; step++) protect({
      x: a.x + (b.x - a.x) * step / steps,
      y: a.y + (b.y - a.y) * step / steps
    });
  }
  const candidates = [];
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++)
    if (grid.isWalkable(col, row)) candidates.push({ col, row });
  const occupied = /* @__PURE__ */ new Set();
  const paintFloors = layout.contaminationPins.paintFloors.map((pin, slot) => {
    const baked = bakeHost(layout, slot);
    const cells = (field) => collectPaintGenomeFloorTiles(
      field,
      baked.canvasW,
      baked.canvasH,
      HOST_TILE / 2,
      HOST_TILE / 2,
      HOST_TILE
    );
    const support = cells(baked.terrainFootprintField), danger = cells(baked.field);
    const allowed = candidates.filter((seat2) => support.every((offset) => grid.isWalkable(seat2.col + offset.col, seat2.row + offset.row)) && danger.every((offset) => {
      const col = seat2.col + offset.col, row = seat2.row + offset.row;
      return Math.max(Math.abs(col - spawn.col), Math.abs(row - spawn.row)) > 3 && Math.max(Math.abs(col - exit.col), Math.abs(row - exit.row)) > 3 && !fuel.has(`${col},${row}`) && !occupied.has(`${col},${row}`) && !routeClearance.has(`${col},${row}`);
    }));
    allowed.sort((a, b) => {
      const distance = (p) => (p.col - pin.floorCol) ** 2 + (p.row - pin.floorRow) ** 2;
      return distance(a) - distance(b) || a.row - b.row || a.col - b.col;
    });
    const seat = allowed[0];
    if (!seat) throw new Error(`No complete terrain footprint for paint Host ${slot + 1}`);
    for (const offset of danger) occupied.add(`${seat.col + offset.col},${seat.row + offset.row}`);
    return { ...pin, floorCol: seat.col, floorRow: seat.row };
  });
  return { ...layout, contaminationPins: { ...layout.contaminationPins, paintFloors } };
}
function admitPaintHosts(layout, hostGrid) {
  const forms = layout.contaminationDraw.forms.filter((form) => form.portfolio === "bing");
  const config = GAME_CONSTANTS.CONTAMINATION;
  for (const [slot, form] of forms.entries()) {
    const pin = layout.contaminationPins.paintFloors[slot];
    const baked = bakeHost(layout, slot);
    if (layout.paintGeometryVersion === 2 && collectPaintGenomeFloorTiles(
      baked.terrainFootprintField,
      baked.canvasW,
      baked.canvasH,
      (pin.floorCol + 0.5) * HOST_TILE,
      (pin.floorRow + 0.5) * HOST_TILE,
      HOST_TILE
    ).some((point) => !hostGrid.isWalkable(point.col, point.row))) throw new Error("Paint Host would be terrain-clipped");
    const floors = collectPaintGenomeFloorTiles(
      baked.field,
      baked.canvasW,
      baked.canvasH,
      (pin.floorCol + 0.5) * HOST_TILE,
      (pin.floorRow + 0.5) * HOST_TILE,
      HOST_TILE
    ).filter((point) => hostGrid.isWalkable(point.col, point.row));
    const stop = resolveStopLoss(form);
    if (stop === "illegal" || floors.length === 0) throw new Error("Paint Host has no legal production surface");
    if (stop.family === "scatter_rejoin" && colonyNucleusSeatsInFloors(
      floors,
      config.COLONY_NUCLEUS_COUNT_MIN,
      config.COLONY_NUCLEUS_COUNT_MAX,
      config.COLONY_NUCLEUS_MIN_TILE_GAP,
      2
    ).length < config.COLONY_NUCLEUS_COUNT_MIN)
      throw new Error("Paint Host lost its production nucleus quota");
  }
}
function physicalAdmission(layout) {
  const grid = new TileGrid(layout.tileMap), total = grid.cols * grid.rows;
  const bodies = layout.enemySpawns.filter(isStaticFloorBody).map((enemy) => ({ x: (enemy.spawn.col + 0.5) * grid.tileSize, y: (enemy.spawn.row + 0.5) * grid.tileSize }));
  const seats = new Uint8Array(total), distances = new Int32Array(total).fill(-1);
  const index = (point) => Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize);
  for (let cell = 0; cell < total; cell++) {
    const point = center2(grid, cell);
    seats[cell] = bodyHasSupport(grid, point, HALF_BODY, HALF_BODY) && !bodies.some((body) => Math.abs(point.x - body.x) < STATIC_CLEARANCE - 1e-3 && Math.abs(point.y - body.y) < STATIC_CLEARANCE - 1e-3) ? 1 : 0;
  }
  const start = index(layout.spawnPoint);
  if (!seats[start]) throw new Error("Production spawn lacks static-body-safe support");
  const queue = [start];
  distances[start] = 0;
  for (let at14 = 0; at14 < queue.length; at14++) {
    const cell = queue[at14], col = cell % grid.cols, row = Math.floor(cell / grid.cols), from = center2(grid, cell);
    for (const [dx, dy] of DIRECTIONS2) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || distances[next] !== -1) continue;
      if (bodyDisplacementFraction(grid, from, HALF_BODY, HALF_BODY, dx * grid.tileSize, dy * grid.tileSize) < 1) continue;
      distances[next] = distances[cell] + 1;
      queue.push(next);
    }
  }
  const targets = [
    layout.extractionPoint.position,
    ...layout.kindlingNodes.map((node) => node.position),
    ...layout.contaminantNodes.map((node) => node.position)
  ];
  for (const target of targets) if (distances[index(target)] < 0)
    throw new Error("Production target lacks a complete body route around permanent enemies");
  for (const enemy of layout.enemySpawns) for (const point of [enemy.spawn, ...enemy.patrol.waypoints]) {
    if (!bodyHasSupport(grid, { x: (point.col + 0.5) * grid.tileSize, y: (point.row + 0.5) * grid.tileSize }, HALF_BODY, HALF_BODY))
      throw new Error(`Enemy ${enemy.id} lacks complete body support`);
  }
  for (const enemy of layout.enemySpawns) for (let i = 1; i < enemy.patrol.waypoints.length; i++) {
    const a = enemy.patrol.waypoints[i - 1], b = enemy.patrol.waypoints[i];
    const from = { x: (a.col + 0.5) * grid.tileSize, y: (a.row + 0.5) * grid.tileSize };
    if (bodyDisplacementFraction(grid, from, HALF_BODY, HALF_BODY, (b.col - a.col) * grid.tileSize, (b.row - a.row) * grid.tileSize) < 1)
      throw new Error(`Enemy ${enemy.id} patrol crosses unsupported terrain`);
  }
  return { reachableBodySeats: queue.length, extractionRoutePx: distances[index(layout.extractionPoint.position)] * grid.tileSize };
}
function admit(sample, space, options, requestedSeed, attempt, rejected) {
  const support = getWorldSupportGrid(sample), host = hostFloorOf(sample), axes = rollFragmentAxes(sample.seed);
  const hostGrid = new TileGrid(host.tileMap);
  const tileMap = tileMapOf(support.walkable, support.cols, support.rows, support.tileSize);
  let semantic;
  const placement = deployRiftContents(sample.seed, ruinsOf(sample.seed, options.contentFragmentTypeId, host.tileMap, host.floor), {
    recipeId: `world-space:${space.id}`,
    ...axes,
    routePolicy: "open-world",
    // Void is an occluder in the accepted terrain. This mask changes only route
    // exposure measurements; no WALL is invented for rendering, physics or pins.
    routeObstructions: Uint8Array.from(host.floor, (floor) => floor ? 0 : 1),
    ...options.generationVersion === 2 ? {
      placementTag: `conditions:${options.conditions.streams.placement}`,
      lexiconSeed: options.conditions.streams.encounters,
      postprocess: (candidate) => {
        try {
          const result = applySemanticDeployment(candidate, options.conditions, {
            tileMap,
            coordinateOffset: { x: support.tileSize / 2, y: support.tileSize / 2 }
          });
          const painted = seatCompletePaint(
            {
              ...result.layout,
              fragmentTypeId: `world-study:${sample.profile.id}`,
              paintGeometryVersion: 2
            },
            hostGrid,
            true,
            result.diagnostics.lowExposureRoute.points
          );
          admitPaintHosts(painted, hostGrid);
          semantic = { ...result, layout: { ...result.layout, contaminationPins: painted.contaminationPins } };
          return semantic.layout;
        } catch (reason) {
          return reason instanceof Error ? reason.message : String(reason);
        }
      }
    } : {}
  });
  if (typeof placement === "string") throw new Error(placement);
  const deployed = placement;
  const fragmentTypeId = `world-study:${sample.profile.id}`;
  const scale = HOST_TILE / support.tileSize;
  const fineCell = (point) => ({ col: point.col * scale + Math.floor(scale / 2), row: point.row * scale + Math.floor(scale / 2) });
  const finePoint = (point) => ({ x: point.x + support.tileSize / 2, y: point.y + support.tileSize / 2 });
  let layout = {
    ...deployed,
    fragmentTypeId,
    tileMap,
    walkableMask: new TileGrid(tileMap),
    ...(options.paintGeometryVersion ?? 2) === 2 ? { paintGeometryVersion: 2 } : {},
    ruins: { ...ruinsOf(sample.seed, fragmentTypeId, tileMap, support.walkable.slice()), ...axes },
    spawnPoint: finePoint(deployed.spawnPoint),
    extractionPoint: { ...deployed.extractionPoint, position: finePoint(deployed.extractionPoint.position) },
    kindlingNodes: deployed.kindlingNodes.map((node) => ({ ...node, position: finePoint(node.position) })),
    contaminantNodes: deployed.contaminantNodes.map((node) => ({ ...node, position: finePoint(node.position) })),
    enemySpawns: deployed.enemySpawns.map((enemy) => ({
      ...enemy,
      spawn: fineCell(enemy.spawn),
      patrol: { ...enemy.patrol, waypoints: patrolRoute(hostGrid, enemy.patrol.waypoints).map(fineCell) }
    })),
    landmarks: deployed.landmarks.map((landmark) => ({ ...landmark, ...fineCell(landmark) }))
  };
  if (layout.paintGeometryVersion === 2 && options.generationVersion !== 2)
    layout = seatCompletePaint(layout, hostGrid);
  const expectedPaint = rollPaintHostCount(sample.seed, axes.contaminationAge);
  if (layout.kindlingNodes.length !== 8 || layout.contaminantNodes.length !== 3 || layout.enemySpawns.length < 3 || layout.enemySpawns.length > 4 || layout.contaminationPins.paintFloors.length !== expectedPaint || layout.contaminationDraw.forms.filter((form) => form.portfolio === "bing").length !== expectedPaint || layout.contaminationDraw.forms.filter((form) => form.lexemes.sense === "sense_hear").length !== 1)
    throw new Error("Production content quota or hearing budget was lost");
  const access = physicalAdmission(layout);
  admitPaintHosts(layout, hostGrid);
  if (options.generationVersion === 2) sample = attachWorldScenery({
    ...sample,
    materialSeed: options.conditions.streams.material
  }, options.conditions, layout.landmarks, layout.tileMap.tileSize);
  let hash = 2166136261;
  for (const floor of support.walkable) hash = Math.imul(hash ^ floor, 16777619);
  for (const floor of host.floor) hash = Math.imul(hash ^ floor, 16777619);
  const definition = JSON.stringify({
    profile: sample.profile,
    space,
    contentFragmentTypeId: options.contentFragmentTypeId,
    seed: sample.seed,
    ...axes,
    spawnPoint: layout.spawnPoint,
    extraction: layout.extractionPoint,
    kindling: layout.kindlingNodes,
    contaminants: layout.contaminantNodes,
    enemies: layout.enemySpawns,
    landmarks: layout.landmarks,
    pins: layout.contaminationPins,
    draw: layout.contaminationDraw,
    ...options.generationVersion === 2 ? { conditions: options.conditions } : {}
  });
  for (let i = 0; i < definition.length; i++) hash = Math.imul(hash ^ definition.charCodeAt(i), 16777619);
  return { sample, layout, hostTileMap: host.tileMap, metadata: {
    world: sample.profile.id,
    space: space.id,
    contentFragmentTypeId: options.contentFragmentTypeId,
    requestedSeed,
    effectiveSeed: sample.seed,
    attempt,
    rejected: [...rejected],
    signature: (hash >>> 0).toString(16).padStart(8, "0"),
    bodySize: HALF_BODY * 2,
    supportTileSize: support.tileSize,
    hostTileSize: HOST_TILE,
    ...access,
    ...options.generationVersion === 2 ? {
      conditions: options.conditions,
      semantic: semantic.diagnostics,
      fallbackUsed: attempt >= MAX_ATTEMPTS
    } : {}
  } };
}
function createWorldProductionMap(world, spaceInput, requestedSeed, options) {
  if (!Number.isSafeInteger(requestedSeed) || requestedSeed < 0 || requestedSeed > 4294967295)
    throw new Error("Production world seed must be an unsigned 32-bit integer");
  if (options.paintGeometryVersion !== void 0 && options.paintGeometryVersion !== 1 && options.paintGeometryVersion !== 2)
    throw new Error("Unknown paint geometry contract");
  if (options.generationVersion !== void 0 && options.generationVersion !== 1 && options.generationVersion !== 2)
    throw new Error("Unknown world generation contract");
  const conditional = options.generationVersion === 2;
  if (conditional ? !validWorldConditions(options.conditions) || options.conditions.seed !== requestedSeed || options.paintGeometryVersion === 1 : options.conditions !== void 0 || options.fallbackSeeds !== void 0)
    throw new Error("World conditions do not match the generation contract");
  if (options.fallbackSeeds !== void 0 && !validWorldFallbackSeeds(options.fallbackSeeds))
    throw new Error("Invalid frozen world fallback candidates");
  if (conditional && options.fallbackSeeds !== void 0 && JSON.stringify(options.fallbackSeeds) !== JSON.stringify(options.conditions.fallbackSeeds))
    throw new Error("Fallback candidates must match the frozen world conditions");
  let profile = typeof world === "string" ? worldProfileById(world) : world;
  let space = typeof spaceInput === "string" ? SPACE_PROFILES.find((value) => value.id === spaceInput) : spaceInput;
  if (!space) throw new Error(`Unknown space ${String(spaceInput)}`);
  validateSpaceProfile(space);
  if (conditional) ({ profile, space } = applyWorldConditions(profile, space, options.conditions));
  if (!CONTAMINATION_DIALECT_DATA[options.contentFragmentTypeId])
    throw new Error(`Unregistered production content dialect: ${options.contentFragmentTypeId}`);
  const rejected = [];
  const baseSeed = conditional ? options.conditions.streams.layout : requestedSeed;
  const candidates = Array.from({ length: MAX_ATTEMPTS }, (_, attempt) => baseSeed + attempt * RETRY_STRIDE >>> 0);
  for (const seed of conditional ? options.conditions.fallbackSeeds : []) if (!candidates.includes(seed)) candidates.push(seed);
  for (let attempt = 0; attempt < candidates.length; attempt++) {
    const seed = candidates[attempt];
    try {
      return admit(generateWorldSample(
        profile,
        "loops",
        seed,
        space,
        conditional ? worldOrganizationOf(options.conditions) : void 0
      ), space, options, requestedSeed, attempt, rejected);
    } catch (reason) {
      rejected.push({ seed, reason: reason instanceof Error ? reason.message : String(reason) });
    }
  }
  throw new Error(`Production world admission failed after ${candidates.length} bounded candidates: ${JSON.stringify(rejected)}`);
}
export {
  createWorldProductionMap,
  generateRiftLayout,
  validWorldProductionRecipe
};
