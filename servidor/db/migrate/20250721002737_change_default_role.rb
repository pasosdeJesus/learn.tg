# frozen_string_literal: true

class ChangeDefaultRole < ActiveRecord::Migration[8.0]
  def change
    change_column_default(:usuario, :rol, 5)
  end
end
