<script setup>
  import Encabezado from '../components/Encabezado.vue'
  import Piedepagina from '../components/Piedepagina.vue'
</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <RouterLink to="/pastores-influenciadores">Pastores Influenciadores</RouterLink>
  </div>
  <Piedepagina></Piedepagina>
</template>
