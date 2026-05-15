import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getExerciseMedia, type ExerciseMedia } from '@/lib/exerciseMedia'

type State = 'loading' | 'loaded' | 'error'

export default function ExerciseDemoPlayer({ exerciseName }: { exerciseName: string }) {
  const [state, setState] = useState<State>('loading')
  const [media, setMedia] = useState<ExerciseMedia | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => {
    setState('loading')
    setMedia(null)
    setImgLoaded(false)
    getExerciseMedia(exerciseName).then(result => {
      if (result) {
        setMedia(result)
        setState('loaded')
      } else {
        setState('error')
      }
    })
  }, [exerciseName])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <AnimatePresence mode="wait">
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-3"
            style={{ height: 220 }}
          >
            <div className="relative w-10 h-10">
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  background: 'conic-gradient(from 0deg, #A855F7, #22D3EE, transparent)',
                  padding: 2,
                }}
              >
                <div className="w-full h-full rounded-full" style={{ background: '#0a0520' }} />
              </div>
            </div>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Loading demo...
            </p>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-2 px-5 text-center"
            style={{ height: 160 }}
          >
            <p className="text-2xl">🎥</p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              No demo available for this exercise
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Try the YouTube link below
            </p>
          </motion.div>
        )}

        {state === 'loaded' && media && (
          <motion.div
            key="loaded"
            initial={{ opacity: 0 }}
            animate={{ opacity: imgLoaded ? 1 : 0 }}
            className="relative"
          >
            <img
              src={media.gifUrl}
              alt={`${exerciseName} demonstration`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setState('error')}
              className="w-full object-cover"
              style={{
                maxHeight: 280,
                display: 'block',
                background: '#0a0520',
              }}
            />
            {/* Gradient overlay at bottom with exercise name */}
            <div
              className="absolute bottom-0 left-0 right-0 px-4 py-3"
              style={{
                background: 'linear-gradient(to top, rgba(5,5,20,0.92) 0%, transparent 100%)',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(168,85,247,0.7)' }}>
                Live Demo
              </p>
              <p className="text-sm font-semibold text-white/80 capitalize leading-tight mt-0.5">
                {media.name}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
