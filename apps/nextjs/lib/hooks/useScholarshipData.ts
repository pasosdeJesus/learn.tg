'use client'

import { useState, useCallback } from 'react'
import axios from 'axios'
import { getCsrfToken } from 'next-auth/react'

export interface ScholarshipData {
  vaultCreated: boolean | null
  vaultBalance: number | null
  scholarshipPerGuide: number | null
  canSubmit: boolean | null
  percentageCompleted: number | null
  completedGuides: number | null
  paidGuides: number | null
  totalGuides: number | null
  percentagePaid: number | null
  scholarshipPaid: number | null
  profileScore: number | null
}

interface UseScholarshipDataProps {
  courseId?: string | number
  address?: string
}

export function useScholarshipData({ courseId, address }: UseScholarshipDataProps) {
  const [data, setData] = useState<ScholarshipData>({
    vaultCreated: null, vaultBalance: null, scholarshipPerGuide: null,
    canSubmit: null, percentageCompleted: null, completedGuides: null,
    paidGuides: null, totalGuides: null, percentagePaid: null,
    scholarshipPaid: null, profileScore: null,
  })

  const fetchScholarship = useCallback(async () => {
    if (!courseId || !address) return
    try {
      const csrfToken = await getCsrfToken()
      if (!csrfToken) return
      const { data: res } = await axios.get(
        `/api/scholarship?courseId=${courseId}&walletAddress=${address}&token=${csrfToken}`
      )
      setData({
        vaultCreated: res.vaultCreated != null ? Boolean(res.vaultCreated) : null,
        vaultBalance: res.vaultBalance != null ? Number(res.vaultBalance) : null,
        scholarshipPerGuide: res.amountPerGuide != null ? Number(res.amountPerGuide) : null,
        canSubmit: res.canSubmit != null ? res.canSubmit : null,
        percentageCompleted: res.percentageCompleted != null ? Number(res.percentageCompleted) : null,
        completedGuides: res.completedGuides != null ? Number(res.completedGuides) : null,
        paidGuides: res.paidGuides != null ? Number(res.paidGuides) : null,
        totalGuides: res.totalGuides != null ? Number(res.totalGuides) : null,
        percentagePaid: res.percentagePaid != null ? Number(res.percentagePaid) : null,
        scholarshipPaid: res.amountScholarship != null ? Number(res.amountScholarship) : null,
        profileScore: res.profileScore != null ? Number(res.profileScore) : null,
      })
    } catch (e) {
      console.error('Failed to fetch scholarship data:', e)
    }
  }, [courseId, address])

  return { ...data, fetchScholarship }
}
