import { createRouter, createWebHistory } from 'vue-router'

import HogarView from './views/HogarView.vue'
import PastoresInfluenciadoresView from 
  './views/PastoresInfluenciadoresView.vue'

const routes = [
    { path: '/', component: HogarView },
    { path: '/pastores-influenciadores', component: PastoresInfluenciadoresView },
]

const router = createRouter({
  history: createWebHistory(),
  routes: routes,
})

export default router
