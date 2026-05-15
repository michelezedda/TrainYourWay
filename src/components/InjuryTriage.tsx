import { useState } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { type InjuryLocation, type InjurySeverity, type InjuryState, getInjuryAdvice } from '@/lib/injuryStore'

const LOCATIONS: { key: InjuryLocation; label: string; icon: string }[] = [
  { key: 'knee', label: 'Knee', icon: '🦵' },
  { key: 'shoulder', label: 'Shoulder', icon: '💪' },
  { key: 'lower back', label: 'Lower Back', icon: '🔙' },
  { key: 'wrist', label: 'Wrist', icon: '✋' },
  { key: 'hip', label: 'Hip', icon: '🍑' },
  { key: 'ankle', label: 'Ankle', icon: '🦶' },
  { key: 'neck', label: 'Neck', icon: '🧣' },
  { key: 'other', label: 'Other', icon: '💫' },
]

const SEVERITIES: { key: InjurySeverity; label: string; desc: string; icon: string; color: string }[] = [
  { key: 'mild', label: 'Mild', desc: 'Slight discomfort, no sharp pain', icon: '🟢', color: 'rgba(34,197,94,0.15)' },
  { key: 'moderate', label: 'Moderate', desc: 'Noticeable pain during movement', icon: '🟡', color: 'rgba(234,179,8,0.15)' },
  { key: 'sharp', label: 'Sharp', desc: 'Intense pain, hard to ignore', icon: '🔴', color: 'rgba(239,68,68,0.15)' },
]

const slideVariants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
}

interface Props {
  onClose: () => void
  onActivate: (state: InjuryState) => void
}

export default function InjuryTriage({ onClose, onActivate }: Props) {
  const [step, setStep] = useState(0)
  const [location, setLocation] = useState<InjuryLocation | null>(null)
  const [severity, setSeverity] = useState<InjurySeverity | null>(null)
  const [worsens, setWorsens] = useState<boolean | null>(null)
  const dragControls = useDragControls()

  const injuryState: InjuryState | null =
    location && severity && worsens !== null
      ? { active: true, location, severity, worsensWithMovement: worsens, startedAt: Date.now() }
      : null

  const advice = injuryState ? getInjuryAdvice(injuryState) : null

  const handleLocation = (loc: InjuryLocation) => {
    setLocation(loc)
    setTimeout(() => setStep(1), 160)
  }

  const handleSeverity = (sev: InjurySeverity) => {
    setSeverity(sev)
    setTimeout(() => setStep(2), 160)
  }

  const handleWorsens = (val: boolean) => {
    setWorsens(val)
    setTimeout(() => setStep(3), 160)
  }

  const handleActivate = () => {
    if (injuryState) onActivate(injuryState)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
        onDragEnd={(_, info) => {
          if (info.velocity.y > 450 || info.offset.y > 140) onClose()
        }}
        className="w-full md:max-w-md md:rounded-3xl rounded-t-3xl overflow-hidden pb-20"
        style={{
          background: 'linear-gradient(160deg, rgba(10,5,30,0.98) 0%, rgba(5,5,18,0.99) 100%)',
          border: '1px solid rgba(245,158,11,0.2)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(245,158,11,0.05)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle — touch-only drag initiation point */}
        <div
          className="flex justify-center pt-3 pb-1 touch-none select-none cursor-grab active:cursor-grabbing"
          onPointerDown={e => { if (e.pointerType !== 'mouse') dragControls.start(e) }}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
            🩹
          </div>
          <div>
            <h2 className="font-black text-white text-lg leading-tight ">Injury Triage</h2>
            <p className="text-white/40 text-xs">Quick check to adapt your training</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            ✕
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 px-5 pb-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-0.5 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? 'rgba(245,158,11,0.8)' : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        {/* Step content */}
        <div className="px-5 pb-6" style={{ minHeight: 260 }}>
          <AnimatePresence mode="wait">
            {/* Step 0: Location */}
            {step === 0 && (
              <motion.div key="loc" variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2 }}>
                <p className="text-white/60 text-sm mb-4">Where does it hurt?</p>
                <div className="grid grid-cols-4 gap-2">
                  {LOCATIONS.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => handleLocation(key)}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95"
                      style={{
                        background: location === key ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.05)',
                        border: location === key ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span className="text-xl">{icon}</span>
                      <span className="text-[10px] font-semibold text-white/70 leading-tight text-center">{label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 1: Severity */}
            {step === 1 && (
              <motion.div key="sev" variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2 }}>
                <p className="text-white/60 text-sm mb-4">How bad is it?</p>
                <div className="space-y-2 pb-6">
                  {SEVERITIES.map(({ key, label, desc, icon, color }) => (
                    <button
                      key={key}
                      onClick={() => handleSeverity(key)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
                      style={{
                        background: severity === key ? color : 'rgba(255,255,255,0.04)',
                        border: severity === key ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <span className="text-xl">{icon}</span>
                      <div>
                        <p className="text-sm font-bold text-white">{label}</p>
                        <p className="text-xs text-white/45">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Worsens with movement */}
            {step === 2 && (
              <motion.div key="worsens" variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2 }}>
                <p className="text-white/60 text-sm mb-2">Does it get worse when you move?</p>
                <p className="text-white/30 text-xs mb-5">Be honest - this helps us keep you safe.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleWorsens(true)}
                    className="flex flex-col items-center gap-2 py-6 rounded-2xl transition-all active:scale-95"
                    style={{
                      background: worsens === true ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                      border: worsens === true ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <span className="text-3xl">😬</span>
                    <span className="text-sm font-bold text-white">Yes, it does</span>
                  </button>
                  <button
                    onClick={() => handleWorsens(false)}
                    className="flex flex-col items-center gap-2 py-6 rounded-2xl transition-all active:scale-95"
                    style={{
                      background: worsens === false ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                      border: worsens === false ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <span className="text-3xl">🙂</span>
                    <span className="text-sm font-bold text-white">Stays the same</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Summary */}
            {step === 3 && advice && injuryState && (
              <motion.div key="summary" variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2 }}>
                <div className="rounded-2xl p-4 mb-4"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {advice.intensity === 'rest' ? '🛑' : '⚠️'}
                    </span>
                    <span className="text-sm font-bold"
                      style={{ color: advice.intensity === 'rest' ? '#fca5a5' : '#fde68a' }}>
                      {advice.intensity === 'rest' ? 'Full Rest Recommended' : 'Reduced Training Mode'}
                    </span>
                  </div>
                  <p className="text-white/55 text-xs leading-relaxed">{advice.message}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-2xl p-3.5" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <p className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wider">Avoid</p>
                    <ul className="space-y-1">
                      {advice.avoid.slice(0, 4).map(item => (
                        <li key={item} className="text-[11px] text-white/50 flex items-start gap-1.5">
                          <span className="text-red-400/70 flex-shrink-0 mt-0.5">✕</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl p-3.5" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <p className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wider">Focus</p>
                    <ul className="space-y-1">
                      {advice.focus.slice(0, 4).map(item => (
                        <li key={item} className="text-[11px] text-white/50 flex items-start gap-1.5">
                          <span className="text-green-400/70 flex-shrink-0 mt-0.5">✦</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={handleActivate}
                  className="w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.9), rgba(234,88,12,0.9))',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.25)',
                  }}
                >
                  Activate Recovery Mode
                </button>
                <button onClick={onClose} className="w-full py-2.5 mt-2 text-xs text-white/30 hover:text-white/50 transition-colors pb-6">
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
