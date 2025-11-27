# frozen_string_literal: true

require "msip/version"

Msip.setup do |config|
  config.ruta_anexos = ENV.fetch(
    "MSIP_RUTA_ANEXOS",
    "#{Rails.root.join("archivos/anexos")}",
  )
  config.ruta_volcados = ENV.fetch(
    "MSIP_RUTA_VOLCADOS",
    "#{Rails.root.join("archivos/bd")}",
  )
  config.titulo = "Learntg Admin #{Cor1440Gen::VERSION}"

  config.descripcion = "Administración de learn.tg"
  config.codigofuente = "https://github.com/pasosdeJesus/learn.tg"
  config.urlcontribuyentes = "https://github.com/pasosdeJesus/learn.tg/graphs/contributors"
  config.urlcreditos = "https://github.com/pasosdeJesus/learn.tg/blob/main/CREDITOS.md"
  config.urllicencia = "https://github.com/pasosdeJesus/learn.tg/blob/main/LICENCIA.md"
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
