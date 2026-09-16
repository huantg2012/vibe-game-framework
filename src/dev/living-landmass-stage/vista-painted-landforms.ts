import * as THREE from 'three';

export interface VistaImageCrop { x: number; y: number; width: number; height: number }
export interface VistaPaintedLandformOptions { crop?: VistaImageCrop; width?: number; height?: number }
export interface VistaHeroTextureOptions { hero?: VistaPaintedLandformOptions; fallen?: VistaPaintedLandformOptions }
export interface VistaPaintedLandformPlacement { id: string; role: 'hero' | 'fallen'; x: number; frontZ: number }

const TILT = -32 * Math.PI / 180;
const HERO_CROP: VistaImageCrop = { x: 40, y: 75, width: 1453, height: 732 };
type Card = { placement: VistaPaintedLandformPlacement;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  image: { width: number; height: number; crop: VistaImageCrop } | null };

/** Fixed world-space cutouts: the collision solids remain independent. Each
 * accepted texture belongs exclusively to this group until replaced/destroyed. */
export class VistaPaintedLandforms {
  readonly group = new THREE.Group();
  private readonly cards: Card[] = [];
  private readonly released = new WeakSet<THREE.Texture>();
  private disposed = false;

  constructor(placements: readonly VistaPaintedLandformPlacement[], heightAt: (x: number, z: number) => number) {
    this.group.name = 'painted-landforms-r8';
    for (const placement of placements) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff, alphaTest: .05,
        transparent: false, depthTest: true, depthWrite: true, toneMapped: false });
      material.name = `vista-painted-${placement.role}-r8`;
      material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>',
          'diffuseColor.a = smoothstep(0.50, 0.90, diffuseColor.a);\n#include <alphatest_fragment>');
      };
      material.customProgramCacheKey = () => 'vista-painted-landform-alpha-050-090-r8';
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.translate(0, .5, 0);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `painted-${placement.id}`;
      mesh.rotation.x = TILT;
      mesh.position.set(placement.x, heightAt(placement.x, placement.frontZ), placement.frontZ);
      mesh.scale.set(placement.role === 'hero' ? 480 : 280, placement.role === 'hero' ? 242 : 120.4, 1);
      mesh.visible = false;
      this.group.add(mesh);
      this.cards.push({ placement: { ...placement }, mesh, image: null });
    }
  }

  /** Transfer two distinct textures. Invalid arguments leave ownership with
   * the caller; successful calls and calls after destroy transfer ownership. */
  setHeroTextures(hero: THREE.Texture, fallen: THREE.Texture, options: VistaHeroTextureOptions = {}): void {
    if (this.disposed) { this.release(hero); this.release(fallen); return; }
    if (hero === fallen) throw new Error('Painted landforms require distinct texture transforms');
    const prepared = this.cards.map(card => {
      const texture = card.placement.role === 'hero' ? hero : fallen;
      if (this.released.has(texture)) throw new Error('Cannot install a disposed painted landform texture');
      const settings = options[card.placement.role];
      const source = texture.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | undefined;
      const imageWidth = source?.naturalWidth || source?.width || 0;
      const imageHeight = source?.naturalHeight || source?.height || 0;
      const crop = { ...(settings?.crop ?? (card.placement.role === 'hero' ? HERO_CROP
        : { x: 0, y: 0, width: imageWidth, height: imageHeight })) };
      const width = settings?.width ?? (card.placement.role === 'hero' ? 480 : 280);
      const height = settings?.height ?? (card.placement.role === 'hero' ? 242 : 120.4);
      if (![imageWidth, imageHeight, width, height, crop.width, crop.height].every(value => Number.isFinite(value) && value > 0)
        || ![crop.x, crop.y].every(value => Number.isFinite(value) && value >= 0)
        || crop.x + crop.width > imageWidth || crop.y + crop.height > imageHeight) {
        throw new Error(`Invalid painted landform crop/size: ${card.placement.id}`);
      }
      return { card, texture, imageWidth, imageHeight, crop, width, height };
    });
    const previous = new Set(this.cards.map(card => card.mesh.material.map));
    for (const entry of prepared) {
      const { card, texture, imageWidth, imageHeight, crop, width, height } = entry;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.offset.set(crop.x / imageWidth, (imageHeight - crop.y - crop.height) / imageHeight);
      texture.repeat.set(crop.width / imageWidth, crop.height / imageHeight);
      texture.needsUpdate = true;
      card.mesh.material.map = texture;
      card.mesh.material.needsUpdate = true;
      card.mesh.scale.set(width, height, 1);
      card.mesh.visible = true;
      card.image = { width: imageWidth, height: imageHeight, crop };
    }
    for (const texture of previous) if (texture && texture !== hero && texture !== fallen) this.release(texture);
  }

  snapshot(): Record<string, unknown> {
    return { rendering: 'fixed-painted-landforms-with-solid-shadow-proxies', fixedTiltDegrees: -32,
      cameraFollowing: false, alpha: { smoothstep: [.5, .9], alphaTest: .05 },
      cards: this.cards.map(({ placement, mesh, image }) => ({ id: placement.id, role: placement.role,
        loaded: mesh.material.map !== null, visible: mesh.visible,
        image: image ? { width: image.width, height: image.height, crop: { ...image.crop } } : null,
        uv: mesh.material.map ? { offset: mesh.material.map.offset.toArray(), repeat: mesh.material.map.repeat.toArray() } : null,
        world: { width: mesh.scale.x, height: mesh.scale.y, anchor: mesh.position.toArray(), rotationX: mesh.rotation.x },
        material: { opaque: !mesh.material.transparent, depthTest: mesh.material.depthTest,
          depthWrite: mesh.material.depthWrite, toneMapped: mesh.material.toneMapped } })) };
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const { mesh } of this.cards) {
      if (mesh.material.map) this.release(mesh.material.map);
      mesh.material.map = null;
      mesh.visible = false;
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.group.clear();
  }

  private release(texture: THREE.Texture): void {
    if (!this.released.has(texture)) { this.released.add(texture); texture.dispose(); }
  }
}
