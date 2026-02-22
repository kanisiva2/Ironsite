export default function StatusIndicator({ status }) {
  if (!status) return null

  const statusConfig = {
    thinking: { text: 'Thinking...', color: 'bg-primary' },
    generating_2d: { text: 'Generating image...', color: 'bg-warning' },
    generating_artifact: { text: 'Compiling technical specs...', color: 'bg-warning' },
    generating_3d: { text: 'Building 3D environment...', color: 'bg-warning' },
    ready: { text: 'Ready', color: 'bg-success' },
  }

  const config = statusConfig[status] || statusConfig.ready

  return (
    <div className="flex items-center gap-2 border-t border-border bg-surface px-4 py-2">
      <div className={`h-2 w-2 animate-pulse rounded-full ${config.color}`} />
      <span className="text-xs text-text-muted">{config.text}</span>
    </div>
  )
}
