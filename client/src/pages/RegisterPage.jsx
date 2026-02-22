import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await register(email, password, displayName)
      toast.success('Your atelier has been commissioned.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4 py-12">
      <div className="w-full max-w-md">

        {/* Classical monumental heading */}
        <div className="mb-10 text-center">
          <div className="mb-5 flex items-center justify-center gap-4">
            <div className="h-px w-14 bg-gradient-to-r from-transparent to-primary/50" />
            <svg className="h-3 w-3 shrink-0 text-primary" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 0L7.4 4.6H12L8.3 7.4L9.7 12L6 9.2L2.3 12L3.7 7.4L0 4.6H4.6Z" />
            </svg>
            <div className="h-px w-14 bg-gradient-to-l from-transparent to-primary/50" />
          </div>
          <h1 className="mb-2 text-5xl font-light tracking-[0.22em] text-text uppercase">
            Ironsite
          </h1>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-text-muted">
            AI Architectural Atelier
          </p>
        </div>

        {/* Card with Greek column pillar accents */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 shadow-lg">
          <div className="absolute left-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-primary/18 to-transparent" />
          <div className="absolute right-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-primary/18 to-transparent" />

          <h2 className="mb-6 text-2xl font-light text-text">Create Your Account</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="displayName" className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Full Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface-alt px-4 py-3 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface-alt px-4 py-3 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Passphrase
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-border bg-surface-alt px-4 py-3 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Confirm Passphrase
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-border bg-surface-alt px-4 py-3 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </form>

          <div className="ornamental-divider my-6 text-xs">◆</div>

          <p className="text-center text-sm text-text-muted">
            Already a member?{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
              Sign In
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
