import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { sendChatMessage, type ChatMessage } from '@/lib/gemini'

type WorkoutPlan = { id: string; plan: string; createdAt: number }
type MealEntry  = { id: string; meal: string; description: string; kcal: number }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SUGGESTIONS = [
  'What should I eat around my workouts?',
  'How do I increase my lifts week over week?',
  'Is my calorie intake on track today?',
  'How can I improve my recovery between sessions?',
]

function KaiAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg'
    ? 'w-14 h-14 rounded-full'
    : 'w-8 h-8 rounded-full flex-shrink-0'
  return <img src="/kai-avatar.svg" alt="Kai" className={cls} />
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <KaiAvatar />
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex gap-1.5 items-center h-4">
          {[0, 0.18, 0.36].map((delay, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'rgba(168,85,247,0.7)',
                animation: 'pulse 1.2s ease-in-out infinite',
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const mdComponents = {
  p:      ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul:     ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-4 space-y-0.5 mb-2">{children}</ul>,
  ol:     ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-4 space-y-0.5 mb-2">{children}</ol>,
  li:     ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="text-white font-semibold">{children}</strong>,
  code:   ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
  ),
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const userId  = getUserId()
  const profile = getNutritionProfile()
  const targets = profile ? calculateTargets(profile) : null

  const { data: plansData } = db.useQuery({ workoutPlans: { $: { where: { userId } } } })
  const { data: mealsData } = db.useQuery({ mealEntries:  { $: { where: { userId, date: toDateStr(new Date()) } } } })

  const latestPlan = ((plansData?.workoutPlans ?? []) as WorkoutPlan[])
    .sort((a, b) => b.createdAt - a.createdAt)[0]?.plan ?? null

  const todayMeals = (mealsData?.mealEntries ?? []) as MealEntry[]

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
    const totalKcal = todayMeals.reduce((a, m) => a + (m.kcal || 0), 0)
    const lines = todayMeals.map(m => `- ${m.meal}: ${m.description} (${m.kcal} kcal)`)
    contextParts.push(`TODAY'S FOOD LOG (${Math.round(totalKcal)} kcal total):\n${lines.join('\n')}`)
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
      const reply = await sendChatMessage(next, userContext)
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

  return (
    <main
      className="max-w-2xl mx-auto px-4 flex flex-col animate-fade-in"
      style={{ height: 'calc(100dvh - 72px)' }}
    >
      {/* Header */}
      <div className="pt-5 pb-3 flex-shrink-0 flex items-center gap-3.5">
        <KaiAvatar size="lg" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black gradient-text leading-none">KAI</h1>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                color: 'rgba(167,139,250,0.8)',
                border: '1px solid rgba(167,139,250,0.2)',
                background: 'rgba(168,85,247,0.08)',
              }}
            >
              AI Coach
            </span>
          </div>
          <p className="text-white/40 text-xs mt-1">Uplift's fitness and nutrition coach</p>
        </div>
      </div>

      {/* Empty state — no scroll container, no scrollbar */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center pb-10 gap-5">
          <div className="relative">
            <KaiAvatar size="lg" />
            <div className="absolute -bottom-1 -right-1">
              <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-60 animate-ping" />
              <div
                className="relative w-3.5 h-3.5 rounded-full border-2"
                style={{ background: '#4ade80', borderColor: '#050510' }}
              />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-white font-bold text-lg mb-1">Hey, I'm Kai</h2>
            <p className="text-white/40 text-sm max-w-xs leading-relaxed">
              Ask me about your training, nutrition, recovery, or anything Uplift-related.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-sm">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-left px-4 py-3 rounded-2xl border border-white/8 text-sm text-white/55
                           hover:text-white/85 hover:border-purple-500/30 hover:bg-white/4 transition-all"
                style={{ background: 'rgba(255,255,255,0.025)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages — only rendered (and scrollable) once chat starts */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-2 pr-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'assistant' && <KaiAvatar />}

              <div
                className={`max-w-[82%] px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-2xl rounded-br-sm text-white'
                    : 'rounded-2xl rounded-bl-sm text-white/80'
                }`}
                style={
                  msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, #A855F7, #22D3EE)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input bar */}
      <div className="flex-shrink-0 py-3">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30"
            placeholder="Ask Kai anything about your fitness or nutrition..."
            value={input}
            disabled={loading}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)' }}
            aria-label="Send message"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  )
}
