import { createRouter, createWebHistory } from 'vue-router'

import Hogar from './views/Hogar.vue'

import AhorraEnDolaresEnOkx from
  './views/okx/AhorraEnDolaresEnOkx.vue'
import CompraUsdtAhorraYVende from
  './views/okx/CompraUsdtAhorraYVende.vue'
import RegistrateComoReferido from
  './views/okx/RegistrateComoReferido.vue'

import PastoresInfluenciadores from
  './views/PastoresInfluenciadores.vue'

import UnaRelacionConJesus from
  './views/relacion/UnaRelacionConJesus.vue'
import Guia1NoTengasMiedo from
  './views/relacion/Guia1NoTengasMiedo.vue'
import Guia2EncuentroConJesus from
  './views/relacion/Guia2EncuentroConJesus.vue'
import Guia3VeAEncontrarteConJesus from
  './views/relacion/Guia3VeAEncontrarteConJesus.vue'
import Guia4HablandoConDios from
  './views/relacion/Guia4HablandoConDios.vue'

const routes = [
  { path: '/', component: Hogar },
  { path: '/relacion/una-relacion-con-Jesus', component: UnaRelacionConJesus},
  { path: '/relacion/no-tengas-miedo', component: Guia1NoTengasMiedo},
  { path: '/relacion/encuentro-con-Jesus', component: Guia2EncuentroConJesus},
  { path: '/relacion/ve-a-encontrarte-con-Jesus', component: Guia3VeAEncontrarteConJesus},
  { path: '/relacion/hablando-con-Dios', component: Guia4HablandoConDios},
  { path: '/pastores-influenciadores', component: PastoresInfluenciadores },
  { path: '/okx/ahorra-en-dolares-en-okx', component: AhorraEnDolaresEnOkx},
  { path: '/okx/compra-usdt-ahorra-y-vende', component: CompraUsdtAhorraYVende},
  { path: '/okx/registrate-como-referido', component: RegistrateComoReferido},
  { path: '/registrarse-en-okx-como-referido', component: RegistrateComoReferido },
]

const router = createRouter({
  history: createWebHistory(),
  routes: routes,
})

export default router
