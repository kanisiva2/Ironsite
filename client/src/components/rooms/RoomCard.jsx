import { useNavigate } from 'react-router-dom'
import { HiOutlineTrash } from 'react-icons/hi'
import {
  HiOutlineCube,
  HiOutlinePaintBrush,
  HiOutlineWrench,
  HiOutlineFire,
  HiOutlineComputerDesktop,
  HiOutlineBuildingOffice,
} from 'react-icons/hi2'
import { ROOM_STATUS, ROOM_TYPES } from '../../utils/constants'

const ROOM_ICONS = {
  bedroom: HiOutlinePaintBrush,
  bathroom: HiOutlineWrench,
  kitchen: HiOutlineFire,
  living_room: HiOutlineCube,
  dining_room: HiOutlineCube,
  office: HiOutlineComputerDesktop,
  garage: HiOutlineBuildingOffice,
  other: HiOutlineCube,
}

export default function RoomCard({ room, projectId, onDelete }) {
  const navigate = useNavigate()
  const status = ROOM_STATUS[room.status] || ROOM_STATUS.draft
  const Icon = ROOM_ICONS[room.roomType] || HiOutlineCube
  const typeLabel = ROOM_TYPES.find((t) => t.value === room.roomType)?.label || room.roomType

  // Best available preview: approved image → thumbnail → none
  const previewImage =
    room.approved2dImageUrls?.[0] ||
    room.thumbnailUrl ||
    null

  const handleClick = () => {
    navigate(`/projects/${projectId}/rooms/${room.id}`)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${room.name}"? This cannot be undone.`)) {
      onDelete(room.id)
    }
  }

  // ── Plain card (no rendered image yet) ────────────────────
  if (!previewImage) {
    return (
      <div
        onClick={handleClick}
        className="card-lift group relative cursor-pointer rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-primary/40 hover:shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light transition-colors duration-200 group-hover:bg-primary/10">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <button
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
            title="Remove room"
          >
            <HiOutlineTrash className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mb-1 text-lg font-medium text-text">{room.name}</h3>
        <p className="mb-4 text-sm text-text-muted">{typeLabel}</p>
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className={`text-xs font-medium uppercase tracking-wide ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>
    )
  }

  // ── Peel card (has a rendered image to preview) ────────────
  return (
    <div
      onClick={handleClick}
      className="room-card-peel card-lift group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface shadow-sm hover:border-primary/40 hover:shadow-lg"
    >
      {/* ── Layer 0: Full-card preview image ── */}
      <img
        src={previewImage}
        alt={`Preview of ${room.name}`}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ zIndex: 0 }}
        draggable={false}
      />

      {/* ── Layer 1: White card-face mask (gets a hole on hover) ── */}
      <div
        aria-hidden
        className="peel-card-face pointer-events-none absolute inset-0 bg-surface"
        style={{ zIndex: 1 }}
      />

      {/* ── Layer 2: Card content ── */}
      <div className="peel-content relative p-6" style={{ zIndex: 2 }}>
        <div className="mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light transition-colors duration-200 group-hover:bg-primary/10">
            <Icon className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h3 className="mb-1 text-lg font-medium text-text">{room.name}</h3>
        <p className="mb-4 text-sm text-text-muted">{typeLabel}</p>
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className={`text-xs font-medium uppercase tracking-wide ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* ── Delete button — same position as plain card (p-6 from edges) ── */}
      <button
        onClick={handleDelete}
        className="absolute right-6 top-6 rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        style={{ zIndex: 20 }}
        title="Remove room"
      >
        <HiOutlineTrash className="h-4 w-4" />
      </button>
    </div>
  )
}