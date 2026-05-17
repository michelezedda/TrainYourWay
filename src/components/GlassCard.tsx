import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  padding?: boolean
}

export default function GlassCard({ children, className = '', hover = false, padding = true }: GlassCardProps) {
  return (
    <div className={`${hover ? 'glass-card-hover' : 'glass-card'} ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}
