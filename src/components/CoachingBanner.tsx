import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CoachingBanner({ tip, dismissKey }: { tip: string; dismissKey?: string }) {
  const [dismissed, setDismissed] = useState(false)

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key={dismissKey ?? tip}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
          transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-start gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'rgba(168,85,247,0.06)',
            border: '1px solid rgba(168,85,247,0.16)',
          }}
        >
          <span className="flex-shrink-0 mt-0.5 text-[11px]" style={{ color: 'rgba(192,132,252,0.7)' }}>✦</span>
          <p className="flex-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {tip}
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 text-white/20 hover:text-white/45 transition-colors mt-0.5 leading-none"
            style={{ fontSize: 11 }}
            aria-label="Dismiss tip"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
