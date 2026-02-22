import { useState } from 'react'
import { HiPlus } from 'react-icons/hi'
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

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Your Projects</h1>
            <p className="mt-1 text-text-muted">Design and manage your architectural projects</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <HiPlus className="h-4 w-4" />
            New Project
          </button>
        </div>

        {loading ? (
          <LoadingSpinner size="lg" className="py-20" />
        ) : error ? (
          <div className="rounded-xl border border-danger/20 bg-danger/5 p-8 text-center">
            <p className="text-danger">{error}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <HiPlus className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-text">No projects yet</h3>
            <p className="mb-6 text-text-muted">
              Create your first project to start designing with AI
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
