# frozen_string_literal: true

class AgregaCamposCursoPf < ActiveRecord::Migration[7.1]
  def change
    add_column(
      :cor1440_gen_proyectofinanciero,
      :subtitulo,
      :string,
      limit: 1024,
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :idioma,
      :string,
      limit: 6,
      null: false,
      default: "es",
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :prefijoRuta,
      :string,
      limit: 255,
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :imagen,
      :string,
      limit: 255,
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :creditoImagen,
      :string,
      limit: 1024,
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :enlaceImagen,
      :string,
      limit: 1024,
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :altImagen,
      :string,
      limit: 255,
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :resumenMd,
      :string,
      limit: 5000,
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :sinBilletera,
      :bool,
    )
    add_column(
      :cor1440_gen_proyectofinanciero,
      :conBilletera,
      :bool,
    )

    add_column(
      :cor1440_gen_actividadpf,
      :posfijoRuta,
      :string,
      limit: 255,
    )
    # Corresponde a archivo md en carpeta del curso sin extesión md
  end
end
