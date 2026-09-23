'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, ShieldAlert, ShieldCheck, Award } from 'lucide-react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Switch } from '@pasosdejesus/m/shadcn-components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@pasosdejesus/m/shadcn-components/ui/alert-dialog'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import { clearPrivateCourseCopies } from '@/lib/offline-course-db'
import { createComponentT } from '@/lib/hooks/useTranslation'

// Ajustes de privacidad del estudiante
// (https://github.com/pasosdeJesus/learn.tg/issues/259).
//
// Dos interruptores y la lista de credenciales propias. Los valores por defecto
// son deliberados: publicar cursos completados sí (comportamiento histórico),
// publicar contenido cristiano no (una billetera es pública y enumerable; en un
// contexto de persecución esa marca no se puede deshacer).

interface CredentialRow {
  tokenId: number
  courseId: number
  earnedAt: string
  isPremium: boolean
  revokedAt: string | null
  courseName: string | null
  christianContent: boolean
}

interface SettingsResponse {
  publicCourses: boolean
  publicChristianCourses: boolean
  credentials: CredentialRow[]
}

type PageProps = {
  params: Promise<{ lang: string }>
}

export default function SettingsPage({ params }: PageProps) {
  const { lang } = use(params)
  const { toast } = useToast()
  const { authedGet, authedPatch, authedPost, ready, wallet } = useAuthedApi()

  const [publicCourses, setPublicCourses] = useState(true)
  const [publicChristian, setPublicChristian] = useState(false)
  const [credentials, setCredentials] = useState<CredentialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [minting, setMinting] = useState(false)
  const [revoking, setRevoking] = useState<number | null>(null)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Privacy',
      intro: 'You decide what learn.tg publishes about you.',
      publicCoursesTitle: 'Publish my completed courses',
      publicCoursesHelp: 'Your completed courses appear in your public profile and in the leaderboard.',
      christianTitle: 'Publish my courses with Christian content',
      christianHelp: 'Some courses teach about following Jesus. Publishing them shows the world that you studied them.',
      warningTitle: 'Before you turn this on',
      warning: 'Your wallet address and its credentials are public, permanent and enumerable: anyone who looks at your wallet can see that you completed a course about Jesus, and that cannot be undone. In some countries and families that is dangerous. Turn this on only if it is safe for you.',
      credentialsTitle: 'My credentials',
      credentialsHelp: 'You can revoke (burn) a credential you no longer want to publish. The credential is deleted from the blockchain and from your profile; your progress and scholarships are kept.',
      noCredentials: 'You have no credentials yet.',
      revoke: 'Revoke',
      revokeTitle: 'Revoke this credential?',
      revokeDesc: 'The credential will be burned permanently. This cannot be undone; if you complete the course again it will not be reissued.',
      revokeConfirm: 'Yes, revoke it',
      revoked: 'Revoked',
      premium: 'Premium',
      mintTitle: 'Pending credentials',
      mintHelp: 'Some courses you already completed do not have a credential because they were not published. You can issue them now.',
      mintButton: 'Issue pending credentials',
      mintDone: 'Credentials issued',
      saved: 'Saved',
      saveFailed: 'Could not save your settings.',
      loadFailed: 'Could not load your settings.',
      revokeFailed: 'Could not revoke the credential.',
      revokeDone: 'Credential revoked',
      processing: 'Processing...',
    },
    es: {
      title: 'Privacidad',
      intro: 'Tú decides qué publica learn.tg sobre ti.',
      publicCoursesTitle: 'Publicar mis cursos completados',
      publicCoursesHelp: 'Tus cursos completados aparecen en tu perfil público y en la tabla de líderes.',
      christianTitle: 'Publicar mis cursos con contenido cristiano',
      christianHelp: 'Algunos cursos enseñan sobre seguir a Jesús. Publicarlos muestra al mundo que los estudiaste.',
      warningTitle: 'Antes de encender esto',
      warning: 'Tu dirección de billetera y sus credenciales son públicas, permanentes y enumerables: cualquiera que mire tu billetera puede ver que completaste un curso sobre Jesús, y eso no se puede deshacer. En algunos países y familias eso es peligroso. Enciéndelo solo si es seguro para ti.',
      credentialsTitle: 'Mis credenciales',
      credentialsHelp: 'Puedes revocar (quemar) una credencial que ya no quieras publicar. Se borra de la cadena de bloques y de tu perfil; tu progreso y tus becas se conservan.',
      noCredentials: 'Todavía no tienes credenciales.',
      revoke: 'Revocar',
      revokeTitle: '¿Revocar esta credencial?',
      revokeDesc: 'La credencial se quemará de forma permanente. No se puede deshacer; si vuelves a completar el curso no se reemitirá.',
      revokeConfirm: 'Sí, revocar',
      revoked: 'Revocada',
      premium: 'Premium',
      mintTitle: 'Credenciales pendientes',
      mintHelp: 'Algunos cursos que ya completaste no tienen credencial porque no se publicaron. Puedes emitirlas ahora.',
      mintButton: 'Emitir credenciales pendientes',
      mintDone: 'Credenciales emitidas',
      saved: 'Guardado',
      saveFailed: 'No se pudo guardar tu configuración.',
      loadFailed: 'No se pudo cargar tu configuración.',
      revokeFailed: 'No se pudo revocar la credencial.',
      revokeDone: 'Credencial revocada',
      processing: 'Procesando...',
    },
  }), [lang])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedGet<SettingsResponse>('/api/settings')
      setPublicCourses(res.data.publicCourses)
      setPublicChristian(res.data.publicChristianCourses)
      setCredentials(res.data.credentials || [])
    } catch {
      toast({ title: t('loadFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [authedGet, t, toast])

  useEffect(() => {
    if (!ready) return
    if (!wallet) {
      setLoading(false)
      return
    }
    load()
  }, [ready, wallet, load])

  const save = useCallback(async (patch: { mostrarCursosPublico?: boolean; mostrarCursosCristianosPublico?: boolean }) => {
    setSaving(true)
    const previous = { publicCourses, publicChristian }
    if (typeof patch.mostrarCursosPublico === 'boolean') setPublicCourses(patch.mostrarCursosPublico)
    if (typeof patch.mostrarCursosCristianosPublico === 'boolean') setPublicChristian(patch.mostrarCursosCristianosPublico)
    try {
      const res = await authedPatch<SettingsResponse>('/api/settings', patch)
      setPublicCourses(res.data.publicCourses)
      setPublicChristian(res.data.publicChristianCourses)
      // R-#256 §3.6b: apagar el interruptor o dejar de publicar cursos también
      // borra del dispositivo las copias descargadas de cursos cristianos y de
      // pago, para que un teléfono compartido no revele la afiliación.
      if (patch.mostrarCursosCristianosPublico === false || patch.mostrarCursosPublico === false) {
        await clearPrivateCourseCopies().catch(() => {})
      }
      toast({ title: t('saved') })
      return true
    } catch {
      setPublicCourses(previous.publicCourses)
      setPublicChristian(previous.publicChristian)
      toast({ title: t('saveFailed'), variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }, [authedPatch, publicCourses, publicChristian, t, toast])

  const mintMissing = useCallback(async () => {
    setMinting(true)
    try {
      const res = await authedPost<{ minted: unknown[] }>('/api/credentials/mint-missing')
      toast({ title: `${t('mintDone')}: ${res.data.minted?.length ?? 0}` })
      await load()
    } catch {
      toast({ title: t('saveFailed'), variant: 'destructive' })
    } finally {
      setMinting(false)
    }
  }, [authedPost, load, t, toast])

  const revoke = useCallback(async (tokenId: number) => {
    setRevoking(tokenId)
    try {
      await authedPost('/api/credentials/revoke', { tokenId })
      toast({ title: t('revokeDone') })
      await load()
    } catch {
      toast({ title: t('revokeFailed'), variant: 'destructive' })
    } finally {
      setRevoking(null)
    }
  }, [authedPost, load, t, toast])

  if (!ready || loading) {
    return (
      <div className="container mx-auto px-4 py-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="container mx-auto px-4 py-10 text-gray-600">
        {t('loadFailed')}
      </div>
    )
  }

  const activeCredentials = credentials.filter((c) => !c.revokedAt)
  const revokedCredentials = credentials.filter((c) => c.revokedAt)

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-green-600" />
        {t('title')}
      </h1>
      <p className="text-sm text-gray-600 mb-6">{t('intro')}</p>

      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium text-gray-800">{t('publicCoursesTitle')}</div>
            <p className="text-sm text-gray-600 mt-1">{t('publicCoursesHelp')}</p>
          </div>
          <Switch
            checked={publicCourses}
            disabled={saving}
            onCheckedChange={(checked) => save({ mostrarCursosPublico: checked })}
            aria-label={t('publicCoursesTitle')}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium text-gray-800">{t('christianTitle')}</div>
            <p className="text-sm text-gray-600 mt-1">{t('christianHelp')}</p>
          </div>
          <Switch
            checked={publicChristian}
            disabled={saving || !publicCourses}
            onCheckedChange={(checked) => save({ mostrarCursosCristianosPublico: checked })}
            aria-label={t('christianTitle')}
          />
        </div>

        {publicChristian && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-medium flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4" />
              {t('warningTitle')}
            </div>
            <p>{t('warning')}</p>
          </div>
        )}

        {publicChristian && (
          <div className="rounded-md border border-gray-200 p-4">
            <div className="font-medium text-gray-800">{t('mintTitle')}</div>
            <p className="text-sm text-gray-600 mt-1 mb-3">{t('mintHelp')}</p>
            <Button onClick={mintMissing} disabled={minting}>
              {minting ? t('processing') : t('mintButton')}
            </Button>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
          <Award className="h-5 w-5 text-gray-500" />
          {t('credentialsTitle')}
        </h2>
        <p className="text-sm text-gray-600 mt-1 mb-4">{t('credentialsHelp')}</p>

        {activeCredentials.length === 0 && revokedCredentials.length === 0 && (
          <p className="text-sm text-gray-500">{t('noCredentials')}</p>
        )}

        <ul className="divide-y divide-gray-100">
          {[...activeCredentials, ...revokedCredentials].map((c) => (
            <li key={c.tokenId} className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-gray-800">
                  {c.courseName || `#${c.courseId}`}
                  {c.isPremium && (
                    <span className="ml-2 text-xs text-gray-500">{t('premium')}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(c.earnedAt).toLocaleDateString(lang === 'es' ? 'es' : 'en')}
                </div>
              </div>
              {c.revokedAt ? (
                <span className="text-xs text-gray-400">{t('revoked')}</span>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={revoking === c.tokenId}>
                      {revoking === c.tokenId ? t('processing') : t('revoke')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('revokeTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('revokeDesc')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{lang === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => revoke(c.tokenId)}>
                        {t('revokeConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
