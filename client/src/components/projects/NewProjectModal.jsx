import { useState } from 'react'
import { HiX } from 'react-icons/hi'

export default function NewProjectModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({ name, description })
      setName('')
      setDescription('')
      onClose()
    } catch {
      // error handled by hook
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text">New Project</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
          >
            <HiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="projectName" className="mb-1 block text-sm font-medium text-text">
              Project Name
            </label>
            <input
              id="projectName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface-alt px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Cambridge House"
            />
          </div>

          <div>
            <label htmlFor="projectDesc" className="mb-1 block text-sm font-medium text-text">
              Description (optional)
            </label>
            <textarea
              id="projectDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-surface-alt px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
              placeholder="Brief description of the project..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
