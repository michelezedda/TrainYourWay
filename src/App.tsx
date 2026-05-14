import { Component, type ReactNode, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import AuthGuard from '@/components/AuthGuard'
import Home from '@/pages/Home'
import Auth from '@/pages/Auth'
import { db } from '@/lib/db'
import { setAuthUserId } from '@/lib/userId'
import { MoodProvider } from '@/context/MoodContext'

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

function AuthSync() {
  const { user } = db.useAuth()
  useEffect(() => { setAuthUserId(user?.id ?? null) }, [user?.id])
  return null
}

function AppLayout() {
  const { user } = db.useAuth()
  return (
    <div className="relative min-h-screen flex flex-col" style={{ zIndex: 1 }}>
      <div className={`flex-1 ${user ? 'md:pl-56' : ''}`}>
        <Routes>
          <Route path="/"     element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/*"   element={<AuthGuard />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthSync />
        <MoodProvider>
        <div className="ambient-bg" aria-hidden>
          <div className="ambient-orb-1" />
          <div className="ambient-orb-2" />
          <div className="ambient-orb-3" />
        </div>
        <AppLayout />
        </MoodProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
