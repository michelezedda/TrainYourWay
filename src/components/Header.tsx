import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

const HIDE_NAV_ON = ['/questionnaire', '/generating']

export default function Header() {
  const location = useLocation()
  const showNav = !HIDE_NAV_ON.includes(location.pathname)
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [location.pathname])

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
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Uplift" className="w-8 h-8 rounded-xl object-cover" />
            <span className="font-black text-lg tracking-tight gradient-text">UPLIFT</span>
          </Link>

          {showNav && (
            <>
              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-1">
                <NavLink to="/" label="Home" />
                <NavLink to="/history" label="History" />
                <NavLink to="/diet" label="Diet" />
                <Link
                  to="/scanner"
                  className={`px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    location.pathname === '/scanner'
                      ? 'text-white bg-white/10'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                  title="Food Scanner"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3a2 2 0 00-2 2v6a2 2 0 002 2h2V8zm12-4h2a2 2 0 012 2v6a2 2 0 01-2 2h-2V4zM9 8H7v8h2V8z" />
                  </svg>
                </Link>
                <NavLink to="/chat" label="Kai" />
                <Link
                  to="/me"
                  className={`px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    location.pathname === '/me'
                      ? 'text-white bg-white/10'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                  title="My Profile"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
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

              {/* Mobile hamburger */}
              <button
                onClick={() => setOpen(o => !o)}
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                style={{ background: open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)' }}
                aria-label="Toggle menu"
              >
                {open ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>

        {/* Mobile dropdown */}
        {showNav && open && (
          <div
            className="md:hidden mt-2 rounded-2xl overflow-hidden animate-fade-in"
            style={{
              background: 'rgba(5, 5, 16, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <nav className="flex flex-col p-2 gap-0.5">
              <MobileNavLink to="/" label="Home" />
              <MobileNavLink to="/history" label="History" />
              <MobileNavLink to="/diet" label="Diet" />
              <MobileNavLink to="/scanner" label="Scanner" />
              <MobileNavLink to="/chat" label="Kai" />
              <MobileNavLink to="/me" label="Me" />
              <MobileNavLink to="/support" label="Support" />
              <div className="pt-2 mt-1.5 border-t border-white/8">
                <Link
                  to="/questionnaire"
                  className="btn-primary w-full flex items-center justify-center !py-2.5 !text-sm"
                >
                  New Plan
                </Link>
              </div>
            </nav>
          </div>
        )}
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
        isActive ? 'text-white bg-white/10' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
      }`}
    >
      {label}
    </Link>
  )
}

function MobileNavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation()
  const isActive = location.pathname === to
  return (
    <Link
      to={to}
      className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
        isActive ? 'text-white bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
    </Link>
  )
}
