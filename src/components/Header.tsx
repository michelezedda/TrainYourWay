import { Link, useLocation } from 'react-router-dom'

const HIDE_NAV_ON = ['/questionnaire', '/generating']

export default function Header() {
  const location = useLocation()
  const showNav = !HIDE_NAV_ON.includes(location.pathname)

  return (
    <header className="sticky top-0 z-50 px-4 py-3">
      <div className="max-w-5xl mx-auto">
        <div
          className="flex items-center justify-between px-5 py-3 rounded-2xl"
          style={{
            background: 'rgba(5, 5, 16, 0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="Uplift" className="w-8 h-8 rounded-xl object-cover" />
            <span className="font-black text-lg tracking-tight gradient-text">UPLIFT</span>
          </Link>

          {showNav && (
            <nav className="flex items-center gap-1">
              <NavLink to="/" label="Home" />
              <NavLink to="/history" label="History" />
              <NavLink to="/diet" label="Diet" />
              <NavLink to="/chat" label="Kai" />
              <Link
                to="/support"
                className={`px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/support'
                    ? 'text-white bg-white/10'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
                title="Support"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </Link>
              <Link to="/questionnaire" className="btn-primary !px-5 !py-2 !text-sm ml-2">
                New Plan
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'text-white bg-white/10'
          : 'text-white/50 hover:text-white/80 hover:bg-white/5'
      }`}
    >
      {label}
    </Link>
  )
}
