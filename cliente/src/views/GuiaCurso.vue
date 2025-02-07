<script setup>
  import { onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'

  const route = useRoute()

  import axios from 'axios';

  import {
    API_BUSCA_CURSOS_URL,
    API_PRESENTA_CURSO_URL
  } from '../definiciones.js'

  import Encabezado from '../components/Encabezado.vue'
  import PieDePagina from '../components/PieDePagina.vue'

  import {unified} from 'unified'
  import remarkDirective from 'remark-directive'
  import remarkFrontmatter from 'remark-frontmatter'
  import remarkGfm from 'remark-gfm'
  import remarkParse from 'remark-parse'
  import remarkRehype from 'remark-rehype'
  import rehypeStringify from 'rehype-stringify'

  import addFillInTheBlank from '../lib/add-fill-in-the-blank'

  const miCurso = ref({
    titulo: "",
    idioma: "",
    guias: [],
  })

  let numGuia = ref(0);

  const miGuia = ref({
    titulo: "",
  });

  const rutaCurso = ref("")

  const rutaGuiaSiguiente = ref("")

  const rutaGuiaAnterior = ref("")

  const htmlGuia = ref("")

  const htmlCreditos = ref("")


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

    // Agregamos estilo
    let html_con_tailwind = html.replaceAll(
      "<a href", '<a class="underline" href'
    ).replaceAll(
      "<blockquote>", '<blockquote class="ml-8 pt-2">'
    ).replaceAll(
      "<code>", '<code class="bg-gray-200">'
    ).replaceAll(
      "<h1>", '<h1 class="pt-6 pb-2 font-bold text-[1.9rem]">'
    ).replaceAll(
      "<h2>", '<h2 class="pt-6 pb-2 font-bold text-[1.7rem]">'
    ).replaceAll(
      "<h3>", '<h2 class="pt-6 pb-2 font-bold text-[1.5rem]">'
    ).replace(
      /(<img [^>]*)>/g, '$1 class="pb-2">'
    ).replace(
      /(<img [^>]*><\/p>\n)<p>/g, '$1<p class="flex justify-end">'
    ).replace(
      /(<ol[^>]*)>/g, '$1 class="block list-decimal ml-8">'
    ).replaceAll(
      "<p><img",
      '<p class="pt-4 flex justify-center">'+
      '<img'
    ).replace(
      /<p><a([^>]*youtube.com\/watch[^>]*)><img/g,
      '<p class="pt-4 pb-4 flex justify-center"><a target="_blank" $1><img'
    ).replace(
      /<p><a[^>]*("https:\/\/www.youtube.com\/embed[^"]*")><img[^>]*><\/a><\/p>/g,
      '<p class="pt-4 pb-4 flex justify-center">'+
      '<iframe width="560" height="315" '+
      'src=$1 title="Reproductor de video de YouTube" frameborder="0" '+
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; '+
      'gyroscope; picture-in-picture; web-share" '+
      'referrerpolicy="strict-origin-when-cross-origin" '+
      'allowfullscreen></iframe>'+
      '</p>'
    ).replaceAll(
      "<p>", '<p class="pt-2 pb-2">'
    ).replaceAll(
      "<ul>", '<ul class="block list-disc ml-8">'
    )

    return html_con_tailwind
  }

/*watch(
    () => route.params.id,
      (newId, oldId) => {
        // react to route changes...
      }
    ) */

  onMounted(() => {

    rutaCurso.value = `/${route.params.idioma}/${route.params.prefijoRuta}`
    let url = `${API_BUSCA_CURSOS_URL}?` +
      `filtro[busprefijoRuta]=/${route.params.prefijoRuta}&` +
      `filtro[busidioma]=${route.params.idioma}`
    console.log(`Fetching ${url}`)
    axios.get(url)
      .then(response => {
        if (response.data) {
          if (response.data.length != 1) {
            alert("No se encontró el curso")
            return false
          }
          let rcurso = response.data[0]

          let urld = API_PRESENTA_CURSO_URL.replace("curso_id", rcurso.id)
          console.log(`Fetching ${urld}`)
          axios.get(urld)
            .then(responsed => {
              if (responsed.data) {
                if (response.data.length != 1) {
                 alert("No se encontró el curso")
                 return false
                }
                let dcurso = responsed.data

                miCurso.value = dcurso

                for(let g=0; g < dcurso.guias.length; g++) {
                  if (dcurso.guias[g].sufijoRuta == (route.params.sufijoRuta)) {
                    numGuia.value = g + 1;
                    miGuia.value = dcurso.guias[g]
                  }
                }

                if (numGuia.value > 1) {
                  let ga = dcurso.guias[numGuia.value - 2]
                  rutaGuiaAnterior.value = "/" + dcurso.idioma +
                    dcurso.prefijoRuta + "/" + ga.sufijoRuta
                }

                if (numGuia.value < dcurso.guias.length) {
                  let gs = dcurso.guias[numGuia.value]
                  rutaGuiaSiguiente.value = "/" + dcurso.idioma +
                    dcurso.prefijoRuta + "/" + gs.sufijoRuta
                }


                htmlCreditos.value = htmlDeMd(dcurso.creditosMd)
                let urlg = window.location.href + ".md"
                console.log(`Fetching ${urlg}`)
                axios.get(urlg)
                  .then(response => {
                    if (response.data) {
                      htmlGuia.value = htmlDeMd(response.data)
                    }
                  })
                  .catch(error => {
                    console.error(error);
                  })
              }
            })
            .catch(error => {
              console.error(error);
            })
        }
      })
      .catch(error => {
        console.error(error);
      })

  })

</script>

<template>
  <Encabezado></Encabezado>
  <div class="pt-2  dark:bg-gray-100 dark:text-gray-800">
    <div class="container p-2 px-8 md:px-16 mx-auto pt-16 space-y-1">
      <h3 class="pb-1 text-1xl font-bold md:text-1xl text-center">
        <template v-if="miCurso.idioma == 'en'">Course:</template>
        <template v-else>Curso:</template>
        {{miCurso.titulo}}
      </h3>
    </div>
    <h1 class="py-3 px-16 text-[2rem] font-bold text-left">
      <template v-if="miCurso.idioma == 'en'">Guide </template>
      <template v-else>Guía </template>
      <span v-html="numGuia"></span>: {{miGuia.titulo}}
    </h1>
    <div v-html='htmlGuia' class="py-3 px-16 text-1xl md:text-1xl text-justify **:list-inside **:list-disc">
    </div>

    <template v-if="htmlCreditos != ''">
      <h2 class="px-16 text-1xl font-bold md:text-1xl">
        <template v-if="miCurso.idioma == 'en'">Credits</template>
        <template v-else>Créditos</template>
      </h2>
      <div v-html="htmlCreditos" class="py-3 px-16 text-1xl md:text-1xl text-justify"></div>
    </template>

    <table class="mx-auto text-center mt-12">
    <tbody>
      <tr>
        <td>
          <template v-if="numGuia > 1">
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
  </div>

  <div>&nbsp;</div>
  <PieDePagina></PieDePagina>
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
