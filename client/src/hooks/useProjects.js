import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function useProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await api.get('/projects')
      setProjects(data.projects)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load projects')
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = async ({ name, description }) => {
    try {
      const { data } = await api.post('/projects', { name, description })
      setProjects((prev) => [data.project, ...prev])
      toast.success('Project created!')
      return data.project
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create project')
      throw err
    }
  }

  const deleteProject = async (projectId) => {
    try {
      await api.delete(`/projects/${projectId}`)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      toast.success('Project deleted')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete project')
      throw err
    }
  }

  return { projects, loading, error, createProject, deleteProject, refetch: fetchProjects }
}
