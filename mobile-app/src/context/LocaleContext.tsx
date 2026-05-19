import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { type Unit, loadUnit, saveUnit } from '@/lib/units'

export interface LocaleConfig {
  unit: Unit
  weekStart: 0 | 1
  dateLocale: string
}

export interface LocaleContextType extends LocaleConfig {
  setUnit: (u: Unit) => void
  formatDate: (ts: number | Date, opts?: Intl.DateTimeFormatOptions) => string
  formatDateShort: (ts: number | Date) => string
  formatDateWithWeekday: (ts: number | Date) => string
  formatDateFull: (ts: number | Date) => string
}

function configFromUnit(unit: Unit): LocaleConfig {
  if (unit === 'imperial') return { unit, weekStart: 0, dateLocale: 'en-US' }
  return { unit, weekStart: 1, dateLocale: 'en-GB' }
}

const LocaleContext = createContext<LocaleContextType | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LocaleConfig>(configFromUnit('metric'))

  useEffect(() => {
    loadUnit().then(unit => setConfig(configFromUnit(unit)))
  }, [])

  const setUnit = useCallback((u: Unit) => {
    void saveUnit(u)
    setConfig(configFromUnit(u))
  }, [])

  const formatDate = useCallback((ts: number | Date, opts?: Intl.DateTimeFormatOptions) => {
    const d = ts instanceof Date ? ts : new Date(ts)
    return d.toLocaleDateString(config.dateLocale, opts)
  }, [config.dateLocale])

  const formatDateShort = useCallback((ts: number | Date) => {
    const d = ts instanceof Date ? ts : new Date(ts)
    return d.toLocaleDateString(config.dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })
  }, [config.dateLocale])

  const formatDateWithWeekday = useCallback((ts: number | Date) => {
    const d = ts instanceof Date ? ts : new Date(ts)
    return d.toLocaleDateString(config.dateLocale, { weekday: 'short', month: 'short', day: 'numeric' })
  }, [config.dateLocale])

  const formatDateFull = useCallback((ts: number | Date) => {
    const d = ts instanceof Date ? ts : new Date(ts)
    return d.toLocaleDateString(config.dateLocale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }, [config.dateLocale])

  return (
    <LocaleContext.Provider value={{ ...config, setUnit, formatDate, formatDateShort, formatDateWithWeekday, formatDateFull }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextType {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
