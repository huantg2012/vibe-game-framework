import type { ActorRegion, Grade, Phase } from './background';
import { VeilMotion } from './veil-motion';
import { VEIL_FRAGMENT_SHADER, VEIL_VERTEX_SHADER } from './veil-shader';

export interface VeilTelemetry {
  readonly renderer: 'webgl2';
  readonly width: number;
  readonly height: number;
  readonly frameCount: number;
  readonly timeSeconds: number;
  readonly travelPixels: number;
  readonly targetGrade: Grade;
  readonly currentLevel: number;
  readonly trailLevel: number;
  readonly transitionActive: boolean;
  readonly transitionElapsedMs: number;
  readonly phase: Phase;
  readonly phaseSpeed: number;
  readonly motionEnabled: boolean;
  readonly visible: boolean;
  readonly documentVisible: boolean;
  readonly rafScheduled: boolean;
  readonly lastFrameMs: number;
  readonly lastDrawCpuMs: number;
  readonly contextLost: boolean;
  readonly disposed: boolean;
}

export interface VeilController {
  setActor(region: ActorRegion): void;
  setGrade(grade: Grade): void;
  setPhase(phase: Phase): void;
  setVisible(visible: boolean): void;
  setMotion(enabled: boolean): void;
  getTelemetry(): VeilTelemetry;
  dispose(): void;
}

/** Independent VFX study: transparent transported sheets above the reading veil.
 * No world pixels, DOM text or gameplay state are sampled or changed. WebGL is
 * required; a silent static fallback would conceal the method being evaluated.
 */
export function mountVeil(canvas: HTMLCanvasElement): VeilController {
  const width = 960, height = 640;
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('此动态遮罩样例需要 WebGL 2；当前环境无法运行，请换用支持 WebGL 2 的浏览器。');

  let vertex: WebGLShader | null = null;
  let fragment: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  let vertexArray: WebGLVertexArrayObject | null = null;
  function deleteGpuResources(): void {
    if (vertexArray) { gl!.deleteVertexArray(vertexArray); vertexArray = null; }
    if (program) { gl!.deleteProgram(program); program = null; }
    if (vertex) { gl!.deleteShader(vertex); vertex = null; }
    if (fragment) { gl!.deleteShader(fragment); fragment = null; }
  }
  function compile(type: number, source: string): WebGLShader {
    const shader = gl!.createShader(type);
    if (!shader) throw new Error('无法创建遮罩着色器。');
    gl!.shaderSource(shader, source);
    gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      const log = gl!.getShaderInfoLog(shader) ?? '未知编译错误';
      gl!.deleteShader(shader);
      throw new Error(`遮罩着色器编译失败：${log}`);
    }
    return shader;
  }
  try {
    vertex = compile(gl.VERTEX_SHADER, VEIL_VERTEX_SHADER);
    fragment = compile(gl.FRAGMENT_SHADER, VEIL_FRAGMENT_SHADER);
    program = gl.createProgram();
    if (!program) throw new Error('无法创建遮罩渲染程序。');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`遮罩程序链接失败：${gl.getProgramInfoLog(program) ?? '未知链接错误'}`);
    vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error('无法创建遮罩顶点对象。');
  } catch (error) {
    deleteGpuResources();
    throw error;
  }

  const resolutionUniform = gl.getUniformLocation(program, 'uResolution');
  const actorUniform = gl.getUniformLocation(program, 'uActor');
  const levelsUniform = gl.getUniformLocation(program, 'uLevels');
  const travelUniform = gl.getUniformLocation(program, 'uTravel');
  if (!resolutionUniform || !actorUniform || !levelsUniform || !travelUniform) {
    deleteGpuResources();
    throw new Error('遮罩着色器缺少必要参数。');
  }
  gl.useProgram(program);
  gl.bindVertexArray(vertexArray);
  gl.viewport(0, 0, width, height);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.uniform2f(resolutionUniform, width, height);
  // No actor opening until the actual renderer has reported its bounds.
  gl.uniform4f(actorUniform, -10000, -10000, 1, 1);

  const motion = new VeilMotion();
  const abort = new AbortController();
  let motionEnabled = false, visible = true, disposed = false, contextLost = false;
  let raf = 0;
  let previousTimestamp: number | undefined;
  let frameCount = 0, lastFrameMs = 0, lastDrawCpuMs = 0;
  let actorX = -10000, actorY = -10000, actorRadiusX = 1, actorRadiusY = 1;

  function canDraw(): boolean { return !disposed && !contextLost && visible && !document.hidden; }
  function shouldRun(): boolean { return canDraw() && motionEnabled; }
  function draw(): void {
    if (!canDraw()) return;
    const started = performance.now();
    gl!.useProgram(program);
    gl!.bindVertexArray(vertexArray);
    gl!.uniform2f(levelsUniform, motion.currentLevel, motion.trailLevel);
    gl!.uniform1f(travelUniform, motion.travelPixels);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    frameCount++;
    lastDrawCpuMs = performance.now() - started;
  }
  function stopFrames(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    previousTimestamp = undefined;
  }
  function tick(now: number): void {
    raf = 0;
    if (!shouldRun()) { previousTimestamp = undefined; return; }
    if (previousTimestamp !== undefined) {
      lastFrameMs = Math.max(0, now - previousTimestamp);
      // A delayed frame never jumps the sheet forward by a hidden/background gap.
      motion.advance(Math.min(0.05, lastFrameMs / 1000));
    }
    previousTimestamp = now;
    draw();
    raf = requestAnimationFrame(tick);
  }
  function syncFrames(): void {
    if (shouldRun()) {
      if (!raf) raf = requestAnimationFrame(tick);
    } else stopFrames();
  }
  function visibilityChanged(): void {
    if (document.hidden) stopFrames();
    else {
      draw();
      syncFrames();
    }
  }
  function reportContextError(message: string): void {
    contextLost = true;
    stopFrames();
    canvas.dataset.ready = 'false';
    canvas.dataset.error = message;
    canvas.dispatchEvent(new CustomEvent<Error>('veilerror', { detail: new Error(message) }));
  }
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    reportContextError('动态遮罩的 WebGL 上下文已丢失；请重新载入样例。');
  }, { signal: abort.signal });
  canvas.addEventListener('webglcontextrestored', () => {
    reportContextError('动态遮罩的 WebGL 上下文已恢复；请重新载入以重建资源。');
  }, { signal: abort.signal });
  document.addEventListener('visibilitychange', visibilityChanged, { signal: abort.signal });
  canvas.dataset.renderer = 'webgl2-transported-veil';
  canvas.dataset.ready = 'true';
  draw();

  return {
    setActor(region: ActorRegion): void {
      if (disposed || contextLost) return;
      const x = region.x + region.width / 2, y = region.y + region.height / 2;
      const radiusX = region.width / 2 + 22, radiusY = region.height / 2 + 20;
      if (x === actorX && y === actorY && radiusX === actorRadiusX && radiusY === actorRadiusY) return;
      actorX = x; actorY = y; actorRadiusX = radiusX; actorRadiusY = radiusY;
      gl.useProgram(program);
      gl.uniform4f(actorUniform, x, y, radiusX, radiusY);
      draw();
    },
    setGrade(grade: Grade): void {
      if (disposed || contextLost || !motion.setGrade(grade, motionEnabled)) return;
      // State is accepted now; the next frame transports the front from exactly
      // its present coverage. No reseeding, phase reset or queued transitions.
      draw();
      syncFrames();
    },
    setPhase(phase: Phase): void {
      if (disposed || contextLost || !motion.setPhase(phase)) return;
      if (!motionEnabled) motion.settle();
      syncFrames();
    },
    setVisible(next: boolean): void {
      if (disposed || visible === next) return;
      visible = next;
      if (next) draw();
      syncFrames();
    },
    setMotion(next: boolean): void {
      if (disposed || motionEnabled === next) return;
      motionEnabled = next;
      if (!next) { motion.settle(); draw(); }
      syncFrames();
    },
    getTelemetry(): VeilTelemetry {
      return Object.freeze({
        renderer: 'webgl2', width, height, frameCount,
        timeSeconds: motion.timeSeconds, travelPixels: motion.travelPixels,
        targetGrade: motion.targetGrade, currentLevel: motion.currentLevel,
        trailLevel: motion.trailLevel, transitionActive: motion.transitionActive,
        transitionElapsedMs: motion.transitionElapsedSeconds * 1000,
        phase: motion.phase, phaseSpeed: motion.phaseSpeed, motionEnabled, visible,
        documentVisible: !document.hidden, rafScheduled: raf !== 0,
        lastFrameMs, lastDrawCpuMs, contextLost, disposed,
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopFrames();
      abort.abort();
      deleteGpuResources();
      canvas.dataset.ready = 'false';
    },
  };
}
