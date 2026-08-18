'use client'

import axios from 'axios'
import type { AxiosResponse, AxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { use, useEffect, useState, useMemo, useRef } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { getUniversalLink } from '@selfxyz/core'
import { SelfAppBuilder } from '@selfxyz/qrcode'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

import { Button } from '@/components/ui/button'
import CircularProgress from '@/components/ui/circular-progress'
import { QRCodeDialog } from '@/components/ui/qr-code-dialog'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import DeleteVerifiedDataDialog from '@/components/DeleteVerifiedDataDialog'
import { VerificationScheduler } from '@/components/VerificationScheduler'
import { IS_PRODUCTION } from '@/lib/config'
import { logger, DebugConsole } from '@pasosdejesus/m/debug'
import { CountrySelect, ReligionSelect, ChurchRoleSelect } from '@/components/shared/FormSelects'
import { TownAutocomplete } from '@/components/shared/TownAutocomplete'




interface UserProfile {
  church_relationship: string | null
  country: number | null
  email: string
  groups: string
  id: string
  id_photo_front: string | null
  id_photo_back: string | null
  language: string
  lastgooddollarverification: number | null
  name: string
  passport_name: string
  passport_nationality: number | null
  phone: string
  picture: string
  place_of_worship_location: string | null
  position_israel_gaza: string | null
  registration: string | null
  registration_photo: string | null
  denomination: string | null
  profilescore: number | null
  proposed_date_of_interview: string | null
  department_timezone: string | null
  country_timezone?: string | null
  religion: number
  telegram: string
  uname: string
  userId: string
  whatsapp: string
}

interface Religion {
  id: number
  nombre: string
  name_english: string | null
}

interface Country {
  id: number
  nombre: string
  nombreiso_ingles?: string | null
  indicativo?: string | null
}

type PageProps = {
  params: Promise<{
    lang: string
  }>
}

export default function ProfileForm({ params }: PageProps) {
  // Forzar habilitación de DebugConsole si env var está activa
  // (Logger singleton omite la verificación durante SSR)
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_M_DEBUGGER_CONSOLE === '1') {
      (logger as any).floatingConsoleEnabled = true
    }
  }
  const [showBanner, setShowBanner] = useState(true)
  const [profile, setProfile] = useState<UserProfile>({
    church_relationship: null,
    country: null,
    email: '',
    groups: '',
    id: '',
    id_photo_front: null,
    id_photo_back: null,
    language: '',
    lastgooddollarverification: null,
    name: '',
    passport_name: '',
    passport_nationality: null,
    phone: '',
    picture: '',
    place_of_worship_location: null,
    position_israel_gaza: null,
    registration: null,
    registration_photo: null,
    denomination: null,
    profilescore: null,
    proposed_date_of_interview: null,
    department_timezone: null,
    religion: 1,
    telegram: '',
    uname: '',
    userId: '',
    whatsapp: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set())
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set())
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [updateProfile, setUpdateProfile] = useState(false)
  const [religions, setReligions] = useState<Religion[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [selfApp, setSelfApp] = useState<any | null>(null)
  const [deeplink, setDeeplink] = useState('')
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const [townSuggestions, setTownSuggestions] = useState<{ id: number; town: string; municipio: string; departamento: string }[]>([])
  const [townSearchTimer, setTownSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [churches, setChurches] = useState<{ id: number; name: string; city_name: string | null }[]>([])
  const [selectedChurchId, setSelectedChurchId] = useState<number | null>(null)
  const [selectedChurchName, setSelectedChurchName] = useState('')
  const [pastorName, setPastorName] = useState('')
  const [pastorWhatsApp, setPastorWhatsApp] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState<'front' | 'back' | 'registration' | null>(null)
  const [updatingScores, setUpdatingScores] = useState(false)
  const [cityId, setCityId] = useState<number | null>(null)
  const [placeOfWorshipLocation, setPlaceOfWorshipLocation] = useState('')
  const [placeOfWorshipName, setPlaceOfWorshipName] = useState('')
  const [cityDisplayName, setCityDisplayName] = useState('')

  const { address } = useAuthAddress()
  const { data: session, status: sessionStatus } = useSession()
  const { toast } = useToast()

  const parameters = use(params)
  const { lang } = parameters

  const t = useMemo(() => createComponentT(lang, {
    en: { editProfile: 'Edit Profile', profileScore: 'Profile Score', displayName: 'Display Name', religion: 'Religion', selectReligion: 'Select your religion', churchRelationship: 'Church Relationship', selectChurchRelationship: 'Select your role', churchRelationshipPastor: 'Pastor', churchRelationshipLeader: 'Leader/Elder', churchRelationshipMember: 'Member', placeOfWorshipAddress: 'Address of your place of worship', searchPlace: 'Type to search place...', placeOfWorshipName: 'Name of your place of worship', placeOfWorshipNamePlaceholder: 'Name or church', contactNotice: 'We may occasionally send announcements about the platform to your email, WhatsApp, or Telegram. If you prefer not to receive them, do not provide that information.', countryVerified: 'Country (Verified:', selectCountry: 'Select your country', uniquenessGoodDollar: 'Uniqueness with GoodDollar (Verified:', saving: 'Saving', saveChanges: 'Save Changes', verifySelf: 'Verify with self', updateScores: 'Update scores', deleteVerifiedData: 'Delete Verified Data',
      viewCredentials: 'View my public credentials',
      saveFailed: 'Failed to save profile.',
      emailInUse: 'This email is already in use. Please use a different one.',
      expiredSession: '\n\nThis may be due to an expired session. Please try disconnecting and reconnecting your wallet.',
      connectionIssue: '\n\nPlease check your internet connection and try again.',
      errorLabel: 'Error: ', scoreRequired: '50+ required for scholarships', fullNameVerified: 'Full Name ( Verified:', updateInfo: 'Update your profile information below',
      verificationWarning: 'To maintain your verification and profile score, keep the information already verified as you provided during verification',
      displayNamePrivacy: 'Do not use your real name, surname, specific location, or any personally identifying information.' },
    es: { editProfile: 'Edición del Perfil', profileScore: 'Puntaje de Perfil', displayName: 'Nombre por presentar', religion: 'Religión', selectReligion: 'Elige tu religión', churchRelationship: 'Relación con la Iglesia', selectChurchRelationship: 'Selecciona tu rol', churchRelationshipPastor: 'Pastor', churchRelationshipLeader: 'Líder/Anciano', churchRelationshipMember: 'Miembro', placeOfWorshipAddress: 'Dirección de tu lugar de culto', searchPlace: 'Escribe para buscar lugar...', placeOfWorshipName: 'Nombre de tu lugar de culto', placeOfWorshipNamePlaceholder: 'Nombre o iglesia', contactNotice: 'Ocasionalmente enviaremos anuncios sobre la plataforma a tu correo, WhatsApp o Telegram. Si no deseas recibirlos, no suministres esa información.', countryVerified: 'País (Verificado:', selectCountry: 'Selecciona tu país', uniquenessGoodDollar: 'Unicidad con GoodDollar ( Verificada:', saving: 'Guardando', saveChanges: 'Guardar Cambios', verifySelf: 'Verificar con self', updateScores: 'Actualizar puntajes', deleteVerifiedData: 'Eliminar Datos Verificados',
      viewCredentials: 'Ver mis credenciales públicas',
      saveFailed: 'Fallo al guardar el perfil.',
      emailInUse: 'Este correo ya está en uso. Usa uno diferente.',
      expiredSession: '\n\nPuede deberse a que la sesi\u00f3n ha expirado. Por favor, intenta desconectar y reconectar tu billetera.',
      connectionIssue: '\n\nPor favor, revisa tu conexi\u00f3n a internet e int\u00e9ntalo de nuevo.',
      errorLabel: 'Error: ', scoreRequired: 'Requiere 50+ para becas', fullNameVerified: 'Nombre completo ( Verificado:', updateInfo: 'Actualiza la informacion de tu perfil a continuacion',
      verificationWarning: 'Para mantener tu verificación y puntaje de perfil, conserva la información ya verificada como la suministraste durante la verificación',
      displayNamePrivacy: 'No uses tu nombre real, apellido, ubicación específica ni información que te identifique personalmente.' },
  }), [lang])

  const isSavingField = (f: string) => savingFields.has(f)
  const isSavedField = (f: string) => savedFields.has(f)

  const FieldIndicator = ({ field }: { field: string }) => {
    if (isSavingField(field)) return <span className="ml-1 text-xs text-gray-400 animate-pulse">...</span>
    if (isSavedField(field)) return <span className="ml-1 text-xs text-green-500">{lang === 'es' ? 'guardado' : 'saved'}</span>
    return null
  }

  const handleUpdateScores = async () => {
    if (!session || !address || !session.address || session.address.toLowerCase() !== address.toLowerCase()) {
      toast({ title: 'Problem with session, disconnect and connect again', variant: 'destructive' })
      return
    }
    setUpdatingScores(true)
    try {
      const csrfToken = localStorage.getItem("learn.tg.authToken") || await getCsrfToken()
      const res = await fetch('/api/update-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, walletAddress: address, token: csrfToken }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setProfile((prev) => ({ ...prev, profilescore: data.profilescore ?? prev.profilescore }))
      toast({ title: `${lang === 'es' ? 'Puntaje actualizado' : 'Score updated'}: ${data.profilescore ?? '0'}` })
    } catch {
      toast({ title: lang === 'es' ? 'Error al actualizar puntaje' : 'Failed to update scores', variant: 'destructive' })
    } finally {
      setUpdatingScores(false)
    }
  }

  const handleSuccessfulSelfVerification = () => {
    logger.info('Self verification successful - calling onSuccess callback', 'SelfVerify')
    logger.info('Previous selfApp state: ' + !!selfApp, 'SelfVerify')
    // Persist the attestation / session result to your backend, then gate content
    setSelfApp(null)
    setShowQRDialog(false)
    setUpdateProfile(true)
    toast({ title: 'Verified, information stored' })
  }

  const handleSelfVerify = () => {
    const userId = session!.address
    logger.info('handleSelfVerify called', 'SelfVerify')
    logger.info('endpoint: ' + (process.env.NEXT_PUBLIC_SELF_ENDPOINT || 'none'), 'SelfVerify')
    logger.info('userId: ' + userId, 'SelfVerify')
    logger.info('isProduction: ' + IS_PRODUCTION, 'SelfVerify')
    logger.info('User-Agent: ' + navigator.userAgent, 'SelfVerify')
    logger.info('Android: ' + (/Android\s([\d.]+)/.test(navigator.userAgent) ? navigator.userAgent.match(/Android\s([\d.]+)/)![1] : 'N/A'), 'SelfVerify')
    logger.info('Browser: ' + (navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg|OPR|Brave)\/([\d.]+)/)?.[0] || 'N/A'), 'SelfVerify')
    const walletName = ['okx', 'onekey', 'metamask', 'trust wallet', 'brave'].find(w => navigator.userAgent.toLowerCase().includes(w))
      || ((window as any).ethereum?.isOneKey === true ? 'oneKey(eth)' : '')
      || ((window as any).ethereum?.isMiniPay === true ? 'miniPay' : '')
      || ((window as any).ethereum?.isMetaMask === true ? 'metamask(eth)' : '')
      || ((window as any).ethereum?.isOkxWallet === true ? 'okx(eth)' : '')
      || 'unknown'
    logger.info('Wallet: ' + walletName, 'SelfVerify')
    try {
      const app = new SelfAppBuilder({
        version: 2,
        appName: 'Learn Through Games',
        scope: 'learn.tg',
        devMode: !IS_PRODUCTION,
        endpoint: `${process.env.NEXT_PUBLIC_SELF_ENDPOINT}` || 'none',
        logoBase64: 'https://i.postimg.cc/mrmVf9hm/self.png',
        userId,
        endpointType: IS_PRODUCTION ? 'https' : 'staging_https',
        userIdType: 'hex',
        userDefinedData:
          'Information to verify your humanity on Learn Through Games. Continuing means you accept the privacy policy available at https://learn.tg/en/privacy-policy',
        disclosures: {
          excludedCountries: [],
          ofac: false,
          name: true,
          nationality: true,
        },
      }).build()
      logger.info('SelfApp built successfully', 'SelfVerify')
      logger.info('deeplink: ' + getUniversalLink(app), 'SelfVerify')
      setSelfApp(app)
      setDeeplink(getUniversalLink(app))
      setShowQRDialog(true)
    } catch (error) {
      logger.error('Error building SelfApp: ' + String(error), 'SelfVerify')
      logger.error('Stack: ' + (error instanceof Error ? error.stack : ''), 'SelfVerify')
      toast({ title: 'Error setting up Self verification: ' + String(error), variant: 'destructive' })
    }
  }

  const handleMobileVerify = async () => {
    if (selfApp) {
      try {
        window.open(deeplink, '_blank')
      } catch (error) {
        logger.error('Error opening Self app: ' + String(error), 'Profile')
        const message =
          t('selfError')
        toast({ title: message, variant: 'destructive' })
        throw error // Re-throw to be caught by dialog error handler
      }
    }
  }

  const handleQRDialogError = (error: string) => {
    logger.error('QR Dialog error: ' + error, 'SelfVerify')
    logger.error('Dialog open state: ' + showQRDialog, 'SelfVerify')
    const prefix = t('errorLabel')
    toast({ title: `${prefix}${error}`, variant: 'destructive' })
  }

  // Fetch user data from API
  useEffect(() => {
    const fetchProfile = async () => {
      let url = ''
      try {
        let response = await fetch('/api/countries')
        if (!response.ok) {
          throw new Error(`Response status in countries: ${response.status}`)
        }
        let data = await response.json()
        setCountries(data)

        response = await fetch('/api/religions')
        if (!response.ok) {
          throw new Error(`Response status in religions: ${response.status}`)
        }
        data = await response.json()
        setReligions(data)

        const csrfToken = localStorage.getItem("learn.tg.authToken") || await getCsrfToken()
        url = `/api/profile?walletAddress=${session!.address || ''}&token=${csrfToken}`
        logger.info('OJO url=' + url, 'Profile')

        response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`)
        }
        const rUser = await response.json()
        logger.info('rUser=' + JSON.stringify(rUser), 'Profile')
        const locProfile: UserProfile = {
          church_relationship: rUser.church_relationship || null,
          country: rUser.pais_id,
          email: rUser.email,
          groups: '',
          id: '',
          language: '',
          lastgooddollarverification: rUser.lastgooddollarverification,
          name: rUser.nombre,
          passport_name: rUser.passport_name,
          passport_nationality: rUser.passport_nationality,
          phone: '',
          picture: rUser.foto_file_name,
          place_of_worship_location: rUser.place_of_worship_location || null,
          position_israel_gaza: rUser.position_israel_gaza || null,
          registration: rUser.registration || null,
          registration_photo: rUser.registration_photo || null,
          denomination: rUser.denomination || null,
          profilescore: rUser.profilescore,
          proposed_date_of_interview: rUser.proposed_date_of_interview || null,
          department_timezone: rUser.department_timezone || null,
          country_timezone: rUser.country_timezone || null,
          religion: rUser.religion_id,
          id_photo_front: rUser.id_photo_front || null,
          id_photo_back: rUser.id_photo_back || null,
          telegram: rUser.telegram || '',
          uname: rUser.nusuario,
          userId: rUser.id,
          whatsapp: rUser.whatsapp || '',
        }
        logger.info('locProfile=' + JSON.stringify(locProfile), 'Profile')
        setProfile(locProfile)
        if (rUser.church_id) setSelectedChurchId(rUser.church_id)
        if (rUser.city_id != null) {
          setCityId(rUser.city_id)
          if (rUser.city_name) {
            setCityDisplayName(rUser.city_name)
            setCitySearch(rUser.city_name)
          }
        }
        if (rUser.place_of_worship_location) {
          setPlaceOfWorshipLocation(rUser.place_of_worship_location)
          if (!rUser.city_name) setCitySearch(rUser.place_of_worship_location)
        }
        if (rUser.place_of_worship && !rUser.church_id) setPlaceOfWorshipName(rUser.place_of_worship)
        if (rUser.pastor_name) setPastorName(rUser.pastor_name)
        if (rUser.pastor_whatsapp) setPastorWhatsApp(rUser.pastor_whatsapp)

        // Fetch saved church name from profile API response
        if (rUser.church_id && rUser.church_name) {
          setSelectedChurchName(rUser.church_name)
        }
      } catch (error) {
        logger.error('Profile fetch error details: ' + JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof TypeError ? 'TypeError (likely network/fetch)' : 'Other',
          url,
          sessionAddress: session?.address,
          walletAddress: address,
          isOKX: navigator.userAgent.includes('OKX')
        }), 'Profile')

        let errorMessage = 'Failed to load profile data: '
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          errorMessage += 'Cannot connect to server. Please check your internet connection and ensure the backend is running.'
        } else if (error instanceof SyntaxError) {
          errorMessage += 'Invalid response from server (likely JSON parsing error). This may be a token mismatch - try disconnecting and reconnecting your wallet.'
        } else {
          errorMessage += error instanceof Error ? error.message : String(error)
        }
        errorMessage += '\n\nIf error persists, try disconnecting your wallet and connecting again.'

        toast({ title: errorMessage, variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }

    if (address && session && session.address && address.toLowerCase() === session.address.toLowerCase()) {
      fetchProfile()
    } else {
      setLoading(false)
    }
    setUpdateProfile(false)
  }, [address, session, updateProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    logger.info('=== PROFILE SAVE DEBUG ===', 'Profile')
    logger.info('1. Session address: ' + session?.address, 'Profile')
    logger.info('2. Wallet address: ' + address, 'Profile')
    logger.info('3. Are they equal? ' + (session?.address === address), 'Profile')
    logger.info('4. User Agent: ' + navigator.userAgent, 'Profile')
    logger.info('5. Is OKX Browser? ' + navigator.userAgent.includes('OKX'), 'Profile')

    const csrfToken = localStorage.getItem("learn.tg.authToken") || await getCsrfToken()
    logger.info('6. CSRF Token length: ' + csrfToken?.length, 'Profile')

    try {
      const reg = {
        nombre: profile.name,
        email: profile.email,
        nusuario: profile.uname,
        religion_id: profile.religion,
        pais_id: profile.country,
        church_relationship: profile.church_relationship,
        whatsapp: profile.whatsapp,
        telegram: profile.telegram,
        place_of_worship: selectedChurchId ? churches.find(c => c.id === selectedChurchId)?.name || '' : placeOfWorshipName || null,
        place_of_worship_location: cityId ? placeOfWorshipLocation : (citySearch || placeOfWorshipLocation),
        church_id: selectedChurchId || null,
        city_id: cityId,
        pastor_name: pastorName || null,
        pastor_whatsapp: pastorWhatsApp || null,
        position_israel_gaza: profile.position_israel_gaza || null,
        registration: profile.registration || null,
        registration_photo: profile.registration_photo || null,
        denomination: profile.denomination || null,
      }
      const url = `/api/profile?walletAddress=${session!.address}&token=${csrfToken}`
      logger.info(`Patching ${url}`, 'Profile')

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reg),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let serverError = response.statusText
        try {
          const parsed = JSON.parse(errorText)
          if (parsed.error) serverError = parsed.error
        } catch { /* not JSON */ }
        logger.error('Profile save failed: ' + JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500),
          url: url,
          is_okx: navigator.userAgent.includes('OKX'),
        }), 'Profile')
        const err = new Error(`[${response.status}] ${serverError}`)
        ;(err as any).status = response.status
        ;(err as any).serverError = serverError
        throw err
      }



      let responseData = null
      try {
        responseData = await response.json()
      } catch (e) {
        responseData = await response.text()
      }
      logger.info('Profile save successful: ' + JSON.stringify({
        status: response.status,
        url: url,
        is_okx: navigator.userAgent.includes('OKX'),
        response: typeof responseData === 'string' ? responseData.substring(0, 200) : responseData,
      }), 'Profile')
      toast({ title: lang === 'es' ? 'Perfil actualizado' : 'Profile updated' })
      // Recalculate profile score after save
      try {
        const csrfToken2 = await getCsrfToken()
        const scoresRes = await fetch('/api/update-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, walletAddress: address, token: csrfToken2 }),
        })
        if (scoresRes.ok) {
          const scoresData = await scoresRes.json()
          if (scoresData.profilescore != null) {
            setProfile((prev) => ({ ...prev, profilescore: scoresData.profilescore }))
          }
        }
      } catch { /* non-blocking */ }
    } catch (error) {
      logger.error('Profile save error: ' + String(error), 'Profile')
      const status = (error as any)?.status
      const serverError = (error as any)?.serverError || ''
      let alertMessage =
        t('saveFailed')

      if (status === 409 && serverError === 'Email already in use') {
        alertMessage = t('emailInUse')
      } else if (error instanceof Error) {
        alertMessage += `\n\n${t('details')}: ${
          error.message
        }.`

        if (error.message.includes('401')) {
          alertMessage +=
            t('expiredSession')
        } else if (
          error instanceof TypeError &&
          error.message.toLowerCase().includes('failed to fetch')
        ) {
          alertMessage +=
            t('connectionIssue')
        }
      }
      toast({ title: lang === 'es' ? 'Error al guardar' : 'Save failed', description: alertMessage, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Handle input changes with auto-save
  const handleChange = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: field === 'religion' || field === 'country' ? Number(value) : value,
    }))
    // Auto-save with debounce: 800ms for text, immediate for selects
    const isSelect = field === 'religion' || field === 'country' || field === 'church_relationship' || field === 'position_israel_gaza'
    const delay = isSelect ? 0 : 800

    // When country changes, clear location-dependent fields
    if (field === 'country') {
      setCityId(null)
      setCitySearch('')
      setCityDisplayName('')
      setPlaceOfWorshipLocation('')
      setPlaceOfWorshipName('')
      setSelectedChurchId(null)
      setSelectedChurchName('')
      setChurches([])
      // Send nulls for all location fields to trigger backend validation
      autoSaveField('country', value, delay)
      autoSaveField('city_id', '', 0)
      autoSaveField('place_of_worship', '', 0)
      autoSaveField('place_of_worship_location', '', 0)
      autoSaveField('church_id', '', 0)
      // Refresh full profile to get new timezone data
      setTimeout(() => setUpdateProfile(true), 500)
      return
    }

    autoSaveField(field, value, delay)
  }

  // Auto-save a single field to the API
  const autoSaveField = async (field: string, value: string, delay: number) => {
    // Clear existing timer for this field
    const existing = saveTimers.current.get(field)
    if (existing) clearTimeout(existing)

    const doSave = async () => {
      if (!session?.address || !address) return
      const apiField = mapFieldToApi(field)
      if (!apiField) return

      setSavingFields(prev => new Set(prev).add(field))
      try {
        const csrfToken = localStorage.getItem('learn.tg.authToken') || await getCsrfToken()
        const apiValue = field === 'religion' || field === 'country' ? Number(value) : value
        const url = `/api/profile?walletAddress=${session.address}&token=${csrfToken}`
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [apiField]: apiValue === '' || apiValue === undefined ? null : apiValue }),
        })
        if (res.ok) {
          setSavedFields(prev => new Set(prev).add(field))
          setTimeout(() => setSavedFields(prev => {
            const next = new Set(prev)
            next.delete(field)
            return next
          }), 2000)
          try {
            const data = await res.json()
            if (data.profilescore != null) {
              setProfile(prev => ({ ...prev, profilescore: data.profilescore }))
            }
          } catch {}
        } else {
          // Duplicate email (unique index) — show a friendly toast
          if (res.status === 409) {
            let msg = ''
            try {
              const errData = await res.json()
              if (errData.error === 'Email already in use') msg = t('emailInUse')
            } catch { /* ignore */ }
            toast({ title: lang === 'es' ? 'Error al guardar' : 'Save failed', description: msg || t('saveFailed'), variant: 'destructive' })
          } else if (res.status !== 401 && res.status !== 403) {
            console.error(`[autoSave] Failed to save ${field}: ${res.status}`)
          }
        }
      } catch (e) {
        console.error(`[autoSave] Error saving ${field}:`, (e as any)?.message || String(e))
      }
      finally {
        setSavingFields(prev => {
          const next = new Set(prev)
          next.delete(field)
          return next
        })
      }
    }

    if (delay === 0) {
      doSave()
    } else {
      saveTimers.current.set(field, setTimeout(doSave, delay))
    }
  }

  // Map UI field names to API field names
  const mapFieldToApi = (field: string): string | null => {
    const mapping: Record<string, string> = {
      name: 'nombre', uname: 'nusuario', email: 'email',
      whatsapp: 'whatsapp', telegram: 'telegram',
      religion: 'religion_id', country: 'pais_id',
      church_relationship: 'church_relationship',
      position_israel_gaza: 'position_israel_gaza',
      registration: 'registration',
      registration_photo: 'registration_photo',
      denomination: 'denomination',
      city_id: 'city_id',
      place_of_worship: 'place_of_worship',
      place_of_worship_location: 'place_of_worship_location',
      church_id: 'church_id',
    }
    return mapping[field] || null
  }

  // Town autocomplete search
  const handleTownSearch = (query: string) => {
    setCitySearch(query)
    if (townSearchTimer) clearTimeout(townSearchTimer)
    if (query.length < 2 || !profile.country) {
      setTownSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/towns/search?country=${profile.country}&q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setTownSuggestions(data || [])
      } catch { setTownSuggestions([]) }
    }, 300)
    setTownSearchTimer(timer)
  }

  // Select a town from autocomplete
  const handleSelectTown = (town: { id: number; town: string; municipio: string; departamento: string }) => {
    setCityId(town.id)
    setCitySearch(town.town)
    setPlaceOfWorshipLocation(town.town)
    setCityDisplayName(town.town)
    setTownSuggestions([])
    setSelectedChurchId(null)
    // Fetch churches for this town
    if (profile.country) {
      fetch(`/api/churches/search?q=&country=${profile.country}&cityId=${town.id}`)
        .then(r => r.json())
        .then(data => setChurches(data.churches || []))
        .catch(() => {})
    }
  }

  // Free-text town (no match selected)
  const handleTownFreeText = (text: string) => {
    setCityId(null)
    setCitySearch(text)
    setPlaceOfWorshipLocation(text)
    setCityDisplayName('')
    setTownSuggestions([])
    setSelectedChurchId(null)
    setChurches([])
  }

  const placeOfWorshipLabels = (religionId: number | null): { name: string; address: string } => {
    const isEs = lang === 'es'
    switch (religionId) {
      case 2: return { name: isEs ? 'Iglesia' : 'Church', address: isEs ? 'Población de la iglesia' : 'Town of church' }
      case 3: return { name: isEs ? 'Mezquita' : 'Mosque', address: isEs ? 'Población de la mezquita' : 'Town of mosque' }
      case 6: return { name: isEs ? 'Sinagoga' : 'Synagogue', address: isEs ? 'Población de la sinagoga' : 'Town of synagogue' }
      case 4:
      case 5: return { name: isEs ? 'Templo' : 'Temple', address: isEs ? 'Población del templo' : 'Town of temple' }
      default: return { name: isEs ? 'Lugar de culto' : 'Place of worship', address: isEs ? 'Población del lugar de culto' : 'Town of place of worship' }
    }
  }

  const photoFieldForSide = (side: string) =>
    side === 'front' ? 'id_photo_front' : side === 'back' ? 'id_photo_back' : 'registration_photo'

  const handlePhotoUpload = async (side: 'front' | 'back' | 'registration', file: File) => {
    setUploadingPhoto(side)
    logger.info('handlePhotoUpload start', 'Profile')
    logger.info('side=' + side + ' fileSize=' + file.size + ' fileName=' + file.name, 'Profile')
    logger.info('address=' + (address || '') + ' sessionAddress=' + (session?.address || ''), 'Profile')
    try {
      const csrfToken = localStorage.getItem("learn.tg.authToken") || await getCsrfToken()
      logger.info('csrfToken present=' + !!csrfToken + ' len=' + (csrfToken?.length || 0), 'Profile')
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('side', side)
      formData.append('walletAddress', address || '')
      formData.append('token', csrfToken || '')
      logger.info('POST /api/user/id-photo', 'Profile')
      const res = await fetch('/api/user/id-photo', { method: 'POST', body: formData })
      logger.info('POST /api/user/id-photo res.status=' + res.status, 'Profile')
      if (!res.ok) {
        const err = await res.json()
        logger.error('Upload failed status=' + res.status + ' err=' + JSON.stringify(err), 'Profile')
        throw new Error(err.error || 'Upload failed')
      }
      const data = await res.json()
      logger.info('Upload ok path=' + data.path, 'Profile')
      setProfile((prev) => ({ ...prev, [photoFieldForSide(side)]: data.path }))
    } catch (e: any) {
      logger.error('handlePhotoUpload catch message=' + (e?.message || '') + ' name=' + (e?.name || '') + ' cause=' + JSON.stringify(e?.cause || null), 'Profile')
      logger.error('handlePhotoUpload stack=' + (e?.stack || ''), 'Profile')
      toast({ title: e?.message || (lang === 'es' ? 'Error al subir foto' : 'Photo upload failed'), variant: 'destructive' })
    } finally {
      setUploadingPhoto(null)
    }
  }

  const handlePhotoDelete = async (side: 'front' | 'back' | 'registration') => {
    try {
      const csrfToken = localStorage.getItem("learn.tg.authToken") || await getCsrfToken()
      const res = await fetch('/api/user/id-photo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, token: csrfToken, side }),
      })
      if (!res.ok) throw new Error('Delete failed')
      setProfile((prev) => ({ ...prev, [photoFieldForSide(side)]: null }))
    } catch {
      toast({ title: lang === 'es' ? 'Error al eliminar foto' : 'Photo delete failed', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading profile...</span>
      </div>
    )
  }

  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading session...</span>
      </div>
    )
  }

  if (!(address && session && session.address && address.toLowerCase() === session.address.toLowerCase())) {
    console.log('[profile] PARTIAL LOGIN — session:', !!session, 'address:', !!address, 'session.addr:', session?.address?.slice(0,10), 'wagmi.addr:', address?.slice(0,10), 'NEXTAUTH_URL:', process.env.NEXT_PUBLIC_AUTH_URL)
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  return (
    <div className="mt-12 max-w-2xl mx-auto p-6">
      <style>{`
        div.fixed.bottom-4.right-4.z-50 {
          background: rgb(0,0,0) !important;
        }
        div.fixed.bottom-4.right-4.z-50 > div:first-child {
          background: rgb(31,41,55) !important;
        }
      `}</style>
      <DebugConsole />
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {t('editProfile')}
          </h2>
          <p className="text-gray-600 mt-1">
            {t('updateInfo')}
          </p>
        </div>
        <div className="p-6">
          <div className="flex justify-around items-center mb-8">
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {t('profileScore')}
              </h3>
              <CircularProgress progress={profile.profilescore || 0} />
              <p className="text-sm text-gray-500 mt-2">
                {t('scoreRequired')}
              </p>
            </div>
          </div>

          {profile.userId && (
          <div className="flex justify-center mb-8">
            <Button asChild variant="outline">
              <Link href={`/${lang}/user/${profile.userId}`}>
                {t('viewCredentials')}
              </Link>
            </Button>
          </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
              {t('verificationWarning')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="uname"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('displayName')}
                  <FieldIndicator field="uname" />
                </label>
                <input
                  id="uname"
                  type="text"
                  value={profile.uname}
                  onChange={(e) => handleChange('uname', e.target.value)}
                  placeholder={lang === 'es' ? 'Nombre por presentar' : 'Display name'}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-amber-700 mt-1">{t('displayNamePrivacy')}</p>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('fullNameVerified')}
                  <FieldIndicator field="name" />
                  {profile.name != '' && profile.name == profile.passport_name
                    ? '✅'
                    : '❌'}{' '}
                  {')'}
                </label>
                <input
                  id="name"
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email
                  <FieldIndicator field="email" />
                </label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label
                  htmlFor="country"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('countryVerified')}
                  {profile.country != null &&
                  profile.country == profile.passport_nationality
                    ? '✅'
                    : '❌'}{' '}
                </label>
                <CountrySelect value={profile.country} onChange={(v) => handleChange('country', String(v || ''))} lang={lang} />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="religion"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('religion')}
                </label>
                <ReligionSelect value={profile.religion} onChange={(v) => handleChange('religion', String(v || ''))} lang={lang} />
              </div>
            </div>

            {profile.religion === 2 && (
            <div className="space-y-2 mt-4">
              <label className="block text-sm font-medium text-gray-700">
                {lang === 'es' ? 'Posición sobre Israel y Gaza' : 'Position on Israel and Gaza'}
              </label>
              <p className="text-xs text-gray-600">
                {lang === 'es'
                  ? 'Teniendo en cuenta que la CIJ ha señalado un "riesgo plausible de genocidio" en Gaza, la CPI ha emitido órdenes de arresto por crímenes de guerra, y la Comisión Independiente de Investigación de la ONU ha concluido que Israel ha cometido actos de genocidio en Gaza (incluyendo el ataque deliberado a niños), ¿respaldas incondicionalmente al Estado Moderno de Israel?'
                  : 'Considering the ICJ has found a "plausible risk of genocide" in Gaza, the ICC has issued arrest warrants for war crimes, and the UN Independent Commission of Inquiry has concluded that Israel has committed acts of genocide in Gaza (including deliberate targeting of children), do you unconditionally support the Modern State of Israel?'}
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="position_israel_gaza" checked={profile.position_israel_gaza === 'yes'}
                    onChange={() => handleChange('position_israel_gaza', 'yes')} className="rounded" />
                  {lang === 'es' ? 'Sí' : 'Yes'}
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="position_israel_gaza" checked={profile.position_israel_gaza === 'no'}
                    onChange={() => handleChange('position_israel_gaza', 'no')} className="rounded" />
                  No
                </label>
              </div>
            </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="whatsapp"
                  className="block text-sm font-medium text-gray-700"
                >
                  WhatsApp
                  <FieldIndicator field="whatsapp" />
                </label>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-500 text-sm">
                    {countries.find(c => c.id === profile.country)?.indicativo || '+232'}
                  </span>
                  <input
                    id="whatsapp"
                    type="text"
                    value={profile.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-r-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="telegram"
                  className="block text-sm font-medium text-gray-700"
                >
                  Telegram
                  <FieldIndicator field="telegram" />
                </label>
                <input
                  id="telegram"
                  type="text"
                  value={profile.telegram}
                  onChange={(e) => handleChange('telegram', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="lastgooddollarverification"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('uniquenessGoodDollar')}
                  {profile.lastgooddollarverification != null ? '✅' : '❌'}{' '}
                  {')'}
                </label>
              </div>
            </div>

            <p className="text-xs text-gray-500 italic mt-1">
              {t('contactNotice')}
            </p>

            {profile.country === 694 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {lang === 'es' ? 'Foto frontal de documento de identidad' : 'ID Photo — Front'}
                </label>
                {profile.id_photo_front ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600">✅ {lang === 'es' ? 'Subida' : 'Uploaded'}</span>
                    <button type="button" onClick={() => {
                      const csrf = localStorage.getItem('learn.tg.authToken') || ''
                      window.open(`/api/user/id-photo/${profile.userId}?side=front&walletAddress=${session?.address}&token=${csrf}`, '_blank')
                    }} className="text-xs text-blue-600 hover:underline">
                      {lang === 'es' ? 'Ver' : 'View'}
                    </button>
                    <button type="button" onClick={() => handlePhotoDelete('front')} className="text-xs text-red-600 hover:underline">
                      {lang === 'es' ? 'Eliminar' : 'Delete'}
                    </button>
                  </div>
                ) : uploadingPhoto === 'front' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : (
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('front', f) }}
                    disabled={uploadingPhoto != null}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {lang === 'es' ? 'Foto reversa de documento de identidad' : 'ID Photo — Back'}
                </label>
                {profile.id_photo_back ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600">✅ {lang === 'es' ? 'Subida' : 'Uploaded'}</span>
                    <button type="button" onClick={() => {
                      const csrf = localStorage.getItem('learn.tg.authToken') || ''
                      window.open(`/api/user/id-photo/${profile.userId}?side=back&walletAddress=${session?.address}&token=${csrf}`, '_blank')
                    }} className="text-xs text-blue-600 hover:underline">
                      {lang === 'es' ? 'Ver' : 'View'}
                    </button>
                    <button type="button" onClick={() => handlePhotoDelete('back')} className="text-xs text-red-600 hover:underline">
                      {lang === 'es' ? 'Eliminar' : 'Delete'}
                    </button>
                  </div>
                ) : uploadingPhoto === 'back' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : (
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('back', f) }}
                    disabled={uploadingPhoto != null}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                )}
              </div>
            </div>
            )}

            {showBanner && profile.religion && profile.religion > 0 && !selectedChurchId && !profile.place_of_worship_location && (
            <DismissibleBanner religionId={profile.religion} lang={lang} placeOfWorshipLabels={placeOfWorshipLabels} />
            )}

            {profile.religion === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label
                  htmlFor="churchRelationship"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('churchRelationship')}
                </label>
                <ChurchRoleSelect value={profile.church_relationship} onChange={(v) => handleChange('church_relationship', v || '')} lang={lang} />
              </div>
            </div>
            )}

            {profile.church_relationship === 'pastor' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="registration" className="block text-sm font-medium text-gray-700">
                  {lang === 'es' ? 'Número de registro de la iglesia' : 'Church registration number'}
                </label>
                <input
                  id="registration"
                  type="text"
                  value={profile.registration || ''}
                  onChange={(e) => handleChange('registration', e.target.value)}
                  placeholder="REG-12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {lang === 'es' ? 'Documento de registro' : 'Registration document'}
                </label>
                {profile.registration_photo ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600">✅ {lang === 'es' ? 'Subido' : 'Uploaded'}</span>
                    <button type="button" onClick={() => {
                      const csrf = localStorage.getItem('learn.tg.authToken') || ''
                      window.open(`/api/user/id-photo/${profile.userId}?side=registration&walletAddress=${session?.address}&token=${csrf}`, '_blank')
                    }} className="text-xs text-blue-600 hover:underline">
                      {lang === 'es' ? 'Ver' : 'View'}
                    </button>
                    <button type="button" onClick={() => handlePhotoDelete('registration')} className="text-xs text-red-600 hover:underline">
                      {lang === 'es' ? 'Eliminar' : 'Delete'}
                    </button>
                  </div>
                ) : uploadingPhoto === 'registration' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : (
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('registration', f) }}
                    disabled={uploadingPhoto != null}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="denomination" className="block text-sm font-medium text-gray-700">
                  {lang === 'es' ? 'Denominación de la iglesia' : 'Church denomination'}
                </label>
                <input
                  id="denomination"
                  type="text"
                  value={profile.denomination || ''}
                  onChange={(e) => handleChange('denomination', e.target.value)}
                  placeholder={lang === 'es' ? 'Ej. Menonita, Pentecostal...' : 'e.g. Mennonite, Pentecostal...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="citySearch" className="block text-sm font-medium text-gray-700">
                  {placeOfWorshipLabels(profile.religion).address}
                </label>
                <TownAutocomplete
                  key={`town-${profile.country}`}
                  value={citySearch}
                  cityId={cityId}
                  countryId={profile.country}
                  lang={lang}
                  onChange={(newCityId, name, deptId, muniId) => {
                    setCityId(newCityId)
                    setCitySearch(name)
                    // Free-text entry (country without city data): persist as place_of_worship_location
                    if (newCityId === null) setPlaceOfWorshipLocation(name)
                  }}
                />
                {(cityId || citySearch) && (
                  <p className="text-xs text-green-600 mt-1">
                    ✅ {lang === 'es' ? 'Ubicación registrada' : 'Location registered'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {placeOfWorshipLabels(profile.religion).name}
                </label>
                {/* Conditional: assigned church vs free text */}
                {selectedChurchId ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-800 px-3 py-2 bg-gray-50 rounded border">
                      {selectedChurchName || (lang === 'es' ? 'Iglesia asignada' : 'Assigned church')}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSelectedChurchId(null); setSelectedChurchName(''); setPlaceOfWorshipName('') }}
                      className="text-xs text-red-600 hover:text-red-800 underline"
                    >
                      {lang === 'es' ? 'Cambiar de iglesia' : 'Change church'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.religion === 2 ? (
                      <>
                        <input
                          type="text"
                          value={placeOfWorshipName}
                          onChange={(e) => setPlaceOfWorshipName(e.target.value)}
                          placeholder={lang === 'es' ? 'Nombre de la iglesia' : 'Church name'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={pastorName}
                          onChange={(e) => setPastorName(e.target.value)}
                          placeholder={lang === 'es' ? 'Nombre del pastor principal' : 'Principal pastor name'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <input
                          type="text"
                          value={pastorWhatsApp}
                          onChange={(e) => setPastorWhatsApp(e.target.value)}
                          placeholder={lang === 'es' ? 'WhatsApp/Telegram del pastor principal' : 'Principal Pastor WhatsApp/Telegram'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </>
                    ) : (
                      <input
                        type="text"
                        value={placeOfWorshipName}
                        onChange={(e) => setPlaceOfWorshipName(e.target.value)}
                        placeholder={placeOfWorshipLabels(profile.religion).name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <QRCodeDialog
              open={showQRDialog}
              onOpenChange={setShowQRDialog}
              selfApp={selfApp}
              onSuccess={handleSuccessfulSelfVerification}
              onError={handleQRDialogError}
              lang={lang}
            />

            {profile.profilescore != null && profile.profilescore < 100 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {lang === 'es' ? 'Entrevista de Verificación' : 'Verification Interview'}
                </h3>
                <VerificationScheduler
                  lang={lang}
                  interviewDate={profile.proposed_date_of_interview}
                  timezone={profile.department_timezone || profile.country_timezone || undefined}
                  countryId={profile.country || undefined}
                  onBooked={() => setUpdateProfile(true)}
                  onCancel={() => setUpdateProfile(true)}
                />
              </div>
            )}

            <div className="border-t pt-4 mt-4 flex flex-wrap gap-4">
              <Button type="submit" disabled={saving} variant="outline">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving
                  ? t('saving')
                  : (lang === 'es' ? 'Guardar todo' : 'Save All')}
              </Button>
              <Button type="button" onClick={handleSelfVerify}>
                {t('verifySelf')}
              </Button>
              <Button type="button" onClick={handleUpdateScores} disabled={updatingScores}>
                {updatingScores && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('updateScores')}
              </Button>
              <DeleteVerifiedDataDialog
                lang={lang}
                onSuccess={() => setUpdateProfile(true)}
              />
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}

function DismissibleBanner({ religionId, lang, placeOfWorshipLabels }: {
  religionId: number
  lang: string
  placeOfWorshipLabels: (id: number | null) => { name: string; address: string }
}) {
  const labels = placeOfWorshipLabels(religionId)
  const placeName = labels.name.toLowerCase()
  const isEs = lang === 'es'

  const texts = isEs ? {
    title: `Tu ${placeName} aún no está registrada`,
    description: `Registra tu ${placeName} y ayuda a tu comunidad. Al verificarla obtienes +9 pts en tu puntuación de perfil y acceso a becas completas.`,
    button: `Registrar ${placeName}`,
  } : {
    title: `Your ${placeName} is not registered yet`,
    description: `Register your ${placeName} and help your community. Verifying it gives you +9 profile score points and access to full scholarships.`,
    button: `Register ${placeName}`,
  }

  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-blue-800 font-medium">🏛️ {texts.title}</p>
          <p className="text-blue-600 text-sm mt-1">{texts.description}</p>
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-blue-400 hover:text-blue-600 ml-2 shrink-0 text-lg leading-none">&times;</button>
      </div>
    </div>
  )
}
