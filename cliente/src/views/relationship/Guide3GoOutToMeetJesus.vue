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

# Guia 3: Ve a encontrarte con Jesús - Juan 11:17-27[^1]

> **17** Vino, pues, Jesús, y halló que hacía ya cuatro días que Lázaro
  estaba en el sepulcro.
  **18** Betania estaba cerca de Jerusalén, como a quince estadios;
  **19** y muchos de los judíos habían venido a Marta y a María, para
  consolarlas por su hermano.
  **20** Entonces Marta, cuando oyó que Jesús venía, salió a encontrarle;
  pero María se quedó en casa.
  **21** Y Marta dijo a Jesús: Señor, si hubieses estado aquí, mi hermano
  no habría muerto.
  **22** Mas también sé ahora que todo lo que pidas a Dios, Dios te lo dará.
  **23** Jesús le dijo: Tu hermano resucitará.
  **24** Marta le dijo: Yo sé que resucitará en la resurrección, en el
  día postrero.
  **25** Le dijo Jesús: Yo soy la resurrección y la vida; el que cree en mí,
  aunque esté muerto, vivirá.
  **26** Y todo aquel que vive y cree en mí, no morirá eternamente.
  ¿Crees esto?
  **27** Le dijo: Sí, Señor; yo he creído que tú eres el Cristo, el
  Hijo de Dios, que has venido al mundo.


![Cuadro de la resurrección de Lazaro](/img/RaisingOfLazarusBloch.jpg "Cuadro de la resurrección de Lazaro")

[Resurrección de Lazaro por Carl Bloch](https://commons.wikimedia.org/wiki/File:RaisingofLazarusBloch.jpg)


## 1. Comprensión de lectura

* ¿Cuáles son los personajes de la historia ?
* ¿Quién había muerto?
* ¿Has sido consolado alguna vez por alguien cuando enfrentas una situación de desesperanza?
* ¿De acuerdo con la lectura  quién sale al encuentro con Jesús?
* ¿Cual es la respuesta de Jesus en el versículo 23?
* ¿Cuál es la respuesta de Marta en el versículo 26?
* **_Completa la frase_**:  Le dijo Jesús: Yo soy la resurrección y la vida; el que cree en mí, aunque esté muerto _________
* ¿Cuál es la respuesta de Jesus en el versículo 25?
* ¿Cuál era la distancia aproximada entre Betania y Jerusalén?
* ¿Cuál es la ciudad en la que vive Maria de acuerdo con la información que proporciona el texto?

## Reflexión

* ¿Confiarías en alguien que tiene el poder de superar la muerte? Jesús de 
Nazaret al contrario de la gran mayoría de los dioses no quiere que 
nosotros nos acerquemos primero, sino que Él se acercó a nosotros 
por amor a través  de Jesús para que nosotros nos pudiéramos acercar a Él.

## Aplicación

* ¿Cómo puedes aplicar lo que este pasaje enseña a tu vida?
* Desafío de memorización: _porque todos le vieron, y se turbaron. Le dijo Jesús: Yo soy la resurrección y la vida; el que cree en mí, aunque esté muerto, vivirá._ Juan 11:25



[^1]:
     Preparado por Julían Martínez y Vladimir Támara Patiño [vtamara@pasosdeJesus.org](mailto:vtamara@pasosdeJesus.org). Este es contenido abierto con licencia.
     [CC-BY Internacional 4.0](https://creativecommons.org/licenses/by/4.0/)


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

img {
  width: 100px;
}

</style>
