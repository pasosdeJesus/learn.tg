import Hogar from './views/Hogar.vue'

import AhorraEnDolaresEnOkx from
  './views/okx/AhorraEnDolaresEnOkx.vue'
import CompraUsdtAhorraYVende from
  './views/okx/CompraUsdtAhorraYVende.vue'
import RegistrateComoReferido from
  './views/okx/RegistrateComoReferido.vue'

import PastoresInfluenciadores from
  './views/PastoresInfluenciadores.vue'

import UnaRelacionConJesus from
  './views/relacion/UnaRelacionConJesus.vue'
import Guia1NoTengasMiedo from
  './views/relacion/Guia1NoTengasMiedo.vue'
import Guia2EncuentroConJesus from
  './views/relacion/Guia2EncuentroConJesus.vue'
import Guia3VeAEncontrarteConJesus from
  './views/relacion/Guia3VeAEncontrarteConJesus.vue'
import Guia4HablandoConDios from
  './views/relacion/Guia4HablandoConDios.vue'

import ARelationshipWithJesus from
  './views/relationship/ARelationshipWithJesus.vue'
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
    prefijoRuta: "/a-relationship-with-Jesus",
    imagen: "/img/Jn6_col.jpg",
    sinbilletera: true,
    conbilletera: true,
    idioma: "en",
    introduccion: {
      posfijoRuta: "/",
      componente: ARelationshipWithJesus,
    },
    guias: [
      {
        titulo: "Don't be afraid",
        posfijoRuta: "/dont-be-afraid",
        componente: Guide1DontBeAfraid
      },
      {
        titulo: "Meeting with Jesus",
        posfijoRuta: "/meeting-with-Jesus",
        componente: Guide2MeetingWithJesus
      },
      {
        titulo: "Go out to meet Jesus",
        posfijoRuta: "/go-out-to-meet-Jesus",
        componente: Guide3GoOutToMeetJesus
      },
      {
        titulo: "Talking with God",
        posfijoRuta: "/talking-with-God",
        componente: Guide4TalkingWithGod
      },
    ]
  },
  {
    titulo: "Una relación con Jesús",
    subtitulo: "Cuatro breves guías para empezar una relación con Jesús como Señor, Salvador y amigo.",
    prefijoRuta: "/una-relacion-con-Jesus", 
    imagen: "/img/Jn6_col.jpg",
    sinbilletera: true,
    conbilletera: true,
    idioma: "es",
    introduccion: {
      posfijoRuta: "/", 
      componente: UnaRelacionConJesus,
    },
    guias: [
      {
        posfijoRuta: "/no-tengas-miedo",
        componente: Guia1NoTengasMiedo
      },
      { 
        posfijoRuta: "/encuentro-con-Jesus", 
        componente: Guia2EncuentroConJesus
      },
      { 
        posfijoRuta: "/ve-a-encontrarte-con-Jesus", 
        componente: Guia3VeAEncontrarteConJesus
      },
      { 
        posfijoRuta: "/hablando-con-Dios", 
        component: Guia4HablandoConDios
      }
    ]
  },
  {
    titulo: "Pastores influenciadores",
    prefijoRuta: "/pastores-influenciadores",
    imagen: "/img/rollerskatewedding.jpg",
    idioma: "es",
    sinbilletera: false,
    conbilletera: false,
    introduccion: {
      posfijoRuta: "/", 
      componente: PastoresInfluenciadores 
    },
    guias: []
  },
  {
    titulo: "Ahorra en dólares en OKX",
    subtitulo: "Interés superior al 10% efectiva anual para los primeros US$1000",
    prefijoRuta: "/ahorra-en-dolares-en-okx", 
    imagen: "/img/OKX_Logo.svg",
    sinbilletera: true,
    conbilletera: true,
    idioma: "es",
    introduccion: {
      posfijoRuta: "/",
      componente: AhorraEnDolaresEnOkx
    },
    guias: [
      { posfijoRuta: "/registrate-como-referido", 
        componente: RegistrateComoReferido
      },
      { 
        posfijoRuta: "/compra-usdt-ahorra-y-vende", 
        componente: CompraUsdtAhorraYVende
      },
    ]
  },
  {
    titulo: "Ahorra a más del 100% hasta Agosto de 2024",
    subtitulo: "Aprovecha esta inversión promocional de bajo riesgo que ha venido rentando de Mayo a Agosto de 2024 a más del 100% efectivo anual",
    prefijoRuta: "/ahorra-a-mas-del-100-hasta-Ago-2024",
    imagen: "/img/100pp.png",
    creditoImagen: "Dominio Público",
    enlaceImagen: "",
    sinbilletera: false,
    conbilletera: true,
    valorpago: 10,
    idioma: "es",
    introduccion: {
      posfijoRuta: "/", 
      componente: AhorraAMasDel100HastaAgo2024
    },
    guias: [
      { 
        posfijoRuta: "/instala-billetera-e-intercambia-con-okx", 
        componente: CompraUsdtAhorraYVende
      },
      { posfijoRuta: "/usa-amm-para-dar-liquidez-y-armar-granja", 
        componente: RegistrateComoReferido
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
    path: curso.prefijoRuta + curso.introduccion.posfijoRuta,
    component: curso.introduccion.componente
  })
  for (const guia of curso.guias) {
    rutas.push({
      path: curso.prefijoRuta + guia.posfijoRuta,
      component: guia.componente
    })
  }
}

import AhorraAMasDel100HastaAgo2024 from
  './views/100pp/AhorraAMasDel100HastaAgo2024.vue'


