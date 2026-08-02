/**
 * Balance invariants - the relations between constants that the design depends on.
 *
 * These are not tuning preferences. Each one is a relation whose violation silently
 * invalidates what a slice is trying to verify: if the enemy can see further than the
 * player, "observe then decide" stops existing and no amount of playtesting will reveal
 * why the game feels unfair. Numbers may move; these relations may not.
 *
 * Two specs contribute: I1-I6 from docs/specs/system-enemy-ai.md, K1-K6 from
 * docs/specs/system-combat.md. Two of the combat six are not machine-checkable and are
 * left to review instead of being faked here: K4 (one encounter must cost more chaos than
 * waiting out a patrol) depends on how long a detour actually takes, and K6 (combat adds
 * no new write path to the chaos meter) is a statement about code structure - combat only
 * emits events and never imports the chaos system.
 *
 * Checked once at boot in dev builds, which is the only moment cheap enough to be free
 * and early enough to be useful.
 */

import { GAME_CONSTANTS } from '@/config/constants';

export interface InvariantViolation {
  /** Invariant id from a spec table (I1..I6, K1..K6), or S* for a supplementary check. */
  readonly id: string;
  readonly relation: string;
  readonly actual: string;
  readonly why: string;
}

/** Ratio below which `A << B` is considered satisfied. */
const MUCH_LESS_RATIO = 0.5;

export function checkBalanceInvariants(): InvariantViolation[] {
  const ai = GAME_CONSTANTS.AI;
  const player = GAME_CONSTANTS.PLAYER;
  const vision = GAME_CONSTANTS.VISIBILITY;
  const combat = GAME_CONSTANTS.COMBAT;

  const violations: InvariantViolation[] = [];
  const require = (
    ok: boolean,
    id: string,
    relation: string,
    actual: string,
    why: string
  ): void => {
    if (!ok) violations.push({ id, relation, actual, why });
  };

  require(
    ai.SIGHT_RANGE < vision.RADIUS_FORWARD,
    'I1',
    'AI.SIGHT_RANGE < VISIBILITY.RADIUS_FORWARD',
    `${ai.SIGHT_RANGE} vs ${vision.RADIUS_FORWARD}`,
    'the player has to see the enemy first, or every encounter starts on the back foot'
  );
  require(
    ai.CHASE_SIGHT_RANGE < vision.RADIUS_FORWARD,
    'I2',
    'AI.CHASE_SIGHT_RANGE < VISIBILITY.RADIUS_FORWARD',
    `${ai.CHASE_SIGHT_RANGE} vs ${vision.RADIUS_FORWARD}`,
    'the locked-on sight bonus must not cross the boundary I1 protects'
  );
  require(
    ai.CHASE_SPEED < player.SPEED,
    'I3',
    'AI.CHASE_SPEED < PLAYER.SPEED',
    `${ai.CHASE_SPEED} vs ${player.SPEED}`,
    'retreat must always remain an option: a chase is pressure, not a death sentence'
  );
  require(
    ai.PATROL_SPEED <= player.SPEED * MUCH_LESS_RATIO,
    'I4',
    `AI.PATROL_SPEED << PLAYER.SPEED (<= ${MUCH_LESS_RATIO} x)`,
    `${ai.PATROL_SPEED} vs ${player.SPEED}`,
    'going around needs a wide enough time window to be worth choosing'
  );
  require(
    ai.HEARING_RANGE < ai.SIGHT_RANGE,
    'I5',
    'AI.HEARING_RANGE < AI.SIGHT_RANGE',
    `${ai.HEARING_RANGE} vs ${ai.SIGHT_RANGE}`,
    'sight is the primary sense; louder hearing would make hiding outside the cone pointless'
  );
  require(
    ai.TURN_RATE < player.FACING_TURN_RATE,
    'I6',
    'AI.TURN_RATE < PLAYER.FACING_TURN_RATE',
    `${ai.TURN_RATE} vs ${player.FACING_TURN_RATE}`,
    'getting behind it has to be an executable move rather than a matter of luck'
  );

  // --- combat (docs/specs/system-combat.md, "平衡不变量") ---

  require(
    combat.ENEMY_MAX_HEALTH % combat.PLAYER_DAMAGE === 0,
    'K1',
    'COMBAT.ENEMY_MAX_HEALTH is a whole multiple of COMBAT.PLAYER_DAMAGE',
    `${combat.ENEMY_MAX_HEALTH} vs ${combat.PLAYER_DAMAGE}`,
    'the kill has to cost a fixed number of swings; "almost died" is randomness wearing a ' +
      'costume, and it destroys the arithmetic the player is supposed to do before fighting'
  );
  require(
    ai.STANDOFF_DISTANCE < combat.ENEMY_ATTACK_RANGE &&
      combat.ENEMY_ATTACK_RANGE < combat.ATTACK_RANGE,
    'K2',
    'AI.STANDOFF_DISTANCE < COMBAT.ENEMY_ATTACK_RANGE < COMBAT.ATTACK_RANGE',
    `${ai.STANDOFF_DISTANCE} vs ${combat.ENEMY_ATTACK_RANGE} vs ${combat.ATTACK_RANGE}`,
    'an enemy that stops outside its own reach can never land a hit, and a player who ' +
      'cannot reach further than it turns every fight into a flat exchange of health'
  );
  require(
    (combat.ENEMY_ATTACK_WINDUP_MS / 1000) * player.SPEED >
      combat.ENEMY_ATTACK_RANGE - ai.STANDOFF_DISTANCE,
    'K3',
    'ENEMY_ATTACK_WINDUP_MS travel > ENEMY_ATTACK_RANGE - AI.STANDOFF_DISTANCE',
    `${((combat.ENEMY_ATTACK_WINDUP_MS / 1000) * player.SPEED).toFixed(0)}px vs ` +
      `${combat.ENEMY_ATTACK_RANGE - ai.STANDOFF_DISTANCE}px`,
    'the telegraph must be long enough to walk out of: this is the physical guarantee ' +
      'behind "you can avoid it", and without it fear becomes randomness'
  );
  require(
    player.MAX_HEALTH / combat.ENEMY_DAMAGE_BASE >= 6,
    'K5',
    'PLAYER.MAX_HEALTH / COMBAT.ENEMY_DAMAGE_BASE >= 6',
    `${(player.MAX_HEALTH / combat.ENEMY_DAMAGE_BASE).toFixed(2)} hits`,
    'one misjudgement must not be fatal, or the player abandons fighting entirely and ' +
      '"combat is an option" stops being true'
  );

  // Supplementary: the derived value in the tuning table, which is easy to edit apart
  // from the three phases it is meant to be the sum of.
  require(
    combat.ATTACK_SLOW_MS ===
      combat.ATTACK_WINDUP_MS + combat.ATTACK_ACTIVE_MS + combat.ATTACK_RECOVERY_MS,
    'S1',
    'COMBAT.ATTACK_SLOW_MS = windup + active + recovery',
    `${combat.ATTACK_SLOW_MS} vs ` +
      `${combat.ATTACK_WINDUP_MS + combat.ATTACK_ACTIVE_MS + combat.ATTACK_RECOVERY_MS}`,
    'the self-slow ends when the swing does; a mismatch either frees the player early or ' +
      'leaves them slowed with no swing to blame'
  );

  return violations;
}

/**
 * Dev-build boot assertion. Throws rather than warns: a broken invariant makes every
 * playtest answer the wrong question, so failing loudly costs less than the bad data.
 */
export function assertBalanceInvariants(): void {
  const violations = checkBalanceInvariants();
  if (violations.length === 0) return;

  for (const violation of violations) {
    console.error(
      `[invariants] ${violation.id} broken: ${violation.relation} (${violation.actual})\n` +
        `             ${violation.why}`
    );
  }
  throw new Error(
    `Balance invariants broken: ${violations.map((v) => v.id).join(', ')}. ` +
      'See the "平衡不变量" sections of docs/specs/system-enemy-ai.md (I*) and ' +
      'docs/specs/system-combat.md (K*).'
  );
}
