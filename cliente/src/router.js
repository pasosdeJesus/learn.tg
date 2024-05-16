import { createRouter, createWebHistory } from 'vue-router'

import HogarView from './views/HogarView.vue'
import PastoresInfluenciadoresView from 
  './views/PastoresInfluenciadoresView.vue'
import RegistrarseEnOkxComoReferido from 
  './views/RegistrarseEnOkxComoReferido.vue'

const routes = [
  { path: '/', component: HogarView },
  { path: '/pastores-influenciadores', component: PastoresInfluenciadoresView },
  { path: '/registrarse-en-okx-como-referido', component: RegistrarseEnOkxComoReferido },
]

const router = createRouter({
  history: createWebHistory(),
  routes: routes,
})

export default router
