<script setup>
  import Encabezado from '../components/Encabezado.vue'
  import Piedepagina from '../components/Piedepagina.vue'
  import {
    estadoBoton
    } from '../lib/conexion.js'
  import { cursos } from '../definiciones' 


</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <div class="cursos">
      <template v-for="curso in cursos">
        <div class="curso" v-if="(estadoBoton == 'Ingresar' && curso.sinbilletera) || (estadoBoton == 'Desconectar' && curso.conbilletera)">
          <RouterLink :to="'/' + curso.idioma + curso.prefijoRuta">
          <div class="img-curso">
            <img class="logo-relacion" :src="curso.imagen">
          </div>
          <div class="desc-curso">
            <div class="titulo-curso">{{curso.titulo}}</div>
            <div class="res-curso">{{curso.subtitulo}}</div>
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

