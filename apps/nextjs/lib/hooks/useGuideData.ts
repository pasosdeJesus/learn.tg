'use client'

import { useCourse } from './useCourse'
import { useGuideNavigation } from './useGuideNavigation'
import type { Course, Guide } from './guideTypes'

export type { Course, Guide }

interface UseGuideDataProps {
  lang: string
  pathPrefix: string
  pathSuffix?: string
}

export function useGuideData({ lang, pathPrefix, pathSuffix }: UseGuideDataProps) {
  const { course, loading, error } = useCourse({ lang, pathPrefix })
  const { myGuide, guideNumber, nextGuidePath, previousGuidePath, coursePath } =
    useGuideNavigation({
      guides: course?.guias || [],
      currentSuffix: pathSuffix,
      lang,
      pathPrefix,
    })

  return {
    course,
    loading,
    error,
    myGuide,
    guideNumber,
    nextGuidePath,
    previousGuidePath,
    coursePath,
  }
}
