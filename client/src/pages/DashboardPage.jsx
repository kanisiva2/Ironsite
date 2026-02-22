import { useState } from 'react'
import { HiPlus, HiOutlineHome } from 'react-icons/hi'
import Navbar from '../components/layout/Navbar'
import ProjectCard from '../components/projects/ProjectCard'
import NewProjectModal from '../components/projects/NewProjectModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import useProjects from '../hooks/useProjects'

/* ── Short curvy vine accent — grows from screen edge ── */
function HorizontalVine({ fromRight = false, top, delay = 0 }) {
  const gid = `hvg-${fromRight ? 'r' : 'l'}-${Math.round(top)}`
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

export default function DashboardPage() {
  const { projects, loading, error, createProject, deleteProject } = useProjects()
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="page-vignette relative min-h-screen bg-surface-alt">
      <Navbar />

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        {/* Page header */}
        <div className="relative z-10 mb-4 flex items-end justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-px w-5 bg-primary/45" />
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Your Projects
              </p>
            </div>
            <h1 className="text-5xl font-light tracking-wide text-text">Homes</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white"
          >
            <HiPlus className="h-4 w-4" />
            New Home
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
              <h3 className="relative mb-3 text-2xl font-light text-text">No homes yet</h3>
              <p className="relative mx-auto mb-8 max-w-xs text-base leading-relaxed text-text-muted">
                Create your first home to start designing
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="relative inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-medium text-white"
              >
                <HiPlus className="h-4 w-4" />
                Create Your First Home
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

      {/* Horizontal vine accents — fill blank space below cards, anchored to screen edges */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <HorizontalVine fromRight={false} top="38%" delay={0} />
        <HorizontalVine fromRight={true} top="52%" delay={0.4} />
        <HorizontalVine fromRight={false} top="66%" delay={0.8} />
      </div>

      <NewProjectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={createProject}
      />
    </div>
  )
}
