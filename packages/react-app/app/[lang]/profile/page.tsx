"use client"

import axios from 'axios';
import { getNames, getCodes } from "country-list"
import { Loader2 } from "lucide-react"
import { useSession, getCsrfToken } from "next-auth/react";
import {use, useEffect, useState} from "react"
import { useAccount } from 'wagmi'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserProfile {
  country: string
  email: string
  groups: string
  id: string
  language: string
  name: string
  phone: string
  picture: string
  religion: string
  uname: string
  userId: string
}


type PageProps = {
  params: Promise<{
    lang:string,
  }>
}

// Get all countries from the country-list library
const countryNames = getNames()
const countryCodes = getCodes()

// Create countries array with all countries from the library
const countries = countryNames
  .map((name, index) => ({
    name,
    code: countryCodes[index],
  }))
  .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically


export default function ProfileForm({ params } : PageProps) {

  const [profile, setProfile] = useState<UserProfile>({
    country: "",
    email: "",
    groups: "",
    id: "",
    language: "",
    name: "",
    phone: "",
    picture: "",
    religion: "",
    uname: "",
    userId: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const { address } = useAccount()
  const { data: session } = useSession()

  const parameters = use(params)
  const { lang } = parameters


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

        let url = process.env.NEXT_PUBLIC_API_USERS
        url += `?filtro[walletAddress]=${session.address}`
        let csrfToken = await getCsrfToken()
        url += `&walletAddress=${session.address}` +
          `&token=${csrfToken}`
        console.log("OJO url=", url)

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`);
        }
        const data = await response.json();
        console.log(data);
        if (data.length != 1) {
          throw new Error(`Expected data.length == 1`);
        }
        let rUser = data[0]
        let locProfile = {
          name: rUser.nombre,
          userId: rUser.id,
          email: rUser.email,
          picture: rUser.foto_file_name
        }
        let pc = process.env.NEXT_PUBLIC_API_SHOW_USER ?? "x"
        let url2 = pc.replace("usuario_id", rUser.id)
        url2 += `?walletAddress=${session.address}` +
          `&token=${csrfToken}`
        console.log(`Fetching ${url2}`)
        const response2 = await fetch(url2);
        if (!response2.ok) {
          throw new Error(`Response2 status: ${response2.status}`);
        }
        const data2 = await response2.json();
        console.log(data2);
        locProfile = {
          ...locProfile,
          uname: data2.nusuario,
          language: data2.idioma,
          country: data2.pais,
          religion: data2.religion,
        }
        setProfile(locProfile)
 
      } catch (error) {
        alert("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }

    if (address && session && session.address && address == session.address) {
      fetchProfile()
    }
  }, [address, session])

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
//        telefono: profile.phone
      }

      let csrfToken = await getCsrfToken()
      let url = process.env.NEXT_PUBLIC_API_UPDATE_USER.replace(
        "usuario_id", profile.userId
      )
      url += `?walletAddress=${session.address}` +
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
        Partial uname.
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
                Login
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
                        Full Name
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
            </div>

            <div className="flex gap-4">
                <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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

