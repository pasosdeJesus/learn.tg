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

## Guía 1. Registrate en OKX como referido(a) e instala la aplicación

### 1. Registrate como referido(a) de pasosdeJesus.org

¡Al registrarte como refereido nuestro obtienes 5% de descuento en las 
comisiones que OKX normalmente cobra en tus transacciones de trading!

1. Emplea el siguiente enlace de referido:
<a href="https://www.okx.com/es-la/join/87372281">https://www.okx.com/es-la/join/87372281</a>
  Deberías ver en la pantalla de registro este mensaje:

> ![Mensaje pasosdeJesus.org te ha invitado](/img/pdJOKX.png)

2. Proporciona tu correo en el campo para eso y presiona el botón 
   **Registrarse**
3. En otra pestaña de tu navegador o con una aplicación de correo ingresa 
   a tu correo y copia el código de verificación de 6 dígitos.
4. Tendrás 10 minutos para escribir ese código en la página de registro y 
   presionar **Siguiente**.
5. Ingresa la clave con la que quieres proteger tu cuenta y presiona
   **Siguiente**.  Te sugerimos usar una combinación de números, letras 
   mayúsculas, minúsculas y símbolos.  No debes compartir tu clave. 
   Te insitamos a revisar más recomendaciones en [Cómo proteger tu cuenta de exchange de criptomonedas en OKX](https://www.okx.com/es-la/learn/account-security-on-okex)
6. Tras esto podrás acceder el tablero de control de tu cuenta en OKX.

### 2. Instala la aplicación de OKX en tu celular

La aplicación de OKX para celular suele ser más
práctica para las operaciones típicas de compra y venta de
divisas, por eso recomendamos instalarla.

* Para celulares [Android](https://play.google.com/store/apps/details?id=com.okinc.okex.gp)
* Para celulares [iOS](https://apps.apple.com/us/app/okx-buy-bitcoin-btc-crypto/id1327268470)

Esta aplicación incluye la billetera OKX que podrás usar para ingresar
a este sitio.


### 3. Verifica tu identidad

Para la verificación tendrás que enviar foto de tu cédula y hacerte una selfie.

Mira el estado de tu verificación y completala así:

1. Ve al menú general con los puntos de la parte superior izquierda:

> ![Pantallazo enfoca puntos en aplicación de OKX](/img/verif1.jpg)

2. Ve a \`Perfil y Configuración\` presionando sobre tu usuario:

> ![Pantallazo enfoca Perfil y Configuración en aplicación de OKX](/img/verif2.jpg)

3. Desde la pestaña \`Perfil\` presiona sobre \`Verificación\`:

> ![Mensaje pasosdeJesus.org te ha invitado](/img/verif3.jpg)



### 4. Opcionalmente desde tu computador instala la billetera de OKX como extensión de tu navegador

La aplicación web de OKX no te permitirá ingresar a sitios con aplicaciones 
como esta (dApp que permite conexión a una billetera),
necesitarás bien la billetera en tu celular o si prefieres usar tu computador
instala la extension OKX Wallet en tu navegador:

* [Chrome y Brave](https://chrome.google.com/webstore/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge)
* [Edge](https://microsoftedge.microsoft.com/addons/detail/okx-wallet/pbpjkcldjiffchgbbndmhojiacbgflha)

---


| Anterior | | Siguiente |
|---|---|---|
| | | [Guia 2: Compra USDT, ahorra y vende cuando quieras](/okx/compra-usdt-ahorra-y-vende) |

`)
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
