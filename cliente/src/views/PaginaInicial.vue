<script setup>
  import { onMounted, reactive, ref, watchEffect } from 'vue'

  import axios from 'axios';

  import {
    API_BUSCA_CURSOS_URL,
    API_PRESENTA_CURSO_URL
  } from '../definiciones.js'

  import Encabezado from '../components/Encabezado.vue'
  import PieDePagina from '../components/PieDePagina.vue'
  import { estadoBoton } from '../lib/conexion.js'
  //import { cursos } from '../definiciones' 

  const cursosj = ref([])
  const isMounted = reactive({ value: false });


  const configurar = async () => {
      isMounted.value = true
      console.log(estadoBoton)
      let url = API_BUSCA_CURSOS_URL
      if (estadoBoton.value == 'Desconectar') {
        url += "?proyectofinanciero[conBilletera]=true"
      }

      axios.get(url)
        .then(response => {
          if (response.data) {
            cursosj.value = response.data;
          }
        })
        .catch(error => {
          alert(error)
          console.error(error);
        })

  }

  onMounted(async () => {
    await configurar()
  })

  watchEffect(async () => {
    if (isMounted.value) {
      // Code to be executed on page refresh
      console.log('Page refreshed!');
      await configurar()
      // Fetch data here
    }
  });

</script>

<template>
  <Encabezado></Encabezado>
  <div class="overflow-x-hidden py-8 dark:bg-gray-100 dark:text-gray-900">
    <div class="overflow-x-hidden py-1 dark:bg-gray-100 dark:text-gray-900 flex flex-row flex-wrap justify-center mt-2">
      <template v-for="curso in cursosj" :key="curso.id">
        <div  class="flex flex-col justify-center w-full px-8 mx-6 my-12 py-9
              text-center rounded-md md:w-96 lg:w-80 xl:w-65 bg-gray-300
              dark:text-gray-900">
          <RouterLink :to="'/' + curso.idioma + curso.prefijoRuta">
          <div class="img-curso">
            <img class="w-[100%] h-[17rem] pt-2 object-cover" :src="curso.imagen">
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
  <PieDePagina></PieDePagina>
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

