'use client'

import { useState } from 'react'

interface PhotoUploadProps {
  label: string
  existingPath?: string | null
  userId: number | string
  walletAddress?: string
  side: 'front' | 'back'
  lang?: string
  onUploaded?: (path: string) => void
}

export function PhotoUpload({ label, existingPath, userId, walletAddress, side, lang, onUploaded }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const isEs = lang === 'es'

  const getAuthParams = () => {
    if (typeof window === 'undefined') return ''
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const tok = localStorage.getItem('learn.tg.authToken') || ''
    if (!addr || !tok) return ''
    return `walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(tok)}`
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
      fd.append('token', typeof window !== 'undefined' ? localStorage.getItem('learn.tg.authToken') || '' : '')
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
          <a href={photoUrl} target="_blank" rel="noopener noreferrer">
            <img src={photoUrl} alt={label} className="h-16 w-12 object-cover rounded border hover:opacity-80 cursor-pointer" />
          </a>
          <label className="text-xs text-blue-600 cursor-pointer hover:underline">
            {isEs ? 'Cambiar' : 'Change'}
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      ) : (
        <label className="inline-block text-xs text-blue-600 cursor-pointer hover:underline">
          {uploading ? (isEs ? 'Subiendo...' : 'Uploading...') : (isEs ? 'Seleccionar archivo' : 'Choose file')}
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      )}
    </div>
  )
}
