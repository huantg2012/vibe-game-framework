/**
 * Game configuration constants.
 * All balance values and tuning parameters live here.
 * Single source of truth for numbers that affect gameplay.
 */

export const GAME_CONSTANTS = {
  /** Tile size in pixels */
  TILE_SIZE: 32,

  /** Player */
  PLAYER: {
    SPEED: 160,           // pixels per second
    MAX_HEALTH: 100,
    INVENTORY_SLOTS: 4,
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

  /** Visibility / FOV */
  VISIBILITY: {
    BASE_RADIUS: 200,     // pixels
    RAY_COUNT: 60,        // number of rays cast
    EDGE_SOFTNESS: 20,    // pixels of soft falloff at edge
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
