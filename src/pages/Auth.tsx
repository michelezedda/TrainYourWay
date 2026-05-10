import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { db } from '@/lib/db'
import { getNutritionProfile } from '@/lib/nutrition'

type Step = 'email' | 'code'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const { isLoading, user } = db.useAuth()

  const [step, setStep]       = useState<Step>('email')
  const [email, setEmail]     = useState('')
  const [code, setCode]       = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [resendSecs, setResendSecs] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  // Already signed in — redirect out
  useEffect(() => {
    if (!isLoading && user) {
      const dest = getNutritionProfile() ? from : '/questionnaire'
      navigate(dest, { replace: true })
    }
  }, [isLoading, user, from, navigate])

  // Countdown for resend
  useEffect(() => {
    if (resendSecs <= 0) return
    const t = setTimeout(() => setResendSecs(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendSecs])

  // Auto-focus code input when step changes
  useEffect(() => {
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 100)
  }, [step])

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setBusy(true)
    try {
      await db.auth.sendMagicCode({ email: email.trim().toLowerCase() })
      setStep('code')
      setResendSecs(30)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().length < 6) return
    setError('')
    setBusy(true)
    try {
      await db.auth.signInWithMagicCode({ email: email.trim().toLowerCase(), code: code.trim() })
      // useEffect above handles redirect once user is set
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.')
      setBusy(false)
    }
  }

  async function handleResend() {
    if (resendSecs > 0) return
    setError('')
    setBusy(true)
    try {
      await db.auth.sendMagicCode({ email: email.trim().toLowerCase() })
      setResendSecs(30)
      setCode('')
    } catch {
      setError('Failed to resend. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Uplift" className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-lg" />
          <span
            className="font-black text-2xl tracking-tight"
            style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            UPLIFT
          </span>
        </div>

        <div className="glass-card p-6 space-y-5">
          {step === 'email' ? (
            <>
              <div>
                <h1 className="text-xl font-bold text-white mb-1">Welcome</h1>
                <p className="text-sm text-white/45">Enter your email to sign in or create an account.</p>
              </div>

              <form onSubmit={handleSendCode} className="space-y-3">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  className="input-glass"
                  autoFocus
                  autoComplete="email"
                  required
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending...
                    </span>
                  ) : 'Continue'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div>
                <button
                  onClick={() => { setStep('email'); setCode(''); setError('') }}
                  className="flex items-center gap-1.5 text-white/40 text-xs mb-3 hover:text-white/70 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h1 className="text-xl font-bold text-white mb-1">Check your email</h1>
                <p className="text-sm text-white/45">
                  We sent a 6-digit code to{' '}
                  <span className="text-white/70 font-medium">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-3">
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(v)
                    setError('')
                  }}
                  className="input-glass text-center text-2xl tracking-[0.5em] font-mono"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={busy || code.trim().length < 6}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Verifying...
                    </span>
                  ) : 'Verify'}
                </button>
              </form>

              <button
                onClick={handleResend}
                disabled={resendSecs > 0 || busy}
                className="w-full text-xs text-white/35 hover:text-white/60 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resendSecs > 0 ? `Resend code in ${resendSecs}s` : 'Resend code'}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-white/20 mt-6 px-4">
          By continuing you agree to our terms. No password needed.
        </p>
      </div>
    </div>
  )
}
