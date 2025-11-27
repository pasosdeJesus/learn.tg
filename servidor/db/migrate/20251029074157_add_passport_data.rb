# frozen_string_literal: true

class AddPassportData < ActiveRecord::Migration[8.0]
  def change
    add_column(:usuario, :passport_name, :string, limit: 127)
    add_column(:usuario, :passport_nationality, :integer)
  end
end
