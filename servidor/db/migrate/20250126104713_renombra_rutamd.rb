# frozen_string_literal: true

class RenombraRutamd < ActiveRecord::Migration[7.2]
  def change
    rename_column(:cor1440_gen_actividadpf, :posfijoRuta, :sufijoRuta)
    remove_column(:cor1440_gen_actividadpf, :rutamd, :string)
  end
end
