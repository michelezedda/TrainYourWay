import { Component, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import Home from '@/pages/Home'
import Questionnaire from '@/pages/Questionnaire'
import ReevaluateQuestionnaire from '@/pages/ReevaluateQuestionnaire'
import Results from '@/pages/Results'
import History from '@/pages/History'
import Generating from '@/pages/Generating'
import Diet from '@/pages/Diet'
import Chat from '@/pages/Chat'
import ImportPlan from '@/pages/ImportPlan'
import Support from '@/pages/Support'
import Personal from '@/pages/Personal'
import Scanner from '@/pages/Scanner'
import Community from '@/pages/Community'

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

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Header />
          <div className="flex-1 pb-nav">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/questionnaire" element={<Questionnaire />} />
              <Route path="/reevaluate" element={<ReevaluateQuestionnaire />} />
              <Route path="/generating" element={<Generating />} />
              <Route path="/results" element={<Results />} />
              <Route path="/history" element={<History />} />
              <Route path="/diet" element={<Diet />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/import" element={<ImportPlan />} />
              <Route path="/support" element={<Support />} />
              <Route path="/me" element={<Personal />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/community" element={<Community />} />
            </Routes>
          </div>
          <BottomNav />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
