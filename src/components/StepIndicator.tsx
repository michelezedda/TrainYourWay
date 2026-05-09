interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  labels: string[]
}

export default function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-lg mx-auto">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isDone = step < currentStep
        const isActive = step === currentStep

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                  transition-all duration-300 relative
                  ${isDone ? 'text-white' : isActive ? 'text-white' : 'text-white/30 border border-white/15 bg-white/5'}
                `}
                style={
                  isDone
                    ? { background: 'linear-gradient(135deg, #A855F7, #22D3EE)' }
                    : isActive
                      ? {
                          background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                          boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)',
                        }
                      : {}
                }
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block transition-colors duration-300 ${
                  isActive ? 'text-white' : isDone ? 'text-purple-400' : 'text-white/30'
                }`}
              >
                {labels[i]}
              </span>
            </div>

            {step < totalSteps && (
              <div className="flex-1 h-px mx-2 relative overflow-hidden">
                <div className="w-full h-full bg-white/10" />
                <div
                  className="absolute top-0 left-0 h-full transition-all duration-500"
                  style={{
                    width: isDone ? '100%' : '0%',
                    background: 'linear-gradient(90deg, #A855F7, #22D3EE)',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
