// Shared types for guide-related hooks
// "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)

export interface Guide {
  titulo: string
  sufijoRuta: string
  completed?: boolean
  receivedScholarship?: boolean
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
  imagen?: string
  altImagen?: string
  enlaceImagen?: string
  creditoImagen?: string
}
