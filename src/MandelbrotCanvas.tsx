import { useRef, useEffect, useState, useCallback } from 'react';
import type { SetType } from './mandelbrot.worker';

export type { SetType };

export type Viewport = {
  xCenter: number;
  yCenter: number;
  xRange:  number;
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

interface Props {
  viewport: Viewport;
  setType:  SetType;
  juliaCx:  number;
  juliaCy:  number;
  onZoom:   (v: Viewport) => void;
  onPick?:  (cx: number, cy: number) => void;
}

function toWorkerBounds(vp: Viewport, w: number, h: number) {
  const yRange = vp.xRange * (h / w);
  return {
    xMin: vp.xCenter - vp.xRange / 2,
    xMax: vp.xCenter + vp.xRange / 2,
    yMin: vp.yCenter - yRange  / 2,
    yMax: vp.yCenter + yRange  / 2,
  };
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

export function MandelbrotCanvas({ viewport, setType, juliaCx, juliaCy, onZoom, onPick }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const workerRef   = useRef<Worker | null>(null);
  const latestIdRef = useRef(0);

  // Refs let the stable `render` callback always read the latest values.
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

  const render = useCallback((vp: Viewport) => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    if (!canvas || !worker || canvas.width === 0 || canvas.height === 0) return;
    const renderId = ++latestIdRef.current;
    setRendering(true);
    worker.postMessage({
      renderId,
      width:         canvas.width,
      height:        canvas.height,
      maxIterations: MAX_ITERATIONS,
      setType:       setTypeRef.current,
      juliaCx:       juliaCxRef.current,
      juliaCy:       juliaCyRef.current,
      ...toWorkerBounds(vp, canvas.width, canvas.height),
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
      ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
      setRendering(false);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Re-render on viewport or set parameter changes
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

    if (dragDist < 5 && onPick) {
      // Small movement → treat as a click to pick complex coordinate
      const cssW   = canvas.offsetWidth;
      const cssH   = canvas.offsetHeight;
      const vp     = viewportRef.current;
      const yRange = vp.xRange * (cssH / cssW);
      onPick(
        (vp.xCenter - vp.xRange / 2) + (x / cssW) * vp.xRange,
        (vp.yCenter - yRange  / 2) + (y / cssH) * yRange,
      );
    } else {
      const cssW = canvas.offsetWidth;
      const cssH = canvas.offsetHeight;
      const box  = constrainedBox(drag, cssW, cssH);

      if (box.width / cssW > 0.01) {
        const vp     = viewportRef.current;
        const yRange = vp.xRange * (cssH / cssW);
        const xMin   = vp.xCenter - vp.xRange / 2;
        const yMin   = vp.yCenter - yRange   / 2;
        onZoom({
          xCenter: xMin + ((box.left + box.right)  / 2) / cssW * vp.xRange,
          yCenter: yMin + ((box.top  + box.bottom) / 2) / cssH * yRange,
          xRange:  (box.width / cssW) * vp.xRange,
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

      {rendering && (
        <div style={{
          position:      'absolute',
          bottom:        10,
          right:         12,
          color:         'rgba(255,255,255,0.5)',
          fontSize:      11,
          fontFamily:    'monospace',
          pointerEvents: 'none',
        }}>
          rendering…
        </div>
      )}
    </div>
  );
}
