import gradeCopySource from './copy.csv?raw';
import weaponSource from '../../../../data/weapons.csv?raw';
import qualitySource from '../../../../data/weapon-qualities.csv?raw';
import { mountBackground } from './background';

type Grade = 'low' | 'medium' | 'severe';
type Phase = 'pollution' | 'equipment';
interface GradeCopy {
  grade: Grade;
  name: string;
  risk: string;
  facts: string;
  response: string;
  resources: string;
  narration: string;
}
const grades: readonly Grade[] = ['low', 'medium', 'severe'];
const abortController = new AbortController();
const { signal } = abortController;

// Only the checked, comma-free source columns used by this sample are consumed.
// The production files remain the origin of the weapon identity and durability.
function parseRows(source: string): Record<string, string>[] {
  const [headerLine, ...lines] = source.trim().split(/\r?\n/);
  if (!headerLine) throw new Error('样例文案缺少表头。');
  const headers = headerLine.split(',');
  return lines.map((line) => {
    const values = line.split(',');
    if (values.length !== headers.length) throw new Error('样例文案列数不一致。');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}
function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`样例节点缺失：${selector}`);
  return element;
}
function isGrade(value: string | undefined): value is Grade {
  return value === 'low' || value === 'medium' || value === 'severe';
}
const copy = new Map<Grade, GradeCopy>();
for (const row of parseRows(gradeCopySource)) {
  if (!isGrade(row.grade)) throw new Error('未知污染程度。');
  if (copy.has(row.grade)) throw new Error('污染程度文案重复。');
  copy.set(row.grade, {
    grade: row.grade,
    name: row.name ?? '',
    risk: row.risk ?? '',
    facts: (row.facts ?? '').split('|').join('\n'),
    response: row.response ?? '',
    resources: row.resources ?? '',
    narration: row.narration ?? '',
  });
}
if (copy.size !== grades.length) throw new Error('缺少污染程度文案。');
const weapon = parseRows(weaponSource).find((row) => row.id === 'crowbar_plain');
const quality = parseRows(qualitySource).find((row) => row.id === weapon?.quality_id);
if (!weapon?.name || !quality?.max_uses) throw new Error('未找到普通撬棍的源数据。');
for (const element of document.querySelectorAll<HTMLElement>('[data-weapon-name]')) element.textContent = weapon.name;
for (const element of document.querySelectorAll<HTMLElement>('[data-weapon-durability]')) element.textContent = `${quality.max_uses} / ${quality.max_uses}`;

const viewport = requireElement<HTMLElement>('#sample-viewport');
const stage = requireElement<HTMLElement>('#sample-stage');
const canvas = requireElement<HTMLCanvasElement>('#world-canvas');
const pollutionPane = requireElement<HTMLElement>('#pollution-pane');
const equipmentPane = requireElement<HTMLElement>('#equipment-pane');
const backgroundToggle = requireElement<HTMLButtonElement>('#background-toggle');
const resetButton = requireElement<HTMLButtonElement>('#reset-sample');
const status = requireElement<HTMLElement>('#sample-status');
const risk = requireElement<HTMLElement>('#threat-risk');
const facts = requireElement<HTMLElement>('#threat-facts');
const response = requireElement<HTMLElement>('#threat-response');
const resources = requireElement<HTMLElement>('#threat-resources');
const narration = requireElement<HTMLElement>('#threat-narration');
const gradeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-grade]'));
const previewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-preview-grade]'));
let selectedGrade: Grade = 'low';
let phase: Phase = 'pollution';
let backgroundOnly = false;
let closed = false;
let disposed = false;
let background: Awaited<ReturnType<typeof mountBackground>> | undefined;

// Fit the preview as a single image; never reflow the fixed logical game UI.
function fitStage(width: number): void {
  const scale = Math.min(1, Math.max(0, width) / 960);
  stage.style.transform = `scale(${scale})`;
  viewport.style.height = `${640 * scale}px`;
}
const resizeObserver = new ResizeObserver((entries) => {
  const entry = entries[0];
  if (entry && !disposed) fitStage(entry.contentRect.width);
});
fitStage(viewport.getBoundingClientRect().width);
resizeObserver.observe(viewport);

function render(): void {
  const current = copy.get(selectedGrade);
  if (!current) return;
  stage.dataset.grade = selectedGrade;
  stage.dataset.phase = closed ? 'closed' : phase;
  stage.classList.toggle('is-background-only', backgroundOnly);
  stage.classList.toggle('is-closed', closed);
  pollutionPane.hidden = phase !== 'pollution';
  equipmentPane.hidden = phase !== 'equipment';
  pollutionPane.inert = backgroundOnly || closed;
  equipmentPane.inert = backgroundOnly || closed;
  risk.textContent = current.risk;
  facts.textContent = current.facts;
  response.textContent = current.response;
  resources.textContent = current.resources;
  narration.textContent = current.narration;
  for (const button of gradeButtons) {
    const selected = button.dataset.grade === selectedGrade;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const button of previewButtons) button.setAttribute('aria-pressed', String(button.dataset.previewGrade === selectedGrade));
  for (const element of document.querySelectorAll<HTMLElement>('[data-selected-grade]')) element.textContent = current.name;
  for (const element of document.querySelectorAll<HTMLElement>('[data-selected-risk]')) element.textContent = current.risk;
  backgroundToggle.setAttribute('aria-pressed', String(backgroundOnly));
  backgroundToggle.textContent = backgroundOnly ? '显示文字' : '仅看背景';
  backgroundToggle.disabled = closed;
  resetButton.textContent = closed ? '重新打开' : '复位';
  status.textContent = closed
    ? '样例已收起。点击“重新打开”继续查看。'
    : backgroundOnly
      ? '仅看背景：保留同一阅读暗场。用上方档位按钮或 ↑ ↓ 比较静态构图。'
      : phase === 'equipment'
        ? '行装承接样例：单列物件浏览，Esc 返回选级。“踏入裂隙”只展示位置，不执行出发。'
        : '静态构图与排字样例。点击等级或用 ↑ ↓ 对比，Enter 查看行装承接。';
  background?.setGrade(selectedGrade);
  background?.setPhase(phase);
}
function focusStage(): void { stage.focus({ preventScroll: true }); }
function selectGrade(grade: Grade): void {
  selectedGrade = grade;
  closed = false;
  render();
}
function showEquipment(): void {
  if (closed || backgroundOnly) return;
  phase = 'equipment';
  render();
  focusStage();
}
function back(): void {
  if (closed) return;
  if (backgroundOnly) {
    backgroundOnly = false;
  } else if (phase === 'equipment') {
    phase = 'pollution';
  } else {
    closed = true;
  }
  render();
  focusStage();
}
for (const button of gradeButtons) button.addEventListener('click', () => {
  if (isGrade(button.dataset.grade)) selectGrade(button.dataset.grade);
  focusStage();
}, { signal });
for (const button of previewButtons) button.addEventListener('click', () => {
  phase = 'pollution';
  if (isGrade(button.dataset.previewGrade)) selectGrade(button.dataset.previewGrade);
  focusStage();
}, { signal });
backgroundToggle.addEventListener('click', () => {
  backgroundOnly = !backgroundOnly;
  render();
  focusStage();
}, { signal });
resetButton.addEventListener('click', () => {
  selectedGrade = 'low';
  phase = 'pollution';
  backgroundOnly = false;
  closed = false;
  render();
  focusStage();
}, { signal });
requireElement('#to-equipment').addEventListener('click', showEquipment, { signal });
requireElement('#back-to-pollution').addEventListener('click', back, { signal });
requireElement('#close-prepare').addEventListener('click', back, { signal });
requireElement('#depart-preview').addEventListener('click', () => {
  status.textContent = '这是独立视觉样例，未连接游戏出发流程。按 Esc 可返回选级。';
  focusStage();
}, { signal });
stage.addEventListener('keydown', (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    back();
  } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !closed && phase === 'pollution') {
    event.preventDefault();
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (grades.indexOf(selectedGrade) + delta + grades.length) % grades.length;
    const nextGrade = grades[nextIndex];
    if (nextGrade) selectGrade(nextGrade);
  } else if (event.key === 'Enter' && !event.shiftKey && phase === 'pollution') {
    const targetButton = event.target instanceof Element ? event.target.closest('button') : null;
    if (targetButton && !targetButton.hasAttribute('data-grade')) return;
    event.preventDefault();
    showEquipment();
  } else if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
  }
}, { signal });
function dispose(): void {
  if (disposed) return;
  disposed = true;
  abortController.abort();
  resizeObserver.disconnect();
  background?.dispose();
}
window.addEventListener('pagehide', dispose, { once: true, signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
render();
focusStage();
void mountBackground(canvas).then((mounted) => {
  if (disposed) { mounted.dispose(); return; }
  background = mounted;
  background.setMotion(false);
  render();
}).catch((error: unknown) => {
  if (disposed) return;
  const errorElement = requireElement<HTMLElement>('#load-error');
  errorElement.hidden = false;
  errorElement.textContent = '背景未能载入。请刷新样例；文字仍可查看。';
  console.error('Preparation visual sample background failed:', error);
});
