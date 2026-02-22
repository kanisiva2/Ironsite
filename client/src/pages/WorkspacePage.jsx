import { useState, useEffect, useCallback, useMemo } from 'react'
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

function createEmptySiteForm() {
  return {
    address: '',
    parcelId: '',
    zoningDistrict: '',
    lotAreaSqFt: '',
    maxHeightFt: '',
    maxLotCoveragePct: '',
    setbacksFt: { front: '', rear: '', left: '', right: '' },
    proposed: {
      footprintAreaSqFt: '',
      heightFt: '',
      setbacksFt: { front: '', rear: '', left: '', right: '' },
    },
  }
}

function siteToForm(site) {
  const empty = createEmptySiteForm()
  if (!site) return empty

  const valueOrEmpty = (value) => (value !== null && value !== undefined ? String(value) : '')

  return {
    address: site.address || '',
    parcelId: site.parcelId || '',
    zoningDistrict: site.zoningDistrict || '',
    lotAreaSqFt: valueOrEmpty(site.lotAreaSqFt),
    maxHeightFt: valueOrEmpty(site.maxHeightFt),
    maxLotCoveragePct: valueOrEmpty(site.maxLotCoveragePct),
    setbacksFt: {
      front: valueOrEmpty(site.setbacksFt?.front),
      rear: valueOrEmpty(site.setbacksFt?.rear),
      left: valueOrEmpty(site.setbacksFt?.left),
      right: valueOrEmpty(site.setbacksFt?.right),
    },
    proposed: {
      footprintAreaSqFt: valueOrEmpty(site.proposed?.footprintAreaSqFt),
      heightFt: valueOrEmpty(site.proposed?.heightFt),
      setbacksFt: {
        front: valueOrEmpty(site.proposed?.setbacksFt?.front),
        rear: valueOrEmpty(site.proposed?.setbacksFt?.rear),
        left: valueOrEmpty(site.proposed?.setbacksFt?.left),
        right: valueOrEmpty(site.proposed?.setbacksFt?.right),
      },
    },
  }
}

function formToSite(form) {
  const toNumberOrNull = (value) => {
    if (value === '' || value == null) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return {
    address: form.address?.trim() || '',
    parcelId: form.parcelId?.trim() || '',
    zoningDistrict: form.zoningDistrict?.trim() || '',
    lotAreaSqFt: toNumberOrNull(form.lotAreaSqFt),
    maxHeightFt: toNumberOrNull(form.maxHeightFt),
    maxLotCoveragePct: toNumberOrNull(form.maxLotCoveragePct),
    setbacksFt: {
      front: toNumberOrNull(form.setbacksFt?.front),
      rear: toNumberOrNull(form.setbacksFt?.rear),
      left: toNumberOrNull(form.setbacksFt?.left),
      right: toNumberOrNull(form.setbacksFt?.right),
    },
    proposed: {
      footprintAreaSqFt: toNumberOrNull(form.proposed?.footprintAreaSqFt),
      heightFt: toNumberOrNull(form.proposed?.heightFt),
      setbacksFt: {
        front: toNumberOrNull(form.proposed?.setbacksFt?.front),
        rear: toNumberOrNull(form.proposed?.setbacksFt?.rear),
        left: toNumberOrNull(form.proposed?.setbacksFt?.left),
        right: toNumberOrNull(form.proposed?.setbacksFt?.right),
      },
    },
  }
}

function formatStatusLabel(status) {
  if (!status) return 'Unknown'
  return String(status)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusBadgeClasses(status) {
  if (status === 'pass') return 'border border-success/30 bg-success/10 text-success'
  if (status === 'fail') return 'border border-danger/30 bg-danger/10 text-danger'
  if (status === 'needs_info') return 'border border-warning/30 bg-warning/10 text-warning'
  return 'border border-border bg-surface-alt text-text-muted'
}

function summarizeZoningStatus(report) {
  if (!report?.reportJson?.checks) return 'Run “Check What\'s Missing” to see what details are still needed.'

  const checks = report.reportJson.checks
  const passCount = checks.filter((c) => c.status === 'pass').length
  const failCount = checks.filter((c) => c.status === 'fail').length
  const needsInfoCount = checks.filter((c) => c.status === 'needs_info').length
  const status = report.status || report.reportJson.complianceStatus

  if (status === 'needs_info') {
    return needsInfoCount > 0
      ? `We still need ${needsInfoCount} detail${needsInfoCount === 1 ? '' : 's'} before this report can be fully checked.`
      : 'We still need a few details before this report can be fully checked.'
  }
  if (status === 'fail') {
    return `${failCount} issue${failCount === 1 ? '' : 's'} found. Review the failed checks below.`
  }
  if (status === 'pass') {
    return `${passCount} checks passed. No issues were found in these zoning checks.`
  }
  return 'Review the zoning checks below.'
}

const THREE_MODEL_ESTIMATE_MS = {
  'Marble 0.1-mini': 45 * 1000,
  'Marble 0.1-plus': 10 * 60 * 1000,
}

function formatEta(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

export default function WorkspacePage() {
  const { projectId, roomId } = useParams()
  const [project, setProject] = useState(null)
  const [projectName, setProjectName] = useState('')
  const [room, setRoom] = useState(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('images')
  const [generatedImages, setGeneratedImages] = useState([])
  const [activeJobId, setActiveJobId] = useState(null)
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const [siteForm, setSiteForm] = useState(createEmptySiteForm)
  const [showManualComplianceInputs, setShowManualComplianceInputs] = useState(false)
  const [docsPreflight, setDocsPreflight] = useState(null)
  const [preflightLoading, setPreflightLoading] = useState(null)

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

  const threeProgressUi = useMemo(() => {
    if (pipelineStatus !== 'generating_3d' || !threeProgress) return null

    const elapsedMs = Math.max(0, timeNow - threeProgress.startedAt)
    const estimatedMs = Math.max(1, threeProgress.estimatedMs)
    const modelCompleted = activeJob?.type === 'model_3d' && activeJob?.status === 'completed'
    const progress = modelCompleted ? 100 : Math.min(95, (elapsedMs / estimatedMs) * 100)
    const remainingMs = modelCompleted ? 0 : Math.max(0, estimatedMs - elapsedMs)
    const isOverEstimate = !modelCompleted && elapsedMs > estimatedMs

    return {
      model: threeProgress.model,
      progress,
      remainingMs,
      isOverEstimate,
      modelCompleted,
    }
  }, [pipelineStatus, threeProgress, timeNow, activeJob])

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}`)
      const nextProject = data.project || data
      setProject(nextProject)
      setProjectName(nextProject?.name || '')
      setSiteForm(siteToForm(nextProject?.site))
    } catch {
      // handled elsewhere by room fetch / page navigation
    }
  }, [projectId])

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
    fetchProject()
    fetchRoom()
    fetchMessages()
  }, [fetchProject, fetchRoom, fetchMessages])

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
        setThreeProgress(null)
      } else if (activeJob.type === 'artifact') {
        fetchRoom()
        setPipelineStatus(null)
      } else if (activeJob.type === 'zoning_report') {
        fetchProject()
        fetchMessages()
        setActiveTab('compliance')
        setPipelineStatus(null)
      }
      setActiveJobId(null)
    } else if (activeJob?.status === 'failed') {
      toast.error(activeJob.output?.error || 'Generation failed')
      if (activeJob.type === 'model_3d') {
        setThreeProgress(null)
      }
      setPipelineStatus(null)
      setActiveJobId(null)
    }
  }, [activeJob, fetchMessages, fetchProject, fetchRoom])

  useEffect(() => {
    if (pipelineStatus !== 'generating_3d' || !threeProgress) return undefined

    const timer = setInterval(() => {
      setTimeNow(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [pipelineStatus, threeProgress])

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
      setThreeProgress({
        model,
        startedAt: Date.now(),
        estimatedMs: THREE_MODEL_ESTIMATE_MS[model] || THREE_MODEL_ESTIMATE_MS['Marble 0.1-plus'],
      })
    } catch {
      toast.error('Failed to start 3D generation')
      setPipelineStatus(null)
      setThreeProgress(null)
    }
  }

  const handleAskGeminiForDocsPrep = async () => {
    try {
      setPreflightLoading('docs')
      const { data } = await api.post('/generate/artifact/preflight', { projectId, roomId })
      setDocsPreflight(data.preflight || null)
      toast.success('Checked what is missing for your technical docs')
    } catch {
      toast.error('Failed to check technical docs requirements')
    } finally {
      setPreflightLoading(null)
    }
  }

  const handleSiteFieldChange = (key, value) => {
    setSiteForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSiteNestedChange = (group, key, value) => {
    setSiteForm((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: value,
      },
    }))
  }

  const handleSiteDeepChange = (root, group, key, value) => {
    setSiteForm((prev) => ({
      ...prev,
      [root]: {
        ...prev[root],
        [group]: {
          ...prev[root][group],
          [key]: value,
        },
      },
    }))
  }

  const handleSaveSite = async () => {
    try {
      const nextSite = formToSite(siteForm)
      const { data } = await api.put(`/projects/${projectId}`, { site: nextSite })
      const nextProject = data.project
      setProject(nextProject)
      setProjectName(nextProject?.name || '')
      setSiteForm(siteToForm(nextProject?.site))
      toast.success('Site constraints saved')
    } catch {
      toast.error('Failed to save site constraints')
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
  const artifactMetadata = room?.artifactMetadata
  const zoningReport = project?.regulatory?.zoning
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
              onClick={() => setActiveTab('compliance')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'compliance'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Reports & Docs {zoningReport?.status ? `(${formatStatusLabel(zoningReport.status)})` : ''}
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
            ) : activeTab === 'compliance' ? (
              <div className="h-full overflow-y-auto p-4">
                <div className="mx-auto max-w-4xl space-y-6">
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-text">Reports & Technical Docs</h3>
                        <p className="text-xs text-text-muted">
                          Create room technical docs here. Your zoning report is created once for the whole home.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/projects/${projectId}`}
                          className="rounded-md border border-border px-3 py-2 text-xs font-medium text-text hover:bg-surface-alt"
                        >
                          Open Home Zoning Report
                        </Link>
                        <button
                          onClick={handleGenerateArtifact}
                          disabled={approvedCount === 0 || !!pipelineStatus}
                          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-40"
                        >
                          {pipelineStatus === 'generating_artifact' ? 'Creating…' : 'Create Technical Docs'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-surface-alt p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        How It Works
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-text-muted">
                        <div>1. Chat with Archvision about this room and your overall home plans.</div>
                        <div>2. Use the Home page for the whole-home zoning report.</div>
                        <div>3. Approve a room image, then create technical docs here.</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={handleAskGeminiForDocsPrep}
                          disabled={streaming || !!pipelineStatus}
                          className="rounded-md border border-border px-3 py-2 text-xs font-medium text-text hover:bg-surface disabled:opacity-40"
                        >
                          {preflightLoading === 'docs' ? 'Checking…' : 'Check Docs Questions'}
                        </button>
                        <button
                          onClick={() => setShowManualComplianceInputs((prev) => !prev)}
                          className="rounded-md border border-border px-3 py-2 text-xs font-medium text-text hover:bg-surface disabled:opacity-40"
                        >
                          {showManualComplianceInputs ? 'Hide Advanced Details' : 'Advanced Details (Optional)'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Whole-Home Zoning Report
                        </div>
                        {zoningReport?.status && (
                          <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClasses(zoningReport.status || zoningReport.reportJson?.complianceStatus)}`}>
                            {formatStatusLabel(zoningReport.status || zoningReport.reportJson?.complianceStatus)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-muted">
                        Zoning is checked once for the full home. Open the Home page to check what is missing and create the report.
                      </p>
                      <div className="mt-3">
                        <Link
                          to={`/projects/${projectId}`}
                          className="inline-flex rounded-md border border-border px-3 py-2 text-xs font-medium text-text hover:bg-surface-alt"
                        >
                          Go to Home Page
                        </Link>
                      </div>
                    </div>

                    {artifactMetadata?.inputAcquisition && (
                      <div className="mt-4 rounded-lg border border-border p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Technical Docs Readiness
                        </div>
                        <div className="text-xs text-text-muted">
                          Archvision review: {artifactMetadata.inputAcquisition.extractionStatus === 'completed' ? 'Complete' : formatStatusLabel(artifactMetadata.inputAcquisition.extractionStatus)}
                        </div>
                        {(artifactMetadata.inputAcquisition.missingQuestions || []).length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-text-muted">
                            {artifactMetadata.inputAcquisition.missingQuestions.map((question, index) => (
                              <div key={`${question}-${index}`}>{question}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {docsPreflight && (
                      <div className="mt-4 rounded-lg border border-border p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Docs Check (Latest)
                        </div>
                        <div className="text-xs text-text-muted">
                          Approved images: {docsPreflight.approvedImageCount || 0}
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          Ready to create docs: {docsPreflight.canGenerateTechnicalDocs ? 'Yes' : 'No (approve at least one image first)'}
                        </div>
                        {(docsPreflight.missingQuestions || []).length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-text-muted">
                            {docsPreflight.missingQuestions.map((question, index) => (
                              <div key={`${question}-${index}`}>{question}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {showManualComplianceInputs && (
                      <div className="mt-4 rounded-lg border border-border p-3">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                              Advanced Details
                            </h4>
                            <p className="mt-1 text-xs text-text-muted">
                              Only use this if Archvision missed something or you want to correct a value before creating the whole-home zoning report on the Home page.
                            </p>
                          </div>
                          <button
                            onClick={handleSaveSite}
                            disabled={!!pipelineStatus}
                            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-text hover:bg-surface-alt disabled:opacity-40"
                          >
                            Save Advanced Details
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <label className="text-xs text-text-muted">
                            Address
                            <input
                              value={siteForm.address}
                              onChange={(e) => handleSiteFieldChange('address', e.target.value)}
                              className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                              placeholder="123 Main St"
                            />
                          </label>
                          <label className="text-xs text-text-muted">
                            Parcel ID
                            <input
                              value={siteForm.parcelId}
                              onChange={(e) => handleSiteFieldChange('parcelId', e.target.value)}
                              className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                              placeholder="Optional"
                            />
                          </label>
                          <label className="text-xs text-text-muted">
                            Zoning District
                            <input
                              value={siteForm.zoningDistrict}
                              onChange={(e) => handleSiteFieldChange('zoningDistrict', e.target.value)}
                              className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                              placeholder="R-1"
                            />
                          </label>
                          <label className="text-xs text-text-muted">
                            Lot Area (sq ft)
                            <input
                              type="number"
                              value={siteForm.lotAreaSqFt}
                              onChange={(e) => handleSiteFieldChange('lotAreaSqFt', e.target.value)}
                              className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                            />
                          </label>
                          <label className="text-xs text-text-muted">
                            Max Height (ft)
                            <input
                              type="number"
                              value={siteForm.maxHeightFt}
                              onChange={(e) => handleSiteFieldChange('maxHeightFt', e.target.value)}
                              className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                            />
                          </label>
                          <label className="text-xs text-text-muted">
                            Max Lot Coverage (%)
                            <input
                              type="number"
                              value={siteForm.maxLotCoveragePct}
                              onChange={(e) => handleSiteFieldChange('maxLotCoveragePct', e.target.value)}
                              className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                            />
                          </label>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="rounded-lg border border-border p-3">
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                              Required Setbacks (ft)
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {['front', 'rear', 'left', 'right'].map((side) => (
                                <label key={`req-${side}`} className="text-xs text-text-muted">
                                  {side[0].toUpperCase() + side.slice(1)}
                                  <input
                                    type="number"
                                    value={siteForm.setbacksFt[side]}
                                    onChange={(e) => handleSiteNestedChange('setbacksFt', side, e.target.value)}
                                    className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg border border-border p-3">
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                              Proposed Building (ft / sq ft)
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="col-span-2 text-xs text-text-muted">
                                Footprint Area (sq ft)
                                <input
                                  type="number"
                                  value={siteForm.proposed.footprintAreaSqFt}
                                  onChange={(e) => handleSiteNestedChange('proposed', 'footprintAreaSqFt', e.target.value)}
                                  className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                                />
                              </label>
                              <label className="col-span-2 text-xs text-text-muted">
                                Building Height (ft)
                                <input
                                  type="number"
                                  value={siteForm.proposed.heightFt}
                                  onChange={(e) => handleSiteNestedChange('proposed', 'heightFt', e.target.value)}
                                  className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                                />
                              </label>
                              {['front', 'rear', 'left', 'right'].map((side) => (
                                <label key={`prop-${side}`} className="text-xs text-text-muted">
                                  {`Proposed ${side[0].toUpperCase() + side.slice(1)} setback`}
                                  <input
                                    type="number"
                                    value={siteForm.proposed.setbacksFt[side]}
                                    onChange={(e) => handleSiteDeepChange('proposed', 'setbacksFt', side, e.target.value)}
                                    className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-surface p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-text">Whole-Home Zoning Report</h3>
                        <p className="text-xs text-text-muted">
                          This report is shared across the entire home. Open the Home page to generate it or review missing details.
                        </p>
                      </div>
                    </div>

                    {!zoningReport ? (
                      <div className="space-y-3">
                        <p className="text-sm text-text-muted">
                          No whole-home zoning report yet.
                        </p>
                        <Link
                          to={`/projects/${projectId}`}
                          className="inline-flex rounded-md border border-border px-3 py-2 text-xs font-medium text-text hover:bg-surface-alt"
                        >
                          Open Home Page
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-lg bg-surface-alt p-3">
                          <div className="text-xs uppercase tracking-wide text-text-muted">Status</div>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClasses(zoningReport.status || zoningReport.reportJson?.complianceStatus)}`}>
                              {formatStatusLabel(zoningReport.status || zoningReport.reportJson?.complianceStatus)}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-text-muted">{summarizeZoningStatus(zoningReport)}</div>
                          <div className="mt-3">
                            <Link
                              to={`/projects/${projectId}`}
                              className="inline-flex rounded-md border border-border px-3 py-2 text-xs font-medium text-text hover:bg-surface"
                            >
                              Review on Home Page
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <ThreeViewer
                key={room?.worldLabs?.worldId || room?.worldLabs?.operationId || 'viewer'}
                worldLabs={room?.worldLabs}
              />
            )}
          </div>

          {/* Generation controls */}
          <div className="border-t border-border bg-surface-alt px-4 py-3">
            {threeProgressUi && (
              <div className="mb-3 rounded-lg border border-border bg-surface px-3 py-2">
                <div className="mb-1.5 flex items-center justify-between text-xs text-text-muted">
                  <span>
                    Generating 3D ({threeProgressUi.model === 'Marble 0.1-mini' ? 'Quick model' : 'High-quality model'})
                  </span>
                  <span>
                    {threeProgressUi.modelCompleted
                      ? 'Complete'
                      : threeProgressUi.isOverEstimate
                      ? 'Taking longer than expected'
                      : `~${formatEta(threeProgressUi.remainingMs)} remaining`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${threeProgressUi.progress}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateArtifact}
              disabled={approvedCount === 0 || pipelineStatus}
              className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-secondary/80 disabled:opacity-40"
            >
              {pipelineStatus === 'generating_artifact' ? 'Generating…' : 'Generate Technical Docs'}
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
                Download Technical Docs
              </button>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
