import * as THREE from 'three';

/** This is a drawing grid, not the resolution of a shaded 3D render target. */
export const ACTOR_PIXEL_SIZE = 1;
export const ACTOR_CAMERA_ELEVATION = 35 * Math.PI / 180;
export interface ActorPixelProjectionOptions { readonly elevationDeg?: number }

export interface PixelPoint { x: number; y: number; depth: number }

/**
 * A small, allocation-free painter. Shapes have authored colour regions; there
 * is no continuous lighting, antialiasing, random grain or normal-map material.
 * The private depth field lets the same drawings turn through the fixed camera
 * without an arm or a far leg abruptly jumping in front of the torso.
 */
export class ActorPixelDrawing {
  readonly rgba: Uint8Array;
  readonly texture: THREE.DataTexture;
  readonly depthTexture: THREE.DataTexture;
  readonly material: THREE.MeshBasicMaterial;
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly depth: Float32Array;
  private readonly projected = new Float32Array(48 * 3);
  private readonly a: PixelPoint = { x: 0, y: 0, depth: 0 };
  private readonly b: PixelPoint = { x: 0, y: 0, depth: 0 };
  private cosFacing = 1;
  private sinFacing = 0;
  private offsetX = 0;
  private offsetY = 0;
  private offsetZ = 0;
  private lean = 0;
  private squash = 1;
  private cosTwist = 1;
  private sinTwist = 0;
  private readonly cameraDepthRange = { value: 2999 };
  private depthDisposed = false;
  private elevation = ACTOR_CAMERA_ELEVATION;
  private sinElevation = Math.sin(ACTOR_CAMERA_ELEVATION);
  private cosElevation = Math.cos(ACTOR_CAMERA_ELEVATION);

  constructor(readonly width: number, readonly height: number, readonly anchorX: number, readonly anchorY: number,
    projection: ActorPixelProjectionOptions = {}) {
    this.setCameraElevation(projection.elevationDeg ?? 35);
    this.rgba = new Uint8Array(width * height * 4);
    this.depth = new Float32Array(width * height);
    this.texture = new THREE.DataTexture(this.rgba, width, height, THREE.RGBAFormat);
    this.texture.flipY = true;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.depthTexture = new THREE.DataTexture(this.depth, width, height, THREE.RedFormat, THREE.FloatType);
    this.depthTexture.flipY = true;
    this.depthTexture.magFilter = this.depthTexture.minFilter = THREE.NearestFilter;
    this.depthTexture.generateMipmaps = false;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, alphaTest: .5,
      transparent: false, depthWrite: true, toneMapped: false, side: THREE.DoubleSide });
    this.material.onBeforeCompile = shader => {
      shader.uniforms['actorPixelDepth'] = { value: this.depthTexture };
      shader.uniforms['actorCameraDepthRange'] = this.cameraDepthRange;
      shader.fragmentShader = `uniform sampler2D actorPixelDepth;\nuniform float actorCameraDepthRange;\n${shader.fragmentShader}`
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          // The colour remains pixel art. Only its occlusion depth comes from
          // the physical pose. Alpha-test has already discarded empty pixels.
          gl_FragDepth = clamp(gl_FragCoord.z - texture2D(actorPixelDepth, vMapUv).r / actorCameraDepthRange, 0.0, 1.0);`);
    };
    this.material.customProgramCacheKey = () => 'stage-authored-actor-pixel-depth-v1';
    // disposeTree owns the material and colour map. The actor owns this extra
    // texture; bind it to that same lifetime instead of adding a second owner.
    this.material.userData.actorDepthTexture = this.depthTexture;
    this.material.addEventListener('dispose', () => {
      if (this.depthDisposed) return;
      this.depthDisposed = true; this.depthTexture.dispose();
    });
    const geometry = new THREE.PlaneGeometry(width * ACTOR_PIXEL_SIZE, height * ACTOR_PIXEL_SIZE);
    geometry.translate((width / 2 - anchorX) * ACTOR_PIXEL_SIZE, (anchorY - height / 2) * ACTOR_PIXEL_SIZE, 0);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.name = 'authored-actor-pixels';
    this.mesh.userData.pixelDrawing = true;
    this.mesh.onBeforeRender = (_renderer, _scene, camera) => {
      if (camera instanceof THREE.OrthographicCamera)
        this.cameraDepthRange.value = Math.max(1, camera.far - camera.near);
    };
  }

  /** Fixed-azimuth orthographic studies may change elevation. Colour, card
   * orientation and per-pixel pose depth must always use the same basis.
   * Existing stages omit this option and retain their original 35° projection. */
  setCameraElevation(degrees: number): void {
    if (!Number.isFinite(degrees) || degrees <= 0 || degrees >= 90) throw new Error('Actor camera elevation must be between 0 and 90 degrees');
    this.elevation = degrees * Math.PI / 180;
    this.sinElevation = Math.sin(this.elevation); this.cosElevation = Math.cos(this.elevation);
  }

  begin(rootYaw: number): void {
    this.rgba.fill(0);
    this.depth.fill(-Infinity);
    this.cosFacing = Math.cos(rootYaw);
    this.sinFacing = Math.sin(rootYaw);
    this.setBodyTransform(0, 0, 0);
    // The gameplay-facing root still rotates. Cancel just that rotation for
    // the card, then face the one stage camera. The foot anchor stays at zero.
    this.mesh.rotation.set(-this.elevation, -rootYaw, 0, 'YXZ');
  }

  setBodyTransform(x: number, y: number, z: number, lean = 0, squash = 1, twist = 0): void {
    this.offsetX = x; this.offsetY = y; this.offsetZ = z; this.lean = lean; this.squash = squash;
    this.cosTwist = Math.cos(twist); this.sinTwist = Math.sin(twist);
  }

  project(x: number, y: number, z: number, out: PixelPoint): void {
    const height = y * this.squash;
    const localX = x * this.cosTwist + z * this.sinTwist + this.offsetX + height * Math.sin(this.lean);
    const localY = height * Math.cos(this.lean) + this.offsetY;
    const localZ = -x * this.sinTwist + z * this.cosTwist + this.offsetZ;
    const worldX = localX * this.cosFacing + localZ * this.sinFacing;
    const worldZ = -localX * this.sinFacing + localZ * this.cosFacing;
    out.x = this.anchorX + worldX / ACTOR_PIXEL_SIZE;
    out.y = this.anchorY - (localY * this.cosElevation - worldZ * this.sinElevation) / ACTOR_PIXEL_SIZE;
    out.depth = worldZ * this.cosElevation + localY * this.sinElevation;
  }

  polygon(vertices: readonly number[] | Float32Array, colour: number, count = vertices.length / 3, depthBias = 0): void {
    for (let i = 0; i < count; i++) {
      this.project(vertices[i * 3]!, vertices[i * 3 + 1]!, vertices[i * 3 + 2]!, this.a);
      this.projected[i * 3] = this.a.x; this.projected[i * 3 + 1] = this.a.y;
      this.projected[i * 3 + 2] = this.a.depth + depthBias;
    }
    for (let i = 1; i < count - 1; i++) this.triangle(0, i * 3, (i + 1) * 3, colour);
  }

  /** Screen-plane silhouette drawn around a physical local point. */
  stamp(x: number, y: number, z: number, outline: readonly number[], colour: number, scaleX = 1, scaleY = 1, bias = .1): void {
    this.project(x, y, z, this.a);
    const count = outline.length / 2;
    for (let i = 0; i < count; i++) {
      this.projected[i * 3] = this.a.x + outline[i * 2]! * scaleX;
      this.projected[i * 3 + 1] = this.a.y + outline[i * 2 + 1]! * scaleY;
      this.projected[i * 3 + 2] = this.a.depth + bias;
    }
    for (let i = 1; i < count - 1; i++) this.triangle(0, i * 3, (i + 1) * 3, colour);
  }

  line(ax: number, ay: number, az: number, bx: number, by: number, bz: number, width: number, colour: number, bias = .15): void {
    this.project(ax, ay, az, this.a); this.project(bx, by, bz, this.b);
    const dx = this.b.x - this.a.x, dy = this.b.y - this.a.y;
    const length = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    const size = Math.max(1, Math.round(width / ACTOR_PIXEL_SIZE)), offset = Math.floor(size / 2);
    for (let at = 0; at <= length; at++) {
      const t = at / length, px = Math.round(this.a.x + dx * t), py = Math.round(this.a.y + dy * t);
      const depth = this.a.depth + (this.b.depth - this.a.depth) * t + bias;
      for (let y = py - offset; y < py - offset + size; y++)
        for (let x = px - offset; x < px - offset + size; x++) this.put(x, y, depth, colour);
    }
  }

  point(x: number, y: number, z: number, width: number, colour: number, bias = .2): void {
    this.line(x, y, z, x, y, z, width, colour, bias);
  }

  finish(brightness = 1): void {
    this.material.color.setScalar(brightness);
    this.texture.needsUpdate = true; this.depthTexture.needsUpdate = true;
  }

  private triangle(a: number, b: number, c: number, colour: number): void {
    const v = this.projected;
    const ax = v[a]!, ay = v[a + 1]!, az = v[a + 2]!;
    const bx = v[b]!, by = v[b + 1]!, bz = v[b + 2]!;
    const cx = v[c]!, cy = v[c + 1]!, cz = v[c + 2]!;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < .001) return;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(this.width - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(this.height - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + .5, py = y + .5;
      const wb = ((px - ax) * (cy - ay) - (py - ay) * (cx - ax)) / area;
      const wc = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area;
      const wa = 1 - wb - wc;
      if (wa >= -.0001 && wb >= -.0001 && wc >= -.0001) this.put(x, y, wa * az + wb * bz + wc * cz, colour);
    }
  }

  private put(x: number, y: number, depth: number, colour: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = y * this.width + x;
    if (depth < this.depth[index]! - .001) return;
    this.depth[index] = depth;
    const at = index * 4;
    this.rgba[at] = colour >>> 16 & 255; this.rgba[at + 1] = colour >>> 8 & 255;
    this.rgba[at + 2] = colour & 255; this.rgba[at + 3] = 255;
  }
}

/** A sparse contact mark lies on the floor, never a lit rectangular sprite. */
export function createActorContactShadow(width: number, length: number): THREE.Mesh {
  const size = 32, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - 15.5) / 14, dy = (y - 15) / 11;
    const edge = dx * dx + dy * dy;
    if (edge > 1 || edge > .8 && (x + y * 3) % 5 === 0) continue;
    const at = (y * size + x) * 4;
    bytes[at] = 7; bytes[at + 1] = 13; bytes[at + 2] = 15; bytes[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .42,
    alphaTest: .01, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .2; mesh.name = 'pixel-contact-shadow';
  return mesh;
}
