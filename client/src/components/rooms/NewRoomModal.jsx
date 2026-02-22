import { useState } from 'react'
import { HiX } from 'react-icons/hi'
import { ROOM_TYPES } from '../../utils/constants'

export default function NewRoomModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [roomType, setRoomType] = useState('bedroom')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({ name, roomType })
      setName('')
      setRoomType('bedroom')
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
          <h3 className="text-lg font-semibold text-text">New Room</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
          >
            <HiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="roomName" className="mb-1 block text-sm font-medium text-text">
              Room Name
            </label>
            <input
              id="roomName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface-alt px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Master Bedroom"
            />
          </div>

          <div>
            <label htmlFor="roomType" className="mb-1 block text-sm font-medium text-text">
              Room Type
            </label>
            <select
              id="roomType"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-alt px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
            >
              {ROOM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
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
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
