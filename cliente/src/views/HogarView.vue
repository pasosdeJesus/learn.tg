<script setup>
  import Encabezado from '../components/Encabezado.vue'
  import Piedepagina from '../components/Piedepagina.vue'
</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <div class="curso">
      <RouterLink to="/pastores-influenciadores">Pastores Influenciadores</RouterLink>
    </div>
    <div class="curso">
      <RouterLink to="/registrarse-en-okx-como-referido">Registrate en OKX como referido e instala la aplicación</RouterLink>
    </div>
  </div>
  <Piedepagina></Piedepagina>
</template>
