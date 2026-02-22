import { useState } from 'react'
import { HiPlus, HiOutlineHome } from 'react-icons/hi'
import Navbar from '../components/layout/Navbar'
import ProjectCard from '../components/projects/ProjectCard'
import NewProjectModal from '../components/projects/NewProjectModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import useProjects from '../hooks/useProjects'

/* ── Converging vine accents — grow from both edges toward center ── */
function ConvergingVines({ top, delay = 0, variant = 0 }) {
  const gid = `cvines-${variant}-${String(top).replace(/\D/g, '')}`

  const variants = [
    {
      left: {
        stem: 'M0,30 C120,8 280,52 440,22 C580,2 720,38 870,26 C940,20 970,28 1000,26',
        tendrils: ['M440,22 C454,8 468,4 480,2', 'M720,38 C734,52 748,54 760,52'],
        leaves: [{ cx: 480, cy: 2 }, { cx: 760, cy: 52 }],
      },
      right: {
        stem: 'M2000,32 C1880,10 1720,54 1560,24 C1420,4 1280,40 1130,28 C1060,22 1030,30 1000,28',
        tendrils: ['M1560,24 C1546,10 1532,6 1520,4', 'M1280,40 C1266,54 1252,56 1240,54'],
        leaves: [{ cx: 1520, cy: 4 }, { cx: 1240, cy: 54 }],
      },
    },
    {
      left: {
        stem: 'M0,38 C140,58 300,12 460,40 C600,58 740,16 880,32 C940,38 970,28 1000,30',
        tendrils: ['M300,12 C286,2 272,0 260,2', 'M740,16 C726,4 712,2 700,4'],
        leaves: [{ cx: 260, cy: 2 }, { cx: 700, cy: 4 }],
      },
      right: {
        stem: 'M2000,36 C1860,56 1700,10 1540,38 C1400,56 1260,14 1120,30 C1060,36 1030,26 1000,28',
        tendrils: ['M1700,10 C1714,2 1728,0 1740,2', 'M1260,14 C1274,4 1288,2 1300,4'],
        leaves: [{ cx: 1740, cy: 2 }, { cx: 1300, cy: 4 }],
      },
    },
    {
      left: {
        stem: 'M0,34 C100,54 220,14 360,44 C480,62 580,8 700,28 C790,42 870,18 940,26 C970,30 990,24 1000,26',
        tendrils: ['M360,44 C374,58 388,62 400,60', 'M580,8 C566,0 552,0 540,2'],
        leaves: [{ cx: 400, cy: 60 }, { cx: 540, cy: 2 }],
      },
      right: {
        stem: 'M2000,30 C1900,50 1780,12 1640,42 C1520,60 1420,6 1300,26 C1210,40 1130,16 1060,24 C1030,28 1010,22 1000,24',
        tendrils: ['M1640,42 C1626,56 1612,60 1600,58', 'M1420,6 C1434,0 1448,0 1460,2'],
        leaves: [{ cx: 1600, cy: 58 }, { cx: 1460, cy: 2 }],
      },
    },
  ]

  const v = variants[variant % variants.length]

  return (
    <svg
      viewBox="0 0 2000 64"
      preserveAspectRatio="none"
      aria-hidden
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: '100%',
        height: 50,
        pointerEvents: 'none',
        opacity: 0.5,
        zIndex: 0,
      }}
    >
      <defs>
        <linearGradient id={`${gid}-l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d4a05c" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#c8965c" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#c8965c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${gid}-r`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#d4a05c" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#c8965c" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#c8965c" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={v.left.stem} fill="none" stroke={`url(#${gid}-l)`} strokeWidth="2.2" strokeLinecap="round"
        style={{ strokeDasharray: 1400, strokeDashoffset: 1400, animation: `convergingVineGrow 2.8s ease-out ${0.3 + delay}s both` }} />
      {v.left.tendrils.map((d, i) => (
        <path key={`lt${i}`} d={d} fill="none" stroke={`url(#${gid}-l)`} strokeWidth="1.4" strokeLinecap="round"
          style={{ strokeDasharray: 65, strokeDashoffset: 65, animation: `smallTendrilGrow 0.85s ease-out ${1.5 + delay + i * 0.3}s both` }} />
      ))}
      {v.left.leaves.map(({ cx, cy }, i) => (
        <polygon key={`ll${i}`}
          points={`${cx},${cy - 5} ${cx + 4},${cy} ${cx},${cy + 5} ${cx - 4},${cy}`}
          fill={`url(#${gid}-l)`}
          style={{ opacity: 0, animation: `leafReveal 0.55s ease-out ${1.85 + delay + i * 0.3}s both` }} />
      ))}

      <path d={v.right.stem} fill="none" stroke={`url(#${gid}-r)`} strokeWidth="2.2" strokeLinecap="round"
        style={{ strokeDasharray: 1400, strokeDashoffset: 1400, animation: `convergingVineGrow 2.8s ease-out ${0.5 + delay}s both` }} />
      {v.right.tendrils.map((d, i) => (
        <path key={`rt${i}`} d={d} fill="none" stroke={`url(#${gid}-r)`} strokeWidth="1.4" strokeLinecap="round"
          style={{ strokeDasharray: 65, strokeDashoffset: 65, animation: `smallTendrilGrow 0.85s ease-out ${1.7 + delay + i * 0.3}s both` }} />
      ))}
      {v.right.leaves.map(({ cx, cy }, i) => (
        <polygon key={`rl${i}`}
          points={`${cx},${cy - 5} ${cx + 4},${cy} ${cx},${cy + 5} ${cx - 4},${cy}`}
          fill={`url(#${gid}-r)`}
          style={{ opacity: 0, animation: `leafReveal 0.55s ease-out ${2.05 + delay + i * 0.3}s both` }} />
      ))}
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
                Your Homes
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

      {/* Converging vine accents — vines from both edges meet toward center */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <ConvergingVines top="18%" delay={0} variant={0} />
        <ConvergingVines top="53%" delay={0.4} variant={1} />
        <ConvergingVines top="85%" delay={0.8} variant={2} />
      </div>

      <NewProjectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={createProject}
      />
    </div>
  )
}
