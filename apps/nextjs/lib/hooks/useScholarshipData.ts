'use client'

import { useState, useCallback } from 'react'
import axios from 'axios'
import { getCsrfToken } from 'next-auth/react'

export interface ScholarshipData {
  vaultCreated: boolean | null
  vaultBalance: number | null
  vaultBalanceSlearn: number | null
  scholarshipPerGuide: number | null
  scholarshipPerGuideSlearn: number | null
  canSubmit: boolean | null
  percentageCompleted: number | null
  completedGuides: number | null
  paidGuides: number | null
  paidGuidesUSDT: number | null
  paidGuidesSLEARN: number | null
  totalGuides: number | null
  percentagePaid: number | null
  scholarshipPaid: number | null
  scholarshipPaidSlearn: number | null
  profileScore: number | null
}

interface UseScholarshipDataProps {
  courseId?: string | number
  address?: string
}

export function useScholarshipData({ courseId, address }: UseScholarshipDataProps) {
  const [data, setData] = useState<ScholarshipData>({
    vaultCreated: null, vaultBalance: null, vaultBalanceSlearn: null,
    scholarshipPerGuide: null, scholarshipPerGuideSlearn: null,
    canSubmit: null, percentageCompleted: null, completedGuides: null,
    paidGuides: null, paidGuidesUSDT: null, paidGuidesSLEARN: null, totalGuides: null, percentagePaid: null,
    scholarshipPaid: null, scholarshipPaidSlearn: null, profileScore: null,
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
        vaultBalanceSlearn: res.vaultBalanceSlearn != null ? Number(res.vaultBalanceSlearn) : null,
        scholarshipPerGuide: res.amountPerGuide != null ? Number(res.amountPerGuide) : null,
        scholarshipPerGuideSlearn: res.amountPerGuideSlearn != null ? Number(res.amountPerGuideSlearn) : null,
        canSubmit: res.canSubmit != null ? res.canSubmit : null,
        percentageCompleted: res.percentageCompleted != null ? Number(res.percentageCompleted) : null,
        completedGuides: res.completedGuides != null ? Number(res.completedGuides) : null,
        paidGuides: res.paidGuides != null ? Number(res.paidGuides) : null,
        paidGuidesUSDT: res.paidGuidesUSDT != null ? Number(res.paidGuidesUSDT) : null,
        paidGuidesSLEARN: res.paidGuidesSLEARN != null ? Number(res.paidGuidesSLEARN) : null,
        totalGuides: res.totalGuides != null ? Number(res.totalGuides) : null,
        percentagePaid: res.percentagePaid != null ? Number(res.percentagePaid) : null,
        scholarshipPaid: res.amountScholarship != null ? Number(res.amountScholarship) : null,
        scholarshipPaidSlearn: res.amountScholarshipSlearn != null ? Number(res.amountScholarshipSlearn) : null,
        profileScore: res.profileScore != null ? Number(res.profileScore) : null,
      })
    } catch (e) {
      console.error('Failed to fetch scholarship data:', e)
    }
  }, [courseId, address])

  return { ...data, fetchScholarship }
}
