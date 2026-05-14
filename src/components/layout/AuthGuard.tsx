import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { db } from '@/lib/db'
import Dashboard from '@/pages/dashboard/Dashboard'
import Reevaluate from '@/pages/training/Reevaluate'
import Results from '@/pages/training/Results'
import History from '@/pages/training/History'
import Generating from '@/pages/onboarding/Generating'
import Diet from '@/pages/nutrition/Diet'
import Chat from '@/pages/coach/Chat'
import Import from '@/pages/training/Import'
import Support from '@/pages/support/Support'
import Settings from '@/pages/settings/Settings'
import Scanner from '@/pages/nutrition/Scanner'
import Community from '@/pages/community/Community'
import MachineGuide from '@/pages/training/MachineGuide'
import Wellness from '@/pages/wellness/Wellness'
import Summary from '@/pages/onboarding/Summary'
import Breathing from '@/pages/wellness/Breathing'
import Focus from '@/pages/wellness/Focus'
import Journal from '@/pages/wellness/Journal'
import Session from '@/pages/wellness/Session'
import Affirmations from '@/pages/wellness/Affirmations'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
    </div>
  )
}

export default function AuthGuard() {
  const { isLoading, user } = db.useAuth()
  const location = useLocation()

  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />

  return (
    <Routes>
      <Route path="/dashboard"              element={<Dashboard />} />
      <Route path="/reevaluate"             element={<Reevaluate />} />
      <Route path="/generating"             element={<Generating />} />
      <Route path="/results"                element={<Results />} />
      <Route path="/history"                element={<History />} />
      <Route path="/diet"                   element={<Diet />} />
      <Route path="/chat"                   element={<Chat />} />
      <Route path="/import"                 element={<Import />} />
      <Route path="/support"                element={<Support />} />
      <Route path="/me"                     element={<Settings />} />
      <Route path="/scanner"                element={<Scanner />} />
      <Route path="/community"              element={<Community />} />
      <Route path="/machine"                element={<MachineGuide />} />
      <Route path="/onboarding-summary"     element={<Summary />} />
      <Route path="/wellness"               element={<Wellness />} />
      <Route path="/wellness/breathing"     element={<Breathing />} />
      <Route path="/wellness/focus"         element={<Focus />} />
      <Route path="/wellness/journal"       element={<Journal />} />
      <Route path="/wellness/affirmations"  element={<Affirmations />} />
      <Route path="/wellness/meditate"      element={<Session />} />
      <Route path="/wellness/sleep"         element={<Session />} />
      <Route path="/wellness/session/:type" element={<Session />} />
    </Routes>
  )
}
