import { useState, useRef, useEffect } from 'react'
import { HiPaperAirplane, HiRefresh } from 'react-icons/hi'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { sendChatMessage, type ChatMessage } from '@/lib/gemini'

type WorkoutPlan = { id: string; plan: string; createdAt: number }
type MealEntry = { id: string; meal: string; description: string; kcal: number }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Suggestion data ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all', label: 'Top picks', icon: '✨' },
  { id: 'training', label: 'Training', icon: '🏋️' },
  { id: 'nutrition', label: 'Nutrition', icon: '🥗' },
  { id: 'recovery', label: 'Recovery', icon: '😴' },
  { id: 'progress', label: 'Progress', icon: '📈' },
]

const SUGGESTIONS: Record<string, { icon: string; text: string }[]> = {
  all: [
    { icon: '🍽', text: 'What should I eat around my workouts?' },
    { icon: '💪', text: 'How do I increase my lifts week over week?' },
    { icon: '📊', text: 'Is my calorie intake on track today?' },
    { icon: '😴', text: 'How can I improve recovery between sessions?' },
  ],
  training: [
    { icon: '💪', text: 'Best rep range for muscle growth?' },
    { icon: '🏋️', text: 'When should I add more weight to my lifts?' },
    { icon: '🔄', text: 'Should I train to failure on every set?' },
    { icon: '⚡', text: 'Can you explain progressive overload?' },
  ],
  nutrition: [
    { icon: '🍳', text: 'What is the best pre-workout meal for energy?' },
    { icon: '🥩', text: 'How much protein do I actually need per day?' },
    { icon: '🌾', text: 'Are carbs bad for weight loss?' },
    { icon: '🍫', text: 'What are some high-protein snacks?' },
  ],
  recovery: [
    { icon: '🌙', text: 'How much sleep do I need for muscle growth?' },
    { icon: '🤕', text: 'What actually helps with muscle soreness?' },
    { icon: '📅', text: 'How do I know when to take a rest day?' },
    { icon: '🚶', text: 'What is active recovery and when should I do it?' },
  ],
  progress: [
    { icon: '🚧', text: 'How do I break through a training plateau?' },
    { icon: '⏱', text: 'How fast should I realistically see results?' },
    { icon: '📏', text: 'What metrics should I track for progress?' },
    { icon: '🤔', text: 'My weight is stable but I look better - why?' },
  ],
}

const FOLLOW_UP_POOLS = [
  ['Tell me more about that', 'How do I apply this to my plan?'],
  ['What should I prioritize first?', 'Any common mistakes to avoid?'],
  ['How long before I see results?', 'Can you give me a concrete example?'],
  ['What should I do on rest days?', 'Does this apply to beginners too?'],
  ['How does nutrition play into this?', 'How often should I do this?'],
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function KaiAvatar({ size = 'sm', thinking = false }: { size?: 'sm' | 'md' | 'lg'; thinking?: boolean }) {
  const dim = size === 'lg' ? 64 : size === 'md' ? 44 : 32
  return (
    <div className="relative flex-shrink-0" style={{ width: dim, height: dim }}>
      {/* Thinking pulse ring */}
      {thinking && (
        <span className="absolute inset-0 rounded-full animate-ping"
          style={{ background: 'rgba(168,85,247,0.3)', animationDuration: '1.4s' }} />
      )}
      {/* Online ring */}
      <div className="absolute inset-0 rounded-full"
        style={{ boxShadow: thinking ? '0 0 16px rgba(168,85,247,0.5)' : '0 0 10px rgba(168,85,247,0.25)' }} />
      <img src="/kai-avatar.svg" alt="KAI"
        className="w-full h-full rounded-full"
        style={{ transition: 'box-shadow 0.4s' }}
      />
      {/* Status dot */}
      {size !== 'sm' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
          style={{ background: thinking ? '#A855F7' : '#4ade80', borderColor: '#050510' }}>
          {thinking && <span className="absolute inset-0 rounded-full animate-ping bg-purple-400 opacity-60" />}
        </span>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="flex items-end gap-2.5"
    >
      <KaiAvatar thinking />
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-bl-sm"
          style={{ background: 'rgba(168,85,247,0.09)', border: '1px solid rgba(168,85,247,0.22)' }}>
          <span className="text-purple-300/70 text-[11px] font-medium tracking-wide">Thinking</span>
          <div className="flex gap-1.5 items-center">
            {[0, 220, 440].map((delay, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-typing-dot"
                style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', animationDelay: `${delay}ms` }} />
            ))}
          </div>
        </div>
        <span className="text-white/20 text-[10px] px-1">KAI is composing a response</span>
      </div>
    </motion.div>
  )
}

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="space-y-1.5 mb-2 pl-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="space-y-1.5 mb-2 pl-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex gap-2 items-start">
      <span className="text-purple-400/70 mt-0.5 flex-shrink-0 text-[10px]">▸</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="text-white font-semibold">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="text-cyan-300/80 not-italic font-medium">{children}</em>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-purple-300">{children}</code>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-white font-bold text-sm mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-white/80 font-semibold text-sm mt-2 mb-1">{children}</h3>,
}

// ── Context badges ──────────────────────────────────────────────────────────────

function ContextBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex bg-green-500 items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{
        background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.2)',
        color: 'rgba(134,239,172,0.85)'
      }}>
      <span>{icon}</span>
      {label}
    </span>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({
  hasplan, hasNutrition, todayKcal,
  onSend,
}: {
  hasplan: boolean; hasNutrition: boolean; todayKcal: number;
  onSend: (text: string) => void;
}) {
  const [cat, setCat] = useState('all')
  const list = SUGGESTIONS[cat] ?? SUGGESTIONS.all

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      {/* Hero intro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col items-center text-center px-4 pt-6 pb-5"
      >
        <div className="relative mb-5">
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full scale-125 opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 70%)' }} />
          <KaiAvatar size="lg" />
        </div>
        <h2 className="text-white font-black text-xl tracking-tight mb-1">Hey, I'm KAI</h2>
        <p className="text-white/45 text-sm max-w-[260px] leading-relaxed">
          Your AI fitness and nutrition coach. Ask me anything about training, food, or recovery.
        </p>

        {/* Context badges */}
        {(hasplan || hasNutrition || todayKcal > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-2 mt-4"
          >
            {hasplan && <ContextBadge icon="📋" label="Plan linked" />}
            {hasNutrition && <ContextBadge icon="🥗" label="Nutrition synced" />}
            {todayKcal > 0 && <ContextBadge icon="🍽" label={`${todayKcal.toLocaleString()} kcal today`} />}
          </motion.div>
        )}
      </motion.div>

      {/* Category tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
        className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar flex-shrink-0"
      >
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 ${cat === c.id
              ? 'text-white'
              : 'text-white/40 hover:text-white/65'
              }`}
            style={cat === c.id ? {
              background: 'rgba(168,85,247,0.18)',
              border: '1px solid rgba(168,85,247,0.35)',
              boxShadow: '0 0 12px rgba(168,85,247,0.2)',
            } : {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </motion.div>

      {/* Suggestion cards */}
      <div className="px-4 pb-6 space-y-2.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={cat}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="space-y-2.5"
          >
            {list.map((s, i) => (
              <motion.button
                key={s.text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.2 }}
                onClick={() => onSend(s.text)}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 active:scale-[0.98] group"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                whileHover={{ borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' }}
              >
                <span className="text-xl flex-shrink-0 w-8 text-center">{s.icon}</span>
                <span className="text-white/65 text-sm leading-snug group-hover:text-white/85 transition-colors">{s.text}</span>
                <span className="ml-auto text-white/15 group-hover:text-purple-400/50 transition-colors flex-shrink-0 text-sm">›</span>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const userId = getUserId()
  const profile = getNutritionProfile()
  const targets = profile ? calculateTargets(profile) : null

  const { data: plansData } = db.useQuery({ workoutPlans: { $: { where: { userId } } } })
  const { data: mealsData } = db.useQuery({ mealEntries: { $: { where: { userId, date: toDateStr(new Date()) } } } })

  const latestPlan = ((plansData?.workoutPlans ?? []) as WorkoutPlan[])
    .sort((a, b) => b.createdAt - a.createdAt)[0]?.plan ?? null
  const todayMeals = (mealsData?.mealEntries ?? []) as MealEntry[]
  const todayKcal = todayMeals.reduce((a, m) => a + (m.kcal || 0), 0)

  const contextParts: string[] = []
  if (profile && targets) {
    contextParts.push(
      `USER PROFILE:\n` +
      `- Sex: ${profile.sex}, Age: ${profile.age}, Weight: ${profile.weight}kg, Height: ${profile.height}cm\n` +
      `- Goals: ${profile.goals.join(', ')}\n` +
      `- Training: ${profile.daysPerWeek} days/week\n` +
      `- Daily targets: ${targets.kcal} kcal, protein ${targets.protein}g, carbs ${targets.carbs}g, fat ${targets.fat}g` +
      (profile.dietType ? `\n- Diet: ${profile.dietType}${profile.allergies?.length ? `, avoiding ${profile.allergies.join(', ')}` : ''}` : ''),
    )
  }
  if (latestPlan) {
    const excerpt = latestPlan.replace(/```[\s\S]*?```/g, '').slice(0, 700).trim()
    contextParts.push(`CURRENT WORKOUT PLAN (excerpt):\n${excerpt}`)
  }
  if (todayMeals.length > 0) {
    const lines = todayMeals.map(m => `- ${m.meal}: ${m.description} (${m.kcal} kcal)`)
    contextParts.push(`TODAY'S FOOD LOG (${Math.round(todayKcal)} kcal total):\n${lines.join('\n')}`)
  }
  const userContext = contextParts.join('\n\n')

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const [reply] = await Promise.all([
        sendChatMessage(next, userContext),
        new Promise<void>(resolve => setTimeout(resolve, 700)),
      ])
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong on my end. Please try again.' },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const isEmpty = messages.length === 0

  const followUps = FOLLOW_UP_POOLS[Math.floor(messages.length / 2) % FOLLOW_UP_POOLS.length]

  return (
    <main className="max-w-lg md:max-w-2xl mx-auto px-4 flex flex-col chat-height">

      {/* ── Header ── */}
      <div className="flex-shrink-0 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KaiAvatar size="md" thinking={loading} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black gradient-text leading-none tracking-tight">KAI</h1>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ color: 'rgba(167,139,250,0.85)', border: '1px solid rgba(167,139,250,0.22)', background: 'rgba(168,85,247,0.1)' }}>
                AI Coach
              </span>
            </div>
            <p className="text-[11px] mt-0.5 transition-colors duration-300" style={{ color: loading ? 'rgba(167,139,250,0.7)' : 'rgba(255,255,255,0.35)' }}>
              {loading ? 'Composing a response...' : 'Online and ready to help'}
            </p>
          </div>
        </div>

        {/* Clear chat button */}
        {!isEmpty && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setMessages([])}
            title="New conversation"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <HiRefresh className="w-4 h-4 text-white/40" />
          </motion.button>
        )}
      </div>

      {/* ── Empty state ── */}
      {isEmpty && (
        <EmptyState
          hasplan={!!latestPlan}
          hasNutrition={!!profile}
          todayKcal={todayKcal}
          onSend={text => void handleSend(text)}
        />
      )}

      {/* ── Messages ── */}
      {!isEmpty && (
        <div ref={messagesRef} className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-3 pr-1">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              const isLastKai = !isUser && i === messages.length - 1

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {!isUser && <KaiAvatar />}

                    <div className={`max-w-[82%] text-[14.5px] leading-relaxed ${isUser ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'}`}
                      style={isUser ? {
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                        color: 'white',
                        boxShadow: '0 4px 20px rgba(168,85,247,0.35)',
                      } : {
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        color: 'rgba(255,255,255,0.82)',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                      }}
                    >
                      {isUser ? (
                        msg.content
                      ) : (
                        <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                      )}
                    </div>
                  </div>

                  {/* Follow-up chips after last KAI message */}
                  {isLastKai && !loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35, duration: 0.22 }}
                      className="flex flex-wrap gap-2 mt-2.5 pl-10"
                    >
                      {followUps.map(chip => (
                        <button
                          key={chip}
                          onClick={() => void handleSend(chip)}
                          className="text-xs px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95 hover:border-purple-500/40 hover:bg-purple-500/12"
                          style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.22)', color: 'rgba(196,165,255,0.8)' }}
                        >
                          {chip}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {loading && <TypingIndicator />}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 pt-2 pb-3">
        <motion.div
          animate={focused ? { boxShadow: '0 0 0 1.5px rgba(168,85,247,0.45), 0 4px 24px rgba(168,85,247,0.15)' } : { boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3 px-4 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.11)',
            minHeight: 58,
          }}
        >
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-white placeholder-white/28 py-4"
            style={{ fontSize: 16 }}
            placeholder="Ask KAI anything..."
            value={input}
            disabled={loading}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
            }}
          />

          <motion.button
            onClick={() => void handleSend()}
            disabled={!input.trim() || loading}
            whileTap={{ scale: 0.88 }}
            animate={input.trim() && !loading
              ? { scale: 1, opacity: 1 }
              : { scale: 0.9, opacity: 0.3 }
            }
            transition={{ duration: 0.15 }}
            className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', boxShadow: '0 2px 12px rgba(168,85,247,0.4)' }}
            aria-label="Send message"
          >
            <HiPaperAirplane className="w-4 h-4 text-white" style={{ transform: 'rotate(90deg)' }} />
          </motion.button>
        </motion.div>

        {/* Hint row */}
        <div className="flex items-center justify-between px-1 mt-1.5 pb-2">
          <span className="text-[10px] text-red-500/60">&#9888;
            KAI can make mistakes.</span>
        </div>
      </div>
    </main>
  )
}
