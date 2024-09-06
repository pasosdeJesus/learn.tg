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
  diamante púrpura es un comerciante diamante con más de 1000 transacciones y
  la mejor reputación ante OKX.
* Cantidad de transacciones que ha realizado, porcentaje de finalización y
  porcenaje de buenas calificaciones
* Precio que cobra por cada USDT
* Total de USDT que tiene disponible para la compra y botón para comprarle.
* Mínimo y máximo que vende por orden.
* Métodos de Pago --hemos notado que el medio de pago más usado es Nequi seguido de Bancolombia.


Puedes filtrar por método de pago para ver sólo comerciantes que usen tus
mismos métodos de pago.  Elije un vendedor que tenga: bastantes transacciones,
buen porcentaje de finalización y de calificaciones positivas,
que venda a un precio bajo, que use uno de los método de pago
que usas y que sus límites de disponibilidad sean acordes a lo
que tienes disponible.

Una vez presiones Comprar podrás diligenciar cuanto comprarás y confirmar 
para crear un orden de compra (que tendrá un número único que podrías 
usar en caso de requerir apelación).

Podrás ver las ordenes que tienes pendientes en la pestaña Ordenes que 
esta en la parte inferior del mercado P2P. 
Desde una orden podrás ver ingresar al chat o ver los detalles para el pago.

Es bueno que ingreses al chat para saludar, para asegurar que el comerciante
está en línea y para cuadrar detalles de la transaccción.  
Si el comerciante no está en línea puedes o bien cancelar la orden 
(aunque esto empeorará tu porcentaje de finalización) o bien proceder
con el pago pues en el peor caso, tendrías que iniciar una apelación 
adjuntando un video de tu medio de pago donde se vea la hora, tu nombre,
la historia reciente de transacciones y el envío de dinero que hiciste y 
después de 12 horas OKX te liberará los USDT del comerciante queno responda
--pero normalmente el comerciante para mantener su reputación te liberará tan
pronto se conecte.

Entre los detalles para el pago verás el número de cuenta en el medio 
de pago del comerciante y su nombre completo.  Emplea ese medio de pago
para hacer el pago y verifica que el nombre concuerde con el que de OKX.
(Tipicamente será así, en el caso eventual que sea diferente no pagues
e inicia una apelación explicando que el comerciante usa un nombre
diferente en el medio de pago y adjuntando un pantallazo donde se
ve el nombre en el medio de pago).


## 2. Ahorra los USDT

...

## 3. Cambia los USDT por pesos

El proceso pra cambiar USDT que tienes en OKX ...

`
</script>

<template>
  <Guia :textoMd="textoMd"/>
</template>
