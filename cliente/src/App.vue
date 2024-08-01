<script setup>
</script>

<template>
  <RouterView />
</template>

<style >

:root {
  --color-1: #714BA6;
  --color-2: #B9A3D9;
  --color-3: #8D69BF;
  --color-4: #4C4359;
  --color-5: #A63005;
}

.cont-flex-centro-vertical {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.cont-flex-centro {
  display: flex;
  justify-content: center;
  flex-direction: row;
  flex-wrap: wrap;
}

.ancho-8 {
  width: 8rem;
}

.btn {
  color: white;
  font-size: 1rem;
  font-weight: 900;
  line-height: 35px;
  text-align: center;
  border-radius: 20px;
  cursor: pointer;
  background: var(--color-1);
  border-color: var(--color-4);
}

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
