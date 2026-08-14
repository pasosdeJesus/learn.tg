import { use } from 'react'
import { GdPastoresLanding } from '@/components/GdPastoresLanding'

type PageProps = {
  params: Promise<{ lang: string }>
}

export default function Page({ params }: PageProps) {
  const { lang } = use(params)
  return <GdPastoresLanding lang={lang} />
}
