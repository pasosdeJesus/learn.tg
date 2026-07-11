'use client'

import axios from 'axios'
import type { AxiosResponse, AxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { use, useEffect, useState, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { getUniversalLink } from '@selfxyz/core'
import { SelfAppBuilder } from '@selfxyz/qrcode'
import { useAccount } from 'wagmi'

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
import { NewChurchDialog } from '@/components/NewChurchDialog'
import { IS_PRODUCTION } from '@/lib/config'
import { logger, DebugConsole } from '@pasosdejesus/m/debug'




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
  profilescore: number | null
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
    profilescore: null,
    religion: 1,
    telegram: '',
    uname: '',
    userId: '',
    whatsapp: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updateProfile, setUpdateProfile] = useState(false)
  const [religions, setReligions] = useState<Religion[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [selfApp, setSelfApp] = useState<any | null>(null)
  const [deeplink, setDeeplink] = useState('')
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const [citySuggestions, setCitySuggestions] = useState<{ city: string; state: string; county: string; country_code: string; lat: number; lng: number }[]>([])
  const [churches, setChurches] = useState<{ id: number; name: string; city_name: string | null }[]>([])
  const [selectedChurchId, setSelectedChurchId] = useState<number | null>(null)
  const [newChurchName, setNewChurchName] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState<'front' | 'back' | null>(null)
  const [showChurchDialog, setShowChurchDialog] = useState(false)

  const { address } = useAccount()
  const { data: session, status: sessionStatus } = useSession()
  const { toast } = useToast()

  const parameters = use(params)
  const { lang } = parameters

  const t = useMemo(() => createComponentT(lang, {
    en: { editProfile: 'Edit Profile', profileScore: 'Profile Score', displayName: 'Display Name', religion: 'Religion', selectReligion: 'Select your religion', churchRelationship: 'Church Relationship', selectChurchRelationship: 'Select your role', churchRelationshipPastor: 'Pastor', churchRelationshipLeader: 'Leader/Elder', churchRelationshipMember: 'Member', placeOfWorshipAddress: 'Address of your place of worship', searchPlace: 'Type to search place...', placeOfWorshipName: 'Name of your place of worship', placeOfWorshipNamePlaceholder: 'Name or church', contactNotice: 'We may occasionally send announcements about the platform to your email, WhatsApp, or Telegram. If you prefer not to receive them, do not provide that information.', countryVerified: 'Country (Verified:', selectCountry: 'Select your country', uniquenessGoodDollar: 'Uniqueness with GoodDollar (Verified:', saving: 'Saving', saveChanges: 'Save Changes', verifySelf: 'Verify with self', updateScores: 'Update scores', deleteVerifiedData: 'Delete Verified Data',
      viewCredentials: 'View my public credentials',
      saveFailed: 'Failed to save profile.',
      expiredSession: '\n\nThis may be due to an expired session. Please try disconnecting and reconnecting your wallet.',
      connectionIssue: '\n\nPlease check your internet connection and try again.',
      errorLabel: 'Error: ', scoreRequired: '50+ required for scholarships', fullNameVerified: 'Full Name ( Verified:', updateInfo: 'Update your profile information below',
      verificationWarning: 'To maintain your verification and profile score, keep the information already verified as you provided during verification' },
    es: { editProfile: 'Edición del Perfil', profileScore: 'Puntaje de Perfil', displayName: 'Nombre por presentar', religion: 'Religión', selectReligion: 'Elige tu religión', churchRelationship: 'Relación con la Iglesia', selectChurchRelationship: 'Selecciona tu rol', churchRelationshipPastor: 'Pastor', churchRelationshipLeader: 'Líder/Anciano', churchRelationshipMember: 'Miembro', placeOfWorshipAddress: 'Dirección de tu lugar de culto', searchPlace: 'Escribe para buscar lugar...', placeOfWorshipName: 'Nombre de tu lugar de culto', placeOfWorshipNamePlaceholder: 'Nombre o iglesia', contactNotice: 'Ocasionalmente enviaremos anuncios sobre la plataforma a tu correo, WhatsApp o Telegram. Si no deseas recibirlos, no suministres esa información.', countryVerified: 'País (Verificado:', selectCountry: 'Selecciona tu país', uniquenessGoodDollar: 'Unicidad con GoodDollar ( Verificada:', saving: 'Guardando', saveChanges: 'Guardar Cambios', verifySelf: 'Verificar con self', updateScores: 'Actualizar puntajes', deleteVerifiedData: 'Eliminar Datos Verificados',
      viewCredentials: 'Ver mis credenciales públicas',
      saveFailed: 'Fallo al guardar el perfil.',
      expiredSession: '\n\nPuede deberse a que la sesi\u00f3n ha expirado. Por favor, intenta desconectar y reconectar tu billetera.',
      connectionIssue: '\n\nPor favor, revisa tu conexi\u00f3n a internet e int\u00e9ntalo de nuevo.',
      errorLabel: 'Error: ', scoreRequired: 'Requiere 50+ para becas', fullNameVerified: 'Nombre completo ( Verificado:', updateInfo: 'Actualiza la informacion de tu perfil a continuacion',
      verificationWarning: 'Para mantener tu verificación y puntaje de perfil, conserva la información ya verificada como la suministraste durante la verificación' },
  }), [lang])

  const handleUpdateScores = async () => {
    if (process.env.NEXT_PUBLIC_AUTH_URL === undefined) {
      toast({ title: 'process.env.NEXT_PUBLIC_AUTH_URL is undefined', variant: 'destructive' })
      return
    }
    if (
      !session ||
      !address ||
      !session.address ||
      session.address.toLowerCase() !== address.toLowerCase()
    ) {
      toast({ title: 'Problem with session, disconnect and connect again', variant: 'destructive' })
      return
    }
    const csrfToken = await getCsrfToken()
    const data = {
      lang: lang,
      walletAddress: session.address,
      token: csrfToken,
    }
    const url = `${process.env.NEXT_PUBLIC_AUTH_URL}/api/update-scores`
    logger.info(`Posting to ${url}`, 'Profile')
    axios
      .post(url, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then((response: AxiosResponse) => {
        if (response.data) {
          setUpdateProfile(true)
        }
      })
      .catch((error: AxiosError) => {
        logger.error('Update scores error: ' + JSON.stringify({
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          isTokenMismatch: error.response?.status === 401
        }), 'Profile')

        let errorMessage = 'Failed to update scores: '
        if (error.response?.status === 401) {
          errorMessage += 'Authentication failed (token mismatch). '
          errorMessage += 'Please disconnect your wallet and connect again to refresh your session.'
          if (error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
            errorMessage += `\nServer message: ${error.response.data.message}`
          }
        } else if (error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
          errorMessage += error.response.data.message
        } else {
          errorMessage += error.message
        }
        toast({ title: errorMessage, variant: 'destructive' })
      })
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

        const csrfToken = await getCsrfToken()
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
          profilescore: rUser.profilescore,
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

    const csrfToken = await getCsrfToken()
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
        place_of_worship: selectedChurchId ? churches.find(c => c.id === selectedChurchId)?.name || newChurchName : citySearch,
        church_id: selectedChurchId || null,
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
        logger.error('Profile save failed: ' + JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500),
          url: url,
          is_okx: navigator.userAgent.includes('OKX'),
        }), 'Profile')
        throw new Error(`[${response.status}] ${response.statusText}`)
      }

      // If creating a new church with city selected, call POST /api/church
      if (profile.religion === 2 && citySearch && newChurchName && !selectedChurchId) {
        const churchRes = await fetch('/api/church', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address,
            token: csrfToken,
            name: newChurchName,
            countryId: profile.country,
            cityName: citySearch,
            pastorName: profile.name,
            pastorWhatsapp: profile.whatsapp || profile.phone || '',
          }),
        })
        if (!churchRes.ok) {
          const churchErr = await churchRes.json()
          logger.error('Church creation failed: ' + JSON.stringify(churchErr), 'Profile')
        }
      }

      // If creating a new church with city selected, call POST /api/church
      if (profile.religion === 2 && citySearch && newChurchName && !selectedChurchId) {
        const churchRes = await fetch('/api/church', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address,
            token: csrfToken,
            name: newChurchName,
            countryId: profile.country,
            cityName: citySearch,
            pastorName: profile.name,
            pastorWhatsapp: profile.phone || '',
          }),
        })
        if (!churchRes.ok) {
          const churchErr = await churchRes.json()
          logger.error('Church creation failed: ' + JSON.stringify(churchErr), 'Profile')
        }
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
      let alertMessage =
        t('saveFailed')

      if (error instanceof Error) {
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

  // Handle input changes
  const handleChange = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: field === 'religion' || field === 'country' ? Number(value) : value,
    }))
  }

  const handleCitySearch = async (query: string) => {
    setCitySearch(query)
    if (query.length < 2) {
      setCitySuggestions([])
      return
    }
    const countryCode = countries.find((c) => c.id === profile.country)?.nombre || ''
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&country=${profile.country}`)
      const data = await res.json()
      setCitySuggestions(data.results || [])
    } catch {
      setCitySuggestions([])
    }
  }

  const handleSelectCity = async (city: string, suggestion?: { state: string; county: string; lat: number; lng: number }) => {
    setCitySearch(city)
    setCitySuggestions([])
    setChurches([])
    setSelectedChurchId(null)
    setNewChurchName('')
    if (!profile.country) return

    // Upsert location into msip_* tables
    if (suggestion) {
      try {
        await fetch('/api/geocode/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            countryId: profile.country,
            state: suggestion.state,
            county: suggestion.county,
            city,
            lat: suggestion.lat,
            lng: suggestion.lng,
          }),
        })
      } catch { /* non-blocking */ }
    }

    try {
      const res = await fetch(`/api/churches/search?q=&country=${profile.country}`)
      const data = await res.json()
      setChurches(data.churches || [])
    } catch {
      setChurches([])
    }
  }

  const handleSelectChurch = (churchId: string) => {
    if (churchId === '__new__') {
      setSelectedChurchId(null)
      setShowChurchDialog(true)
      return
    }
    setSelectedChurchId(parseInt(churchId, 10))
    setNewChurchName('')
  }

  const placeOfWorshipLabels = (religionId: number | null): { name: string; address: string } => {
    const isEs = lang === 'es'
    switch (religionId) {
      case 2: return { name: isEs ? 'Iglesia' : 'Church', address: isEs ? 'Ubicación de iglesia' : 'Location of church' }
      case 3: return { name: isEs ? 'Mezquita' : 'Mosque', address: isEs ? 'Ubicación de mezquita' : 'Location of mosque' }
      case 6: return { name: isEs ? 'Sinagoga' : 'Synagogue', address: isEs ? 'Ubicación de sinagoga' : 'Location of synagogue' }
      case 4:
      case 5: return { name: isEs ? 'Templo' : 'Temple', address: isEs ? 'Ubicación de templo' : 'Location of temple' }
      default: return { name: isEs ? 'Lugar de culto' : 'Place of worship', address: isEs ? 'Ubicación de lugar de culto' : 'Location of place of worship' }
    }
  }

  const handlePhotoUpload = async (side: 'front' | 'back', file: File) => {
    setUploadingPhoto(side)
    try {
      const csrfToken = await getCsrfToken()
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('side', side)
      formData.append('walletAddress', address || '')
      formData.append('token', csrfToken || '')
      const res = await fetch('/api/user/id-photo', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      const data = await res.json()
      setProfile((prev) => ({ ...prev, [side === 'front' ? 'id_photo_front' : 'id_photo_back']: data.path }))
    } catch (e: any) {
      toast({ title: e?.message || (lang === 'es' ? 'Error al subir foto' : 'Photo upload failed'), variant: 'destructive' })
    } finally {
      setUploadingPhoto(null)
    }
  }

  const handlePhotoDelete = async (side: 'front' | 'back') => {
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/user/id-photo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, token: csrfToken, side }),
      })
      if (!res.ok) throw new Error('Delete failed')
      setProfile((prev) => ({ ...prev, [side === 'front' ? 'id_photo_front' : 'id_photo_back']: null }))
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
                </label>
                <input
                  id="uname"
                  type="text"
                  value={profile.uname}
                  onChange={(e) => handleChange('uname', e.target.value)}
                  placeholder="Enter your user-name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('fullNameVerified')}
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
              <div className="space-y-2">
                <label
                  htmlFor="whatsapp"
                  className="block text-sm font-medium text-gray-700"
                >
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  type="text"
                  value={profile.whatsapp}
                  onChange={(e) => handleChange('whatsapp', e.target.value)}
                  placeholder="+232 12345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="telegram"
                  className="block text-sm font-medium text-gray-700"
                >
                  Telegram
                </label>
                <input
                  id="telegram"
                  type="text"
                  value={profile.telegram}
                  onChange={(e) => handleChange('telegram', e.target.value)}
                  placeholder="@username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
                  )
                </label>
                <Select
                  value={profile.country?.toString() || ''}
                  onValueChange={(value) => handleChange('country', value)}
                >
                  <SelectTrigger id="country" className="w-full">
                    <SelectValue
                      placeholder={
                        t('selectCountry')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.id} value={country.id.toString()}>
                        {country.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="religion"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('religion')}
                </label>
                <Select
                  value={profile.religion?.toString() || ''}
                  onValueChange={(value) => handleChange('religion', value)}
                >
                  <SelectTrigger id="religion" className="w-full">
                    <SelectValue
                      placeholder={
                        t('selectReligion')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {religions.map((religion) => (
                      <SelectItem
                        key={religion.id}
                        value={religion.id.toString()}
                      >
                        {lang === 'en' && religion.name_english ? religion.name_english : religion.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {profile.country === 694 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {lang === 'es' ? 'Foto frontal de documento de identidad' : 'ID Photo — Front'}
                </label>
                {profile.id_photo_front ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600">✅ {lang === 'es' ? 'Subida' : 'Uploaded'}</span>
                    <a href={`/api/user/id-photo/${profile.userId}?side=front`} target="_blank" className="text-xs text-blue-600 hover:underline">
                      {lang === 'es' ? 'Ver' : 'View'}
                    </a>
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
                    <a href={`/api/user/id-photo/${profile.userId}?side=back`} target="_blank" className="text-xs text-blue-600 hover:underline">
                      {lang === 'es' ? 'Ver' : 'View'}
                    </a>
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

            {profile.religion === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label
                  htmlFor="churchRelationship"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('churchRelationship')}
                </label>
                <Select
                  value={profile.church_relationship || ''}
                  onValueChange={(value) => handleChange('church_relationship', value)}
                >
                  <SelectTrigger id="churchRelationship" className="w-full">
                    <SelectValue placeholder={t('selectChurchRelationship')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pastor">{t('churchRelationshipPastor')}</SelectItem>
                    <SelectItem value="leader">{t('churchRelationshipLeader')}</SelectItem>
                    <SelectItem value="member">{t('churchRelationshipMember')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="citySearch" className="block text-sm font-medium text-gray-700">
                  {placeOfWorshipLabels(profile.religion).address}
                </label>
                <div className="relative">
                  <input
                    id="citySearch"
                    type="text"
                    value={citySearch}
                    onChange={(e) => handleCitySearch(e.target.value)}
                    placeholder={t('searchPlace')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {citySuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                      {citySuggestions.map((s, i) => (
                        <li
                          key={i}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          onClick={() => handleSelectCity(s.city, s)}
                        >
                          {s.city}{s.country_code ? `, ${s.country_code}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="placeOfWorshipName" className="block text-sm font-medium text-gray-700">
                  {placeOfWorshipLabels(profile.religion).name}
                </label>
                {profile.religion === 2 ? (
                  <>
                    <Select
                      value={selectedChurchId?.toString() || (newChurchName ? '__new__' : '')}
                      onValueChange={handleSelectChurch}
                    >
                      <SelectTrigger id="placeOfWorshipName" className="w-full">
                        <SelectValue placeholder={t('placeOfWorshipNamePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {churches.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id.toString()}>
                            {ch.name}{ch.city_name ? ` — ${ch.city_name}` : ''}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">{lang === 'es' ? '+ Nueva iglesia' : '+ New church'}</SelectItem>
                      </SelectContent>
                    </Select>
                    {!selectedChurchId && newChurchName !== '' && (
                      <input
                        type="text"
                        value={newChurchName}
                        onChange={(e) => setNewChurchName(e.target.value)}
                        placeholder={lang === 'es' ? 'Nombre de nueva iglesia' : 'New church name'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-2"
                      />
                    )}
                  </>
                ) : (
                  <input
                    id="placeOfWorshipName"
                    type="text"
                    placeholder={placeOfWorshipLabels(profile.religion).name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
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

            <div className="flex flex-wrap gap-4">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving
                  ? t('saving')
                  : t('saveChanges')}
              </Button>
              <Button type="button" onClick={handleSelfVerify}>
                {t('verifySelf')}
              </Button>
              <Button type="button" onClick={handleUpdateScores}>
                {t('updateScores')}
              </Button>
              <DeleteVerifiedDataDialog
                lang={lang}
                onSuccess={() => setUpdateProfile(true)}
              />
            </div>
          </form>
          <NewChurchDialog
            open={showChurchDialog}
            onOpenChange={setShowChurchDialog}
            onSuccess={(churchId) => {
              if (churchId) {
                setSelectedChurchId(churchId)
                setNewChurchName('')
              }
              // Refresh church list
              if (profile.country) {
                fetch(`/api/churches/search?q=&country=${profile.country}`)
                  .then(r => r.json())
                  .then(data => setChurches(data.churches || []))
                  .catch(() => {})
              }
            }}
            countryId={profile.country}
            cityName={citySearch}
            churchName={newChurchName}
            churchRelationship={profile.church_relationship}
            lang={lang}
          />
        </div>
      </div>
    </div>
  )
}
