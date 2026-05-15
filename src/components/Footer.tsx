import { Link } from 'react-router-dom'
import { HiQuestionMarkCircle } from 'react-icons/hi'

export default function Footer() {
  return (
    <footer className="mt-16 px-4 py-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between border-t border-white/6 pt-6">
        <p className="text-white/25 text-xs">
          &copy; {new Date().getFullYear()} UPLYFT. All rights reserved.
        </p>
        <Link
          to="/support"
          className="flex items-center gap-1.5 text-white/25 hover:text-white/50 transition-colors text-xs"
        >
          <HiQuestionMarkCircle className="w-3.5 h-3.5" />
          Support
        </Link>
      </div>
    </footer>
  )
}
