<script setup>
  import Guia from '../../components/Guia.vue'

  const textoMd = `
Si te inscribiste como referido de pasosdeJesus.org tendrás
el 5% de descuento en la comisión que tipicamente OKX cobra 
al hacer trading.  Si aún no te has inscrito
[sigue las instrucciones de la Guia 1](okx/registrate-como-referido).

### 1. Conoce la interfaz de OKX en celular

Te servirá conocer la pantalla principal de la aplicación OKX
en celular.

> ![Pantallazo enfoca puntos en aplicación de OKX](/img/verif1.jpg)

Nota que entre otros detalles ves tu saldo y los precios de
algunos criptoactivos. En la parte superior debe decir **Exchange**
y en la parte inferior debe estar marcada la pestaña **OKX** (si
no lo estás presionando en esta llegarás a la pantalla principal):

### 2. Compra USDT en el mercado P2P

Desde la pantalla principal de OKX presiona el botón \`Trading P2P\`
para ver los anuncios de compra que debe lucir como así:


Asegurate que en la parte superior está elegida la pestaña \`Comprar\`
para ver anuncios para quienes quieren comprar USDT.

Entre los anuncios elije un vendedor que 
tenga varias transacciones y buen porcentaje de transacciones completadas
y de recomendación.

Elige un medio de pago, Nequi, Bancolombia, Daviplata, etc.

## 2. Ahorra los USDT

...

## 3. Cambia los USDT por pesos con 5% de descuento

...

`
</script>

<template>
  <Guia :textoMd="textoMd"/>
</template>
