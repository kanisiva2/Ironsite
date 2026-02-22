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
      className="group cursor-pointer rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light">
          {room.thumbnailUrl ? (
            <img
              src={room.thumbnailUrl}
              alt={room.name}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <Icon className="h-6 w-6 text-primary" />
          )}
        </div>
        <button
          onClick={handleDelete}
          className="rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
          title="Delete room"
        >
          <HiOutlineTrash className="h-4 w-4" />
        </button>
      </div>

      <h3 className="mb-1 text-base font-semibold text-text">{room.name}</h3>
      <p className="mb-3 text-sm text-text-muted">{typeLabel}</p>

      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
      </div>
    </div>
  )
}
