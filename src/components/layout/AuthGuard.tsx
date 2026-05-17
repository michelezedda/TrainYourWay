import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { db } from '@/lib/db'
import LoadingSpinner from '@/components/LoadingSpinner'

const Dashboard    = lazy(() => import('@/pages/dashboard/Dashboard'))
const Reevaluate   = lazy(() => import('@/pages/training/Reevaluate'))
const Results      = lazy(() => import('@/pages/training/Results'))
const Workout      = lazy(() => import('@/pages/training/Workout'))
const Generating   = lazy(() => import('@/pages/onboarding/Generating'))
const Diet         = lazy(() => import('@/pages/nutrition/Diet'))
const Import       = lazy(() => import('@/pages/training/Import'))
const Support      = lazy(() => import('@/pages/support/Support'))
const Settings     = lazy(() => import('@/pages/settings/Settings'))
const FoodScanner  = lazy(() => import('@/pages/nutrition/FoodScanner'))
const Community    = lazy(() => import('@/pages/community/Community'))
const MachineScanner = lazy(() => import('@/pages/training/MachineScanner'))
const Wellness     = lazy(() => import('@/pages/wellness/Wellness'))
const Breathing    = lazy(() => import('@/pages/wellness/Breathing'))
const Focus        = lazy(() => import('@/pages/wellness/Focus'))
const Journal      = lazy(() => import('@/pages/wellness/Journal'))
const Session      = lazy(() => import('@/pages/wellness/Session'))
const Affirmations = lazy(() => import('@/pages/wellness/Affirmations'))

// Routes that are part of the onboarding flow itself — must be accessible
// even before a plan exists, so we don't redirect away mid-generation.
const ONBOARDING_FLOW = ['/generating', '/results']

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="md" />
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
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/dashboard"              element={<Dashboard />} />
        <Route path="/reevaluate"             element={<Reevaluate />} />
        <Route path="/generating"             element={<Generating />} />
        <Route path="/results"                element={<Results />} />
        <Route path="/workout"                 element={<Workout />} />
        <Route path="/diet"                   element={<Diet />} />
        <Route path="/import"                 element={<Import />} />
        <Route path="/support"                element={<Support />} />
        <Route path="/me"                     element={<Settings />} />
        <Route path="/scanner"                element={<FoodScanner />} />
        <Route path="/community"              element={<Community />} />
        <Route path="/machine"                element={<MachineScanner />} />
        <Route path="/wellness"               element={<Wellness />} />
        <Route path="/wellness/breathing"     element={<Breathing />} />
        <Route path="/wellness/focus"         element={<Focus />} />
        <Route path="/wellness/journal"       element={<Journal />} />
        <Route path="/wellness/affirmations"  element={<Affirmations />} />
        <Route path="/wellness/meditate"      element={<Session />} />
        <Route path="/wellness/sleep"         element={<Session />} />
        <Route path="/wellness/session/:type" element={<Session />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
