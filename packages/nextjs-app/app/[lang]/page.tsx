"use client"

import axios from 'axios';
import { useSession, getCsrfToken } from "next-auth/react";
import {use, useEffect, useState} from "react"
import { useAccount } from 'wagmi'

type PageProps = {
  params: Promise<{
    lang:string,
  }>
}

export default function Page({ params } : PageProps) {

  const { address } = useAccount()
  const { data: session } = useSession()

  const [cursosj, setCursosj] = useState<any[]>([])

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
          let courseInfo = response.data
          if (csrfToken) {
            courseInfo.forEach((course) => {
              let url2 = `/api/scolarship?cursoId=${course.id}` +
                `&walletAddress=${session.address}` +
                `&token=${csrfToken}`
              axios.get(url2)
              .then(response2 => {
                course.amountPerGuide = response2.data.amountPerGuide
                course.canSubmit = response2.data.canSubmit
              })
              .catch(error => {
                alert(error)
                console.error(error);
              })
            })
          }
          setCursosj(courseInfo);
        }
      })
      .catch(error => {
        alert(error)
        console.error(error);
      })
    }
    configurar()
  }, [session, address])

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

  return (
  <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6">
    <div className="max-w-6xl mx-auto">

        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {cursosj.map((curso) => (
            <a
              key={curso.id}
              href={`/${curso.idioma}${curso.prefijoRuta}`}
              className="bg-white rounded-2xl shadow-md hover:shadow-xl overflow-hidden 
                         transform transition-all duration-300 hover:-translate-y-2 border border-gray-200"
            >
              <div className="img-curso">
              <img className="w-full h-[17rem] pt-2 object-cover" 
                src={curso.imagen}
                alt={curso.titulo}
                />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{curso.titulo}</h3>
                <p className="text-sm text-gray-600 line-clamp-3">{curso.subtitulo}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
  </div>
  )
}
