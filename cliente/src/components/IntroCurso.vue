<script setup>
  import { computed, onMounted, reactive, ref, watchEffect} from 'vue'

  import axios from 'axios';

  import {
    conectar,
    estadoBoton,
    pagarOKB,
    red
  } from '../lib/conexion.js'

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

  import { cursos } from '../definiciones'

  const miCurso = ref({})
  const titulo = ref("")
  const subtitulo = ref("")
  const imagen = ref("")
  const creditoImagen = ref("")
  const enlaceImagen = ref("")
  const altImagen = ref("")
  const resumenMd = ref("")
   // Idea de usar remark de freecodecamp
  const resumenHtml = ref("")

  const ampliaMd = ref("")
  const ampliaHtml = ref("")

  const prerequisitosHtml = null

  const cursosPrerequisitoHtml = null

  const contenidoMd = ref(null)
  const contenidoHtml = null

  const porPagar = ref("")

  const API_BUSCA_CURSOS_URL = 
    'http://127.0.0.1:3000/learntg-admin/proyectosfinancieros.json'
  const cursosj = ref([])

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


  onMounted(() => {
    debugger
    //isMounted.value = true
    let purl = window.location.href.split("/")
    let ruta = purl.length > 2 && purl[purl.length - 1] == "" ?
      purl[purl.length - 2] : purl[purl.length - 1]
      debugger
    let idioma = purl.length > 2 && purl[purl.length - 1] == "" ?
      purl[purl.length - 3] : purl[purl.length - 2]

    let url = `${API_BUSCA_CURSOS_URL}?` +
      `filtro[busprefijoRuta]=/${ruta}&` +
      `filtro[busidioma]=${idioma}`
    console.log(`Fetching ${url}`)
    axios.get(url)
      .then(response => {
        if (response.data) {
          debugger
          if (response.data.length != 1) {
            alert("No se encontró el curso")
            return false
          }
          let rcurso = response.data[0]
          miCurso.value = rcurso
          titulo.value = rcurso.titulo
          subtitulo.value = rcurso.subtitulo
          imagen.value = rcurso.imagen
          creditoImagen.value = rcurso.creditoImagen
          enlaceImagen.value = rcurso.enlaceImagen
          altImagen.value = rcurso.altImagen
          resumenMd.value = rcurso.resumenMd
          // Idea de usar remark de freecodecamp
          resumenHtml.value = htmlDeMd(rcurso.resumenMd)
          ampliaMd.value = rcurso.ampliaMd
          ampliaHtml.value = htmlDeMd(rcurso.ampliaMd)

          /*
          prerequisitosHtml.value = htmlDeMd(rcurso.prerequisitosMd)

          let cursosPrerequisitoMd = ""
          if (typeof miCurso.cursosPrerequisito != "undefined") {
           for (const prefijoCp of miCurso.cursosPrerequisito) {
             let cp = cursos.filter( r => r.prefijoRuta == prefijoCp)[0]
             cursosPrerequisitoMd += "* " + "[" + cp.titulo + "](/" +
               cp.idioma + "/" + cp.prefijoRuta + ")\n"
           }
          }
          cursosPrerequisitoHtml.value = htmlDeMd(cursosPrerequisitoMd)

          let guias=""
          let numero = 1
          for (const guia of rcurso.guias) {
            guias += '' + numero + ". "
            if (guia.posfijoRuta == null) {
             guias += guia.titulo 
            } else {
              guias += "[" + guia.titulo + "](/" + rcurso.idioma +
                rcurso.prefijoRuta + guia.posfijoRuta + ")"
            }
            guias += "\n"
            numero++
          }
          contenidoMd.value = guias
          contenidoHtml = htmlDeMd(guias)
          */
        }
      })
      .catch(error => {
        console.error(error);
      })

    porPagar.value = miCurso.porPagar

  })
</script>

<template>
  <Encabezado></Encabezado>
  <div class="container flex flex-col mx-auto lg:flex-row ">
    <template v-if="porPagar == 0 || estadoBoton == 'Desconectar'">
      <div class="flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 lg:w-1/2 xl:w-3/5">
        <div>
          <div class="text-2xl lg:text-2xl font-bold pb-6 pt-14 text-center"><h1>{{titulo}}</h1></div>
          <div class="text-1xl lg:text-1xl font-bold"><h2>{{subtitulo}}</h2></div>
        </div>
        <div class="imagen">
          <figure>
            <img v-bind:src="imagen" width="300px" v-bind:alt="altImagen" class="py-6">
            <figcaption class="pb-6">
              <a
                target="_blank"
                v-bind:href="enlaceImagen">
                {{creditoImagen}}
              </a>
            </figcaption>
          </figure>
        </div>
        <div v-html='resumenHtml'></div>
      </div>
    </template>
    <div class="my-20 pt-7">
      <template v-if="miCurso.prerequisitosMd || miCurso.cursosPrerequisito">
        <div  class="px-6 py-8 h-full  w-full space-y-46 sm:p-8 lg:p-12 lg:w-5/18 xl:w-5/18 rounded-sm bg-secondary-100 dark:text-gray-50"
        >
          <h2 class="text-2xl lg:text-2xl font-bold py-8 text-white">Pre-requisitos</h2>
          <div v-html='prerequisitosHtml'></div>
          <template v-if="cursosPrerequisitoHtml != ''">
            Cursos 
            <div v-html='cursosPrerequisitoHtml'></div>
          </template>
        </div>
      </template>
      <div  class="px-6 py-8 h-full  w-full space-y-46 sm:p-8 lg:p-12 lg:w-5/18 xl:w-5/18 rounded-sm bg-secondary-100 dark:text-gray-50"
    >
        <h2 class="text-2xl lg:text-2xl font-bold py-8 text-white">
          <template v-if="miCurso.idioma == 'en'">Course contents</template>
          <template v-else>Contenido del curso</template>
        </h2>
        <div v-html='contenidoHtml' active-class="active"  class="text-base/10"></div>
      </div>
      <template v-if="estadoBoton == 'Desconectar'">
        <div v-html='ampliaHtml'></div>
        <template v-if="red == 'Red: X Layer Mainnet' && porPagar > 0">
          <div>
            <button 
               class="hidden md:block px-8 py-3 rounded-full text-white font-medium tracking-wider uppercase bg-secondary-100 w-full lg:w-auto"
                  @click='pagarOKB'>Inscribirse por {{porPagar}}OKB</button>
          </div>
        </template>
      </template>
    </div>
  </div>
  <PieDePagina></PieDePagina>
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
