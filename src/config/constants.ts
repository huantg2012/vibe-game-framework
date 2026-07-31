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
    SPEED: 160,               // px/s base speed = 5 tiles/s
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

  /** Chaos system */
  CHAOS: {
    MAX_VALUE: 100,
    BASE_RATE: 1.5,       // points per second (base growth)
    COMBAT_BONUS: 5,      // extra points when entering combat
    DETECTION_BONUS: 3,   // extra points when detected by enemy
    THRESHOLD_1: 50,      // first penalty threshold
    THRESHOLD_2: 75,      // second penalty threshold
    /** Penalties at each threshold */
    PENALTIES: {
      THRESHOLD_1: {
        SPEED_MULTIPLIER: 0.85,    // 15% speed reduction
        VISION_MULTIPLIER: 0.9,    // 10% vision reduction
      },
      THRESHOLD_2: {
        SPEED_MULTIPLIER: 0.7,     // 30% speed reduction
        VISION_MULTIPLIER: 0.75,   // 25% vision reduction
      },
    },
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
    GLOW_LEAK_ALPHA: 0.15,
    GLOW_LEAK_RADIUS: 12,
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

  /** AI */
  AI: {
    PATROL_SPEED: 60,         // pixels per second
    CHASE_SPEED: 130,         // pixels per second
    SIGHT_RANGE: 180,         // pixels
    SIGHT_ANGLE: 90,          // degrees (cone half-angle)
    HEARING_RANGE: 100,       // pixels
    ALERT_DURATION: 3000,     // ms before returning to patrol
    LOST_PLAYER_DURATION: 5000, // ms of searching after losing sight
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

  /** Purification point */
  PURIFICATION: {
    INITIAL_KINDLING: 10,
    BASE_IMPACT_INTENSITY: 20,
    IMPACT_GROWTH_RATE: 1.3,   // multiplier per cycle
    MODULE_MAX_HEALTH: 100,
    /** Spatial layout */
    MAP_WIDTH: 12,             // tiles
    MAP_HEIGHT: 10,            // tiles
    INTERACTION_RADIUS: 48,    // pixels (~1.5 tiles) for module overlap trigger
    /** Boundary atmosphere */
    ATMOSPHERE: {
      PARTICLE_COUNT: 40,          // max particles in boundary darkness
      PARTICLE_ALPHA_MIN: 0.03,    // barely visible
      PARTICLE_ALPHA_MAX: 0.12,    // subtle but noticeable
      PARTICLE_SPEED: 8,           // pixels per second (very slow drift)
      APPARITION_INTERVAL_MIN: 8000,  // ms between blurry shape appearances
      APPARITION_INTERVAL_MAX: 15000,
      APPARITION_DURATION: 3000,      // ms a shape stays visible
      APPARITION_MAX_SIMULTANEOUS: 2,
      /** Intensity multiplier when impact is imminent (scales alpha/frequency) */
      IMPACT_INTENSITY_SCALE: 1.5,
    },
  },

  /** Combat */
  COMBAT: {
    PLAYER_DAMAGE: 25,
    ATTACK_COOLDOWN: 500,       // ms
    ATTACK_RANGE: 40,           // pixels
    ENEMY_DAMAGE_BASE: 15,
  },

  /** Audio */
  AUDIO: {
    MAX_SIMULTANEOUS_SFX: 8,
    DEFAULT_SFX_VOLUME: 0.7,
    DEFAULT_BGM_VOLUME: 0.4,
    DEFAULT_AMBIENT_VOLUME: 0.5,
  },
} as const;
