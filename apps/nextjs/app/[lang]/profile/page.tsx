'use client'

import axios from 'axios'
import type { AxiosResponse, AxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import { useSession, getCsrfToken } from 'next-auth/react'
import { use, useEffect, useState } from 'react'
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
import { openSelfApp } from '@/lib/deeplink'
import { useMobileDetection } from '@/lib/mobile-detection'
import { IS_PRODUCTION } from '@/lib/config'

// Componente para el logger en pantalla
const OnScreenLogger = ({ messages }: { messages: any[] }) => (
  <div
    style={{
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      right: '10px',
      maxHeight: '150px',
      overflowY: 'auto',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#0f0',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px',
      fontFamily: 'monospace',
    }}
  >
    {messages.map((msg, index) => (
      <div key={index}>{typeof msg === 'object' ? JSON.stringify(msg) : msg}</div>
    ))}
  </div>
)


interface UserProfile {
  country: number | null
  email: string
  groups: string
  id: string
  language: string
  lastgooddollarverification: number | null
  learningscore: number | null
  name: string
  passport_name: string
  passport_nationality: number | null
  phone: string
  picture: string
  profilescore: number | null
  religion: number
  uname: string
  userId: string
}

interface Religion {
  id: number
  nombre: string
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
  const [profile, setProfile] = useState<UserProfile>({
    country: null,
    email: '',
    groups: '',
    id: '',
    language: '',
    lastgooddollarverification: null,
    learningscore: null,
    name: '',
    passport_name: '',
    passport_nationality: null,
    phone: '',
    picture: '',
    profilescore: null,
    religion: 1,
    uname: '',
    userId: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updateProfile, setUpdateProfile] = useState(false)
  const [religions, setReligions] = useState<Religion[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [selfApp, setSelfApp] = useState<any | null>(null)
  const [deeplink, setDeeplink] = useState('')
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [debugMessages, setDebugMessages] = useState<any[]>([])

  const { address } = useAccount()
  const { data: session } = useSession()
  const isMobile = useMobileDetection()

  const parameters = use(params)
  const { lang } = parameters

  const logger = (...args: any[]) => {
    console.log(...args)
    if (process.env.NEXT_PUBLIC_MOSTRAR_LOGGER === 'true') {
      setDebugMessages(prev => [...prev, ...args])
    }
  }

  const handleUpdateScores = async () => {
    if (process.env.NEXT_PUBLIC_AUTH_URL === undefined) {
      alert('process.env.NEXT_PUBLIC_AUTH_URL is undefined')
      return
    }
    if (
      !session ||
      !address ||
      !session.address ||
      session.address != address
    ) {
      alert('Problem with session, disconnect and connect again')
      return
    }
    const csrfToken = await getCsrfToken()
    const data = {
      lang: lang,
      walletAddress: session.address,
      token: csrfToken,
    }
    const url = `${process.env.NEXT_PUBLIC_AUTH_URL}/api/update-scores`
    logger(`Posting to ${url}`)
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
        logger('Update scores error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          isTokenMismatch: error.response?.status === 401
        })

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
        alert(errorMessage)
      })
  }

  const handleSuccessfulSelfVerification = () => {
    // Persist the attestation / session result to your backend, then gate content
    setSelfApp(null)
    setShowQRDialog(false)
    setUpdateProfile(true)
    alert('Verified, information stored')
  }

  const handleSelfVerify = () => {
    const userId = session!.address
    const app = new SelfAppBuilder({
      version: 2,
      appName: 'Learn Through Games',
      scope: 'learn.tg',
      devMode: !IS_PRODUCTION,
      endpoint: `${process.env.NEXT_PUBLIC_SELF_ENDPOINT}` || 'none',
      logoBase64: 'https://i.postimg.cc/mrmVf9hm/self.png',
      userId,
      endpointType: IS_PRODUCTION ? 'https' : 'staging_https',
      userIdType: 'hex', // 'hex' for EVM address or 'uuid' for uuidv4
      userDefinedData:
        'Information to verify your humanity on Learn Through Games. Continuing means you accept the privacy policy available at https://learn.tg/en/privacy-policy',
      disclosures: {
        // What you want to verify from the user's identity
        excludedCountries: [],
        ofac: false, // See https://t.me/localismfund/1/435

        // What you want users to disclose
        name: true,
        nationality: true,
      },
    }).build()

    setSelfApp(app)
    setDeeplink(getUniversalLink(app))
    setShowQRDialog(true)
  }

  const handleMobileVerify = async () => {
    if (selfApp) {
      try {
        window.open(deeplink, '_blank')
      } catch (error) {
        logger('Error opening Self app:', error)
        const message =
          lang === 'es'
            ? 'Error al abrir la aplicación Self. Por favor, inténtalo de nuevo.'
            : 'Error opening Self app. Please try again.'
        alert(message)
        throw error // Re-throw to be caught by dialog error handler
      }
    }
  }

  const handleQRDialogError = (error: string) => {
    logger('QR Dialog error:', error)
    const prefix = lang === 'es' ? 'Error: ' : 'Error: '
    alert(`${prefix}${error}`)
  }

  // Fetch user data from API
  useEffect(() => {
    const fetchProfile = async () => {
      let url = ''
      try {
        if (process.env.NEXT_PUBLIC_API_USERS == undefined) {
          alert('NEXT_PUBLIC_API_USERS not defined')
          return
        }
        if (process.env.NEXT_PUBLIC_API_SHOW_USER == undefined) {
          alert('NEXT_PUBLIC_API_SHOW_USER not defined')
          return
        }
        if (process.env.NEXT_PUBLIC_API_RELIGIONS == undefined) {
          alert('NEXT_PUBLIC_API_RELIGIONS not defined')
          return
        }
        if (process.env.NEXT_PUBLIC_API_COUNTRIES == undefined) {
          alert('NEXT_PUBLIC_API_COUNTRIES not defined')
          return
        }

        let response = await fetch(process.env.NEXT_PUBLIC_API_COUNTRIES)
        if (!response.ok) {
          throw new Error(`Response status in countries: ${response.status}`)
        }
        let data = await response.json()
        setCountries(data)

        response = await fetch(process.env.NEXT_PUBLIC_API_RELIGIONS)
        if (!response.ok) {
          throw new Error(`Response status in religions: ${response.status}`)
        }
        data = await response.json()
        setReligions(data)

        url = process.env.NEXT_PUBLIC_API_USERS!
        url += `?filtro[walletAddress]=${session!.address || ''}`
        const csrfToken = await getCsrfToken()
        url += `&walletAddress=${session!.address || ''}&token=${csrfToken}`
        logger('OJO url=', url)

        response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`)
        }
        data = await response.json()
        if (data.length != 1) {
          throw new Error(`Expected data.length == 1`)
        }
        const rUser = data[0]
        logger('rUser=', rUser)
        const locProfile: UserProfile = {
          country: rUser.pais_id,
          email: rUser.email,
          groups: '',
          id: '',
          language: '',
          lastgooddollarverification: rUser.lastgooddollarverification,
          learningscore: rUser.learningscore,
          name: rUser.nombre,
          passport_name: rUser.passport_name,
          passport_nationality: rUser.passport_nationality,
          phone: '',
          picture: rUser.foto_file_name,
          profilescore: rUser.profilescore,
          religion: rUser.religion_id,
          uname: rUser.nusuario,
          userId: rUser.id,
        }
        logger('locProfile=', locProfile)
        setProfile(locProfile)
      } catch (error) {
        logger('Profile fetch error details:', {
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof TypeError ? 'TypeError (likely network/fetch)' : 'Other',
          url,
          sessionAddress: session?.address,
          walletAddress: address,
          isOKX: navigator.userAgent.includes('OKX')
        })

        let errorMessage = 'Failed to load profile data: '
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          errorMessage += 'Cannot connect to server. Please check your internet connection and ensure the backend is running.'
        } else if (error instanceof SyntaxError) {
          errorMessage += 'Invalid response from server (likely JSON parsing error). This may be a token mismatch - try disconnecting and reconnecting your wallet.'
        } else {
          errorMessage += error instanceof Error ? error.message : String(error)
        }
        errorMessage += '\n\nIf error persists, try disconnecting your wallet and connecting again.'

        alert(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    if (address && session && session.address && address == session.address) {
      fetchProfile()
    } else {
      setLoading(false)
    }
    setUpdateProfile(false)
  }, [address, session, updateProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setDebugMessages([]) // Limpiar mensajes en cada intento

    logger('=== PROFILE SAVE DEBUG ===')
    logger('1. Session address:', session?.address)
    logger('2. Wallet address:', address)
    logger('3. Are they equal?', session?.address === address)
    logger('4. User Agent:', navigator.userAgent)
    logger('5. Is OKX Browser?', navigator.userAgent.includes('OKX'))

    const csrfToken = await getCsrfToken()
    logger('6. CSRF Token length:', csrfToken?.length)

    try {
      if (!process.env.NEXT_PUBLIC_API_UPDATE_USER) {
        alert('Undefined NEXT_PUBLIC_API_UPDATE_USER')
        return
      }
      const reg = {
        nombre: profile.name,
        email: profile.email,
        nusuario: profile.uname,
        religion_id: profile.religion,
        pais_id: profile.country,
      }
      let url = process.env.NEXT_PUBLIC_API_UPDATE_USER.replace(
        'usuario_id',
        profile.userId,
      )
      url += `?walletAddress=${session!.address}&token=${csrfToken}`
      logger(`Posting ${url}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reg),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger('❌ Profile save failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500),
          url: url,
          is_okx: navigator.userAgent.includes('OKX'),
        })
        throw new Error(`[${response.status}] ${response.statusText}`)
      }

      let responseData = null
      try {
        responseData = await response.json()
      } catch (e) {
        responseData = await response.text()
      }
      logger('✅ Profile save successful:', {
        status: response.status,
        url: url,
        is_okx: navigator.userAgent.includes('OKX'),
        response: typeof responseData === 'string' ? responseData.substring(0, 200) : responseData,
      })
      alert('Profile updated successfully')
    } catch (error) {
      logger('Profile save error:', error)
      let alertMessage =
        lang === 'es'
          ? 'Fallo al guardar el perfil.'
          : 'Failed to save profile.'

      if (error instanceof Error) {
        alertMessage += `\n\n${lang === 'es' ? 'Detalles' : 'Details'}: ${
          error.message
        }.`

        if (error.message.includes('401')) {
          alertMessage +=
            lang === 'es'
              ? '\n\nPuede deberse a que la sesión ha expirado. Por favor, intenta desconectar y reconectar tu billetera.'
              : '\n\nThis may be due to an expired session. Please try disconnecting and reconnecting your wallet.'
        } else if (
          error instanceof TypeError &&
          error.message.toLowerCase().includes('failed to fetch')
        ) {
          alertMessage +=
            lang === 'es'
              ? '\n\nPor favor, revisa tu conexión a internet e inténtalo de nuevo.'
              : '\n\nPlease check your internet connection and try again.'
        }
      }
      alert(alertMessage)
    } finally {
      setSaving(false)
    }
  }

  // Handle input changes
  const handleChange = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading profile...</span>
      </div>
    )
  }

  if (!(address && session && session.address && address == session.address)) {
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  return (
    <div className="mt-12 max-w-2xl mx-auto p-6">
      {process.env.NEXT_PUBLIC_MOSTRAR_LOGGER === 'true' && <OnScreenLogger messages={debugMessages} />}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {lang === 'es' ? 'Edición del Perfil' : 'Edit Profile'}
          </h2>
          <p className="text-gray-600 mt-1">
            {lang === 'es'
              ? 'Actualiza la información de tu perfil a continuación'
              : 'Update your profile information below'}
          </p>
        </div>
        <div className="p-6">
          <div className="flex justify-around items-center mb-8">
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {lang === 'es' ? 'Puntaje de Perfil' : 'Profile Score'}
              </h3>
              <CircularProgress progress={profile.profilescore || 0} />
              <p className="text-sm text-gray-500 mt-2">
                {lang === 'es'
                  ? 'Requiere 50+ para becas'
                  : '50+ required for scholarships'}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {lang === 'es' ? 'Puntaje de Aprendizaje' : 'Learning Score'}
              </h3>
              <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-4xl font-bold text-blue-600">
                  {(profile.learningscore || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="uname"
                  className="block text-sm font-medium text-gray-700"
                >
                  {lang === 'es' ? 'Nombre por presentar' : 'Display name'}
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
                  {lang === 'es'
                    ? 'Nombre completo ( Verificado:'
                    : 'Full Name ( Verified:'}
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
                  htmlFor="religion"
                  className="block text-sm font-medium text-gray-700"
                >
                  {lang === 'es' ? 'Religión' : 'Religion'}
                </label>
                <Select
                  value={profile.religion?.toString() || ''}
                  onValueChange={(value) => handleChange('religion', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        lang === 'es'
                          ? 'Elige tu religión'
                          : 'Select your religion'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent portalled={false}>
                    {religions.map((religion) => (
                      <SelectItem
                        key={religion.id}
                        value={religion.id.toString()}
                      >
                        {religion.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="country"
                  className="block text-sm font-medium text-gray-700"
                >
                  {lang === 'es' ? 'País (Verificado:' : 'Country ( Verified:'}
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
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        lang === 'es'
                          ? 'Selecciona tu país'
                          : 'Select your country'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent portalled={false}>
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
                  htmlFor="lastgooddollarverification"
                  className="block text-sm font-medium text-gray-700"
                >
                  {lang === 'es'
                    ? 'Unicidad con GoodDollar ( Verificada:'
                    : 'Uniquenes with GoodDollar ( Verified:'}
                  {profile.lastgooddollarverification != null ? '✅' : '❌'}{' '}
                  {')'}
                </label>
              </div>
            </div>

            <QRCodeDialog
              open={showQRDialog}
              onOpenChange={setShowQRDialog}
              selfApp={selfApp}
              onSuccess={handleSuccessfulSelfVerification}
              onError={handleQRDialogError}
              isMobile={isMobile}
              onMobileVerify={handleMobileVerify}
              lang={lang}
            />

            <div className="flex flex-wrap gap-4">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving
                  ? lang === 'es'
                    ? 'Guardando'
                    : 'Saving'
                  : lang === 'es'
                  ? 'Guardar Cambios'
                  : 'Save Changes'}
              </Button>
              <Button type="button" onClick={handleSelfVerify}>
                {lang === 'es' ? 'Verificar con self' : 'Verify with self'}
              </Button>
              <Button type="button" onClick={handleUpdateScores}>
                {lang === 'es' ? 'Actualizar puntajes' : 'Update scores'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
