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

# Guide 4: Talking with God. Acts 8:26-39[^1]

> **26** Then an angel of the Lord spoke to Philip, saying, 
  “Arise, and go toward the south to the way that goes down from 
  Jerusalem to Gaza. This is a desert.” 
  **27** He arose and went; and behold, there was a man of Ethiopia, 
  a eunuch of great authority under Candace, queen of the Ethiopians, 
  who was over all her treasure, who had come to Jerusalem to worship. 
  **28** He was returning and sitting in his chariot, and was reading the 
  prophet Isaiah.  
  **29** The Spirit said to Philip, “Go near, and join yourself to this 
  chariot.” 
  **30** Philip ran to him, and heard him reading Isaiah the prophet, and 
  said, “Do you understand what you are reading?”  
  **31** He said, “How can I, unless someone explains it to me?” 
  He begged Philip to come up and sit with him. 
  **32** Now the passage of the Scripture which he was reading was this, 

>> Como oveja a la muerte fue llevado;
   Y como cordero mudo delante del que lo trasquila,
   Así no abrió su boca.

>> **33** En su humillación no se le hizo justicia;
   Mas su generación, ¿quién la contará?
   Porque fue quitada de la tierra su vida.


>> He was led as a sheep to the slaughter. 
  As a lamb before his shearer is silent,
  so he doesn’t open his mouth.

>> **33** In his humiliation, his judgment was taken away.
  Who will declare His generation?
  For his life is taken from the earth.

> **34** The eunuch answered Philip, “Who is the prophet talking about? 
  About himself, or about someone else?” 
  **35** Philip opened his mouth, and beginning from this Scripture, 
  preached to him about Jesus. 
  **36** As they went on the way, they came to some water; and the eunuch 
  said, “Behold, here is water. What is keeping me from being baptized?” 
  **37** Philip said, “If you believe with all your heart, you may.” 
  He answered, “I believe that Jesus Christ is the Son of God.” 
  **38** He commanded the chariot to stand still, and they both went 
  down into the water, both Philip and the eunuch, and he baptized him. 
  **39** When they came up out of the water, the Spirit of the Lord caught 
  Philip away, and the eunuch didn’t see him any more, for he went on 
  his way rejoicing.  

> (Translation WEBUS).

![Drawing of Philip baptizing the eunuch](/img/felipe_bautiza_eunuco.jpg "Drawing of Philip baptizing the eunuch")

[Drawing Philip baptising the ethiopina eunuch by Aelbert Cuyp --Public Domain](https://picryl.com/media/aelbert-cuyp-saint-philip-baptising-the-ethiopian-eunuch-ntiii-ang-515655-a00e41)


## Reading comprehension

* Who spoke to Philip in verse 26?
* What is the name of the Queen of eunuchs?
* According to the text which prophet was reading the eunuch?
* What does the Spirit say to Philip in verse 29?
* According to the text of which person does the prophecy speak?
* Complete the sentence: do you understand what _________?
* What is the eunuch's response in verse 31?
* Was the eunuch baptized?
* Who snatched Philip in verse 39?

## Reflection

* The story of the Eunuch's conversion is a beautiful testimony of how the 
  gospel of the Jesus reaches people. What do you think when you hear the 
  story of the eunuch and Philip? Share your ideas is very important to us.

## Application

* How can you apply what this passage teaches to your life?
* Memorization challenge:  _Philip said, “If you believe with all your heart, 
  you may.” He answered, “I believe that Jesus Christ is the Son of 
  God.” _Acts 8:37

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
