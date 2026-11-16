/**
 * Reglas puras del motor `msip`, traducidas de `msip-2.2`.
 *
 * Fuente: `lib/msip/concerns/models/*.rb` y `app/models/msip/basica.rb`. Las
 * validaciones devuelven **códigos** (no textos): el host decide cómo
 * presentarlos. Las reglas que Rails resolvía con una consulta (unicidad,
 * pertenencia geográfica, inversos de relación) reciben el resultado de esa
 * consulta como un booleano en `opciones`/`contexto`; las consultas mismas
 * viven en `scopes.ts`. Esa separación es la que permite probar las reglas sin
 * base de datos.
 *
 * https://gitlab.com/pasosdeJesus/m/-/work_items/69
 */

export type CodigoError =
  | 'requerido'
  | 'largo_maximo'
  | 'unico'
  | 'numerico'
  | 'fuera_rango'
  | 'fecha_invalida'
  | 'fecha_anterior_2000'
  | 'deshabilitacion_anterior_creacion'
  | 'documento_formato'
  | 'mutuamente_excluyentes'
  | 'referencia_invalida'
  | 'jerarquia'
  | 'pareja_repetida'
  | 'inverso_inexistente'
  | 'inverso_asimetrico'
  | 'anio_futuro'
  | 'anio_anterior_1900'
  | 'mes_invalido'
  | 'dia_invalido'

export interface ErrorRegla {
  campo: string
  codigo: CodigoError
  parametros?: Record<string, string | number | boolean | null>
}

export interface ResultadoReglas {
  valido: boolean
  errores: ErrorRegla[]
}

export type EstiloNombre = 'mayusculas' | 'tal-cual'

/** La fecha mínima que `Msip::Basica` acepta para `fechacreacion`. */
export const FECHA_CREACION_MINIMA = '2000-01-01'

/** Año mínimo de nacimiento que valida `Msip::Persona`. */
export const ANIO_NACIMIENTO_MINIMO = 1900

export function esBlanco(valor: unknown): boolean {
  return valor === null || valor === undefined || String(valor).trim() === ''
}

export function texto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor)
}

/** Longitud en caracteres (como `ActiveModel::Validations`), no en unidades UTF-16. */
export function longitud(valor: unknown): number {
  return [...texto(valor)].length
}

/** Quita espacios redundantes y, según el estilo, pasa a mayúsculas. */
export function normalizarNombre(valor: unknown, estilo: EstiloNombre = 'mayusculas'): string | null {
  if (esBlanco(valor)) return null
  const limpio = texto(valor).trim().replace(/\s+/g, ' ')
  return estilo === 'mayusculas' ? limpio.toUpperCase() : limpio
}

/** Códigos de tabla básica que Rails normalizaba con `upcase.squish`. */
export function normalizarCodigo(valor: unknown): string | null {
  if (esBlanco(valor)) return null
  return texto(valor).trim().replace(/\s+/g, ' ').toUpperCase()
}

/** Fecha `YYYY-MM-DD` o `Date` como fecha UTC; `null` si no es válida. */
export function fechaISO(valor: unknown): Date | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime())
      ? null
      : new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()))
  }
  if (esBlanco(valor)) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto(valor).trim())
  if (!match) return null
  const anio = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null
  }
  return fecha
}

function compararFechas(a: Date, b: Date): number {
  return a.getTime() - b.getTime()
}

export function finalizar(errores: ErrorRegla[]): ResultadoReglas {
  return { valido: errores.length === 0, errores }
}

function requerido(errores: ErrorRegla[], campo: string, valor: unknown): void {
  if (esBlanco(valor)) errores.push({ campo, codigo: 'requerido' })
}

function largoMaximo(errores: ErrorRegla[], campo: string, valor: unknown, max: number): void {
  if (longitud(valor) > max) errores.push({ campo, codigo: 'largo_maximo', parametros: { max } })
}

function unico(errores: ErrorRegla[], campo: string, duplicado?: boolean): void {
  if (duplicado) errores.push({ campo, codigo: 'unico' })
}

function numerico(errores: ErrorRegla[], campo: string, valor: unknown): void {
  if (esBlanco(valor)) return
  const numero = Number(valor)
  if (!Number.isInteger(numero)) errores.push({ campo, codigo: 'numerico' })
}

function validarFechasBasica(
  errores: ErrorRegla[],
  fechacreacion: unknown,
  fechadeshabilitacion: unknown,
  requerida: boolean,
): void {
  if (requerida) requerido(errores, 'fechacreacion', fechacreacion)
  const creacion = fechaISO(fechacreacion)
  if (!esBlanco(fechacreacion) && !creacion) {
    errores.push({ campo: 'fechacreacion', codigo: 'fecha_invalida' })
  } else if (creacion && compararFechas(creacion, new Date(Date.UTC(2000, 0, 1))) < 0) {
    errores.push({ campo: 'fechacreacion', codigo: 'fecha_anterior_2000' })
  }

  const deshabilitacion = fechaISO(fechadeshabilitacion)
  if (!esBlanco(fechadeshabilitacion) && !deshabilitacion) {
    errores.push({ campo: 'fechadeshabilitacion', codigo: 'fecha_invalida' })
  } else if (creacion && deshabilitacion && compararFechas(deshabilitacion, creacion) < 0) {
    errores.push({ campo: 'fechadeshabilitacion', codigo: 'deshabilitacion_anterior_creacion' })
  }
}

/** Campos comunes de `Msip::Basica`. */
export interface CamposBasica {
  nombre?: string | null
  observaciones?: string | null
  fechacreacion?: string | Date | null
  fechadeshabilitacion?: string | Date | null
}

export interface OpcionesBasica {
  /** `Nombresunicos` en Rails; `false` desactiva la unicidad global del nombre. */
  nombresUnicos?: boolean
  maxLargoNombre?: number
  maxLargoObservaciones?: number
  /** Resultado de la consulta de unicidad, ya calculado por el host. */
  nombreUnico?: boolean
  fechacreacionRequerida?: boolean
}

/** Reglas de `Msip::Basica`: nombre, observaciones, creación y deshabilitación. */
export function validarBasica(campos: CamposBasica = {}, opciones: OpcionesBasica = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'nombre', campos.nombre)
  largoMaximo(errores, 'nombre', campos.nombre, opciones.maxLargoNombre ?? 500)
  if (opciones.nombresUnicos !== false) unico(errores, 'nombre', opciones.nombreUnico)
  largoMaximo(errores, 'observaciones', campos.observaciones, opciones.maxLargoObservaciones ?? 5000)
  validarFechasBasica(
    errores,
    campos.fechacreacion,
    campos.fechadeshabilitacion,
    opciones.fechacreacionRequerida !== false,
  )
  return finalizar(errores)
}

export interface CamposPais extends CamposBasica {
  nombreiso_espanol?: string | null
  alfa2?: string | null
  alfa3?: string | null
  div1?: string | null
  div2?: string | null
  div3?: string | null
}

export interface OpcionesPais extends OpcionesBasica {
  nombreisoUnico?: boolean
  alfa2Unico?: boolean
  alfa3Unico?: boolean
}

/** `Msip::Pais`: `nombre` de 200 (no 500) y nombres ISO/alfas únicos. */
export function validarPais(campos: CamposPais = {}, opciones: OpcionesPais = {}): ResultadoReglas {
  const errores = validarBasica(campos, { ...opciones, maxLargoNombre: 200 }).errores
  requerido(errores, 'nombreiso_espanol', campos.nombreiso_espanol)
  largoMaximo(errores, 'nombreiso_espanol', campos.nombreiso_espanol, 200)
  unico(errores, 'nombreiso_espanol', opciones.nombreisoUnico)
  largoMaximo(errores, 'alfa2', campos.alfa2, 2)
  unico(errores, 'alfa2', opciones.alfa2Unico)
  largoMaximo(errores, 'alfa3', campos.alfa3, 3)
  unico(errores, 'alfa3', opciones.alfa3Unico)
  largoMaximo(errores, 'div1', campos.div1, 100)
  largoMaximo(errores, 'div2', campos.div2, 100)
  largoMaximo(errores, 'div3', campos.div3, 100)
  return finalizar(errores)
}

export interface CamposDepartamento extends CamposBasica {
  pais_id?: number | null
  deplocal_cod?: number | null
}

export interface OpcionesDepartamento extends OpcionesBasica {
  nombreUnicoEnPais?: boolean
  codigoLocalUnicoEnPais?: boolean
}

/** `Msip::Departamento`: nombre único dentro del país (no global). */
export function validarDepartamento(
  campos: CamposDepartamento = {},
  opciones: OpcionesDepartamento = {},
): ResultadoReglas {
  const errores = validarBasica(campos, { ...opciones, nombresUnicos: false }).errores
  requerido(errores, 'pais_id', campos.pais_id)
  unico(errores, 'nombre', opciones.nombreUnicoEnPais)
  unico(errores, 'deplocal_cod', opciones.codigoLocalUnicoEnPais)
  return finalizar(errores)
}

export interface CamposMunicipio extends CamposBasica {
  departamento_id?: number | null
  munlocal_cod?: number | null
}

export interface OpcionesMunicipio extends OpcionesBasica {
  nombreUnicoEnDepartamento?: boolean
  codigoLocalUnicoEnDepartamento?: boolean
}

/** `Msip::Municipio`: nombre y código local únicos dentro del departamento. */
export function validarMunicipio(
  campos: CamposMunicipio = {},
  opciones: OpcionesMunicipio = {},
): ResultadoReglas {
  const errores = validarBasica(campos, { ...opciones, nombresUnicos: false }).errores
  requerido(errores, 'departamento_id', campos.departamento_id)
  unico(errores, 'nombre', opciones.nombreUnicoEnDepartamento)
  unico(errores, 'munlocal_cod', opciones.codigoLocalUnicoEnDepartamento)
  return finalizar(errores)
}

export interface CamposCentropoblado extends CamposBasica {
  municipio_id?: number | null
  cplocal_cod?: number | null
  tcentropoblado_id?: string | null
}

export interface OpcionesCentropoblado extends OpcionesBasica {
  nombreUnicoEnMunicipio?: boolean
  codigoLocalUnicoEnMunicipio?: boolean
}

/** `Msip::Centropoblado`: nombre y código local únicos dentro del municipio. */
export function validarCentropoblado(
  campos: CamposCentropoblado = {},
  opciones: OpcionesCentropoblado = {},
): ResultadoReglas {
  const errores = validarBasica(campos, { ...opciones, nombresUnicos: false }).errores
  requerido(errores, 'municipio_id', campos.municipio_id)
  requerido(errores, 'tcentropoblado_id', campos.tcentropoblado_id)
  largoMaximo(errores, 'tcentropoblado_id', campos.tcentropoblado_id, 10)
  unico(errores, 'nombre', opciones.nombreUnicoEnMunicipio)
  unico(errores, 'cplocal_cod', opciones.codigoLocalUnicoEnMunicipio)
  return finalizar(errores)
}

export interface CamposVereda extends CamposBasica {
  municipio_id?: number | null
  verlocal_cod?: number | null
}

export interface OpcionesVereda extends OpcionesBasica {
  codigoLocalUnicoEnMunicipio?: boolean
}

/** `Msip::Vereda`: veredas repetidas por nombre; el código local es único en el municipio. */
export function validarVereda(campos: CamposVereda = {}, opciones: OpcionesVereda = {}): ResultadoReglas {
  const errores = validarBasica(campos, { ...opciones, nombresUnicos: false }).errores
  requerido(errores, 'municipio_id', campos.municipio_id)
  unico(errores, 'verlocal_cod', opciones.codigoLocalUnicoEnMunicipio)
  return finalizar(errores)
}

export interface CamposTcentropoblado extends CamposBasica {
  id?: string | null
}

/** `Msip::Tcentropoblado`: el id es un código de hasta 10 caracteres, único. */
export function validarTcentropoblado(
  campos: CamposTcentropoblado = {},
  opciones: OpcionesBasica & { idUnico?: boolean } = {},
): ResultadoReglas {
  const errores = validarBasica(campos, opciones).errores
  requerido(errores, 'id', campos.id)
  largoMaximo(errores, 'id', campos.id, 10)
  unico(errores, 'id', opciones.idUnico)
  return finalizar(errores)
}

export interface CamposTrelacion extends CamposBasica {
  id?: string | null
  inverso?: string | null
}

export interface OpcionesTrelacion extends OpcionesBasica {
  idUnico?: boolean
  inversoExiste?: boolean
  inversosSimetricos?: boolean
}

/** `Msip::Trelacion`: id/inverso de 2 caracteres y relación inversa existente. */
export function validarTrelacion(campos: CamposTrelacion = {}, opciones: OpcionesTrelacion = {}): ResultadoReglas {
  const errores = validarBasica(campos, { ...opciones, maxLargoObservaciones: 200 }).errores
  requerido(errores, 'id', campos.id)
  largoMaximo(errores, 'id', campos.id, 2)
  unico(errores, 'id', opciones.idUnico)
  requerido(errores, 'inverso', campos.inverso)
  largoMaximo(errores, 'inverso', campos.inverso, 2)
  if (opciones.inversoExiste === false) {
    errores.push({ campo: 'inverso', codigo: 'inverso_inexistente' })
  }
  if (opciones.inversosSimetricos === false) {
    errores.push({ campo: 'inverso', codigo: 'inverso_asimetrico' })
  }
  return finalizar(errores)
}

export interface CamposTdocumento extends CamposBasica {
  sigla?: string | null
  formatoregex?: string | null
}

/** `Msip::Tdocumento`: sigla obligatoria y expresión regular del número. */
export function validarTdocumento(campos: CamposTdocumento = {}, opciones: OpcionesBasica = {}): ResultadoReglas {
  const errores = validarBasica(campos, opciones).errores
  requerido(errores, 'sigla', campos.sigla)
  largoMaximo(errores, 'sigla', campos.sigla, 100)
  largoMaximo(errores, 'formatoregex', campos.formatoregex, 500)
  return finalizar(errores)
}

export interface CamposEtnia extends CamposBasica {
  descripcion?: string | null
}

/** `Msip::Etnia`: descripción de 1000. */
export function validarEtnia(campos: CamposEtnia = {}, opciones: OpcionesBasica = {}): ResultadoReglas {
  const errores = validarBasica(campos, opciones).errores
  largoMaximo(errores, 'descripcion', campos.descripcion, 1000)
  return finalizar(errores)
}

/** `Msip::Etiqueta`: observaciones de 500 (no 5000). */
export function validarEtiqueta(campos: CamposBasica = {}, opciones: OpcionesBasica = {}): ResultadoReglas {
  return validarBasica(campos, { ...opciones, maxLargoObservaciones: 500 })
}

export interface CamposPersona {
  nombres?: string | null
  apellidos?: string | null
  numerodocumento?: string | null
  sexo?: string | null
  anionac?: number | string | null
  mesnac?: number | string | null
  dianac?: number | string | null
  tdocumento?: { formatoregex?: string | null; ayuda?: string | null } | null
}

export interface OpcionesPersona {
  /** Año actual; se inyecta para que la prueba no dependa del reloj. */
  anioActual?: number
  /** Sexos admitidos por la convención de la base; si se omite no se restringe. */
  sexosPermitidos?: readonly string[]
}

/**
 * `Msip::Persona`: nombres/apellidos, fecha de nacimiento y formato del
 * documento. `sexo` se exige y, si el host pasa `sexosPermitidos`, también se
 * restringe a la convención de la base.
 */
export function validarPersona(campos: CamposPersona = {}, opciones: OpcionesPersona = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'nombres', campos.nombres)
  largoMaximo(errores, 'nombres', campos.nombres, 100)
  requerido(errores, 'apellidos', campos.apellidos)
  largoMaximo(errores, 'apellidos', campos.apellidos, 100)
  largoMaximo(errores, 'numerodocumento', campos.numerodocumento, 100)
  requerido(errores, 'sexo', campos.sexo)
  if (!esBlanco(campos.sexo) && opciones.sexosPermitidos && !opciones.sexosPermitidos.includes(texto(campos.sexo))) {
    errores.push({
      campo: 'sexo',
      codigo: 'fuera_rango',
      parametros: { permitidos: opciones.sexosPermitidos.join(',') },
    })
  }

  numerico(errores, 'anionac', campos.anionac)
  numerico(errores, 'mesnac', campos.mesnac)
  numerico(errores, 'dianac', campos.dianac)

  const anio = esBlanco(campos.anionac) ? null : Number(campos.anionac)
  const mes = esBlanco(campos.mesnac) ? null : Number(campos.mesnac)
  const dia = esBlanco(campos.dianac) ? null : Number(campos.dianac)
  const anioActual = opciones.anioActual ?? new Date().getUTCFullYear()

  if (anio !== null) {
    if (anio > anioActual) errores.push({ campo: 'anionac', codigo: 'anio_futuro' })
    if (anio < ANIO_NACIMIENTO_MINIMO) errores.push({ campo: 'anionac', codigo: 'anio_anterior_1900' })
  }
  if (mes !== null && (mes < 1 || mes > 12)) {
    errores.push({ campo: 'mesnac', codigo: 'mes_invalido' })
  }
  if (dia !== null) {
    if (dia < 1) {
      errores.push({ campo: 'dianac', codigo: 'dia_invalido', parametros: { min: 1 } })
    } else if (mes === 2 && dia > 29) {
      errores.push({ campo: 'dianac', codigo: 'dia_invalido', parametros: { max: 29 } })
    } else if (anio !== null && mes === 2 && dia === 29) {
      const ultimoDiaFebrero = new Date(Date.UTC(anio, 2, 0)).getUTCDate()
      if (dia > ultimoDiaFebrero) {
        errores.push({ campo: 'dianac', codigo: 'dia_invalido', parametros: { max: ultimoDiaFebrero } })
      }
    } else if (mes !== null && [4, 6, 9, 11].includes(mes) && dia > 30) {
      errores.push({ campo: 'dianac', codigo: 'dia_invalido', parametros: { max: 30 } })
    } else if (dia > 31) {
      errores.push({ campo: 'dianac', codigo: 'dia_invalido', parametros: { max: 31 } })
    }
  }

  const regex = campos.tdocumento?.formatoregex
  if (campos.tdocumento && !esBlanco(regex) && !esBlanco(campos.numerodocumento)) {
    try {
      const patron = new RegExp(`^(?:${texto(regex)})$`)
      if (!patron.test(texto(campos.numerodocumento))) {
        errores.push({
          campo: 'numerodocumento',
          codigo: 'documento_formato',
          parametros: { ayuda: campos.tdocumento.ayuda ?? null },
        })
      }
    } catch {
      // A malformed regex is a data problem in the catalog, not a person error.
    }
  }

  return finalizar(errores)
}

export interface CamposPersonaTrelacion {
  persona1?: number | null
  persona2?: number | null
  trelacion_id?: string | null
}

export interface OpcionesPersonaTrelacion {
  /** La consulta encontró otra relación entre la misma pareja (cualquier tipo). */
  parejaYaRelacionada?: boolean
}

/** `Msip::PersonaTrelacion`: dos personas distintas y una sola relación por pareja. */
export function validarPersonaTrelacion(
  campos: CamposPersonaTrelacion = {},
  opciones: OpcionesPersonaTrelacion = {},
): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'persona1', campos.persona1)
  requerido(errores, 'persona2', campos.persona2)
  requerido(errores, 'trelacion_id', campos.trelacion_id)
  if (
    !esBlanco(campos.persona1) &&
    !esBlanco(campos.persona2) &&
    Number(campos.persona1) === Number(campos.persona2)
  ) {
    errores.push({ campo: 'persona1', codigo: 'pareja_repetida' })
  }
  if (opciones.parejaYaRelacionada) {
    errores.push({ campo: 'persona1', codigo: 'pareja_repetida' })
  }
  return finalizar(errores)
}

export interface CamposGrupoper {
  nombre?: string | null
  anotaciones?: string | null
}

/** `Msip::Grupoper`: nombre de 500 y anotaciones de 500 (el esquema permite 1000). */
export function validarGrupoper(campos: CamposGrupoper = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'nombre', campos.nombre)
  largoMaximo(errores, 'nombre', campos.nombre, 500)
  largoMaximo(errores, 'anotaciones', campos.anotaciones, 500)
  return finalizar(errores)
}

export interface CamposOrgsocial {
  grupoper_id?: number | null
  tipoorg_id?: number | null
  telefono?: string | null
  fax?: string | null
  direccion?: string | null
  web?: string | null
  fechadeshabilitacion?: string | Date | null
}

/** `Msip::Orgsocial`: organización y tipo obligatorios; contactos de 500. */
export function validarOrgsocial(campos: CamposOrgsocial = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'grupoper_id', campos.grupoper_id)
  requerido(errores, 'tipoorg_id', campos.tipoorg_id)
  largoMaximo(errores, 'telefono', campos.telefono, 500)
  largoMaximo(errores, 'fax', campos.fax, 500)
  largoMaximo(errores, 'direccion', campos.direccion, 500)
  largoMaximo(errores, 'web', campos.web, 500)
  if (!esBlanco(campos.fechadeshabilitacion) && !fechaISO(campos.fechadeshabilitacion)) {
    errores.push({ campo: 'fechadeshabilitacion', codigo: 'fecha_invalida' })
  }
  return finalizar(errores)
}

export interface CamposOrgsocialPersona {
  persona_id?: number | null
}

/** `Msip::OrgsocialPersona`: la persona es obligatoria; organización y perfil no. */
export function validarOrgsocialPersona(campos: CamposOrgsocialPersona = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'persona_id', campos.persona_id)
  return finalizar(errores)
}

/** `Msip::OrgsocialSectororgsocial`: ambos lados de la relación son obligatorios. */
export function validarOrgsocialSectororgsocial(campos: {
  orgsocial_id?: number | null
  sectororgsocial_id?: number | null
} = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'orgsocial_id', campos.orgsocial_id)
  requerido(errores, 'sectororgsocial_id', campos.sectororgsocial_id)
  return finalizar(errores)
}

/** `Msip::EtiquetaPersona`: etiqueta, persona, usuario y fecha obligatorios. */
export function validarEtiquetaPersona(campos: {
  etiqueta_id?: number | null
  persona_id?: number | null
  usuario_id?: number | null
  fecha?: string | Date | null
} = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'etiqueta_id', campos.etiqueta_id)
  requerido(errores, 'persona_id', campos.persona_id)
  requerido(errores, 'usuario_id', campos.usuario_id)
  requerido(errores, 'fecha', campos.fecha)
  if (!esBlanco(campos.fecha) && !fechaISO(campos.fecha)) {
    errores.push({ campo: 'fecha', codigo: 'fecha_invalida' })
  }
  return finalizar(errores)
}

/** `Msip::EtiquetaMunicipio`: ambos lados de la relación son obligatorios. */
export function validarEtiquetaMunicipio(campos: {
  etiqueta_id?: number | null
  municipio_id?: number | null
} = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'etiqueta_id', campos.etiqueta_id)
  requerido(errores, 'municipio_id', campos.municipio_id)
  return finalizar(errores)
}

/** `Msip::GrupoUsuario`: usuario y grupo obligatorios. */
export function validarGrupoUsuario(campos: {
  usuario_id?: number | null
  grupo_id?: number | null
} = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'usuario_id', campos.usuario_id)
  requerido(errores, 'grupo_id', campos.grupo_id)
  return finalizar(errores)
}

export interface CamposUbicacion {
  pais_id?: number | null
  tsitio_id?: number | null
  lugar?: string | null
  sitio?: string | null
}

/** `Msip::Ubicacion`: país y tipo de sitio obligatorios; lugar/sitio de 500. */
export function validarUbicacion(campos: CamposUbicacion = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'pais_id', campos.pais_id)
  requerido(errores, 'tsitio_id', campos.tsitio_id)
  largoMaximo(errores, 'lugar', campos.lugar, 500)
  largoMaximo(errores, 'sitio', campos.sitio, 500)
  return finalizar(errores)
}

export interface ContextoUbicacionpre {
  nombreUnico?: boolean
  /** `Msip::Departamento.where(pais_id, id).count === 1`. */
  departamentoPertenecePais?: boolean
  /** `Msip::Municipio.where(departamento_id, id).count === 1`. */
  municipioPerteneceDepartamento?: boolean
  /** `Msip::Centropoblado.where(municipio_id, id).count === 1`. */
  centropobladoPerteneceMunicipio?: boolean
  /** `Msip::Vereda.where(municipio_id, id).count === 1`. */
  veredaPerteneceMunicipio?: boolean
  /** `Msip::Tsitio.where(id).count === 1`; solo se mira si `tsitio_id` viene. */
  tsitioValido?: boolean
}

export interface CamposUbicacionpre {
  nombre?: string | null
  nombre_sin_pais?: string | null
  pais_id?: number | null
  departamento_id?: number | null
  municipio_id?: number | null
  centropoblado_id?: number | null
  vereda_id?: number | null
  tsitio_id?: number | null
  lugar?: string | null
  sitio?: string | null
}

/**
 * `Msip::Ubicacionpre`: nombre único de 2000, centro poblado y vereda
 * excluyentes, y cadena país → departamento → municipio → centro/vereda.
 */
export function validarUbicacionpre(
  campos: CamposUbicacionpre = {},
  contexto: ContextoUbicacionpre = {},
): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'nombre', campos.nombre)
  largoMaximo(errores, 'nombre', campos.nombre, 2000)
  unico(errores, 'nombre', contexto.nombreUnico)
  largoMaximo(errores, 'nombre_sin_pais', campos.nombre_sin_pais, 2000)
  largoMaximo(errores, 'lugar', campos.lugar, 500)
  largoMaximo(errores, 'sitio', campos.sitio, 500)
  requerido(errores, 'pais_id', campos.pais_id)

  if (!esBlanco(campos.centropoblado_id) && !esBlanco(campos.vereda_id)) {
    errores.push({ campo: 'centropoblado_id', codigo: 'mutuamente_excluyentes' })
  }

  if (!esBlanco(campos.tsitio_id) && contexto.tsitioValido === false) {
    errores.push({ campo: 'tsitio_id', codigo: 'referencia_invalida' })
  }

  if (!esBlanco(campos.pais_id) && !esBlanco(campos.departamento_id) && contexto.departamentoPertenecePais === false) {
    errores.push({ campo: 'departamento_id', codigo: 'jerarquia', parametros: { padre: 'pais_id' } })
  }

  if (
    (esBlanco(campos.departamento_id)) &&
    (!esBlanco(campos.municipio_id) || !esBlanco(campos.centropoblado_id) || !esBlanco(campos.vereda_id))
  ) {
    errores.push({ campo: 'departamento_id', codigo: 'requerido' })
  }
  if (!esBlanco(campos.departamento_id) && !esBlanco(campos.municipio_id) && contexto.municipioPerteneceDepartamento === false) {
    errores.push({ campo: 'municipio_id', codigo: 'jerarquia', parametros: { padre: 'departamento_id' } })
  }

  if (esBlanco(campos.municipio_id) && (!esBlanco(campos.centropoblado_id) || !esBlanco(campos.vereda_id))) {
    errores.push({ campo: 'municipio_id', codigo: 'requerido' })
  }
  if (!esBlanco(campos.municipio_id) && !esBlanco(campos.centropoblado_id) && contexto.centropobladoPerteneceMunicipio === false) {
    errores.push({ campo: 'centropoblado_id', codigo: 'jerarquia', parametros: { padre: 'municipio_id' } })
  }
  if (!esBlanco(campos.municipio_id) && !esBlanco(campos.vereda_id) && contexto.veredaPerteneceMunicipio === false) {
    errores.push({ campo: 'vereda_id', codigo: 'jerarquia', parametros: { padre: 'municipio_id' } })
  }

  return finalizar(errores)
}

export interface CamposVigencia {
  vigenciaini?: string | Date | null
  vigenciafin?: string | Date | null
}

/** Regla común de las tablas `*_histvigencia`: fin obligatorio y posterior al inicio. */
export function validarVigencia(campos: CamposVigencia = {}): ResultadoReglas {
  const errores: ErrorRegla[] = []
  requerido(errores, 'vigenciafin', campos.vigenciafin)
  const inicio = fechaISO(campos.vigenciaini)
  const fin = fechaISO(campos.vigenciafin)
  if (!esBlanco(campos.vigenciaini) && !inicio) {
    errores.push({ campo: 'vigenciaini', codigo: 'fecha_invalida' })
  }
  if (!esBlanco(campos.vigenciafin) && !fin) {
    errores.push({ campo: 'vigenciafin', codigo: 'fecha_invalida' })
  }
  if (inicio && fin && compararFechas(fin, inicio) < 0) {
    errores.push({ campo: 'vigenciafin', codigo: 'fuera_rango', parametros: { minimo: texto(campos.vigenciaini) } })
  }
  return finalizar(errores)
}

export function validarPaisHistvigencia(campos: CamposVigencia & { pais_id?: number | null } = {}): ResultadoReglas {
  const errores = validarVigencia(campos).errores
  requerido(errores, 'pais_id', campos.pais_id)
  return finalizar(errores)
}

export function validarDepartamentoHistvigencia(
  campos: CamposVigencia & { departamento_id?: number | null } = {},
): ResultadoReglas {
  const errores = validarVigencia(campos).errores
  requerido(errores, 'departamento_id', campos.departamento_id)
  return finalizar(errores)
}

export function validarMunicipioHistvigencia(
  campos: CamposVigencia & { municipio_id?: number | null } = {},
): ResultadoReglas {
  const errores = validarVigencia(campos).errores
  requerido(errores, 'municipio_id', campos.municipio_id)
  return finalizar(errores)
}

export function validarCentropobladoHistvigencia(
  campos: CamposVigencia & { centropoblado_id?: number | null } = {},
): ResultadoReglas {
  const errores = validarVigencia(campos).errores
  requerido(errores, 'centropoblado_id', campos.centropoblado_id)
  return finalizar(errores)
}

/**
 * Diferencias deliberadas con Rails (documentadas también en el README):
 * - La unicidad no se consulta aquí: el host pasa el resultado (`nombreUnico`,
 *   `idUnico`, ...). Rails la consultaba durante `save`.
 * - Una `formatoregex` nula o vacía no valida el documento (Rails podía
 *   intentar compilar `^$`); los datos del catálogo deben traerla.
 * - Los códigos locales nulos no se consideran duplicados entre sí; la regla
 *   sólo reporta `unico` cuando el host ya encontró otro código igual.
 */
export const NOTAS_DIFERENCIAS = {
  unicidad: 'Las consultas de unicidad viven en scopes.ts; las reglas reciben el booleano.',
  formatoregex: 'Una formatoregex nula o vacía desactiva la validación del documento.',
  codigosNulos: 'Dos códigos locales nulos no se reportan como duplicados.',
} as const
