<script setup>
</script>

<template>
  <RouterView />
</template>

<style >

.contenido {
  margin-top: 100;
  padding-top: 6rem;
  padding-left: 4rem;
  padding-right: 4rem;
  padding-bottom: 4rem;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  font-family: "DM Sans", sans-serif;
  font-optical-sizing: auto;
  font-weight: 300;
  font-style: normal;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
}
</style>
