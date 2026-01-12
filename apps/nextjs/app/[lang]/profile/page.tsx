'use client'

import axios from 'axios'
import type { AxiosResponse } from 'axios'
import { Loader2 } from 'lucide-react'
import { useSession, getCsrfToken } from 'next-auth/react'
import { use, useEffect, useState } from 'react'
import { getUniversalLink } from '@selfxyz/core'
import { SelfAppBuilder } from '@selfxyz/qrcode'
import { useAccount } from 'wagmi'

import { Button } from '@/components/ui/button'
import CircularProgress from '@/components/ui/circular-progress'
import { QRCodeDialog } from '@/components/ui/qr-code-dialog'
import { openSelfApp } from '@/lib/deeplink'
import { useMobileDetection } from '@/lib/mobile-detection'

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

  const { address } = useAccount()
  const { data: session } = useSession()
  const isMobile = useMobileDetection()

  const parameters = use(params)
  const { lang } = parameters

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
    console.log(`Posting to ${url}`)
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
      .catch((error: any) => {
        console.error(error)
        alert(error)
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
      devMode: process.env.NEXT_PUBLIC_AUTH_URL != 'https://learn.tg',
      endpoint: `${process.env.NEXT_PUBLIC_SELF_ENDPOINT}` || 'none',
      logoBase64: 'https://i.postimg.cc/mrmVf9hm/self.png',
      userId,
      endpointType:
        process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg'
          ? 'https'
          : 'staging_https',
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
        console.error('Error opening Self app:', error)
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
    console.error('QR Dialog error:', error)
    const prefix = lang === 'es' ? 'Error: ' : 'Error: '
    alert(`${prefix}${error}`)
  }

  // Fetch user data from API
  useEffect(() => {
    const fetchProfile = async () => {
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
        console.log(data)
        setCountries(data)

        response = await fetch(process.env.NEXT_PUBLIC_API_RELIGIONS)
        if (!response.ok) {
          throw new Error(`Response status in religions: ${response.status}`)
        }
        data = await response.json()
        console.log(data)
        setReligions(data)

        let url = process.env.NEXT_PUBLIC_API_USERS
        url += `?filtro[walletAddress]=${session!.address || ''}`
        const csrfToken = await getCsrfToken()
        url += `&walletAddress=${session!.address || ''}&token=${csrfToken}`
        console.log('OJO url=', url)

        response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`)
        }
        data = await response.json()
        console.log(data)
        if (data.length != 1) {
          throw new Error(`Expected data.length == 1`)
        }
        const rUser = data[0]
        console.log('rUser=', rUser)
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
        console.log('locProfile=', locProfile)
        setProfile(locProfile)
      } catch (error) {
        alert(
          'Failed to load profile data: ' +
            error +
            '\n If error persis try disconnecting your wallet and connecting again',
        )
      } finally {
        setLoading(false)
      }
    }

    if (address && session && session.address && address == session.address) {
      fetchProfile()
    }
    setUpdateProfile(false)
  }, [address, session, updateProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

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

      const csrfToken = await getCsrfToken()
      let url = process.env.NEXT_PUBLIC_API_UPDATE_USER.replace(
        'usuario_id',
        profile.userId,
      )
      url += `?walletAddress=${session!.address}&token=${csrfToken}`
      console.log(`Posting ${url}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reg),
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      alert('Profile updated successfully')
    } catch (error) {
      alert('Failed to save profile')
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
                  {profile.learningscore || 0}
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
                <select
                  id="religion"
                  value={profile.religion || ''}
                  onChange={(e) => handleChange('religion', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">
                    {lang === 'es'
                      ? 'Elige tu religión:'
                      : 'Select your religion'}
                  </option>
                  {religions.map((religion) => (
                    <option key={religion.id} value={religion.id}>
                      {religion.nombre}
                    </option>
                  ))}
                </select>
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
                <select
                  id="country"
                  value={profile.country?.toString() || ''}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">
                    {lang === 'es'
                      ? 'Selecciona tu país'
                      : 'Select your country'}
                  </option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.nombre}
                    </option>
                  ))}
                </select>
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
