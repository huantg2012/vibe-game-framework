import Phaser from 'phaser';
import { generateDensePlayerPlaceholders, DENSE_PLAYER_IDLE_TEXTURE } from '../../src/entities/player-sprite-dense';
import { renderCrowbarPixels, type CrowbarQuality, type CrowbarVariant } from '../../src/art/crowbar-pixels';
import type { Facing4 } from '../../src/types/game-types';

const canvas = document.querySelector<HTMLCanvasElement>('#sheet')!;
const ctx = canvas.getContext('2d')!;
const variant = document.querySelector<HTMLSelectElement>('#variant')!;
const surface = document.querySelector<HTMLSelectElement>('#surface')!;
const silhouette = document.querySelector<HTMLInputElement>('#silhouette')!;
const detail = document.querySelector<HTMLElement>('#detail')!;
const qualities: CrowbarQuality[] = ['ordinary', 'good', 'fine', 'excellent'];
const labels = ['普通', '优良', '精良', '卓越'];
const forms = ['原物 · 直杆窄钩', '错生 · 钩肩偏折', '剥层 · 分岔空隙', '改写 · 中空钩根'];
const facings: Facing4[] = ['down', 'left', 'up', 'right'];
const actors = new Map<Facing4, HTMLCanvasElement>();

function texture(quality: CrowbarQuality, purpose: 'world' | 'icon'): HTMLCanvasElement {
  const pixels = renderCrowbarPixels(quality, quality === 'ordinary' ? 'standard' : variant.value as CrowbarVariant, purpose);
  const result = document.createElement('canvas');
  result.width = pixels.width; result.height = pixels.height;
  const c = result.getContext('2d')!;
  const data = c.createImageData(pixels.width, pixels.height);
  data.data.set(pixels.data);
  if (silhouette.checked) for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3]) { data.data[i] = 190; data.data[i + 1] = 198; data.data[i + 2] = 184; }
  }
  c.putImageData(data, 0, 0);
  return result;
}

function held(weapon: HTMLCanvasElement, facing: Facing4): HTMLCanvasElement {
  const out = document.createElement('canvas'); out.width = 64; out.height = 64;
  const c = out.getContext('2d')!; c.imageSmoothingEnabled = false;
  const player = actors.get(facing);
  if (!player) return out;
  // These are preview anchors against neutral production player pixels, not combat rig data.
  const poses: Record<Facing4, [number, number, number, boolean]> = {
    down: [23, 17, 120, false], right: [22, 16, 120, false],
    left: [10, 16, -120, false], up: [23, 17, 60, true],
  };
  const [hx, hy, degrees, behind] = poses[facing];
  const drawWeapon = () => {
    c.save(); c.translate(16 + hx, 16 + hy); c.rotate(degrees * Math.PI / 180);
    c.drawImage(weapon, -16, -24); c.restore();
  };
  if (behind) drawWeapon();
  c.drawImage(player, 16, 16);
  if (!behind) {
    drawWeapon();
    // Hand occludes the grip. Do not redraw the whole body above a forward-facing weapon.
    c.fillStyle = '#52463c'; c.fillRect(16 + hx - 1, 16 + hy - 1, 3, 2);
  }
  return out;
}

function text(value: string, x: number, y: number, size = 12, color = '#8d9f94') {
  ctx.font = size + 'px "PingFang SC", sans-serif'; ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function draw() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#131b17'; ctx.fillRect(0, 0, 1080, 670);
  qualities.forEach((quality, index) => {
    const x = index * 270;
    ctx.fillStyle = surface.value; ctx.fillRect(x + 4, 4, 262, 662);
    text(labels[index]!, x + 24, 36, 18, '#c4c3ad');
    text(forms[index]!, x + 24, 59);
    const icon = texture(quality, 'icon');
    ctx.drawImage(icon, x + 36, 77, 144, 144);
    ctx.drawImage(icon, x + 194, 151);
    text('库存图标 3×', x + 40, 239);
    text('48 px · 1×', x + 182, 239);
    const world = texture(quality, 'world');
    ctx.drawImage(world, x + 49, 271, 128, 128);
    ctx.drawImage(world, x + 202, 350);
    text('世界模型 4×', x + 40, 415);
    text('32 px · 1×', x + 182, 415);
    facings.forEach((facing, i) => {
      const actor = held(world, facing);
      ctx.drawImage(actor, x + 7 + (i % 2) * 126, 435 + Math.floor(i / 2) * 98, 128, 128);
    });
    text('实际玩家 · 四向持握标定 2×', x + 34, 652, 11);
  });
  detail.textContent = '透明 PNG：世界基型 32 × 32，图标 48 × 48。普通保留白板；其余三档可切换构造。上方 1× 为原生像素大小，放大只用最近邻。';
}

for (const control of [variant, surface, silhouette]) control.addEventListener('change', draw);
document.querySelector('#download')!.addEventListener('click', () => {
  const link = document.createElement('a'); link.href = canvas.toDataURL('image/png');
  link.download = 'crowbar-pixel-review.png'; link.click();
});

class TextureScene extends Phaser.Scene {
  create() {
    try {
      generateDensePlayerPlaceholders(this);
      for (const facing of facings) {
        actors.set(facing, this.textures.get(DENSE_PLAYER_IDLE_TEXTURE[facing][0]!).getSourceImage() as HTMLCanvasElement);
      }
      draw();
      this.game.loop.stop();
    } catch (error) {
      detail.classList.add('error'); detail.textContent = '素材加载失败：' + String(error);
    }
  }
}
const game = new Phaser.Game({
  type: Phaser.CANVAS, parent: 'engine', width: 32, height: 32, transparent: true,
  pixelArt: true, banner: false, audio: { noAudio: true }, scene: TextureScene,
});
window.addEventListener('pagehide', () => game.destroy(true), { once: true });
