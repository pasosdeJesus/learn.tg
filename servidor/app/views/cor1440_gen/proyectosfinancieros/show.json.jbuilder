# frozen_string_literal: true

json.curso do
  json.id @proyectofinanciero.id
  json.titulo @proyectofinanciero.titulo.to_s
  json.subtitulo @proyectofinanciero.subtitulo.to_s
  json.idioma @proyectofinanciero.idioma.to_s
  json.prefijoRuta @proyectofinanciero.prefijoRuta.to_s
  json.imagen @proyectofinanciero.imagen.to_s
  json.creditoImagen @proyectofinanciero.creditoImagen.to_s
  json.altImagen @proyectofinanciero.altImagen.to_s
  json.resumenMd @proyectofinanciero.resumenMd.to_s
  json.sinBilletera @proyectofinanciero.sinBilletera.to_s
  json.conBilletera @proyectofinanciero.conBilletera.to_s
  json.creditosMd apf.creditosMd.to_s
  json.guias do
    @proyectofinanciero.actividadpf.select {|a| a.posfijoRuta }.each do |apf|
      json.titulo apf.titulo.to_s
      json.posfijoRuta apf.posfijoRuta.to_s
      json.imagen apf.imagen.to_s
    end
  end
end
