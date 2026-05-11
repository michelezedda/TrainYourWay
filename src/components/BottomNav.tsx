import { Link, useLocation } from 'react-router-dom'
import { db } from '@/lib/db'

const HIDE_ON = ['/questionnaire', '/generating', '/reevaluate', '/auth']

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function ForkIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 3v6a3 3 0 006 0V3M6 9v12M15 3a6 6 0 016 6v12" />
    </svg>
  )
}

function ScanIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-13h3a1 1 0 011 1v3m0 6v3a1 1 0 01-1 1h-3M7 12h10" />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

const NAV = [
  { to: '/dashboard', label: 'Home',     Icon: HomeIcon   },
  { to: '/diet',      label: 'Diet',     Icon: ForkIcon   },
  { to: '/scanner',   label: 'Scan',     Icon: ScanIcon   },
  { to: '/chat',      label: 'Kai',      Icon: ChatIcon   },
  { to: '/me',        label: 'Settings', Icon: PersonIcon },
]

export default function BottomNav() {
  const { user } = db.useAuth()
  const location = useLocation()

  if (!user) return null
  if (HIDE_ON.some(p => location.pathname.startsWith(p))) return null

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <nav className="liquid-pill flex items-center w-full max-w-sm px-2 py-2 gap-0.5 mb-2">
        {NAV.map(({ to, label, Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + '/')
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full transition-all duration-200 active:scale-95"
              style={{
                background: active ? 'rgba(192,132,252,0.12)' : 'transparent',
                color: active ? '#c084fc' : 'rgba(255,255,255,0.38)',
                transform: active ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <Icon active={active} />
              <span
                className="font-medium leading-none"
                style={{ fontSize: 10, color: active ? '#d8b4fe' : 'rgba(255,255,255,0.38)' }}
              >
                {label}
              </span>
              <span
                className="w-1 h-1 rounded-full transition-all duration-200"
                style={{
                  background: '#c084fc',
                  opacity: active ? 1 : 0,
                  boxShadow: active ? '0 0 6px #c084fc' : 'none',
                }}
              />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
