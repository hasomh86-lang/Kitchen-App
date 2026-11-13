import React, { useEffect, useRef } from 'react';

export type BeamsMode = 'day' | 'night';

interface BeamsBackgroundProps {
  /** Palette: pale mist with pastel beams, or near-black with luminous beams. */
  mode?: BeamsMode;
  intensity?: 'subtle' | 'medium' | 'strong';
  className?: string;
  children?: React.ReactNode;
}

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
}

const BEAM_COUNT = 30;
// The canvas is drawn at a fraction of the screen size and blurred with CSS.
// Beams are soft by design, so this looks the same and stays smooth on tablets.
const RENDER_SCALE = 0.25;

const INTENSITY = { subtle: 0.7, medium: 0.85, strong: 1 } as const;

export const BEAMS_PALETTE: Record<BeamsMode, { base: string; saturation: number; lightness: number; gain: number; veil: string }> = {
  day: { base: '#DCE3EC', saturation: 80, lightness: 80, gain: 1.9, veil: 'rgba(255,255,255,0.35)' },
  night: { base: '#0A0D14', saturation: 85, lightness: 65, gain: 1.5, veil: 'rgba(10,13,20,0.15)' },
};

function createBeam(width: number, height: number): Beam {
  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 30 + Math.random() * 60,
    length: height * 2.5,
    angle: -35 + Math.random() * 10,
    speed: 0.6 + Math.random() * 1.2,
    opacity: 0.12 + Math.random() * 0.16,
    hue: 190 + Math.random() * 70,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
  };
}

function resetBeam(beam: Beam, index: number, width: number, height: number) {
  const spacing = width / 3;
  beam.y = height + 100;
  beam.x = (index % 3) * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
  beam.width = 100 + Math.random() * 100;
  beam.speed = 0.5 + Math.random() * 0.4;
  beam.hue = 190 + (index * 70) / BEAM_COUNT;
  beam.opacity = 0.2 + Math.random() * 0.1;
}

/**
 * Slow diagonal light beams behind frosted-glass UI.
 * Fills its nearest positioned ancestor; content passed as children sits above it.
 */
export const BeamsBackground: React.FC<BeamsBackgroundProps> = ({
  mode = 'night',
  intensity = 'medium',
  className = '',
  children,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const palette = BEAMS_PALETTE[mode];

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!wrap || !canvas || !ctx) return;

    const { saturation, lightness, gain } = BEAMS_PALETTE[mode];
    const strength = INTENSITY[intensity] * gain;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let beams: Beam[] = [];
    let frame = 0;

    const draw = (advance: boolean) => {
      ctx.clearRect(0, 0, width, height);
      beams.forEach((beam, index) => {
        if (advance) {
          beam.y -= beam.speed;
          beam.pulse += beam.pulseSpeed;
          if (beam.y + beam.length < -100) resetBeam(beam, index, width, height);
        }
        const alpha = Math.min(1, beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * strength);
        const color = (a: number) => `hsla(${beam.hue}, ${saturation}%, ${lightness}%, ${a})`;

        ctx.save();
        ctx.translate(beam.x, beam.y);
        ctx.rotate((beam.angle * Math.PI) / 180);
        const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);
        gradient.addColorStop(0, color(0));
        gradient.addColorStop(0.1, color(alpha * 0.5));
        gradient.addColorStop(0.4, color(alpha));
        gradient.addColorStop(0.6, color(alpha));
        gradient.addColorStop(0.9, color(alpha * 0.5));
        gradient.addColorStop(1, color(0));
        ctx.fillStyle = gradient;
        ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
        ctx.restore();
      });
    };

    const resize = () => {
      // Beam geometry is in CSS pixels; the transform maps it onto the small canvas.
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      canvas.width = Math.max(1, Math.round(width * RENDER_SCALE));
      canvas.height = Math.max(1, Math.round(height * RENDER_SCALE));
      ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
      beams = Array.from({ length: BEAM_COUNT }, () => createBeam(width, height));
      draw(false);
    };

    const loop = () => {
      draw(true);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!reduceMotion && !frame && !document.hidden) frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode, intensity]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        backgroundColor: palette.base,
        transition: 'background-color 0.6s ease',
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          filter: 'blur(40px)',
          transform: 'scale(1.15)',
        }}
      />
      <div
        aria-hidden="true"
        className="beams-veil"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundColor: palette.veil }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
};
