<script setup>
  import { ref, computed } from 'vue'
  import {
    actualizarConexion, 
    conectar,
    cuenta,
    desconectar,
    estadoBoton,
    red
  } from '../components/conexion.js'

  actualizarConexion()

</script>

<template>
  <header class="encabezado-pagina">
    <div class="marca">
      <RouterLink to="/" class="enlace-plano">
        <div class="logo-titulo">
          <div class="aprender">Aprender</div>
          <div class="logo-titulo-medio">
            <div class="mediante">mediante</div>
            <img class="imglogo"src="/public/logo-learntg.png">
          </div>
          <div class="juegos">juegos</div>
        </div>
      </RouterLink>
    </div>
    <div class="controles">
      <template v-if="estadoBoton == 'Ingresar'">
        <button 
           class='btn ancho-8' 
           @click='conectar'>Ingresar</button>
      </template>
      <template v-else-if="estadoBoton == 'Desconectar'">
        <button 
          class='btn ancho-8' 
          @click='desconectar'>Desconectar</button>
      </template>
      <template v-else>
        <div v-html="enlace_celular" class='btn'></div>
      </template>
      <div class="cuenta-y-red">
        <div v-html="cuenta"></div>
        <div v-html="red"></div>
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

