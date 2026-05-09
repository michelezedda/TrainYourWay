interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
}

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`${sizes[size]} relative`}>
        <div
          className={`${sizes[size]} rounded-full animate-spin`}
          style={{
            background: 'conic-gradient(from 0deg, #A855F7, #22D3EE, transparent)',
            padding: '3px',
          }}
        >
          <div className="w-full h-full rounded-full bg-brand-dark" style={{ background: '#050510' }} />
        </div>
        <div
          className={`${sizes[size]} absolute inset-0 rounded-full`}
          style={{
            background: 'conic-gradient(from 0deg, rgba(168,85,247,0.4), rgba(34,211,238,0.4), transparent)',
            filter: 'blur(8px)',
          }}
        />
      </div>
      {message && <p className="text-white/50 text-sm">{message}</p>}
    </div>
  )
}
