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

export default function Home({ params } : PageProps) {

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
      let axiosConfig = {}
      console.log("session=", session)
      console.log("address=", address)
      if (session && address && session.address && 
          session.address == address) {
        let csrfToken = await getCsrfToken()
        url += '&filtro[busconBilletera]=true' +
          `&walletAddress=${session.address}` +
          `&token=${csrfToken}`
      }
      console.log("url=", url)
      axios.get(url)
      .then(response => {
        if (response.data) {
          setCursosj(response.data);
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
      <div>
        Partial login. 
        Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  return (
  <div className="mt-8 overflow-x-hidden py-8 dark:bg-gray-100 dark:text-gray-900 mt-8">
    <div className="overflow-x-hidden py-1 dark:bg-gray-100 dark:text-gray-900 flex flex-row flex-wrap justify-center mt-2">
      <>
      {cursosj.map((curso) => (
        <div  key={curso.id} className="flex flex-col justify-center w-full px-8 mx-6 my-12 py-9
              text-center rounded-md md:w-96 lg:w-80 xl:w-65 bg-gray-300
              dark:text-gray-900">
          <a href={`/${curso.idioma}${curso.prefijoRuta}`}>
            <div className="img-curso">
              <img className="w-[100%] h-[17rem] pt-2 object-cover" src={curso.imagen}/>
            </div>
            <div>
              <div className="text-xl py-2 font-bold">{curso.titulo}</div>
              <div className="w-[90%] text-justify">{curso.subtitulo}</div>
            </div>
          </a>
        </div>
      ))}
      </>
    </div>
  </div>
  )
}
