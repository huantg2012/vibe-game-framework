/** Art selection only: no game state, storage writes, filters or repainting. */
type Candidate = '0' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
type View = 'full' | 'actor' | 'core' | 'exterior' | 'section' | 'native';
const TITLE_ROOT = '/docs/art/demos/opening-joint/assets/title/';
const GAME_URL = '/docs/art/demos/opening-joint/index.html';
const HAVEN_URL = '/docs/qa/artifacts/opening-joint/haven.png';
const candidates: Record<Candidate, { name: string; description: string; url: string }> = {
  '0': { name: '原版', description: '保留已认可的坐姿与取景，作为画法对照。', url: `${TITLE_ROOT}master.png` },
  a: { name: 'A · 整簇像素', description: '像素簇更粗，但远景更亮。', url: `${TITLE_ROOT}candidates/a.png` },
  b: { name: 'B · 克制明暗', description: '明暗修饰较保守，与原版差异有限。', url: `${TITLE_ROOT}candidates/b.png` },
  c: { name: 'C · 手绘硬边', description: '保留原貌最稳，材质噪点有所减少。', url: `${TITLE_ROOT}candidates/c.png` },
  d: { name: 'D · 暗面修饰', description: '暗面修饰较保守，刻痕未形成鲜明画法。', url: `${TITLE_ROOT}candidates/d.png` },
  e: { name: 'E · 粗像素概括', description: '大像素色簇更明确，高频噪点更少；并非精确低分辨率网格。', url: `${TITLE_ROOT}candidates/e.png` },
  f: { name: 'F · 手绘块面', description: '块面概括最明显；核心偏晶体、少量管口增生，选中后修整。', url: `${TITLE_ROOT}candidates/f.png` },
};
// All candidates use the same image-space crop. Switching never follows an
// object or hides a compositional drift. Coordinates are in the 960 × 640 frame.
const crops: Record<Exclude<View, 'full' | 'native'>, [number, number, number]> = {
  actor: [550, 302, 220], core: [720, 186, 240],
  exterior: [236, 80, 354], section: [520, 408, 384],
};
const art = document.querySelector<HTMLImageElement>('#art')!;
const frame = document.querySelector<HTMLDivElement>('#frame')!;
const stage = document.querySelector<HTMLDivElement>('#stage')!;
const titleCopy = document.querySelector<HTMLDivElement>('#title-copy')!;
const description = document.querySelector<HTMLParagraphElement>('#description')!;
const imageStatus = document.querySelector<HTMLParagraphElement>('#image-status')!;
const frameNote = document.querySelector<HTMLSpanElement>('#frame-note')!;
const playLink = document.querySelector<HTMLAnchorElement>('#play-link')!;
const stagePlay = document.querySelector<HTMLAnchorElement>('#stage-play')!;
const uiButton = document.querySelector<HTMLButtonElement>('#toggle-ui')!;
const havenButton = document.querySelector<HTMLButtonElement>('#toggle-haven')!;
const candidateButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-candidate]')];
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
const requested = new URLSearchParams(location.search).get('title');
let candidate: Candidate = requested && Object.prototype.hasOwnProperty.call(candidates, requested) ? requested as Candidate : '0';
let view: View = 'full';
let uiHidden = false;
let haven = false;
let revision = 0;
let ready = false;
const decoded = new Map<string, HTMLImageElement>();

function getImage(url: string): Promise<HTMLImageElement> {
  const cached = decoded.get(url);
  if (cached) return Promise.resolve(cached);
  const image = new Image(); image.src = url;
  return image.decode().then(() => {
    const valid = url === HAVEN_URL
      ? image.naturalWidth === 1100 && image.naturalHeight === 800
      : image.naturalWidth >= 960 && Math.abs(image.naturalWidth / image.naturalHeight - 1.5) <= .002;
    if (!valid) {
      throw new Error('图片必须为至少 960 像素宽的 3:2 画面。');
    }
    decoded.set(url, image); return image;
  });
}

function layout(): void {
  const native = view === 'native' && !haven;
  const full = view === 'full' || haven;
  frame.classList.toggle('native', native);
  stage.style.width = `${native ? art.naturalWidth || 960 : 960}px`;
  stage.style.height = `${native ? art.naturalHeight || 640 : 640}px`;
  stage.style.transform = native ? 'none' : `scale(${frame.clientWidth / 960})`;
  art.style.width = `${haven ? 1100 : native ? art.naturalWidth || 960 : 960}px`;
  art.style.height = `${haven ? 800 : native ? art.naturalHeight || 640 : 640}px`;
  if (haven) {
    // The verified 1100×800 browser capture contains the actual 960×640 game
    // viewport at (70,82). Crop only its surrounding review-page controls.
    art.style.transform = 'translate(-70px, -82px)';
  } else if (!full && !native) {
    const [x, y, width] = crops[view as keyof typeof crops];
    const zoom = 960 / width;
    art.style.transform = `matrix(${zoom}, 0, 0, ${zoom}, ${-x * zoom}, ${-y * zoom})`;
  } else art.style.transform = 'none';
  titleCopy.hidden = uiHidden || !full || haven || !ready;
  frameNote.hidden = !ready || (!haven && full);
  frameNote.textContent = haven ? '联合样片 · 真实净化点截帧'
    : native ? `${art.naturalWidth} × ${art.naturalHeight} · 原生像素 · 滚动查看`
    : '固定坐标局部放大 · 所有候选相同裁切';
}

async function render(): Promise<void> {
  const ticket = ++revision;
  ready = false; art.hidden = true; imageStatus.hidden = false;
  imageStatus.textContent = '载入画面';
  const item = candidates[candidate];
  const gameUrl = candidate === '0' ? GAME_URL : `${GAME_URL}?title=${candidate}`;
  playLink.href = stagePlay.href = gameUrl;
  playLink.textContent = `用${candidate === '0' ? '原版' : `候选 ${candidate.toUpperCase()}`}进入游戏 →`;
  description.textContent = `${item.name} · ${item.description}`;
  candidateButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.candidate === candidate)));
  viewButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
    button.disabled = haven;
  });
  uiButton.setAttribute('aria-pressed', String(uiHidden));
  uiButton.textContent = uiHidden ? '显示标题' : '隐藏标题';
  uiButton.disabled = haven || view !== 'full';
  havenButton.setAttribute('aria-pressed', String(haven));
  havenButton.textContent = haven ? '返回首页候选' : '看真实实景';
  document.body.dataset.candidate = candidate;
  document.body.dataset.view = haven ? 'haven' : view;
  layout();
  try {
    const image = await getImage(haven ? HAVEN_URL : item.url);
    if (ticket !== revision) return;
    art.src = image.src;
    await art.decode();
    if (ticket !== revision) return;
    art.alt = haven ? '联合样片真实净化点截帧' : `${item.name}首页候选`;
    ready = true; art.hidden = false; imageStatus.hidden = true;
    layout();
  } catch {
    if (ticket !== revision) return;
    imageStatus.textContent = '这张画面暂时未能载入。点击对应候选可重新载入。';
  }
}

function choose(next: Candidate): void {
  candidate = next; haven = false; frame.scrollTop = frame.scrollLeft = 0;
  const query = candidate === '0' ? '' : `?title=${candidate}`;
  history.replaceState(null, '', location.pathname + query);
  void render();
}
candidateButtons.forEach(button => button.addEventListener('click', () => choose(button.dataset.candidate as Candidate)));
viewButtons.forEach(button => button.addEventListener('click', () => { view = button.dataset.view as View; frame.scrollTop = frame.scrollLeft = 0; void render(); }));
uiButton.addEventListener('click', () => { uiHidden = !uiHidden; void render(); });
havenButton.addEventListener('click', () => { haven = !haven; frame.scrollTop = frame.scrollLeft = 0; void render(); });
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
  const digit = ['0', '1', '2', '3', '4', '5', '6'].indexOf(event.key);
  if (digit >= 0) { event.preventDefault(); choose((['0', 'a', 'b', 'c', 'd', 'e', 'f'] as const)[digit]!); }
  else if (event.key.toLowerCase() === 'h') { event.preventDefault(); uiHidden = !uiHidden; void render(); }
  else if (event.code === 'Space') { event.preventDefault(); haven = !haven; void render(); }
});
const resize = new ResizeObserver(layout); resize.observe(frame);
window.addEventListener('pagehide', () => resize.disconnect(), { once: true });
void render();
// Decode beforehand for immediate pixel-aligned switching once files exist.
for (const { url } of Object.values(candidates)) void getImage(url).catch(() => {});
void getImage(HAVEN_URL).catch(() => {});
