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
# Compra USDT, ahorra y vende cuando quieras

Si te inscribiste como referido de pasosdeJesus.org tendrás
el 5% de descuento en la comisión que tipicamente OKX cobra 
al comprar o vender USDT.

## 1. Conoce la interfaz de OKX en celular

Te servirá conocer la pantalla principal de la aplicación OKX
en celular:

> ![Pantallazo enfoca puntos en aplicación de OKX](/img/verif1.jpg)

Nota que en la parte inferior tiene las pestañas OKX, 


## 2. Compra USDT en el mercado P2P


Dirigete a Comprar y desde allí elige mercado P2P.

Veras anuncios para quiens compran sus USDT y anuncios para quienes venden
sus USDT.   Entre los anuncios de quienes compran elije un vendedor que 
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
