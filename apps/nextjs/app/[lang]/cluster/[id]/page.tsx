// Página de detalle de clúster — el componente vive en el motor gdcluster
// (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §13, ClusterPage con deps inyectadas D2); la app consume el
// adapter del host (lib/gdcluster-ui.tsx).
import { use } from 'react'
import { ClusterPageHost } from '@/lib/gdcluster-ui'

type PageProps = {
  params: Promise<{
    lang: string
    id: string
  }>
}

export default function Page({ params }: PageProps) {
  const { lang, id } = use(params)
  return <ClusterPageHost lang={lang} id={id} />
}
