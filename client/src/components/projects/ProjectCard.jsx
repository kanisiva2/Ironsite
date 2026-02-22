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
      className="group cursor-pointer rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light">
          {project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={project.name}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <HiOutlineHome className="h-6 w-6 text-primary" />
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

      <h3 className="mb-1 text-base font-semibold text-text">{project.name}</h3>
      {project.description && (
        <p className="mb-3 line-clamp-2 text-sm text-text-muted">{project.description}</p>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
        {project.updatedAt && (
          <span className="text-xs text-text-muted">
            {new Date(project.updatedAt._seconds ? project.updatedAt._seconds * 1000 : project.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}
