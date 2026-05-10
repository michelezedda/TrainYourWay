import { Link, useLocation } from 'react-router-dom'

const HIDE_ON = ['/questionnaire', '/generating']

export default function Header() {
  const location = useLocation()

  if (HIDE_ON.some(p => location.pathname.startsWith(p))) return null

  return (
    <header className="sticky top-0 z-50 px-4 py-3">
      <div
        className="flex items-center px-5 py-3 rounded-2xl"
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
      </div>
    </header>
  )
}
