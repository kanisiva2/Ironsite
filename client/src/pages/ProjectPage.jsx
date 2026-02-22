import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { HiPlus, HiChevronRight } from 'react-icons/hi'
import { HiOutlineCube } from 'react-icons/hi2'
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

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-text-muted">
          <Link to="/" className="transition-colors hover:text-primary">
            Dashboard
          </Link>
          <HiChevronRight className="h-4 w-4" />
          <span className="font-medium text-text">Rooms</span>
        </nav>

        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
              Project Rooms
            </p>
            <h1 className="text-4xl text-text">Rooms</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <HiPlus className="h-4 w-4" />
            New Room
          </button>
        </div>

        {loading ? (
          <LoadingSpinner size="lg" className="py-24" />
        ) : error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-8 text-center">
            <p className="text-danger">{error}</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-8 py-24 text-center shadow-sm">
            <div
              className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary-light"
              style={{ boxShadow: '0 0 0 16px rgba(200,150,92,0.08)' }}
            >
              <HiOutlineCube className="h-11 w-11 text-primary" />
            </div>
            <h3 className="mb-3 text-2xl font-light text-text">No rooms yet</h3>
            <p className="mx-auto mb-8 max-w-xs text-base leading-relaxed text-text-muted">
              Add your first room to start designing with AI
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <HiPlus className="h-4 w-4" />
              Add First Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
