import { Link, useLocation } from 'react-router-dom'
import { PiForkKnifeDuotone, PiUserGearLight, PiBrainLight, PiBarcodeLight, PiUsersThreeLight, PiBookOpenLight } from 'react-icons/pi'
import { GrHomeOption } from 'react-icons/gr'
import { db } from '@/lib/db'

const HIDE_ON = ['/questionnaire', '/generating', '/reevaluate', '/auth', '/onboarding-summary']

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

function PersonIcon({ active }: { active: boolean }) {
  return <PiUserGearLight className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.1 : 1.7 }} />
}

function MindIcon({ active }: { active: boolean }) {
  return <PiBrainLight className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.1 : 1.7 }} />
}

function ScanIcon({ active }: { active: boolean }) {
  return <PiBarcodeLight className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.1 : 1.7 }} />
}

function CommunityIcon({ active }: { active: boolean }) {
  return <PiUsersThreeLight className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.1 : 1.7 }} />
}

function MachineIcon({ active }: { active: boolean }) {
  return <PiBookOpenLight className="w-[22px] h-[22px]" style={{ strokeWidth: active ? 2.1 : 1.7 }} />
}

const LEFT_NAV = [
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon },
  { to: '/diet', label: 'Diet', Icon: ForkIcon },
]

const RIGHT_NAV = [
  { to: '/scanner', label: 'Food Scan', Icon: ScanIcon },
  { to: '/me', label: 'Settings', Icon: PersonIcon },
]

const ALL_NAV = [
  { to: '/dashboard', label: 'Home', Icon: HomeIcon },
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon },
  { to: '/diet', label: 'Diet', Icon: ForkIcon },
  { to: '/wellness', label: 'Mindspace', Icon: MindIcon },
  { to: '/scanner', label: 'Food Scan', Icon: ScanIcon },
  { to: '/machine', label: 'Machine Scanner', Icon: MachineIcon },
  { to: '/community', label: 'Community', Icon: CommunityIcon },
]

export default function Navigation() {
  const { user } = db.useAuth()
  const location = useLocation()

  if (!user) return null
  if (HIDE_ON.some(p => location.pathname.startsWith(p))) return null

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + '/')
  const homeActive = isActive('/dashboard')

  return (
    <>
      {/* ── Mobile: fixed bottom pill (hidden on md+) ─────────────────────── */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center px-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <nav className="liquid-pill flex items-center w-full max-w-sm px-2 py-2 gap-0.5 mb-2 backdrop-blur-sm">
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

          <Link
            to="/dashboard"
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-full transition-all duration-200 active:scale-95"
            style={{
              background: homeActive
                ? 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(34,211,238,0.15))'
                : 'transparent',
              border: homeActive ? '1px solid rgba(168,85,247,0.35)' : 'transparent',
              boxShadow: homeActive ? '0 0 20px rgba(168,85,247,0.2)' : 'none',
              color: homeActive ? '#e9d5ff' : 'rgba(255,255,255,0.5)',
            }}
          >
            <HomeIcon active={homeActive} />
            <span className="font-semibold leading-none" style={{ fontSize: 10, color: homeActive ? '#e9d5ff' : 'rgba(255,255,255,0.45)' }}>
              Home
            </span>
            <span className="w-1 h-1 rounded-full transition-all duration-200"
              style={{ background: '#c084fc', opacity: homeActive ? 1 : 0, boxShadow: homeActive ? '0 0 6px #c084fc' : 'none' }} />
          </Link>

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

      {/* ── Desktop: fixed left sidebar (hidden below md) ──────────────────── */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-full w-56 flex-col z-50 py-6 px-3"
        style={{
          background: 'rgba(5,5,16,0.94)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="px-3 mb-8 flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
            <defs>
              <radialGradient id="navLogoGrad" cx="32%" cy="26%" r="72%">
                <stop offset="0%" stopColor="#C026D3" />
                <stop offset="48%" stopColor="#7C3AED" />
                <stop offset="100%" stopColor="#3B5CF0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="50" fill="url(#navLogoGrad)" />
            <path
              transform="rotate(28, 50, 50)"
              d="M50,13 C37,37 37,37 13,50 C37,63 37,63 50,87 C63,63 63,63 87,50 C63,37 63,37 50,13 Z"
              fill="white"
            />
          </svg>
          <div>
            <h1 className="text-2xl font-black gradient-text leading-tight">UPLYFT</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Train. Evolve. Repeat.</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {ALL_NAV.map(({ to, label, Icon }) => {
            const active = isActive(to)
            const isHome = to === '/dashboard'
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 active:scale-[0.97]"
                style={active
                  ? isHome
                    ? {
                      background: 'linear-gradient(135deg,rgba(168,85,247,0.18),rgba(34,211,238,0.1))',
                      color: '#e9d5ff',
                      border: '1px solid rgba(168,85,247,0.28)',
                    }
                    : {
                      background: 'rgba(168,85,247,0.12)',
                      color: '#c084fc',
                      border: '1px solid rgba(168,85,247,0.2)',
                    }
                  : {
                    color: 'rgba(255,255,255,0.42)',
                    border: '1px solid transparent',
                  }
                }
              >
                <Icon active={active} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Settings — anchored at bottom, separated from primary nav */}
        <div className="mt-2">
          {(() => {
            const active = isActive('/me')
            return (
              <Link
                to="/me"
                className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 active:scale-[0.97]"
                style={active
                  ? { background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }
                  : { color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }
                }
              >
                <PersonIcon active={active} />
                <span className="text-sm font-medium">Settings</span>
              </Link>
            )
          })()}
          <div className="mx-3 mt-3 mb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
          <p className="px-3 text-[10px] text-white/15">© UPLYFT v0.1</p>
        </div>
      </aside>
    </>
  )
}
