# frozen_string_literal: true

class CreateNonces < ActiveRecord::Migration[7.2]
  def change
    create_table(:nonce) do |t|
      t.string(:nonce, limit: 32)

      t.timestamps
    end

    add_index(:nonce, :nonce, unique: true)
  end
end
