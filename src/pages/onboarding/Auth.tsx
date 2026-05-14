import { useState, useEffect } from 'react'
import { HiArrowNarrowRight } from 'react-icons/hi'
import { useNavigate, useLocation } from 'react-router-dom'
import { id } from '@instantdb/react'
import { db } from '@/lib/db'
import { hasSeenOnboarding } from '@/lib/onboarding'
import { saveNutritionProfile } from '@/lib/nutrition'

function Spinner() {
  return <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
}

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

  const newSignup = !!(location.state as { newSignup?: boolean } | null)?.newSignup

  const { user } = db.useAuth()
  const { data: profileData } = db.useQuery({
    userProfiles: { $: { where: { userId: user?.id ?? '' } } },
  })

  const goAfterAuth = () => {
    if (!user?.id) return
    // If user filled the questionnaire before signing up, resume generating
    const rawPending = sessionStorage.getItem('pendingPlan')
    if (rawPending) {
      sessionStorage.removeItem('pendingPlan')
      try {
        const { payload, nutritionData } = JSON.parse(rawPending) as { payload: unknown; nutritionData: Parameters<typeof saveNutritionProfile>[0] }
        if (nutritionData) saveNutritionProfile(nutritionData)
        navigate('/generating', { state: { payload, plansToDelete: [] }, replace: true })
        return
      } catch { /* fall through to normal routing if parse fails */ }
    }
    if (hasSeenOnboarding(user.id)) {
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/questionnaire', { replace: true })
    }
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
    <main className="relative min-h-screen bg-[#030014] flex flex-col overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto w-full px-6 pt-14 pb-12 flex flex-col flex-1 animate-fade-in">

        {/* ── Email step ───────────────────────────────────────────────── */}
        {step === 'email' && (
          <>
            {newSignup ? (
              <div className="mb-10">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(34,211,238,0.2))', border: '1px solid rgba(168,85,247,0.4)' }}>
                  <span className="text-2xl">🏋️</span>
                </div>
                <p className="text-purple-400/70 text-xs font-semibold uppercase tracking-widest mb-2">One step away</p>
                <h1 className="text-3xl font-black text-white tracking-tight leading-tight mb-2">
                  Create your free account
                </h1>
                <p className="text-white/40 text-sm leading-relaxed">
                  No password, no subscription. Your personalized plan is ready in seconds.
                </p>
              </div>
            ) : (
              <div className="mb-10">
                <h1 className="text-[2.8rem] font-black tracking-tight leading-none gradient-text mb-3">UPLIFT</h1>
                <p className="text-white/40 text-sm leading-relaxed">Sign in or create your free account. No password needed.</p>
              </div>
            )}

            {/* Email form */}
            <div className="space-y-3">
              <input
                className="input-glass text-base"
                type="email"
                placeholder="your@email.com"
                value={email}
                autoComplete="email"
                autoFocus
                disabled={loading}
                style={{ fontSize: 16 }}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSendCode() }}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={() => void handleSendCode()}
                disabled={loading || !email.trim()}
                className="btn-primary w-full justify-center py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading ? <Spinner /> : (
                  <>
                    {newSignup ? 'Unlock My Plan' : 'Continue'}
                    <HiArrowNarrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-white/25">
                {newSignup
                  ? 'A 6-digit code will be sent to your email. You’ll be in quickly.'
                  : 'Welcome back. Continue to your dashboard.'}
              </p>
            </div>
          </>
        )}

        {/* ── Code step ────────────────────────────────────────────────── */}
        {step === 'code' && (
          <>
            <div className="mb-8">
              <div className="text-4xl mb-5">📬</div>
              <p className="text-purple-400/70 text-xs font-semibold uppercase tracking-widest mb-2">Check your inbox</p>
              <h2 className="text-3xl font-black text-white tracking-tight leading-tight mb-2">
                We sent you a code
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                6-digit code sent to{' '}
                <span className="text-white/70 font-medium">{email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <input
                className="input-glass text-center text-3xl font-black tracking-[0.6em] py-5"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="------"
                autoFocus
                value={code}
                disabled={loading}
                style={{ fontSize: 28 }}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => { if (e.key === 'Enter') void handleVerify() }}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={() => void handleVerify()}
                disabled={loading || code.length < 6}
                className="btn-primary w-full justify-center py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading ? <Spinner /> : (
                  <>
                    {newSignup ? 'Unlock My Plan' : 'Verify and continue'}
                    <HiArrowNarrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { setStep('email'); setCode(''); setError('') }}
                  className="text-xs text-white/35 hover:text-white/60 transition-colors"
                >
                  Change email
                </button>
                <button
                  onClick={() => void handleSendCode()}
                  disabled={countdown > 0 || loading}
                  className="text-xs transition-colors disabled:opacity-40"
                  style={{ color: countdown > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(167,139,250,0.8)' }}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Name step ────────────────────────────────────────────────── */}
        {step === 'name' && (
          <>
            <div className="mb-8">
              <div className="text-4xl mb-5">🙌</div>
              <p className="text-purple-400/70 text-xs font-semibold uppercase tracking-widest mb-2">
                {newSignup ? 'Almost there' : 'Welcome to UPLIFT'}
              </p>
              <h2 className="text-3xl font-black text-white tracking-tight leading-tight mb-2">
                {newSignup && name ? `Is "${name}" right?` : "What should we call you?"}
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                {newSignup
                  ? 'Confirm your name and your plan will start generating.'
                  : 'Your name makes your experience feel personal.'}
              </p>
            </div>

            <div className="space-y-3">
              <input
                className="input-glass text-lg font-semibold"
                type="text"
                placeholder="Your first name"
                autoFocus
                autoComplete="given-name"
                value={name}
                disabled={loading}
                style={{ fontSize: 18 }}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim().length >= 2) void handleSubmitName() }}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={() => void handleSubmitName()}
                disabled={loading || name.trim().length < 2}
                className="btn-primary w-full justify-center py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading ? <Spinner /> : (
                  <>
                    {newSignup ? 'Generate My Plan' : 'Get started'}
                    <HiArrowNarrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
