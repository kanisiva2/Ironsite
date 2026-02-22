import { useEffect, useRef, useState } from 'react'
import { HiOutlineExternalLink } from 'react-icons/hi'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function ThreeViewer({ worldLabs }) {
  const containerRef = useRef(null)
  const [viewerLoading, setViewerLoading] = useState(true)
  const [viewerError, setViewerError] = useState(null)

  const hasSplats = worldLabs?.splatUrls?.['500k'] || worldLabs?.splatUrls?.['100k']

  useEffect(() => {
    if (!hasSplats || !containerRef.current) {
      setViewerLoading(false)
      return
    }

    let viewer = null

    const initViewer = async () => {
      try {
        const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d')
        const THREE = await import('three')

        const container = containerRef.current
        if (!container) return

        viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, -1, 0],
          initialCameraPosition: [0, 0, 5],
          initialCameraLookAt: [0, 0, 0],
          rootElement: container,
          sharedMemoryForWorkers: false,
        })

        const splatUrl = worldLabs.splatUrls['500k'] || worldLabs.splatUrls['100k']
        await viewer.addSplatScene(splatUrl, { showLoadingUI: false })
        viewer.start()
        setViewerLoading(false)
      } catch (err) {
        console.error('Failed to initialize 3D viewer:', err)
        setViewerError('Failed to load 3D scene')
        setViewerLoading(false)
      }
    }

    initViewer()

    return () => {
      if (viewer) {
        try { viewer.dispose() } catch {}
      }
    }
  }, [hasSplats, worldLabs])

  if (!worldLabs || (!hasSplats && !worldLabs.marbleUrl)) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-alt">
          <span className="text-2xl">🧊</span>
        </div>
        <h3 className="mb-2 text-base font-semibold text-text">No 3D model yet</h3>
        <p className="max-w-xs text-sm text-text-muted">
          Generate an artifact first, then create a 3D environment from it.
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      {viewerLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/80">
          {worldLabs.thumbnailUrl && (
            <img
              src={worldLabs.thumbnailUrl}
              alt="Preview"
              className="mb-4 max-h-48 rounded-lg object-contain opacity-60"
            />
          )}
          <LoadingSpinner size="lg" />
          <span className="mt-3 text-sm text-text-muted">Loading 3D scene...</span>
        </div>
      )}

      {viewerError ? (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <p className="mb-4 text-sm text-danger">{viewerError}</p>
          {worldLabs.panoUrl && (
            <img
              src={worldLabs.panoUrl}
              alt="360° Panorama"
              className="mb-4 max-h-64 rounded-lg object-contain"
            />
          )}
        </div>
      ) : (
        <div ref={containerRef} className="flex-1" />
      )}

      {worldLabs.marbleUrl && (
        <div className="flex items-center justify-end border-t border-border bg-surface px-4 py-2">
          <a
            href={worldLabs.marbleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary-hover"
          >
            <HiOutlineExternalLink className="h-4 w-4" />
            Open in Marble
          </a>
        </div>
      )}
    </div>
  )
}
