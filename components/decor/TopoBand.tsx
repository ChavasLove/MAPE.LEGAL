import type { CSSProperties } from 'react'

type Variant = 'light' | 'dark'
type Position = 'overlay' | 'band'

type Props = {
  variant: Variant
  position?: Position
  className?: string
}

export default function TopoBand({ variant, position = 'overlay', className }: Props) {
  const color = variant === 'dark' ? '#2F5D50' : '#162033'
  const opacity = variant === 'dark' ? 0.18 : 0.06
  const isBand = position === 'band'

  const wrapperStyle: CSSProperties = isBand
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        overflow: 'hidden',
        pointerEvents: 'none',
        color,
        opacity,
      }
    : {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        color,
        opacity,
      }

  const svgStyle: CSSProperties = isBand
    ? { width: '100%', height: 'auto', display: 'block' }
    : { width: '100%', height: '100%', display: 'block' }

  return (
    <div aria-hidden="true" className={className} style={wrapperStyle}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1600 220"
        preserveAspectRatio={isBand ? 'xMidYMin meet' : 'none'}
        style={svgStyle}
      >
        <g fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.5">
          <path d="M0 180 Q200 120 400 150 T800 130 T1200 160 T1600 140" />
          <path d="M0 150 Q220 100 420 130 T820 110 T1220 140 T1600 120" />
          <path d="M0 120 Q240 80 440 110 T840 90 T1240 120 T1600 100" />
          <path d="M0 90  Q260 60 460 90  T860 70 T1260 100 T1600 80" />
          <path d="M0 60  Q280 40 480 70  T880 50 T1280 80  T1600 60" />
          {!isBand && (
            <>
              <circle cx="320" cy="110" r="1.5" />
              <circle cx="780" cy="80" r="1.5" />
              <circle cx="1180" cy="105" r="1.5" />
            </>
          )}
        </g>
        {!isBand && (
          <g fill="currentColor" opacity="0.35" fontSize="8" fontFamily="ui-monospace, monospace">
            <text x="40" y="200">15°56′N</text>
            <text x="780" y="200">85°08′W · IRIONA, COLÓN</text>
            <text x="1480" y="200">200km</text>
          </g>
        )}
      </svg>
    </div>
  )
}
