import React from 'react'

interface Props {
  size?: number
  className?: string
}

export function AppIcon({ size = 24, className }: Props): React.ReactElement {
  return (
    <img
      src="/icon.png"
      alt="Sealed"
      width={size}
      height={size}
      className={className}
      style={{
        borderRadius: Math.round(size * 0.22),
        display: 'block',
        flexShrink: 0
      }}
      draggable={false}
    />
  )
}
