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
  const [room, setRoom] = useState(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('images')
  const [generatedImages, setGeneratedImages] = useState([])
  const [activeJobId, setActiveJobId] = useState(null)
  const [pipelineStatus, setPipelineStatus] = useState(null)

  const handleGenerationStarted = useCallback((jobId) => {
    setPipelineStatus('generating_2d')
    setActiveJobId(jobId)
    setActiveTab('images')
  }, [])

  const { messages, streaming, loading: chatLoading, sendMessage, fetchMessages } = useChat(
    roomId,
    projectId,
    { onGenerationStarted: handleGenerationStarted }
  )

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
      const has3dData = !!(
        data.room?.worldLabs?.worldId ||
        data.room?.worldLabs?.marbleUrl ||
        data.room?.worldLabs?.splatUrls?.['500k'] ||
        data.room?.worldLabs?.splatUrls?.['100k'] ||
        data.room?.worldLabs?.splatUrls?.full_res
      )
      if (has3dData) {
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
        setGeneratedImages((prev) => [...new Set([...prev, ...activeJob.output.resultUrls])])
        fetchMessages()
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
  }, [activeJob, fetchMessages, fetchRoom])

  useEffect(() => {
    const urlsFromMessages = messages
      .filter((msg) => msg.role === 'assistant')
      .flatMap((msg) => msg.imageUrls || [])
      .filter(Boolean)
    if (urlsFromMessages.length === 0) return
    setGeneratedImages((prev) => [...new Set([...prev, ...urlsFromMessages])])
  }, [messages])

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

  const handleRejectImage = () => {
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

  const handleDownloadArtifact = () => {
    const artifactUrl = room?.artifactUrl
    if (!artifactUrl) return

    if (artifactUrl.startsWith('artifact://')) {
      if (!room?.artifactContent) {
        toast.error('Artifact content is unavailable')
        return
      }

      const safeRoomName = (room?.name || 'room')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '')
      const blob = new Blob([room.artifactContent], { type: 'text/markdown;charset=utf-8' })
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${safeRoomName || 'room'}-artifact.md`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      return
    }

    window.open(artifactUrl, '_blank', 'noopener,noreferrer')
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
  const has3dScene = !!(
    room?.worldLabs?.worldId ||
    room?.worldLabs?.marbleUrl ||
    room?.worldLabs?.splatUrls?.['500k'] ||
    room?.worldLabs?.splatUrls?.['100k'] ||
    room?.worldLabs?.splatUrls?.full_res
  )

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
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex w-1/2 min-h-0 flex-col border-r border-border bg-surface">
          <ChatWindow messages={messages} loading={chatLoading} streaming={streaming} />
          <StatusIndicator status={streaming ? 'thinking' : pipelineStatus} />
          <ChatInput onSend={sendMessage} disabled={streaming} />
        </div>

        {/* Right: Viewer */}
        <div className="flex w-1/2 min-h-0 flex-col bg-surface">
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

            {has3dScene && (
              <Link
                to={`/projects/${projectId}/rooms/${roomId}/3d`}
                className="ml-auto rounded-md border border-border px-3 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text"
              >
                Expand Viewer
              </Link>
            )}
          </div>

          {/* Viewer content */}
          <div className="flex-1 min-h-0 overflow-hidden">
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
              <ThreeViewer
                key={room?.worldLabs?.worldId || room?.worldLabs?.operationId || 'viewer'}
                worldLabs={room?.worldLabs}
              />
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
              <button
                onClick={handleDownloadArtifact}
                className="ml-auto text-sm text-primary transition-colors hover:text-primary-hover"
              >
                Download Artifact
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
