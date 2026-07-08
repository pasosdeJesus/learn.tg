'use client'

import axios from 'axios'
import type { AxiosResponse, AxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSession, getCsrfToken } from 'next-auth/react'
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
import { IS_PRODUCTION } from '@/lib/config'
import { logger, DebugConsole } from '@pasosdejesus/m/debug'




interface UserProfile {
  country: number | null
  email: string
  groups: string
  id: string
  language: string
  lastgooddollarverification: number | null
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
    country: null,
    email: '',
    groups: '',
    id: '',
    language: '',
    lastgooddollarverification: null,
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

  const { address } = useAccount()
  const { data: session } = useSession()

  const parameters = use(params)
  const { lang } = parameters

  const t = useMemo(() => createComponentT(lang, {
    en: { editProfile: 'Edit Profile', profileScore: 'Profile Score', displayName: 'Display Name', religion: 'Religion', selectReligion: 'Select your religion', countryVerified: 'Country (Verified:', selectCountry: 'Select your country', uniquenessGoodDollar: 'Uniqueness with GoodDollar (Verified:', saving: 'Saving', saveChanges: 'Save Changes', verifySelf: 'Verify with self', updateScores: 'Update scores',
      viewCredentials: 'View my public credentials',
      saveFailed: 'Failed to save profile.',
      expiredSession: '\n\nThis may be due to an expired session. Please try disconnecting and reconnecting your wallet.',
      connectionIssue: '\n\nPlease check your internet connection and try again.',
      errorLabel: 'Error: ', scoreRequired: '50+ required for scholarships', fullNameVerified: 'Full Name ( Verified:', updateInfo: 'Update your profile information below',
      verificationWarning: 'To maintain your verification, keep the name and country from your passport' },
    es: { editProfile: 'Edición del Perfil', profileScore: 'Puntaje de Perfil', displayName: 'Nombre por presentar', religion: 'Religión', selectReligion: 'Elige tu religión', countryVerified: 'País (Verificado:', selectCountry: 'Selecciona tu país', uniquenessGoodDollar: 'Unicidad con GoodDollar ( Verificada:', saving: 'Guardando', saveChanges: 'Guardar Cambios', verifySelf: 'Verificar con self', updateScores: 'Actualizar puntajes',
      viewCredentials: 'Ver mis credenciales públicas',
      saveFailed: 'Fallo al guardar el perfil.',
      expiredSession: '\n\nPuede deberse a que la sesi\u00f3n ha expirado. Por favor, intenta desconectar y reconectar tu billetera.',
      connectionIssue: '\n\nPor favor, revisa tu conexi\u00f3n a internet e int\u00e9ntalo de nuevo.',
      errorLabel: 'Error: ', scoreRequired: 'Requiere 50+ para becas', fullNameVerified: 'Nombre completo ( Verificado:', updateInfo: 'Actualiza la informacion de tu perfil a continuacion',
      verificationWarning: 'Para mantener tu verificación, conserva el nombre y país de tu pasaporte' },
  }), [lang])

  const handleUpdateScores = async () => {
    if (process.env.NEXT_PUBLIC_AUTH_URL === undefined) {
      alert('process.env.NEXT_PUBLIC_AUTH_URL is undefined')
      return
    }
    if (
      !session ||
      !address ||
      !session.address ||
      session.address.toLowerCase() !== address.toLowerCase()
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
        alert(errorMessage)
      })
  }

  const handleSuccessfulSelfVerification = () => {
    logger.info('Self verification successful - calling onSuccess callback', 'SelfVerify')
    logger.info('Previous selfApp state: ' + !!selfApp, 'SelfVerify')
    // Persist the attestation / session result to your backend, then gate content
    setSelfApp(null)
    setShowQRDialog(false)
    setUpdateProfile(true)
    alert('Verified, information stored')
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
      alert('Error setting up Self verification: ' + String(error))
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
        alert(message)
        throw error // Re-throw to be caught by dialog error handler
      }
    }
  }

  const handleQRDialogError = (error: string) => {
    logger.error('QR Dialog error: ' + error, 'SelfVerify')
    logger.error('Dialog open state: ' + showQRDialog, 'SelfVerify')
    const prefix = t('errorLabel')
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

        response = await fetch('/api/religions')
        if (!response.ok) {
          throw new Error(`Response status in religions: ${response.status}`)
        }
        data = await response.json()
        setReligions(data)

        url = process.env.NEXT_PUBLIC_API_USERS!
        url += `?filtro[walletAddress]=${session!.address || ''}`
        const csrfToken = await getCsrfToken()
        url += `&walletAddress=${session!.address || ''}&token=${csrfToken}`
        logger.info('OJO url=' + url, 'Profile')

        response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`)
        }
        data = await response.json()
        if (data.length != 1) {
          throw new Error(`Expected data.length == 1`)
        }
        const rUser = data[0]
        logger.info('rUser=' + JSON.stringify(rUser), 'Profile')
        const locProfile: UserProfile = {
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
          uname: rUser.nusuario,
          userId: rUser.id,
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

        alert(errorMessage)
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
      logger.info(`Posting ${url}`, 'Profile')

      const response = await fetch(url, {
        method: 'POST',
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
      alert('Profile updated successfully')
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  htmlFor="lastgooddollarverification"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('uniquenessGoodDollar')}
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
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
