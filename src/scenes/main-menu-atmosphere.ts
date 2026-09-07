import Phaser from 'phaser';

interface LocalLight {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  actorAnchored: boolean;
  minimum: number;
  range: number;
  periodA: number;
  periodB: number;
  phase: number;
}

interface DustMote {
  image: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  lifetime: number;
  phase: number;
  opacity: number;
  rise: number;
  drift: number;
}

interface FurnaceCore {
  image: Phaser.GameObjects.Rectangle;
  height: number;
  period: number;
  phase: number;
}

let textureSerial = 0;

/** Local motion follows the key art's light sources, never menu text or camera. */
export class MainMenuAtmosphere {
  private readonly scene: Phaser.Scene;
  private readonly textureKey: string;
  private readonly lights: LocalLight[] = [];
  private readonly crackTextureKeys: string[] = [];
  private readonly dust: DustMote[] = [];
  private readonly furnaceCores: FurnaceCore[] = [];
  private readonly motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  private hidden = document.hidden;
  private skipNextFrame = true;
  private elapsed = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.textureKey = `menu-atmosphere-${textureSerial++}`;
    const texture = scene.textures.createCanvas(this.textureKey, 64, 64);
    if (!texture) throw new Error('Unable to create menu atmosphere light texture');
    const context = texture.getContext();
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.28, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.68, 'rgba(255,255,255,0.12)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    texture.refresh();

    this.addLight(832, 294, 18, 15, 0xc4873a, 0.06, 0.28, 1700, 2900, 0.6);
    // A small readable emitter, with a weaker halo that never washes the body.
    // Both follow the actor's shoulder when its separately layered pose moves.
    this.addLight(708, 249, 9, 9, 0xc4873a, 0.04, 0.22, 2200, 2900, 2.1, true);
    this.addLight(708, 249, 2.4, 3.4, 0xc4873a, 0.12, 0.72, 2200, 2900, 2.1, true);
    this.addCrackLight(573, 275, 148, 164, 3200, 4700, 4.1);
    this.addCrackLight(421, 383, 136, 108, 3700, 5100, 0.9);
    this.addCrackLight(738, 51, 126, 102, 2900, 4300, 2.9);

    // Tiny changing silhouettes inside the existing furnace aperture make the
    // animation readable without turning the whole illustration into a halo.
    for (let index = 0; index < 4; index++) {
      this.furnaceCores.push({
        image: scene.add.rectangle(828 + index * 2, 297 - (index % 2), 1, 3, 0xc4873a)
          .setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD),
        height: 3 + (index % 3),
        period: 730 + index * 193,
        phase: index * 1.9,
      });
    }

    for (let index = 0; index < 20; index++) {
      // Deterministic dispersion with a few visible motes at any given time.
      // Integer-pixel silhouettes remain visible after the fixed canvas scales.
      this.dust.push({
        image: scene.add.rectangle(0, 0, index % 3 === 0 ? 2 : 1.5, 1.5, 0x8a8f96),
        x: 472 + ((index * 67) % 181),
        y: 190 + ((index * 103) % 350),
        lifetime: 10000 + (index % 5) * 1800,
        phase: (index * 0.61803398875) % 1,
        opacity: 0.6 + (index % 4) * 0.08,
        rise: 8 + (index % 4) * 2,
        drift: 26 + (index % 3) * 12,
      });
    }
    this.motionPreference.addEventListener('change', this.onMotionPreference);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.applyMotionPreference();
    this.render();
  }

  private addLight(
    x: number, y: number, radiusX: number, radiusY: number, tint: number,
    minimum: number, maximum: number, periodA: number, periodB: number, phase: number,
    actorAnchored = false,
  ): void {
    this.lights.push({
      image: this.scene.add.image(x, y, this.textureKey)
        .setDisplaySize(radiusX * 2, radiusY * 2)
        .setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD),
      x, y, actorAnchored, minimum, range: maximum - minimum, periodA, periodB, phase,
    });
  }

  /** Extract only existing colored fissures once; ordinary masonry stays clear. */
  private addCrackLight(
    x: number, y: number, width: number, height: number,
    periodA: number, periodB: number, phase: number,
  ): void {
    const source = this.scene.textures.get('menu-last-light').getSourceImage() as HTMLImageElement;
    const scaleX = source.width / 960;
    const scaleY = source.height / 640;
    const textureWidth = Math.round(width * scaleX);
    const textureHeight = Math.round(height * scaleY);
    const key = `${this.textureKey}-crack-${this.crackTextureKeys.length}`;
    const texture = this.scene.textures.createCanvas(key, textureWidth, textureHeight);
    if (!texture) throw new Error('Unable to create menu fissure light texture');
    this.crackTextureKeys.push(key);
    const context = texture.getContext();
    context.drawImage(source, (x - width / 2) * scaleX, (y - height / 2) * scaleY,
      textureWidth, textureHeight, 0, 0, textureWidth, textureHeight);
    const pixels = context.getImageData(0, 0, textureWidth, textureHeight);
    const data = pixels.data;
    for (let py = 0; py < textureHeight; py++) {
      for (let px = 0; px < textureWidth; px++) {
        const index = (py * textureWidth + px) * 4;
        const red = data[index]!;
        const green = data[index + 1]!;
        const blue = data[index + 2]!;
        const teal = green > red * 1.13 && blue > red * 1.08
          ? Math.min(1, Math.max(0, (green - red - 3) / 12)) : 0;
        const edge = Math.min(1, px / 18, py / 18,
          (textureWidth - 1 - px) / 18, (textureHeight - 1 - py) / 18);
        // Preserve the original fissure's hue and pixel detail. The crop edge
        // fades only the extracted emission, not the already visible artwork.
        data[index] = Math.min(100, red * 2.8);
        data[index + 1] = Math.min(210, green * 2.8);
        data[index + 2] = Math.min(185, blue * 2.8);
        data[index + 3] = Math.round(255 * teal * edge);
      }
    }
    context.putImageData(pixels, 0, 0);
    texture.refresh();
    this.lights.push({
      image: this.scene.add.image(x, y, key).setDisplaySize(width, height)
        .setBlendMode(Phaser.BlendModes.ADD),
      x, y, actorAnchored: false, minimum: 0.04, range: 0.86,
      periodA, periodB, phase,
    });
  }

  /** Logical-pixel displacement of the animated shoulder from its resting pose. */
  setActorOffset(x: number, y: number): void {
    if (this.destroyed) return;
    for (const light of this.lights) {
      if (light.actorAnchored) light.image.setPosition(light.x + x, light.y + y);
    }
  }

  private readonly onMotionPreference = (): void => {
    this.applyMotionPreference();
    this.skipNextFrame = true;
  };

  private applyMotionPreference(): void {
    const visible = !this.motionPreference.matches;
    for (const light of this.lights) light.image.setVisible(visible);
    for (const mote of this.dust) mote.image.setVisible(visible);
    for (const core of this.furnaceCores) core.image.setVisible(visible);
  }

  private readonly onVisibilityChange = (): void => {
    this.hidden = document.hidden;
    this.skipNextFrame = true;
  };

  update(delta: number): void {
    if (this.destroyed || this.hidden || this.motionPreference.matches) return;
    if (this.skipNextFrame) {
      this.skipNextFrame = false;
      return;
    }
    this.elapsed += Math.min(Math.max(delta, 0), 100);
    this.render();
  }

  private render(): void {
    for (const light of this.lights) {
      const wave = 0.5
        + 0.32 * Math.sin(this.elapsed * Math.PI * 2 / light.periodA + light.phase)
        + 0.18 * Math.sin(this.elapsed * Math.PI * 2 / light.periodB + light.phase * 1.7);
      light.image.setAlpha(light.minimum + light.range * wave);
    }
    for (const core of this.furnaceCores) {
      const pulse = 0.5 + 0.35 * Math.sin(this.elapsed * Math.PI * 2 / core.period + core.phase)
        + 0.15 * Math.sin(this.elapsed * Math.PI * 2 / (core.period * 1.73) + core.phase);
      core.image.setDisplaySize(1, 1 + Math.round(core.height * pulse));
      core.image.setAlpha(0.12 + 0.58 * pulse);
    }
    for (const mote of this.dust) {
      const life = (this.elapsed / mote.lifetime + mote.phase) % 1;
      const fade = Math.sin(life * Math.PI);
      mote.image.setPosition(mote.x + life * mote.drift, mote.y - life * mote.lifetime * mote.rise / 1000);
      mote.image.setAlpha(mote.opacity * fade * fade);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.motionPreference.removeEventListener('change', this.onMotionPreference);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    for (const light of this.lights) light.image.destroy();
    for (const mote of this.dust) mote.image.destroy();
    for (const core of this.furnaceCores) core.image.destroy();
    this.lights.length = 0;
    this.dust.length = 0;
    this.furnaceCores.length = 0;
    this.scene.textures.remove(this.textureKey);
    for (const key of this.crackTextureKeys) this.scene.textures.remove(key);
    this.crackTextureKeys.length = 0;
  }
}
