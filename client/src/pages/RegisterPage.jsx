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
      toast.success('Account created!')
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-text">Ironsite</h1>
          <p className="mt-2 text-text-muted">AI Architect Studio</p>
        </div>

        <div className="rounded-xl bg-surface p-8 shadow-lg">
          <h2 className="mb-6 text-xl font-semibold text-text">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-text">
                Full Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-light"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-text">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-light"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-text">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-light"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-text">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-light"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
