// Página de referidos: el componente vive en el motor gdcluster; el host
// inyecta el hook de auth del core (D2, REQ/35).
import { ReferralsPageHost } from '@/lib/gdcluster-ui'

export default function ReferralsPage(props: { params: Promise<{ lang: string }> }) {
  return <ReferralsPageHost params={props.params} />
}
