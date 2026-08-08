/**
 * Game configuration constants.
 * All balance values and tuning parameters live here.
 * Single source of truth for numbers that affect gameplay.
 */

export const GAME_CONSTANTS = {
  /** Tile size in pixels */
  TILE_SIZE: 32,

  /** Camera. Zoom 1.5 on a 960x640 canvas gives a ~640x427 logical viewport = ~20x13 tiles (DEC-009). */
  CAMERA: {
    ZOOM: 1.5,
  },

  /** Player movement (docs/specs/system-movement-vision.md, section M) */
  PLAYER: {
    SPEED: 80,                // px/s base speed = 2.5 tiles/s (tuned down for deliberate stealth feel)
    MAX_HEALTH: 100,
    INVENTORY_SLOTS: 4,
    MOVE_ACCEL_TIME: 0.08,    // s from standstill to full speed
    MOVE_DECEL_TIME: 0.10,    // s from full speed to standstill
    FACING_TURN_RATE: 1080,   // deg/s the vision cone swings toward the input direction
    FACING_QUANT_HYSTERESIS: 5, // deg of dead zone around the 45 degree facing4 boundaries
    BODY_SIZE: 20,            // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 }, // centres the collider inside the 32x32 sprite
    SPEED_MOD_MIN: 0.5,       // floor on the multiplied speed modifier stack
  },

  /** Chaos system (docs/specs/system-chaos-scavenge-extract.md) */
  CHAOS: {
    START_VALUE: 0,
    MAX_VALUE: 100,       // HUD gauge max (value CAN exceed this)
    HARD_CAP: 150,
    BASE_RATE: 0.5,       // points per second (DEC-024: calibrated for 80 px/s travel)
    THRESHOLD_1: 50,
    THRESHOLD_2: 75,
    THRESHOLD_3: 100,
    COMBAT_BONUS: 5,
    DETECTION_BONUS: 3,
    DETECTION_BONUS_COOLDOWN: 10000, // ms per-enemy cooldown on detection chaos
    CHASE_RATE_MULT: 2.0,
    EMIT_STEP: 1.0,       // minimum delta before emitting CHAOS_CHANGED
    MODULATOR_STEP: 1.0,  // minimum delta before calling onModulate callback
  },

  /** Loot / kindling nodes (docs/specs/system-chaos-scavenge-extract.md) */
  LOOT: {
    PICKUP_RADIUS: 16,
    NODE_COUNT: 8,
    VALUE_SAFE: 1,
    VALUE_CONTESTED: 2,
    VALUE_DEEP: 4,
  },

  /** Extraction point (docs/specs/system-chaos-scavenge-extract.md) */
  EXTRACTION: {
    TRIGGER_RADIUS: 48,
    KEY: 'E',
    SETTLE_DELAY_MS: 600,
    RESTART_KEY: 'R',
  },

  /**
   * Visibility / FOV (docs/specs/system-movement-vision.md, section V).
   * Models a forward cone unioned with an ambient ring, with three fixed-width edge
   * bands. The older single-radius + edge-softness model was replaced rather than
   * extended, so the two parameter sets never coexist.
   */
  VISIBILITY: {
    RADIUS_FORWARD: 224,      // px straight ahead (7 tiles); must exceed AI.SIGHT_RANGE
    RADIUS_AMBIENT: 80,       // px all around (2.5 tiles) = the lamp the player carries
    CONE_HALF_ANGLE: 50,      // deg half-angle of the full-range sector
    CONE_FALLOFF_ANGLE: 30,   // deg of transition from forward range down to ambient
    MIN_SOLID_RADIUS: 48,     // px that stay fully lit no matter what
    EDGE_BAND_WIDTH: 32,      // px per gradient band (1 tile, art-direction 4.3)
    BAND_ALPHAS: [1.0, 0.6, 0.2],       // visibility of core / middle / outer band
    ERASE_ALPHAS: [1.0, 0.5, 0.2],      // per-layer erase strength producing those alphas
    RAY_COUNT: 60,            // architecture ceiling
    RAY_SPLIT_FORWARD: 40,    // rays inside the cone sector
    RAY_SPLIT_AMBIENT: 20,    // rays across the remaining angles
    RAY_COUNT_DEGRADED: 40,   // first degradation step
    RAY_SPLIT_FORWARD_DEGRADED: 28,
    RAY_SPLIT_AMBIENT_DEGRADED: 12,
    MIN_RADIUS_SCALE: 0.4,    // hard floor for the chaos radius modulator
    CACHE_POS_EPSILON: 0.5,   // px of movement tolerated before the cache is dropped
    CACHE_ANGLE_EPSILON: 0.5, // deg of rotation tolerated before the cache is dropped
    BUDGET_MS: 2,             // per-frame raycasting budget
    DEGRADE_SAMPLE_FRAMES: 30, // consecutive frames over budget before degrading
    /** Void outside the field of view */
    VOID_COLOR: 0x080a0c,
    VOID_NOISE_ALPHA: 0.04,
    VOID_NOISE_TILE: 64,      // px noise texture size
    VOID_NOISE_SCROLL: 2,     // px/s drift
    /** Warm lamp the player carries - the only warm light inside a rift */
    PLAYER_LAMP_COLOR: 0x8a5c2a,
    PLAYER_LAMP_ALPHA: 0.12,
    /**
     * Flashlight beam: an additive warm pool pushed forward along facing and clipped to
     * the vision cone by the darkness mask. This is what makes the forward cone read as
     * "lit by a flashlight" rather than merely "revealed" (A-G3 / DEC-018 beam gain).
     */
    FLASHLIGHT_COLOR: 0xa8906a,    // pale warm; a saturated brown would wash the cold floor out
    FLASHLIGHT_ALPHA: 0.42,
    FLASHLIGHT_FORWARD_FRAC: 0.34, // push the pool centre this fraction of forward range ahead
    FLASHLIGHT_RADIUS_FRAC: 0.85,  // pool radius as a fraction of forward range
    /** Glow bleeding through the darkness (Slice 1: extraction point only) */
    GLOW_LEAK_ALPHA: 0.25,
    GLOW_LEAK_RADIUS: 48,
    /** Chaos corruption of the vision edge */
    CORRUPTION_COLOR: 0x1aad96,
    CORRUPTION_MAX_MIX: 0.6,   // alpha of the teal band at corruption 1.0
    CORRUPTION_MAX_DEPTH: 0.35, // fraction of the range teal can eat at corruption 1.0
    CORRUPTION_JITTER_PX: 4,
    CORRUPTION_JITTER_HZ: 6,
    /** Full-screen flicker at the highest chaos stage */
    FLICKER_MAX_ALPHA: 0.08,
    FLICKER_PERIOD_MS: 4000,
    /** Purification point overrides (omni mode) */
    PURIFY_RADIUS: 400,
    PURIFY_RAY_COUNT: 36,
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
    // --- movement and body (section "移动与体型") ---
    PATROL_SPEED: 30,         // px/s; slow enough that "wait for it to pass" is a real tactic (I4)
    CHASE_SPEED: 65,          // px/s; below PLAYER.SPEED so retreating always works (I3)
    SUSPICIOUS_SPEED: 22,     // px/s; slower than patrol - "creeping closer"
    ALERT_SPEED: 45,          // px/s; between patrol and chase so searching reads differently
    RETURN_SPEED: 38,         // px/s; slightly above patrol so "walking back" is legible
    TURN_RATE: 360,           // deg/s; a third of the player's, which is what makes flanking work (I6)
    BODY_SIZE: 20,            // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 2, y: 2 }, // centres the collider inside the 24x24 placeholder sprite
    SEPARATION_RADIUS: 24,    // px; soft repulsion instead of enemy-vs-enemy physics
    SEPARATION_WEIGHT: 0.35,  // how strongly separation bends the movement direction
    STANDOFF_DISTANCE: 30,    // px; where a chaser stops. Must stay under COMBAT.ATTACK_RANGE
    STANDOFF_BAND: 4,         // px of tolerance around it (26..34)
    STANDOFF_ADJUST_SPEED: 60, // px/s used to back off when the player crowds it

    // --- perception (section "感知") ---
    SIGHT_RANGE: 180,         // px core cone range; must stay under VISIBILITY.RADIUS_FORWARD (I1)
    SIGHT_HALF_ANGLE_CORE: 55,    // deg -> 110 deg cone
    SIGHT_RANGE_PERIPH: 90,       // px; stops "walk past its flank for free"
    SIGHT_HALF_ANGLE_PERIPH: 90,  // deg -> straight behind stays a true blind spot
    CHASE_SIGHT_RANGE: 210,   // px, 360 deg once locked on; still under 224 (I2)
    DETECT_FILL_TIME: 0.45,   // s of clear sight to go from 0 to certain
    DETECT_DIST_FACTOR_NEAR: 1.6, // detection rate multiplier at point blank
    DETECT_DIST_FACTOR_FAR: 0.5,  // ...and at the edge of sight range
    DETECT_ZONE_FACTOR_PERIPH: 0.45, // peripheral vision fills far slower than the core cone
    SUSPICION_THRESHOLD: 0.35, // detection at which it stops and turns - the player's warning
    REACQUIRE_THRESHOLD: 0.5,  // lower bar to re-lock while already searching
    DETECT_DECAY_RATE: 0.67,   // per s; ~1.5 s to clear after breaking sight
    DETECT_DECAY_ALERT_SCALE: 0.5, // decays half as fast while searching: it is holding a grudge
    HEARING_RANGE: 100,       // px, 360 deg; must stay under SIGHT_RANGE (I5)
    HEARING_WALL_FACTOR: 0.6, // through-wall hearing radius multiplier (-> 60 px)
    HEARING_JITTER: 32,       // px of positional fuzz, so hearing is not a wall-hack locator
    PERCEPTION_TICK_MS: 100,  // 10 Hz perception; one raycast per enemy per tick
    PERCEPTION_TICK_MS_FAR: 200, // 5 Hz beyond ACTIVE_RANGE (rule N8)

    // --- timers (section "计时器") ---
    LOS_GRACE_MS: 400,        // how long a chase survives with no line of sight
    LOST_PLAYER_DURATION: 5000, // ms of ALERT searching
    ALERT_DURATION: 3000,     // ms a SUSPICIOUS enemy stays wary with no new stimulus
    CHASE_ABANDON_RANGE: 320, // px past which an unseen chase is given up
    WAYPOINT_PAUSE_MS: 1200,  // dwell at a patrol waypoint - the player's window to slip past
    SCAN_HOLD_MS: 600,        // dwell on each scan heading
    SEARCH_HOLD_MS: 800,      // dwell at each ALERT search point
    EXTRAPOLATE_SEC: 0.6,     // how far ahead of the last sighting to guess - punishes running straight
    SEARCH_SPREAD: 96,        // px radius of the random third search point
    ALERT_EMIT_COOLDOWN_MS: 1000, // suppression window for repeated same-level ENEMY_ALERT
    SUSPICIOUS_TURN_HOLD_MS: 200, // minimum standstill when turning to look (rule B2, ">= 0.2 s")
    SCAN_SWEEP_ANGLE: 45,     // deg to each side when scanning in place
    SCAN_SWEEP_PERIOD_MS: 1500, // full left-right-left sweep period
    FACING_ARRIVE_EPSILON: 6, // deg within which a turn counts as completed

    // --- pathfinding and performance (section "寻路与性能") ---
    MAX_PATHS_PER_FRAME: 1,   // architecture hard rule
    REPATH_INTERVAL_MS: 500,
    REPATH_INTERVAL_MS_FAR: 1000, // for requests past SIMPLE_PATH_RANGE (rule N5)
    REPATH_MOVE_THRESHOLD: 48, // px of target movement that earns an early chase repath
    SIMPLE_PATH_RANGE: 384,   // px past which a request drops to the lowest priority
    ASTAR_MAX_NODES: 3000,    // expansion ceiling; real cap is the 5ms budget, not node count. Worst cross-map search measured 1050 nodes / 0.31ms, so 3000 stays well under 5ms and leaves RETURN headroom (DEC-022)
    PATH_FAIL_LIMIT: 3,       // consecutive failures before giving up on the goal
    ACTIVE_RANGE: 640,        // px; beyond this the FSM runs at 5 Hz and never asks for a path
    ARRIVE_EPSILON: 8,        // px within which a path point counts as reached
    MAX_ACTIVE_ENEMIES: 8,    // Slice 1 uses 4; more than this means the map data is wrong
    MAX_PATH_POINTS: 64,      // capacity of a per-enemy dynamic path buffer
    DT_CLAMP_MS: 100,         // stops a backgrounded tab from teleporting enemies on return
    /**
     * Stuck watchdog. Rule N4 skips A* whenever the target is in line of sight, but a
     * clear sight line does not prove a 20 px body fits through the diagonal seam it
     * crosses. Instead of pre-emptively restricting N4 to 3 tiles, we detect the
     * symptom (wanting to move but not moving) and fall back to a real path.
     */
    STUCK_REPATH_MS: 400,
    STUCK_PATH_PREFERENCE_MS: 2000, // how long a stuck enemy keeps preferring A* over straight lines
    STUCK_PROGRESS_FRACTION: 0.25,  // actual/desired speed below which we count as stuck

    // --- placeholder presentation (section "占位期表现", art-direction 12) ---
    BODY_COLOR: 0xcc4444,     // "low tier enemy"; encodes tier, never state
    INDICATOR_COLOR: 0x2ae6c8, // contamination teal; state lives here
    SUSPICIOUS_BREATH_HZ_MIN: 1.5, // breathing rate at the suspicion threshold...
    SUSPICIOUS_BREATH_HZ_MAX: 3.0, // ...and at full certainty (rule R3)
    ALERT_BLINK_HZ: 3,        // blinking = searching
    AFTERIMAGE_INTERVAL_MS: 100,
    AFTERIMAGE_LIFETIME_MS: 300,
    AFTERIMAGE_ALPHA: 0.3,
    AFTERIMAGE_SLOTS: 4,      // ring buffer per enemy; lifetime/interval + 1
    /** Rule R5's fallback visualisation. The cone drawing itself is not implemented yet. */
    DEBUG_SHOW_VISION_CONE: false,
  },

  /** Map generation */
  MAP: {
    WIDTH: 80,            // tiles (larger to accommodate multiple fragments)
    HEIGHT: 80,           // tiles
    /** Voronoi partitioning */
    FRAGMENT_COUNT_MIN: 4,
    FRAGMENT_COUNT_MAX: 6,
    FRAGMENT_MIN_AREA: 150,   // minimum tiles per fragment
    /** Cellular automata */
    CA_ITERATIONS: 5,         // smoothing passes
    CA_WALL_THRESHOLD: 4,     // cells with >= N wall neighbors become wall
    CA_INITIAL_FILL: 0.45,    // initial random fill ratio (lower = more open)
    /** Fracture connections between fragments */
    FRACTURE_WIDTH: 2,        // tiles (narrow passage width)
    FRACTURE_MAX_PER_EDGE: 2, // max connections between two adjacent fragments
  },

  /** Purification point (docs/specs/system-purification-impact.md) */
  PURIFICATION: {
    /** Spatial layout */
    MAP_COLS: 14,              // tiles
    MAP_ROWS: 12,             // tiles
    INTERACTION_RADIUS: 32,    // pixels for module/rift-entrance interaction
    /** Module state */
    MODULE_INITIAL_HP: 70,
    MODULE_MAX_HP: 100,
    REPAIR_PER_KINDLING: 4,    // 1 kindling = this many hp (tuned for scarcity)
    /** Impact system */
    BASE_IMPACT_DAMAGE: 30,
    INTENSITY_STEP: 0.15,      // impactIntensity grows by this each cycle
    MAX_INTENSITY: 2.5,
    THREAT_FOCUS_RATIO: 0.65,  // primary target gets this fraction of total damage
    FORECAST_ACCURACY: 0.80,   // particle prediction accuracy
    /** Module effects */
    MAX_BARRIER_REDUCTION: 0.30, // chaosRate reduction at full hp
    MAX_STORAGE_BONUS: 0.50,     // kindling value bonus at full hp
    /** Boundary atmosphere */
    ATMOSPHERE: {
      PARTICLE_COUNT: 25,          // active boundary particles
      PARTICLE_ALPHA_MIN: 0.03,
      PARTICLE_ALPHA_MAX: 0.12,
      PARTICLE_SPEED: 8,           // px/s slow inward drift
      APPARITION_INTERVAL_MIN: 8000,  // ms
      APPARITION_INTERVAL_MAX: 15000,
      APPARITION_DURATION: 3000,      // ms (0.5s fade in + 2s hold + 0.5s fade out)
      APPARITION_MAX_SIMULTANEOUS: 2,
    },
    /** Scene transition timing */
    IMPACT_RESULT_DISPLAY_MS: 2000,
    SCENE_TRANSITION_DELAY_MS: 600,
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
    ATTACK_COOLDOWN: 500,       // ms, counted from the input instant, parallel to the phases
    ATTACK_RANGE: 40,           // px centre-to-centre; must exceed ENEMY_ATTACK_RANGE (K2)
    ATTACK_HALF_ANGLE: 60,      // deg -> a 120 deg forward sector
    ATTACK_WINDUP_MS: 100,      // the player's side of the commitment
    ATTACK_ACTIVE_MS: 50,       // ~3 frames; exists to tolerate frame jitter, not to widen the hit
    ATTACK_RECOVERY_MS: 70,
    ATTACK_SLOW_MS: 220,        // derived: windup + active + recovery (asserted, not free)
    ATTACK_SELF_SLOW: 0.35,     // move speed while swinging - the "cost" that lands on feel
    ATTACK_MIN_ANGLE_BYPASS: 16, // px within which the angle test is meaningless and skipped
    /** Key name in `Phaser.Input.Keyboard.KeyCodes`. Read by RiftScene, which owns input. */
    ATTACK_KEY: 'SPACE',

    // --- infiltrator (section "敌人（渗透体）") ---
    ENEMY_MAX_HEALTH: 75,       // = 3 x PLAYER_DAMAGE exactly (K1, DEC-012)
    ENEMY_DAMAGE_BASE: 15,
    ENEMY_ATTACK_RANGE: 38,     // px; between AI.STANDOFF_DISTANCE and ATTACK_RANGE (K2)
    ENEMY_ATTACK_HALF_ANGLE: 60, // deg; symmetric with the player's
    ENEMY_ATTACK_WINDUP_MS: 350, // the player's dodge window - the whole of "controllable" (K3)
    ENEMY_ATTACK_COOLDOWN_MS: 1200,
    ENEMY_FIRST_ATTACK_DELAY_MS: 300, // "caught up with you" and "hit you" stay two events
    ENEMY_ATTACK_TOKENS: 2,     // enemies allowed in windup at once; caps unavoidable damage
    ENEMY_HIT_FLASH_MS: 80,
    ENEMY_DEATH_FX_MS: 180,     // presentation only; the enemy is gone from logic at 0 ms

    // --- player health and hits (section "玩家生命值与受击") ---
    PLAYER_IFRAME_MS: 400,      // stops two enemies resolving on one frame for 30 damage
    PLAYER_HIT_FLASH_MS: 100,

    // --- noise: the exposure half of the price (section "噪声") ---
    NOISE_SWING_RADIUS: 96,     // px (3 tiles), 'suspicious' - a whiff is heard, not billed
    NOISE_HIT_RADIUS: 160,      // px (5 tiles), 'alert' - the main reason a fight is loud
    NOISE_KILL_RADIUS: 192,     // px (6 tiles), 'alert'

    /**
     * Placeholder presentation (spec V2). White is on loan here: it currently means
     * "player / extraction point" in art-direction 12, and using thin white lines and
     * flashes for combat actions is still awaiting art sign-off (spec escalate 1 and 2).
     * Treat these as stand-ins, not as the visual language.
     */
    FX_COLOR: 0xffffff,
    ATTACK_FAN_FX_MS: 60,       // how long the swing outline stays up (spec V2)
    PLAYER_FLASH_PAD: 6,        // px the hit flash overshoots the body; see report on white-on-white
    FX_POOL_SIZE: 12,           // preallocated flash/death sprites: 8 enemies + headroom
  },

  /** Audio */
  AUDIO: {
    MAX_SIMULTANEOUS_SFX: 8,
    DEFAULT_SFX_VOLUME: 0.7,
    DEFAULT_BGM_VOLUME: 0.4,
    DEFAULT_AMBIENT_VOLUME: 0.5,
  },
} as const;
