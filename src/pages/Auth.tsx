import { useState, useEffect } from 'react'
import { HiArrowNarrowRight } from 'react-icons/hi'
import { useNavigate, useLocation } from 'react-router-dom'
import { id } from '@instantdb/react'
import { db } from '@/lib/db'

export default function Auth() {
  const [step, setStep] = useState<'email' | 'code' | 'name'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [verified, setVerified] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const { user } = db.useAuth()
  const { data: profileData } = db.useQuery({
    userProfiles: { $: { where: { userId: user?.id ?? '' } } },
  })

  const goAfterAuth = () => {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? null
    navigate(from && from !== '/' && from !== '/auth' ? from : '/dashboard', { replace: true })
  }

  useEffect(() => {
    if (!verified || !user || profileData === undefined) return
    setLoading(false)
    const hasProfile = (profileData.userProfiles?.length ?? 0) > 0
    if (hasProfile) {
      goAfterAuth()
    } else {
      setStep('name')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified, user, profileData])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleSendCode = async () => {
    setError('')
    if (!email.trim()) { setError('Enter your email address.'); return }
    setLoading(true)
    try {
      await db.auth.sendMagicCode({ email: email.trim() })
      setStep('code')
      setCountdown(30)
    } catch {
      setError('Could not send code. Check the email address and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setError('')
    if (code.trim().length < 6) { setError('Enter the 6-digit code from your email.'); return }
    setLoading(true)
    try {
      await db.auth.signInWithMagicCode({ email: email.trim(), code: code.trim() })
      setVerified(true)
      // Navigation or name step handled in useEffect once profileData loads
    } catch {
      setError('Incorrect code or it has expired. Request a new one.')
      setLoading(false)
    }
  }

  const handleSubmitName = async () => {
    if (!user?.id || !name.trim()) return
    setLoading(true)
    setError('')
    try {
      await db.transact(db.tx.userProfiles[id()].update({
        userId: user.id,
        name: name.trim(),
        createdAt: Date.now(),
      }))
      goAfterAuth()
    } catch {
      setError('Could not save your name. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-5 pt-14 pb-10 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.13) 0%, transparent 65%)', filter: 'blur(55px)' }} />
      <div className="absolute bottom-10 left-1/3 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 65%)', filter: 'blur(60px)' }} />

      <div className="relative w-full max-w-sm mx-auto flex flex-col animate-fade-in">

        {/* Logo */}
        <div className="mb-9">
          <div className="flex items-center gap-2.5 mb-2">
            <h1 className="text-[2.6rem] font-black tracking-tight leading-none gradient-text">UPLIFT</h1>
          </div>
          <p className="text-white/40 text-sm leading-relaxed">
            Your personal fitness and nutrition coach, powered by AI. Free, no subscription.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-7">
          {[
            { icon: '🏋️', label: 'AI Workout Plans', sub: 'Built for your setup and goals' },
            { icon: '🥗', label: 'Nutrition Tracking', sub: 'Macros, calories, food scanner' },
            { icon: '🤖', label: 'Kai AI Coach', sub: 'Ask anything, any time' },
            { icon: '📈', label: 'Auto-Progress', sub: 'Plan evolves every 2 weeks' },
          ].map(({ icon, label, sub }) => (
            <div
              key={label}
              className="flex flex-col gap-2 p-3.5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.042)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-[1.35rem] leading-none">{icon}</span>
              <div>
                <p className="text-[12px] font-semibold text-white/85 leading-snug">{label}</p>
                <p className="text-[10.5px] text-white/35 mt-0.5 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Auth card */}
        <div className="glass-card p-5 space-y-3.5">
          {step === 'name' ? (
            <>
              <p className="text-sm font-semibold text-white/80">One last thing</p>
              <p className="text-xs text-white/40 -mt-1">What should we call you?</p>
              <input
                className="input-glass"
                type="text"
                placeholder="Your name"
                autoFocus
                autoComplete="name"
                value={name}
                disabled={loading}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim().length >= 2) void handleSubmitName() }}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={() => void handleSubmitName()}
                disabled={loading || name.trim().length < 2}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading
                  ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : 'Get started'}
              </button>
            </>
          ) : step === 'email' ? (
            <>
              <p className="text-sm font-semibold text-white/80">Get started for free</p>
              <input
                className="input-glass"
                type="email"
                placeholder="your@email.com"
                value={email}
                autoComplete="email"
                autoFocus
                disabled={loading}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSendCode() }}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={() => void handleSendCode()}
                disabled={loading || !email.trim()}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    Continue
                    <HiArrowNarrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-white/25">
                New account created automatically. No password needed.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white/80">Check your email</p>
                <button
                  onClick={() => { setStep('email'); setCode(''); setError('') }}
                  className="text-xs text-purple-400/70 hover:text-purple-300 transition-colors"
                >
                  Change email
                </button>
              </div>
              <p className="text-xs text-white/35">
                Verification code sent to <span className="text-white/60">{email}</span>
              </p>
              <input
                className="input-glass text-center text-2xl font-bold tracking-[0.5em]"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="------"
                autoFocus
                value={code}
                disabled={loading}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => { if (e.key === 'Enter') void handleVerify() }}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={() => void handleVerify()}
                disabled={loading || code.length < 6}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : 'Verify and get started'}
              </button>
              <button
                onClick={() => void handleSendCode()}
                disabled={countdown > 0 || loading}
                className="w-full text-xs text-center py-1 transition-colors disabled:opacity-40"
                style={{ color: countdown > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(167,139,250,0.8)' }}
              >
                {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
              </button>
            </>
          )}
        </div>

      </div>
    </main>
  )
}
