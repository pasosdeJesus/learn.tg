# frozen_string_literal: true

class CreditosPf < ActiveRecord::Migration[7.2]
  def up
    add_column(:cor1440_gen_proyectofinanciero, :creditosMd, :string, limit: 5000)
    add_column(:cor1440_gen_proyectofinanciero, :porPagar, :float)

    execute(<<~SQL)
      --      UPDATE cor1440_gen_proyectofinanciero SET "creditosMd"='Preparado por [Vladimir Támara Patiño](mailto:vtamara@pasosdeJesus.org) y [Julián Martinez](mailto:julianrz98@gmail.co). Este es contenido abierto con licencia. [CC-BY Internacional 4.0](https://creativecommons.org/licenses/by/4.0/)', porPagar=0 WHERE id=1;
    SQL
  end

  def down
    remove_column(:cor1440_gen_proyectofinanciero, :creditosMd, :string, limit: 5000)
    remove_column(:cor1440_gen_proyectofinanciero, :porPagar, :float)
  end
end
