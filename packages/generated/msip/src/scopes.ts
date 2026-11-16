/**
 * Consultas tipadas del motor `msip`: los scopes `habilitados` y `filtro_*` de
 * `msip-2.2`, más las consultas de unicidad y pertenencia que las reglas puras
 * reciben como banderas.
 *
 * `m` no crea conexiones (decisión D3): todo recibe un `SqlExecutor` o
 * devuelve `{ sql, params }` para que el host lo ejecute con Kysely, `pg` o su
 * adaptador. Los nombres de tabla/columna se validan contra una lista blanca
 * antes de interpolarlos.
 *
 * `unaccent` es el mismo requisito que tenía el motor Rails (`filtro_nombre`,
 * `filtro_observaciones`, `filtro_tipomun`).
 *
 * https://gitlab.com/pasosdeJesus/m/-/work_items/69
 */

import type { SqlExecutor } from './types.js'
import type {
  ContextoUbicacionpre,
  OpcionesCentropoblado,
  OpcionesDepartamento,
  OpcionesMunicipio,
  OpcionesPais,
  OpcionesTrelacion,
  OpcionesVereda,
} from './rules.js'

export interface Consulta {
  sql: string
  params: unknown[]
}

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/

function identificador(nombre: string): string {
  if (!IDENTIFICADOR.test(nombre)) throw new Error(`Identificador SQL inválido: ${nombre}`)
  return nombre
}

/** Tablas que incluyen `Msip::Basica` (nombre, observaciones y vigencia). */
export const TABLAS_BASICAS = [
  'msip_centropoblado',
  'msip_departamento',
  'msip_estadosol',
  'msip_etiqueta',
  'msip_etnia',
  'msip_fuenteprensa',
  'msip_grupo',
  'msip_municipio',
  'msip_oficina',
  'msip_pais',
  'msip_perfilorgsocial',
  'msip_sectororgsocial',
  'msip_tcentropoblado',
  'msip_tdocumento',
  'msip_tema',
  'msip_tipoorg',
  'msip_trelacion',
  'msip_trivalente',
  'msip_tsitio',
  'msip_vereda',
] as const

export type TablaBasica = (typeof TABLAS_BASICAS)[number]

export function esTablaBasica(tabla: string): tabla is TablaBasica {
  return (TABLAS_BASICAS as readonly string[]).includes(tabla)
}

function tablaBasica(tabla: string): TablaBasica {
  if (!esTablaBasica(tabla)) throw new Error(`La tabla "${tabla}" no es una tabla básica de msip`)
  return tabla
}

export interface FiltroBasica {
  /** `'SI'` (habilitados), `'NO'` (deshabilitados); otro valor no filtra. */
  habilitado?: string
  nombre?: string
  observaciones?: string
  fechacreacionIni?: string
  fechacreacionFin?: string
  campoOrd?: string
}

function condicionHabilitado(tabla: string, valor: string | undefined): string | null {
  if (valor === undefined) return null
  const opcion = valor.toUpperCase().trim()
  if (opcion === 'SI') return `${tabla}.fechadeshabilitacion IS NULL`
  if (opcion === 'NO') return `${tabla}.fechadeshabilitacion IS NOT NULL`
  return null
}

function likeSinAcento(expresion: string, parametro: number, contiene = true): string {
  const patron = contiene ? `'%' || unaccent(lower($${parametro})) || '%'` : `unaccent(lower($${parametro}))`
  return `unaccent(lower(${expresion})) LIKE ${patron}`
}

/** `Msip::Basica.habilitados`: registros con `fechadeshabilitacion` nulo. */
export function habilitados(tabla: TablaBasica, campoOrd = 'nombre'): Consulta {
  const t = identificador(tablaBasica(tabla))
  return {
    sql: `SELECT * FROM ${t} WHERE ${t}.fechadeshabilitacion IS NULL ORDER BY ${identificador(campoOrd)}`,
    params: [],
  }
}

/** `Msip::Basica` + `filtro_habilitado`/`filtro_nombre`/`filtro_observaciones`/fechas. */
export function consultaBasica(tabla: TablaBasica, filtro: FiltroBasica = {}): Consulta {
  const t = identificador(tablaBasica(tabla))
  const condiciones: string[] = []
  const params: unknown[] = []

  const habilitado = condicionHabilitado(t, filtro.habilitado)
  if (habilitado) condiciones.push(habilitado)
  if (filtro.nombre !== undefined && filtro.nombre !== '') {
    params.push(filtro.nombre)
    condiciones.push(likeSinAcento(`${t}.nombre`, params.length))
  }
  if (filtro.observaciones !== undefined && filtro.observaciones !== '') {
    params.push(filtro.observaciones)
    condiciones.push(likeSinAcento(`${t}.observaciones`, params.length))
  }
  if (filtro.fechacreacionIni) {
    params.push(filtro.fechacreacionIni)
    condiciones.push(`${t}.fechacreacion >= $${params.length}`)
  }
  if (filtro.fechacreacionFin) {
    params.push(filtro.fechacreacionFin)
    condiciones.push(`${t}.fechacreacion <= $${params.length}`)
  }

  const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : ''
  const orden = identificador(filtro.campoOrd ?? 'nombre')
  return { sql: `SELECT * FROM ${t}${where} ORDER BY ${orden}`, params }
}

export async function listarBasicos(
  db: SqlExecutor,
  tabla: TablaBasica,
  filtro: FiltroBasica = {},
): Promise<Array<Record<string, unknown>>> {
  const consulta = consultaBasica(tabla, filtro)
  const resultado = await db.query<Record<string, unknown>>(consulta.sql, consulta.params)
  return resultado.rows
}

function inPlaceholders(params: unknown[], valores: readonly number[], columna: string): string {
  const marcas = valores.map((valor) => {
    params.push(valor)
    return `$${params.length}`
  })
  return `${columna} IN (${marcas.join(', ')})`
}

export function consultaDepartamentos(
  filtro: { paisId?: number; habilitado?: string; nombre?: string } = {},
): Consulta {
  const condiciones: string[] = []
  const params: unknown[] = []
  const habilitado = condicionHabilitado('msip_departamento', filtro.habilitado)
  if (habilitado) condiciones.push(habilitado)
  if (filtro.paisId !== undefined) {
    params.push(filtro.paisId)
    condiciones.push(`msip_departamento.pais_id = $${params.length}`)
  }
  if (filtro.nombre) {
    params.push(filtro.nombre)
    condiciones.push(likeSinAcento('msip_departamento.nombre', params.length))
  }
  return {
    sql: `SELECT msip_departamento.* FROM msip_departamento${where(condiciones)} ORDER BY msip_departamento.nombre`,
    params,
  }
}

export function consultaMunicipios(
  filtro: {
    paisId?: number
    departamentoId?: number
    etiquetaIds?: readonly number[]
    tipomun?: string
    habilitado?: string
    nombre?: string
  } = {},
): Consulta {
  const condiciones: string[] = []
  const params: unknown[] = []
  const habilitado = condicionHabilitado('msip_municipio', filtro.habilitado)
  if (habilitado) condiciones.push(habilitado)
  if (filtro.departamentoId !== undefined) {
    params.push(filtro.departamentoId)
    condiciones.push(`msip_municipio.departamento_id = $${params.length}`)
  }
  if (filtro.paisId !== undefined) {
    params.push(filtro.paisId)
    condiciones.push(`msip_departamento.pais_id = $${params.length}`)
  }
  if (filtro.etiquetaIds && filtro.etiquetaIds.length > 0) {
    condiciones.push(
      `EXISTS (SELECT 1 FROM msip_etiqueta_municipio em WHERE em.municipio_id = msip_municipio.id AND ${inPlaceholders(params, filtro.etiquetaIds, 'em.etiqueta_id')})`,
    )
  }
  if (filtro.tipomun) {
    params.push(filtro.tipomun)
    condiciones.push(likeSinAcento('msip_municipio.tipomun', params.length))
  }
  if (filtro.nombre) {
    params.push(filtro.nombre)
    condiciones.push(likeSinAcento('msip_municipio.nombre', params.length))
  }
  return {
    sql: [
      'SELECT msip_municipio.* FROM msip_municipio',
      'JOIN msip_departamento ON msip_departamento.id = msip_municipio.departamento_id',
      where(condiciones),
      'ORDER BY msip_municipio.nombre',
    ].join(''),
    params,
  }
}

export function consultaCentrosPoblados(
  filtro: { paisId?: number; departamentoId?: number; municipioId?: number; habilitado?: string; nombre?: string } = {},
): Consulta {
  const condiciones: string[] = []
  const params: unknown[] = []
  const habilitado = condicionHabilitado('msip_centropoblado', filtro.habilitado)
  if (habilitado) condiciones.push(habilitado)
  if (filtro.municipioId !== undefined) {
    params.push(filtro.municipioId)
    condiciones.push(`msip_centropoblado.municipio_id = $${params.length}`)
  }
  if (filtro.departamentoId !== undefined) {
    params.push(filtro.departamentoId)
    condiciones.push(`msip_municipio.departamento_id = $${params.length}`)
  }
  if (filtro.paisId !== undefined) {
    params.push(filtro.paisId)
    condiciones.push(`msip_departamento.pais_id = $${params.length}`)
  }
  if (filtro.nombre) {
    params.push(filtro.nombre)
    condiciones.push(likeSinAcento('msip_centropoblado.nombre', params.length))
  }
  return {
    sql: [
      'SELECT msip_centropoblado.* FROM msip_centropoblado',
      'JOIN msip_municipio ON msip_municipio.id = msip_centropoblado.municipio_id',
      'JOIN msip_departamento ON msip_departamento.id = msip_municipio.departamento_id',
      where(condiciones),
      'ORDER BY msip_centropoblado.nombre',
    ].join(''),
    params,
  }
}

export function consultaVeredas(
  filtro: {
    pais?: string
    departamento?: string
    municipio?: string
    municipioId?: number
    habilitado?: string
    nombre?: string
  } = {},
): Consulta {
  const condiciones: string[] = []
  const params: unknown[] = []
  const habilitado = condicionHabilitado('msip_vereda', filtro.habilitado)
  if (habilitado) condiciones.push(habilitado)
  if (filtro.municipioId !== undefined) {
    params.push(filtro.municipioId)
    condiciones.push(`msip_vereda.municipio_id = $${params.length}`)
  }
  if (filtro.pais) {
    params.push(filtro.pais)
    condiciones.push(likeSinAcento('msip_pais.nombre', params.length))
  }
  if (filtro.departamento) {
    params.push(filtro.departamento)
    condiciones.push(likeSinAcento('msip_departamento.nombre', params.length))
  }
  if (filtro.municipio) {
    params.push(filtro.municipio)
    condiciones.push(likeSinAcento('msip_municipio.nombre', params.length))
  }
  if (filtro.nombre) {
    params.push(filtro.nombre)
    condiciones.push(likeSinAcento('msip_vereda.nombre', params.length))
  }
  return {
    sql: [
      'SELECT msip_vereda.* FROM msip_vereda',
      'JOIN msip_municipio ON msip_municipio.id = msip_vereda.municipio_id',
      'JOIN msip_departamento ON msip_departamento.id = msip_municipio.departamento_id',
      'JOIN msip_pais ON msip_pais.id = msip_departamento.pais_id',
      where(condiciones),
      'ORDER BY msip_vereda.nombre',
    ].join(''),
    params,
  }
}

function where(condiciones: readonly string[]): string {
  return condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : ''
}

export interface FiltroPersonas {
  anionac?: number
  apellidos?: string
  centropobladoId?: number
  departamentoId?: number
  dianac?: number
  etiquetaId?: number
  etniaId?: number
  mesnac?: number
  municipioId?: number
  nacionaldeId?: number
  nombres?: string
  numerodocumento?: string
  paisId?: number
  sexo?: string
  tdocumentoId?: number
}

/** Texto entre comillas = búsqueda exacta; sin comillas = contiene (como Rails). */
function filtroTexto(expresion: string, valor: string, params: unknown[], condiciones: string[]): void {
  const exacto = /^\s*"(.*)"\s*$/.exec(valor)
  params.push(exacto ? exacto[1] : valor)
  condiciones.push(exacto ? likeSinAcento(expresion, params.length, false) : likeSinAcento(expresion, params.length))
}

/** Scopes `filtro_*` de `Msip::Persona`, en una consulta tipada. */
export function consultaPersonas(filtro: FiltroPersonas = {}): Consulta {
  const condiciones: string[] = []
  const params: unknown[] = []

  if (filtro.anionac !== undefined) {
    params.push(filtro.anionac)
    condiciones.push(`msip_persona.anionac = $${params.length}`)
  }
  if (filtro.dianac !== undefined) {
    params.push(filtro.dianac)
    condiciones.push(`msip_persona.dianac = $${params.length}`)
  }
  if (filtro.mesnac !== undefined && filtro.mesnac !== 0) {
    params.push(filtro.mesnac)
    condiciones.push(`msip_persona.mesnac = $${params.length}`)
  }
  if (filtro.centropobladoId !== undefined) {
    params.push(filtro.centropobladoId)
    condiciones.push(`msip_persona.centropoblado_id = $${params.length}`)
  }
  if (filtro.departamentoId !== undefined) {
    params.push(filtro.departamentoId)
    condiciones.push(`msip_persona.departamento_id = $${params.length}`)
  }
  if (filtro.municipioId !== undefined) {
    params.push(filtro.municipioId)
    condiciones.push(`msip_persona.municipio_id = $${params.length}`)
  }
  if (filtro.paisId !== undefined) {
    params.push(filtro.paisId)
    condiciones.push(`msip_persona.pais_id = $${params.length}`)
  }
  if (filtro.nacionaldeId !== undefined) {
    params.push(filtro.nacionaldeId)
    condiciones.push(`msip_persona.nacionalde = $${params.length}`)
  }
  if (filtro.etniaId !== undefined) {
    params.push(filtro.etniaId)
    condiciones.push(`msip_persona.etnia_id = $${params.length}`)
  }
  if (filtro.tdocumentoId !== undefined) {
    params.push(filtro.tdocumentoId)
    condiciones.push(`msip_persona.tdocumento_id = $${params.length}`)
  }
  if (filtro.sexo !== undefined) {
    params.push(filtro.sexo)
    condiciones.push(`msip_persona.sexo = $${params.length}`)
  }
  if (filtro.etiquetaId !== undefined) {
    params.push(filtro.etiquetaId)
    condiciones.push(
      `EXISTS (SELECT 1 FROM msip_etiqueta_persona ep WHERE ep.persona_id = msip_persona.id AND ep.etiqueta_id = $${params.length})`,
    )
  }
  if (filtro.apellidos) filtroTexto('msip_persona.apellidos', filtro.apellidos, params, condiciones)
  if (filtro.nombres) filtroTexto('msip_persona.nombres', filtro.nombres, params, condiciones)
  if (filtro.numerodocumento) {
    params.push(filtro.numerodocumento)
    condiciones.push(likeSinAcento('msip_persona.numerodocumento', params.length))
  }

  return {
    sql: `SELECT msip_persona.* FROM msip_persona${where(condiciones)} ORDER BY msip_persona.apellidos, msip_persona.nombres`,
    params,
  }
}

export interface FiltroOrgsocial {
  grupoper?: string
  habilitado?: string
  createdAtIni?: string
  createdAtFin?: string
  sectororgsocialId?: number
}

/** Scopes `filtro_*` de `Msip::Orgsocial`. */
export function consultaOrgsociales(filtro: FiltroOrgsocial = {}): Consulta {
  const condiciones: string[] = []
  const params: unknown[] = []
  const habilitado = condicionHabilitado('msip_orgsocial', filtro.habilitado)
  if (habilitado) condiciones.push(habilitado)
  if (filtro.grupoper) {
    params.push(filtro.grupoper)
    condiciones.push(likeSinAcento('msip_grupoper.nombre', params.length))
  }
  if (filtro.createdAtIni) {
    params.push(filtro.createdAtIni)
    condiciones.push(`date(msip_orgsocial.created_at) >= $${params.length}`)
  }
  if (filtro.createdAtFin) {
    params.push(filtro.createdAtFin)
    condiciones.push(`date(msip_orgsocial.created_at) <= $${params.length}`)
  }
  if (filtro.sectororgsocialId !== undefined) {
    params.push(filtro.sectororgsocialId)
    condiciones.push(
      `EXISTS (SELECT 1 FROM msip_orgsocial_sectororgsocial os WHERE os.orgsocial_id = msip_orgsocial.id AND os.sectororgsocial_id = $${params.length})`,
    )
  }
  return {
    sql: [
      'SELECT msip_orgsocial.* FROM msip_orgsocial',
      'JOIN msip_grupoper ON msip_grupoper.id = msip_orgsocial.grupoper_id',
      where(condiciones),
      'ORDER BY msip_grupoper.nombre',
    ].join(''),
    params,
  }
}

/** Tablas con `nombre` sobre las que se puede consultar unicidad. */
export const TABLAS_CON_NOMBRE = [
  ...TABLAS_BASICAS,
  'msip_grupoper',
  'msip_ubicacionpre',
] as const

export type TablaConNombre = (typeof TABLAS_CON_NOMBRE)[number]

function tablaConNombre(tabla: string): TablaConNombre {
  if (!(TABLAS_CON_NOMBRE as readonly string[]).includes(tabla)) {
    throw new Error(`La tabla "${tabla}" no tiene nombre consultable en msip`)
  }
  return tabla as TablaConNombre
}

export interface OpcionesExistencia {
  scopeColumna?: string
  scopeValor?: unknown
  excluirId?: number | string
}

async function existe(
  db: SqlExecutor,
  tabla: string,
  columna: string,
  valor: unknown,
  opciones: OpcionesExistencia = {},
): Promise<boolean> {
  const params: unknown[] = [valor]
  const condiciones = [`lower(${identificador(columna)}::text) = lower($1::text)`]
  if (opciones.scopeColumna !== undefined) {
    params.push(opciones.scopeValor)
    condiciones.push(`${identificador(opciones.scopeColumna)} IS NOT DISTINCT FROM $${params.length}`)
  }
  if (opciones.excluirId !== undefined) {
    params.push(opciones.excluirId)
    condiciones.push(`id <> $${params.length}`)
  }
  const resultado = await db.query(
    `SELECT 1 FROM ${identificador(tabla)} WHERE ${condiciones.join(' AND ')} LIMIT 1`,
    params,
  )
  return resultado.rows.length > 0
}

export async function nombreExiste(
  db: SqlExecutor,
  tabla: TablaConNombre,
  nombre: string,
  opciones: OpcionesExistencia = {},
): Promise<boolean> {
  tablaConNombre(tabla)
  return existe(db, tabla, 'nombre', nombre, opciones)
}

export async function codigoExiste(
  db: SqlExecutor,
  tabla: TablaConNombre | TablaBasica,
  columna: string,
  valor: unknown,
  opciones: OpcionesExistencia = {},
): Promise<boolean> {
  identificador(columna)
  return existe(db, tabla, columna, valor, opciones)
}

async function filaExiste(
  db: SqlExecutor,
  tabla: string,
  columna: string,
  valor: unknown,
  columnaPadre?: string,
  valorPadre?: unknown,
): Promise<boolean> {
  const params: unknown[] = [valor]
  const condiciones = [`${identificador(columna)} = $1`]
  if (columnaPadre !== undefined) {
    params.push(valorPadre)
    condiciones.push(`${identificador(columnaPadre)} = $${params.length}`)
  }
  const resultado = await db.query(
    `SELECT 1 FROM ${identificador(tabla)} WHERE ${condiciones.join(' AND ')} LIMIT 1`,
    params,
  )
  return resultado.rows.length > 0
}

export function paisExiste(db: SqlExecutor, paisId: number): Promise<boolean> {
  return filaExiste(db, 'msip_pais', 'id', paisId)
}

export function departamentoPertenecePais(
  db: SqlExecutor,
  departamentoId: number,
  paisId: number,
): Promise<boolean> {
  return filaExiste(db, 'msip_departamento', 'id', departamentoId, 'pais_id', paisId)
}

export function municipioPerteneceDepartamento(
  db: SqlExecutor,
  municipioId: number,
  departamentoId: number,
): Promise<boolean> {
  return filaExiste(db, 'msip_municipio', 'id', municipioId, 'departamento_id', departamentoId)
}

export function centropobladoPerteneceMunicipio(
  db: SqlExecutor,
  centropobladoId: number,
  municipioId: number,
): Promise<boolean> {
  return filaExiste(db, 'msip_centropoblado', 'id', centropobladoId, 'municipio_id', municipioId)
}

export function veredaPerteneceMunicipio(
  db: SqlExecutor,
  veredaId: number,
  municipioId: number,
): Promise<boolean> {
  return filaExiste(db, 'msip_vereda', 'id', veredaId, 'municipio_id', municipioId)
}

export function tsitioValido(db: SqlExecutor, tsitioId: number): Promise<boolean> {
  return filaExiste(db, 'msip_tsitio', 'id', tsitioId)
}

/** `Msip::Trelacion#inverso_existe`: el mismo código cuenta como válido. */
export async function inversoExiste(db: SqlExecutor, id: string | null, inverso: string | null): Promise<boolean> {
  if (inverso === null || inverso === undefined || inverso === '') return false
  if (id !== null && id !== undefined && inverso === id) return true
  return filaExiste(db, 'msip_trelacion', 'id', inverso)
}

/** `Msip::Trelacion#validaciones_extra`: todas las relaciones inversas son simétricas. */
export async function inversosSimetricos(db: SqlExecutor): Promise<boolean> {
  const resultado = await db.query(
    [
      'SELECT 1 FROM msip_trelacion t',
      'JOIN msip_trelacion t2 ON t2.id = t.inverso',
      'WHERE t2.inverso <> t.id',
      'LIMIT 1',
    ].join(' '),
  )
  return resultado.rows.length === 0
}

/** `Msip::PersonaTrelacion#vmaximo_una`: ya hay otra relación entre la pareja. */
export async function parejaRelacionada(
  db: SqlExecutor,
  persona1: number,
  persona2: number,
  excluirId?: number,
): Promise<boolean> {
  const params: unknown[] = [persona1, persona2]
  let extra = ''
  if (excluirId !== undefined) {
    params.push(excluirId)
    extra = ` AND id <> $${params.length}`
  }
  const resultado = await db.query(
    `SELECT 1 FROM msip_persona_trelacion WHERE persona1 = $1 AND persona2 = $2${extra} LIMIT 1`,
    params,
  )
  return resultado.rows.length > 0
}

/** Arma el contexto que `validarUbicacionpre` necesita, consultando sólo lo necesario. */
export async function contextoUbicacionpre(
  db: SqlExecutor,
  campos: {
    nombre?: string | null
    pais_id?: number | null
    departamento_id?: number | null
    municipio_id?: number | null
    centropoblado_id?: number | null
    vereda_id?: number | null
    tsitio_id?: number | null
  },
  excluirId?: number,
): Promise<ContextoUbicacionpre> {
  const contexto: ContextoUbicacionpre = {}
  if (campos.nombre) {
    contexto.nombreUnico = await nombreExiste(db, 'msip_ubicacionpre', campos.nombre, { excluirId })
  }
  if (campos.pais_id && campos.departamento_id) {
    contexto.departamentoPertenecePais = await departamentoPertenecePais(db, campos.departamento_id, campos.pais_id)
  }
  if (campos.departamento_id && campos.municipio_id) {
    contexto.municipioPerteneceDepartamento = await municipioPerteneceDepartamento(
      db,
      campos.municipio_id,
      campos.departamento_id,
    )
  }
  if (campos.municipio_id && campos.centropoblado_id) {
    contexto.centropobladoPerteneceMunicipio = await centropobladoPerteneceMunicipio(
      db,
      campos.centropoblado_id,
      campos.municipio_id,
    )
  }
  if (campos.municipio_id && campos.vereda_id) {
    contexto.veredaPerteneceMunicipio = await veredaPerteneceMunicipio(db, campos.vereda_id, campos.municipio_id)
  }
  if (campos.tsitio_id) {
    contexto.tsitioValido = await tsitioValido(db, campos.tsitio_id)
  }
  return contexto
}

/** Banderas de unicidad de `Msip::Pais` para `validarPais`. */
export async function unicidadPais(
  db: SqlExecutor,
  campos: { nombre?: string | null; nombreiso_espanol?: string | null; alfa2?: string | null; alfa3?: string | null },
  excluirId?: number,
): Promise<OpcionesPais> {
  return {
    nombreUnico: campos.nombre ? await nombreExiste(db, 'msip_pais', campos.nombre, { excluirId }) : undefined,
    nombreisoUnico: campos.nombreiso_espanol
      ? await codigoExiste(db, 'msip_pais', 'nombreiso_espanol', campos.nombreiso_espanol, { excluirId })
      : undefined,
    alfa2Unico: campos.alfa2 ? await codigoExiste(db, 'msip_pais', 'alfa2', campos.alfa2, { excluirId }) : undefined,
    alfa3Unico: campos.alfa3 ? await codigoExiste(db, 'msip_pais', 'alfa3', campos.alfa3, { excluirId }) : undefined,
  }
}

/** Banderas de unicidad de `Msip::Departamento` para `validarDepartamento`. */
export async function unicidadDepartamento(
  db: SqlExecutor,
  campos: { nombre?: string | null; pais_id?: number | null; deplocal_cod?: number | null },
  excluirId?: number,
): Promise<OpcionesDepartamento> {
  if (!campos.pais_id) return {}
  return {
    nombreUnicoEnPais: campos.nombre
      ? await nombreExiste(db, 'msip_departamento', campos.nombre, {
          scopeColumna: 'pais_id',
          scopeValor: campos.pais_id,
          excluirId,
        })
      : undefined,
    codigoLocalUnicoEnPais:
      campos.deplocal_cod !== null && campos.deplocal_cod !== undefined
        ? await codigoExiste(db, 'msip_departamento', 'deplocal_cod', campos.deplocal_cod, {
            scopeColumna: 'pais_id',
            scopeValor: campos.pais_id,
            excluirId,
          })
        : undefined,
  }
}

/** Banderas de unicidad de `Msip::Municipio` para `validarMunicipio`. */
export async function unicidadMunicipio(
  db: SqlExecutor,
  campos: { nombre?: string | null; departamento_id?: number | null; munlocal_cod?: number | null },
  excluirId?: number,
): Promise<OpcionesMunicipio> {
  if (!campos.departamento_id) return {}
  return {
    nombreUnicoEnDepartamento: campos.nombre
      ? await nombreExiste(db, 'msip_municipio', campos.nombre, {
          scopeColumna: 'departamento_id',
          scopeValor: campos.departamento_id,
          excluirId,
        })
      : undefined,
    codigoLocalUnicoEnDepartamento:
      campos.munlocal_cod !== null && campos.munlocal_cod !== undefined
        ? await codigoExiste(db, 'msip_municipio', 'munlocal_cod', campos.munlocal_cod, {
            scopeColumna: 'departamento_id',
            scopeValor: campos.departamento_id,
            excluirId,
          })
        : undefined,
  }
}

/** Banderas de unicidad de `Msip::Centropoblado` para `validarCentropoblado`. */
export async function unicidadCentropoblado(
  db: SqlExecutor,
  campos: { nombre?: string | null; municipio_id?: number | null; cplocal_cod?: number | null },
  excluirId?: number,
): Promise<OpcionesCentropoblado> {
  if (!campos.municipio_id) return {}
  return {
    nombreUnicoEnMunicipio: campos.nombre
      ? await nombreExiste(db, 'msip_centropoblado', campos.nombre, {
          scopeColumna: 'municipio_id',
          scopeValor: campos.municipio_id,
          excluirId,
        })
      : undefined,
    codigoLocalUnicoEnMunicipio:
      campos.cplocal_cod !== null && campos.cplocal_cod !== undefined
        ? await codigoExiste(db, 'msip_centropoblado', 'cplocal_cod', campos.cplocal_cod, {
            scopeColumna: 'municipio_id',
            scopeValor: campos.municipio_id,
            excluirId,
          })
        : undefined,
  }
}

/** Banderas de unicidad de `Msip::Vereda` para `validarVereda`. */
export async function unicidadVereda(
  db: SqlExecutor,
  campos: { municipio_id?: number | null; verlocal_cod?: number | null },
  excluirId?: number,
): Promise<OpcionesVereda> {
  if (!campos.municipio_id || campos.verlocal_cod === null || campos.verlocal_cod === undefined) return {}
  return {
    codigoLocalUnicoEnMunicipio: await codigoExiste(db, 'msip_vereda', 'verlocal_cod', campos.verlocal_cod, {
      scopeColumna: 'municipio_id',
      scopeValor: campos.municipio_id,
      excluirId,
    }),
  }
}

/** Banderas de unicidad de `Msip::Trelacion` para `validarTrelacion`. */
export async function unicidadTrelacion(
  db: SqlExecutor,
  campos: { id?: string | null; inverso?: string | null },
  excluirId?: string,
): Promise<OpcionesTrelacion> {
  const idUnico =
    campos.id !== null && campos.id !== undefined
      ? await codigoExiste(db, 'msip_trelacion', 'id', campos.id, { excluirId })
      : undefined
  return {
    idUnico,
    inversoExiste: await inversoExiste(db, campos.id ?? null, campos.inverso ?? null),
    inversosSimetricos: await inversosSimetricos(db),
  }
}

/** Banderas de unicidad de `Msip::Tcentropoblado` para `validarTcentropoblado`. */
export async function unicidadTcentropoblado(
  db: SqlExecutor,
  campos: { id?: string | null },
  excluirId?: string,
): Promise<{ idUnico?: boolean }> {
  if (campos.id === null || campos.id === undefined) return {}
  return {
    idUnico: await codigoExiste(db, 'msip_tcentropoblado', 'id', campos.id, { excluirId }),
  }
}
