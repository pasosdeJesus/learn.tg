# frozen_string_literal: true

class AnswerFib < ActiveRecord::Migration[8.0]
  def change
    add_column(:billetera_usuario, :answer_fib, :string)
  end
end
