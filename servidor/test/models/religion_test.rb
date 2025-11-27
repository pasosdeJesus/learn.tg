# frozen_string_literal: true

require "test_helper"

class ReligionTest < ActiveSupport::TestCase
  PRUEBA_RELIGION = {
    nombre: "Religion",
    fechacreacion: "2025-07-27",
    created_at: "2025-07-27",
  }

  test "valido" do
    religion = ::Religion.create(
      PRUEBA_RELIGION,
    )

    assert(religion.valid?)
    religion.destroy
  end

  test "no valido" do
    religion = ::Religion.new(
      PRUEBA_RELIGION,
    )
    religion.nombre = ""

    assert_not(religion.valid?)
    religion.destroy
  end

  test "existente" do
    religion = ::Religion.find_by(id: 1)

    assert_equal("Without Information", religion.nombre)
  end
end
