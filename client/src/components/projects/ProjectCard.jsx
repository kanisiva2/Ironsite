import { useNavigate } from 'react-router-dom'
import { HiOutlineTrash, HiOutlineHome } from 'react-icons/hi'
import { PROJECT_STATUS } from '../../utils/constants'

export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate()
  const status = PROJECT_STATUS[project.status] || PROJECT_STATUS.active
  const previewUrls = project.previewImageUrls || []
  const isSplit = previewUrls.length >= 2

  const handleClick = () => {
    navigate(`/projects/${project.id}`)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      onDelete(project.id)
    }
  }

  const statusDot = (
    <span className={`flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase ${status.color}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {status.label}
    </span>
  )

  const updatedAt = project.updatedAt && (
    <span className="text-xs text-text-muted">
      {new Date(
        project.updatedAt._seconds
          ? project.updatedAt._seconds * 1000
          : project.updatedAt
      ).toLocaleDateString()}
    </span>
  )

  // ── Plain card (no preview images yet) ────────────────────
  if (previewUrls.length === 0) {
    return (
      <div
        onClick={handleClick}
        className="card-lift group cursor-pointer rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-primary/40 hover:shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light transition-colors duration-200 group-hover:bg-primary/10">
            {project.thumbnailUrl ? (
              <img src={project.thumbnailUrl} alt={project.name} className="h-full w-full rounded-xl object-cover" />
            ) : (
              <HiOutlineHome className="h-7 w-7 text-primary" />
            )}
          </div>
          <button
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
            title="Remove home"
          >
            <HiOutlineTrash className="h-4 w-4" />
          </button>
        </div>

        <h3 className="mb-1 font-display text-xl text-text">{project.name}</h3>
        {project.description && (
          <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-muted">
            {project.description}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          {statusDot}
          {updatedAt}
        </div>
      </div>
    )
  }

  // ── Preview card (slides to reveal room images on hover) ──
  return (
    <div
      onClick={handleClick}
      className="project-card-preview card-lift group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface shadow-sm hover:border-primary/40 hover:shadow-lg"
    >
      {/* ── Layer 0: preview image(s) ── */}
      {isSplit ? (
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
          <img
            src={previewUrls[0]}
            alt=""
            className="absolute inset-x-0 top-0 h-1/2 w-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-x-0 top-1/2 h-px bg-black/15" />
          <img
            src={previewUrls[1]}
            alt=""
            className="absolute inset-x-0 bottom-0 h-1/2 w-full object-cover"
            draggable={false}
          />
        </div>
      ) : (
        <img
          src={previewUrls[0]}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ zIndex: 0 }}
          draggable={false}
        />
      )}

      {/* ── Layer 1: white face mask ── */}
      <div
        aria-hidden
        className="preview-card-face pointer-events-none absolute inset-0 bg-surface"
        style={{ zIndex: 1 }}
      />

      {/* ── Layer 2: card content ── */}
      <div className="preview-content relative p-6" style={{ zIndex: 2 }}>
        <div className="mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light transition-colors duration-200 group-hover:bg-primary/10">
            {project.thumbnailUrl ? (
              <img src={project.thumbnailUrl} alt={project.name} className="h-full w-full rounded-xl object-cover" />
            ) : (
              <HiOutlineHome className="h-7 w-7 text-primary" />
            )}
          </div>
        </div>

        <h3 className="mb-1 font-display text-xl text-text">{project.name}</h3>
        {project.description && (
          <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-muted">
            {project.description}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          {statusDot}
          {updatedAt}
        </div>
      </div>

      {/* ── Delete button ── */}
      <button
        onClick={handleDelete}
        className="absolute right-6 top-6 rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        style={{ zIndex: 20 }}
        title="Remove home"
      >
        <HiOutlineTrash className="h-4 w-4" />
      </button>
    </div>
  )
}