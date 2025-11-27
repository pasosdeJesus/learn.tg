# frozen_string_literal: true

class CreateReligion < ActiveRecord::Migration[8.0]
  include Msip::SqlHelper

  def up
    create_table(:religion) do |t|
      t.string(:nombre, limit: 500, null: false)
      t.string(:observaciones, limit: 5000)
      t.date(:fechacreacion, null: false)
      t.date(:fechadeshabilitacion)

      t.timestamps
    end
    cambiaCotejacion("religion", "nombre", 500, "es_co_utf_8")
    execute(<<-SQL)
      INSERT INTO religion (id, nombre,
        fechacreacion, created_at, updated_at) VALUES (
        1, 'Without Information',
        '2025-07-28', '2025-07-28', '2025-07-28');
      INSERT INTO religion (id, nombre,
        fechacreacion, created_at, updated_at) VALUES (
        2,'Christianity',
        '2025-07-28', '2025-07-28', '2025-07-28');
      INSERT INTO religion (id, nombre,
        fechacreacion, created_at, updated_at) VALUES (
        3,'Islam',
        '2025-07-28', '2025-07-28', '2025-07-28');
      INSERT INTO religion (id, nombre,
        fechacreacion, created_at, updated_at) VALUES (
        4,'Budhism',
        '2025-07-28', '2025-07-28', '2025-07-28');
      INSERT INTO religion (id, nombre,
        fechacreacion, created_at, updated_at) VALUES (
        5,'Hinduism',
        '2025-07-28', '2025-07-28', '2025-07-28');
      INSERT INTO religion (id, nombre,
        fechacreacion, created_at, updated_at) VALUES (
        6,'Judaism',
        '2025-07-28', '2025-07-28', '2025-07-28');
      INSERT INTO religion (id, nombre,
        fechacreacion, created_at, updated_at) VALUES (
        7,'Other',
        '2025-07-28', '2025-07-28', '2025-07-28');
      INSERT INTO religion (id, nombre,
        fechacreacion, created_at, updated_at) VALUES (
        8,'None',
        '2025-07-28', '2025-07-28', '2025-07-28');
      SELECT setval('religion_id_seq', 100);
    SQL
  end

  def down
    drop_table(:religion)
  end
end
