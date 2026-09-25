/** Fixed-camera environmental motion. Every coloured lighting change consumes
 * the renderer's actual, occluded contribution; this never relights flat screen
 * circles or displaces the approved architectural pixels. */
export interface HavenMotionImages {
  /** haven-energy-base.png: the lit scene before core volume compositing. */
  scene: HTMLImageElement;
  pollution: HTMLImageElement;
  /** Core lighting is already contained in pollution; never add it twice. */
  coreLight: HTMLImageElement;
  furnace: HTMLImageElement;
  shoulder: HTMLImageElement;
  motion: HTMLImageElement;
  depth: HTMLImageElement;
  /** Data atlas. ImageBitmap inputs must use imageOrientation: 'flipY',
   * premultiplyAlpha: 'none' and colorSpaceConversion: 'none'. */
  energy: HTMLImageElement | ImageBitmap;
}

export interface HavenMotion {
  readonly canvas: HTMLCanvasElement;
  draw(seconds: number, options?: { coreLighting?: boolean }): void;
  dispose(): void;
}

/** Includes the first deep silhouette crossing at eight seconds. */
export const HAVEN_MOTION_REVIEW_TIMES = [0, 4, 8, 12] as const;

const WIDTH = 960;
const HEIGHT = 640;
const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uPollution;
uniform sampler2D uFurnace;
uniform sampler2D uShoulder;
uniform sampler2D uMotion;
uniform sampler2D uDepth;
uniform sampler2D uEnergy;
uniform sampler2D uCoreLight;
uniform float uSeconds;
uniform float uCoreLighting;
varying vec2 vUv;

vec4 energyFrame(vec2 uv, float frame) {
  // The PNG stores frame 0 in its TOP-left tile; all uploads use flipped Y.
  vec2 tile = vec2(mod(frame, 4.0), 1.0 - floor(frame / 4.0));
  return texture2D(uEnergy, (tile + uv) / vec2(4.0, 2.0));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
float cloud(vec2 p) {
  return noise(p) * 0.7 + noise(p * 2.03 + vec2(8.1, 2.7)) * 0.3;
}
float pulse(float time, float phase) {
  return 0.105 * sin(time * 0.61 + phase)
       + 0.038 * sin(time * 0.213 + phase * 1.73);
}
float coreExpansion(float time) {
  float cycle = mod(time / 4.8, 1.0);
  return cycle < 0.7
    ? (1.0 - cos(3.14159265359 * cycle / 0.7)) * 0.5
    : (1.0 + cos(3.14159265359 * (cycle - 0.7) / 0.3)) * 0.5;
}
float fire(float time) {
  return 0.072 * sin(time * 4.31) + 0.035 * sin(time * 11.73)
       + 0.019 * sin(time * 19.19)
       + 0.043 * (noise(vec2(time * 2.9, 18.6)) - noise(vec2(0.0, 18.6)));
}
float intrusion(vec2 pixel, float time, float layer, float objectId,
                float encodedDepth, float geometryDepth) {
  // The contour is bigger than its viewing aperture. No face, eyes, or complete
  // creature silhouette is supplied: the masonry briefly hides an unplaceable
  // passing mass in space, then only the air remains.
  float cycle = floor(time / 23.0);
  float clock = mod(time, 23.0);
  float life = smoothstep(5.4, 6.5, clock) * (1.0 - smoothstep(8.85, 10.1, clock));
  if (life <= 0.0 || layer > 1.5 || objectId > 0.5) return 0.0;
  float alternate = mod(cycle, 2.0);
  vec2 center = mix(vec2(239.0, 142.0), vec2(609.0, 200.0), alternate);
  vec2 size = mix(vec2(130.0, 106.0), vec2(114.0, 79.0), alternate);
  float entityDepth = mix(-18.2, -16.7, alternate);
  // Larger camera depth is closer. Empty pixels pass; every intervening wall,
  // even a far-layer wall, occludes the shape according to actual depth.
  float visibility = encodedDepth < 0.5 ? 1.0 :
    1.0 - smoothstep(entityDepth - 0.35, entityDepth + 0.1, geometryDepth);
  vec2 q = pixel - center;
  float aperture = 1.0 - smoothstep(0.56, 1.0, length(q / size));
  float drift = (clock - 7.7) * 27.0;
  float curve = 0.0026 * q.x * q.x + q.x * 0.19
              + sin(q.x * 0.024 + time * 0.19) * 8.5 - 22.0 + drift;
  float contour = q.y - curve;
  float mass = smoothstep(-1.6, 2.1, contour)
             * (1.0 - smoothstep(48.0, 93.0, contour));
  // A second unequal fold joins the main edge rather than repeating tentacles.
  float fold = q.y - (q.x * -0.24 + 0.0033 * (q.x + 34.0) * (q.x + 34.0)
             + drift + 43.0);
  float lobe = smoothstep(-2.0, 1.5, fold)
             * (1.0 - smoothstep(10.0, 36.0, fold)) * 0.55;
  return max(mass, lobe) * aperture * visibility * life;
}

void main() {
  vec2 pixel = floor(vec2(vUv.x, 1.0 - vUv.y) * vec2(960.0, 640.0)) + 0.5;
  vec2 uv = vec2(pixel.x / 960.0, 1.0 - pixel.y / 640.0);
  vec3 base = texture2D(uScene, uv).rgb;
  vec3 pollution = texture2D(uPollution, uv).rgb;
  vec3 coreLight = texture2D(uCoreLight, uv).rgb;
  vec3 otherPollution = max(pollution - coreLight, vec3(0.0));
  vec3 furnace = texture2D(uFurnace, uv).rgb;
  vec3 shoulder = texture2D(uShoulder, uv).rgb;
  vec4 data = texture2D(uMotion, uv);
  float layer = floor(data.r * 255.0 + 0.5);
  float objectId = floor(data.g * 255.0 + 0.5);
  float source = floor(data.b * 255.0 + 0.5);
  float time = uSeconds;
  // One changing source must have the same phase on its emitting body and all
  // receiving surfaces. Local erosion below may vary, but receiver IDs cannot
  // arbitrarily change the timing of physically shared illumination.
  float pollutionChange = pulse(time, 0.0) - pulse(0.0, 0.0);
  float coreChange = 0.22 * coreExpansion(time);
  float shoulderChange = 0.012 * sin(time * 1.71) + 0.005 * sin(time * 0.43);
  vec3 color = base + otherPollution * pollutionChange + coreLight * coreChange
                   + furnace * fire(time) + shoulder * shoulderChange;
  // The dynamic scene is the pre-volume base. Frame RGB is premultiplied
  // radiance plus additive halo; alpha is density, including zero-alpha halo.
  // Opaque geometry and shaded architectural pixels remain stationary.
  float energyPosition = mod(time / 4.8 * 8.0, 8.0);
  float energyIndex = floor(energyPosition);
  vec4 energyNow = mix(energyFrame(uv, energyIndex),
                       energyFrame(uv, mod(energyIndex + 1.0, 8.0)),
                       fract(energyPosition));

  if (source > 0.5 && source < 1.5 && (objectId < 0.5 || objectId > 1.5)) {
    // The slow constriction follows the material's authored world phase. It
    // leaves silhouette, stone, metal and neighbouring non-polluted pixels intact.
    float seed = data.a * 19.0 + pixel.y * 0.009;
    float now = smoothstep(0.64, 0.93, sin(seed - time * 0.31));
    float before = smoothstep(0.64, 0.93, sin(seed));
    color -= otherPollution * ((now - before) * 0.058);
  }

  if (layer < 3.5 && objectId < 0.5) {
    // Two differently scaled air movements. They diminish in front of real
    // surfaces; neither paints an atmospheric veil across the playable haven.
    float presence = layer < 0.5 ? 1.0 : layer < 1.5 ? 0.45 : layer < 2.5 ? 0.14 : 0.035;
    vec2 p = pixel * vec2(0.0067, 0.0048);
    float air = cloud(p + vec2(time * 0.007, -time * 0.009)) - cloud(p);
    vec2 p2 = p * vec2(0.38, 1.7) + vec2(9.4, 3.8);
    air += (noise(p2 + vec2(-time * 0.0023, -time * 0.006)) - noise(p2)) * 0.5;
    color += vec3(0.005, 0.006, 0.006) * air * presence;
  }

  // Core lighting illuminates the receiving scene before volume absorption.
  // Only that field is hidden; the volume's own radiance remains unchanged.
  color -= coreLight * (1.0 + coreChange) * (1.0 - uCoreLighting);
  color = color * (1.0 - energyNow.a) + energyNow.rgb * (1.0 + coreChange);
  vec2 encoded = floor(texture2D(uDepth, uv).rg * 255.0 + 0.5);
  float encodedDepth = encoded.x * 256.0 + encoded.y;
  float depth = encodedDepth / 256.0 - 80.0;
  float shadow = intrusion(pixel, time, layer, objectId, encodedDepth, depth);
  color *= 1.0 - shadow * 0.30;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

export function createHavenMotion(images: HavenMotionImages): HavenMotion {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error('Haven environmental motion requires WebGL 1; use the static scene.');

  const shaders: WebGLShader[] = [];
  const textures: WebGLTexture[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const texture of textures) gl.deleteTexture(texture);
    for (const shader of shaders) gl.deleteShader(shader);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
  };

  try {
    const compile = (kind: number, source: string): WebGLShader => {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('Unable to allocate haven motion shader.');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`Haven motion shader failed: ${gl.getShaderInfoLog(shader) ?? 'unknown compile error'}`);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    program = gl.createProgram();
    if (!program) throw new Error('Unable to allocate haven motion program.');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Haven motion link failed: ${gl.getProgramInfoLog(program) ?? 'unknown link error'}`);
    }
    gl.useProgram(program);
    buffer = gl.createBuffer();
    if (!buffer) throw new Error('Unable to allocate haven motion geometry.');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    const inputs: readonly (readonly [string, HTMLImageElement | ImageBitmap])[] = [
      ['uScene', images.scene], ['uPollution', images.pollution], ['uFurnace', images.furnace],
      ['uShoulder', images.shoulder], ['uMotion', images.motion], ['uDepth', images.depth],
      ['uEnergy', images.energy],
      ['uCoreLight', images.coreLight],
    ];
    for (const [unit, [name, image]] of inputs.entries()) {
      const expectedWidth = name === 'uEnergy' ? WIDTH * 4 : WIDTH;
      const expectedHeight = name === 'uEnergy' ? HEIGHT * 2 : HEIGHT;
      const imageWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
      const imageHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
      if ((image instanceof HTMLImageElement && !image.complete) || imageWidth !== expectedWidth || imageHeight !== expectedHeight) {
        throw new Error(`Haven motion ${name} must be a loaded ${expectedWidth} × ${expectedHeight} image.`);
      }
      if (Math.max(expectedWidth, expectedHeight) > Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))) {
        throw new Error(`Haven motion ${name} exceeds this device's texture limit; use the static scene.`);
      }
      const texture = gl.createTexture();
      if (!texture) throw new Error(`Unable to allocate haven motion texture ${name}.`);
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.uniform1i(gl.getUniformLocation(program, name), unit);
    }
    const secondsUniform = gl.getUniformLocation(program, 'uSeconds');
    const coreLightingUniform = gl.getUniformLocation(program, 'uCoreLighting');
    gl.disable(gl.BLEND);
    gl.disable(gl.DITHER);
    gl.viewport(0, 0, WIDTH, HEIGHT);
    const draw = (seconds: number, options: { coreLighting?: boolean } = {}): void => {
      if (disposed) throw new Error('Haven motion has already been disposed.');
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Haven motion time must be finite and non-negative.');
      if (gl.isContextLost()) throw new Error('Haven motion WebGL context was lost; use the static scene.');
      gl.useProgram(program);
      gl.uniform1f(secondsUniform, seconds);
      gl.uniform1f(coreLightingUniform, options.coreLighting === false ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    draw(0);
    return { canvas, draw, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
