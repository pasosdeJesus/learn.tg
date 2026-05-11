'use client'

import { useMemo } from 'react'
import type { Guide } from './guideTypes'

interface UseGuideNavigationProps {
  guides: Guide[]
  currentSuffix?: string
  lang: string
  pathPrefix: string
}

export function useGuideNavigation({ guides, currentSuffix, lang, pathPrefix }: UseGuideNavigationProps) {
  return useMemo(() => {
    const coursePath = `/${lang}/${pathPrefix}`
    if (!currentSuffix || !guides.length) {
      return { coursePath, myGuide: null, guideNumber: 0, nextGuidePath: '', previousGuidePath: '' }
    }

    const currentIndex = guides.findIndex(g => g.sufijoRuta === currentSuffix)
    if (currentIndex === -1) {
      return { coursePath, myGuide: null, guideNumber: 0, nextGuidePath: '', previousGuidePath: '' }
    }

    const guideNumber = currentIndex + 1
    const myGuide = guides[currentIndex]
    const previousGuidePath = currentIndex > 0 ? `/${lang}/${pathPrefix}/${guides[currentIndex - 1].sufijoRuta}` : ''
    const nextGuidePath = currentIndex < guides.length - 1 ? `/${lang}/${pathPrefix}/${guides[currentIndex + 1].sufijoRuta}` : ''

    return { coursePath, myGuide, guideNumber, nextGuidePath, previousGuidePath }
  }, [guides, currentSuffix, lang, pathPrefix])
}
