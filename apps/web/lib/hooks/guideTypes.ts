// Shared types for guide-related hooks
// "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)

export interface Guide {
  titulo: string
  sufijoRuta: string
  completed?: boolean
  receivedScholarship?: boolean
  receivedSlearnScholarship?: boolean
}

export interface Course {
  id: string
  titulo: string
  subtitulo?: string
  idioma: string
  prefijoRuta: string
  guias: Guide[]
  conBilletera: boolean
  sinBilletera: boolean
  creditosMd: string
  resumenMd?: string
  ampliaMd?: string
  /**
   * Precio de compra del curso. El catalogo devuelve `null` en los cursos gratuitos
   * (las paginas comparan con `Number(course.porPagar) <= 0`, y `Number(null)` es 0);
   * un curso descargado tiene que conservar esa forma (R-#256 §3.10): con `undefined`,
   * `Number(undefined)` es `NaN` y sin conexión la pagina del curso se veia sin
   * derecho a leerlo y escondia la copia descargada.
   */
  porPagar?: string | number | null
  /** Contenido sensible (https://github.com/pasosdeJesus/learn.tg/issues/259): decide la visibilidad pública y la descarga sin conexión. */
  contenido_sensible?: boolean
  imagen?: string
  altImagen?: string
  enlaceImagen?: string
  creditoImagen?: string
}
