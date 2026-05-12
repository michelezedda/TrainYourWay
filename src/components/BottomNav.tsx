import { Link, useLocation } from 'react-router-dom'
import { GrHomeOption } from "react-icons/gr";
import { PiForkKnifeDuotone } from "react-icons/pi";
import { PiUserGearLight } from "react-icons/pi";
import { IoChatbubblesOutline } from "react-icons/io5";
import { db } from '@/lib/db'

const HIDE_ON = ['/questionnaire', '/generating', '/reevaluate', '/auth']

function HomeIcon({ active }: { active: boolean }) {
  return <GrHomeOption className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.2 : 1.8 }} />
}

function ForkIcon({ active }: { active: boolean }) {
  return (
   <PiForkKnifeDuotone className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.2 : 1.8 }}/>
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
  return <IoChatbubblesOutline className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.2 : 1.8 }} />
}

function PersonIcon({ active }: { active: boolean }) {
  return <PiUserGearLight className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.2 : 1.8 }} />
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
