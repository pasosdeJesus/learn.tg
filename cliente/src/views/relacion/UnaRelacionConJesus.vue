<script setup>
  import { ref, computed } from 'vue'
  import {
    conectar,
    estadoBoton
  } from '../../components/conexion.js'

  import Encabezado from '../../components/Encabezado.vue'
  import Piedepagina from '../../components/Piedepagina.vue'

  import {unified} from 'unified'
  import remarkDirective from 'remark-directive'
  import remarkFrontmatter from 'remark-frontmatter'
  import remarkGfm from 'remark-gfm'
  import remarkParse from 'remark-parse'
  import remarkRehype from 'remark-rehype'
  import rehypeStringify from 'rehype-stringify'

  import addFillInTheBlank from '../../lib/add-fill-in-the-blank'

  const titulo = ref("Una relación con Jesús")
  const subtitulo = ref("Guías breves para entablar una relación con Jesús como Salvador, Señor y amigo")
  const imagen = ref("/img/Jn6_col.jpg")
  const creditoImagen = ref("Dibujo de Juan Carlos Partidas de https://misdibujoscristianos.blogspot.com/")
  const enlaceImagen = ref("")
  const altImagen = ref("Dibujo de Jesús con pan y amigos")
  const resumenMd = ref(`

Jesús es más que una religión o una denominación, te invitamos a
conocerlo de manera personal.

Si quieres retroalimentar, preguntar o conocer más puedes escribir 
por WhatsApp o Telegram al +57 316 5383162 --si quieres una
videollamado propon un horario.

Si lo deseas también podemos ponerte en contacto con una iglesia
de paz cercana.
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
Que bueno que tengas una billetera conectada.

Buscamos ofrecer una beca para este curso a habitantes de Sierra Leona,
si quieres donar puedes hacerlo aquí.
`)
  const ampliaHtml = computed( () => htmlDeMd(ampliaMd.value) )

  const contenidoMd = ref(`
1. [No tengas miedo](/relacion/no-tengas-miedo)
2. [Encuentro con Jesus](/relacion/encuentro-con-Jesus)
3. [Ve a encontrate con Jesús](/relacion/ve-a-encontrarte-con-Jesus)
4. [Hablando con Dios](/relacion/hablando-con-Dios)
  `)
  const contenidoHtml = computed( () => htmlDeMd(contenidoMd.value) )

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
    <div class="tdc cont-flex-centro-vertical">
      <h2 class="titulo">Contenido del curso</h2>
      <div v-html='contenidoHtml'></div>
    </div>
    <template v-if="estadoBoton == 'Desconectar'">
      <div v-html='ampliaHtml'></div>
    </template>
    <template v-else>
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
