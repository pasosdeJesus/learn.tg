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
# Guía 1: No tengas miedo -  Marcos 6:45-52[^1]

> **45** En seguida hizo a sus discípulos entrar en la barca e ir delante 
  de él a Betsaida, en la otra ribera, entre tanto que él despedía a la 
  multitud. 
  **46** Y después que los hubo despedido, se fue al monte a orar; 
  **47** y al venir la noche, la barca estaba en medio del mar, y él solo en 
  tierra. 
  **48**Y viéndoles remar con gran fatiga, porque el viento les era contrario,
  cerca de la cuarta vigilia de la noche vino a ellos andando sobre el mar,
  y quería adelantárseles. 
  **49** Viéndole ellos andar sobre el mar, pensaron que era un fantasma, y 
  gritaron; 
  **50** porque todos le veían, y se turbaron. Pero en seguida habló con ellos,
  y les dijo: ¡Tened ánimo; yo soy, no temáis! 
  **51** Y subió a ellos en la barca, y se calmó el viento; y ellos se 
  asombraron en gran manera, y se maravillaban. 
  **52** Porque aún no habían entendido lo de los panes, por cuanto estaban 
  endurecidos sus corazones. 

> (Biblia traducción Reina Valera 1960)


![Dibujo de Jesús caminando sobre el lago](/img/camina_sobre_el_agua.jpg "Jesús
caminando sobre el lago")

[Jesús camina sobre el lago de Gustave Dore -- Dominio público](https://commons.wikimedia.org/wiki/File:Jesus_walks_on_the_sea.jpg)




## 1. Comprensión de lectura.

* Dos paisajes mencionados en esta lectura: ____ y ​​____
* ¿Adónde envió Jesús a sus discípulos? ____ ¿Obedecieron? ____
* ¿Qué fue a hacer Jesús solo después de despedir a la gente y a sus 
  discípulos?  ____
* La cuarta vigilia de la noche significa de 3AM a 6AM, suponiendo que fueran
  las 3AM cuando Jesús quiso partir y que envió a sus discípulos a Betsaida a
  las 6PM, ¿cuánto tiempo estuvieron remando sus discípulos? ___
* Al ver a sus discípulos angustiados, Jesús se acercó a la barca donde estaban
  ____ sobre el ____
* Los discípulos gritaron porque pensaron que el que caminaba sobre el lago era
  un ____
* Como los discípulos se asustaron, Jesús les dijo: “¡Ánimo! 
  ¡Soy yo! ____ ____  ____
* Entonces Jesús subió a la barca con ellos y además el viento ____
* Si lees el pasaje anterior a este en la Biblia, se trata de la 
  multiplicación milagros del pan, los discípulos no podían entender eso 
  y sus corazones estaban ____

## 2. Reflexión

* ¿De este pasaje qué te permite pensar que la historia realmente ocurrió?
* Es posible que haya escuchado comentarios sobre Jesús de otras
personas, pero hoy Él te dice directamente "No tenga miedo" y te decimos por
nuestra experiencia pesonal: Él es amor.

## 3. Aplicación

* ¿Cómo puedes aplicar lo que este pasaje enseña a tu vida?

[^1]:
     Preparado por Vladimir Támara Patiño.
     [vtamara@pasosdeJesus.org](mailto:vtamara@pasosdeJesus.org) y Julián
     Martinez. Este es contenido abierto con licencia. 
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

img[src*="celular"] {
  width: 100px;
}

</style>
