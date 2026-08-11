/**
 * i18n type utilities.
 * Provides type-safe key paths for the translation function.
 */

/**
 * Locale data structure definition.
 * All locale files must conform to this shape.
 * Add new keys here first, then populate in each locale file.
 */
export interface LocaleSchema {
  common: {
    confirm: string;
    cancel: string;
    back: string;
  };
  menu: {
    title: string;
    subtitle: string;
    newGame: string;
    continue: string;
    language: string;
  };
  hud: {
    chaos: {
      label: string;
    };
    health: {
      label: string;
    };
    kindling: {
      label: string;
    };
  };
  rift: {
    exitHint: string;
    chaosWarning: string;
    returnToMenu: string;
  };
  purify: {
    title: string;
    allocate: {
      title: string;
      confirm: string;
      remaining: string;
    };
    module: {
      core: string;
      storage: string;
      healthy: string;
      damaged: string;
      critical: string;
    };
    enterRift: string;
  };
  impact: {
    warning: string;
    intensity: string;
    result: {
      safe: string;
      damaged: string;
      destroyed: string;
    };
  };
  item: {
    kindling: {
      name: string;
      desc: string;
    };
  };
  enemy: {
    patrolInfiltrate: {
      name: string;
      desc: string;
    };
  };
}

/**
 * Recursively generates dot-notation key paths from a nested object type.
 * e.g., { hud: { chaos: { label: string } } } => "hud.chaos.label"
 */
type FlattenKeys<T, Prefix extends string = ''> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: FlattenKeys<
        T[K],
        Prefix extends '' ? K : `${Prefix}.${K}`
      >;
    }[keyof T & string];

/** All valid translation keys (dot-notation paths) */
export type TranslationKey = FlattenKeys<LocaleSchema>;

/** Supported locale codes */
export type Locale = 'zh-CN' | 'en';
