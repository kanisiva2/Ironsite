import { useState, useCallback, useRef } from 'react'
import api from '../services/api'
import { getIdToken } from '../services/firebase'
import toast from 'react-hot-toast'

export default function useChat(roomId, projectId) {
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const fetchMessages = useCallback(async () => {
    if (!roomId || !projectId) return
    try {
      setLoading(true)
      const { data } = await api.get(`/projects/${projectId}/rooms/${roomId}/messages`)
      setMessages(data.messages || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [roomId, projectId])

  const sendMessage = useCallback(async (content, imageUrls = []) => {
    if (!content.trim() && imageUrls.length === 0) return

    const userMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      imageUrls,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    const assistantMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      imageUrls: [],
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMessage])
    setStreaming(true)

    try {
      const token = await getIdToken()
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
      const response = await fetch(`${baseUrl}/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, projectId, content, imageUrls }),
      })

      if (!response.ok) throw new Error('Chat request failed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6))

              if (payload.text) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + payload.text,
                    }
                  }
                  return updated
                })
              }

              if (payload.messageId) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, id: payload.messageId }
                  }
                  return updated
                })
              }

              if (payload.action) {
                toast.success(`Generating ${payload.action.type}...`)
              }
            } catch {
              // skip malformed SSE data
            }
          }
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send message')
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id))
    } finally {
      setStreaming(false)
    }
  }, [roomId, projectId])

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }, [])

  return {
    messages,
    streaming,
    loading,
    error,
    sendMessage,
    stopStreaming,
    fetchMessages,
  }
}
