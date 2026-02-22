import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function useRooms(projectId) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRooms = useCallback(async () => {
    if (!projectId) return
    try {
      setLoading(true)
      setError(null)
      const { data } = await api.get(`/projects/${projectId}/rooms`)
      setRooms(data.rooms)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load rooms')
      toast.error('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const createRoom = async ({ name, roomType }) => {
    try {
      const { data } = await api.post(`/projects/${projectId}/rooms`, { name, roomType })
      setRooms((prev) => [data.room, ...prev])
      toast.success('Room created!')
      return data.room
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create room')
      throw err
    }
  }

  const deleteRoom = async (roomId) => {
    try {
      await api.delete(`/projects/${projectId}/rooms/${roomId}`)
      setRooms((prev) => prev.filter((r) => r.id !== roomId))
      toast.success('Room deleted')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete room')
      throw err
    }
  }

  return { rooms, loading, error, createRoom, deleteRoom, refetch: fetchRooms }
}
