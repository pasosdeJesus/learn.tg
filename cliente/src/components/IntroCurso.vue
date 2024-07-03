<script setup>
  import { ref, computed } from 'vue'
  import {
    conectar,
    estadoBoton,
    pagarOKB,
    red
  } from '../lib/conexion.js'

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

  import { cursos } from '../definiciones'

  let purl = window.location.href.split("/")
  let miruta = purl[purl.length - 1] == "" && purl.length > 2 ? 
    purl[purl.length - 2] : purl[purl.length - 1]
  let micurso = cursos.filter( r => r.prefijoRuta == ("/" + miruta))[0]
  const titulo = ref(micurso.titulo)
  const subtitulo = ref(micurso.subtitulo)
  const imagen = ref(micurso.imagen)
  const creditoImagen = ref(micurso.creditoImagen)
  const enlaceImagen = ref(micurso.enlaceImagen)
  const altImagen = ref(micurso.altImagen)
  const resumenMd = ref(micurso.resumenMd)
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

  const ampliaMd = ref(micurso.ampliaMd)
  const ampliaHtml = computed( () => htmlDeMd(ampliaMd.value) )

  const prerequisitosHtml = computed( () => htmlDeMd(
    micurso.prerequisitosMd
  ) )
  let cursosPrerequisitoMd = ""
  if (typeof micurso.cursosPrerequisito != "undefined") {
    for (const prefijoCp of micurso.cursosPrerequisito) {
      let cp = cursos.filter( r => r.prefijoRuta == prefijoCp)[0]
      cursosPrerequisitoMd += "* " + "[" + cp.titulo + "](/" +
        cp.idioma + "/" + cp.prefijoRuta + ")\n"
    }
  }
  const cursosPrerequisitoHtml = computed( () => htmlDeMd(
    cursosPrerequisitoMd
  ) )


  let guias=""
  let numero = 1
  for (const guia of micurso.guias) {
    guias += '' + numero + ". "
    if (guia.posfijoRuta == null) {
      guias += guia.titulo 
    } else {
      guias += "[" + guia.titulo + "](/" + micurso.idioma +
        micurso.prefijoRuta + guia.posfijoRuta + ")"
    }
    guias += "\n"
    numero++
  }
  const contenidoMd = ref(guias)
  const contenidoHtml = computed( () => htmlDeMd(contenidoMd.value) )

  const porPagar = ref(micurso.porPagar)

</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <template v-if="porPagar == 0 || estadoBoton == 'Desconectar'">
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

      <template v-if="micurso.prerequisitosMd || micurso.cursosPrerequisito">
        <div class="tdc cont-flex-centro-vertical">
          <h2 class="titulo">Pre-requisitos</h2>
          <div v-html='prerequisitosHtml'></div>
          <template v-if="cursosPrerequisitoHtml != ''">
            Cursos 
            <div v-html='cursosPrerequisitoHtml'></div>
          </template>
        </div>
      </template>

      <div class="tdc cont-flex-centro-vertical">
        <h2 class="titulo">Contenido del curso / Course contents</h2>
        <div v-html='contenidoHtml'></div>
      </div>
      <template v-if="estadoBoton == 'Desconectar'">
        <div v-html='ampliaHtml'></div>
        <template v-if="red == 'Red: X Layer Mainnet' && porPagar > 0">
          <div class="cont-flex-centro">
            <button 
               class='btn ancho-8' 
                  @click='pagarOKB'>Inscribirse por {{porPagar}}OKB</button>
          </div>
        </template>
      </template>
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
