<script setup>
  import Encabezado from '../components/Encabezado.vue'
  import Piedepagina from '../components/Piedepagina.vue'
  import {
    estadoBoton
  } from '../components/conexion.js'


</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <div class="cursos">
      <div class="curso">
        <RouterLink to="/relacion/una-relacion-con-Jesus">
          <div class="img-curso">
            <img class="logo-relacion" src="/public/img/Jn6_col.jpg">
          </div>
          <div class="desc-curso">
            <div class="titulo-curso">Una relación con Jesús</div>
            <div class="res-curso">
              Cuatro breves guías para empezar
              una relación con Jesús como Señor, Salvador y amigo.
            </div>
          </div>
        </RouterLink>
      </div>

      <div class="curso">
        <RouterLink to="/okx/ahorra-en-dolares-en-okx">
          <div class="img-curso">
            <img class="logo-okx" src="/public/img/OKX_Logo.svg">
          </div>
          <div class="desc-curso">
            <div class="titulo-curso">Ahorra en dólares en OKX</div>
            <div class="res-curso">
              Aprende a cambiar tus pesos colombianos por dólares 
              y a ahorrar en dólares con una tasa superior al 
              10% efectivo anual sin tiempo mínimo de retención de tu dinero.
            </div>
          </div>
        </RouterLink>
      </div>

      <template v-if="estadoBoton == 'Desconectar'">
        <div class="curso">
          <RouterLink to="/cursos-de-ahorro-de-mas-del-100" style="text-decoration: none">
          <div class="img-curso">
            <img src="/public/img/rollerskatewedding.svg">
          </div>
          <div class="desc-curso">
            <div class="titulo-curso">
              Cursos de ahorro de mas del 100%
            </div>
            <div class="res-curso">Aprende como puedes pagar con
              tu billetera OKX en este sitio para ver nuestro catálogo 
              vigente en Junio de 2024 de cursos de inversiones 
              de bajo riesgo, corto plazo y utilidad superior al 100% 
              efectivo anual.
            </div>
          </div>
          </RouterLink>
        </div>
      </template>


    </div>
  </div>
  <Piedepagina></Piedepagina>
</template>

<style>

.img-curso { 
  display: flex;
  justify-content: center;
}

.img-curso img {
  width: 100%;
  max-width: 400px;
  max-height: 280px;
}

.logo-okx {
  width: 200px;
  height: 200px;
}

.enlace-plano {
  texto-decoration: none;
}

.cursos {
  display: flex;
  flex-flow: row wrap;
  justify-content: space-around;
  align-content: space-around;
  background: var(--color-2);
  gap: 10px;
}

.curso {
  border: 1px solid var(--color-4);
  width: 25%;
  height: 25rem;
  border-radius: 10px;
}

.curso a {
  text-decoration: none;
}

.desc-curso {
  background-color: white;
  color: black;
}

.titulo-curso {
  font-weight: 800;
  padding-top: 1rem;
  text-align: center;
}

.res-curso {
  padding: 1rem;
  text-align: justify;
}

  
</style>

