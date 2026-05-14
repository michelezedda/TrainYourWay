import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowNarrowLeft, HiArrowNarrowRight } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'

// ── Affirmations ──────────────────────────────────────────────────────────────

interface Affirmation {
  text: string
  category: string
  icon: string
  color: string
}

const AFFIRMATIONS: Affirmation[] = [
  { text: 'Your consistency is building something great.', category: 'Progress', icon: '📈', color: '#A855F7' },
  { text: 'Rest is part of the process, not a break from it.', category: 'Recovery', icon: '🌙', color: '#6366F1' },
  { text: "You don't need to earn your peace today.", category: 'Self-care', icon: '🕊️', color: '#22D3EE' },
  { text: 'Small steps compound into massive results.', category: 'Mindset', icon: '⚡', color: '#FBBF24' },
  { text: 'Your mind is as important as your body.', category: 'Balance', icon: '🧠', color: '#818CF8' },
  { text: "Progress isn't always visible, but it's always happening.", category: 'Patience', icon: '🌱', color: '#34D399' },
  { text: 'You are stronger than you think.', category: 'Strength', icon: '💪', color: '#F87171' },
  { text: 'Recovery is where growth really happens.', category: 'Recovery', icon: '🔄', color: '#6366F1' },
  { text: "It's okay to take things one breath at a time.", category: 'Calm', icon: '🌊', color: '#22D3EE' },
  { text: 'Every day you show up is a win.', category: 'Progress', icon: '🏆', color: '#FBBF24' },
  { text: 'Be patient with yourself. Transformation takes time.', category: 'Patience', icon: '🦋', color: '#A855F7' },
  { text: 'The work you do in silence speaks loudest.', category: 'Commitment', icon: '🎯', color: '#818CF8' },
  { text: "Your effort today is tomorrow's baseline.", category: 'Mindset', icon: '📊', color: '#34D399' },
  { text: 'Rest is productive. Stillness has power.', category: 'Recovery', icon: '🌿', color: '#10B981' },
  { text: 'You are more resilient than yesterday.', category: 'Growth', icon: '🔥', color: '#F87171' },
  { text: 'Breathe. You are exactly where you need to be.', category: 'Calm', icon: '🌬️', color: '#22D3EE' },
  { text: 'Strength includes knowing when to slow down.', category: 'Balance', icon: '⚖️', color: '#818CF8' },
  { text: 'Your best looks different every day. Both are valid.', category: 'Self-care', icon: '💛', color: '#FBBF24' },
  { text: 'The comeback is always stronger than the setback.', category: 'Resilience', icon: '⬆️', color: '#A855F7' },
  { text: 'Take care of your mind and your body will follow.', category: 'Mindset', icon: '🧘', color: '#6366F1' },
  { text: 'You are enough, exactly as you are right now.', category: 'Self-worth', icon: '✨', color: '#FBBF24' },
  { text: 'Every rep, every breath, every choice adds up.', category: 'Commitment', icon: '💪', color: '#F87171' },
  { text: 'Discipline is self-love in its most honest form.', category: 'Growth', icon: '🌟', color: '#A855F7' },
  { text: 'Your body is capable of more than your mind believes.', category: 'Strength', icon: '🦾', color: '#34D399' },
  { text: "Showing up on hard days is what separates you.", category: 'Resilience', icon: '🛡️', color: '#818CF8' },
]

const CATEGORIES = ['All', ...Array.from(new Set(AFFIRMATIONS.map(a => a.category)))]

// ── Main component ────────────────────────────────────────────────────────────

export default function WellnessAffirmations() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('All')
  const [cardIdx, setCardIdx] = useState(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
    return dayOfYear % AFFIRMATIONS.length
  })
  const [dir, setDir] = useState(1)

  const filtered = activeCategory === 'All' ? AFFIRMATIONS : AFFIRMATIONS.filter(a => a.category === activeCategory)
  const safeIdx = cardIdx % filtered.length
  const current = filtered[safeIdx]

  const goNext = () => { setDir(1); setCardIdx(i => (i + 1) % filtered.length) }
  const goPrev = () => { setDir(-1); setCardIdx(i => (i - 1 + filtered.length) % filtered.length) }

  const cardVariants = {
    enter: (d: number) => ({ x: d > 0 ? '60%' : '-60%', opacity: 0, scale: 0.92 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-60%' : '60%', opacity: 0, scale: 0.92 }),
  }

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate('/wellness')}
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <HiArrowNarrowLeft className="w-5 h-5 text-white/60" />
        </button>
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #FBBF24, #A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Affirmations
          </h1>
          <p className="text-white/35 text-sm">Words that remind you who you are.</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-7 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setCardIdx(0) }}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={activeCategory === cat ? {
              background: 'rgba(168,85,247,0.2)', borderColor: 'rgba(168,85,247,0.45)', color: '#c084fc',
            } : {
              background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main affirmation card */}
      <div className="relative overflow-hidden mb-6" style={{ minHeight: 280 }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={`${activeCategory}-${safeIdx}`}
            custom={dir}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-0"
          >
            <div className="h-full rounded-3xl flex flex-col justify-between px-6 py-8"
              style={{
                background: `linear-gradient(135deg, ${current.color}18 0%, ${current.color}08 100%)`,
                border: `1px solid ${current.color}30`,
              }}>
              <div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-6"
                  style={{ background: `${current.color}15`, border: `1px solid ${current.color}25` }}>
                  {current.icon}
                </div>
                <p className="text-white font-bold text-xl leading-relaxed">
                  "{current.text}"
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: `${current.color}15`, color: current.color, border: `1px solid ${current.color}25` }}>
                  {current.category}
                </span>
                <span className="text-white/25 text-xs">{safeIdx + 1} / {filtered.length}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={goPrev}
          className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-all active:scale-[0.97]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)' }}
        >
          <HiArrowNarrowLeft className="w-4 h-4" />
          Previous
        </button>
        <button
          onClick={goNext}
          className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-all active:scale-[0.97]"
          style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}
        >
          Next
          <HiArrowNarrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Full list */}
      <div>
        <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">All affirmations</p>
        <div className="space-y-2">
          {filtered.map((aff, i) => (
            <button
              key={i}
              onClick={() => { setDir(i > safeIdx ? 1 : -1); setCardIdx(i) }}
              className="w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98]"
              style={i === safeIdx ? {
                background: `${aff.color}12`, borderColor: `${aff.color}30`,
              } : {
                background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <span className="text-lg flex-shrink-0 mt-0.5">{aff.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-sm leading-relaxed">{aff.text}</p>
                <p className="text-white/25 text-[10px] mt-0.5 font-medium uppercase tracking-wider">{aff.category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
