/**
 * Internationalization module.
 * Provides t() function for translating text across the game.
 *
 * Usage:
 *   import { t, setLocale } from '@/i18n';
 *   const label = t('hud.chaos.label');           // "混乱值"
 *   const msg = t('purify.allocate.remaining', { amount: 5 }); // "剩余：5"
 */

import { zhCN } from './locales/zh-CN';
import { en } from './locales/en';
import type { Locale, LocaleSchema, TranslationKey } from './types';

export type { TranslationKey, Locale };

const LOCALE_STORAGE_KEY = 'coh_locale';

const locales: Record<Locale, LocaleSchema> = {
  'zh-CN': zhCN,
  'en': en,
};

let currentLocale: Locale = detectLocale();
let currentData: LocaleSchema = locales[currentLocale];

/**
 * Detect preferred locale from localStorage or browser settings.
 */
function detectLocale(): Locale {
  // Check localStorage first
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && stored in locales) {
    return stored as Locale;
  }

  // Check browser language
  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }
  if (browserLang.startsWith('en')) {
    return 'en';
  }

  // Default
  return 'zh-CN';
}

/**
 * Resolve a dot-notation key path to its value in the locale data.
 */
function resolve(key: string): string {
  const parts = key.split('.');
  let current: unknown = currentData;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return key; // Key not found, return raw key as fallback
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current === 'string') {
    return current;
  }

  // Key points to an object, not a leaf string
  return key;
}

/**
 * Translate a key, optionally interpolating parameters.
 *
 * @param key - Dot-notation key path (e.g., 'hud.chaos.label')
 * @param params - Optional interpolation values (e.g., { amount: 5 })
 * @returns Translated string
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let result = resolve(key);

  // Interpolate {placeholder} patterns
  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      result = result.replace(`{${paramKey}}`, String(value));
    }
  }

  return result;
}

/**
 * Set the active locale and persist the choice.
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  currentData = locales[locale];
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

/**
 * Get the current active locale code.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Get all available locale codes.
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(locales) as Locale[];
}
