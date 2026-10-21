// Página /es/referidos — versión en español de la página de referidos
// (https://github.com/pasosdeJesus/learn.tg/issues/163). El componente vive en el motor gdcluster; el host inyecta el
// hook de auth del core (D2, https://gitlab.com/pasosdeJesus/m/-/work_items/35). El enlace canónico en español es
// /es/referidos (el contenido ya se traduce en ReferralsPage según lang).
import { ReferralsPageHost } from '@/lib/gdcluster-ui'

export default function ReferidosPage() {
  return <ReferralsPageHost params={Promise.resolve({ lang: 'es' })} />
}
