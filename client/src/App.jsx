import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import ErrorBoundary from './components/shared/ErrorBoundary'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProjectPage from './pages/ProjectPage'
import WorkspacePage from './pages/WorkspacePage'
import Viewer3DPage from './pages/Viewer3DPage'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects/:projectId" element={<ProjectPage />} />
              <Route path="/projects/:projectId/rooms/:roomId" element={<WorkspacePage />} />
              <Route path="/projects/:projectId/rooms/:roomId/3d" element={<Viewer3DPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '0.75rem',
              background: '#ffffff',
              color: '#2c1a05',
              fontSize: '0.875rem',
              border: '1px solid rgba(200,150,92,0.28)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            },
            success: {
              iconTheme: { primary: '#c8965c', secondary: '#ffffff' },
            },
            error: {
              iconTheme: { primary: '#e05252', secondary: '#ffffff' },
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  )
}
