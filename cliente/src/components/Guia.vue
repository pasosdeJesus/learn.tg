
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
    let html = processor.processSync(miCurso.creditosMd).toString()

    return html
  })

</script>

<template>
  <Encabezado></Encabezado>
  <div class="pt-16  dark:bg-gray-100 dark:text-gray-800">
    <div class="container p-4 px-8 md:px-16 mx-auto pt-16 space-y-1">
      <h3 class="pb-3 text-3xl font-bold md:text-4xl text-center">
        <template v-if="miCurso.idioma == 'en'">Course:</template>
        <template v-else>Curso:</template>
        {{miCurso.titulo}}</h3>
    </div>
    <h1 class="py-3 px-16 text-1xl font-bold md:text-1xl">
      <template v-if="miCurso.idioma == 'en'">Guide</template>
      <template v-else>Guía</template>
      {{numGuia}}: {{miGuia.titulo}}
    </h1>
    <div v-html='htmlGen' class="py-3 px-16 text-1xl md:text-1xl text-justify"></div>
    <template v-if="creditosGen != ''">
      <h2 class="px-16 text-1xl font-bold md:text-1xl">
        <template v-if="miCurso.idioma == 'en'">Credits</template>
        <template v-else>Créditos</template>
      </h2>
      <div v-html="creditosGen" class="py-3 px-16 text-1xl md:text-1xl text-justify"></div>
    </template>
    <table class="mx-auto text-center mt-12">
    <tbody>
      <tr>
        <td>
          <template v-if="numGuia>1">
            <a :href="rutaGuiaAnterior" class="inline-flex items-center bg-gray-800 text-white border-r border-gray-100 py-2 px-3 hover:bg-secondary-100 hover:text-white">
              <template v-if="miCurso.idioma == 'en'">Previous Guide</template>
              <template v-else>Guía anterior</template>
            </a>
          </template>
        </td>
        <td>
          <a :href="rutaCurso" class="inline-flex items-center bg-gray-800 text-white py-2 px-3 hover:bg-secondary-100 hover:text-white">
            <template v-if="miCurso.idioma == 'en'">Start of Course</template>
            <template v-else>Inicio del Curso</template>
          </a>
        </td>
        <td>
          &nbsp;
          <template v-if="numGuia < miCurso.guias.length">
            <a :href="rutaGuiaSiguiente" class="inline-flex items-center bg-gray-800 text-white  py-2 px-3 hover:bg-secondary-100 hover:text-white">
              <template v-if="miCurso.idioma == 'en'">Next Guide</template>
              <template v-else>Guía siguiente</template>
            </a>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
  <div>&nbsp;</div>
  </div>
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
