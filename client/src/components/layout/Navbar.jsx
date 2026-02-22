import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { HiOutlineLogout, HiOutlineHome } from 'react-icons/hi'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  const initials = user?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-surface px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            IS
          </div>
          <span className="text-lg font-semibold text-text">Ironsite</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
          title="Dashboard"
        >
          <HiOutlineHome className="h-5 w-5" />
        </Link>

        <div className="flex items-center gap-3 border-l border-border pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">
            {initials}
          </div>
          <span className="hidden text-sm font-medium text-text sm:block">
            {user?.displayName}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-alt hover:text-danger"
            title="Sign out"
          >
            <HiOutlineLogout className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
