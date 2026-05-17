import { Component, type ReactNode, useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navigation from '@/components/layout/Navigation'
import AuthGuard from '@/components/layout/AuthGuard'
import LoadingSpinner from '@/components/LoadingSpinner'

const Landing = lazy(() => import('@/pages/onboarding/Landing'))
const Auth = lazy(() => import('@/pages/onboarding/Auth'))
const Questionnaire = lazy(() => import('@/pages/onboarding/Questionnaire'))
import { db } from '@/lib/db'
import { setAuthUserId } from '@/lib/userId'
import { MoodProvider } from '@/context/MoodContext'
import { LocaleProvider } from '@/context/LocaleContext'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-white/50 text-sm mb-4 leading-relaxed">
              The app failed to start. If you're hosting this yourself, make sure
              <code className="text-purple-300 mx-1">VITE_GROQ_API_KEY</code> and
              <code className="text-purple-300 mx-1">VITE_INSTANTDB_APP_ID</code>
              are set in your environment variables.
            </p>
            <details className="text-left text-xs text-white/30 bg-white/5 rounded-xl p-3 border border-white/8">
              <summary className="cursor-pointer text-white/40 mb-1">Error details</summary>
              {error.message}
            </details>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const LOAD_MESSAGES = [
  'Getting everything ready for you...',
  'Preparing your personalized plan...',
  'Syncing your progress and recommendations...',
  'Almost there...',
]

function AppLoadingScreen() {
  const [idx, setIdx] = useState(0)
  const [slowHint, setSlowHint] = useState(false)

  useEffect(() => {
    const cycle = setInterval(() => setIdx(i => (i + 1) % LOAD_MESSAGES.length), 2800)
    const hint = setTimeout(() => setSlowHint(true), 5000)
    return () => { clearInterval(cycle); clearTimeout(hint) }
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center" style={{ background: '#030014', zIndex: 9999 }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <h1 className="text-5xl font-black tracking-tight gradient-text mb-2">UPLYFT</h1>
        <p className="text-white/30 text-sm font-medium mb-10">Train. Evolve. Repeat.</p>

        <LoadingSpinner size="md" />

        <p key={idx} className="text-white/50 text-sm font-medium mt-8 animate-fade-in">
          {LOAD_MESSAGES[idx]}
        </p>

        {slowHint && (
          <p className="text-white/25 text-xs mt-3 max-w-[240px] leading-relaxed animate-fade-in">
            Taking a bit longer than usual. Hang tight.
          </p>
        )}
      </div>
    </div>
  )
}

function AuthSync() {
  const { user } = db.useAuth()
  useEffect(() => { setAuthUserId(user?.id ?? null) }, [user?.id])
  return null
}

function AppLayout() {
  const { isLoading, user } = db.useAuth()

  if (isLoading) return <AppLoadingScreen />

  return (
    <div className="relative min-h-screen flex flex-col" style={{ zIndex: 1 }}>
      <div className={`flex-1 ${user ? 'md:pl-56' : ''}`}>
        <Suspense fallback={<AppLoadingScreen />}>
          <Routes>
            <Route path="/"              element={<Landing />} />
            <Route path="/auth"          element={<Auth />} />
            <Route path="/questionnaire" element={<Questionnaire />} />
            <Route path="/*"             element={<AuthGuard />} />
          </Routes>
        </Suspense>
      </div>
      <Navigation />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthSync />
        <LocaleProvider>
        <MoodProvider>
        <div className="ambient-bg" aria-hidden>
          <div className="ambient-orb-1" />
          <div className="ambient-orb-2" />
          <div className="ambient-orb-3" />
        </div>
        <AppLayout />
        </MoodProvider>
        </LocaleProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
