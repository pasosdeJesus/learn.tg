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

  const titulo = ref("Ahorra en dólares OKX")
  const subtitulo = ref("Con 5% de descuento al cambiar entre pesos y dólares y con una tasa de interés superior al 10% efectiva anual")
  const imagen = ref("/img/OKX_Logo.svg")
  const creditoImagen = ref("Logo de OKX")
  const enlaceImagen = ref("https://okx.com")
  const altImagen = ref("Logo de OKX")
  const resumenMd = ref(`

Pasos de Jesús es un afiliado a OKX por eso al registrarte 
como referido de Pasos de Jesús obtendrás un 5% de descuento 
en las comisiones de todas tus transacciones.

Una vez registrado y verificado podrás emplear el mercado P2P
para convertir parte de tus pesos en cuentas bancarias y billeteras 
colombianas en doláres digitales (USDT) en tu cuenta en OKX, donde podrás
ahorrarlos al 10% efectivo anual con pago de intereses cada
hora, intereses que se abonan a tu cuenta de ahorro para ganar
intereses también sobre los intereses.

En cualquier momento que necesites tus ahorros o parte de estos, retira
lo que necesitas del fondo de ahorro y conviertelo a pesos mediante el mercado
P2P.

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


  const prerequisitosMd = ref(`
En este curso gratuito te enseñamos como hacer estas operaciones, sólo necesitas:
1. Una cuenta bancaría en Colombia o una billetera en tu teléfono como
Nequí o Daviplata
2. Un celular con Android o IOS
3. Tu identificación personal para la verificación de identidad de OKX.
  `)
  const prerequisitosHtml = computed( () => htmlDeMd(prerequisitosMd.value) )


  const contenidoMd = ref(`
1. [Registrate como referido](/okx/registrate-como-referido)
2. [Compra USDT, Ahorra y Vende cuando quieras](/okx/compra-usdt-ahorra-y-vende)
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
      <h2 class="titulo">Pre-requisitos</h2>
      <div v-html='prerequisitosHtml'></div>
    </div>

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
