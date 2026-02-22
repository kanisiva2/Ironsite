import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
