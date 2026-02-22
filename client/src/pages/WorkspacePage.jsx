import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { HiChevronRight } from 'react-icons/hi'
import Navbar from '../components/layout/Navbar'
import ChatWindow from '../components/chat/ChatWindow'
import ChatInput from '../components/chat/ChatInput'
import StatusIndicator from '../components/chat/StatusIndicator'
import ImageViewer from '../components/viewer/ImageViewer'
import ThreeViewer from '../components/viewer/ThreeViewer'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import useChat from '../hooks/useChat'
import usePollJob from '../hooks/usePollJob'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function WorkspacePage() {
  const { projectId, roomId } = useParams()
  const { messages, streaming, loading: chatLoading, sendMessage, fetchMessages } = useChat(roomId, projectId)

  const [room, setRoom] = useState(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('images')
  const [generatedImages, setGeneratedImages] = useState([])
  const [activeJobId, setActiveJobId] = useState(null)
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const [projectName, setProjectName] = useState('')

  const { job: activeJob } = usePollJob(activeJobId)

  const fetchRoom = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/rooms/${roomId}`)
      setRoom(data.room)
      if (data.room.approved2dImageUrls?.length > 0) {
        setGeneratedImages((prev) =>
          [...new Set([...prev, ...data.room.approved2dImageUrls])]
        )
      }
      if (data.room.worldLabs?.splatUrls) {
        setActiveTab('3d')
      }
    } catch {
      toast.error('Failed to load room')
    } finally {
      setRoomLoading(false)
    }
  }, [projectId, roomId])

  useEffect(() => {
    api.get(`/projects/${projectId}`).then(({ data }) => {
      setProjectName(data.project?.name || data.name || '')
    }).catch(() => {})
    fetchRoom()
    fetchMessages()
  }, [fetchRoom, fetchMessages])

  useEffect(() => {
    if (activeJob?.status === 'completed') {
      if (activeJob.type === 'image_2d' && activeJob.output?.resultUrls) {
        setGeneratedImages((prev) => [...prev, ...activeJob.output.resultUrls])
        setPipelineStatus(null)
      } else if (activeJob.type === 'model_3d') {
        fetchRoom()
        setActiveTab('3d')
        setPipelineStatus(null)
      } else if (activeJob.type === 'artifact') {
        fetchRoom()
        setPipelineStatus(null)
      }
      setActiveJobId(null)
    } else if (activeJob?.status === 'failed') {
      toast.error(activeJob.output?.error || 'Generation failed')
      setPipelineStatus(null)
      setActiveJobId(null)
    }
  }, [activeJob, fetchRoom])

  const handleApproveImage = async (imageUrl) => {
    try {
      const current = room?.approved2dImageUrls || []
      if (current.includes(imageUrl)) return
      await api.put(`/projects/${projectId}/rooms/${roomId}`, {
        approved2dImageUrls: [...current, imageUrl],
      })
      setRoom((prev) => ({
        ...prev,
        approved2dImageUrls: [...current, imageUrl],
      }))
      toast.success('Image approved!')
    } catch {
      toast.error('Failed to approve image')
    }
  }

  const handleRejectImage = (imageUrl) => {
    const feedback = window.prompt('What should be different?')
    if (feedback) {
      sendMessage(`Regarding the generated image: ${feedback}`)
    }
  }

  const handleRegenerate = async () => {
    try {
      setPipelineStatus('generating_2d')
      const { data } = await api.post('/generate/2d', { roomId, projectId, prompt: 'Regenerate with previous feedback' })
      setActiveJobId(data.jobId)
    } catch {
      toast.error('Failed to regenerate')
      setPipelineStatus(null)
    }
  }

  const handleGenerateArtifact = async () => {
    try {
      setPipelineStatus('generating_artifact')
      const { data } = await api.post('/generate/artifact', { roomId, projectId })
      setActiveJobId(data.jobId)
    } catch {
      toast.error('Failed to generate artifact')
      setPipelineStatus(null)
    }
  }

  const handleGenerate3D = async (model = 'Marble 0.1-plus') => {
    try {
      setPipelineStatus('generating_3d')
      const { data } = await api.post('/generate/3d', { roomId, projectId, model })
      setActiveJobId(data.jobId)
    } catch {
      toast.error('Failed to start 3D generation')
      setPipelineStatus(null)
    }
  }

  if (roomLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const approvedCount = room?.approved2dImageUrls?.length || 0
  const hasArtifact = !!room?.artifactUrl

  return (
    <div className="flex h-screen flex-col bg-surface-alt">
      <Navbar />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-6 py-2 text-sm text-text-muted">
        <Link to="/dashboard" className="transition-colors hover:text-primary">Homes</Link>
        <HiChevronRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}`} className="transition-colors hover:text-primary">{projectName || 'Home'}</Link>
        <HiChevronRight className="h-3 w-3" />
        <span className="font-medium text-text">{room?.name || 'Room'}</span>
      </div>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex w-1/2 flex-col border-r border-border bg-surface">
          <ChatWindow messages={messages} loading={chatLoading} streaming={streaming} />
          <StatusIndicator status={streaming ? 'thinking' : pipelineStatus} />
          <ChatInput onSend={sendMessage} disabled={streaming} />
        </div>

        {/* Right: Viewer */}
        <div className="flex w-1/2 flex-col bg-surface">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border px-4 pt-2">
            <button
              onClick={() => setActiveTab('images')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'images'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Renderings {generatedImages.length > 0 && `(${generatedImages.length})`}
            </button>
            <button
              onClick={() => setActiveTab('3d')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === '3d'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Spatial Model
            </button>
          </div>

          {/* Viewer content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'images' ? (
              <ImageViewer
                images={generatedImages}
                approvedUrls={room?.approved2dImageUrls || []}
                onApprove={handleApproveImage}
                onReject={handleRejectImage}
                onRegenerate={handleRegenerate}
                loading={pipelineStatus === 'generating_2d'}
              />
            ) : (
              <ThreeViewer worldLabs={room?.worldLabs} />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 border-t border-border bg-surface-alt px-4 py-3">
            <button
              onClick={handleGenerateArtifact}
              disabled={approvedCount === 0 || pipelineStatus}
              className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-secondary/80 disabled:opacity-40"
            >
              {pipelineStatus === 'generating_artifact' ? 'Generating…' : 'Generate Blueprint'}
            </button>

            <button
              onClick={() => handleGenerate3D('Marble 0.1-plus')}
              disabled={!hasArtifact || pipelineStatus}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              {pipelineStatus === 'generating_3d' ? 'Rendering…' : 'Generate 3D Model'}
            </button>

            {hasArtifact && (
              <button
                onClick={() => handleGenerate3D('Marble 0.1-mini')}
                disabled={pipelineStatus}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-40"
              >
                Quick 3D
              </button>
            )}

            {room?.artifactUrl && (
              <a
                href={room.artifactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-sm text-primary transition-colors hover:text-primary-hover"
              >
                Download Blueprint
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
