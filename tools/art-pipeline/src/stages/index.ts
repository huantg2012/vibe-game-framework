import { colorGrade } from './colorGrade';
import { quantize } from './quantize';
import { bgRemove } from './bgRemove';
import { downscale } from './downscale';
import { cropPad } from './cropPad';
import type { Stage } from '../types';
export const STAGES: Record<string, Stage> = { bgRemove, colorGrade, downscale, quantize, cropPad };
