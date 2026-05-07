import { useRef, useEffect, useState, useCallback } from 'react';
import Decimal from 'decimal.js';
import type { SetType } from './mandelbrot.worker';

export type { SetType };

export type Viewport = {
  xCenter: string;
  yCenter: string;
  xRange:  string;
};

type DragState = {
  startX:   number;
  startY:   number;
  currentX: number;
  currentY: number;
};

type WorkerResult = {
  renderId: number;
  pixels:   Uint8ClampedArray;
  width:    number;
  height:   number;
};

const MAX_ITERATIONS = 300;
const HP_THRESHOLD   = 1e-11;

function needsHP(xRange: string): boolean {
  return parseFloat(xRange) < HP_THRESHOLD;
}

function hpPrec(xRange: string): number {
  const depth = -Math.log10(parseFloat(xRange));
  return Math.max(30, Math.ceil(depth) + 20);
}

// AR-locked selection box so the dashed rectangle matches what will be rendered.
function constrainedBox(drag: DragState, canvasW: number, canvasH: number) {
  const ar   = canvasW / canvasH;
  const selW = Math.abs(drag.currentX - drag.startX);
  const selH = selW / ar;
  const xDir = drag.currentX >= drag.startX ? 1 : -1;
  const yDir = drag.currentY >= drag.startY ? 1 : -1;
  return {
    left:   xDir > 0 ? drag.startX        : drag.startX - selW,
    top:    yDir > 0 ? drag.startY        : drag.startY - selH,
    right:  xDir > 0 ? drag.startX + selW : drag.startX,
    bottom: yDir > 0 ? drag.startY + selH : drag.startY,
    width:  selW,
    height: selH,
  };
}

interface Props {
  viewport: Viewport;
  setType:  SetType;
  juliaCx:  number;
  juliaCy:  number;
  onZoom:   (v: Viewport) => void;
  onPick?:  (cx: number, cy: number) => void;
}

export function MandelbrotCanvas({ viewport, setType, juliaCx, juliaCy, onZoom, onPick }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const workerRef   = useRef<Worker | null>(null);
  const latestIdRef = useRef(0);

  const viewportRef = useRef(viewport);
  const setTypeRef  = useRef(setType);
  const juliaCxRef  = useRef(juliaCx);
  const juliaCyRef  = useRef(juliaCy);

  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { setTypeRef.current  = setType;  }, [setType]);
  useEffect(() => { juliaCxRef.current  = juliaCx;  }, [juliaCx]);
  useEffect(() => { juliaCyRef.current  = juliaCy;  }, [juliaCy]);

  const [drag, setDrag]           = useState<DragState | null>(null);
  const [rendering, setRendering] = useState(false);
  const [highPrec, setHighPrec]   = useState(false);

  const render = useCallback((vp: Viewport) => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    if (!canvas || !worker || canvas.width === 0 || canvas.height === 0) return;

    const renderId = ++latestIdRef.current;
    setRendering(true);

    const xRange  = new Decimal(vp.xRange);
    const yRange  = xRange.mul(canvas.height).div(canvas.width);
    const xCenter = new Decimal(vp.xCenter);
    const yCenter = new Decimal(vp.yCenter);

    const xMin = xCenter.minus(xRange.div(2));
    const xMax = xCenter.plus(xRange.div(2));
    const yMin = yCenter.minus(yRange.div(2));
    const yMax = yCenter.plus(yRange.div(2));

    const isHP = needsHP(vp.xRange);
    setHighPrec(isHP);

    worker.postMessage({
      renderId,
      width:         canvas.width,
      height:        canvas.height,
      maxIterations: MAX_ITERATIONS,
      setType:       setTypeRef.current,
      juliaCx:       juliaCxRef.current,
      juliaCy:       juliaCyRef.current,
      xMin:          xMin.toNumber(),
      xMax:          xMax.toNumber(),
      yMin:          yMin.toNumber(),
      yMax:          yMax.toNumber(),
      highPrecision: isHP,
      hpCenterRe:    vp.xCenter,
      hpCenterIm:    vp.yCenter,
      hpXRange:      xRange.toNumber(),
      hpYRange:      yRange.toNumber(),
      hpPrec:        hpPrec(vp.xRange),
    });
  }, []);

  // Create worker once
  useEffect(() => {
    const worker = new Worker(
      new URL('./mandelbrot.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      const { renderId, pixels, width, height } = e.data;
      if (renderId !== latestIdRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.putImageData(new ImageData(pixels as unknown as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
      setRendering(false);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => { render(viewportRef.current); }, [setType, juliaCx, juliaCy, render]);
  useEffect(() => { render(viewport); },            [viewport, render]);

  // Sync canvas pixel dimensions with CSS size on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        canvas.width  = Math.floor(width);
        canvas.height = Math.floor(height);
        render(viewportRef.current);
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [render]);

  // --- mouse handlers ---

  const canvasXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasXY(e);
    setDrag({ startX: x, startY: y, currentX: x, currentY: y });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const { x, y } = canvasXY(e);
    setDrag(d => d ? { ...d, currentX: x, currentY: y } : null);
  }, [drag]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const canvas = canvasRef.current;
    if (!canvas) { setDrag(null); return; }

    const { x, y } = canvasXY(e);
    const dragDist = Math.hypot(x - drag.startX, y - drag.startY);
    const cssW = canvas.offsetWidth;
    const cssH = canvas.offsetHeight;

    if (dragDist < 5 && onPick) {
      const vp     = viewportRef.current;
      const xRange = new Decimal(vp.xRange);
      const yRange = xRange.mul(cssH).div(cssW);
      const xMin   = new Decimal(vp.xCenter).minus(xRange.div(2));
      const yMin   = new Decimal(vp.yCenter).minus(yRange.div(2));
      onPick(
        xMin.plus(xRange.mul(x).div(cssW)).toNumber(),
        yMin.plus(yRange.mul(y).div(cssH)).toNumber(),
      );
    } else {
      const box = constrainedBox(drag, cssW, cssH);
      if (box.width / cssW > 0.01) {
        const vp     = viewportRef.current;
        const xRange = new Decimal(vp.xRange);
        const yRange = xRange.mul(cssH).div(cssW);
        const xMin   = new Decimal(vp.xCenter).minus(xRange.div(2));
        const yMin   = new Decimal(vp.yCenter).minus(yRange.div(2));
        onZoom({
          xCenter: xMin.plus(xRange.mul(box.left + box.right).div(2).div(cssW)).toString(),
          yCenter: yMin.plus(yRange.mul(box.top  + box.bottom).div(2).div(cssH)).toString(),
          xRange:  xRange.mul(box.width).div(cssW).toString(),
        });
      }
    }
    setDrag(null);
  }, [drag, onZoom, onPick]);

  const selBox = drag && canvasRef.current
    ? constrainedBox(drag, canvasRef.current.offsetWidth, canvasRef.current.offsetHeight)
    : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: onPick ? 'cell' : 'crosshair',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setDrag(null)}
      />

      {selBox && (
        <div style={{
          position:      'absolute',
          border:        '2px dashed rgba(255,255,255,0.85)',
          background:    'rgba(255,255,255,0.08)',
          pointerEvents: 'none',
          left:          selBox.left,
          top:           selBox.top,
          width:         selBox.width,
          height:        selBox.height,
        }} />
      )}

      <div style={{
        position:      'absolute',
        bottom:        10,
        right:         12,
        display:       'flex',
        gap:           8,
        alignItems:    'center',
        pointerEvents: 'none',
      }}>
        {highPrec && (
          <span style={{
            color:       '#4af',
            fontSize:    11,
            fontFamily:  'monospace',
            background:  'rgba(0,80,160,0.45)',
            padding:     '1px 6px',
            borderRadius: 3,
          }}>
            arbitrary precision
          </span>
        )}
        {rendering && (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'monospace' }}>
            rendering…
          </span>
        )}
      </div>
    </div>
  );
}
