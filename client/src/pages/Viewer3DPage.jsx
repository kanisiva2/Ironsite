import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HiArrowLeft } from 'react-icons/hi'
import Navbar from '../components/layout/Navbar'
import ThreeViewer from '../components/viewer/ThreeViewer'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function Viewer3DPage() {
  const { projectId, roomId } = useParams()
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data } = await api.get(`/projects/${projectId}/rooms/${roomId}`)
        setRoom(data.room)
      } catch {
        toast.error('Failed to load 3D scene')
      } finally {
        setLoading(false)
      }
    }

    fetchRoom()
  }, [projectId, roomId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-surface-alt">
      <Navbar />

      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-text">
            {room?.name || 'Room'} 3D Viewer
          </h1>
          <p className="text-xs text-text-muted">
            Use mouse/touch controls to navigate and inspect the generated scene.
          </p>
        </div>

        <Link
          to={`/projects/${projectId}/rooms/${roomId}`}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface-alt"
        >
          <HiArrowLeft className="h-4 w-4" />
          Back to Workspace
        </Link>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <div className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <ThreeViewer
            key={room?.worldLabs?.worldId || room?.worldLabs?.operationId || 'viewer'}
            worldLabs={room?.worldLabs}
          />
        </div>
      </div>
    </div>
  )
}
