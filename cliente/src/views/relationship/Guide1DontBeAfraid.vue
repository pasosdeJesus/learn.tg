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
# Guide 1: Don't be afraid - Mark 6:45-52[^1]

> **45** Immediately He made his disciples get into the boat, and go ahead 
   to the other side, to Bethsaida, while He himself sent the multitude away. 
   **46** After He had taken leave of them, He went up the mountain to pray.
   
>  **47** When evening had come, the boat was in the middle of the sea, and 
   He was alone on the land. 
   **48** Seeing them distressed in rowing, for the wind was contrary to them, 
   about the fourth watch of the night he came to them, walking on the sea, and 
   He would have passed by them, **49 **but they, when they saw Him walking on 
   the sea, supposed that it was a ghost, and cried out; 
   **50** for they all saw Him, and were troubled. But He immediately spoke with 
   them, and said to them, “Cheer up! It is I! Don’t be afraid.” 
   **51** He got into the boat with them; and the wind ceased, and they were 
   very amazed among themselves, and marveled; 
   **52** for they hadn’t understood about the loaves, but their hearts were 
   hardened.
   
> (Translation WEBUS)

![Drawing of Jesus walking on the lake](/img/camina_sobre_el_agua.jpg "Jesús
walking on teh sea")

[Jesus walks on the sea by Gustave Dore -- Public domain](https://commons.wikimedia.org/wiki/File:Jesus_walks_on_the_sea.jpg)


## Reading comprehension. 

* Two landscapes mentioned in this reading: ____ and ____ 
* Where did Jesus sent His disciples? ____ Did they obey? ____
* What Jesus went to do alone after sending away people and his disciples?
* The fourth watch of the night means from 3AM to 6AM, supposing it was 3AM 
  when Jesus wante d to depart and that He sent His disciples to Bethsaida at 
  6PM, how long were his disciples rowing?
* Seeing His disciples distress Jesus came close to the boat where they were 
  by ____ on the ____
* The disciples cried because they thought that the one walking on the lake 
  was a ____
* As soon as the disciples got scared Jesus told them “Cheer up! Its i I! 
  ____  ____  ____”
* Then Jesus went into the boat with them and besides the wind ____
* If you read the passage before this one in the Bible, it is about the 
  miraculous sharing of bread leaves, the disciples couldn’t understand 
  that and their hearts were ____

## Reflection

* What of this passage allows you to think that the story really occurred.

* You may have heard comments about Jesus from other people,  but He tells 
  you straight today “Don’t be afraid” and we tell you by our personal 
  experience: He is love.

## Appliction

* How can you apply what this passage teaches to your life?

* Memorization challenge:_... But He immediately spoke with them, and said 
  to them, “Cheer up! It is I! Don’t be afraid.”_ Mark 6:50


[^1]:
     Prepared by Vladimir Támara Patiño [vtamara@pasosdeJesus.org](mailto:vtamara@pasosdeJesus.org) and Julian Martínez.  This is open content with license [CC-BY International 4.0](https://creativecommons.org/licenses/by/4.0/)

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
