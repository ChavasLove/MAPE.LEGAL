'use client';

import { Compass } from 'lucide-react';

interface CompassButtonProps {
  bearing: number;
  pitch: number;
  lang: 'es' | 'en';
  onClick: () => void;
}

/**
 * Floating circular button that mirrors the map's bearing. Tap to reset
 * bearing/pitch to the default 3D framing. Fades to lower opacity when
 * already at rest. 44×44 touch target.
 */
export default function CompassButton({
  bearing,
  pitch,
  lang,
  onClick,
}: CompassButtonProps) {
  // Consider the camera "at rest" when the user hasn't rotated it.
  const atRest = Math.abs(bearing - -18) < 0.5 && Math.abs(pitch - 55) < 0.5;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        lang === 'es'
          ? 'Restablecer brújula y vista'
          : 'Reset compass and view'
      }
      title={
        lang === 'es'
          ? 'Restablecer brújula y vista'
          : 'Reset compass and view'
      }
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 18,
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'color-mix(in oklch, var(--bg) 96%, transparent)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        boxShadow:
          '0 2px 12px color-mix(in oklch, var(--ink) 12%, transparent)',
        color: 'var(--ink)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        opacity: atRest ? 0.6 : 1,
        transition: 'opacity 0.2s ease, background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background =
          'color-mix(in oklch, var(--bg) 96%, transparent)';
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          transform: `rotate(${-bearing}deg)`,
          transition: 'transform 0.18s ease',
        }}
      >
        <Compass size={20} strokeWidth={1.5} />
      </span>
    </button>
  );
}
