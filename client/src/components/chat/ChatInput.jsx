import { useState, useRef } from 'react'
import { HiOutlinePaperAirplane, HiOutlinePhotograph } from 'react-icons/hi'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../services/firebase'
import toast from 'react-hot-toast'

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [attachedImages, setAttachedImages] = useState([])
  const fileInputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if ((!text.trim() && attachedImages.length === 0) || disabled) return
    onSend(text, attachedImages)
    setText('')
    setAttachedImages([])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const storageRef = ref(storage, `chat-uploads/${Date.now()}-${file.name}`)
          await uploadBytes(storageRef, file)
          return getDownloadURL(storageRef)
        })
      )
      setAttachedImages((prev) => [...prev, ...urls])
    } catch {
      toast.error('Failed to upload image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeImage = (index) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t border-border bg-surface p-4">
      {attachedImages.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachedImages.map((url, i) => (
            <div key={i} className="group relative">
              <img
                src={url}
                alt={`Attached ${i + 1}`}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg p-2.5 text-text-muted transition-colors hover:bg-surface-alt hover:text-text disabled:opacity-50"
          title="Attach image"
        >
          <HiOutlinePhotograph className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-border bg-surface-alt px-4 py-2.5 text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          placeholder={uploading ? 'Uploading...' : 'Describe your vision…'}
        />

        <button
          type="submit"
          disabled={disabled || (!text.trim() && attachedImages.length === 0)}
          className="rounded-lg bg-primary p-2.5 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <HiOutlinePaperAirplane className="h-5 w-5 rotate-90" />
        </button>
      </form>
    </div>
  )
}
