/**
 * 地面青绿占比。I6-E 起由 check:contam-floor-contrast 吸收；本文件只做同口径包装。
 */
import { runFloorContrastCli } from './check-contam-floor-contrast.ts';

process.exit(runFloorContrastCli(['--teal-only']));
