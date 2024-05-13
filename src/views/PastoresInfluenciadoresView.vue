<script setup>
  import { ref, computed } from 'vue'
  import Encabezado from '../components/Encabezado.vue'
  import Piedepagina from '../components/Piedepagina.vue'

  import {unified} from 'unified'
  import remarkDirective from 'remark-directive'
  import remarkFrontmatter from 'remark-frontmatter'
  import remarkGfm from 'remark-gfm'
  import remarkParse from 'remark-parse'
  import remarkRehype from 'remark-rehype'
  import rehypeStringify from 'rehype-stringify'

  import addFillInTheBlank from '../lib/add-fill-in-the-blank'

  const textoMd = ref(`
# Pastores como influenciadores de OKX
## Oportunidad de bendición y para alcanzar más personas para Cristo

Del 1.May.2024 al 1.Jul.2024 la plataforma OKX está ofreciendo la posibilidad 
de afiliarse como influenciador (influencer) para:
1. Obtener 50% de las ganancias de ese intercambiador (exchange) por cada 
   transacción hecha por las personas que se afilien mediante el 
   influenciador.
2. Hacer crecer la marca de cada influenciador junto con la de OKX y 
   ampliar la red de cada influenciador y de OKX.
3. Promover el uso de criptoactivos, que en mi humilde opinión 
   representan un ejercicio de libertad (por ejemplo del sistema bancario).

Estimado pastor menonita, yo Vladimir Támara, deseo contarle que apliqué
a ese programa pero aún no he sido aceptado,
tal vez los pastores menonitas que tienen más influencia que yo (por
ejemplo en sus iglesias), sean aceptados más pronto.

Por mi situación personal (buena parte de ingresos en Colombia en pesos
pero la mayoría de gastos en dólares en Estados Unidos) he ganado experiencia 
como comerciante en el mercado P2P de OKX con el que he usando mi marca
pasosdeJesus.org y mis cuentas de Nequi y Bancolombia para comprar 
USDT (criptoactivo estable equivalente al dólar) a comienzo del 
mes típicamente con 2% de ganancia y logro comprar el equivalente a
un millón de pesos más o menos cada 2 horas.
También he aprovechado para invitar a la iglesia a las personas con 
las que he interactuado. 
Por eso me parece que ese mercado puede ser una oportunidad de trabajo extra 
para miembros de las iglesias menonitas y para alcanzar personas
para Cristo.

Una vez cambio parte de mis ingresos en Colombia a USDT a comienzo
de mes, los dejo en un fondo de ahorro flexible durante el mes
para que ganen intereses en dólares pagados por hora a una 
tasa fluctuante superior al 10% anual (para los primeros 1000 
dólares). Hace casi un año moví a ese fondo de ahorro, parte de
un Fondo para Misión a Sierra Leona --vigilado por el pastor Jaime Ramírez--
y estoy satisfecho con el resultado que supera el 11% en un año .
Al final del mes (o cuando necesito) retiro parte del ahorro lo
convierto al criptoactivo XRP (que tiene baja tasa por transacción) y
los envio a un intercambiador en Estados Unidos (Kraken) donde cambio a
dólares y retiro en mi cuenta bancaria a un costo fijo muy bajo.

Así en conclusión veo oportunidad para

1. El público general de tener un ahorro en dolares con muy buena tasa de
   interés y que realizarían transacciones periódicas de compra y venta de
   USDT por pesos.  Necesitan una capacitación muy breve para esto.
2. Miembros de la iglesia que necesiten un trabajo o un trabajo extra y 
   que tengan teléfono y cuenta en Nequí y/o Daviplata y/o bancos con 
   transacciones por Internet (e.g Bancolombia, Davivienda, etc), pienso que
   con suficiente público general que haga ahorro con una caja de 1'000.000
   pueden ganar unos 20.000 cada 2 horas. Es importante que inviten a nuevas
   personas a hacer ahorro. Necesitan una capacitación para convertirse en 
   comerciantes de OKX para atender comprardores/vendedores de USDT por pesos 
   y  hacer la transacción rapidamente.
3. Pastores que sean influenciadores afiliados (y tal vez yo) que además sean 
   comerciantes esporádicos en OKX y que reciban 50% de la comisión que OKX cobra a 
   quienes usan el mercado P2P (OKX cobra el 0.1% que es muy bajo comparado con 
   otros intercambiadores).



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
</style>
