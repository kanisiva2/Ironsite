import { useState } from 'react'
import { HiPlus, HiOutlineHome } from 'react-icons/hi'
import Navbar from '../components/layout/Navbar'
import ProjectCard from '../components/projects/ProjectCard'
import NewProjectModal from '../components/projects/NewProjectModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import useProjects from '../hooks/useProjects'

export default function DashboardPage() {
  const { projects, loading, error, createProject, deleteProject } = useProjects()
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="min-h-screen bg-surface-alt">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-10">

        {/* Page header */}
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-px w-5 bg-primary/45" />
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Your Portfolio
              </p>
            </div>
            <h1 className="text-5xl font-light tracking-wide text-text">Projects</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white"
          >
            <HiPlus className="h-4 w-4" />
            New Project
          </button>
        </div>

        {/* Classical ornamental divider */}
        <div className="ornamental-divider mb-10 text-xs">◇</div>

        {loading ? (
          <LoadingSpinner size="lg" className="py-24" />
        ) : error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-8 text-center">
            <p className="text-danger">{error}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-8 py-24 text-center shadow-sm">
            <div
              className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary-light"
              style={{ boxShadow: '0 0 0 16px rgba(200,150,92,0.08)' }}
            >
              <HiOutlineHome className="h-11 w-11 text-primary" />
            </div>
            <h3 className="mb-3 text-2xl font-light text-text">No projects yet</h3>
            <p className="mx-auto mb-8 max-w-xs text-base leading-relaxed text-text-muted">
              Create your first project to start designing with AI
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-medium text-white"
            >
              <HiPlus className="h-4 w-4" />
              Create Your First Project
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
      </main>

      <NewProjectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={createProject}
      />
    </div>
  )
}
