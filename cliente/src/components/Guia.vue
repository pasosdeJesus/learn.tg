
<script setup>
  import { ref, computed } from 'vue'
  import Encabezado from './Encabezado.vue'
  import Piedepagina from './Piedepagina.vue'

  import {unified} from 'unified'
  import remarkDirective from 'remark-directive'
  import remarkFrontmatter from 'remark-frontmatter'
  import remarkGfm from 'remark-gfm'
  import remarkParse from 'remark-parse'
  import remarkRehype from 'remark-rehype'
  import rehypeStringify from 'rehype-stringify'

  import addFillInTheBlank from '../lib/add-fill-in-the-blank'

  import { useAttrs } from 'vue'

  const props = defineProps({
    textoMd: String
  })
  const rTextoMd=ref(props.textoMd)

  import { cursos } from '../definiciones'

  let purl = window.location.href.split("/")
  let miruta = purl[purl.length - 1] == "" && purl.length > 2 ?
    purl[purl.length - 2] : purl[purl.length - 1]
  let prefijoCurso = purl[purl.length - 1] == "" && purl.length > 2 ?
    purl[purl.length - 3] : purl[purl.length - 2]
  let miCurso = cursos.filter( r => r.prefijoRuta == ("/" + prefijoCurso))[0]
  let rutaCurso = "/" + miCurso.idioma + miCurso.prefijoRuta
  let numGuia = 0;
  let miGuia = null;
  for(let g=0; g<miCurso.guias.length; g++) {
    if (miCurso.guias[g].posfijoRuta == ("/" + miruta)) {
      numGuia = g + 1;
      miGuia = miCurso.guias[g]
    }
  }

  let rutaGuiaAnterior = null
  if (numGuia > 1) {
    let ga = miCurso.guias[numGuia-2]
    rutaGuiaAnterior = "/" + miCurso.idioma + miCurso.prefijoRuta +
      ga.posfijoRuta
  }

  let rutaGuiaSiguiente = null
  if (numGuia < miCurso.guias.length) {
    let gs = miCurso.guias[numGuia]
    rutaGuiaSiguiente = "/" + miCurso.idioma + miCurso.prefijoRuta +
      gs.posfijoRuta
  }

  // Idea de usar remark de freecodecamp
  const htmlGen = computed( () => {
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(addFillInTheBlank)
      .use(remarkRehype)
      .use(rehypeStringify)
    let html = processor.processSync(rTextoMd.value).toString()

    return html
  })
  const creditosGen = computed( () => {
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(addFillInTheBlank)
      .use(remarkRehype)
      .use(rehypeStringify)
    let html = processor.processSync(miGuia.creditosMd).toString()

    return html
  })

</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <div class="cont-flex-centro">
      <h3>Curso: {{miCurso.titulo}}</h3>
    </div>
    <h1>Guía {{numGuia}}: {{miGuia.titulo}}</h1>
    <div v-html='htmlGen'></div>
    <template v-if="creditosGen != ''">
      <h2>Créditos</h2>
      <div v-html="creditosGen"></div>
    </template>
  </div>
  <table width="100%" border="1px">
    <td width="33%">
      <template v-if="numGuia>1">
        <a :href="rutaGuiaAnterior">Guía anterior</a>
      </template>
    </td>
    <td width="34%" style="text-align: center"><a :href="rutaCurso">Inicio del Curso</a></td>
    <td class="cont-flex-derecha">
      &nbsp;
      <template v-if="numGuia < miCurso.guias.length">
        <a :href="rutaGuiaSiguiente">Guía siguiente</a>
      </template>
    </td>
  </table>
  <div>&nbsp;</div>

  <Piedepagina></Piedepagina>
</template>

<style scoped>

.cont-flex-derecha {
  display: flex;
  justify-content: right;
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

img[src*="celular"] {
  width: 100px;
}

</style>
