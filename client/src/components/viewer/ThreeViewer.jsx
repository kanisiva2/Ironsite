import { useEffect, useMemo, useRef, useState } from 'react'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'
import api from '../../services/api'

function coerceUrl(value) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (value && typeof value === 'object') {
    const preferred = [
      value.url,
      value.download_url,
      value.signed_url,
      value.href,
      value.uri,
      value.spz_url,
      value.file_url,
    ]
    for (const candidate of preferred) {
      const url = coerceUrl(candidate)
      if (url) return url
    }

    for (const nested of Object.values(value)) {
      const url = coerceUrl(nested)
      if (url) return url
    }
  }

  return null
}

function getCandidateSplatUrls(worldLabs) {
  const splats = worldLabs?.splatUrls || {}
  const preferred = [splats.full_res, splats['500k'], splats['100k']]
  const urls = []
  const seen = new Set()

  for (const raw of preferred) {
    const url = coerceUrl(raw)
    if (url && !seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }

  // Defensive fallback for unexpected key shapes from backend/API.
  for (const raw of Object.values(splats)) {
    const url = coerceUrl(raw)
    if (url && !seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }

  return urls
}

function getFilenameFromDisposition(value) {
  if (!value || typeof value !== 'string') return null
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim())
    } catch {
      return utfMatch[1].trim()
    }
  }
  const basicMatch = value.match(/filename="?([^";]+)"?/i)
  return basicMatch?.[1]?.trim() || null
}

function replaceExtension(path, fromExt, toExt) {
  if (!path || typeof path !== 'string') return path
  const regex = new RegExp(`\\.${fromExt}$`, 'i')
  return path.replace(regex, `.${toExt}`)
}

function detectSceneFormat(url, GaussianSplats3D) {
  const SceneFormat = GaussianSplats3D?.SceneFormat
  if (!SceneFormat || !url) return null

  let normalized = url
  try {
    const parsed = new URL(url)
    normalized = decodeURIComponent(parsed.pathname || '').toLowerCase()
  } catch {
    normalized = url.toLowerCase()
  }

  if (normalized.endsWith('.spz') || normalized.includes('.spz?')) return SceneFormat.Spz
  if (normalized.endsWith('.ksplat') || normalized.includes('.ksplat?')) return SceneFormat.KSplat
  if (normalized.endsWith('.splat') || normalized.includes('.splat?')) return SceneFormat.Splat
  if (normalized.endsWith('.ply') || normalized.includes('.ply?')) return SceneFormat.Ply
  return null
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  if (p <= 0) return sorted[0]
  if (p >= 1) return sorted[sorted.length - 1]

  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const t = idx - lo
  return sorted[lo] * (1 - t) + sorted[hi] * t
}

function computeRobustBounds(viewer, THREE) {
  const mesh = viewer?.splatMesh
  if (!mesh || typeof mesh.getSplatCount !== 'function' || typeof mesh.getSplatCenter !== 'function') {
    return null
  }

  const total = mesh.getSplatCount()
  if (!total || total < 2) return null

  const maxSamples = 3500
  const step = Math.max(1, Math.floor(total / maxSamples))
  const xs = []
  const ys = []
  const zs = []
  const point = new THREE.Vector3()

  for (let i = 0; i < total; i += step) {
    mesh.getSplatCenter(i, point, true)
    if (Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)) {
      xs.push(point.x)
      ys.push(point.y)
      zs.push(point.z)
    }
  }

  if (xs.length < 10) return null

  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)
  zs.sort((a, b) => a - b)

  const min = new THREE.Vector3(
    percentile(xs, 0.1),
    percentile(ys, 0.1),
    percentile(zs, 0.1)
  )
  const max = new THREE.Vector3(
    percentile(xs, 0.9),
    percentile(ys, 0.9),
    percentile(zs, 0.9)
  )

  return { min, max }
}

function fitCameraToRoom(viewer, THREE) {
  const bounds = computeRobustBounds(viewer, THREE)
  if (!bounds) return

  const { min, max } = bounds
  const size = new THREE.Vector3().subVectors(max, min)
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5)

  const horizontalSpan = Math.max(size.x, size.z, 1.0)
  const verticalSpan = Math.max(size.y, 1.0)
  const distance = Math.max(0.8, horizontalSpan * 0.35)

  const camera = viewer.camera
  if (camera) {
    camera.up.set(0, 1, 0)
    camera.position.set(
      center.x,
      center.y + verticalSpan * 0.12,
      center.z + distance
    )
    camera.lookAt(center)
    camera.updateProjectionMatrix?.()
  }

  const controls = viewer.controls
  if (controls) {
    controls.target.copy(center)
    controls.enablePan = true
    controls.screenSpacePanning = false
    controls.enableZoom = true
    controls.enableRotate = true
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.zoomSpeed = 0.65
    controls.rotateSpeed = 0.55
    controls.panSpeed = 0.45
    controls.autoRotate = false
    controls.minPolarAngle = 0.001
    controls.maxPolarAngle = Math.PI - 0.001
    controls.minAzimuthAngle = -Infinity
    controls.maxAzimuthAngle = Infinity
    controls.minDistance = Math.max(0.08, horizontalSpan * 0.02)
    controls.maxDistance = Math.max(controls.minDistance + 2.0, horizontalSpan * 2.4)
    controls.update()
    controls.saveState?.()
  }
}

export default function ThreeViewer({ worldLabs, projectId, roomId }) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const threeModuleRef = useRef(null)
  const [viewerLoading, setViewerLoading] = useState(true)
  const [viewerError, setViewerError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [flipVertical, setFlipVertical] = useState(true)

  const candidateKey = useMemo(
    () => getCandidateSplatUrls(worldLabs).join('||'),
    [worldLabs]
  )
  const loadKey = `${candidateKey}|flip:${flipVertical ? 1 : 0}`
  const hasSplats = !!candidateKey
  const hasWorldRecord = !!(worldLabs?.worldId || worldLabs?.operationId || worldLabs?.marbleUrl)

  const handleResetView = () => {
    const viewer = viewerRef.current
    const THREE = threeModuleRef.current
    if (!viewer || !THREE) return
    fitCameraToRoom(viewer, THREE)
  }

  const handleExportModel = async () => {
    if (exporting || !hasWorldRecord) return
    if (!projectId || !roomId) {
      toast.error('Unable to export: missing room context.')
      return
    }

    setExporting(true)

    try {
      const [{ default: JSZip }, { loadSpz, serializePly }] = await Promise.all([
        import('jszip'),
        import('spz-js'),
      ])

      const response = await api.get(`/generate/3d/export-bundle/${projectId}/${roomId}`, {
        responseType: 'blob',
      })
      const originalBlob = response.data
      const zipInput = await JSZip.loadAsync(originalBlob)
      const zipOutput = new JSZip()

      let convertedCount = 0
      let failedCount = 0

      const entries = Object.entries(zipInput.files)
      for (const [path, entry] of entries) {
        if (entry.dir) continue

        if (path.toLowerCase().endsWith('.spz')) {
          try {
            const spzBuffer = await entry.async('arraybuffer')
            const gs = await loadSpz(spzBuffer)
            const plyBuffer = serializePly(gs)
            const plyPath = replaceExtension(path, 'spz', 'ply')
            zipOutput.file(plyPath, plyBuffer)
            convertedCount += 1
          } catch {
            // Keep original file if conversion fails for a specific entry.
            const originalData = await entry.async('uint8array')
            zipOutput.file(path, originalData)
            failedCount += 1
          }
          continue
        }

        const fileData = await entry.async('uint8array')
        zipOutput.file(path, fileData)
      }

      const blob = await zipOutput.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })

      const inputName = getFilenameFromDisposition(response.headers?.['content-disposition'])
        || `${worldLabs?.worldId || 'room-3d'}-assets.zip`
      const filename = inputName.toLowerCase().endsWith('.zip')
        ? inputName.replace(/\.zip$/i, '-ply.zip')
        : `${inputName}-ply.zip`

      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)

      if (convertedCount > 0) {
        toast.success(`Converted ${convertedCount} SPZ file${convertedCount === 1 ? '' : 's'} to PLY.`)
      } else {
        toast('No SPZ files were found to convert.', { icon: 'ℹ' })
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} SPZ file${failedCount === 1 ? '' : 's'} could not be converted and were kept as SPZ.`)
      }
    } catch (error) {
      let detail = 'Unable to export 3D asset bundle.'
      const maybeBlob = error?.response?.data

      if (maybeBlob instanceof Blob) {
        try {
          const text = await maybeBlob.text()
          const parsed = JSON.parse(text)
          if (parsed?.detail) {
            detail = parsed.detail
          }
        } catch {
          // Ignore JSON parse failures and keep default message.
        }
      } else if (error?.response?.data?.detail) {
        detail = error.response.data.detail
      }

      toast.error(detail)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const root = containerRef.current
    if (!hasSplats || !root) {
      setViewerLoading(false)
      setViewerError(null)
      return
    }

    let viewer = null

    const initViewer = async () => {
      try {
        setViewerLoading(true)
        setViewerError(null)
        const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d')
        const THREE = await import('three')
        threeModuleRef.current = THREE

        const container = root
        if (!container) return

        // Prevent stale canvases from previous viewer instances causing shadow artifacts.
        container.replaceChildren()

        let loaded = false
        let lastError = null
        const candidateSplatUrls = candidateKey.split('||').filter(Boolean)

        for (const splatUrl of candidateSplatUrls) {
          try {
            const sceneFormat = detectSceneFormat(splatUrl, GaussianSplats3D)
            viewer = new GaussianSplats3D.Viewer({
              rootElement: container,
              sharedMemoryForWorkers: false,
              sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
              integerBasedSort: false,
              gpuAcceleratedSort: false,
              splatSortDistanceMapPrecision: 18,
            })

            // Some generated splat URLs can be stale/corrupt. Try alternatives.
            await Promise.race([
              viewer.addSplatScene(splatUrl, {
                showLoadingUI: false,
                format: sceneFormat ?? undefined,
                splatAlphaRemovalThreshold: 8,
                rotation: flipVertical ? [1, 0, 0, 0] : [0, 0, 0, 1],
              }),
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timed out loading splat scene')), 45000)
              }),
            ])
            viewer.start()
            fitCameraToRoom(viewer, THREE)

            // Disable library keyboard debug shortcuts/info panel toggles.
            if (viewer.controls?.stopListenToKeyEvents) {
              viewer.controls.stopListenToKeyEvents()
            }
            if (viewer.keyDownListener) {
              window.removeEventListener('keydown', viewer.keyDownListener)
              viewer.keyDownListener = null
            }

            viewerRef.current = viewer
            const canvas = container.querySelector('canvas')
            if (canvas) {
              canvas.style.position = 'absolute'
              canvas.style.inset = '0'
              canvas.style.width = '100%'
              canvas.style.height = '100%'
              canvas.style.display = 'block'
              canvas.style.zIndex = '0'
              canvas.style.pointerEvents = 'auto'
            }
            loaded = true
            break
          } catch (err) {
            lastError = err
            try {
              if (viewer) viewer.dispose()
            } catch {
              // Ignore dispose errors during URL fallback attempts.
            }
            viewer = null
          }
        }

        if (!loaded) {
          throw lastError || new Error('No splat URL could be rendered')
        }

        setViewerLoading(false)
      } catch {
        setViewerError('Failed to load 3D scene')
        setViewerLoading(false)
      }
    }

    initViewer()

    return () => {
      if (viewer) {
        try {
          viewer.dispose()
        } catch {
          // Ignore dispose errors on unmount.
        }
      }
      viewerRef.current = null
      root.replaceChildren()
    }
  }, [candidateKey, flipVertical, hasSplats, loadKey])

  if (!worldLabs || !hasSplats) {
    const title = hasWorldRecord ? '3D data not renderable' : 'No 3D model yet'
    const body = hasWorldRecord
      ? 'A world was generated, but no compatible splat URL is available to render it here.'
      : 'Generate a 3D environment to preview and walk through the room.'
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-alt">
          <span className="text-2xl">3D</span>
        </div>
        <h3 className="mb-2 text-base font-semibold text-text">{title}</h3>
        <p className="max-w-xs text-sm text-text-muted">
          {body}
        </p>
      </div>
    )
  }

  return (
    <div className="relative isolate flex h-full min-h-0 flex-col overflow-hidden">
      <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={handleExportModel}
          disabled={!hasWorldRecord || exporting}
          title={
            hasWorldRecord
              ? 'Download a ZIP bundle with Blender-compatible assets'
              : 'Generate a 3D scene first to enable export'
          }
          className="rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-text shadow-sm backdrop-blur transition-colors hover:bg-surface disabled:opacity-60"
        >
          {exporting ? 'Exporting...' : 'Export ZIP'}
        </button>
        <button
          type="button"
          onClick={handleResetView}
          className="rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-text shadow-sm backdrop-blur transition-colors hover:bg-surface"
        >
          Reset View
        </button>
        <button
          type="button"
          onClick={() => setFlipVertical((prev) => !prev)}
          className="rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-text shadow-sm backdrop-blur transition-colors hover:bg-surface"
        >
          {flipVertical ? 'Normal Up' : 'Flip Up'}
        </button>
      </div>

      {viewerLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-surface/80 pointer-events-none">
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
        <div className="relative z-20 flex h-full flex-col items-center justify-center p-8 text-center">
          <p className="mb-4 text-sm text-danger">{viewerError}</p>
          {worldLabs.panoUrl && (
            <img
              src={worldLabs.panoUrl}
              alt="Panorama"
              className="mb-4 max-h-64 rounded-lg object-contain"
            />
          )}
        </div>
      ) : (
        <div ref={containerRef} className="relative z-0 min-h-0 flex-1 bg-surface-alt" />
      )}

      <div className="relative z-20 border-t border-border bg-surface px-4 py-2 text-xs text-text-muted">
        Click and drag to look around. Scroll to zoom. Use Reset View or Flip Up if orientation feels off.
      </div>
    </div>
  )
}
