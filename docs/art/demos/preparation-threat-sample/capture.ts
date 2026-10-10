/** Records the live independent sample, never a second effects renderer.
 * Only the unchanged CSS backdrop and each grade's DOM text are rasterized
 * during preparation. Every video frame copies the current world and veil. */
export type CaptureGrade = 'low' | 'medium' | 'severe';
export interface CaptureProgress {
  seconds: number;
  grade: CaptureGrade;
  stage: 'preparing' | 'recording' | 'complete';
}
export interface CaptureOptions {
  world: HTMLCanvasElement;
  veil: HTMLCanvasElement;
  uiRoot: HTMLElement;
  stage: HTMLElement;
  selectGrade: (grade: CaptureGrade) => void;
  onPrepared?: () => void;
  onProgress?: (progress: CaptureProgress) => void;
  frameRate?: 30 | 60;
}
export interface SampleCapture {
  record(): Promise<Blob>;
  cancel(): void;
  dispose(): void;
}
interface CaptureJob {
  abort: AbortController;
  frame: number;
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
}
const WIDTH = 960;
const HEIGHT = 640;
const DURATION = 10;
const GRADES: readonly CaptureGrade[] = ['low', 'medium', 'severe'];
const XHTML = 'http://www.w3.org/1999/xhtml';

function cancellation(): DOMException {
  return new DOMException('录像已取消；未产生可交付片段。', 'AbortError');
}
function requireActive(signal: AbortSignal): void {
  if (signal.aborted) throw cancellation();
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function paintFrame(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    requireActive(signal);
    const abort = (): void => { cancelAnimationFrame(frame); reject(cancellation()); };
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    });
    signal.addEventListener('abort', abort, { once: true });
  });
}
function waitForFonts(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    requireActive(signal);
    const abort = (): void => { reject(cancellation()); };
    signal.addEventListener('abort', abort, { once: true });
    void document.fonts.ready.then(() => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(cancellation());
      else resolve();
    }, error => {
      signal.removeEventListener('abort', abort);
      reject(new Error(`录像字体准备失败：${message(error)}`));
    });
  });
}
function loadSnapshot(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    requireActive(signal);
    const image = new Image();
    const clean = (): void => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener('abort', abort);
    };
    const abort = (): void => { clean(); image.src = ''; reject(cancellation()); };
    image.onload = () => { clean(); resolve(image); };
    image.onerror = () => { clean(); reject(new Error('录像无法载入 DOM 的 SVG 快照；未开始录制。')); };
    signal.addEventListener('abort', abort, { once: true });
    image.src = url;
  });
}
function toDataUrl(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    requireActive(signal);
    const reader = new FileReader();
    const clean = (): void => {
      signal.removeEventListener('abort', abort);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
    };
    const abort = (): void => { clean(); reader.abort(); reject(cancellation()); };
    reader.onload = () => {
      const result = reader.result;
      clean();
      if (typeof result === 'string') resolve(result);
      else reject(new Error('录像无法内嵌 DOM 图片。'));
    };
    reader.onerror = () => { clean(); reject(new Error('录像无法读取 DOM 图片。')); };
    signal.addEventListener('abort', abort, { once: true });
    reader.readAsDataURL(blob);
  });
}

/** Inline actual computed CSS instead of maintaining parallel typography.
 * Materializing pseudo elements preserves the real selected-grade short mark. */
async function domSnapshot(
  root: HTMLElement, layer: 'backdrop' | 'text', signal: AbortSignal,
  assets: Map<string, Promise<string>>,
): Promise<HTMLImageElement> {
  const inlineAsset = (source: string): Promise<string> => {
    if (source.startsWith('data:')) return Promise.resolve(source);
    const url = new URL(source, document.baseURI);
    if (url.origin !== location.origin && url.protocol !== 'blob:') {
      return Promise.reject(new Error(`录像拒绝外部图片，避免画布污染：${url.origin}`));
    }
    let asset = assets.get(url.href);
    if (!asset) {
      asset = fetch(url.href, { signal }).then(async response => {
        if (!response.ok) throw new Error(`录像图片读取失败：${response.status} ${url.pathname}`);
        return toDataUrl(await response.blob(), signal);
      });
      assets.set(url.href, asset);
    }
    return asset;
  };
  const inlineUrls = async (value: string): Promise<string> => {
    const matches = [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)];
    let result = value;
    for (const match of matches) {
      const source = match[2];
      if (!source || source.startsWith('#')) continue;
      result = result.replace(match[0], `url("${await inlineAsset(source)}")`);
    }
    return result;
  };
  const applyStyle = async (target: HTMLElement, computed: CSSStyleDeclaration): Promise<void> => {
    for (const property of computed) {
      const value = computed.getPropertyValue(property);
      target.style.setProperty(property, value.includes('url(') ? await inlineUrls(value) : value);
    }
    target.style.setProperty('animation', 'none', 'important');
    target.style.setProperty('transition', 'none', 'important');
    target.style.setProperty('caret-color', 'transparent', 'important');
  };
  const pseudo = async (source: HTMLElement, name: '::before' | '::after'): Promise<HTMLElement | null> => {
    const style = getComputedStyle(source, name);
    const content = style.content;
    if (!content || content === 'none' || content === 'normal' || style.display === 'none') return null;
    const node = document.createElementNS(XHTML, 'span');
    await applyStyle(node, style);
    node.textContent = content === '""' || content === "''" ? '' : content.replace(/^['"]|['"]$/g, '');
    return node;
  };
  const clone = async (source: HTMLElement): Promise<HTMLElement | null> => {
    requireActive(signal);
    if (source instanceof HTMLCanvasElement || source.matches('script,style,link')) return null;
    const style = getComputedStyle(source);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    if (layer === 'text' && source.classList.contains('reading-backdrop')) return null;
    if (layer === 'backdrop' && source !== root && !source.classList.contains('reading-backdrop')) return null;
    const target = source.cloneNode(false) as HTMLElement;
    for (const attribute of [...target.attributes]) {
      if (attribute.name.startsWith('on')) target.removeAttribute(attribute.name);
    }
    await applyStyle(target, style);
    if (source === root) {
      target.style.setProperty('position', 'absolute');
      target.style.setProperty('inset', '0');
      target.style.setProperty('width', `${WIDTH}px`);
      target.style.setProperty('height', `${HEIGHT}px`);
      target.style.setProperty('transform', 'none');
      target.style.setProperty('background', 'transparent');
    }
    if (source instanceof HTMLImageElement) {
      target.setAttribute('src', await inlineAsset(source.currentSrc || source.src));
      target.removeAttribute('srcset');
      target.removeAttribute('loading');
    }
    const before = await pseudo(source, '::before');
    if (before) target.append(before);
    for (const child of source.childNodes) {
      if (child instanceof HTMLElement) {
        const element = await clone(child);
        if (element) target.append(element);
      } else if (child.nodeType === Node.TEXT_NODE) target.append(child.cloneNode());
    }
    const after = await pseudo(source, '::after');
    if (after) target.append(after);
    return target;
  };
  const node = await clone(root);
  if (!node) throw new Error('录像需要展开并显示文字的污染选择页。');
  const wrapper = document.createElementNS(XHTML, 'div');
  wrapper.setAttribute('style', `position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:transparent`);
  wrapper.append(node);
  const markup = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><foreignObject x="0" y="0" width="${WIDTH}" height="${HEIGHT}">${markup}</foreignObject></svg>`;
  const image = await loadSnapshot(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, signal);
  const probe = document.createElement('canvas');
  probe.width = WIDTH; probe.height = HEIGHT;
  const context = probe.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('录像无法创建快照校验画布。');
  try {
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
    let visible = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index]! > 0) { visible = true; break; }
    }
    if (!visible) throw new Error(`${layer === 'text' ? '文字' : '阅读暗场'}快照为空`);
  } catch (error) {
    throw new Error(`SVG DOM 快照不能安全录制（可能被浏览器污染保护阻止）：${message(error)}`);
  }
  return image;
}

export function createCapture(options: CaptureOptions): SampleCapture {
  let disposed = false;
  let job: CaptureJob | null = null;
  const cancel = (): void => { job?.abort.abort(); };
  const record = async (): Promise<Blob> => {
    if (disposed) throw new Error('录像器已销毁。');
    if (job) throw new Error('已有录像进行中。');
    if (document.hidden) throw new Error('请在可见页面中开始录像。');
    if (!options.stage.contains(options.uiRoot) || !options.stage.contains(options.world)) {
      throw new Error('录像层不属于同一个实际样例舞台。');
    }
    if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
      throw new Error('当前浏览器不支持 Canvas WebM 录像。');
    }
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('当前浏览器没有可用的 WebM 编码器。');
    const current: CaptureJob = { abort: new AbortController(), frame: 0, stream: null, recorder: null };
    job = current;
    const signal = current.abort.signal;
    const visibility = (): void => { if (document.hidden) current.abort.abort(); };
    const pagehide = (): void => { current.abort.abort(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    const snapshots = new Map<CaptureGrade, HTMLImageElement>();
    let backdrop: HTMLImageElement | null = null;
    try {
      await waitForFonts(signal);
      requireActive(signal);
      const assets = new Map<string, Promise<string>>();
      for (const grade of GRADES) {
        options.onProgress?.({ seconds: 0, grade, stage: 'preparing' });
        options.selectGrade(grade);
        await paintFrame(signal);
        if (!backdrop) backdrop = await domSnapshot(options.uiRoot, 'backdrop', signal, assets);
        snapshots.set(grade, await domSnapshot(options.uiRoot, 'text', signal, assets));
      }
      requireActive(signal);
      options.selectGrade('low');
      options.onPrepared?.();
      await paintFrame(signal);
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH; canvas.height = HEIGHT;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('录像无法创建合成画布。');
      context.imageSmoothingEnabled = false;
      const compose = (grade: CaptureGrade): void => {
        context.drawImage(options.world, 0, 0, WIDTH, HEIGHT);
        context.drawImage(backdrop!, 0, 0, WIDTH, HEIGHT);
        context.drawImage(options.veil, 0, 0, WIDTH, HEIGHT);
        context.drawImage(snapshots.get(grade)!, 0, 0, WIDTH, HEIGHT);
      };
      compose('low');
      try { context.getImageData(0, 0, 1, 1); }
      catch (error) { throw new Error(`实际画面合成不可安全录制：${message(error)}`); }
      current.stream = canvas.captureStream(options.frameRate ?? 60);
      current.recorder = new MediaRecorder(current.stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      const recorder = current.recorder;
      const blob = await new Promise<Blob>((resolve, reject) => {
        const chunks: Blob[] = [];
        let finished = false;
        let grade: CaptureGrade = 'low';
        let lastProgress = -1;
        let start = 0;
        const cleanup = (): void => {
          cancelAnimationFrame(current.frame);
          signal.removeEventListener('abort', abort);
          recorder.ondataavailable = null;
          recorder.onerror = null;
          recorder.onstop = null;
        };
        const fail = (error: unknown): void => {
          if (finished) return;
          finished = true;
          cleanup();
          if (recorder.state !== 'inactive') recorder.stop();
          reject(error);
        };
        const abort = (): void => { fail(cancellation()); };
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => { fail(new Error('浏览器 WebM 编码失败，未产生有效录像。')); };
        recorder.onstop = () => {
          if (finished) return;
          finished = true;
          cleanup();
          const result = new Blob(chunks, { type: mimeType });
          if (!result.size) reject(new Error('浏览器未输出视频数据，不能交付空录像。'));
          else resolve(result);
        };
        const tick = (now: number): void => {
          if (finished || signal.aborted) return;
          try {
            const seconds = Math.min(DURATION, (now - start) / 1000);
            const next: CaptureGrade = seconds < 2 ? 'low' : seconds < 5 ? 'medium' : seconds < 8 ? 'severe' : 'low';
            if (next !== grade) { grade = next; options.selectGrade(grade); }
            compose(grade);
            const progress = Math.floor(seconds * 10);
            if (progress !== lastProgress) {
              lastProgress = progress;
              options.onProgress?.({ seconds, grade, stage: 'recording' });
            }
            if (seconds >= DURATION) recorder.stop();
            else current.frame = requestAnimationFrame(tick);
          } catch (error) { fail(new Error(`录像合成失败：${message(error)}`)); }
        };
        signal.addEventListener('abort', abort, { once: true });
        try {
          requireActive(signal);
          recorder.start(200);
          start = performance.now();
          current.frame = requestAnimationFrame(tick);
        } catch (error) { fail(error); }
      });
      requireActive(signal);
      options.onProgress?.({ seconds: DURATION, grade: 'low', stage: 'complete' });
      return blob;
    } finally {
      cancelAnimationFrame(current.frame);
      if (current.recorder && current.recorder.state !== 'inactive') current.recorder.stop();
      current.stream?.getTracks().forEach(track => track.stop());
      snapshots.clear();
      backdrop = null;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      if (job === current) job = null;
    }
  };
  return { record, cancel, dispose: () => { disposed = true; cancel(); } };
}
