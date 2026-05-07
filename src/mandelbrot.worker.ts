import Decimal from 'decimal.js';

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
  highPrecision: boolean;
  hpCenterRe:    string;
  hpCenterIm:    string;
  hpXRange:      number;
  hpYRange:      number;
  hpPrec:        number;
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
    zy = -2 * zx * zy + cy;
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

// Compute the reference orbit z_{n+1} = z_n² + c at arbitrary precision.
// z0 is the starting point, c is the parameter (c = center for Mandelbrot, julia c for Julia).
// Stores each orbit value as a double pair; the HP precision is only needed for accumulation.
function computeRefOrbit(
  z0ReStr: string, z0ImStr: string,
  cReStr:  string, cImStr:  string,
  maxIter: number, prec:    number
): { re: Float64Array; im: Float64Array; len: number } {
  Decimal.set({ precision: prec });

  const cRe = new Decimal(cReStr);
  const cIm = new Decimal(cImStr);
  const re  = new Float64Array(maxIter);
  const im  = new Float64Array(maxIter);

  let zRe = new Decimal(z0ReStr);
  let zIm = new Decimal(z0ImStr);
  let len = 0;

  for (let i = 0; i < maxIter; i++) {
    re[i] = zRe.toNumber();
    im[i] = zIm.toNumber();
    len = i + 1;

    const zRe2 = zRe.mul(zRe).minus(zIm.mul(zIm)).plus(cRe);
    const zIm2 = zRe.mul(zIm).mul(2).plus(cIm);

    if (zRe2.mul(zRe2).plus(zIm2.mul(zIm2)).gt(4)) break;

    zRe = zRe2;
    zIm = zIm2;
  }

  return { re, im, len };
}

// Perturbation theory for Mandelbrot: ε_{n+1} = 2·Z_n·ε_n + ε_n² + δ₀
// The reference orbit (Z_n) is cycled if it escaped before maxIter.
function perturbMandelbrot(
  refRe: Float64Array, refIm: Float64Array, refLen: number,
  dRe: number, dIm: number, maxIter: number
): number {
  let eRe = dRe, eIm = dIm;

  for (let i = 0; i < maxIter; i++) {
    const n   = i % refLen;
    const ZRe = refRe[n], ZIm = refIm[n];
    const WRe = ZRe + eRe, WIm = ZIm + eIm;

    if (WRe * WRe + WIm * WIm > 4) return smoothEscape(i, WRe, WIm);

    const newERe = 2 * (ZRe * eRe - ZIm * eIm) + (eRe * eRe - eIm * eIm) + dRe;
    const newEIm = 2 * (ZRe * eIm + ZIm * eRe) + 2 * eRe * eIm + dIm;
    eRe = newERe;
    eIm = newEIm;
  }
  return maxIter;
}

// Perturbation theory for Julia: ε_{n+1} = 2·Z_n·ε_n + ε_n²
// (c is fixed across all pixels, so it cancels in the perturbation derivation)
function perturbJulia(
  refRe: Float64Array, refIm: Float64Array, refLen: number,
  dRe: number, dIm: number, maxIter: number
): number {
  let eRe = dRe, eIm = dIm;

  for (let i = 0; i < maxIter; i++) {
    const n   = i % refLen;
    const ZRe = refRe[n], ZIm = refIm[n];
    const WRe = ZRe + eRe, WIm = ZIm + eIm;

    if (WRe * WRe + WIm * WIm > 4) return smoothEscape(i, WRe, WIm);

    const newERe = 2 * (ZRe * eRe - ZIm * eIm) + (eRe * eRe - eIm * eIm);
    const newEIm = 2 * (ZRe * eIm + ZIm * eRe) + 2 * eRe * eIm;
    eRe = newERe;
    eIm = newEIm;
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

function colorPixel(pixels: Uint8ClampedArray, idx: number, v: number, maxIterations: number) {
  if (v >= maxIterations) {
    pixels[idx + 3] = 255;
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

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const {
    renderId, width, height, xMin, xMax, yMin, yMax,
    maxIterations, setType, juliaCx, juliaCy,
    highPrecision, hpCenterRe, hpCenterIm, hpXRange, hpYRange, hpPrec,
  } = e.data;

  const pixels = new Uint8ClampedArray(width * height * 4);

  if (highPrecision && (setType === 'mandelbrot' || setType === 'julia')) {
    const dxPerPx = hpXRange / width;
    const dyPerPx = hpYRange / height;

    const refOrbit = setType === 'mandelbrot'
      ? computeRefOrbit('0', '0', hpCenterRe, hpCenterIm, maxIterations, hpPrec)
      : computeRefOrbit(hpCenterRe, hpCenterIm, juliaCx.toString(), juliaCy.toString(), maxIterations, hpPrec);

    const { re: refRe, im: refIm, len: refLen } = refOrbit;

    for (let py = 0; py < height; py++) {
      const dIm = (py - height / 2) * dyPerPx;
      for (let px = 0; px < width; px++) {
        const dRe = (px - width / 2) * dxPerPx;
        const v = setType === 'mandelbrot'
          ? perturbMandelbrot(refRe, refIm, refLen, dRe, dIm, maxIterations)
          : perturbJulia(refRe, refIm, refLen, dRe, dIm, maxIterations);
        colorPixel(pixels, (py * width + px) * 4, v, maxIterations);
      }
    }
  } else {
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
        colorPixel(pixels, (py * width + px) * 4, v, maxIterations);
      }
    }
  }

  self.postMessage({ renderId, pixels, width, height }, { transfer: [pixels.buffer] });
};
