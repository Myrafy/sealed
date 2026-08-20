import React from 'react'

interface Props {
  size?: number
  className?: string
}

/**
 * Full macOS-style app icon (squircle plate), matching Dock icons like Chrome / Gemini.
 * Corner radius is baked into the SVG — do not double-round.
 */
export function AppIcon({ size = 24, className }: Props): React.ReactElement {
  return (
    <img
      src="/icon.svg"
      alt="Sealed"
      width={size}
      height={size}
      className={className}
      style={{
        display: 'block',
        flexShrink: 0,
        borderRadius: 0
      }}
      draggable={false}
    />
  )
}
