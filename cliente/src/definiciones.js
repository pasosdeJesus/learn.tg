import Hogar from './views/Hogar.vue'

import IntroCurso from
  './components/IntroCurso.vue'

import CompraUsdtAhorraYVende from
  './views/okx/CompraUsdtAhorraYVende.vue'
import RegistrateComoReferido from
  './views/okx/RegistrateComoReferido.vue'
import AccedeAMasCursosConLaBilletera from
  './views/okx/AccedeAMasCursosConLaBilletera.vue'

let creditosUnaRelacionConJesus = `
Preparado por [Vladimir Támara Patiño](mailto:vtamara@pasosdeJesus.org) y 
  [Julián Martinez](mailto:julianrz98@gmail.co). Este es contenido abierto con licencia. 
[CC-BY Internacional 4.0](https://creativecommons.org/licenses/by/4.0/)`

import Guia1NoTengasMiedo from
  './views/relacion/Guia1NoTengasMiedo.vue'
import Guia2EncuentroConJesus from
  './views/relacion/Guia2EncuentroConJesus.vue'
import Guia3VeAEncontrarteConJesus from
  './views/relacion/Guia3VeAEncontrarteConJesus.vue'
import Guia4HablandoConDios from
  './views/relacion/Guia4HablandoConDios.vue'

let creditosARelationshipWithJesus = `
Prepared by [Vladimir Támara Patiño](mailto:vtamara@pasosdeJesus.org) and
[Julián Martinez](mailto:julianrz98@gmail.co). 
This is open content with license 
[CC-BY Internacional 4.0](https://creativecommons.org/licenses/by/4.0/)`


import Guide1DontBeAfraid from
  './views/relationship/Guide1DontBeAfraid.vue'
import Guide2MeetingWithJesus from
  './views/relationship/Guide2MeetingWithJesus.vue'
import Guide3GoOutToMeetJesus from
  './views/relationship/Guide3GoOutToMeetJesus.vue'
import Guide4TalkingWithGod from
  './views/relationship/Guide4TalkingWithGod.vue'


export const cursos = [
  {
    titulo: "A relationship with Jesus",
    subtitulo: "Four brief guides to start a relationship with Jesus as Savior, Lord and friend",
    idioma: "en",
    prefijoRuta: "/a-relationship-with-Jesus",
    imagen: "/img/Jn6_col.jpg",
    creditoImagen: "A drawing of Juan Carlos Partidas from https://misdibujoscristianos.blogspot.com/",
    enlaceImagen: "",
    altImagen: "A drawing of Jesus with bread and friends",
    resumenMd: `
Jesus is more than a religion and a denomination,
we invite you to get to know Him personally.

If you want to give us feedback, to ask or to know more, you can write to us
on WhatsApp or Telegram to the phone number +57 316 5383162 --if you want
a videocall please propose a schedule.

If you want, we can also connect you with a church nearby.
`,
    sinbilletera: true,
    conbilletera: true,
    porPagar: 0,
    componenteIntro: IntroCurso,
    guias: [
      {
        titulo: "Don't be afraid - Mark 6:45-52",
        posfijoRuta: "/dont-be-afraid",
        componente: Guide1DontBeAfraid,
        creditosMd: creditosARelationshipWithJesus
      },
      {
        titulo: "Meeting with Jesus - John 4:1-26",
        posfijoRuta: "/meeting-with-Jesus",
        componente: Guide2MeetingWithJesus,
        creditosMd: creditosARelationshipWithJesus
      },
      {
        titulo: "Go out to meet Jesus - John 11:17-27",
        posfijoRuta: "/go-out-to-meet-Jesus",
        componente: Guide3GoOutToMeetJesus,
        creditosMd: creditosARelationshipWithJesus
      },
      {
        titulo: "Talking with God - Acts 8:26-39",
        posfijoRuta: "/talking-with-God",
        componente: Guide4TalkingWithGod,
        creditosMd: creditosARelationshipWithJesus
      },
    ]
  },
  {
    titulo: "Una relación con Jesús",
    subtitulo: "Cuatro breves guías para empezar una relación con Jesús como Señor, Salvador y amigo.",
    idioma: "es",
    prefijoRuta: "/una-relacion-con-Jesus",
    imagen: "/img/Jn6_col.jpg",
    creditoImagen: "Dibujo de Juan Carlos Partidas de https://misdibujoscristianos.blogspot.com/",
    enlaceImagen: "",
    altImagen: "Dibujo de Jesús con pan y amigos",
    resumenMd: `

Jesús es más que una religión o una denominación, te invitamos a
conocerlo de manera personal.

Si quieres retroalimentar, preguntar o conocer más puedes escribir
por WhatsApp o Telegram al +57 316 5383162 --si quieres una
videollamado propon un horario.

Si lo deseas también podemos ponerte en contacto con una iglesia
cercana.

`,
    sinbilletera: true,
    conbilletera: true,
    porPagar: 0,
    componenteIntro: IntroCurso,
    guias: [
      {
        titulo: "No tengas miedo - Marcos 6:45-52",
        posfijoRuta: "/no-tengas-miedo",
        componente: Guia1NoTengasMiedo,
        creditosMd: creditosUnaRelacionConJesus
      },
      {
        titulo: "Encuentro con Jesús - Juan 4:1-26",
        posfijoRuta: "/encuentro-con-Jesus",
        componente: Guia2EncuentroConJesus,
        creditosMd: creditosUnaRelacionConJesus
      },
      {
        titulo: "Ve a encontrarte con Jesús - Juan 11:17-27",
        posfijoRuta: "/ve-a-encontrarte-con-Jesus",
        componente: Guia3VeAEncontrarteConJesus,
        creditosMd: creditosUnaRelacionConJesus
      },
      {
        titulo: "Hablando con Dios - Hechos 8:26-39",
        posfijoRuta: "/hablando-con-Dios",
        componente: Guia4HablandoConDios,
        creditosMd: creditosUnaRelacionConJesus
      }
    ]
  },
  {
    titulo: "Pastores influenciadores",
    subtitulo: "Expandiendo el reino empleando exchanges",
    idioma: "es",
    prefijoRuta: "/pastores-influenciadores",
    imagen: "/img/rollerskatewedding.jpg",
    creditoImagen: "Basada en dibujo de j4p4n",
    enlaceImagen: "https://openclipart.org/detail/189255/rollerskate-wedding",
    altImagen: "Dibujo de pastor casando a una pareja en patines",
    resumenMd: `
Del 1.May.2024 al 1.Jul.2024 la plataforma OKX está ofreciendo la posibilidad 
de afiliarse como influenciador (influencer) para:
1. Obtener 50% de las ganancias de ese intercambiador (exchange) por cada 
   transacción hecha por las personas que se afilien mediante el 
   influenciador.
2. Hacer crecer la marca de cada influenciador junto con la de OKX y 
   ampliar la red de cada influenciador y de OKX.
3. Promover el uso de criptoactivos, que en mi humilde opinión 
   representan un ejercicio de libertad (por ejemplo del sistema bancario).

Estimado pastor menonita, yo Vladimir Támara tras usar OKX por más de un año
para ahorrar en dolares y cambiar pesos por dolares, veo oportunidades en la
actual campaña de OKX para influenciadores:

1. Para el público general de Colombia tanto de conocer a Cristo como de 
   ahorrar en dolares con una tasa superior al 10% anual.
2. Para miembros de la iglesia menonita que no tengan trabajo o que requieran
   un trabajo extra con horas flexibles, en el que además podrían
   invitar a las personas con las que interactuen a conocer a Cristo 
   e invitar a más público general a ahorrar y a conocer a Cristo.
3. Para pastores que podrían ser influenciadores con los miembros
   de sus comunidades que hagan el trabajo del punto 2.

Puedo estar equivocado por lo que oro por discernimiento y l@ invito a conocer
más en detalle la idea este viernes 17 de Mayo a las 6:30PM en una reunión 
virtual de una hora.  Por la visión es una invitación exclusiva para
pastores menonitas de Colombia. Si tiene interes en recibir el enlace 
por favor escribame por Telegram o WhatsApp al 3165383162.

`,

    sinbilletera: false,
    conbilletera: false,
    porPagar: 0,
    componenteIntro: IntroCurso,
    guias: []
  },
  {
    titulo: "Ahorra en dólares en OKX",
    subtitulo: "Interés superior al 10% efectiva anual para los primeros US$1000",
    idioma: "es",
    prefijoRuta: "/ahorra-en-dolares-en-okx",
    imagen: "/img/OKX_Logo.svg",
    creditoImagen: "Logo de OKX",
    enlaceImagen: "https://okx.com",
    altImagen: "Logo de OKX",
    resumenMd: `
Pasos de Jesús es un afiliado a OKX por eso al registrarte
como referido obtendrás un 5% de descuento en las comisiones de trading.

Una vez registrado y verificado podrás emplear el mercado P2P
para convertir parte de tus pesos en cuentas bancarias y billeteras
colombianas en doláres digitales (USDT) en tu cuenta en OKX, donde podrás
ahorrar los al 10% efectivo anual al menos los primeros 1000 USDT 
con pago de intereses cada hora, intereses que se abonan a tu cuenta para 
ganar intereses también sobre los intereses.

En cualquier momento que necesites tus ahorros o parte de estos, retira
lo que necesites y conviertelo a pesos mediante el mercado P2P.
`,
    sinbilletera: true,
    conbilletera: true,
    porPagar: 0,
    componenteIntro: IntroCurso, 
    guias: [
      {
        titulo: "Registrate como referido e instala la aplicación",
        posfijoRuta: "/registrate-como-referido",
        componente: RegistrateComoReferido
      },
      {
        titulo: "Compra USDT, Ahorra y Vende cuando quieras",
        posfijoRuta: "/compra-usdt-ahorra-y-vende",
        componente: CompraUsdtAhorraYVende
      },
      {
        titulo: "Accede a más cursos con la billetera",
        posfijoRuta: "/accede-a-mas-cursos-con-la-billetera",
        componente: AccedeAMasCursosConLaBilletera
      },

    ]
  },
  {
    titulo: "Ahorra a más del 100% hasta Julio de 2024",
    subtitulo: "Aprovecha esta inversión promocional de bajo riesgo que ha venido rentando de Mayo a Julio de 2024 a más del 100% efectivo anual",
    idioma: "es",
    prefijoRuta: "/ahorra-a-mas-del-100-hasta-Ago-2024",
    imagen: "/img/100pp.png",
    creditoImagen: "Dominio Público",
    enlaceImagen: "",
    sinbilletera: false,
    conbilletera: true,
    altImagen: "100% +",
    resumenMd: `
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
`,
    prerequisitosMd: `
1. Cuenta verificada en OKX con fondos
2. Un computador de escritorio o portatil con la extensión de OKX instalada para
poder pagar e ingresar a este curso
3. Fondos en la billetera de OKX
`,
    cursosPrerequisito: [
      "/ahorra-en-dolares-en-okx"
    ],
    porPagar: 0.25,
    componenteIntro: IntroCurso,
    guias: [
      {
        titulo: 'El blockchain de la promoción', 
        posfijoRuta: null,
        componente: CompraUsdtAhorraYVende
      },
      { 
        titulo: 'Instala una billetera eficiente y tipica del blockchain de la promoción',
        posfijoRuta: null, 
        componente: null 
      },
      {
        titulo: 'Pasa fondos de OKX (u otro exchange) a tu nueva billetera',
        posfijoRuta: null,
        componente: null 
      },{
        titulo: 'Usa tu billetera para navegar en el AMM que recomendamos',
        posfijoRuta: null, 
        componente: null 
      },{
        titulo: 'Elige una piscina de liquidez con promoción activa e invierte', 
        posfijoRuta: null, 
        componente: null 
      }, 
      {
        titulo: 'Activa los premios en la piscina donde invertiste',
        posfijoRuta: null, 
        componente: null
      }, 
      {
        titulo: 'Con peridicidad revisa los premios y cuando tengas suficiente retiralos',
        posfijoRuta: null, 
        componente: null 
      }, 
      {
        titulo: 'Libra lo que ganaste de la volatilidad',
        posfijoRuta: null, 
        componente: null 
      },
      {
        titulo: 'Cuando hayas reunido suficientes premios o retires tu inversión envialos a OKX u otro exchange y monetiza',
        posfijoRuta: null, 
        componente: null 
      },
    ]
  }

]

export var rutas;

rutas = [
  { path: '/', component: Hogar },
  // Alias
  { path: '/registrarse-en-okx-como-referido', component: RegistrateComoReferido }
]

for (const curso of cursos) {
  rutas.push({
    path: "/" + curso.idioma + curso.prefijoRuta,
    component: curso.componenteIntro
  })
  for (const guia of curso.guias) {
    rutas.push({
      path: "/" + curso.idioma + curso.prefijoRuta + guia.posfijoRuta,
      component: guia.componente
    })
  }
}


