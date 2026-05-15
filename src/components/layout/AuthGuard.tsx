import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { db } from '@/lib/db'
import Dashboard from '@/pages/dashboard/Dashboard'
import Reevaluate from '@/pages/training/Reevaluate'
import Results from '@/pages/training/Results'
import Workout from '@/pages/training/Workout'
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
import Breathing from '@/pages/wellness/Breathing'
import Focus from '@/pages/wellness/Focus'
import Journal from '@/pages/wellness/Journal'
import Session from '@/pages/wellness/Session'
import Affirmations from '@/pages/wellness/Affirmations'

// Routes that are part of the onboarding flow itself — must be accessible
// even before a plan exists, so we don't redirect away mid-generation.
const ONBOARDING_FLOW = ['/generating', '/results']

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

  // Query the user's plans from the DB — this is the source of truth for
  // onboarding completion. localStorage alone can't be trusted across devices
  // or after a manual clear.
  const { data: planData, isLoading: plansLoading } = db.useQuery({
    workoutPlans: { $: { where: { userId: user?.id ?? '' } } },
  })

  // Wait for both auth state and plan data before making any routing decision.
  if (isLoading || (user && plansLoading)) return <Spinner />

  // Not authenticated — send to auth screen, preserving the intended destination.
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />

  // Check onboarding completion via DB (cross-device, not localStorage).
  const hasCompletedOnboarding = (planData?.workoutPlans ?? []).length > 0
  const inOnboardingFlow = ONBOARDING_FLOW.some(p => location.pathname.startsWith(p))

  // Authenticated but no plan yet — must complete onboarding first.
  // Allow through if already mid-flow (generating/results/summary).
  if (!hasCompletedOnboarding && !inOnboardingFlow) {
    return <Navigate to="/questionnaire" replace />
  }

  return (
    <Routes>
      <Route path="/dashboard"              element={<Dashboard />} />
      <Route path="/reevaluate"             element={<Reevaluate />} />
      <Route path="/generating"             element={<Generating />} />
      <Route path="/results"                element={<Results />} />
      <Route path="/workout"                 element={<Workout />} />
      <Route path="/diet"                   element={<Diet />} />
      <Route path="/chat"                   element={<Chat />} />
      <Route path="/import"                 element={<Import />} />
      <Route path="/support"                element={<Support />} />
      <Route path="/me"                     element={<Settings />} />
      <Route path="/scanner"                element={<Scanner />} />
      <Route path="/community"              element={<Community />} />
      <Route path="/machine"                element={<MachineGuide />} />
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
