import { Link, useLocation } from 'react-router-dom'
import { PiForkKnifeDuotone, PiUserGearLight } from 'react-icons/pi'
import { IoChatbubblesOutline } from 'react-icons/io5'
import { GrHomeOption } from 'react-icons/gr'
import { db } from '@/lib/db'

const HIDE_ON = ['/questionnaire', '/generating', '/reevaluate', '/auth']

function DumbbellIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.1 : 1.7}>
      <rect x="2" y="10" width="3" height="4" rx="1" />
      <rect x="5" y="8" width="3" height="8" rx="1" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <rect x="16" y="8" width="3" height="8" rx="1" />
      <rect x="19" y="10" width="3" height="4" rx="1" />
    </svg>
  )
}

function ForkIcon({ active }: { active: boolean }) {
  return <PiForkKnifeDuotone className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.1 : 1.7 }} />
}

function HomeIcon({ active }: { active: boolean }) {
  return <GrHomeOption className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.2 : 1.8 }} />
}

function ChatIcon({ active }: { active: boolean }) {
  return <IoChatbubblesOutline className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.1 : 1.7 }} />
}

function PersonIcon({ active }: { active: boolean }) {
  return <PiUserGearLight className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.1 : 1.7 }} />
}

const LEFT_NAV = [
  { to: '/history',   label: 'Workout',  Icon: DumbbellIcon },
  { to: '/diet',      label: 'Diet',     Icon: ForkIcon     },
]

const RIGHT_NAV = [
  { to: '/chat',      label: 'Kai',      Icon: ChatIcon     },
  { to: '/me',        label: 'Settings', Icon: PersonIcon   },
]

export default function BottomNav() {
  const { user } = db.useAuth()
  const location = useLocation()

  if (!user) return null
  if (HIDE_ON.some(p => location.pathname.startsWith(p))) return null

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + '/')
  const homeActive = isActive('/dashboard')

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <nav className="liquid-pill flex items-center w-full max-w-sm px-2 py-2 gap-0.5 mb-2">
        {/* Left items */}
        {LEFT_NAV.map(({ to, label, Icon }) => {
          const active = isActive(to)
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full transition-all duration-200 active:scale-95"
              style={{
                background: active ? 'rgba(192,132,252,0.12)' : 'transparent',
                color: active ? '#c084fc' : 'rgba(255,255,255,0.38)',
              }}
            >
              <Icon active={active} />
              <span className="font-medium leading-none" style={{ fontSize: 10, color: active ? '#d8b4fe' : 'rgba(255,255,255,0.38)' }}>
                {label}
              </span>
              <span className="w-1 h-1 rounded-full transition-all duration-200"
                style={{ background: '#c084fc', opacity: active ? 1 : 0, boxShadow: active ? '0 0 6px #c084fc' : 'none' }} />
            </Link>
          )
        })}

        {/* Home - centered, prominent */}
        <Link
          to="/dashboard"
          className="flex flex-col items-center gap-0.5 py-2.5 px-4 rounded-full transition-all duration-200 active:scale-95 relative"
          style={{
            background: homeActive
              ? 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(34,211,238,0.15))'
              : 'rgba(255,255,255,0.06)',
            border: homeActive ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(255,255,255,0.09)',
            boxShadow: homeActive ? '0 0 20px rgba(168,85,247,0.2)' : 'none',
            color: homeActive ? '#e9d5ff' : 'rgba(255,255,255,0.5)',
          }}
        >
          <HomeIcon active={homeActive} />
          <span className="font-semibold leading-none" style={{ fontSize: 10, color: homeActive ? '#e9d5ff' : 'rgba(255,255,255,0.45)' }}>
            Home
          </span>
        </Link>

        {/* Right items */}
        {RIGHT_NAV.map(({ to, label, Icon }) => {
          const active = isActive(to)
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full transition-all duration-200 active:scale-95"
              style={{
                background: active ? 'rgba(192,132,252,0.12)' : 'transparent',
                color: active ? '#c084fc' : 'rgba(255,255,255,0.38)',
              }}
            >
              <Icon active={active} />
              <span className="font-medium leading-none" style={{ fontSize: 10, color: active ? '#d8b4fe' : 'rgba(255,255,255,0.38)' }}>
                {label}
              </span>
              <span className="w-1 h-1 rounded-full transition-all duration-200"
                style={{ background: '#c084fc', opacity: active ? 1 : 0, boxShadow: active ? '0 0 6px #c084fc' : 'none' }} />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
