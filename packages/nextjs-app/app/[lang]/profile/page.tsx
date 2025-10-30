"use client"

import { Loader2 } from "lucide-react"
import { useSession, getCsrfToken } from "next-auth/react";
import { use, useEffect, useState } from "react"
import { countries } from '@selfxyz/qrcode'
import { SelfAppBuilder } from '@selfxyz/qrcode'
import { useAccount } from 'wagmi'

import { Button } from '@/components/ui/button'
import { QRCodeDialog } from '@/components/ui/qr-code-dialog'
import { useMobileDetection } from '@/lib/mobile-detection'
import { openSelfApp, createDeeplinkConfigFromSelfApp } from '@/lib/deeplink'

interface UserProfile {
  country: number | null
  passport_nationality: number | null
  email: string
  groups: string
  id: string
  language: string
  name: string
  passport_name: string
  phone: string
  picture: string
  religion: number
  uname: string
  userId: string
}

interface Religion {
  id: number;
  nombre: string;
}

interface Country {
  id: number;
  nombre: string;
}


type PageProps = {
  params: Promise<{
    lang:string,
  }>
}

export default function ProfileForm({ params } : PageProps) {

  const [profile, setProfile] = useState<UserProfile>({
    country: null,
    passport_nationality: null,
    email: "",
    groups: "",
    id: "",
    language: "",
    name: "",
    passport_name: "",
    phone: "",
    picture: "",
    religion: 1,
    uname: "",
    userId: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifyingSelf, setVerifyingSelf] = useState(false)
  const [updateAfterSelf, setUpdateAfterSelf] = useState(false)
  const [religions, setReligions] = useState<Religion[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [selfApp, setSelfApp] = useState<any | null>(null)
  const [showQRDialog, setShowQRDialog] = useState(false)

  const { address } = useAccount()
  const { data: session } = useSession()
  const isMobile = useMobileDetection()

  const parameters = use(params)
  const { lang } = parameters


  const handleSuccessfulSelfVerification = () => {
    // Persist the attestation / session result to your backend, then gate content
    setSelfApp(null)
    setVerifyingSelf(false)
    setShowQRDialog(false)
    setUpdateAfterSelf(true)
    alert('Verified, information stored')
  }


  const handleSelfVerify = () => {
    setVerifyingSelf(true)
    const userId = session!.address
    const app = new SelfAppBuilder({
      version: 2,
      appName: 'Learn Through Games',
      scope: 'learn.tg',
      devMode: process.env.NEXT_PUBLIC_AUTH_URL != "https://learn.tg",
      endpoint: `${process.env.NEXT_PUBLIC_SELF_ENDPOINT}` || "none",
      logoBase64: 'https://i.postimg.cc/mrmVf9hm/self.png',
      userId,
      endpointType: process.env.NEXT_PUBLIC_AUTH_URL == "https://learn.tg" ?
        'https' : 'staging_https',
      userIdType: 'hex', // 'hex' for EVM address or 'uuid' for uuidv4
      userDefinedData: 'Information to verify your humanity on Learn Through Games. Continuing means you accept the privacy policy available at https://learn.tg/en/privacy-policy',
      disclosures: {
        // What you want to verify from the user's identity
        excludedCountries: [],
        ofac: true,

        // What you want users to disclose
        name: true,
        nationality: true,
      },
    }).build()

    setSelfApp(app)
    setShowQRDialog(true)
  }

  const handleMobileVerify = async () => {
    if (selfApp) {
      try {
        const deeplinkConfig = createDeeplinkConfigFromSelfApp(selfApp)
        const success = await openSelfApp(deeplinkConfig)
        if (!success) {
          const message = lang === 'es' 
            ? 'No se pudo abrir la aplicación Self. Asegúrate de que esté instalada.'
            : 'Unable to open Self app. Please make sure it is installed.'
          alert(message)
        }
      } catch (error) {
        console.error('Error opening Self app:', error)
        const message = lang === 'es'
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
          alert("NEXT_PUBLIC_API_USERS not defined")
          return
        }
        if (process.env.NEXT_PUBLIC_API_SHOW_USER == undefined) {
          alert("NEXT_PUBLIC_API_SHOW_USER not defined")
          return
        }
        if (process.env.NEXT_PUBLIC_API_RELIGIONS == undefined) {
          alert("NEXT_PUBLIC_API_RELIGIONS not defined")
          return
        }
        if (process.env.NEXT_PUBLIC_API_COUNTRIES == undefined) {
          alert("NEXT_PUBLIC_API_COUNTRIES not defined")
          return
        }

        let response = await fetch(process.env.NEXT_PUBLIC_API_COUNTRIES);
        if (!response.ok) {
          throw new Error(`Response status in countries: ${response.status}`);
        }
        let data = await response.json();
        console.log(data);
        setCountries(data)

        response = await fetch(process.env.NEXT_PUBLIC_API_RELIGIONS);
        if (!response.ok) {
          throw new Error(`Response status in religions: ${response.status}`);
        }
        data = await response.json();
        console.log(data);
        setReligions(data)

        let url = process.env.NEXT_PUBLIC_API_USERS
        url += `?filtro[walletAddress]=${session!.address || ""}`
        let csrfToken = await getCsrfToken()
        url += `&walletAddress=${session!.address || ""}` +
          `&token=${csrfToken}`
        console.log("OJO url=", url)

        response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`);
        }
        data = await response.json();
        console.log(data);
        if (data.length != 1) {
          throw new Error(`Expected data.length == 1`);
        }
        let rUser = data[0]
        console.log("rUser=", rUser)
        let locProfile = {
          uname: rUser.nusuario,
          name: rUser.nombre,
          passport_name: rUser.passport_name,
          passport_nationality: rUser.passport_nationality,
          userId: rUser.id,
          email: rUser.email,
          picture: rUser.foto_file_name,
          religion: rUser.religion_id,
          country: rUser.pais_id,
          groups: "",
          id: "",
          language: "",
          phone: "",
        }
        console.log("locProfile=", locProfile)
        setProfile(locProfile)
 
      } catch (error) {
        alert("Failed to load profile data: " + error + 
             "\n If error persis try disconnecting your wallet and connecting again")
      } finally {
        setLoading(false)
      }
    }

    if (address && session && session.address && address == session.address) {
      fetchProfile()
    }
    setUpdateAfterSelf(false)
  }, [address, session, updateAfterSelf])



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (!process.env.NEXT_PUBLIC_API_UPDATE_USER) {
        alert("Undefined NEXT_PUBLIC_API_UPDATE_USER")
        return
      }
      let reg={
        nombre: profile.name,
        email: profile.email,
        nusuario: profile.uname,
        religion_id: profile.religion,
        pais_id: profile.country,
      }

      let csrfToken = await getCsrfToken()
      let url = process.env.NEXT_PUBLIC_API_UPDATE_USER.replace(
        "usuario_id", profile.userId
      )
      url += `?walletAddress=${session!.address}` +
        `&token=${csrfToken}`
      console.log(`Posting ${url}`)

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reg),
      })

      if (!response.ok) {
        throw new Error("Failed to save profile")
      }

      alert("Profile updated successfully")
    } catch (error) {
      alert("Failed to save profile")
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
        Partial login.
        Please disconnect your wallet and connect and sign again.
      </div>
    )
  }


  return (
    <div className="mt-12 max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
          <p className="text-gray-600 mt-1">Update your profile information below</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="uname" className="block text-sm font-medium text-gray-700">
                  Display name
                </label>
                <input
                  id="uname"
                  type="text"
                  value={profile.uname}
                  onChange={(e) => handleChange("uname", e.target.value)}
                  placeholder="Enter your user-name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Full Name ( Verified: 
                          { profile.name != "" && 
                          profile.name == profile.passport_name ? 
                          "✅" : "❌" }
                        )
                </label>
                <input
                  id="name"
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="religion" className="block text-sm font-medium text-gray-700">
                  Religion
                </label>
	              <select
                  id="religion"
                  value={profile.religion}
                  onChange={(e) => handleChange("religion", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select your religion</option>
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
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                  Country ( Verified: 
                  { profile.country != null && 
                    profile.country == profile.passport_nationality ? 
                    "✅" : "❌" } )
                </label>
                <select
                  id="country"
                  value={profile.country?.toString() || ""}
                  onChange={(e) => handleChange("country", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select your country</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.nombre}
                    </option>
                  ))}
                </select>
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

            <div className="flex gap-4">
                <Button
                type="submit"
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                onClick={handleSelfVerify}
                disabled={verifyingSelf}
              >
                Verify with self
              </Button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-black bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

