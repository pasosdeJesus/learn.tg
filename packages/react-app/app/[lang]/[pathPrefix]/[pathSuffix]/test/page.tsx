"use client"

import axios from 'axios';

import { useSession, getCsrfToken } from "next-auth/react"
import { use, useEffect, useState } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi';
import { useAccount } from 'wagmi'

import CrosswordPuzzle from "@/components/crossword-puzzle"

export default function Page({params} : {
  params: Promise<{
    lang:string,
    pathPrefix:string,
    pathSuffix:string,
  }>
}) {

  const { address } = useAccount()
  const { data: session } = useSession();

  useEffect(() => {
    if ((session && !address) || (address && !session) || 
        (address && session && session.address && 
         address != session.address)) {
      return
    }
    const configurar = async () => {
    }
    configurar()
  }, [session, address])

  const parameters = use(params)
  const { lang, pathPrefix, pathSuffix } = parameters


  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

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

  let q = ""
  if (typeof window != "undefined") {
    q = localStorage.getItem("fillInTheBlank")
  }
  return (
    <main className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-8">Crossword Puzzle</h1>
        <CrosswordPuzzle questions={q} />
      </div>
    </main>
  )
}
