// Generated from data/rift-pollution-grades.csv; contract-only, no graded departures enabled.
import type { PollutionGradeDefinition } from '../generation/world-study/pollution-grade';
export const POLLUTION_GRADE_SOURCE_HASH = 'c19b43be9f078ce4362b3ad74642cf79bdab255cc35aa11793c5046719c05b18';
export const POLLUTION_GRADE_DEFINITIONS: readonly PollutionGradeDefinition[] = [
  {
    "id": "low",
    "version": 1,
    "label": "低污染",
    "status": "contract-only",
    "intent": "原有材料与空间关系仍可辨；保持陌生感并允许观察与低损耗搜取"
  },
  {
    "id": "medium",
    "version": 1,
    "label": "中污染",
    "status": "contract-only",
    "intent": "关联侵入影响视线与绕行；根据目标和余量选择搜取与撤退"
  },
  {
    "id": "severe",
    "version": 1,
    "label": "重度污染",
    "status": "contract-only",
    "intent": "改写接管尺度与节律；充分准备后主动承担近崩溃环境的高风险高回报出行"
  }
];
