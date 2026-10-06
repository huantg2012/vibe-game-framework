/** Compatibility entry point; the running save schema has one definition. */
import { GAME_CONSTANTS } from '@/config/constants';
export type { SaveDataV2 as SaveData, ExpeditionSaveData } from './game-types';
export const SAVE_VERSION = GAME_CONSTANTS.SAVE.VERSION;
export const SAVE_KEY = GAME_CONSTANTS.SAVE.KEY;
