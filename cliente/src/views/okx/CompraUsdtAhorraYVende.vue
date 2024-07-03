<script setup>
  import Guia from '../../components/Guia.vue'

  const textoMd = `
Si aún no te has registrado en OKX
[sigue las instrucciones de la Guia 1](/es/ahorra-en-dolares-en-okx/registrate-como-referido)

### 1. Conoce la interfaz de OKX en tu celular

Te servirá conocer la pantalla principal de la aplicación OKX
en celular.

> ![Pantallazo enfoca puntos en aplicación de OKX](/img/verif1.jpg)

Nota que entre otros detalles ves tu saldo y los precios de
algunos criptoactivos. En la parte superior debe estar marcada la pestaña
**Exchange** y en la parte inferior debe estar marcada la pestaña **OKX** (si
no lo estás presionando en esta llegarás a la pantalla principal).

### 2. Compra USDT en el mercado P2P

Desde la pantalla principal de OKX presiona el botón \`Trading P2P\`
para ver los anuncios de compra que debe lucir como así:

> ![Pantallazo del mercado de Compra](/img/compra.jpg)

Asegurate que en la parte superior está elegida la pestaña \`Comprar\`
para ver anuncios para quienes quieren comprar USDT.

Desplazandote hacía abajo verás los anuncios de más vendedores, nota que
de cada uno se ve: 
* Ícono, nombre e ícono de reputación.  El ícono de la izquierda debe tener un
  punto verde que indica que está en línea, si no hay ícono a la derecha
  se trata de un comerciante Lite o principinate, si es una estrella
  verde es un comerciante Super con buena reputación ante OKX, si es un 
  diamante púrpura es un comerciante diamante con más de 100 transacciones y
  la mejor reputación ante OKX.
* Cantidad de transacciones que ha realizado, porcentaje de finalización y
  porcenaje de buenas calificaciones
* Precio que cobra por cada USDT
* Total de USDT que tiene disponible para la compra y botón para comprarle.
* Mínimo y máximo que vende por orden.
* Métodos de Pago --hemos notado que el medio de pago más usado es Nequi seguido de Bancolombia.


Elije un vendedor que tenga: bastantes transacciones,
buen porcentaje de finalización y de calificaciones positivas,
que venda a un precio bajo, que use uno de los método de pago
que usas y que sus límites de disponibilidad sean acordes a lo
que tienes disponible --i. Así mismo asegura que use uno de los medios
de pago que tengas disponibles 

## 2. Ahorra los USDT

...

## 3. Cambia los USDT por pesos

...

`
</script>

<template>
  <Guia :textoMd="textoMd"/>
</template>
