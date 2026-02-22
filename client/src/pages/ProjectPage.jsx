import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { HiPlus, HiChevronRight } from 'react-icons/hi'
import { HiOutlineCube } from 'react-icons/hi2'
import Navbar from '../components/layout/Navbar'
import ChatWindow from '../components/chat/ChatWindow'
import ChatInput from '../components/chat/ChatInput'
import RoomCard from '../components/rooms/RoomCard'
import NewRoomModal from '../components/rooms/NewRoomModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import useChat from '../hooks/useChat'
import useRooms from '../hooks/useRooms'
import usePollJob from '../hooks/usePollJob'
import api from '../services/api'
import toast from 'react-hot-toast'

/* ── Corner vine SVG accent ─────────────────────────────── */
function CornerVine({ flip = false }) {
  const id = flip ? 'cvg-proj-r' : 'cvg-proj-l'
  return (
    <svg
      width="210" height="190"
      viewBox="0 0 210 190"
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        ...(flip ? { right: 0, transform: 'scaleX(-1)', transformOrigin: 'right center' } : { left: 0 }),
        pointerEvents: 'none',
        overflow: 'visible',
        opacity: 0.65,
        zIndex: 0,
      }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#f0cc88" />
          <stop offset="52%"  stopColor="#c8965c" />
          <stop offset="100%" stopColor="#9a6530" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <path
        d="M2,2 C28,34 54,60 84,94 C108,120 148,140 194,164"
        fill="none" stroke={`url(#${id})`} strokeWidth="2.1" strokeLinecap="round"
        style={{ strokeDasharray: 280, strokeDashoffset: 280, animation: 'smallVineGrow 2.2s ease-out 0.25s both' }}
      />
      <path
        d="M84,94 C66,78 44,74 26,62"
        fill="none" stroke={`url(#${id})`} strokeWidth="1.35" strokeLinecap="round"
        style={{ strokeDasharray: 65, strokeDashoffset: 65, animation: 'smallTendrilGrow 0.85s ease-out 1.1s both' }}
      />
      <path
        d="M148,140 C132,122 110,118 96,106"
        fill="none" stroke={`url(#${id})`} strokeWidth="1.35" strokeLinecap="round"
        style={{ strokeDasharray: 65, strokeDashoffset: 65, animation: 'smallTendrilGrow 0.85s ease-out 1.5s both' }}
      />
      <polygon points="26,58 30,62 26,66 22,62" fill={`url(#${id})`}
        style={{ opacity: 0, animation: 'leafReveal 0.55s ease-out 1.38s both' }} />
      <polygon points="96,102 100,106 96,110 92,106" fill={`url(#${id})`}
        style={{ opacity: 0, animation: 'leafReveal 0.55s ease-out 1.78s both' }} />
      <polygon points="46,60 49,64 46,68 43,64" fill={`url(#${id})`}
        style={{ opacity: 0, animation: 'leafReveal 0.55s ease-out 0.9s both' }} />
    </svg>
  )
}

/* ── Short curvy vine accent — grows from screen edge ── */
function HorizontalVine({ fromRight = false, top, delay = 0 }) {
  const gid = `hvg-rm-${fromRight ? 'r' : 'l'}-${Math.round(top)}`
  const stemD = fromRight
    ? 'M300,40 C260,18 220,52 180,28 C140,6 100,46 60,30 C32,20 10,34 0,30'
    : 'M0,40 C40,18 80,52 120,28 C160,6 200,46 240,30 C268,20 290,34 300,30'

  const tendril = fromRight
    ? 'M180,28 C170,14 158,10 148,8'
    : 'M120,28 C130,14 142,10 152,8'

  const leaf = fromRight
    ? { cx: 148, cy: 8 }
    : { cx: 152, cy: 8 }

  return (
    <svg
      viewBox="0 0 300 60" aria-hidden
      preserveAspectRatio={fromRight ? 'xMaxYMid meet' : 'xMinYMid meet'}
      style={{
        position: 'absolute',
        top,
        ...(fromRight ? { right: 0 } : { left: 0 }),
        width: '35vw',
        height: 50,
        pointerEvents: 'none',
        opacity: 0.5,
        zIndex: 0,
      }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#f0cc88" />
          <stop offset="52%" stopColor="#c8965c" />
          <stop offset="100%" stopColor="#9a6530" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path d={stemD} fill="none" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round"
        style={{ strokeDasharray: 420, strokeDashoffset: 420, animation: `smallVineGrow 2s ease-out ${0.3 + delay}s both` }} />
      <path d={tendril} fill="none" stroke={`url(#${gid})`} strokeWidth="1.3" strokeLinecap="round"
        style={{ strokeDasharray: 65, strokeDashoffset: 65, animation: `smallTendrilGrow 0.85s ease-out ${1.2 + delay}s both` }} />
      <polygon points={`${leaf.cx},${leaf.cy - 6} ${leaf.cx + 5},${leaf.cy} ${leaf.cx},${leaf.cy + 6} ${leaf.cx - 5},${leaf.cy}`} fill={`url(#${gid})`}
        style={{ opacity: 0, animation: `leafReveal 0.55s ease-out ${1.5 + delay}s both` }} />
    </svg>
  )
}

function formatStatusLabel(status) {
  if (!status) return 'Unknown'
  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusBadgeClasses(status) {
  if (status === 'pass') return 'border border-success/30 bg-success/10 text-success'
  if (status === 'ready') return 'border border-success/30 bg-success/10 text-success'
  if (status === 'fail') return 'border border-danger/30 bg-danger/10 text-danger'
  if (status === 'needs_info') return 'border border-warning/30 bg-warning/10 text-warning'
  return 'border border-border bg-surface-alt text-text-muted'
}

function deriveZoningMissingItems({ zoningReport, zoningPreflight }) {
  const explicit = [
    ...(zoningPreflight?.missingQuestions || []),
    ...(zoningReport?.inputAcquisition?.missingQuestions || []),
  ]
  const deduped = [...new Set(explicit.map((q) => String(q).trim()).filter(Boolean))]
  if (deduped.length > 0) return deduped

  const checks = zoningReport?.reportJson?.checks || zoningPreflight?.checks || []
  const derived = []
  for (const check of checks) {
    if (check?.status !== 'needs_info') continue
    const name = check?.name || 'This check'
    const requiredMissing = check?.required == null
    const proposedMissing = check?.proposed == null
    if (requiredMissing && proposedMissing) derived.push(`${name}: add both values.`)
    else if (requiredMissing) derived.push(`${name}: add the required zoning limit.`)
    else if (proposedMissing) derived.push(`${name}: add your proposed value.`)
  }
  return [...new Set(derived)]
}

const WHOLE_HOME_REPORT_TYPES = {
  zoning: {
    label: 'Zoning',
    chatRoomId: '__project_chat__:whole_home_zoning_report',
    chatTitle: 'Whole-Home Zoning Chat',
    chatDescription: 'Dedicated whole-home zoning chat. Separate from room design chats.',
  },
  technical_info: {
    label: 'Technical Info',
    chatRoomId: '__project_chat__:whole_home_technical_info_report',
    chatTitle: 'Whole-Home Technical Info Chat',
    chatDescription: 'Collect whole-home technical requirements here without mixing room chat history.',
  },
}

export default function ProjectPage() {
  const { projectId } = useParams()
  const { rooms, loading, error, createRoom, deleteRoom } = useRooms(projectId)
  const [showModal, setShowModal] = useState(false)
  const [project, setProject] = useState(null)
  const [projectName, setProjectName] = useState('')
  const [zoningPreflight, setZoningPreflight] = useState(null)
  const [preflightLoading, setPreflightLoading] = useState(false)
  const [technicalInfoPreflight, setTechnicalInfoPreflight] = useState(null)
  const [technicalInfoPreflightLoading, setTechnicalInfoPreflightLoading] = useState(false)
  const [zoningJobId, setZoningJobId] = useState(null)
  const [zoningBusy, setZoningBusy] = useState(false)
  const [technicalInfoJobId, setTechnicalInfoJobId] = useState(null)
  const [technicalInfoBusy, setTechnicalInfoBusy] = useState(false)
  const [showWholeHomeReport, setShowWholeHomeReport] = useState(false)
  const [wholeHomeReportType, setWholeHomeReportType] = useState('zoning')

  const { job: zoningJob } = usePollJob(zoningJobId)
  const { job: technicalInfoJob } = usePollJob(technicalInfoJobId)
  const reportChatRoomId = WHOLE_HOME_REPORT_TYPES[wholeHomeReportType]?.chatRoomId
  const {
    messages: reportChatMessages,
    streaming: reportChatStreaming,
    loading: reportChatLoading,
    sendMessage: sendReportChatMessage,
    fetchMessages: fetchReportChatMessages,
  } = useChat(reportChatRoomId, projectId, { enableImageToolActions: false })

  const fetchProject = useCallback(async () => {
    if (!projectId) return
    const { data } = await api.get(`/projects/${projectId}`)
    const nextProject = data.project || data
    setProject(nextProject)
    setProjectName(nextProject?.name || '')
    return nextProject
  }, [projectId])

  const downloadZoningPdf = useCallback(async (zoning) => {
    if (!zoning) return false
    const pdfUrl = zoning.reportPdfUrl
    if (pdfUrl && !pdfUrl.startsWith('zoning://')) {
      try {
        const response = await fetch(pdfUrl)
        if (!response.ok) throw new Error('Failed to fetch PDF')
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = 'zoning_report.pdf'
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(objectUrl)
        return true
      } catch {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer')
        return true
      }
    }
    if (!zoning.reportPdfBase64) {
      return false
    }
    const binary = atob(zoning.reportPdfBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = 'zoning_report.pdf'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    return true
  }, [])

  const downloadTechnicalInfoPdf = useCallback(async (technicalInfo) => {
    if (!technicalInfo) return false
    const pdfUrl = technicalInfo.reportPdfUrl
    if (pdfUrl && !pdfUrl.startsWith('technical-info://')) {
      try {
        const response = await fetch(pdfUrl)
        if (!response.ok) throw new Error('Failed to fetch PDF')
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = 'technical_info_report.pdf'
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(objectUrl)
        return true
      } catch {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer')
        return true
      }
    }
    if (!technicalInfo.reportPdfBase64) return false
    const binary = atob(technicalInfo.reportPdfBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = 'technical_info_report.pdf'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    return true
  }, [])

  useEffect(() => {
    if (!projectId) return
    fetchProject().catch(() => {})
  }, [fetchProject, projectId])

  useEffect(() => {
    if (!showWholeHomeReport || !reportChatRoomId) return
    fetchReportChatMessages().catch(() => {})
  }, [showWholeHomeReport, reportChatRoomId, fetchReportChatMessages])

  useEffect(() => {
    if (zoningJob?.status === 'completed' && zoningJob?.type === 'zoning_report') {
      ;(async () => {
        setZoningBusy(false)
        setZoningJobId(null)
        const nextProject = await fetchProject().catch(() => null)
        const didDownload = await downloadZoningPdf(nextProject?.regulatory?.zoning)
        toast.success(didDownload ? 'Zoning report created. PDF download started.' : 'Zoning report created')
      })()
    } else if (zoningJob?.status === 'failed') {
      setZoningBusy(false)
      setZoningJobId(null)
      toast.error(zoningJob.output?.error || 'Failed to create zoning report')
    }
  }, [zoningJob, fetchProject, downloadZoningPdf])

  useEffect(() => {
    if (technicalInfoJob?.status === 'completed' && technicalInfoJob?.type === 'technical_info_report') {
      ;(async () => {
        setTechnicalInfoBusy(false)
        setTechnicalInfoJobId(null)
        const nextProject = await fetchProject().catch(() => null)
        const didDownload = await downloadTechnicalInfoPdf(nextProject?.regulatory?.technicalInfo)
        toast.success(didDownload ? 'Technical info report created. PDF download started.' : 'Technical info report created')
      })()
    } else if (technicalInfoJob?.status === 'failed') {
      setTechnicalInfoBusy(false)
      setTechnicalInfoJobId(null)
      toast.error(technicalInfoJob.output?.error || 'Failed to create technical info report')
    }
  }, [technicalInfoJob, fetchProject, downloadTechnicalInfoPdf])

  const zoningReport = project?.regulatory?.zoning
  const technicalInfoReport = project?.regulatory?.technicalInfo
  const zoningMissingItems = deriveZoningMissingItems({ zoningReport, zoningPreflight })
  const technicalInfoMissingItems = [
    ...new Set([
      ...(technicalInfoPreflight?.missingQuestions || []),
      ...(technicalInfoReport?.inputAcquisition?.missingQuestions || []),
    ].map((q) => String(q).trim()).filter(Boolean)),
  ]
  const selectedWholeHomeReport = WHOLE_HOME_REPORT_TYPES[wholeHomeReportType] || WHOLE_HOME_REPORT_TYPES.zoning
  const zoningDisplayStatus =
    zoningPreflight?.predictedComplianceStatus ||
    zoningReport?.status ||
    zoningReport?.reportJson?.complianceStatus ||
    null
  const technicalInfoDisplayStatus =
    technicalInfoPreflight?.predictedStatus ||
    technicalInfoReport?.status ||
    technicalInfoReport?.reportJson?.status ||
    null

  const handleCheckZoningMissing = async () => {
    if (!projectId) return
    try {
      setPreflightLoading(true)
      const { data } = await api.post('/generate/project-zoning/preflight', { projectId })
      setZoningPreflight(data.preflight || null)
      setShowWholeHomeReport(true)
      toast.success('Checked what is missing for your zoning report')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to check zoning report requirements')
    } finally {
      setPreflightLoading(false)
    }
  }

  const handleGenerateProjectZoning = async () => {
    if (!projectId) return
    try {
      setZoningBusy(true)
      setShowWholeHomeReport(true)
      const { data } = await api.post('/generate/project-zoning', { projectId })
      setZoningJobId(data.jobId)
    } catch (err) {
      setZoningBusy(false)
      toast.error(err.response?.data?.detail || 'Failed to start zoning report generation')
    }
  }

  const handleGenerateProjectTechnicalInfo = async () => {
    if (!projectId) return
    try {
      setTechnicalInfoBusy(true)
      setShowWholeHomeReport(true)
      const { data } = await api.post('/generate/project-technical-info', { projectId })
      setTechnicalInfoJobId(data.jobId)
    } catch (err) {
      setTechnicalInfoBusy(false)
      toast.error(err.response?.data?.detail || 'Failed to start technical info report generation')
    }
  }

  const handleCheckTechnicalInfoMissing = async () => {
    if (!projectId) return
    try {
      setTechnicalInfoPreflightLoading(true)
      setShowWholeHomeReport(true)
      const { data } = await api.post('/generate/project-technical-info/preflight', { projectId })
      setTechnicalInfoPreflight(data.preflight || null)
      toast.success('Checked what is missing for your technical info report')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to check technical info requirements')
    } finally {
      setTechnicalInfoPreflightLoading(false)
    }
  }

  return (
    <div className="page-vignette relative min-h-screen bg-surface-alt">
      <Navbar />

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        {/* Corner vine decorations */}
        <CornerVine flip={false} />
        <CornerVine flip={true} />

        {/* Breadcrumb */}
        <nav className="relative z-10 mb-8 flex items-center gap-2 text-sm text-text-muted">
          <Link to="/dashboard" className="transition-colors hover:text-primary">
            Homes
          </Link>
          <HiChevronRight className="h-4 w-4" />
          <span className="font-medium text-text">{projectName || 'Rooms'}</span>
        </nav>

        <div className="relative z-10 mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
              {projectName || 'Rooms'}
            </p>
            <h1 className="text-4xl text-text">Rooms</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <HiPlus className="h-4 w-4" />
            New Room
          </button>
        </div>

        <section className="relative z-10 mb-8 rounded-2xl border border-border bg-surface shadow-sm">
          <button
            type="button"
            onClick={() => setShowWholeHomeReport((prev) => !prev)}
            className="flex w-full items-start justify-between gap-4 rounded-2xl px-5 py-5 text-left hover:bg-surface-alt/50"
          >
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
                Whole-Home Reports
              </p>
              <h2 className="text-xl text-text">
                {WHOLE_HOME_REPORT_TYPES[wholeHomeReportType]?.label || 'Whole-Home'} Report
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Use a dedicated whole-home chat for report-specific details, separate from room design conversations.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              {wholeHomeReportType === 'zoning' && zoningDisplayStatus && (
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClasses(zoningDisplayStatus)}`}>
                  {formatStatusLabel(zoningDisplayStatus)}
                </span>
              )}
              {wholeHomeReportType === 'technical_info' && technicalInfoDisplayStatus && (
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClasses(technicalInfoDisplayStatus)}`}>
                  {formatStatusLabel(technicalInfoDisplayStatus)}
                </span>
              )}
              <HiChevronRight className={`h-5 w-5 text-text-muted transition-transform ${showWholeHomeReport ? 'rotate-90' : ''}`} />
            </div>
          </button>

          {showWholeHomeReport && (
            <div className="border-t border-border px-5 py-5">
              <div className="mb-4 space-y-3">
                <div className="rounded-xl border border-border bg-surface-alt p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    How This Works
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-text-muted">
                    {wholeHomeReportType === 'zoning' ? (
                      <>
                        <div>1. Use the dedicated whole-home zoning chat below (or any room chat) to share parcel/zoning constraints.</div>
                        <div>2. Archvision reviews room chats plus the whole-home zoning chat to identify missing zoning inputs.</div>
                        <div>3. Create one whole-home zoning report. The PDF downloads automatically when ready.</div>
                      </>
                    ) : (
                      <>
                        <div>1. Use the dedicated whole-home technical info chat below for cross-room requirements.</div>
                        <div>2. Keep shared details here (systems, constraints, preferences) instead of duplicating them in room chats.</div>
                        <div>3. Room design chats stay focused on room-specific rendering and layout work.</div>
                      </>
                    )}
                  </div>
                  {wholeHomeReportType === 'zoning' ? (
                    <div className="mt-3 text-xs text-text-muted">
                      Expert tip: if you already know parcel/zoning limits, discuss them in the whole-home zoning chat so Archvision can use them in report prep.
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-text-muted">
                      Use this for whole-home technical details like HVAC/electrical scope, structural constraints, accessibility, and utility notes.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <label className="text-xs text-text-muted lg:min-w-[240px]">
                      Whole-Home Report Type
                      <select
                        value={wholeHomeReportType}
                        onChange={(e) => setWholeHomeReportType(e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text"
                      >
                        {Object.entries(WHOLE_HOME_REPORT_TYPES).map(([value, config]) => (
                          <option key={value} value={value}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {wholeHomeReportType === 'zoning' ? (
                        <>
                          <button
                            onClick={handleCheckZoningMissing}
                            disabled={preflightLoading || zoningBusy || technicalInfoBusy || rooms.length === 0}
                            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text hover:bg-surface-alt disabled:opacity-40"
                          >
                            {preflightLoading ? "Checking..." : "Check What's Missing"}
                          </button>
                          <button
                            onClick={handleGenerateProjectZoning}
                            disabled={zoningBusy || technicalInfoBusy || rooms.length === 0}
                            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
                          >
                            {zoningBusy ? 'Creating...' : 'Create Zoning PDF'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleCheckTechnicalInfoMissing}
                            disabled={technicalInfoPreflightLoading || technicalInfoBusy || zoningBusy}
                            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text hover:bg-surface-alt disabled:opacity-40"
                          >
                            {technicalInfoPreflightLoading ? 'Checking...' : 'Check Technical Info Missing'}
                          </button>
                          <button
                            onClick={handleGenerateProjectTechnicalInfo}
                            disabled={technicalInfoBusy || zoningBusy}
                            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
                          >
                            {technicalInfoBusy ? 'Creating...' : 'Create Technical Info PDF'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-text-muted">
                    {wholeHomeReportType === 'zoning'
                      ? 'Zoning actions are tied to the Whole-Home Zoning dropdown selection.'
                      : 'Technical Info actions are tied to the Whole-Home Technical Info dropdown selection.'}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr]">
                <div className="space-y-4">
                  {wholeHomeReportType === 'zoning' ? (
                    <>
                      <div className="rounded-xl border border-border bg-surface-alt p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                            What's Missing
                          </div>
                          {zoningDisplayStatus && (
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClasses(zoningDisplayStatus)}`}>
                              {formatStatusLabel(zoningDisplayStatus)}
                            </span>
                          )}
                        </div>
                        {rooms.length === 0 ? (
                          <p className="text-sm text-text-muted">Add at least one room to generate a zoning report.</p>
                        ) : preflightLoading ? (
                          <p className="text-sm text-text-muted">Checking your home conversations...</p>
                        ) : zoningMissingItems.length > 0 ? (
                          <div className="space-y-1 text-sm text-text-muted">
                            {zoningMissingItems.map((item, index) => (
                              <div key={`${item}-${index}`}>• {item}</div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-text-muted">
                            {zoningPreflight || zoningReport
                              ? 'No missing items found in the latest check.'
                              : "Click \"Check What's Missing\" to see what Archvision still needs."}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-border bg-surface-alt p-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Report Status
                        </div>
                        {!zoningReport && !zoningPreflight ? (
                          <p className="text-sm text-text-muted">No zoning report or preflight check yet.</p>
                        ) : (
                          <>
                            {zoningDisplayStatus && (
                              <div className="mb-2">
                                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClasses(zoningDisplayStatus)}`}>
                                  {formatStatusLabel(zoningDisplayStatus)}
                                </span>
                              </div>
                            )}
                            {zoningPreflight ? (
                              <>
                                <p className="text-sm text-text-muted">
                                  {zoningMissingItems.length > 0
                                    ? `Preflight check complete. ${zoningMissingItems.length} detail${zoningMissingItems.length === 1 ? '' : 's'} still needed before a complete zoning PDF.`
                                    : 'Preflight check complete. No missing items were found in the latest zoning check.'}
                                </p>
                                <p className="mt-2 text-xs text-text-muted">
                                  This status is from the latest preflight check and updates before PDF generation.
                                </p>
                                {zoningReport && (
                                  <p className="mt-2 text-xs text-text-muted">
                                    A saved PDF report also exists and updates after you create a new zoning PDF.
                                  </p>
                                )}
                              </>
                            ) : zoningReport ? (
                              <p className="text-sm text-text-muted">
                                {(zoningReport.inputAcquisition?.missingQuestions || []).length > 0
                                  ? `Archvision still needs ${(zoningReport.inputAcquisition.missingQuestions || []).length} detail${(zoningReport.inputAcquisition.missingQuestions || []).length === 1 ? '' : 's'} for a complete check.`
                                  : 'Your latest report is ready. A PDF will download automatically after each new report is created.'}
                              </p>
                            ) : (
                              <p className="text-sm text-text-muted">
                                {zoningMissingItems.length > 0
                                  ? `Preflight check complete. ${zoningMissingItems.length} detail${zoningMissingItems.length === 1 ? '' : 's'} still needed before a complete zoning PDF.`
                                  : 'Preflight check complete. No missing items were found in the latest zoning check.'}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl border border-border bg-surface-alt p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                            What's Missing
                          </div>
                          {technicalInfoDisplayStatus && (
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClasses(technicalInfoDisplayStatus)}`}>
                              {formatStatusLabel(technicalInfoDisplayStatus)}
                            </span>
                          )}
                        </div>
                        {technicalInfoPreflightLoading ? (
                          <p className="text-sm text-text-muted">Checking your whole-home technical chat...</p>
                        ) : technicalInfoMissingItems.length > 0 ? (
                          <div className="space-y-1 text-sm text-text-muted">
                            {technicalInfoMissingItems.map((item, idx) => (
                              <div key={`${item}-${idx}`}>• {item}</div>
                            ))}
                          </div>
                        ) : technicalInfoPreflight ? (
                          <p className="text-sm text-text-muted">
                            No missing items found in the latest technical info preflight check.
                          </p>
                        ) : (
                          <>
                            <p className="text-sm text-text-muted">
                              Use the dedicated chat to capture shared technical details that apply across rooms.
                            </p>
                            <div className="mt-3 space-y-1 text-sm text-text-muted">
                              <div>• Structural constraints or load-bearing walls</div>
                              <div>• HVAC, plumbing, and electrical upgrade plans</div>
                              <div>• Accessibility, code, or permitting considerations</div>
                              <div>• Whole-home materials, systems, and install preferences</div>
                            </div>
                          </>
                        )}
                        {technicalInfoPreflight?.summary && (
                          <p className="mt-3 text-xs text-text-muted">{technicalInfoPreflight.summary}</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-border bg-surface-alt p-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Status
                        </div>
                        {!technicalInfoReport && !technicalInfoPreflight ? (
                          <>
                            <p className="text-sm text-text-muted">
                              No technical info PDF yet. Use the button above after adding details in the technical chat.
                            </p>
                            <p className="mt-2 text-xs text-text-muted">
                              Technical info is stored in a separate whole-home chat so it doesn’t get mixed with room design iterations.
                            </p>
                          </>
                        ) : (
                          <>
                            {technicalInfoDisplayStatus && (
                              <div className="mb-2">
                                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClasses(technicalInfoDisplayStatus)}`}>
                                  {formatStatusLabel(technicalInfoDisplayStatus)}
                                </span>
                              </div>
                            )}
                            {technicalInfoPreflight ? (
                              <>
                                <p className="text-sm text-text-muted">
                                  {technicalInfoMissingItems.length > 0
                                    ? `Technical preflight complete. ${technicalInfoMissingItems.length} detail${technicalInfoMissingItems.length === 1 ? '' : 's'} still needed before a complete technical info PDF.`
                                    : 'Technical preflight complete. The technical info looks ready for PDF generation.'}
                                </p>
                                <p className="mt-2 text-xs text-text-muted">
                                  This status is from the latest technical preflight check and updates before PDF generation.
                                </p>
                                {technicalInfoPreflight?.chatStats && (
                                  <p className="mt-2 text-xs text-text-muted">
                                    Reviewed {technicalInfoPreflight.chatStats.messageCount || 0} messages
                                    {typeof technicalInfoPreflight.capturedProgramFields === 'number'
                                      ? ` • ${technicalInfoPreflight.capturedProgramFields} program fields captured`
                                      : ''}
                                  </p>
                                )}
                                {technicalInfoReport && (
                                  <p className="mt-2 text-xs text-text-muted">
                                    A saved technical info PDF also exists and updates after you create a new PDF.
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-text-muted">
                                  {technicalInfoReport.summary || 'Technical info PDF generated from the whole-home technical chat.'}
                                </p>
                                {Array.isArray(technicalInfoReport?.inputAcquisition?.missingQuestions) && technicalInfoReport.inputAcquisition.missingQuestions.length > 0 && (
                                  <div className="mt-2 space-y-1 text-xs text-text-muted">
                                    {technicalInfoReport.inputAcquisition.missingQuestions.slice(0, 4).map((q, idx) => (
                                      <div key={`${q}-${idx}`}>• {q}</div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                            <div className="mt-3 text-xs text-text-muted">
                              Use the top <span className="font-medium text-text">Create Technical Info PDF</span> button to generate or regenerate the PDF. It will auto-download when ready.
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text">{selectedWholeHomeReport.chatTitle}</h3>
                      <p className="text-xs text-text-muted">
                        {selectedWholeHomeReport.chatDescription}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-alt">
                    <div className="h-[360px] min-h-0 bg-surface">
                      <ChatWindow
                        key={reportChatRoomId || 'project-report-chat'}
                        messages={reportChatMessages}
                        loading={reportChatLoading}
                        streaming={reportChatStreaming}
                      />
                    </div>
                    <ChatInput
                      onSend={sendReportChatMessage}
                      disabled={!reportChatRoomId || reportChatStreaming}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="relative z-10">
          {loading ? (
            <LoadingSpinner size="lg" className="py-24" />
          ) : error ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 p-8 text-center">
              <p className="text-danger">{error}</p>
            </div>
          ) : rooms.length === 0 ? (
            <div
              className="relative overflow-hidden rounded-2xl border border-dashed border-border px-8 py-24 text-center shadow-sm"
              style={{ background: 'linear-gradient(160deg, #fffcf8 0%, #faf6f0 60%, #f5ede0 100%)' }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(200,150,92,0.07) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(200,150,92,0.05) 0%, transparent 50%)' }}
              />
              <div
                className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary-light"
                style={{ boxShadow: '0 0 0 16px rgba(200,150,92,0.08), 0 0 0 32px rgba(200,150,92,0.04)' }}
              >
                <HiOutlineCube className="h-11 w-11 text-primary" />
              </div>
              <h3 className="relative mb-3 text-2xl font-light text-text">No rooms yet</h3>
              <p className="relative mx-auto mb-8 max-w-xs text-base leading-relaxed text-text-muted">
                Add your first room to start designing with AI
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="relative inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary-hover"
              >
                <HiPlus className="h-4 w-4" />
                Add a Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  projectId={projectId}
                  onDelete={deleteRoom}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Horizontal vine accents — anchored to screen edges */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <HorizontalVine fromRight={false} top="38%" delay={0} />
        <HorizontalVine fromRight={true} top="52%" delay={0.4} />
        <HorizontalVine fromRight={false} top="66%" delay={0.8} />
      </div>

      <NewRoomModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={createRoom}
      />
    </div>
  )
}
