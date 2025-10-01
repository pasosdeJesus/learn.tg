"use client"

import axios from 'axios';
import { useSession, getCsrfToken } from "next-auth/react";
import {use, useEffect, useState} from "react"
import { useAccount, usePublicClient } from 'wagmi'
import * as Toast from '@radix-ui/react-toast'
import Image from 'next/image'
import DonateModal from '@/components/DonateModal'
import { Button } from '@/components/ui/button'

type PageProps = {
  params: Promise<{
    lang:string,
  }>
}
interface Course {
  id: string;
  idioma: string;
  prefijoRuta: string;
  imagen: string;
  titulo: string;
  subtitulo: string;
  vaultCreated?: boolean;
  vaultBalance?: number;
  amountPerGuide?: number;
  canSubmit?: boolean;
}
interface CourseComplete {
  id: string;
  idioma: string;
  prefijoRuta: string;
  imagen: string;
  titulo: string;
  subtitulo: string;
  vaultCreated: boolean;
  vaultBalance: number;
  amountPerGuide: number;
  canSubmit: boolean;
}



export default function Page({ params } : PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const [coursesj, setCoursesj] = useState<Array<CourseComplete>>([])
  const [extCourses, setExtCourses] = useState({ map: new Map() });
  const [donateCourseId, setDonateCourseId] = useState<number | null>(null)
  const [toastMsg, setToastMsg] = useState<string>("")
  const [toastOpen, setToastOpen] = useState<boolean>(false)
  const publicClient = usePublicClient()

  const parameters = use(params)
  const { lang } = parameters

  useEffect(() => {
    if ((session && !address) || (address && !session) || 
        (address && session && session.address && 
         address != session.address)) {
      return 
    }
    const configurar = async () => {
      if (process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL == undefined) {
        alert("NEXT_PUBLIC_API_BUSCA_CURSOS_URL not defined")
        return
      }
      let url = process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL
      url += `?filtro[busidioma]=${lang}`
      console.log("session=", session)
      console.log("address=", address)
      let csrfToken = null
      if (session && address && session.address && 
          session.address == address) {
        csrfToken = await getCsrfToken()
        url += '&filtro[busconBilletera]=true' +
          `&walletAddress=${session.address}` +
          `&token=${csrfToken}`
      }
      console.log("url=", url)
      axios.get(url)
      .then(response => {
        if (response.data) {
          const courseInfo = response.data
          if (csrfToken) {
            setCoursesj(courseInfo);
            courseInfo.forEach((course: Course) => {
              const url2 = `/api/scholarship?courseId=${course.id}` +
                `&walletAddress=${session!.address}` +
                `&token=${csrfToken}`
              console.log("** url2=", url2)
              axios.get(url2)
              .then(response2 => {
                console.log("** response2=", response2)
                if (response2.data.message == undefined) {
                  console.error("Response without data.message")
                  alert("Response without data.message")
                } else if (response2.data.message != "") {
                  console.error(
                    "Error message received:",
                    response2.data.message
                  )
                  alert(response2.data.message)
                }
                setExtCourses(prevState => ({
                  map: prevState.map.set(response2.data.courseId, {
                    vaultCreated: response2.data.vaultCreated,
                    vaultBalance: +response2.data.vaultBalance,
                    amountPerGuide: +response2.data.amountPerGuide,
                    canSubmit: response2.data.canSubmit,
                  })
                }))
              })
              .catch(error => {
                alert(error)
                console.error(error)
              })
            })
          }
        }
      })
      .catch(error => {
        alert(error)
        console.error(error);
      })
    }
    configurar()
  }, [session, address, lang])

  if ((session && !address) || (address && !session) || 
      (address && session && session.address && 
       address != session.address)) {
    return (
      <div className="p-10 mt-10">
        Partial login. 
        Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  const refreshCourseVault = async (courseId: number) => {
    if (!session || !address || !session.address || session.address != address) return
    const csrfToken = await getCsrfToken()
    const url2 = `/api/scholarship?courseId=${courseId}` +
      `&walletAddress=${session.address}` +
      `&token=${csrfToken}`
    axios.get(url2)
      .then(response2 => {
        if (response2.data && response2.data.message == "") {
          setExtCourses(prevState => ({
            map: prevState.map.set(response2.data.courseId, {
              vaultCreated: response2.data.vaultCreated,
              vaultBalance: +response2.data.vaultBalance,
              amountPerGuide: +response2.data.amountPerGuide,
              canSubmit: response2.data.canSubmit,
            })
          }))
        }
      })
      .catch(error => console.error(error))
  }

  let handleDonate = (courseId: Number) => {
    setDonateCourseId(Number(courseId))
  }

  const handleDonationSuccess = () => {
    setToastMsg(lang === 'es' ? 'Donación exitosa' : 'Donation successful')
    setToastOpen(true)
  }

  return (
  <Toast.Provider swipeDirection="right">
  <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6">
    <div className="max-w-6xl mx-auto">

        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {coursesj.map((course) => (
            <div key={course.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl overflow-hidden transform transition-all duration-300 hover:-translate-y-2 border border-gray-200">
              <a
                href={`/${course.idioma}${course.prefijoRuta}`} >
                <div className="img-course">
                <Image 
                  className="w-full h-[17rem] pt-2 object-cover"
                  src={course.imagen}
                  alt={course.titulo}
                  width={680}
                  height={272}
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{course.titulo}</h3>
                  <p className="text-sm text-gray-600 line-clamp-3">{course.subtitulo}</p>
                </div>
                { extCourses.map.get(course.id) && 
                  extCourses.map.get(course.id).amountPerGuide > 0 &&
                  <div className="p-5 bg-green">

                    <p>{lang === 'es' ? "Eres elegible para beca de" :
                      "You are elegible for scolarship of"}</p>
                    <p>${extCourses.map.get(course.id).amountPerGuide} USDT
                      {lang === 'es' ? " por guía. " : " per guide."}</p>
                  </div>
                }
                { extCourses.map.get(course.id) && 
                  extCourses.map.get(course.id).amountPerGuide > 0 &&
                  !extCourses.map.get(course.id).canSubmit &&
                  <div className="text-red">
                    {lang === 'es' ? 
                      "Aunque estás en etapa de enfriamiento" :
                      "Although you are in cooldown period."}
                  </div>
                }
              </a>
              { extCourses.map.get(course.id) && 
                extCourses.map.get(course.id).vaultCreated &&
                <div className="p-5 bg-green flex items-center gap-3 justify-between">
                  <div className="text-sm">
                  {lang === 'es' ? "En boveda: " : "In vault: "}
                  ${extCourses.map.get(course.id).vaultBalance} USDT
                  </div>
                  <Button 
                    onClick={() => handleDonate(+course.id)}
                    size="sm"
                  >
                    Donate for this course
                  </Button>
                </div>
              }
            </div>
          ))}
        </div>
      </div>
      <DonateModal
        courseId={donateCourseId}
        isOpen={donateCourseId !== null}
        onClose={() => setDonateCourseId(null)}
        onSuccess={() => { if (donateCourseId) { refreshCourseVault(donateCourseId); handleDonationSuccess() } }}
        lang={lang}
      />
      <Toast.Root
        open={toastOpen}
        onOpenChange={setToastOpen}
        duration={5000}
        className="bg-primary text-primary-foreground rounded px-4 py-3 text-sm shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <Toast.Title className="font-medium">
          {toastMsg}
        </Toast.Title>
        <Toast.Close className="absolute top-1 right-2 text-primary-foreground/70 hover:text-primary-foreground">×</Toast.Close>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-96 max-w-[100vw] outline-none z-[60]" />
  </div>
  </Toast.Provider>
  )
}
