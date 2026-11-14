"use client";

import { useEffect, useRef } from "react";
import { ASSETS } from "@/data/landingData";

// Past Drop V1's nearest-filtered displacement grid, applied to the hero artwork.
const GRID = 120;
const RADIUS = GRID * 0.065;
const RELAXATION = 0.9;

const VERTEX_SHADER = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D earth;
uniform sampler2D foreground;
uniform sampler2D displacement;
uniform vec2 viewport;
uniform vec2 earthSize;
uniform vec2 foregroundSize;
uniform float breath;
in vec2 vUv;
out vec4 color;

vec2 cover(vec2 uv, vec2 imageSize, float alignY) {
  float scale = max(viewport.x / imageSize.x, viewport.y / imageSize.y);
  vec2 visible = viewport / (imageSize * scale);
  return uv * visible + (1.0 - visible) * vec2(0.5, alignY);
}

void main() {
  vec2 offset = texture(displacement, vUv).rg;
  vec2 uv = clamp(vUv - 0.02 * offset, 0.0, 1.0);
  // Match the existing Earth breathing transform and object-position settings.
  vec2 anchor = vec2(725.8 / viewport.x, 1.0 - 549.1 / viewport.y);
  vec2 earthUv = (uv - anchor) / breath + anchor;
  vec4 sky = texture(earth, cover(earthUv, earthSize, 1.0));
  vec4 astronaut = texture(foreground, cover(uv, foregroundSize, 0.0));
  color = vec4(mix(sky.rgb, astronaut.rgb, astronaut.a), 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Hero shader unavailable");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error("Hero shader compilation failed");
  }
  return shader;
}

export function HeroPixelHover() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const imageLayer = canvas?.parentElement;
    const hero = canvas?.closest("section");
    if (!canvas || !imageLayer || !hero) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stop = () => {};

    const start = () => {
      stop();
      if (preference.matches) return;
      const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
      if (!gl) return;

      let disposed = false;
      let ready = false;
      let visible = true;
      let frame = 0;
      let previousTime = 0;
      let energy = 0;
      let width = 1;
      let height = 1;
      const mouse = { x: 0.5, y: 0.5, prevX: 0.5, prevY: 0.5, vX: 0, vY: 0 };
      const data = new Float32Array(GRID * GRID * 4);
      const textures: WebGLTexture[] = [];
      const shaders: WebGLShader[] = [];
      const images: HTMLImageElement[] = [];
      const program = gl.createProgram();
      const buffer = gl.createBuffer();
      if (!program || !buffer) {
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
        return;
      }

      const resize = () => {
        width = imageLayer.clientWidth;
        height = imageLayer.clientHeight;
        const dpr = Math.min(window.devicePixelRatio, 2);
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(gl.getUniformLocation(program, "viewport"), width, height);
      };

      const updateGrid = (delta: number) => {
        const decay = Math.pow(RELAXATION, delta);
        const gx = mouse.x * GRID;
        const gy = mouse.y * GRID;
        energy = 0;
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            const i = (x + y * GRID) * 4;
            data[i] *= decay;
            data[i + 1] *= decay;
            const distance = (gx - x) ** 2 / (height / width) + (gy - y) ** 2;
            if (distance < RADIUS * RADIUS) {
              const power = Math.min(RADIUS / Math.sqrt(Math.max(distance, 0.0001)), 10);
              data[i] += 100 * mouse.vX * power * delta;
              data[i + 1] -= 100 * mouse.vY * power * delta;
            }
            energy = Math.max(energy, Math.abs(data[i]), Math.abs(data[i + 1]));
          }
        }
        mouse.vX *= decay;
        mouse.vY *= decay;
        if (energy < 0.0001 && Math.abs(mouse.vX) + Math.abs(mouse.vY) < 0.00001) {
          data.fill(0);
          mouse.vX = mouse.vY = energy = 0;
          canvas.dataset.pixelActive = "false";
        }
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, textures[2]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID, GRID, gl.RGBA, gl.FLOAT, data);
      };

      const render = (time: number) => {
        frame = 0;
        if (disposed || !visible || document.hidden || !ready) return;
        // Keep pointer interaction fluid; the slow idle breath needs fewer GPU draws.
        const interval = energy || mouse.vX || mouse.vY ? 1000 / 60 : 1000 / 30;
        if (previousTime && time - previousTime < interval - 1) {
          frame = requestAnimationFrame(render);
          return;
        }
        const delta = previousTime ? Math.min((time - previousTime) / (1000 / 60), 4) : 1;
        previousTime = time;
        gl.useProgram(program);
        if (energy || mouse.vX || mouse.vY) updateGrid(delta);
        const breath = 1 + 0.03 * (0.5 - 0.5 * Math.cos(time * Math.PI / 9000));
        gl.uniform1f(gl.getUniformLocation(program, "breath"), breath);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        frame = requestAnimationFrame(render);
      };

      const wake = () => {
        previousTime = 0;
        if (!frame && ready && visible && !document.hidden) frame = requestAnimationFrame(render);
      };
      const position = (event: PointerEvent) => {
        const rect = imageLayer.getBoundingClientRect();
        return { x: (event.clientX - rect.left) / rect.width,
          y: 1 - (event.clientY - rect.top) / rect.height };
      };
      const enter = (event: PointerEvent) => {
        const point = position(event);
        mouse.prevX = point.x;
        mouse.prevY = point.y;
      };
      const move = (event: PointerEvent) => {
        const point = position(event);
        mouse.x = point.x;
        mouse.y = point.y;
        mouse.vX = point.x - mouse.prevX;
        mouse.vY = point.y - mouse.prevY;
        mouse.prevX = point.x;
        mouse.prevY = point.y;
        canvas.dataset.pixelActive = "true";
        wake();
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        stop();
        canvas.addEventListener("webglcontextrestored", contextRestored, { once: true });
      };
      const contextRestored = () => start();
      const resizeObserver = new ResizeObserver(() => {
        if (ready) { gl.useProgram(program); resize(); wake(); }
      });
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) wake();
      });

      stop = () => {
        disposed = true;
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        observer.disconnect();
        hero.removeEventListener("pointerenter", enter);
        hero.removeEventListener("pointermove", move);
        document.removeEventListener("visibilitychange", wake);
        canvas.removeEventListener("webglcontextlost", contextLost);
        canvas.removeEventListener("webglcontextrestored", contextRestored);
        images.forEach(image => { image.onload = null; image.onerror = null; });
        textures.forEach(texture => gl.deleteTexture(texture));
        shaders.forEach(shader => gl.deleteShader(shader));
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        delete imageLayer.dataset.pixelReady;
        delete canvas.dataset.pixelActive;
      };

      try {
        shaders.push(compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
        shaders.push(compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        shaders.forEach(shader => gl.attachShader(program, shader));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Hero shader link failed");
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const attribute = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
        ["earth", "foreground", "displacement"].forEach((name, unit) => {
          const texture = gl.createTexture();
          if (!texture) throw new Error("Hero texture unavailable");
          textures.push(texture);
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, unit === 2 ? gl.NEAREST : gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, unit === 2 ? gl.NEAREST : gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.uniform1i(gl.getUniformLocation(program, name), unit);
        });
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, GRID, GRID, 0, gl.RGBA, gl.FLOAT, data);
        let loaded = 0;
        [ASSETS.heroEarthSky, ASSETS.heroForegroundAstronaut].forEach((src, unit) => {
          const image = new Image();
          images.push(image);
          image.onload = () => {
            if (disposed) return;
            gl.useProgram(program);
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, textures[unit]);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.uniform2f(gl.getUniformLocation(program, unit === 0 ? "earthSize" : "foregroundSize"), image.naturalWidth, image.naturalHeight);
            if (++loaded !== 2) return;
            ready = true;
            resize();
            imageLayer.dataset.pixelReady = "true";
            canvas.dataset.pixelActive = "false";
            resizeObserver.observe(imageLayer);
            observer.observe(hero);
            wake();
          };
          image.onerror = () => stop();
          image.src = src;
        });
        hero.addEventListener("pointerenter", enter);
        hero.addEventListener("pointermove", move, { passive: true });
        document.addEventListener("visibilitychange", wake);
        canvas.addEventListener("webglcontextlost", contextLost);
        canvas.addEventListener("webglcontextrestored", contextRestored);
      } catch {
        stop(); // Keep the existing hero images if WebGL cannot initialize.
      }
    };

    start();
    preference.addEventListener("change", start);
    return () => { stop(); preference.removeEventListener("change", start); };
  }, []);

  return <canvas ref={canvasRef} className="hero-pixel-hover" aria-hidden="true" />;
}
