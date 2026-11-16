/**
 * Presentación de nombres y fechas del motor `msip`, traducida de
 * `msip-2.2` (`lib/msip/concerns/models/*.rb`, `Msip::Basica`,
 * `Msip::FormatoFechaHelper`).
 *
 * Las funciones son puras: reciben los nombres ya resueltos (el host decide si
 * los lee de la base). Las diferencias deliberadas con Rails se anotan en el
 * README; la principal es que aquí no hay `mattr_accessor` globales: la
 * configuración se pasa por opciones, para que dos consumidores no se pisen.
 *
 * https://gitlab.com/pasosdeJesus/m/-/work_items/69
 */

import type { CodigoError } from './rules.js'

export const MESES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

export const ABMESES = [
  '',
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor)
}

function nombreMes(mes: number | null | undefined): string {
  return mes !== null && mes !== undefined && mes >= 1 && mes <= 12 ? ABMESES[mes] : ''
}

/**
 * Convenciones de sexo que `msip_persona` admite en su restricción
 * `persona_sexo_check` (`Msip::Persona::CONVENCIONES_SEXO`). En Rails la
 * convención se leía de la restricción; aquí se elige explícitamente.
 */
export const CONVENCIONES_SEXO = {
  FMS: {
    sexoFemenino: 'F',
    nombreFemenino: 'FEMENINO',
    sexoMasculino: 'M',
    nombreMasculino: 'MASCULINO',
    sexoSinInformacion: 'S',
    nombreSinInformacion: 'SIN INFORMACIÓN',
  },
  MHS: {
    sexoFemenino: 'M',
    nombreFemenino: 'MUJER',
    sexoMasculino: 'H',
    nombreMasculino: 'HOMBRE',
    sexoSinInformacion: 'S',
    nombreSinInformacion: 'SIN INFORMACIÓN',
  },
  MHSI: {
    sexoFemenino: 'M',
    nombreFemenino: 'MUJER',
    sexoMasculino: 'H',
    nombreMasculino: 'HOMBRE',
    sexoSinInformacion: 'S',
    nombreSinInformacion: 'SIN INFORMACIÓN',
    sexoIntersexual: 'I',
    nombreIntersexual: 'INTERSEXUAL',
  },
  MHO: {
    sexoFemenino: 'M',
    nombreFemenino: 'MUJER',
    sexoMasculino: 'H',
    nombreMasculino: 'HOMBRE',
    sexoSinInformacion: 'O',
    nombreSinInformacion: 'OTRO',
  },
  MHSO: {
    sexoFemenino: 'M',
    nombreFemenino: 'MUJER',
    sexoMasculino: 'H',
    nombreMasculino: 'HOMBRE',
    sexoSinInformacion: 'S',
    nombreSinInformacion: 'SIN INFORMACIÓN',
    sexoIntersexual: 'O',
    nombreIntersexual: 'OTRO',
  },
} as const

export type ConvencionSexo = keyof typeof CONVENCIONES_SEXO

/** La convención que Rails usaba cuando la restricción no era reconocida. */
export const CONVENCION_SEXO_POR_DEFECTO: ConvencionSexo = 'FMS'

export function convencionSexo(codigo: string | null | undefined): ConvencionSexo {
  return codigo && codigo in CONVENCIONES_SEXO
    ? (codigo as ConvencionSexo)
    : CONVENCION_SEXO_POR_DEFECTO
}

function paresConvencion(convencion: ConvencionSexo): Array<[string, string]> {
  const datos: Record<string, string> = CONVENCIONES_SEXO[convencion] as unknown as Record<string, string>
  const pares: Array<[string, string]> = [
    [datos.nombreSinInformacion, datos.sexoSinInformacion],
    [datos.nombreFemenino, datos.sexoFemenino],
    [datos.nombreMasculino, datos.sexoMasculino],
  ]
  if (datos.nombreIntersexual) pares.push([datos.nombreIntersexual, datos.sexoIntersexual])
  return pares
}

/** `Msip::Persona.sexo_opciones`: `[nombre, código]`. */
export function sexoOpciones(
  convencion: ConvencionSexo = CONVENCION_SEXO_POR_DEFECTO,
): Array<[string, string]> {
  return paresConvencion(convencion)
}

/** `Msip::Persona.sexo_opciones_cortas`: `[código, código]`. */
export function sexoOpcionesCortas(
  convencion: ConvencionSexo = CONVENCION_SEXO_POR_DEFECTO,
): Array<[string, string]> {
  return paresConvencion(convencion).map(([, codigo]) => [codigo, codigo])
}

/** `Msip::Persona.sexo_opciones_diccionario`: `{ código: nombre }`. */
export function sexoOpcionesDiccionario(
  convencion: ConvencionSexo = CONVENCION_SEXO_POR_DEFECTO,
): Record<string, string> {
  return Object.fromEntries(paresConvencion(convencion).map(([nombre, codigo]) => [codigo, nombre]))
}

/** Texto de `presenta` para el campo `sexo`; `Sexo desconocido` si no está. */
export function presentaSexo(
  sexo: string | null | undefined,
  convencion: ConvencionSexo = CONVENCION_SEXO_POR_DEFECTO,
): string {
  return sexoOpcionesDiccionario(convencion)[texto(sexo)] ?? 'Sexo desconocido'
}

/** `Msip::Persona::ORIENTACION_OPCIONES`. */
export const ORIENTACION_OPCIONES: ReadonlyArray<[string, string]> = [
  ['SIN INFORMACIÓN', 'S'],
  ['HETEROSEXUAL', 'H'],
  ['LESBIANA', 'L'],
  ['GAY', 'G'],
  ['BISEXUAL', 'B'],
  ['TRANSEXUAL', 'T'],
  ['LGBTQ+', 'O'],
]

export function orientacionOpcionesDiccionario(): Record<string, string> {
  return Object.fromEntries(ORIENTACION_OPCIONES.map(([nombre, codigo]) => [codigo, nombre]))
}

/** Códigos de `Msip::Tipoorg` (incluye los alias del motor Rails). */
export const TIPOORG = {
  ORGACOMP: 1,
  ORGNOACOMP: 2,
  ORGCIVIL: 2,
  INSTCIVIL: 3,
  ESTADO: 3,
  ORGINT: 5,
  GRUPOARMADO: 20,
} as const

/** `presenta_nombre` de `Msip::Persona`: nombres y apellidos sin espacios sobrantes. */
export function presentaNombrePersona(persona: {
  nombres?: string | null
  apellidos?: string | null
}): string {
  return `${texto(persona.nombres)} ${texto(persona.apellidos)}`.trim()
}

/** `fechanac` de Rails: año-mes-día con mes abreviado (`1980-Feb-2`). */
export function fechaNacimiento(persona: {
  anionac?: number | null
  mesnac?: number | null
  dianac?: number | null
}): string {
  return `${texto(persona.anionac)}-${nombreMes(persona.mesnac)}-${texto(persona.dianac)}`
}

/** `presenta_fechanac` de Rails: día/mes/año (`2/Feb/1980`), vacío si no hay datos. */
export function presentaFechaNacimiento(persona: {
  anionac?: number | null
  mesnac?: number | null
  dianac?: number | null
}): string {
  const resultado = `${texto(persona.dianac)}/${nombreMes(persona.mesnac)}/${texto(persona.anionac)}`
  return resultado === '//' ? '' : resultado
}

/** `presenta_nombre` de `Msip::Departamento` (`conf_presenta_nombre_con_origen`). */
export function presentaNombreDepartamento(
  departamento: { nombre?: string | null },
  opciones: { conOrigen?: boolean; paisNombre?: string | null } = {},
): string {
  if (opciones.conOrigen && opciones.paisNombre !== undefined) {
    return `${texto(departamento.nombre)} / ${texto(opciones.paisNombre)}`
  }
  return texto(departamento.nombre)
}

/** `presenta_nombre` de `Msip::Municipio`. */
export function presentaNombreMunicipio(
  municipio: { nombre?: string | null },
  opciones: {
    conDepartamento?: boolean
    conOrigen?: boolean
    departamentoNombre?: string | null
    paisNombre?: string | null
  } = {},
): string {
  if (opciones.conDepartamento && opciones.departamentoNombre !== undefined) {
    return `${texto(municipio.nombre)} / ${texto(opciones.departamentoNombre)}`
  }
  if (opciones.conOrigen && opciones.departamentoNombre !== undefined && opciones.paisNombre !== undefined) {
    return `${texto(municipio.nombre)} / ${texto(opciones.departamentoNombre)} / ${texto(opciones.paisNombre)}`
  }
  return texto(municipio.nombre)
}

/** `presenta_nombre` de `Msip::Centropoblado` (conserva el formato del legado). */
export function presentaNombreCentropoblado(
  centropoblado: { nombre?: string | null },
  opciones: {
    conOrigen?: boolean
    municipioNombre?: string | null
    departamentoNombre?: string | null
    paisNombre?: string | null
  } = {},
): string {
  if (
    opciones.conOrigen &&
    opciones.municipioNombre !== undefined &&
    opciones.departamentoNombre !== undefined &&
    opciones.paisNombre !== undefined
  ) {
    return `${texto(centropoblado.nombre)} / ${texto(opciones.municipioNombre)}/${texto(opciones.departamentoNombre)} / ${texto(opciones.paisNombre)}`
  }
  return texto(centropoblado.nombre)
}

/** `presenta_nombre` de `Msip::Vereda`; el prefijo `VEREDA:` es del legado. */
export function presentaNombreVereda(
  vereda: { nombre?: string | null },
  opciones: {
    conOrigen?: boolean
    municipioNombre?: string | null
    departamentoNombre?: string | null
    paisNombre?: string | null
  } = {},
): string {
  if (
    opciones.conOrigen &&
    opciones.municipioNombre !== undefined &&
    opciones.departamentoNombre !== undefined &&
    opciones.paisNombre !== undefined
  ) {
    return `VEREDA: ${texto(vereda.nombre)} / ${texto(opciones.municipioNombre)}/${texto(opciones.departamentoNombre)} / ${texto(opciones.paisNombre)}`
  }
  return texto(vereda.nombre)
}

/** `presenta_nombre` de `Msip::Orgsocial`: usa el nombre del grupo de personas. */
export function presentaNombreOrgsocial(orgsocial: {
  grupoperNombre?: string | null
  grupo?: string | null
}): string {
  return texto(orgsocial.grupoperNombre ?? orgsocial.grupo)
}

/** Opciones de `presenta_nombre` de `Msip::Ubicacion` (un valor no nulo las activa). */
export interface OpcionesPresentaUbicacion {
  sinPais?: boolean | number | null
  sinDepartamento?: boolean | number | null
  sinMunicipio?: boolean | number | null
  sinCentropoblado?: boolean | number | null
}

/**
 * `presenta_nombre` de `Msip::Ubicacion`: cadena país / departamento /
 * municipio / centro poblado, omitiendo los niveles pedidos.
 */
export function presentaNombreUbicacion(
  ubicacion: {
    paisNombre?: string | null
    departamentoNombre?: string | null
    municipioNombre?: string | null
    centropobladoNombre?: string | null
  },
  opciones: OpcionesPresentaUbicacion = {},
): string {
  const partes: string[] = []
  const incluir = (valor: string | null | undefined, omitir: boolean): void => {
    if (!omitir && valor) partes.push(valor)
  }
  incluir(ubicacion.paisNombre, Boolean(opciones.sinPais))
  incluir(ubicacion.departamentoNombre, Boolean(opciones.sinDepartamento))
  incluir(ubicacion.municipioNombre, Boolean(opciones.sinMunicipio))
  incluir(ubicacion.centropobladoNombre, Boolean(opciones.sinCentropoblado))
  return partes.join(' / ')
}

/** `codlocal` de `Msip::Departamento` (por ejemplo DIVIPOLA). */
export function codlocalDepartamento(deplocalCod: number | null | undefined): number | null {
  return deplocalCod ?? null
}

/** `codlocal` de `Msip::Municipio`: código del departamento * 1000 + el municipal. */
export function codlocalMunicipio(
  deplocalCodDepartamento: number | null | undefined,
  munlocalCod: number | null | undefined,
): number | null {
  if (deplocalCodDepartamento === null || deplocalCodDepartamento === undefined) return null
  if (munlocalCod === null || munlocalCod === undefined) return null
  return deplocalCodDepartamento * 1000 + munlocalCod
}

/**
 * `Msip::Ubicacionpre.nomenclatura` (la misma función PostgreSQL
 * `msip_ubicacionpre_nomenclatura`): devuelve `[nombre, nombre_sin_pais]`.
 * Si el país está vacío devuelve `[null, null]`.
 */
export function nomenclatura(
  pais: string | null | undefined,
  departamento: string | null | undefined,
  municipio: string | null | undefined,
  centropoblado: string | null | undefined,
  vereda: string | null | undefined,
  lugar: string | null | undefined,
  sitio: string | null | undefined,
): [string | null, string | null] {
  const paisLimpio = texto(pais).trim()
  if (paisLimpio === '') return [null, null]
  const dep = texto(departamento).trim()
  const mun = texto(municipio).trim()
  const cp = texto(centropoblado).trim()
  const ver = texto(vereda).trim()
  const lug = texto(lugar).trim()
  const sit = texto(sitio).trim()

  let nombre: string
  let nombreSinPais: string | null
  if (dep === '') {
    nombre = paisLimpio
    nombreSinPais = null
  } else if (mun === '') {
    nombre = `${dep} / ${paisLimpio}`
    nombreSinPais = dep
  } else if (ver === '' && cp === '') {
    nombre = `${mun} / ${dep} / ${paisLimpio}`
    nombreSinPais = `${mun} / ${dep}`
  } else if (ver !== '') {
    nombre = `Vereda ${ver} / ${mun} / ${dep} / ${paisLimpio}`
    nombreSinPais = `Vereda ${ver} / ${mun} / ${dep}`
  } else {
    nombre = `${cp} / ${mun} / ${dep} / ${paisLimpio}`
    nombreSinPais = `${cp} / ${mun} / ${dep}`
  }

  if (lug !== '') {
    nombre = `${lug} / ${nombre}`
    nombreSinPais = `${lug}${nombreSinPais ? ` / ${nombreSinPais}` : ''}`
    if (sit !== '') {
      nombre = `${sit} / ${nombre}`
      nombreSinPais = `${sit} / ${nombreSinPais}`
    }
  }
  return [nombre, nombreSinPais]
}

/** Error de presentación con el mismo catálogo de códigos que las reglas. */
export interface ErrorPresentacion {
  campo: string
  codigo: CodigoError
}
