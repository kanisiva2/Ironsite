import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { HiPlus, HiChevronRight } from 'react-icons/hi'
import Navbar from '../components/layout/Navbar'
import RoomCard from '../components/rooms/RoomCard'
import NewRoomModal from '../components/rooms/NewRoomModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import useRooms from '../hooks/useRooms'

export default function ProjectPage() {
  const { projectId } = useParams()
  const { rooms, loading, error, createRoom, deleteRoom } = useRooms(projectId)
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="min-h-screen bg-surface-alt">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-text-muted">
          <Link to="/" className="transition-colors hover:text-primary">
            Dashboard
          </Link>
          <HiChevronRight className="h-4 w-4" />
          <span className="font-medium text-text">Rooms</span>
        </nav>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Rooms</h1>
            <p className="mt-1 text-text-muted">Manage the rooms in this project</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <HiPlus className="h-4 w-4" />
            New Room
          </button>
        </div>

        {loading ? (
          <LoadingSpinner size="lg" className="py-20" />
        ) : error ? (
          <div className="rounded-xl border border-danger/20 bg-danger/5 p-8 text-center">
            <p className="text-danger">{error}</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <HiPlus className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-text">No rooms yet</h3>
            <p className="mb-6 text-text-muted">
              Add your first room to start designing with AI
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Add First Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                projectId={projectId}
                onDelete={deleteRoom}
              />
            ))}
          </div>
        )}
      </main>

      <NewRoomModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={createRoom}
      />
    </div>
  )
}
