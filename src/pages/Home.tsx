import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { HiArrowNarrowRight, HiCheck, HiChevronLeft } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/db'

const ONBOARDING_STEPS = [
  {
    id: 'goal',
    question: "What's your primary focus?",
    subtext: "We'll tailor your exercises and nutrition to this objective.",
    options: [
      { id: 'muscle', label: 'Build Muscle', icon: '💪', color: 'from-violet-500' },
      { id: 'weight', label: 'Lose Weight', icon: '🔥', color: 'from-cyan-500' },
      { id: 'fit', label: 'Get Lean & Fit', icon: '✨', color: 'from-emerald-500' },
      { id: 'performance', label: 'Athletic Power', icon: '⚡', color: 'from-orange-500' },
    ]
  },
  {
    id: 'level',
    question: "Your experience level?",
    subtext: "This determines your starting volume and intensity.",
    options: [
      { id: 'beginner', label: 'Beginner', icon: '🌱', desc: 'New to training' },
      { id: 'intermediate', label: 'Intermediate', icon: '🏋️', desc: '1-2 years experience' },
      { id: 'advanced', label: 'Advanced', icon: '🏆', desc: 'Consistent for 3+ years' },
    ]
  },
  {
    id: 'location',
    question: "Where will you train?",
    subtext: "Your plan adjusts based on available equipment.",
    options: [
      { id: 'gym', label: 'Full Gym', icon: '🏢', desc: 'All machines & weights' },
      { id: 'home', label: 'Home / Basic', icon: '🏠', desc: 'Dumbbells or bands' },
      { id: 'bodyweight', label: 'Bodyweight', icon: '🤸', desc: 'No equipment needed' },
    ]
  }
]

export default function Home() {
  const navigate = useNavigate()
  const { isLoading, user } = db.useAuth()

  const [step, setStep] = useState<number>(-1)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isProcessing, setIsProcessing] = useState(false)

  if (isLoading) return null
  if (user) return <Navigate to="/dashboard" replace />

  const handleSelection = (optionId: string) => {
    const currentStepData = ONBOARDING_STEPS[step]

    setAnswers(prev => ({
      ...prev,
      [currentStepData.id]: optionId,
    }))

    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      setIsProcessing(true)

      setTimeout(() => {
        navigate('/auth')
      }, 2000)
    }
  }

  const progress = ((step + 1) / ONBOARDING_STEPS.length) * 100

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030014]">
      {/* Background Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
        }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
        }}
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-6 pt-8 pb-12 min-h-screen flex flex-col">
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-12 h-10">
          {step >= 0 && !isProcessing ? (
            <button
              onClick={() => setStep(step - 1)}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 transition-colors"
            >
              <HiChevronLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-10" />
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xl font-black tracking-tighter"
          >
            <span className="gradient-text text-4xl">UPLIFT</span>
          </motion.div>

          <Link
            to="/auth"
            className="text-sm font-medium text-white/40 hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Progress */}
        {step >= 0 && !isProcessing && (
          <div className="mb-12">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/30">
                Step {step + 1} of {ONBOARDING_STEPS.length}
              </span>

              <span className="text-xs font-bold text-cyan-400">
                {Math.round(progress)}%
              </span>
            </div>

            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === -1 ? (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center"
              >
                <h1 className="text-6xl font-black text-white mb-6 tracking-tighter leading-[0.9]">
                  EVOLVE <br />
                  <span className="gradient-text">YOURSELF.</span>
                </h1>

                <p className="text-lg text-white/40 mb-12 leading-relaxed font-medium">
                  Ditch the generic templates. Get a training and nutrition plan built around you, adapted to your lifestyle and goals.
                </p>

                <button
                  onClick={() => setStep(0)}
                  className="w-full py-5 rounded-2xl bg-white text-black font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                >
                  Build My Plan
                  <HiArrowNarrowRight className="w-6 h-6" />
                </button>

                <div className="mt-8 flex items-center justify-center gap-6 text-white/20">
                  <div className="flex flex-col items-center">
                    <span className="text-white font-bold text-sm">30s</span>
                    <span className="text-[10px] uppercase tracking-wider">
                      Setup
                    </span>
                  </div>

                  <div className="w-px h-8 bg-white/10" />

                  <div className="flex flex-col items-center">
                    <span className="text-white font-bold text-sm">100%</span>
                    <span className="text-[10px] uppercase tracking-wider">
                      Unique
                    </span>
                  </div>

                  <div className="w-px h-8 bg-white/10" />

                  <div className="flex flex-col items-center">
                    <span className="text-white font-bold text-sm">Free</span>
                    <span className="text-[10px] uppercase tracking-wider">
                      Access
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="absolute inset-0 border-t-2 border-cyan-400 rounded-full"
                  />

                  <div className="absolute inset-0 flex items-center justify-center text-4xl">
                    🤖
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Analyzing your profile...
                </h2>

                <p className="text-white/40">
                  Kai is crafting your personalized evolution.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col"
              >
                <h2 className="text-3xl font-black text-white mb-2 tracking-tight leading-none">
                  {ONBOARDING_STEPS[step].question}
                </h2>

                <p className="text-white/40 mb-8 font-medium">
                  {ONBOARDING_STEPS[step].subtext}
                </p>

                <div className="space-y-4">
                  {ONBOARDING_STEPS[step].options.map(opt => {
                    const isSelected =
                      answers[ONBOARDING_STEPS[step].id] === opt.id

                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelection(opt.id)}
                        className={`group w-full relative overflow-hidden text-left p-5 rounded-3xl border transition-all duration-300 ${isSelected
                          ? 'bg-white/10 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                          : 'bg-white/5 border-white/5 hover:bg-white/[0.07] hover:border-white/20'
                          }`}
                      >
                        <div className="flex items-center gap-5 relative z-10">
                          <div
                            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${'color' in opt ? opt.color : 'from-white/10'
                              } to-transparent flex items-center justify-center text-2xl shadow-inner`}
                          >
                            {opt.icon}
                          </div>

                          <div className="flex-1">
                            <div className="font-bold text-white text-lg leading-tight">
                              {opt.label}
                            </div>

                            {'desc' in opt && opt.desc && (
                              <div className="text-white/30 text-sm mt-0.5 font-medium">
                                {opt.desc}
                              </div>
                            )}
                          </div>

                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                              ? 'bg-cyan-400 border-cyan-400'
                              : 'border-white/10'
                              }`}
                          >
                            {isSelected && (
                              <HiCheck className="w-4 h-4 text-black" />
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step === -1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-auto text-center"
          >
            <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">
              &#169; {new Date().getFullYear()} Uplift. All rights reserved.
            </p>
          </motion.div>
        )}
      </div>
    </main>
  )
}