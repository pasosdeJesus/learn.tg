'use client'

import { use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { Button } from '@/components/ui/button'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'

type PageProps = { params: Promise<{ lang: string; id: string }> }
const VERIFIER_WALLET = process.env.NEXT_PUBLIC_VERIFIER_WALLET || ''

export default function AdminUserDetail({ params }: PageProps) {
  const { lang, id } = use(params)
  const { address } = useAuthAddress()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const t = createComponentT(lang, {
    en: {
      title: 'User Verification', loading: 'Loading...', notFound: 'User not found.',
      accessDenied: 'Access denied.', save: 'Save Changes', saving: 'Saving...',
      saved: 'Profile updated.', error: 'Failed to save.',
      name: 'Full Name', email: 'Email', whatsapp: 'WhatsApp', telegram: 'Telegram',
      passportName: 'Passport Name', passportNationality: 'Nationality',
      churchRelationship: 'Church Relationship', verified: 'Verified',
      proposedDate: 'Proposed Interview', conductedDate: 'Conducted Interview',
      idPhotos: 'ID Photos', profileScore: 'Profile Score',
      verifiedWhatsapp: 'Verified WhatsApp', verifiedTelegram: 'Verified Telegram',
      verifiedEmail: 'Verified Email', verifiedCity: 'Verified City',
      verifiedPlaceOfWorship: 'Verified Place of Worship',
      verifiedChurchRelationship: 'Verified Church Relationship',
      back: '← Back to Dashboard',
    },
    es: {
      title: 'Verificación de Usuario', loading: 'Cargando...', notFound: 'Usuario no encontrado.',
      accessDenied: 'Acceso denegado.', save: 'Guardar Cambios', saving: 'Guardando...',
      saved: 'Perfil actualizado.', error: 'Error al guardar.',
      name: 'Nombre Completo', email: 'Correo', whatsapp: 'WhatsApp', telegram: 'Telegram',
      passportName: 'Nombre Pasaporte', passportNationality: 'Nacionalidad',
      churchRelationship: 'Relación Iglesia', verified: 'Verificado',
      proposedDate: 'Entrevista Propuesta', conductedDate: 'Entrevista Realizada',
      idPhotos: 'Fotos de ID', profileScore: 'Puntaje de Perfil',
      verifiedWhatsapp: 'WhatsApp Verificado', verifiedTelegram: 'Telegram Verificado',
      verifiedEmail: 'Correo Verificado', verifiedCity: 'Ciudad Verificada',
      verifiedPlaceOfWorship: 'Lugar de Culto Verificado',
      verifiedChurchRelationship: 'Relación Iglesia Verificada',
      back: '← Volver al Panel',
    },
  })

  useEffect(() => {
    fetch(`/api/admin/user/${id}`)
      .then(r => r.json())
      .then(data => { setUser(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (!address || !VERIFIER_WALLET || address.toLowerCase() !== VERIFIER_WALLET.toLowerCase()) {
    return <div className="container mx-auto py-16 px-4 text-center"><p className="text-red-600">{t('accessDenied')}</p></div>
  }

  if (loading) return <div className="container mx-auto py-8 px-4"><p>{t('loading')}</p></div>
  if (!user || user.error) return <div className="container mx-auto py-8 px-4"><p>{t('notFound')}</p></div>

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const form = e.target as HTMLFormElement
      const data: Record<string, any> = {}
      for (const el of form.elements as any) {
        if (el.name && el.type === 'checkbox') data[el.name] = el.checked
        else if (el.name) data[el.name] = el.value
      }
      const res = await fetch(`/api/admin/user/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast({ title: t('saved') })
    } catch { toast({ title: t('error'), variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const checkboxFields = [
    'verified_whatsapp', 'verified_telegram', 'verified_email',
    'verified_city_id', 'verified_place_of_worship', 'verified_church_relationship',
  ]

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <a href={`/${lang}/admin`} className="text-blue-600 text-sm hover:underline mb-4 inline-block">{t('back')}</a>
      <h1 className="text-xl font-bold mb-4">{t('title')}: {user.nombre || user.nusuario}</h1>
      <p className="text-sm text-gray-500 mb-4">{user.billetera} — {t('profileScore')}: {user.profilescore}</p>

      <form onSubmit={handleSave} className="space-y-4">
        {[
          ['nombre', t('name')], ['email', t('email')], ['whatsapp', t('whatsapp')],
          ['telegram', t('telegram')], ['passport_name', t('passportName')],
          ['passport_nationality', t('passportNationality')],
        ].map(([name, label]) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input name={name} defaultValue={user[name] || ''} className="w-full px-3 py-2 border rounded-md" />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('proposedDate')}</label>
            <input name="proposed_date_of_interview" type="datetime-local"
              defaultValue={user.proposed_date_of_interview ? new Date(user.proposed_date_of_interview).toISOString().slice(0, 16) : ''}
              className="w-full px-3 py-2 border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('conductedDate')}</label>
            <input name="conducted_date_of_interview" type="datetime-local"
              defaultValue={user.conducted_date_of_interview ? new Date(user.conducted_date_of_interview).toISOString().slice(0, 16) : ''}
              className="w-full px-3 py-2 border rounded-md" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('churchRelationship')}</label>
          <select name="church_relationship" defaultValue={user.church_relationship || ''} className="w-full px-3 py-2 border rounded-md">
            <option value="">—</option>
            <option value="pastor">{lang === 'es' ? 'Pastor' : 'Pastor'}</option>
            <option value="leader">{lang === 'es' ? 'Líder' : 'Leader'}</option>
            <option value="member">{lang === 'es' ? 'Miembro' : 'Member'}</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <h2 className="font-semibold mb-3">{t('verified')}</h2>
          <div className="grid grid-cols-2 gap-2">
            {checkboxFields.map(f => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={f} defaultChecked={!!user[f]} />
                {t(f.replace('verified_', 'verified') === 'verified_whatsapp' ? 'verifiedWhatsapp' :
                    f === 'verified_telegram' ? 'verifiedTelegram' :
                    f === 'verified_email' ? 'verifiedEmail' :
                    f === 'verified_city_id' ? 'verifiedCity' :
                    f === 'verified_place_of_worship' ? 'verifiedPlaceOfWorship' : 'verifiedChurchRelationship')}
              </label>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? t('saving') : t('save')}
        </Button>
      </form>
    </div>
  )
}
