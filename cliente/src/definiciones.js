
import dotenv from "dotenv"
dotenv.config({path: "../servidor/.env"})

export const API_BUSCA_CURSOS_URL =
    'https://${process.env.CONFIG_HOSTS}:3000/learntg-admin/proyectosfinancieros.json'
//    `https://${process.env.CONFIG_HOSTS}:3000/learntg-admin/proyectosfinancieros.json`
export const API_PRESENTA_CURSO_URL =
    'https://${process.env.CONFIG_HOSTS}:3000/learntg-admin/proyectosfinancieros/curso_id.json'
//    `https://${process.env.CONFIG_HOSTS}:3000/learntg-admin/proyectosfinancieros/curso_id.json`

