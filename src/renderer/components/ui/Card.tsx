import React from 'react'

export interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={`card${className ? ` ${className}` : ''}`}
      style={padding ? undefined : { padding: '0' }}
    >
      {children}
    </div>
  )
}
