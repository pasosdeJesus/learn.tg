<script setup>
  import { ref, computed } from 'vue'
  import {
    conectar,
    estadoBoton
  } from '../components/conexion.js'

  import Encabezado from '../components/Encabezado.vue'
  import Piedepagina from '../components/Piedepagina.vue'

  import {unified} from 'unified'
  import remarkDirective from 'remark-directive'
  import remarkFrontmatter from 'remark-frontmatter'
  import remarkGfm from 'remark-gfm'
  import remarkParse from 'remark-parse'
  import remarkRehype from 'remark-rehype'
  import rehypeStringify from 'rehype-stringify'

  import addFillInTheBlank from '../lib/add-fill-in-the-blank'

  const titulo = ref("Pastores menonitas como influenciadores de Cristo usando OKX")
  const subtitulo = ref("Oportunidad de bendición y para alcanzar más personas para Cristo")
  const imagen = ref("/img/rollerskatewedding.svg")
  const creditoImagen = ref("Basada en dibujo de j4p4n")
  const enlaceImagen =
    ref("https://openclipart.org/detail/189255/rollerskate-wedding")
  const altImagen = ref("Dibujo de pastor casando a una pareja en patines")
  const resumenMd = ref(`

Del 1.May.2024 al 1.Jul.2024 la plataforma OKX está ofreciendo la posibilidad 
de afiliarse como influenciador (influencer) para:
1. Obtener 50% de las ganancias de ese intercambiador (exchange) por cada 
   transacción hecha por las personas que se afilien mediante el 
   influenciador.
2. Hacer crecer la marca de cada influenciador junto con la de OKX y 
   ampliar la red de cada influenciador y de OKX.
3. Promover el uso de criptoactivos, que en mi humilde opinión 
   representan un ejercicio de libertad (por ejemplo del sistema bancario).

Estimado pastor menonita, yo Vladimir Támara tras usar OKX por más de un año
para ahorrar en dolares y cambiar pesos por dolares, veo oportunidades en la
actual campaña de OKX para influenciadores:

1. Para el público general de Colombia tanto de conocer a Cristo como de 
   ahorrar en dolares con una tasa superior al 10% anual.
2. Para miembros de la iglesia menonita que no tengan trabajo o que requieran
   un trabajo extra con horas flexibles, en el que además podrían
   invitar a las personas con las que interactuen a conocer a Cristo 
   e invitar a más público general a ahorrar y a conocer a Cristo.
3. Para pastores que podrían ser influenciadores con los miembros
   de sus comunidades que hagan el trabajo del punto 2.

Puedo estar equivocado por lo que oro por discernimiento y l@ invito a conocer
más en detalle la idea este viernes 17 de Mayo a las 6:30PM en una reunión 
virtual de una hora.  Por la visión es una invitación exclusiva para
pastores menonitas de Colombia. Si tiene interes en recibir el enlace 
por favor escribame por Telegram o WhatsApp al 3165383162.

  `)
  let htmlDeMd = (md) => {
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(addFillInTheBlank)
      .use(remarkRehype)
      .use(rehypeStringify)
    let html = processor.processSync(md).toString()

    return html
  }

   // Idea de usar remark de freecodecamp
  const resumenHtml = computed( () => htmlDeMd(resumenMd.value) )

  const ampliaMd = ref(`
Apliqué a ese programa de afiliados pero aún no he sido aceptado (dicen que
puede tomar hasta 14 días),
tal vez los pastores menonitas que tienen más influencia que yo (por
ejemplo en sus iglesias), sean aceptados más pronto.

Por mi situación personal (buena parte de ingresos en Colombia en pesos
pero la mayoría de gastos en dolares en Estados Unidos) he ganado experiencia 
como comerciante en el mercado P2P de OKX con el que he usando mi marca
pasosdeJesus.org y mis cuentas de Nequi y Bancolombia para comprar 
USDT (criptoactivo estable equivalente al dolar) a comienzo del 
mes tipicamente con 2% de ganancia y logro comprar un millón más
o menos cada 2 horas (es decir con un plante de un millón unos 20.000 
de ganancia cada 2 horas).
También he aprovechado para invitar a la iglesia a las personas con 
las que he interactuado. 
Por eso me parece que ese mercado puede ser oportunidad de trabajo extra 
para miembros de las iglesias menonitas.

Una vez cambio parte de mis ingresos en Colombia a USDT a comienzo
de mes, los dejo en un fondo de ahorro flexible durante el mes
para que ganen intereses en dolares y por hora a una 
tasa fluctuante superior al 10% anual (para montos inferiores a 1000 
dolares). Hace casi un año moví a ese fondo de ahorro, parte de
un Fondo para Misión a Sierra Leona --vigilado por el pastor Jaime Ramírez--
y estoy satisfecho con el resultado que supera el 11% en un año .
Al final del mes (o cuando necesito) retiro parte del ahorro lo
convierto y lo monetizó en Estados Unidos a una tasa baja.

Veo comerciantes que están conectados continuamente lo que me hace pensar
que puede ser su trabajo principal, he visto comercitantes por ejemplo
que no usan banco sino que reciben/entregan dinero en efectivo reuniendose
con el vendedor/comprador.
`)
  const ampliaHtml = computed( () => htmlDeMd(ampliaMd.value) )

  const contenidoMd = ref(`
1. Compra y vende como comerciante, invita a conocer de Cristo y sube de nivel
2. Aplica al programa de afiliados
3. Permitenos compartir o comparte de la posibilidad de trabajo con miembros de tu iglesia
4. Animemos a tu iglesia para que inviten al público general a conocer de Cristo
y que compartan posibilidad de ahorro
  `)
  const contenidoHtml = computed( () => htmlDeMd(contenidoMd.value) )

  const prerequisitosMd = ref(`
1. [Registrate en OKX como referido e instala la aplicación](/registrarse-en-okx-como-referido)
2. Compra, ahorra y vende USDT en OKX
  `)
  const prerequisitosHtml = computed( () => htmlDeMd(prerequisitosMd.value) )


</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <div class="cont-flex-centro">
      <div>
        <div class="titulo"><h1>{{titulo}}</h1></div>
        <div class="subtitulo"><h2>{{subtitulo}}</h2></div>
      </div>
      <div class="imagen">
        <figure>
          <img v-bind:src="imagen" width="300px" v-bind:alt="altImagen">
          <figcaption>
            <a
              target="_blank"
              v-bind:href="enlaceImagen"
              class="credito-imagen">
              {{creditoImagen}}
            </a>
                
          </figcaption>
        </figure>
      </div>
    </div>
    <div v-html='resumenHtml'></div>
    <template v-if="estadoBoton == 'Desconectar'">
      <div v-html='ampliaHtml'></div>
    </template>
    <template v-else>
      <div class="tdc cont-flex-centro-vertical">
        <h2 class="titulo">Pre-requisitos</h2>
        <div v-html='prerequisitosHtml'></div>
      </div>

      <div class="tdc cont-flex-centro-vertical">
        <h2 class="titulo">Contenido del curso</h2>
        <div v-html='contenidoHtml'></div>
      </div>
      <div class="cont-flex-centro">
        <button 
           class='btn ancho-8' 
           @click='conectar'>Ingresar</button>
      </div>
    </template>
  </div>
  <Piedepagina></Piedepagina>
</template>

<style scoped>

figcaption {
  font-size: 0.8rem;
  text-align: right;
}

.contenido {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tdc {
  color: black; 
  background-color: var(--color-2); 
}

.html-gen {
  width: 50%;
  padding: 1rem;
}

.area-de-texto {
  width: 100%
}

.texto-md {
  box-sizing: border-box;
  height: 100%;
  width: 50%;
  border: none;
  border-right: 1px solid #ccc;
  background-color: #f6f6f6;
  font-size: 14px;
  font-family: 'Monaco', courier, monospace;
  padding: 20px;
}
</style>
