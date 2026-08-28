// Página de pastores GD — el componente vive en el motor gdcluster
// (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §13, GdPastoresLanding con deps inyectadas D2); la app consume el
// adapter del host (lib/gdcluster-ui.tsx).
import { use } from 'react'
import { GdPastoresLandingHost } from '@/lib/gdcluster-ui'

type PageProps = {
  params: Promise<{ lang: string }>
}

export default function Page({ params }: PageProps) {
  const { lang } = use(params)
  return <GdPastoresLandingHost lang={lang} />
}
