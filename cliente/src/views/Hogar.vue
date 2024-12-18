<script setup>
  import Encabezado from '../components/Encabezado.vue'
  import Piedepagina from '../components/Piedepagina.vue'
  import {
    estadoBoton
    } from '../lib/conexion.js'
  import { cursos } from '../definiciones' 


</script>

<template>
  <Encabezado/>
  <div class=" overflow-x-hidden py-6 dark:bg-gray-100 dark:text-gray-900">
    <div class="container overflow-x-hidden py-6 dark:bg-gray-100 dark:text-gray-900 flex flex-row flex-wrap justify-center mt-8">
      <template v-for="curso in cursos">
        <div  class="flex flex-col justify-center w-full px-8 mx-6 my-12 py-9 text-center rounded-md md:w-96 lg:w-80 xl:w-65 bg-gray-300 dark:text-gray-900" 
        v-if="(estadoBoton == 'Ingresar' && curso.sinbilletera) || (estadoBoton == 'Desconectar' && curso.conbilletera)">
          <RouterLink :to="'/' + curso.idioma + curso.prefijoRuta">
          <div class="img-curso">
            <img class="w-[100%] h-[12rem] pt-2 object-cover" :src="curso.imagen">
          </div>
          <div>
            <div class="text-xl py-2 font-bold">{{curso.titulo}}</div>
            <div class="w-[90%] text-justify">{{curso.subtitulo}}</div>
          </div>
          </RouterLink>
        </div>
      </template>

    </div>
  </div>
  <Piedepagina/>
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
  width: 180px;
  height: 180px;
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
  min-width: 200px;
  background-color: white;
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

