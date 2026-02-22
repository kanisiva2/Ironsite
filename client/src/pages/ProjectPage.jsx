import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { HiPlus, HiChevronRight } from 'react-icons/hi'
import { HiOutlineCube } from 'react-icons/hi2'
import Navbar from '../components/layout/Navbar'
import RoomCard from '../components/rooms/RoomCard'
import NewRoomModal from '../components/rooms/NewRoomModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import useRooms from '../hooks/useRooms'
import api from '../services/api'

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

/* ── Converging vine accents — grow from both edges toward center ── */
function ConvergingVines({ top, delay = 0, variant = 0 }) {
  const gid = `cvines-rm-${variant}-${String(top).replace(/\D/g, '')}`

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

export default function ProjectPage() {
  const { projectId } = useParams()
  const { rooms, loading, error, createRoom, deleteRoom } = useRooms(projectId)
  const [showModal, setShowModal] = useState(false)
  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    if (!projectId) return
    api.get(`/projects/${projectId}`).then(({ data }) => {
      setProjectName(data.project?.name || data.name || '')
    }).catch(() => {})
  }, [projectId])

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

      {/* Converging vine accents — vines from both edges meet toward center */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <ConvergingVines top="22%" delay={0} variant={0} />
        <ConvergingVines top="61%" delay={0.4} variant={1} />
        <ConvergingVines top="89%" delay={0.8} variant={2} />
      </div>

      <NewRoomModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={createRoom}
      />
    </div>
  )
}
