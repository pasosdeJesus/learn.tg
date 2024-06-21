<script setup>
  import { ref, computed } from 'vue'
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

  const textoMd = ref(`
# Curso: Ahorra en dólares en OKX

## Guía 2. Compra USDT, ahorra y vende cuando quieras

Si te inscribiste como referido de pasosdeJesus.org tendrás
el 5% de descuento en la comisión que tipicamente OKX cobra 
al hacer trading.  Si aún no te has inscrito
[sigue las instrucciones de la Guia 1](okx/registrate-como-referido).

### 1. Conoce la interfaz de OKX en celular

Te servirá conocer la pantalla principal de la aplicación OKX
en celular.

> ![Pantallazo enfoca puntos en aplicación de OKX](/img/verif1.jpg)

Nota que entre otros detalles ves tu saldo y los precios de
algunos criptoactivos. En la parte superior debe decir **Exchange**
y en la parte inferior debe estar marcada la pestaña **OKX** (si
no lo estás presionando en esta llegarás a la pantalla principal):

### 2. Compra USDT en el mercado P2P

Desde la pantalla principal de OKX presiona el botón \`Trading P2P\`
para ver los anuncios de compra que debe lucir como así:


Asegurate que en la parte superior está elegida la pestaña \`Comprar\`
para ver anuncios para quienes quieren comprar USDT.

Entre los anuncios elije un vendedor que 
tenga varias transacciones y buen porcentaje de transacciones completadas
y de recomendación.

Elige un medio de pago, Nequi, Bancolombia, Daviplata, etc.

## 2. Ahorra los USDT

...

## 3. Cambia los USDT por pesos con 5% de descuento

...



`)
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
    let html = processor.processSync(textoMd.value).toString()

    return html
  })
</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <div v-html='htmlGen'></div>
  </div>
  <Piedepagina></Piedepagina>
</template>

<style scoped>

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
