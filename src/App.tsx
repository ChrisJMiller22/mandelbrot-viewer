import { useState, useCallback } from 'react';
import { MandelbrotCanvas, type Viewport, type SetType } from './MandelbrotCanvas';

const LABELS: Record<SetType, string> = {
  'mandelbrot':   'Mandelbrot',
  'burning-ship': 'Burning Ship',
  'tricorn':      'Tricorn',
  'julia':        'Julia',
};

const INITIAL_VIEWPORTS: Record<SetType, Viewport> = {
  'mandelbrot':   { xCenter: '-0.75', yCenter: '0',    xRange: '3.5' },
  'burning-ship': { xCenter: '-0.5',  yCenter: '-0.5', xRange: '3.5' },
  'tricorn':      { xCenter: '0',     yCenter: '0',    xRange: '4.5' },
  'julia':        { xCenter: '0',     yCenter: '0',    xRange: '3.5' },
};

const SET_TYPES: SetType[] = ['mandelbrot', 'burning-ship', 'tricorn', 'julia'];

export default function App() {
  const [fractalType, setFractalType] = useState<SetType>('mandelbrot');
  const [viewports, setViewports]     = useState<Record<SetType, Viewport>>({ ...INITIAL_VIEWPORTS });
  const [juliaCx, setJuliaCx]         = useState(-0.7);
  const [juliaCy, setJuliaCy]         = useState(0.27);
  const [pickingC, setPickingC]       = useState(false);

  // While picking c, render the Mandelbrot set so the user can choose a point.
  const activeType     = pickingC ? 'mandelbrot' : fractalType;
  const activeViewport = viewports[activeType];

  const handleZoom = useCallback((v: Viewport) => {
    setViewports(prev => ({ ...prev, [activeType]: v }));
  }, [activeType]);

  const handleReset = useCallback(() => {
    setViewports(prev => ({ ...prev, [activeType]: INITIAL_VIEWPORTS[activeType] }));
    setPickingC(false);
  }, [activeType]);

  const handleSelectFractal = useCallback((type: SetType) => {
    setFractalType(type);
    setPickingC(false);
  }, []);

  // Called when the user clicks a point on the Mandelbrot set during pick mode.
  const handlePick = useCallback((cx: number, cy: number) => {
    setJuliaCx(parseFloat(cx.toFixed(6)));
    setJuliaCy(parseFloat(cy.toFixed(6)));
    setPickingC(false);
    setFractalType('julia');
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>

      {/* ── Main toolbar ── */}
      <div style={toolbarStyle}>
        <div style={{ display: 'flex', gap: 4 }}>
          {SET_TYPES.map(type => (
            <button
              key={type}
              onClick={() => handleSelectFractal(type)}
              style={tabBtn(!pickingC && fractalType === type)}
            >
              {LABELS[type]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={handleReset} style={tabBtn(false)}>Reset</button>
        <span style={{ color: '#444', fontFamily: 'monospace', fontSize: 11 }}>
          drag to zoom
        </span>
      </div>

      {/* ── Julia sub-toolbar ── */}
      {(fractalType === 'julia' || pickingC) && (
        <div style={subbarStyle}>
          {pickingC ? (
            <>
              <span style={{ color: '#f0a040', fontFamily: 'monospace', fontSize: 12 }}>
                Click anywhere on the Mandelbrot set to pick&nbsp;<em>c</em>
              </span>
              <button onClick={() => setPickingC(false)} style={{ ...tabBtn(false), marginLeft: 8 }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <span style={labelStyle}>c =</span>
              <input
                type="number"
                value={juliaCx}
                step={0.01}
                onChange={e => setJuliaCx(parseFloat(e.target.value) || 0)}
                style={numInput}
                aria-label="Julia c real part"
              />
              <span style={labelStyle}>+</span>
              <input
                type="number"
                value={juliaCy}
                step={0.01}
                onChange={e => setJuliaCy(parseFloat(e.target.value) || 0)}
                style={numInput}
                aria-label="Julia c imaginary part"
              />
              <span style={labelStyle}>i</span>
              <button
                onClick={() => setPickingC(true)}
                style={{ ...tabBtn(false), marginLeft: 8 }}
                title="Click a point on the Mandelbrot set to use it as c"
              >
                Pick from Mandelbrot
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Canvas ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MandelbrotCanvas
          viewport={activeViewport}
          setType={activeType}
          juliaCx={juliaCx}
          juliaCy={juliaCy}
          onZoom={handleZoom}
          onPick={pickingC ? handlePick : undefined}
        />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  display:       'flex',
  alignItems:    'center',
  gap:           8,
  padding:       '6px 14px',
  background:    '#0d0d0d',
  borderBottom:  '1px solid #1e1e1e',
  flexShrink:    0,
  flexWrap:      'wrap',
};

const subbarStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          6,
  padding:      '5px 14px',
  background:   '#0a0a0a',
  borderBottom: '1px solid #1e1e1e',
  flexShrink:   0,
};

const labelStyle: React.CSSProperties = {
  color:      '#666',
  fontFamily: 'monospace',
  fontSize:   12,
};

const numInput: React.CSSProperties = {
  width:      80,
  padding:    '2px 6px',
  background: '#1a1a1a',
  color:      '#ccc',
  border:     '1px solid #444',
  borderRadius: 4,
  fontFamily: 'monospace',
  fontSize:   12,
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding:      '3px 10px',
    background:   active ? '#2a5db0' : '#1e1e1e',
    color:        active ? '#fff'    : '#999',
    border:       `1px solid ${active ? '#2a5db0' : '#333'}`,
    borderRadius: 4,
    cursor:       'pointer',
    fontFamily:   'monospace',
    fontSize:     12,
    transition:   'background 0.1s',
  };
}
