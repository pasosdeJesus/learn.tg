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

  const titulo = ref("A relationship with Jesus")
  const subtitulo = ref("Four brief guides to start a relationship with Jesus as Savior, Lord and friend" ) 
  const imagen = ref("/img/Jn6_col.jpg")
  const creditoImagen = ref("A drawing of Juan Carlos Partidas from https://misdibujoscristianos.blogspot.com/")
  const enlaceImagen = ref("")
  const altImagen = ref("A drawing of Jesus with bread and friends")
  const resumenMd = ref(`

Jesus is more than a religion and a denomination, we invite you to get to know
Him personally.

If you want to give us feedback, to ask or to know more, you can write to us
on WhatsApp or Telegram to the phone number +57 316 5383162 --if you want
a videocall please propose a schedule.

If you want, we can also connect you with a church nearby.
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
How great it is, that you have a wallet connected.

We are working to offer small scolarships for this course to
inhabitants of Sierra Leone, if you want to help, please donate here.
`)
  const ampliaHtml = computed( () => htmlDeMd(ampliaMd.value) )

  const contenidoMd = ref(`
1. [Don't be afraid](/relationship/dont-be-afraid)
2. [Meeting with Jesus](/relationship/meeting-with-Jesus)
3. [Go out to meet Jesus](/relationship/goe-out-to-meet-Jesus)
4. [Talking With God](/relationship/talking-with-God)
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
      <h2 class="titulo">Course contents</h2>
      <div v-html='contenidoHtml'></div>
    </div>
    <template v-if="estadoBoton == 'Desconectar'">
      <div v-html='ampliaHtml'></div>
    </template>
    <template v-else>
      <div class="cont-flex-centro">
        <button 
           class='btn ancho-8' 
           @click='conectar'>Login</button>
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
