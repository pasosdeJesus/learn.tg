// @ts-ignore
import axios from 'axios'
// @ts-ignore
import { getCsrfToken } from 'next-auth/react'

export interface ScholarshipInfo {
  vaultCreated: boolean
  vaultBalance: number
  amountPerGuide: number
  canSubmit: boolean
  courseId: string
}

export async function fetchScholarshipInfo(
  courseId: string,
  walletAddress: string,
): Promise<ScholarshipInfo | null> {
  const csrfToken = await getCsrfToken()
  if (!csrfToken) return null
  const url = `/api/scholarship?courseId=${courseId}&walletAddress=${walletAddress}&token=${csrfToken}`
  try {
    const response = await axios.get(url)
    if (response.data && response.data.message === '') {
      return {
        vaultCreated: response.data.vaultCreated,
        vaultBalance: +response.data.vaultBalance,
        amountPerGuide: +response.data.amountPerGuide,
        canSubmit: response.data.canSubmit,
        courseId: response.data.courseId,
      }
    }
    return null
  } catch (error) {
    console.error(error)
    return null
  }
}

export async function submitGuideResult(
  contract: any,
  guideId: string,
  userAddress: string,
): Promise<any> {
  // contract: instancia de ScolarshipVaults
  // guideId: id de la guía
  // userAddress: dirección del usuario
  try {
    const tx = await contract.submitGuideResult(guideId, userAddress)
    const receipt = await tx.wait()
    return receipt
  } catch (error) {
    console.error('Error al enviar resultado de guía:', error)
    throw error
  }
}
