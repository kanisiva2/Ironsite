import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HiArrowLeft } from 'react-icons/hi'
import Navbar from '../components/layout/Navbar'
import ThreeViewer from '../components/viewer/ThreeViewer'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import StatusIndicator from '../components/chat/StatusIndicator'
import usePollJob from '../hooks/usePollJob'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function Viewer3DPage() {
  const { projectId, roomId } = useParams()
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeJobId, setActiveJobId] = useState(null)
  const [pipelineStatus, setPipelineStatus] = useState(null)

  const { job: activeJob } = usePollJob(activeJobId)

  const fetchRoom = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/rooms/${roomId}`)
      setRoom(data.room)
    } catch {
      toast.error('Failed to load 3D scene')
    } finally {
      setLoading(false)
    }
  }, [projectId, roomId])

  useEffect(() => {
    fetchRoom()
  }, [fetchRoom])

  useEffect(() => {
    if (activeJob?.status === 'completed' && activeJob?.type === 'model_3d') {
      setPipelineStatus(null)
      setActiveJobId(null)
      fetchRoom()
      toast.success('3D model updated')
    } else if (activeJob?.status === 'failed') {
      setPipelineStatus(null)
      setActiveJobId(null)
      toast.error(activeJob.output?.error || '3D generation failed')
    }
  }, [activeJob, fetchRoom])

  const handleGenerate3D = async (model = 'Marble 0.1-plus') => {
    try {
      setPipelineStatus('generating_3d')
      const { data } = await api.post('/generate/3d', { roomId, projectId, model })
      setActiveJobId(data.jobId)
    } catch (err) {
      setPipelineStatus(null)
      toast.error(err.response?.data?.detail || 'Failed to start 3D generation')
    }
  }

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

        <div className="flex items-center gap-2">
          {!!room?.artifactUrl && (
            <>
              <button
                onClick={() => handleGenerate3D('Marble 0.1-mini')}
                disabled={!!pipelineStatus}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface-alt disabled:opacity-40"
              >
                Quick 3D
              </button>
              <button
                onClick={() => handleGenerate3D('Marble 0.1-plus')}
                disabled={!!pipelineStatus}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
              >
                {pipelineStatus === 'generating_3d' ? 'Rendering…' : 'Regenerate 3D'}
              </button>
            </>
          )}
          <Link
            to={`/projects/${projectId}/rooms/${roomId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface-alt"
          >
            <HiArrowLeft className="h-4 w-4" />
            Back to Workspace
          </Link>
        </div>
      </div>

      <StatusIndicator status={pipelineStatus} />

      <div className="flex-1 min-h-0 p-4">
        <div className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <ThreeViewer
            key={room?.worldLabs?.worldId || room?.worldLabs?.operationId || 'viewer'}
            worldLabs={room?.worldLabs}
            projectId={projectId}
            roomId={roomId}
          />
        </div>
      </div>
    </div>
  )
}
