import { Link, Navigate } from 'react-router-dom'
import { HiArrowNarrowRight, HiQuestionMarkCircle } from 'react-icons/hi'
import GlassCard from '@/components/GlassCard'
import { db } from '@/lib/db'

const features = [
  {
    icon: '🔍',
    title: 'Equipment Analysis',
    desc: 'Tell us what equipment you actually have: dumbbells, resistance bands, benches, pull-up bars, or just bodyweight. Your plan adapts to your setup, whether you train at home or in a full gym.',
  },
  {
    icon: '📸',
    title: 'Photo Recognition',
    desc: 'Upload photos of your gym setup, meals, or workout machines. The app can recognize your equipment, analyze food, identify gym machines, and give smart training and nutrition suggestions.',
  },
  {
    icon: '🥗',
    title: 'Dietary Profile',
    desc: 'Choose your diet type, flag allergies, and set meal frequency. Your nutrition targets and food strategy are tailored to match.',
  },
  {
    icon: '🎯',
    title: 'Fully Personalized',
    desc: 'Goals, fitness level, schedule, injuries, and diet. Every detail shapes a plan that is genuinely yours.',
  },
  {
    icon: '🤖',
    title: 'Meet Kai, Your AI Coach',
    desc: 'Ask Kai anything about your training, nutrition, or recovery at any time. Real answers, not generic advice.',
  },
  {
    icon: '📈',
    title: 'Built to Progress',
    desc: 'Evolve your plan every four weeks as you get stronger. Weights, reps, and exercises adapt with you.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Tell us about yourself',
    desc: 'Goals, equipment, fitness level, schedule, diet type, and allergies. Optionally upload photos of your space.',
    icon: '📋',
  },
  {
    number: '02',
    title: 'UPLIFT analyses everything',
    desc: 'Your profile, photos, dietary needs, and training space are all considered before crafting a plan built specifically for you.',
    icon: '🤖',
  },
  {
    number: '03',
    title: 'Train, eat, and evolve',
    desc: 'Get a full week-by-week plan with sets, reps, rest periods, macro targets, and meal guidance. Ask Kai anything along the way.',
    icon: '💪',
  },
]

const planIncludes = [
  { icon: '📅', text: 'Full weekly schedule with training and rest days' },
  { icon: '🔢', text: 'Sets, reps, rest periods, and weight ranges for every exercise' },
  { icon: '▶️', text: 'Step-by-step instructions for every movement' },
  { icon: '🔥', text: 'Warm-up and cool-down routines for each session' },
  { icon: '📊', text: '4-8 week progression plan to keep you improving' },
  { icon: '🍽️', text: 'Daily calorie and macro targets matched to your dietary profile' },
  { icon: '🥗', text: 'Nutrition strategy aligned with your diet type and goals' },
  { icon: '⚖️', text: 'Honest assessment of your starting point and what to expect' },
  { icon: '🔄', text: 'Plan evolution every 4 weeks to match your progress' },
  { icon: '💬', text: 'On-demand guidance from Kai, your personal AI coach' },
]

const stats = [
  { value: '< 5 min', label: 'to set up your profile' },
  { value: '< 30s', label: 'to generate your plan' },
  { value: '100%', label: 'tailored to you' },
  { value: 'Free', label: 'no subscription needed' },
]

export default function Home() {
  const { isLoading, user } = db.useAuth()

  if (isLoading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <main className="relative overflow-hidden">
      {/* Background orbs */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute top-32 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute top-[60%] left-1/3 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-4 leading-none">
          <span className="gradient-text">UPLIFT</span>
        </h1>
        <p className="text-white text-sm sm:text-base font-semibold tracking-[0.25em] uppercase mb-4" style={{ textShadow: '0 0 20px rgba(255,255,255,0.6), 0 0 40px rgba(255,255,255,0.2)' }}>
          Train Your Way
        </p>

        <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-4 leading-relaxed">
          Answer a few questions about your goals, equipment, and diet. Get a professional workout
          and nutrition plan built around who you are, generated in seconds.
        </p>
        <p className="text-sm text-white/30 max-w-lg mx-auto mb-10">
          No gym required. Just results.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to={user ? '/questionnaire' : '/auth'} className="btn-primary text-base">
            {user ? 'Build My Plan' : 'Get Started for Free'}
            <HiArrowNarrowRight className="w-5 h-5" />
          </Link>
          <Link to={user ? '/chat' : '/auth'} className="btn-ghost text-base">
            {user ? 'Talk to Kai' : 'Sign In'}
          </Link>
        </div>

        <div className="mt-5">
          <Link
            to="/import"
            className="inline-flex items-center gap-2 text-sm text-white/35 hover:text-white/60 transition-colors group"
          >
            <span
              className="w-7 h-7 rounded-xl flex items-center justify-center text-base flex-shrink-0 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              📋
            </span>
            Already have a plan? Import and analyse it
            <HiArrowNarrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-80 transition-opacity" />
          </Link>
        </div>
      </section>

      {/* Stats strip */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center py-5 px-3 rounded-3xl border border-white/8 text-center"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <span
                className="text-2xl sm:text-3xl font-black mb-1"
                style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                {s.value}
              </span>
              <span className="text-white/40 text-xs leading-snug">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">How it works</h2>
          <p className="text-white/40 max-w-md mx-auto">Three steps from zero to a full training and nutrition programme.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
          <div className="hidden sm:block absolute top-10 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), rgba(34,211,238,0.3), transparent)' }}
          />

          {steps.map((step, i) => (
            <GlassCard key={i} className="relative text-center">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 mb-1"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
                >
                  {step.icon}
                </div>
                <span
                  className="text-xs font-black tracking-widest"
                  style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  {step.number}
                </span>
                <h3 className="font-bold text-white text-base">{step.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Everything that gets considered</h2>
          <p className="text-white/40 max-w-md mx-auto">No two plans are the same, because no two people are.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <GlassCard key={f.title} hover className="animate-fade-in">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* What's in your plan */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid sm:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              What's inside every plan
            </h2>
            <p className="text-white/45 leading-relaxed mb-6">
              Not a generic template. Every plan is generated fresh from your answers and adapted
              to your environment, your schedule, your diet, and your body.
            </p>
            <Link to={user ? '/questionnaire' : '/auth'} className="btn-primary inline-flex">
              Get started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </Link>
          </div>

          <GlassCard padding={false}>
            <ul className="divide-y divide-white/5">
              {planIncludes.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <span className="text-white/65 text-sm leading-snug">{item.text}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* Kai callout */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div
          className="rounded-3xl border border-white/20 px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-8"
          style={{ background: 'rgba(168,85,247,0.06)' }}
        >
          <img src="/kai-avatar.svg" alt="Kai" className="w-16 h-16 rounded-full flex-shrink-0" />
          <div className="flex-1 text-center sm:text-left sm:px-4">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="text-white font-bold text-lg">Meet Kai</span>
              <span
                className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ color: 'rgba(167,139,250,0.8)', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(168,85,247,0.08)' }}
              >
                AI Coach
              </span>
            </div>
            <p className="text-white/45 text-sm leading-relaxed">
              Kai is your on-demand fitness and nutrition coach. Ask about your workout plan, macro targets,
              recovery strategies, or anything else related to your training. Available any time, right inside the app.
            </p>
          </div>
          <Link to={user ? '/chat' : '/auth'} className="btn-primary flex-shrink-0 text-sm !px-6">
            Chat with Kai
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div
          className="relative rounded-3xl overflow-hidden border border-white/10 px-8 py-16 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(34,211,238,0.06) 100%)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.15) 0%, transparent 70%)' }}
          />
          <h2 className="relative text-3xl sm:text-4xl font-black text-white mb-4">
            Ready to train smarter?
          </h2>
          <p className="relative text-white/45 max-w-md mx-auto mb-8 leading-relaxed">
            Your personalised training and nutrition plan is waiting. Takes five minutes to set up and zero equipment to get started.
          </p>
          <Link to={user ? '/questionnaire' : '/auth'} className="btn-primary text-base relative inline-flex">
            {user ? 'Build My Plan Now' : 'Get Started for Free'}
            <HiArrowNarrowRight className="w-5 h-5" />
          </Link>
          <div className="relative mt-6">
            <Link
              to="/support"
              className="inline-flex items-center gap-2 text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.32)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.32)')}
            >
              <HiQuestionMarkCircle className="w-4 h-4" />
              Need help or have feedback?
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
