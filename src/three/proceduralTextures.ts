import * as THREE from 'three';

export interface ProceduralTextureSet {
  sandColor: THREE.CanvasTexture;
  sandNormal: THREE.CanvasTexture;
  palmBark: THREE.CanvasTexture;
  palmFrond: THREE.CanvasTexture;
  rockColor: THREE.CanvasTexture;
  foamNoise: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  dispose: () => void;
}

function createNoiseCanvas(size: number, drawFn: (ctx: CanvasRenderingContext2D, size: number) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  drawFn(ctx, size);
  return canvas;
}

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const a = hash2D(x0, y0);
  const b = hash2D(x1, y0);
  const c = hash2D(x0, y1);
  const d = hash2D(x1, y1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbmTileable(u: number, v: number, baseFreq: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(u * freq, v * freq, freq);
    freq *= 2;
    amp *= 0.5;
  }
  return sum;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Tropical Sand Color + Normal
  const sandSize = 256;
  const sandCanvas = createNoiseCanvas(sandSize, (ctx, size) => {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const macro = fbmTileable(u, v, 4, 3);
        const grain = hash2D(x * 1.37, y * 1.91);
        const ripple = Math.sin(v * Math.PI * 16 + macro * 2.5) * 0.5 + 0.5;
        const shade = 0.86 + macro * 0.1 + (grain - 0.5) * 0.08 + ripple * 0.03;

        const idx = (y * size + x) * 4;
        img.data[idx] = Math.min(255, Math.floor(228 * shade));
        img.data[idx + 1] = Math.min(255, Math.floor(211 * shade));
        img.data[idx + 2] = Math.min(255, Math.floor(182 * shade));
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const sandColor = new THREE.CanvasTexture(sandCanvas);
  sandColor.wrapS = THREE.RepeatWrapping;
  sandColor.wrapT = THREE.RepeatWrapping;
  sandColor.repeat.set(16, 16);
  sandColor.colorSpace = THREE.SRGBColorSpace;
  sandColor.anisotropy = maxAnisotropy;

  const sandNormalCanvas = createNoiseCanvas(sandSize, (ctx, size) => {
    const heights = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const ripple = Math.sin(v * Math.PI * 16 + fbmTileable(u, v, 4, 2) * 3.0) * 0.35;
        const grain = (hash2D(x * 1.7, y * 2.3) - 0.5) * 0.45;
        heights[y * size + x] = ripple + grain;
      }
    }
    const img = ctx.createImageData(size, size);
    const strength = 2.2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;
        const ym = (y - 1 + size) % size;
        const yp = (y + 1) % size;
        const dx = (heights[y * size + xp] - heights[y * size + xm]) * strength;
        const dy = (heights[yp * size + x] - heights[ym * size + x]) * strength;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const nx = (-dx / len) * 0.5 + 0.5;
        const ny = (-dy / len) * 0.5 + 0.5;
        const nz = (1 / len) * 0.5 + 0.5;
        const idx = (y * size + x) * 4;
        img.data[idx] = Math.floor(nx * 255);
        img.data[idx + 1] = Math.floor(ny * 255);
        img.data[idx + 2] = Math.floor(nz * 255);
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const sandNormal = new THREE.CanvasTexture(sandNormalCanvas);
  sandNormal.wrapS = THREE.RepeatWrapping;
  sandNormal.wrapT = THREE.RepeatWrapping;
  sandNormal.repeat.set(16, 16);
  sandNormal.anisotropy = maxAnisotropy;

  // 2. Palm Bark Ringed Texture
  const barkCanvas = createNoiseCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#5c4b3b';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 12) {
      const ringTone = 55 + Math.floor(Math.random() * 20);
      ctx.fillStyle = `rgb(${ringTone + 22}, ${ringTone + 10}, ${ringTone})`;
      ctx.fillRect(0, y, size, 4);
      ctx.fillStyle = `rgba(30, 22, 16, 0.35)`;
      ctx.fillRect(0, y + 4, size, 2);
    }
    for (let i = 0; i < 600; i++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      ctx.fillStyle = `rgba(40, 32, 24, 0.25)`;
      ctx.fillRect(rx, ry, 2, 6);
    }
  });
  const palmBark = new THREE.CanvasTexture(barkCanvas);
  palmBark.wrapS = THREE.RepeatWrapping;
  palmBark.wrapT = THREE.RepeatWrapping;
  palmBark.repeat.set(1, 5);
  palmBark.colorSpace = THREE.SRGBColorSpace;
  palmBark.anisotropy = maxAnisotropy;

  // 3. Palm Frond Feather Leaflet Texture (with transparent cutout)
  const frondCanvas = createNoiseCanvas(256, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    const centerX = size * 0.5;
    // Central rachis stem
    ctx.strokeStyle = '#5f7a38';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, size);
    ctx.stroke();

    // Feather leaflets
    const leafletCount = 28;
    for (let i = 1; i < leafletCount; i++) {
      const t = i / leafletCount;
      const y = t * size;
      const span = Math.sin(t * Math.PI) * (size * 0.46) + 8;
      const droop = 10 + t * 14;
      const greenShift = Math.floor(t * 18);

      for (const side of [-1, 1]) {
        ctx.fillStyle = `rgb(${48 + greenShift}, ${88 + greenShift}, ${36})`;
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.quadraticCurveTo(
          centerX + side * span * 0.55,
          y - 2,
          centerX + side * span,
          y + droop
        );
        ctx.quadraticCurveTo(
          centerX + side * span * 0.5,
          y + 6,
          centerX,
          y + 5
        );
        ctx.closePath();
        ctx.fill();
      }
    }
  });
  const palmFrond = new THREE.CanvasTexture(frondCanvas);
  palmFrond.colorSpace = THREE.SRGBColorSpace;
  palmFrond.anisotropy = maxAnisotropy;

  // 4. Coastal Basalt Rock Texture
  const rockCanvas = createNoiseCanvas(256, (ctx, size) => {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n1 = fbmTileable(u, v, 4, 4);
        const n2 = fbmTileable(u + 0.3, v + 0.7, 16, 2);
        const val = 0.25 + n1 * 0.28 + n2 * 0.14;
        const idx = (y * size + x) * 4;
        img.data[idx] = Math.floor(val * 128);
        img.data[idx + 1] = Math.floor(val * 124);
        img.data[idx + 2] = Math.floor(val * 118);
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const rockColor = new THREE.CanvasTexture(rockCanvas);
  rockColor.wrapS = THREE.RepeatWrapping;
  rockColor.wrapT = THREE.RepeatWrapping;
  rockColor.repeat.set(3, 3);
  rockColor.colorSpace = THREE.SRGBColorSpace;
  rockColor.anisotropy = maxAnisotropy;

  // 5. Cellular Whitewater Foam Texture
  const foamCanvas = createNoiseCanvas(256, (ctx, size) => {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const f1 = fbmTileable(u, v, 8, 4);
        const f2 = fbmTileable(u * 2.0 + 0.4, v * 2.0 + 0.1, 16, 3);
        const lace = Math.max(0, 1.0 - Math.abs(f1 - 0.52) * 5.0);
        const bubbles = Math.max(0, f2 - 0.35) * 1.5;
        const val = Math.min(1, Math.max(0, lace * 0.65 + bubbles * 0.7));
        const c = Math.floor(val * 255);
        const idx = (y * size + x) * 4;
        img.data[idx] = c;
        img.data[idx + 1] = c;
        img.data[idx + 2] = c;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const foamNoise = new THREE.CanvasTexture(foamCanvas);
  foamNoise.wrapS = THREE.RepeatWrapping;
  foamNoise.wrapT = THREE.RepeatWrapping;
  foamNoise.anisotropy = maxAnisotropy;

  // 6. Seamless Water Capillary Normal Map
  const waterNormCanvas = createNoiseCanvas(256, (ctx, size) => {
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        h[y * size + x] = fbmTileable(u, v, 8, 4);
      }
    }
    const img = ctx.createImageData(size, size);
    const s = 3.6;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;
        const ym = (y - 1 + size) % size;
        const yp = (y + 1) % size;
        const dx = (h[y * size + xp] - h[y * size + xm]) * s;
        const dy = (h[yp * size + x] - h[ym * size + x]) * s;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const idx = (y * size + x) * 4;
        img.data[idx] = Math.floor(((-dx / len) * 0.5 + 0.5) * 255);
        img.data[idx + 1] = Math.floor(((-dy / len) * 0.5 + 0.5) * 255);
        img.data[idx + 2] = Math.floor(((1 / len) * 0.5 + 0.5) * 255);
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const waterNormal = new THREE.CanvasTexture(waterNormCanvas);
  waterNormal.wrapS = THREE.RepeatWrapping;
  waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.anisotropy = maxAnisotropy;

  return {
    sandColor,
    sandNormal,
    palmBark,
    palmFrond,
    rockColor,
    foamNoise,
    waterNormal,
    dispose: () => {
      sandColor.dispose();
      sandNormal.dispose();
      palmBark.dispose();
      palmFrond.dispose();
      rockColor.dispose();
      foamNoise.dispose();
      waterNormal.dispose();
    },
  };
}
