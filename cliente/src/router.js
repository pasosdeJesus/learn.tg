import { createRouter, createWebHistory } from 'vue-router'

import PaginaInicial from './views/PaginaInicial.vue'

import IntroCurso from './views/IntroCurso.vue'
import GuiaCurso from './views/GuiaCurso.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/:idioma/:prefijoRuta',
      component: IntroCurso
    }, {
      path: '/:idioma/:prefijoRuta/:sufijoRuta',
      component: GuiaCurso
    }, {
      path: "/",
      component: PaginaInicial
    }
  ]
})
