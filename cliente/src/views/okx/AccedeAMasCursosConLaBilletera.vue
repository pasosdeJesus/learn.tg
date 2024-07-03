<script setup>
  import Guia from '../../components/Guia.vue'

  const textoMd = `

Este sitio ofrece más cursos, podrás ver el catálogo completo ingresando
desde un computador con tu billetera OKX.

### 1. Pasa del Exchange a la Billetera en la aplicación

### 2. Mueve dinero entre el exchange y la billetera

### 3. Instala la extensión para el navegador

La aplicación web de OKX no te permitirá ingresar a sitios con aplicaciones 
como esta (dApp que permite conexión a una billetera),
necesitarás bien la billetera en tu celular o si prefieres usar tu computador
instala la extension OKX Wallet en tu navegador:

* [Chrome y Brave](https://chrome.google.com/webstore/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge)
* [Edge](https://microsoftedge.microsoft.com/addons/detail/okx-wallet/pbpjkcldjiffchgbbndmhojiacbgflha)

### 4. Ingresa a este sitio

Una vez tengas instalada la billetera presiona el botón \`Ingresar\` y después
ve a la [página de inicio de este sitio](/).
`
</script>

<template>
  <Guia :textoMd="textoMd"/>
</template>
