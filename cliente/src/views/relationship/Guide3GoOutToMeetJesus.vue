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

# Guide 3: Go out to meet Jesus - John 11:17-27[^1]

> **17** So when Jesus came, he found that he had been in the tomb four 
  days already. 
  **18** Now Bethany was near Jerusalem, about fifteen stadia away. 
  **19** Many of the Jews had joined the women around Martha and Mary, 
  to console them concerning their brother. 
  **20** Then when Martha heard that Jesus was coming, she went and met him, 
  but Mary stayed in the house. 
  **21** Therefore Martha said to Jesus, “Lord, if you would have been here, 
  my brother wouldn’t have died. 
  **22** Even now I know that whatever you ask of God, God will give you.”

> **23** Jesus said to her, “Your brother will rise again.”

> **24** Martha said to him, “I know that he will rise again in the 
  resurrection at the last day.”

> **25** Jesus said to her, “I am the resurrection and the life. He who 
  believes in me will still live, even if he dies. 
  **26**  Whoever lives and believes in me will never die. Do you believe this?”

> **27** She said to him, “Yes, Lord. I have come to believe that you are 
  the Christ, God’s Son, he who comes into the world.”

> (Translation WEBUS).

![Drawing Raising of Lazarus](/img/RaisingOfLazarusBloch.jpg "Drawing Raising of
Lazarus")

[Rising of Lazarus by Carl Bloch](https://commons.wikimedia.org/wiki/File:RaisingofLazarusBloch.jpg)


## Reading comprehension. 

* Who had died?
* Have you ever been comforted by someone when you are facing a hopeless 
  situation?
* According to the reading, who goes out to meet Jesus?
* What is Jesus' response in verse 23?
* What is Martha's response in verse 26?
* **Complete the sentence**: Jesus said to him: I am the resurrection and 
  the life; the one who believes in me, even though he is dead _________
* What is Jesus' response in verse 25?
* What was the approximate distance between Bethany and Jerusalem?
* What is the city where Maria lives according to the information 
  provided in the text?

## Reflection

* Would you trust someone who has the power to overcome death? Jesus of 
  Nazareth, contrary to the vast majority of gods, does not want us to 
  get close first, but He came to us out of love through Jesus so that 
  we could get close to Him.

## Aplication

* How can you apply what this passage teaches to your life?
* Memorization challenge: _for they all saw him, and were troubled. Jesus 
  said to her, “I am the resurrection and the life. He who believes in me 
  will still live, even if he dies._ John 11:25

[^1]:
     Prepared by Julian Martínez and Vladimir Támara Patiño. [vtamara@pasosdeJesus.org](mailto:vtamara@pasosdeJesus.org)  This is open content with license [CC-BY International 4.0](https://creativecommons.org/licenses/by/4.0/)

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
