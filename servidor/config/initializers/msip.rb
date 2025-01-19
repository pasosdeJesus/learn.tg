require 'msip/version'

Msip.setup do |config|
  config.ruta_anexos = ENV.fetch('MSIP_RUTA_ANEXOS', 
                                 "#{Rails.root}/archivos/anexos")
  config.ruta_volcados = ENV.fetch('MSIP_RUTA_VOLCADOS',
                                   "#{Rails.root}/archivos/bd")
  # En heroku los anexos son super-temporales
  if ENV["HEROKU_POSTGRESQL_MAUVE_URL"]
    config.ruta_anexos = "#{Rails.root}/tmp/"
  end
  config.titulo = "Learntg Admin #{Cor1440Gen::VERSION}"

  config.descripcion = "Administración de learn.tg"
  config.codigofuente = "https://gitlab.com/vtamara/learn.tg"
  config.urlcontribuyentes = "https://gitlab.com/vtamara/learn.tg/-/graphs/main?ref_type=heads"
  config.urlcreditos = "https://gitlab.com/pasosdeJesus/cor1440_gen/-/blob/main/CREDITOS.md"
  config.agradecimientoDios = "<p>
Agradecemos a Dios que nos enseña
</p>
<blockquote>
<p>
Te enseñaré y te mostraré el camino;<br/>
te estaré observando y seré tu guía.
</p>
<p>Salmo 32:8</p>
</blockquote>".html_safe

end
