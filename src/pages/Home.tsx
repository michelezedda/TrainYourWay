import { useNavigate, Navigate } from 'react-router-dom'
import { HiArrowNarrowRight } from 'react-icons/hi'
import { motion } from 'framer-motion'
import { db } from '@/lib/db'

export default function Home() {
  const navigate = useNavigate()
  const { isLoading, user } = db.useAuth()

  if (isLoading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <main className="relative min-h-screen bg-[#030014] flex flex-col overflow-hidden">
      {/* Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.13) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto w-full px-6 pt-16 pb-12 flex flex-col flex-1">
        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
          <h1 className="text-[3.5rem] font-black tracking-tight leading-none gradient-text">UPLIFT</h1>
          <p className="text-white/40 text-base mt-2 font-medium">Premium fitness plans designed to grow with you.</p>
        </motion.div>

        {/* Features */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="space-y-3 mb-10">
          {[
            { icon: '🏋️', title: 'Personalized Workout Plans', desc: 'Built around your goals, equipment, and schedule' },
            { icon: '🤖', title: 'KAI - Your AI Coach', desc: 'Ask anything, get expert-level answers anytime' },
            { icon: '📈', title: 'Auto-Evolving Plans', desc: 'Your plan adapts every 4 weeks as you progress' },
            { icon: '🥗', title: 'Nutrition Tracking', desc: 'Macros, calories, food scanner, and daily insights' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-4 p-4 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="mt-auto space-y-3">
          <button
            onClick={() => navigate('/auth', { state: { newSignup: true } })}
            className="btn-primary w-full justify-center text-lg py-5"
          >
            Build My Plan
            <HiArrowNarrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/auth')}
            className="w-full py-3.5 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
          >
            Already have an account?{' '}
            <span style={{ color: '#c084fc' }}>Log in</span>
          </button>
        </motion.div>
      </div>
    </main>
  )
}
