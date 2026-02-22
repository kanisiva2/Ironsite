export const ROOM_TYPES = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'living_room', label: 'Living Room' },
  { value: 'dining_room', label: 'Dining Room' },
  { value: 'office', label: 'Office' },
  { value: 'garage', label: 'Garage' },
  { value: 'other', label: 'Other' },
]

export const ROOM_STATUS = {
  draft: { label: 'Draft', color: 'text-text-muted' },
  consulting: { label: 'Consulting', color: 'text-primary' },
  prototyping_2d: { label: '2D Prototyping', color: 'text-warning' },
  generating_3d: { label: 'Generating 3D', color: 'text-warning' },
  complete: { label: 'Complete', color: 'text-success' },
}

export const PROJECT_STATUS = {
  active: { label: 'Active', color: 'text-success' },
  archived: { label: 'Archived', color: 'text-text-muted' },
}

export const GENERATION_STATUS = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
}

export const POLL_INTERVAL_MS = 3000
