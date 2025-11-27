# frozen_string_literal: true

class SinDefaultReligion < ActiveRecord::Migration[8.0]
  def change
    change_column_default(:usuario, :religion_id, from: 1, to: nil)
  end
end
