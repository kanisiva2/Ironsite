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

  const handleClick = () => {
    navigate(`/projects/${projectId}/rooms/${room.id}`)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${room.name}"? This cannot be undone.`)) {
      onDelete(room.id)
    }
  }

  return (
    <div
      onClick={handleClick}
      className="card-lift group cursor-pointer rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-primary/40 hover:shadow-lg"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light transition-colors duration-200 group-hover:bg-primary/10">
          {room.thumbnailUrl ? (
            <img
              src={room.thumbnailUrl}
              alt={room.name}
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            <Icon className="h-7 w-7 text-primary" />
          )}
        </div>
        <button
          onClick={handleDelete}
          className="rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
          title="Remove chamber"
        >
          <HiOutlineTrash className="h-4 w-4" />
        </button>
      </div>

      <h3 className="mb-1 text-lg font-medium text-text">{room.name}</h3>
      <p className="mb-4 text-sm text-text-muted">{typeLabel}</p>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <span className={`text-xs font-medium tracking-wide uppercase ${status.color}`}>
          {status.label}
        </span>
      </div>
    </div>
  )
}
