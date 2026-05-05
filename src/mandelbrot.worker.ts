export type SetType = 'mandelbrot' | 'burning-ship' | 'tricorn' | 'julia';

type RenderRequest = {
  renderId:      number;
  width:         number;
  height:        number;
  xMin:          number;
  xMax:          number;
  yMin:          number;
  yMax:          number;
  maxIterations: number;
  setType:       SetType;
  juliaCx:       number;
  juliaCy:       number;
};

function smoothEscape(i: number, zx: number, zy: number): number {
  return Math.max(0, i - Math.log(Math.log(Math.sqrt(zx * zx + zy * zy))) / Math.LN2);
}

function mandelbrot(cx: number, cy: number, maxIter: number): number {
  let zx = 0, zy = 0;
  for (let i = 0; i < maxIter; i++) {
    const zx2 = zx * zx, zy2 = zy * zy;
    if (zx2 + zy2 > 4) return smoothEscape(i, zx, zy);
    zy = 2 * zx * zy + cy;
    zx = zx2 - zy2 + cx;
  }
  return maxIter;
}

// z → (|Re z| + i|Im z|)² + c
function burningShip(cx: number, cy: number, maxIter: number): number {
  let zx = 0, zy = 0;
  for (let i = 0; i < maxIter; i++) {
    const zx2 = zx * zx, zy2 = zy * zy;
    if (zx2 + zy2 > 4) return smoothEscape(i, zx, zy);
    zy = 2 * Math.abs(zx) * Math.abs(zy) + cy;
    zx = zx2 - zy2 + cx;
  }
  return maxIter;
}

// z → conj(z)² + c
function tricorn(cx: number, cy: number, maxIter: number): number {
  let zx = 0, zy = 0;
  for (let i = 0; i < maxIter; i++) {
    const zx2 = zx * zx, zy2 = zy * zy;
    if (zx2 + zy2 > 4) return smoothEscape(i, zx, zy);
    zy = -2 * zx * zy + cy;   // negated vs Mandelbrot
    zx = zx2 - zy2 + cx;
  }
  return maxIter;
}

// z₀ = pixel position, c = fixed parameter
function julia(px: number, py: number, jcx: number, jcy: number, maxIter: number): number {
  let zx = px, zy = py;
  for (let i = 0; i < maxIter; i++) {
    const zx2 = zx * zx, zy2 = zy * zy;
    if (zx2 + zy2 > 4) return smoothEscape(i, zx, zy);
    zy = 2 * zx * zy + jcy;
    zx = zx2 - zy2 + jcx;
  }
  return maxIter;
}

// Pre-computed cosine colour palette — three RGB waves offset by 120°
const PALETTE_SIZE = 2048;
const palette = new Uint8Array(PALETTE_SIZE * 3);
for (let i = 0; i < PALETTE_SIZE; i++) {
  const t = i / PALETTE_SIZE;
  palette[i * 3]     = Math.floor(128 + 127 * Math.cos(2 * Math.PI * (t)));
  palette[i * 3 + 1] = Math.floor(128 + 127 * Math.cos(2 * Math.PI * (t + 0.33)));
  palette[i * 3 + 2] = Math.floor(128 + 127 * Math.cos(2 * Math.PI * (t + 0.67)));
}

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const { renderId, width, height, xMin, xMax, yMin, yMax,
          maxIterations, setType, juliaCx, juliaCy } = e.data;

  const pixels = new Uint8ClampedArray(width * height * 4);
  const xScale = (xMax - xMin) / width;
  const yScale = (yMax - yMin) / height;

  for (let py = 0; py < height; py++) {
    const cy = yMin + py * yScale;
    for (let px = 0; px < width; px++) {
      const cx = xMin + px * xScale;

      let v: number;
      switch (setType) {
        case 'burning-ship': v = burningShip(cx, cy, maxIterations); break;
        case 'tricorn':      v = tricorn(cx, cy, maxIterations);      break;
        case 'julia':        v = julia(cx, cy, juliaCx, juliaCy, maxIterations); break;
        default:             v = mandelbrot(cx, cy, maxIterations);   break;
      }

      const idx = (py * width + px) * 4;
      if (v >= maxIterations) {
        pixels[idx + 3] = 255; // black, RGB default 0
      } else {
        const t   = (v * 8) % PALETTE_SIZE;
        const ti  = Math.floor(t);
        const tf  = t - ti;
        const ti2 = (ti + 1) % PALETTE_SIZE;
        pixels[idx]     = Math.floor(palette[ti * 3]     + tf * (palette[ti2 * 3]     - palette[ti * 3]));
        pixels[idx + 1] = Math.floor(palette[ti * 3 + 1] + tf * (palette[ti2 * 3 + 1] - palette[ti * 3 + 1]));
        pixels[idx + 2] = Math.floor(palette[ti * 3 + 2] + tf * (palette[ti2 * 3 + 2] - palette[ti * 3 + 2]));
        pixels[idx + 3] = 255;
      }
    }
  }

  self.postMessage({ renderId, pixels, width, height }, [pixels.buffer]);
};
