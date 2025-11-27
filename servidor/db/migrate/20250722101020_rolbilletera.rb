# frozen_string_literal: true

class Rolbilletera < ActiveRecord::Migration[8.0]
  def change
    change_column_default(:usuario, :rol, 7)
  end
end
