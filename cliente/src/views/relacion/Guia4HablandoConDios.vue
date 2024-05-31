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

# Guia 4: Hablando con Dios - Hechos 8:26-39[^1]


> **26** Un ángel del Señor habló a Felipe, diciendo: Levántate y ve hacia 
  el sur, por el camino que desciende de Jerusalén a Gaza, el cual es 
  desierto. 
  **27** Entonces él se levantó y fue. Y sucedió que un etíope, eunuco, 
  funcionario de Candace reina de los etíopes, el cual estaba sobre todos 
  sus tesoros, y había venido a Jerusalén para adorar, 
  **28** volvía sentado en su carro, y leyendo al profeta Isaías. 
  **29** Y el Espíritu dijo a Felipe: Acércate y júntate a ese carro. 
  **30** Acudiendo Felipe, le oyó que leía al profeta Isaías, y dijo: 
  Pero ¿entiendes lo que lees? 
  **31** Él dijo: ¿Y cómo podré, si alguno no me enseñare? Y rogó a Felipe 
  que subiese y se sentara con él. 
  **32** El pasaje de la Escritura que leía era este:

>> Como oveja a la muerte fue llevado;
   Y como cordero mudo delante del que lo trasquila,
   Así no abrió su boca.

>> **33** En su humillación no se le hizo justicia;
   Mas su generación, ¿quién la contará?
   Porque fue quitada de la tierra su vida.

> **34** Respondiendo el eunuco, dijo a Felipe: Te ruego que me digas: 
  ¿de quién dice el profeta esto; de sí mismo, o de algún otro? 
  **35** Entonces Felipe, abriendo su boca, y comenzando desde esta escritura,
  le anunció el evangelio de Jesús. 
  **36** Y yendo por el camino, llegaron a cierta agua, y dijo el eunuco: 
  Aquí hay agua; ¿qué impide que yo sea bautizado? 
  **37** Felipe dijo: Si crees de todo corazón, bien puedes. 
  Y respondiendo, dijo: Creo que Jesucristo es el Hijo de Dios. 
  **38** Y mandó parar el carro; y descendieron ambos al agua, Felipe 
  y el eunuco, y le bautizó. 
  **39** Cuando subieron del agua, el Espíritu del Señor arrebató a 
  Felipe; y el eunuco no le vio más, y siguió gozoso su camino.

![Cuadro de Felipe bautizando al Eunuco](/img/felipe_bautiza_eunuco.jpg "Cuadro
de Felipe bautizando al Eunuco")

[Cuadro de Felipe bautizando al Eunuco de Aelbert Cuyp --Dominio Público](https://picryl.com/media/aelbert-cuyp-saint-philip-baptising-the-ethiopian-eunuch-ntiii-ang-515655-a00e41)



## 1. Comprensión de lectura

* ¿Cuáles son los personajes de la historia ?
* ¿Quién habló a Felipe en el verso 26?  
* ¿Cual es el nombre de la Reina del eunuco?
* ¿De acuerdo con el texto que profeta estaba leyendo el eunuco?
* ¿Qué le dice el Espíritu a Felipe en el verso 29?
* ¿De acuerdo con el texto de qué persona habla la profecía? 
* Completa la frase:  ¿entiendes lo que _________?
* ¿Cuál es la respuesta del eunuco en el versículo 31?
* ¿Fue el eunuco bautizado?
* ¿Quién arrebató a Felipe en el verso 39 ?

## 2. Reflexión

La historia de la conversión del Eunuco es un testimonio bellísimo de 
cómo el evangelio de Jesucristo  llega a las personas. ¿Qué piensas al 
escuchar la historia del eunuco y Felipe? Comparte tus ideas,  es de 
suma importancia para nosotros.   

## 3. Aplicación

* ¿Cómo puedes aplicar lo que este pasaje enseña a tu vida?
* Desafío de memorización: _Felipe dijo: Si crees de todo corazón, bien puedes. Y respondiendo, dijo: Creo que Jesucristo es el Hijo de Dios._ Hechos 8:37


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
