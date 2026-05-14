import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { db } from '@/lib/db'
import Dashboard from '@/pages/Dashboard'
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
import MachineGuide from '@/pages/MachineGuide'
import Wellness from '@/pages/Wellness'
import OnboardingSummary from '@/pages/OnboardingSummary'
import WellnessBreathing from '@/pages/WellnessBreathing'
import WellnessFocus from '@/pages/WellnessFocus'
import WellnessJournal from '@/pages/WellnessJournal'
import WellnessSession from '@/pages/WellnessSession'
import WellnessAffirmations from '@/pages/WellnessAffirmations'

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
      <Route path="/dashboard"     element={<Dashboard />} />
      <Route path="/reevaluate"    element={<ReevaluateQuestionnaire />} />
      <Route path="/generating"    element={<Generating />} />
      <Route path="/results"       element={<Results />} />
      <Route path="/history"       element={<History />} />
      <Route path="/diet"          element={<Diet />} />
      <Route path="/chat"          element={<Chat />} />
      <Route path="/import"        element={<ImportPlan />} />
      <Route path="/support"       element={<Support />} />
      <Route path="/me"            element={<Personal />} />
      <Route path="/scanner"              element={<Scanner />} />
      <Route path="/community"            element={<Community />} />
      <Route path="/machine"              element={<MachineGuide />} />
      <Route path="/onboarding-summary"    element={<OnboardingSummary />} />
      <Route path="/wellness"             element={<Wellness />} />
      <Route path="/wellness/breathing"   element={<WellnessBreathing />} />
      <Route path="/wellness/focus"       element={<WellnessFocus />} />
      <Route path="/wellness/journal"     element={<WellnessJournal />} />
      <Route path="/wellness/affirmations" element={<WellnessAffirmations />} />
      <Route path="/wellness/meditate"    element={<WellnessSession />} />
      <Route path="/wellness/sleep"       element={<WellnessSession />} />
      <Route path="/wellness/session/:type" element={<WellnessSession />} />
    </Routes>
  )
}
