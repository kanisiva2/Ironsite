import { useNavigate } from 'react-router-dom'
import { HiOutlineTrash, HiOutlineHome } from 'react-icons/hi'
import { PROJECT_STATUS } from '../../utils/constants'

export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate()
  const status = PROJECT_STATUS[project.status] || PROJECT_STATUS.active

  const handleClick = () => {
    navigate(`/projects/${project.id}`)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      onDelete(project.id)
    }
  }

  return (
    <div
      onClick={handleClick}
      className="card-lift group cursor-pointer rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-primary/40 hover:shadow-lg"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light transition-colors duration-200 group-hover:bg-primary/10">
          {project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={project.name}
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            <HiOutlineHome className="h-7 w-7 text-primary" />
          )}
        </div>
        <button
          onClick={handleDelete}
          className="rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
          title="Delete project"
        >
          <HiOutlineTrash className="h-4 w-4" />
        </button>
      </div>

      <h3 className="mb-1 text-lg font-medium text-text">{project.name}</h3>
      {project.description && (
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-muted">
          {project.description}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <span className={`text-xs font-medium tracking-wide uppercase ${status.color}`}>
          {status.label}
        </span>
        {project.updatedAt && (
          <span className="text-xs text-text-muted">
            {new Date(
              project.updatedAt._seconds
                ? project.updatedAt._seconds * 1000
                : project.updatedAt
            ).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}
