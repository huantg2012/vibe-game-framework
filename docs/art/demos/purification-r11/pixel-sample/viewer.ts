import { renderDensePlayerFrame } from '../../../../../src/entities/player-sprite-dense';
import { renderSample, SAMPLE_CROP, type SampleState } from './scene';

type View = 'crop' | 'full' | 'original';

const WIDTH = 960;
const HEIGHT = 640;
const PLAYER_SIZE = 48;
const PLAYER_FEET = { x: 496 * .625, y: 623 * .625 };

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing viewer element: ${id}`);
  return found as T;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const found = canvas.getContext('2d');
  if (!found) throw new Error('Canvas 2D is unavailable');
  found.imageSmoothingEnabled = false;
  return found;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function putPixels(ctx: CanvasRenderingContext2D, pixels: Uint8ClampedArray, width: number, height: number): void {
  if (pixels.length !== width * height * 4) throw new Error('Unexpected sample dimensions');
  const image = ctx.createImageData(width, height);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
}

const canvas = element<HTMLCanvasElement>('sample-canvas');
const display = context(canvas);
const playerToggle = element<HTMLInputElement>('show-player');
const downloadButton = element<HTMLButtonElement>('download-sample');
const status = element<HTMLParagraphElement>('sample-status');
const stateButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-state]')];
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-view]')];
const sampleCanvas = makeCanvas(WIDTH, HEIGHT);
const sampleContext = context(sampleCanvas);
const composedCanvas = makeCanvas(WIDTH, HEIGHT);
const composedContext = context(composedCanvas);
const playerCanvas = makeCanvas(32, 32);
putPixels(context(playerCanvas), renderDensePlayerFrame('right', 'idle', 0), 32, 32);

let state: SampleState = 'core';
let view: View = 'crop';
let showPlayer = true;
let ready = false;
const reference = new Image();

function syncControls(): void {
  for (const button of stateButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.state === state));
    button.disabled = view === 'original';
  }
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  playerToggle.disabled = view === 'original';
  playerToggle.checked = view !== 'original' && showPlayer;
}

function render(): void {
  syncControls();
  if (!ready) return;

  // The sample is raw, transparent scene pixels. C is only the surrounding reference.
  putPixels(sampleContext, renderSample(state), WIDTH, HEIGHT);
  composedContext.clearRect(0, 0, WIDTH, HEIGHT);
  composedContext.drawImage(reference, 0, 0, WIDTH, HEIGHT);
  if (view !== 'original') {
    composedContext.drawImage(sampleCanvas, 0, 0);
    if (showPlayer) {
      composedContext.drawImage(playerCanvas,
        PLAYER_FEET.x - PLAYER_SIZE / 2, PLAYER_FEET.y - 26 * 1.5,
        PLAYER_SIZE, PLAYER_SIZE);
    }
  }

  display.fillStyle = '#0b0d0e';
  display.fillRect(0, 0, WIDTH, HEIGHT);
  if (view === 'crop') {
    const { x, y, width, height } = SAMPLE_CROP;
    display.drawImage(composedCanvas, x, y, width, height,
      (WIDTH - width * 2) / 2, (HEIGHT - height * 2) / 2, width * 2, height * 2);
    canvas.setAttribute('aria-label', 'C 实际像素样板，局部两倍显示');
  } else {
    display.drawImage(composedCanvas, 0, 0);
    canvas.setAttribute('aria-label', view === 'original' ? '仅 C 原始构图参照' : 'C 完整构图中的实际像素样板');
  }
}

function renderSafely(): void {
  try {
    render();
    if (ready) status.textContent = '';
  } catch (error) {
    downloadButton.disabled = true;
    status.textContent = '样板未能显示，请刷新后重试。';
    console.error(error);
  }
}

for (const button of stateButtons) {
  button.addEventListener('click', () => {
    const next = button.dataset.state;
    if (next !== 'ambient' && next !== 'core' && next !== 'intrusion') return;
    state = next;
    renderSafely();
  });
}
for (const button of viewButtons) {
  button.addEventListener('click', () => {
    const next = button.dataset.view;
    if (next !== 'crop' && next !== 'full' && next !== 'original') return;
    view = next;
    renderSafely();
  });
}
playerToggle.addEventListener('change', () => {
  showPlayer = playerToggle.checked;
  renderSafely();
});
downloadButton.addEventListener('click', () => {
  const exportedState = state;
  sampleCanvas.toBlob(blob => {
    if (!blob) {
      status.textContent = '样板下载失败，请重试。';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `c-pixel-sample-${exportedState}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});

reference.onload = () => {
  ready = true;
  downloadButton.disabled = false;
  renderSafely();
};
reference.onerror = () => {
  status.textContent = 'C 构图参照未能载入，请刷新后重试。';
};
reference.src = new URL('../c.png', import.meta.url).href;
syncControls();
