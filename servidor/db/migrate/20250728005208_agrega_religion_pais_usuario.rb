# frozen_string_literal: true

class AgregaReligionPaisUsuario < ActiveRecord::Migration[8.0]
  def change
    add_column(:usuario, :religion_id, :integer, default: 1)
    add_column(:usuario, :pais_id, :integer)

    add_foreign_key(:usuario, :religion)
    add_foreign_key(:usuario, :msip_pais, column: "pais_id")
  end
end
