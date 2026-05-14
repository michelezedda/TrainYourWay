import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowNarrowLeft, HiChevronDown, HiChevronUp } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { saveJournalEntry, getJournalEntries, saveSession, type JournalEntry } from '@/lib/wellness'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROMPTS = [
  'What made you smile today?',
  "What's one thing you're grateful for right now?",
  "What's been weighing on your mind lately?",
  'How would you describe your energy this week?',
  "What's a small win you had recently?",
  'What would make today feel like a success?',
  "What are you most proud of this month?",
  "What's something you want to let go of?",
  'How are you taking care of yourself right now?',
  'What does your body need from you today?',
  'Describe your ideal recovery day.',
  'What thought patterns have you noticed this week?',
  'What are three things going well in your life?',
  'How has training been affecting your mood?',
  'What boundaries do you want to set this week?',
  "What's one thing you'd tell yourself from a month ago?",
  'How do you feel physically vs emotionally today?',
  'What motivated you to show up this week?',
  'Who in your life is lifting you up right now?',
  "What's your intention for the rest of this week?",
]

const MOOD_TAGS = [
  { id: 'grateful', label: 'Grateful', emoji: '🙏', color: '#34D399' },
  { id: 'motivated', label: 'Motivated', emoji: '🔥', color: '#F87171' },
  { id: 'calm', label: 'Calm', emoji: '🌊', color: '#22D3EE' },
  { id: 'tired', label: 'Tired', emoji: '😴', color: '#818CF8' },
  { id: 'anxious', label: 'Anxious', emoji: '😰', color: '#FBBF24' },
  { id: 'proud', label: 'Proud', emoji: '💪', color: '#A855F7' },
  { id: 'reflective', label: 'Reflective', emoji: '🪞', color: '#6366F1' },
  { id: 'hopeful', label: 'Hopeful', emoji: '🌱', color: '#10B981' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryCard({ entry, onToggle, open }: { entry: JournalEntry; onToggle: () => void; open: boolean }) {
  const tag = MOOD_TAGS.find(t => t.id === entry.moodTag)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <button onClick={onToggle} className="w-full flex items-start gap-3 px-4 py-4 text-left">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-white/70 text-sm font-medium">{new Date(entry.timestamp).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            {tag && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: `${tag.color}15`, color: tag.color, border: `1px solid ${tag.color}30` }}>
                {tag.emoji} {tag.label}
              </span>
            )}
          </div>
          <p className="text-white/35 text-xs leading-relaxed line-clamp-1">{entry.prompt}</p>
        </div>
        <div className="ml-auto flex-shrink-0 mt-0.5">
          {open ? <HiChevronUp className="w-4 h-4 text-white/30" /> : <HiChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="px-4 pb-4 border-t border-white/6">
              <p className="text-white/35 text-xs italic mt-3 mb-2">{entry.prompt}</p>
              <p className="text-white/65 text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type View = 'write' | 'done'

export default function WellnessJournal() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('write')
  const [content, setContent] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [openEntry, setOpenEntry] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
  const prompt = PROMPTS[dayOfYear % PROMPTS.length]

  useEffect(() => {
    setEntries(getJournalEntries())
  }, [])

  const handleSave = async () => {
    if (!content.trim() || !selectedTag) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 300))
    saveJournalEntry({ date: new Date().toISOString().slice(0, 10), prompt, content: content.trim(), moodTag: selectedTag })
    saveSession('journal', Math.max(60, content.trim().split(' ').length * 3))
    setEntries(getJournalEntries())
    setSaving(false)
    setView('done')
  }

  const tag = MOOD_TAGS.find(t => t.id === selectedTag)

  // ── Done ────────────────────────────────────────────────────────────────────

  if (view === 'done') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/wellness')}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <HiArrowNarrowLeft className="w-5 h-5 text-white/60" />
          </button>
          <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #34D399, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Journal
          </h1>
        </div>

        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-10">
          <div className="text-5xl mb-4">📔</div>
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">Entry saved.</h2>
          <p className="text-white/40 text-sm leading-relaxed">Writing it down makes it real. Come back tomorrow.</p>
        </motion.div>

        {entries.length > 0 && (
          <div>
            <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Past entries</p>
            <div className="space-y-2 mb-6">
              {entries.slice(0, 6).map(e => (
                <EntryCard key={e.id} entry={e} open={openEntry === e.id} onToggle={() => setOpenEntry(openEntry === e.id ? null : e.id)} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => { setContent(''); setSelectedTag(null); setView('write') }}
            className="w-full py-4 rounded-2xl font-bold text-base text-white"
            style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.3), rgba(34,211,238,0.25))', border: '1px solid rgba(52,211,153,0.3)' }}
          >
            Write another entry
          </button>
          <button
            onClick={() => navigate('/wellness')}
            className="w-full py-4 rounded-2xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >
            Back to Mind
          </button>
        </div>
      </main>
    )
  }

  // ── Write ───────────────────────────────────────────────────────────────────

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
          <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #34D399, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Journal
          </h1>
          <p className="text-white/35 text-sm">Reflect. Release. Grow.</p>
        </div>
      </div>

      {/* Today's prompt */}
      <div className="rounded-3xl px-5 py-5 mb-5"
        style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(34,211,238,0.07) 100%)', border: '1px solid rgba(52,211,153,0.2)' }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#34D399' }}>Today's prompt</p>
        <p className="text-white font-semibold text-base leading-relaxed">{prompt}</p>
      </div>

      {/* Mood tag selection */}
      <div className="mb-5">
        <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">How are you feeling?</p>
        <div className="flex flex-wrap gap-2">
          {MOOD_TAGS.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTag(selectedTag === t.id ? null : t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-medium transition-all active:scale-95"
              style={selectedTag === t.id ? {
                background: `${t.color}18`, borderColor: `${t.color}45`, color: t.color,
              } : {
                background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Text area */}
      <div className="mb-5">
        <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Your thoughts</p>
        <textarea
          className="w-full rounded-2xl px-4 py-4 text-sm text-white/80 leading-relaxed resize-none outline-none transition-all"
          rows={8}
          placeholder="Write freely. No judgment, no edits. Just you..."
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${content ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
            fontSize: 15,
            color: 'rgba(255,255,255,0.8)',
          }}
        />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-white/20 text-xs">{content.trim().split(/\s+/).filter(Boolean).length} words</p>
          {content.length > 0 && <p className="text-white/20 text-xs">Keep going...</p>}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!content.trim() || !selectedTag || saving}
        className="w-full py-5 rounded-3xl font-bold text-base text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
        style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.4), rgba(34,211,238,0.35))', border: '1px solid rgba(52,211,153,0.4)' }}
      >
        {saving ? 'Saving...' : 'Save entry'}
        {tag && !saving && ` ${tag.emoji}`}
      </button>

      {!selectedTag && content.trim() && (
        <p className="text-center text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Pick a mood tag to save</p>
      )}

      {/* Past entries */}
      {entries.length > 0 && (
        <div className="mt-8">
          <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Past entries</p>
          <div className="space-y-2">
            {entries.slice(0, 5).map(e => (
              <EntryCard key={e.id} entry={e} open={openEntry === e.id} onToggle={() => setOpenEntry(openEntry === e.id ? null : e.id)} />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
