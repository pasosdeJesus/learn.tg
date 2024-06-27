<script setup>
  import { ref, computed } from 'vue'
  import {
    conectar,
    cuenta,
    estadoBoton,
    red
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

  import { cursos } from '../../definiciones'

  let micurso = cursos.filter( r => r.prefijoRuta == "/ahorra-a-mas-del-100-hasta-Ago-2024")[0]
  const titulo = ref(micurso.titulo)
  const subtitulo = ref(micurso.subtitulo)
  const imagen = ref(micurso.imagen)
  const creditoImagen = ref(micurso.creditoImagen)
  const enlaceImagen = ref(micurso.enlaceImagen)
  const altImagen = ref("100% +")
  const resumenMd = ref(`

Como parte de una investigación en blockchains y su seguridad, hemos
encontrado una excelente oportunidad de inversión de bajo riesgo, se trata
de una promoción ofrecida por los desarrolladores de un blockchain
para posicionarlo y atraer usuarios.

En este contexto hemos visto ofertas con un mínimo de días de retención 
de la inversión (digamos 15 días) y algunas con menos tiempo o incluso que 
permiten retirar los fondos en cualquier momento.

La inversión debe convertirse a monedas del blockchain en una billetera para 
el mismo y después conectar la billetar a un AMM con promoción
para hacer la inversión e ir obteniendo ganancias a diario --las ganancias
pueden retirarse en cualquier momento.

Dado que se emplea las monedas de un blockchain que suelen fluctuar también
te recomendamos como aliviar esa fluctuación a medida que recibes ganancias.
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
`)
  const ampliaHtml = computed( () => htmlDeMd(ampliaMd.value) )


  const prerequisitosMd = ref(`
1. Cuenta verificada en OKX con fondos
2. Un computador de escritorio o portatil con la extensión de OKX instalada para
poder pagar e ingresar a este curso
3. Fondos en la billetera de OKX

Aprende esto en nuestro curso gratuito sobre okx.
  `)
  const prerequisitosHtml = computed( () => htmlDeMd(prerequisitosMd.value) )


  const contenidoMd = ref(`
1. El blockchain de la promoción
2. Instala una billetera eficiente y tipica del blockchain de la promoción
3. Pasa fondos de OKX (u otro exchange) a tu nueva billetera
4. Usa tu billetera para navegar en el AMM que recomendamos
5. Elige una piscina de liquidez con promoción activa e invierte
6. Activa los premios en la piscina donde invertiste
7. Con peridicidad revisa los premios y cuando tengas suficiente retiralos
8. Libra lo que ganaste de la volatilidad
9. Cuando hayas reunido suficientes premios o retires tu inversión envialos a OKX u otro exchange y monetiza
  `)
  const contenidoHtml = computed( () => htmlDeMd(contenidoMd.value) )

  async function cambiarXLayer(event) {
    try {
      console.log(okxwallet.chainId)
      const chainId = "0xc4"; // X Layer
      await okxwallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainId }]
      });
    } catch (switchError) {
      // This error code indicates that the chain
      // has not been added to OKX Wallet.
      console.log("switchError.code=", switchError.code)
      if (switchError.code === 4902) {
        try {
          await okxwallet.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: "0xf00", rpcUrl: "https://..."
        /* ... */ }]
          });
        } catch (addError) {
          // handle "add" error
        }
      }
      // handle other "switch" errors
    }
  }

  async function cobrar025OKB(event) {
    okxwallet
      .request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: okxwallet.selectedAddress,
            to: '0x2e2c4ac19c93d0984840cdd8e7f77500e2ef978e',
            value: '0x3782dace9d90000', // 0.25okb=25x10^16wei
            gasPrice: '0x09184e72a000',
            gas: '0x2710',
          },
        ],
      })
      .then((txHash) => console.log("txHash", txHash))
      .catch((error) => console.error("error", error));
  }



</script>

<template>
  <Encabezado></Encabezado>
  <div class="contenido">
    <template v-if="estadoBoton == 'Desconectar'">
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
        <template v-if="red != 'Red: X Layer Mainnet'">
            <div class="cont-flex-centro">
              <button 
                 class='btn ancho-8' 
                 @click='cambiarXLayer'>X Layer</button>
            </div>
        </template>
        <template v-else>
          <div class="cont-flex-centro">
            <button 
               class='btn ancho-8' 
               @click='cobrar025OKB'>Inscribirse por 0.25 OKB</button>
          </div>
        </template>
      </template>
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
