import { useState } from 'react'
import { HiPlus, HiOutlineHome } from 'react-icons/hi'
import Navbar from '../components/layout/Navbar'
import ProjectCard from '../components/projects/ProjectCard'
import NewProjectModal from '../components/projects/NewProjectModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import useProjects from '../hooks/useProjects'

/* ── Corner vine SVG accent ─────────────────────────────── */
function CornerVine({ flip = false }) {
  const id = flip ? 'cvg-dash-r' : 'cvg-dash-l'
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

      {/* Main climbing stem */}
      <path
        d="M2,2 C28,34 54,60 84,94 C108,120 148,140 194,164"
        fill="none" stroke={`url(#${id})`} strokeWidth="2.1" strokeLinecap="round"
        style={{ strokeDasharray: 280, strokeDashoffset: 280, animation: 'smallVineGrow 2.2s ease-out 0.25s both' }}
      />
      {/* Tendril 1 */}
      <path
        d="M84,94 C66,78 44,74 26,62"
        fill="none" stroke={`url(#${id})`} strokeWidth="1.35" strokeLinecap="round"
        style={{ strokeDasharray: 65, strokeDashoffset: 65, animation: 'smallTendrilGrow 0.85s ease-out 1.1s both' }}
      />
      {/* Tendril 2 */}
      <path
        d="M148,140 C132,122 110,118 96,106"
        fill="none" stroke={`url(#${id})`} strokeWidth="1.35" strokeLinecap="round"
        style={{ strokeDasharray: 65, strokeDashoffset: 65, animation: 'smallTendrilGrow 0.85s ease-out 1.5s both' }}
      />
      {/* Diamond leaves */}
      <polygon points="26,58 30,62 26,66 22,62" fill={`url(#${id})`}
        style={{ opacity: 0, animation: 'leafReveal 0.55s ease-out 1.38s both' }} />
      <polygon points="96,102 100,106 96,110 92,106" fill={`url(#${id})`}
        style={{ opacity: 0, animation: 'leafReveal 0.55s ease-out 1.78s both' }} />
      {/* Small bud on stem */}
      <polygon points="46,60 49,64 46,68 43,64" fill={`url(#${id})`}
        style={{ opacity: 0, animation: 'leafReveal 0.55s ease-out 0.9s both' }} />
    </svg>
  )
}

export default function DashboardPage() {
  const { projects, loading, error, createProject, deleteProject } = useProjects()
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="page-vignette min-h-screen bg-surface-alt">
      <Navbar />

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        {/* Corner vine decorations */}
        <CornerVine flip={false} />
        <CornerVine flip={true} />

        {/* Page header */}
        <div className="relative z-10 mb-4 flex items-end justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-px w-5 bg-primary/45" />
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Your Collection
              </p>
            </div>
            <h1 className="text-5xl font-light tracking-wide text-text">Estates</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white"
          >
            <HiPlus className="h-4 w-4" />
            New Estate
          </button>
        </div>

        {/* Classical ornamental divider */}
        <div className="ornamental-divider relative z-10 mb-10 text-xs">◇</div>

        <div className="relative z-10">
          {loading ? (
            <LoadingSpinner size="lg" className="py-24" />
          ) : error ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 p-8 text-center">
              <p className="text-danger">{error}</p>
            </div>
          ) : projects.length === 0 ? (
            <div
              className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-surface px-8 py-24 text-center shadow-sm"
              style={{ background: 'linear-gradient(160deg, #fffcf8 0%, #faf6f0 60%, #f5ede0 100%)' }}
            >
              {/* Decorative corner tint */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(200,150,92,0.07) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(200,150,92,0.05) 0%, transparent 50%)' }}
              />
              <div
                className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary-light"
                style={{ boxShadow: '0 0 0 16px rgba(200,150,92,0.08), 0 0 0 32px rgba(200,150,92,0.04)' }}
              >
                <HiOutlineHome className="h-11 w-11 text-primary" />
              </div>
              <h3 className="relative mb-3 text-2xl font-light text-text">No estates yet</h3>
              <p className="relative mx-auto mb-8 max-w-xs text-base leading-relaxed text-text-muted">
                Create your first estate to begin your design journey
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="relative inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-medium text-white"
              >
                <HiPlus className="h-4 w-4" />
                Create Your First Estate
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={deleteProject}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <NewProjectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={createProject}
      />
    </div>
  )
}
