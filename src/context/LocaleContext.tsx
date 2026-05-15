import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type Unit, getUnit, saveUnit } from '@/lib/units'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LocaleConfig {
  unit: Unit
  weekStart: 0 | 1      // 0 = Sunday (US), 1 = Monday (international)
  dateLocale: string    // 'en-US' | 'en-GB'
}

export interface LocaleContextType extends LocaleConfig {
  setUnit: (u: Unit) => void
  // Locale-aware date formatters
  formatDate: (ts: number | Date, opts?: Intl.DateTimeFormatOptions) => string
  formatDateShort: (ts: number | Date) => string
  formatDateWithWeekday: (ts: number | Date) => string
  formatDateFull: (ts: number | Date) => string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function configFromUnit(unit: Unit): LocaleConfig {
  if (unit === 'imperial') {
    return { unit, weekStart: 0, dateLocale: 'en-US' }
  }
  return { unit, weekStart: 1, dateLocale: 'en-GB' }
}

// ── Context ───────────────────────────────────────────────────────────────────

const LocaleContext = createContext<LocaleContextType | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LocaleConfig>(() => configFromUnit(getUnit()))

  const setUnit = useCallback((u: Unit) => {
    saveUnit(u)
    setConfig(configFromUnit(u))
  }, [])

  const formatDate = useCallback((ts: number | Date, opts?: Intl.DateTimeFormatOptions) => {
    const d = ts instanceof Date ? ts : new Date(ts)
    return d.toLocaleDateString(config.dateLocale, opts)
  }, [config.dateLocale])

  // "Nov 15, 2024" (en-US) or "15 Nov 2024" (en-GB)
  const formatDateShort = useCallback((ts: number | Date) => {
    const d = ts instanceof Date ? ts : new Date(ts)
    return d.toLocaleDateString(config.dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })
  }, [config.dateLocale])

  // "Mon, Nov 15" (en-US) or "Mon, 15 Nov" (en-GB)
  const formatDateWithWeekday = useCallback((ts: number | Date) => {
    const d = ts instanceof Date ? ts : new Date(ts)
    return d.toLocaleDateString(config.dateLocale, { weekday: 'short', month: 'short', day: 'numeric' })
  }, [config.dateLocale])

  // "Monday, November 15, 2024" (en-US) or "Monday, 15 November 2024" (en-GB)
  const formatDateFull = useCallback((ts: number | Date) => {
    const d = ts instanceof Date ? ts : new Date(ts)
    return d.toLocaleDateString(config.dateLocale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }, [config.dateLocale])

  return (
    <LocaleContext.Provider value={{
      ...config,
      setUnit,
      formatDate,
      formatDateShort,
      formatDateWithWeekday,
      formatDateFull,
    }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextType {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
