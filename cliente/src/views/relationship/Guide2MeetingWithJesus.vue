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
# Guide 2: Meeting with Jesus - John 4:1-26[^1]

> **1** Now Jesus learned that the Pharisees had heard that he was gaining and 
   baptizing more disciples than John— 
   **2** although in fact it was not Jesus who baptized, but his disciples. 
   **3** So he left Judea and went back once more to Galilee. 
   **4** Now he had to go through Samaria. 
   **5** So he came to a town in Samaria called Sychar, near the plot of ground 
   Jacob had given to his son Joseph. 
   **6** Jacob’s well was there, and Jesus, tired as he was from the journey, 
   sat down by the well. It was about noon. 
   **7** When a Samaritan woman came to draw water, Jesus said to her, 
   “Will you give me a drink?” **8** (His disciples had gone into the town to 
   buy food.) 
   **9** The Samaritan woman said to him, “You are a Jew and I am a Samaritan 
   woman. How can you ask me for a drink?” (For Jews do not associate with 
   Samaritans.) 
   **10** Jesus answered her, “If you knew the gift of God and who it is that 
   asks you for a drink, you would have asked him and he would have given you 
   living water.”  
   **11** “Sir,” the woman said, “you have nothing to draw with and the well is 
   deep. Where can you get this living water? 
   **12** Are you greater than our father Jacob, who gave us the well and drank 
   from it himself, as did also his sons and his livestock?”  
   **13** Jesus answered, “Everyone who drinks this water will be thirsty again, 
   **14** but whoever drinks the water I give them will never thirst. Indeed, 
   the water I give them will become in them a spring of water welling up to 
   eternal life.” 
   **15** The woman said to him, “Sir, give me this water so that I won’t get 
   thirsty and have to keep coming here to draw water.” 
   **16** He told her, “Go, call your husband and come back.” 
   **17** “I have no husband,” she replied. Jesus said to her, 
   “You are right when you say you have no husband. 
   **18** The fact is, you have had five husbands, and the man you now 
   have is not your husband. What you have just said is quite true.” 
   **19** “Sir,” the woman said, “I can see that you are a prophet. 
   **20** Our ancestors worshiped on this mountain, but you Jews claim that 
   the place where we must worship is in Jerusalem.” 
   **21** “Woman,” Jesus replied, “believe me, a time is coming when you 
   will worship the Father neither on this mountain nor in Jerusalem. 
   **22** You Samaritans worship what you do not know; we worship what we 
   do know, for salvation is from the Jews. 
   **23** Yet a time is coming and has now come when the true worshipers 
   will worship the Father in the Spirit and in truth, for they are the 
   kind of worshipers the Father seeks. 
   **24** God is spirit, and his worshipers must worship in the Spirit and in 
   truth.” 
   **25** The woman said, “I know that Messiah” (called Christ) “is coming. 
   When he comes, he will explain everything to us.” 
   **26** Then Jesus declared, “I, the one speaking to you—I am he.”  
   
> (Translation WEBUS)

![Pozo de Jacob en 1912](/img/Nablus_jacob_well_1912.jpg "Pozo de Jacob en 1912")

[Foto del Pozo de Jacob en 1912 --dominio público](https://en.wikipedia.org/wiki/Jacob%27s_Well#/media/File:Nablus_jacob_well_1912.jpg)


## Reading comprehension. 

* Who are the characters in the story?
* According to verse 4 what is the region through which Jesus has yet to pass?
* According to verse 7, who comes to the well to draw water?
* What favor does Jesus ask of the woman?
* What does Jesus say to the woman in verse 14?
* According to verse 19 what does the woman call Jesus?
* Complete the sentence: will the true worshipers worship the father in 
  spirit and in _________?
* Who will declare all things to the woman according to verse 25?
* Who is the woman calling father in verse 12?
* Complete the sentence: I am the one speaking __ ___ I am he.

## Reflection

* What of this passage allows you to think that the story really occurred.
* The story of the Samaritan woman is a story of how the encounter with 
Jesus restores us; for this reason the woman is an example of worship in 
spirit and in truth. What do you think when reading this story? Jesus is the 
one who can see you sincerely and with love and does not judge you, approach 
Jesus as you are because God is willing to forgive you and give you living 
water. 

## Application

* How can you apply what this passage teaches to your life?
* Memorization challenge: …_ the water I give them will become in them a 
  spring of water welling up to eternal life._ John 6:14


![Pozo de Jacob en 2013](/img/j2013.jpg "Pozo de Jacob en 2013")

[Foto del Pozo de Jacob en 2013 por Jermiah K. Garrett](https://en.wikipedia.org/wiki/Jacob%27s_Well#/media/File:Jacob's_Well_in_2013.jpg)


[^1]:
     Prepared by Julian Martinez and Vladimir Támara Patiño. [vtamara@pasosdeJesus.org](mailto:vtamara@pasosdeJesus.org)  This is open content with license [CC-BY International 4.0](https://creativecommons.org/licenses/by/4.0/)

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
