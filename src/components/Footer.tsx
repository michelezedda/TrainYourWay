import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-16 px-4 py-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between border-t border-white/6 pt-6">
        <p className="text-white/25 text-xs">
          &copy; {new Date().getFullYear()} UPLIFT. All rights reserved.
        </p>
        <Link
          to="/support"
          className="flex items-center gap-1.5 text-white/25 hover:text-white/50 transition-colors text-xs"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Support
        </Link>
      </div>
    </footer>
  )
}
