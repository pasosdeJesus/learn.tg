'use client'

import { useState } from 'react'

interface PhotoUploadProps {
  label: string
  existingPath?: string | null
  userId: number | string
  walletAddress?: string
  side: 'front' | 'back' | 'registration'
  lang?: string
  onUploaded?: (path: string) => void
  /** Solo lectura: muestra el documento sin ofrecer reemplazarlo (verificador). */
  readOnly?: boolean
}

export function PhotoUpload({ label, existingPath, userId, walletAddress, side, lang, onUploaded, readOnly = false }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const isEs = lang === 'es'

  const getAuthParams = () => {
    if (typeof window === 'undefined') return ''
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    if (!addr) return ''
    // Standard mechanism (R-#233): identity hint only; the session cookie
    // authorizes the same-origin request.
    return `walletAddress=${encodeURIComponent(addr)}`
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      fd.append('side', side)
      fd.append('walletAddress', walletAddress || '')
      const res = await fetch('/api/user/id-photo', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      const auth = getAuthParams()
      setPreview(`/api/user/id-photo/${userId}?side=${side}${auth ? '&' + auth : ''}`)
      onUploaded?.(data.path || '')
    } catch {
      // silent
    } finally {
      setUploading(false)
    }
  }

  const photoUrl = preview || (existingPath
    ? `/api/user/id-photo/${userId}?side=${side}&${getAuthParams()}`
    : null)

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {photoUrl ? (
        <div className="flex items-center gap-2">
          <a href={photoUrl} target="_blank" rel="noopener noreferrer" data-testid="photo-link">
            <img src={photoUrl} alt={label} className="h-16 w-12 object-cover rounded border hover:opacity-80 cursor-pointer" />
          </a>
          {!readOnly && (
            <label className="text-xs text-blue-600 cursor-pointer hover:underline">
              {isEs ? 'Cambiar' : 'Change'}
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          )}
        </div>
      ) : readOnly ? (
        <span className="text-xs text-gray-500" data-testid="photo-missing">
          {isEs ? 'Sin documento' : 'No document'}
        </span>
      ) : (
        <label className="inline-block text-xs text-blue-600 cursor-pointer hover:underline">
          {uploading ? (isEs ? 'Subiendo...' : 'Uploading...') : (isEs ? 'Seleccionar archivo' : 'Choose file')}
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      )}
    </div>
  )
}
