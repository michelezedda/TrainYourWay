import { useState, useRef } from 'react'
import { HiChevronDown, HiChevronLeft, HiChevronRight, HiRefresh, HiCheck, HiPhotograph, HiInformationCircle, HiPaperAirplane } from 'react-icons/hi'
import { id } from '@instantdb/react'
import emailjs from '@emailjs/browser'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import GlassCard from '@/components/GlassCard'
import { draftSupportTicket } from '@/lib/gemini'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { useLocale } from '@/context/LocaleContext'

type Step = 'category' | 'details' | 'drafting' | 'review' | 'sending' | 'done' | 'error'
type View = 'new' | 'tickets'

const CATEGORIES = [
  { label: 'AI / Kai issue', icon: '🤖', desc: 'Kai gave wrong, weird, or off-topic advice' },
  { label: 'Plan generation', icon: '📋', desc: 'Plan failed to generate or looks incorrect' },
  { label: 'Diet tracker', icon: '🍎', desc: 'Food logging, macros, or nutrition data issue' },
  { label: 'App bug', icon: '🐛', desc: 'Something is broken or not working as expected' },
  { label: 'Data or history', icon: '📊', desc: 'Plans, history, or data missing or wrong' },
  { label: 'Other', icon: '💬', desc: 'Anything else' },
]

const EMAILJS_SERVICE = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined
const EMAILJS_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined
const EMAILJS_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined

const emailJsConfigured = !!(EMAILJS_SERVICE && EMAILJS_TEMPLATE && EMAILJS_KEY)

async function compressImage(dataUrl: string, maxWidth = 700, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

const mdComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-white mt-5 mb-2 flex items-center gap-2 first:mt-0">
      <span className="w-1 h-3.5 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(180deg,#A855F7,#22D3EE)' }} />
      {children}
    </h2>
  ),
  p: ({ children }) => <p className="text-white/65 text-sm leading-relaxed mb-2">{children}</p>,
  ul: ({ children }) => <ul className="space-y-1.5 mb-3">{children}</ul>,
  li: ({ children }) => (
    <li className="flex gap-2 text-white/65 text-sm">
      <span className="text-purple-400/70 flex-shrink-0 mt-0.5 text-xs">-</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
}

// ── Ticket list view ──────────────────────────────────────────────────────────

interface StoredTicket {
  id: string
  category: string
  description: string
  draft: string
  hasScreenshot: boolean
  status: string
  createdAt: number
}

function TicketCard({ ticket }: { ticket: StoredTicket }) {
  const [expanded, setExpanded] = useState(false)
  const isSolved = ticket.status === 'solved'
  const { formatDate } = useLocale()

  const toggleStatus = () => {
    void db.transact(
      db.tx.supportTickets[ticket.id].update({ status: isSolved ? 'open' : 'solved' })
    )
  }

  const categoryMeta = CATEGORIES.find(c => c.label === ticket.category)

  return (
    <GlassCard padding={false} className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-xl flex-shrink-0">{categoryMeta?.icon ?? '💬'}</span>
            <div className="min-w-0">
              <p className="text-white font-medium text-sm truncate">{ticket.category}</p>
              <p className="text-white/35 text-xs mt-0.5">{formatDate(ticket.createdAt, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {ticket.hasScreenshot && (
              <span className="text-[10px] text-purple-300/70 border border-purple-500/20 bg-purple-500/8 px-2 py-0.5 rounded-full">
                screenshot
              </span>
            )}
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${isSolved
              ? 'text-green-300 border-green-500/30 bg-green-500/10'
              : 'text-amber-300 border-amber-500/30 bg-amber-500/10'
              }`}>
              {isSolved ? 'Solved' : 'Open'}
            </span>
          </div>
        </div>

        <p className="text-white/40 text-xs mt-3 leading-relaxed line-clamp-2">
          {ticket.description}
        </p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center justify-between border-t border-white/6 pt-3">
        <button
          onClick={() => setExpanded(o => !o)}
          className="text-xs text-white/35 hover:text-white/60 transition-colors flex items-center gap-1"
        >
          <HiChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Hide' : 'View'} Kai summary
        </button>

        <button
          onClick={toggleStatus}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-all duration-200 ${isSolved
            ? 'text-white/40 border-white/10 bg-white/3 hover:bg-white/6 hover:text-white/60'
            : 'text-green-300 border-green-500/25 bg-green-500/8 hover:bg-green-500/15'
            }`}
        >
          {isSolved ? (
            <>
              <HiRefresh className="w-3.5 h-3.5" />
              Reopen
            </>
          ) : (
            <>
              <HiCheck className="w-3.5 h-3.5" />
              Mark solved
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/6 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <img src="/kai-avatar.svg" alt="Kai" className="w-5 h-5 rounded-full" />
            <span className="text-white/40 text-xs">Kai's summary</span>
          </div>
          <ReactMarkdown components={mdComponents}>{ticket.draft}</ReactMarkdown>
        </div>
      )}
    </GlassCard>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Support() {
  const userId = getUserId()

  const { data: ticketsData } = db.useQuery({
    supportTickets: {
      $: {
        where: { userId },
        order: { serverCreatedAt: 'desc' },
      },
    },
  })
  const tickets = (ticketsData?.supportTickets ?? []) as StoredTicket[]

  const [view, setView] = useState<View>('new')
  const [step, setStep] = useState<Step>('category')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isLoading = step === 'drafting' || step === 'sending'

  const resetForm = () => {
    setStep('category')
    setCategory('')
    setDescription('')
    setImageDataUrl(null)
    setImagePreview(null)
    setDraft('')
    setErrorMsg('')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async () => {
      const raw = reader.result as string
      setImagePreview(raw)
      const compressed = await compressImage(raw)
      setImageDataUrl(compressed)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDraftTicket = async () => {
    setStep('drafting')
    try {
      const result = await draftSupportTicket(category, description, imageDataUrl ?? undefined)
      setDraft(result)
      setStep('review')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to draft ticket')
      setStep('error')
    }
  }

  const buildEmailBody = () =>
    `UPLIFT SUPPORT TICKET\n` +
    `=====================\n` +
    `Category: ${category}\n` +
    `User ID: ${userId}\n\n` +
    `USER DESCRIPTION:\n${description}\n\n` +
    `KAI SUMMARY:\n${draft.replace(/#{1,6} /g, '').replace(/\*\*/g, '')}\n\n` +
    `Screenshot: ${imageDataUrl ? 'Attached' : 'None'}`

  const handleSend = async () => {
    setStep('sending')
    try {
      if (emailJsConfigured) {
        await emailjs.send(EMAILJS_SERVICE!, EMAILJS_TEMPLATE!, {
          category,
          description,
          kai_summary: draft,
          user_id: userId,
          has_screenshot: imageDataUrl ? 'Yes' : 'No',
          screenshot_url: imageDataUrl ?? '',
        }, EMAILJS_KEY!)
      } else {
        const subject = encodeURIComponent(`[Uplift Support] ${category}`)
        const body = encodeURIComponent(buildEmailBody())
        const dest = SUPPORT_EMAIL ?? 'support@uplift.app'
        window.open(`mailto:${dest}?subject=${subject}&body=${body}`, '_blank')
      }

      await db.transact(
        db.tx.supportTickets[id()].update({
          userId,
          category,
          description,
          draft,
          hasScreenshot: !!imageDataUrl,
          status: 'open',
          createdAt: Date.now(),
        })
      )

      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send ticket')
      setStep('error')
    }
  }

  // ── Header tabs (shown when not in loading states) ────────────────────────

  const openCount = tickets.filter(t => t.status !== 'solved').length
  const showTabs = !isLoading

  const PageHeader = () => (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight gradient-text">Support</h1>
        <p className="text-white/40 text-sm mt-1">Kai helps write a clear ticket for the support team</p>
      </div>

      {showTabs && (
        <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setView('new')}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${view === 'new'
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white/70'
              }`}
          >
            New ticket
          </button>
          <button
            onClick={() => setView('tickets')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${view === 'tickets'
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white/70'
              }`}
          >
            My tickets
            {openCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/30">
                {openCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )

  // ── Loading screens ───────────────────────────────────────────────────────

  if (step === 'drafting') {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full animate-spin-slow"
              style={{ background: 'conic-gradient(from 0deg, #A855F7 0%, #22D3EE 45%, transparent 65%, #A855F7 100%)', padding: '3px' }}>
              <div className="w-full h-full rounded-full" style={{ background: '#050510' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🤖</div>
          </div>
          <h2 className="text-2xl font-black text-white mb-3 tracking-tight">
            Kai is reviewing your issue<span className="animate-pulse">...</span>
          </h2>
          <p className="text-white/50">Writing a clear summary for the support team</p>
        </div>
      </main>
    )
  }

  if (step === 'sending') {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full animate-spin-slow"
              style={{ background: 'conic-gradient(from 0deg, #A855F7 0%, #22D3EE 45%, transparent 65%, #A855F7 100%)', padding: '3px' }}>
              <div className="w-full h-full rounded-full" style={{ background: '#050510' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">📨</div>
          </div>
          <h2 className="text-2xl font-black text-white mb-3 tracking-tight">
            Sending your ticket<span className="animate-pulse">...</span>
          </h2>
        </div>
      </main>
    )
  }

  // ── My Tickets view ───────────────────────────────────────────────────────

  if (view === 'tickets') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
        <PageHeader />

        {tickets.length === 0 ? (
          <GlassCard className="text-center py-10">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-white font-medium mb-1">No tickets yet</p>
            <p className="text-white/40 text-sm mb-5">Submit your first support ticket and it will appear here.</p>
            <button onClick={() => setView('new')} className="btn-primary !text-sm">
              New ticket
            </button>
          </GlassCard>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-white/35 text-xs flex-1">
                {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} — {openCount} open
              </p>
            </div>
            <div className="space-y-3">
              {tickets.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          </>
        )}
      </main>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <main className="w-full md:max-w-xl md:mx-auto px-4 pt-16 pb-nav text-center animate-fade-in">
        <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(34,197,94,0.25)' }}>
          <div className="px-6 pt-10 pb-8" style={{ background: 'linear-gradient(160deg, rgba(34,197,94,0.1) 0%, rgba(34,211,238,0.06) 100%)' }}>
            <div className="text-5xl mb-5">✅</div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">Ticket submitted</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-1">
              {emailJsConfigured
                ? "Your support ticket has been sent. We'll get back to you as soon as possible."
                : 'Your email client opened with the ticket pre-filled. Hit send to submit it.'}
            </p>
            <p className="text-white/30 text-sm mb-8">
              Category: <span className="text-white/50">{category}</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { resetForm(); setView('tickets') }} className="btn-primary !text-sm">
                View my tickets
              </button>
              <button onClick={resetForm} className="btn-ghost !text-sm">
                Submit another
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (step === 'error') {
    return (
      <main className="w-full md:max-w-xl md:mx-auto px-4 pt-16 pb-nav animate-fade-in">
        <div className="rounded-3xl overflow-hidden text-center" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="px-6 pt-10 pb-8" style={{ background: 'linear-gradient(160deg, rgba(239,68,68,0.08) 0%, transparent 100%)' }}>
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-black text-white tracking-tight mb-2">Something went wrong</h2>
            <p className="text-red-300 text-sm mb-6 px-4">{errorMsg}</p>
            <button onClick={() => setStep('details')} className="btn-primary !text-sm">
              Try again
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Review step ───────────────────────────────────────────────────────────

  if (step === 'review') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
        <PageHeader />

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStep('details')} className="text-white/40 hover:text-white transition-colors">
            <HiChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">Review your ticket</h2>
            <p className="text-white/40 text-xs mt-0.5">Kai drafted this based on your description</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">{CATEGORIES.find(c => c.label === category)?.icon}</span>
          <span className="text-sm font-medium text-white/70">{category}</span>
          {imageDataUrl && (
            <span className="flex items-center gap-1 text-xs text-purple-300 border border-purple-500/25 bg-purple-500/10 px-2.5 py-1 rounded-full">
              <HiPhotograph className="w-3 h-3" />
              Screenshot attached
            </span>
          )}
        </div>

        <GlassCard className="mb-4">
          <div className="flex items-center gap-2 mb-4">
            <img src="/kai-avatar.svg" alt="Kai" className="w-7 h-7 rounded-full" />
            <span className="text-white/60 text-xs">Kai drafted this ticket</span>
          </div>
          <ReactMarkdown components={mdComponents}>{draft}</ReactMarkdown>
        </GlassCard>

        <details className="mb-5">
          <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors select-none mb-2">
            Show original description
          </summary>
          <div className="mt-2 p-3 rounded-xl bg-white/3 border border-white/8 text-white/50 text-sm leading-relaxed">
            {description}
          </div>
        </details>

        {imageDataUrl && imagePreview && (
          <details className="mb-5">
            <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors select-none mb-2">
              Show screenshot
            </summary>
            <div className="mt-2">
              <img src={imagePreview} alt="Screenshot"
                className="w-full rounded-2xl border border-white/10 max-h-64 object-cover" />
            </div>
          </details>
        )}

        {!emailJsConfigured && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3.5 rounded-2xl border"
            style={{ background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.2)' }}>
            <HiInformationCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300/80 text-xs leading-relaxed">
              EmailJS is not configured. Clicking "Send" will open your email client with the ticket pre-filled.
            </p>
          </div>
        )}

        <button onClick={() => void handleSend()} className="btn-primary w-full flex items-center justify-center gap-2">
          <HiPaperAirplane className="w-4 h-4" />
          {emailJsConfigured ? 'Send ticket' : 'Open email client'}
        </button>
      </main>
    )
  }

  // ── Details step ──────────────────────────────────────────────────────────

  if (step === 'details') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
        <PageHeader />

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStep('category')} className="text-white/40 hover:text-white transition-colors">
            <HiChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">Describe the issue</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/30 text-sm">{CATEGORIES.find(c => c.label === category)?.icon}</span>
              <span className="text-white/40 text-sm">{category}</span>
            </div>
          </div>
        </div>

        <GlassCard className="mb-5">
          <label className="block text-sm font-medium text-white/60 mb-2">
            What happened?{' '}
            <span className="text-white/25 text-xs font-normal">be as specific as you can</span>
          </label>
          <textarea
            autoFocus
            className="input-glass resize-none w-full"
            rows={6}
            placeholder="e.g. I asked Kai about my protein intake and it said I should eat 300g of protein a day, which seems way off for my body weight..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </GlassCard>

        <GlassCard className="mb-6">
          <label className="block text-sm font-medium text-white/60 mb-3">
            Screenshot{' '}
            <span className="text-white/25 text-xs font-normal">optional</span>
          </label>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => void handleFileChange(e)} />

          {imagePreview ? (
            <div className="space-y-3">
              <img src={imagePreview} alt="Screenshot"
                className="w-full rounded-2xl object-cover max-h-48 border border-white/10" />
              <button onClick={() => { setImageDataUrl(null); setImagePreview(null) }}
                className="text-xs text-red-400/70 hover:text-red-400 transition-colors">
                Remove screenshot
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed
                         border-white/12 hover:border-purple-500/35 hover:bg-purple-500/5 transition-all cursor-pointer">
              <HiPhotograph className="w-5 h-5 text-white/30" />
              <span className="text-white/35 text-sm">Upload a screenshot</span>
            </button>
          )}
        </GlassCard>

        <button onClick={() => void handleDraftTicket()} disabled={!description.trim()}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <img src="/kai-avatar.svg" alt="Kai" className="w-5 h-5 rounded-full" />
          Let Kai review this
        </button>
      </main>
    )
  }

  // ── Category step (default) ───────────────────────────────────────────────

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      <PageHeader />

      <div className="grid gap-3 mb-8">
        {CATEGORIES.map(({ label, icon, desc }) => (
          <button
            key={label}
            onClick={() => { setCategory(label); setStep('details') }}
            className={`group flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all ${category === label
              ? 'border-purple-500/50 bg-purple-500/12'
              : 'border-white/10 bg-white/3 hover:bg-white/6 hover:border-white/20'
              }`}
          >
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{label}</p>
              <p className="text-white/40 text-xs mt-0.5">{desc}</p>
            </div>
            <HiChevronRight className="w-4 h-4 text-white/20 flex-shrink-0 group-hover:text-white/50 transition-colors" />
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-white/30 text-xs leading-relaxed">
          After you describe the issue, Kai will write a structured summary to help the support team
          understand and resolve it faster. You review it before anything is sent.
        </p>
      </div>
    </main>
  )
}
