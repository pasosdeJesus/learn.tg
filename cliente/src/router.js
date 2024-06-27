import { createRouter, createWebHistory } from 'vue-router'

import { cursos, rutas } from './definiciones'

const router = createRouter({
  history: createWebHistory(),
  routes: rutas,
})

export default router
