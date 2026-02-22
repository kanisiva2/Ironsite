import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function ChatWindow({ messages, loading, streaming }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <div
            className="mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-primary-light text-3xl"
            style={{ boxShadow: '0 0 0 12px rgba(200,150,92,0.07)' }}
          >
            🏠
          </div>
          <h3 className="mb-3 text-xl text-text">Start Your Design Consultation</h3>
          <p className="max-w-xs text-sm leading-relaxed text-text-muted">
            Describe what you envision for this room. The AI architect will guide you
            through dimensions, styles, materials, and more.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {streaming && (
            <div className="flex items-center gap-2 pl-11 text-text-muted">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
