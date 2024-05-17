<script setup>
  import { ref, computed } from 'vue'
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

  const titulo = ref("Compra, ahorra y vende USDT en OKX")
  const subtitulo = ref("Para los primeros 1000 USDT la tasa de ahorro es superior al 10% anual")
  const imagen = ref("public/img/usdtenokx.svg")
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
para ahorrar en dolares y cambiar pesos por dolares, deseo contarle que en la
actual campaña de OKX para influenciadores veo oportunidades especiales para:

1. El público general de Colombia tanto de conocer a Cristo como de ahorrar 
   en dolares con una tasa superior al 10% anual.
2. Miembros de la iglesia menonita que no tengan trabajo o que requieran
   un trabajo extra con horas flexibles: haciendo cambios de moneda,   
   invitando a las personas con las que interactuen a conocer a Cristo 
   e invitando a más público general a ahorrar y a conocer a Cristo.
3. Pastores que podrían ser influenciadores con sus comunidades invitando 
   y mostrandoles a miembros de su iglesia como hacer el trabajo del punto 2
   y expaniendo la iglesia con público del punto 1.

Puedo estar equivocado por lo que oro por discernimiento y l@ invito a conocer
más en detalle la idea este viernes 17 de Mayo a las 6:30PM en una reunión 
virtual de una hora.  Por la visión es una invitación exclusiva para
pastores menonitas de Colombia. Si tiene interes en recibir el enlace 
por favor escribame por Telegram o WhatsApp al 3165383162.

  `)
   // Idea de usar remark de freecodecamp
  const resumenHtml = computed( () => {
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(addFillInTheBlank)
      .use(remarkRehype)
      .use(rehypeStringify)
    let html = processor.processSync(resumenMd.value).toString()

    return html
  })

  const contenidoMd = ref(`
1. [Registrate en OKX como referido e instala la aplicación](/registrarse-en-okx-como-referido)
2. Compra, ahorra y vende USDT en OKX
3. Compra y vende como comerciante, invita a conocer de Cristo y sube de nivel
4. Aplica al programa de afiliados
5. Comparte 1, 2 y 3 con miembros de tu iglesia
6. Con tu iglesia continuamente inviten al público general a conocer de Cristo y compartan 1 y 2
  `)
  const contenidoHtml = computed( () => {
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(addFillInTheBlank)
      .use(remarkRehype)
      .use(rehypeStringify)
    let html = processor.processSync(contenidoMd.value).toString()

    return html
  })

</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <div class="cont-flex-centro">
      <div class="titulo"><h1>{{titulo}}</h1></div>
      <div class="imagen"><img v-bind:src="imagen" width="200px"></div>
    </div>
    <div class="subtitulo"><h2>{{subtitulo}}</h2></div>
    <div v-html='resumenHtml'></div>
    <div class="cont-flex-centro">
      <button class='btn ancho-8'>Registrarse</button>
    </div>
    <div class="tdc cont-flex-centro-vertical">
      <h2 class="titulo">Contenido del curso</h2>
      <div v-html='contenidoHtml'></div>
    </div>
  </div>
  <Piedepagina></Piedepagina>
</template>

<style scoped>

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
