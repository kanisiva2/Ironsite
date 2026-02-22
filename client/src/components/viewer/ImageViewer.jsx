import { useState } from 'react'
import {
  HiOutlineThumbUp,
  HiOutlineThumbDown,
  HiOutlineRefresh,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from 'react-icons/hi'

export default function ImageViewer({
  images = [],
  approvedUrls = [],
  onApprove,
  onReject,
  onRegenerate,
  loading,
}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-alt">
          <span className="text-2xl">🎨</span>
        </div>
        <h3 className="mb-2 text-base font-semibold text-text">No images yet</h3>
        <p className="max-w-xs text-sm text-text-muted">
          Chat with the AI architect and ask it to generate a visualization of your room.
        </p>
      </div>
    )
  }

  const currentImage = images[currentIndex]
  const isApproved = approvedUrls.includes(currentImage)

  const goTo = (dir) => {
    setCurrentIndex((prev) => {
      if (dir === 'prev') return prev > 0 ? prev - 1 : images.length - 1
      return prev < images.length - 1 ? prev + 1 : 0
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 items-center justify-center bg-secondary/5 p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm text-text-muted">Generating image...</span>
          </div>
        ) : (
          <>
            <img
              src={currentImage}
              alt={`Generated ${currentIndex + 1}`}
              className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={() => goTo('prev')}
                  className="absolute left-2 rounded-full bg-surface/80 p-2 shadow-md transition-colors hover:bg-surface"
                >
                  <HiOutlineChevronLeft className="h-5 w-5 text-text" />
                </button>
                <button
                  onClick={() => goTo('next')}
                  className="absolute right-2 rounded-full bg-surface/80 p-2 shadow-md transition-colors hover:bg-surface"
                >
                  <HiOutlineChevronRight className="h-5 w-5 text-text" />
                </button>
              </>
            )}

            {isApproved && (
              <div className="absolute top-4 right-4 rounded-full bg-success px-3 py-1 text-xs font-medium text-white">
                Approved
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-1.5">
          {images.length > 1 && images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === currentIndex ? 'w-4 bg-primary' : 'w-1.5 bg-border hover:bg-primary/40'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onApprove?.(currentImage)}
            disabled={isApproved}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-success transition-colors hover:bg-success/10 disabled:opacity-50"
            title="Approve"
          >
            <HiOutlineThumbUp className="h-4 w-4" />
            Like
          </button>
          <button
            onClick={() => onReject?.(currentImage)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
            title="Reject"
          >
            <HiOutlineThumbDown className="h-4 w-4" />
            Dislike
          </button>
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
            title="Regenerate"
          >
            <HiOutlineRefresh className="h-4 w-4" />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  )
}
