import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'
import { POLL_INTERVAL_MS, GENERATION_STATUS } from '../utils/constants'

export default function usePollJob(jobId) {
  const [job, setJob] = useState(null)
  const [polling, setPolling] = useState(false)
  const intervalRef = useRef(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setPolling(false)
  }, [])

  const startPolling = useCallback((id) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPolling(true)

    const poll = async () => {
      try {
        const { data } = await api.get(`/generate/status/${id}`)
        setJob(data.job)

        if (
          data.job.status === GENERATION_STATUS.completed ||
          data.job.status === GENERATION_STATUS.failed
        ) {
          stopPolling()
        }
      } catch {
        stopPolling()
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
  }, [stopPolling])

  useEffect(() => {
    if (jobId) startPolling(jobId)
    return stopPolling
  }, [jobId, startPolling, stopPolling])

  return { job, polling, stopPolling }
}
