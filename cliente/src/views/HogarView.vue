<script setup>
  import Encabezado from '../components/Encabezado.vue'
  import Piedepagina from '../components/Piedepagina.vue'
</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <div class="cursos">
      <div class="curso">
        <RouterLink to="/pastores-influenciadores" style="text-decoration: none">
          <div class="img-curso">
            <img src="/public/img/rollerskatewedding.svg">
          </div>
          <div class="desc-curso">
            <div class="titulo-curso">Pastores Influenciadores</div>
            <div class="res-curso">Curso dirigido a pastores menonitas
              colombianos, para que sean influenciadores en OKX,
              que aumenten la red de la iglesia para Cristo y den
              oportunidad laboral a algunos miembros de su iglesia
              como comerciantes.
            </div>
          </div>
        </RouterLink>
      </div>
      <div class="curso">
        <RouterLink to="/registrarse-en-okx-como-referido">
          <div class="img-curso">
            <img class="logo-okx" src="/public/img/OKX_Logo.svg">
          </div>
          <div class="desc-curso">
            <div class="titulo-curso">Registrate en OKX como referido</div>
            <div class="res-curso">
              Instrucciones para el público general para
              registrarse en OKX como referido para ganar
              un premio.
            </div>
          </div>
        </RouterLink>
      </div>
      <div class="curso">
        Compra, ahorra y vende criptoactivos
      </div>
      <div class="curso">
        Compra y vende como comerciante y sube nivel
      </div>
      <div class="curso">
        Aplica al programa de afiliados
      </div>


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
}

.logo-okx {
  max-width: 280px;
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

