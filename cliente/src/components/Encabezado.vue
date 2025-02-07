<script setup>
  import { ref } from 'vue'
  import {
    actualizarConexion, 
    cambiarXLayer,
    conectar,
    cuenta,
    desconectar,
    estadoBoton,
    red
  } from '../lib/conexion.js'

  actualizarConexion()

</script>

<template>
  <header ref="navbar" class="fixed top-0 left-0 w-full bg-primary-200 z-20">
    <div class="container flex items-center justify-between h-25" style="padding-right: 20px; padding-left: 30px;">
      <RouterLink to="/" class="ml-2" active-class="active">
        <div class="relative z-30 flex flex-col items-center gap-1 mb-1 lg:mb-0">
          <img src="/logo-learntg.png" class="rounded-full h-14 w-14 flex items-center justify-center" alt="imglogo" />
              <h6 class="circular-text text-secondary-100 font-bold">
                  <span style="font-family: DM Serif Display" class="text-secondary font-bold">Aprender mediante juegos</span>
              </h6>
        </div>
      </RouterLink>
      <div>
        <template v-if="estadoBoton == 'Ingresar'">
          <button class="px-8 py-3 rounded-full text-white font-medium tracking-wider uppercase bg-secondary-100 w-full lg:w-auto" @click='conectar'>Ingresar</button>
        </template>
        <template v-else-if="estadoBoton == 'Desconectar'">
        <button 
          class="px-8 py-3 rounded-full text-white font-medium tracking-wider uppercase bg-secondary-100 w-full lg:w-auto"
          @click='desconectar'>Desconectar</button>
        <div class="cuenta-y-red">
          <div v-html="cuenta"></div>
          <div v-html="red"></div>
          <template v-if="red != 'Red: X Layer Mainnet'">
            <div class="cont-flex-centro">
              <button 
                 class="px-8 py-3 rounded-full text-white font-medium tracking-wider uppercase bg-secondary-100 w-full lg:w-auto"
                 @click='cambiarXLayer'>X Layer</button>
            </div>
          </template>
        </div>
      </template>
      <template v-else>
        <div v-html="enlace_celular" class='btn'></div>
      </template>
      </div>
    </div>
  </header>
</template>

<style scoped>

.cuenta-y-red {
  text-align: center;
}

.titulo {
  text-align: right;
}

.enlace-plano {
  text-decoration: none;
  color: black;
}

.logo-titulo {
  width: 12rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: white;
  color: var(--color-1);
  /*font-family: "DM Serif Display", serif; */
  font-weight: 800;
  border-radius: 5%;

}

.logo-titulo-medio {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;

} 
.aprender {
  padding-left: 0.2rem;
}

.mediante {
}

.juegos {
  padding-right: 0.2rem;
}

.imglogo {
  width: 50px;
  padding-bottom: 5px;
}

.encabezado-pagina {
  position: fixed;
  width: 100%;
  top: 0px;
  left: 0px;
  height: 80px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, .8);
}

.marca {
  padding-left: 2em;
  height: 75px;
}

.controles {
  padding-right: 2em;
  height: 75px;
  display: flex;
  align-items: center;
  flex-direction: column;
}
</style>

