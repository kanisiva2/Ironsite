import Markdown from 'react-markdown'
import { HiOutlineUser } from 'react-icons/hi'
import { HiSparkles } from 'react-icons/hi2'

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="rounded-full bg-surface-alt px-4 py-1.5 text-xs text-text-muted">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary text-white' : 'bg-primary-light text-primary'
        }`}
      >
        {isUser ? (
          <HiOutlineUser className="h-4 w-4" />
        ) : (
          <HiSparkles className="h-4 w-4" />
        )}
      </div>

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-white'
            : 'border border-border bg-surface text-text'
        }`}
      >
        <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
          <Markdown>{message.content}</Markdown>
        </div>

        {message.imageUrls?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Attached ${i + 1}`}
                className="max-h-48 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
