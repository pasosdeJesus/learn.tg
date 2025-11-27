# frozen_string_literal: true

class CreateBilleteraUsuario < ActiveRecord::Migration[7.2]
  def change
    create_table(:billetera_usuario) do |t|
      t.string(:billetera, limit: 60, null: false)
      t.integer(:usuario_id, null: false)
      t.string(:token, limit: 256)

      t.timestamps
    end

    add_foreign_key(:billetera_usuario, :usuario)
    add_index(:billetera_usuario, :billetera, unique: true)
    add_index(:billetera_usuario, :usuario_id)
    add_index(:billetera_usuario, [:usuario_id, :billetera], unique: true)
  end
end
