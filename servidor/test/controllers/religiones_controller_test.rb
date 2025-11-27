# frozen_string_literal: true

require "test_helper"

# Esta prueba supone que en la tabla básica hay un registro con id 1
# Si no lo hay agregar skip a pruebas que lo suponen o crear registro
# con id 1 en las mismas o en setup

module Admin
  class ReligionesControllerTest < ActionDispatch::IntegrationTest
    RELIGION_NUEVA = {
      nombre: "X",
      observaciones: "y",
      fechacreacion: "2025-07-27",
      fechadeshabilitacion: nil,
      created_at: "2025-07-27",
      updated_at: "2025-07-27",
    }

    IDEX = 1

    include Rails.application.routes.url_helpers
    include Devise::Test::IntegrationHelpers

    setup do
      if ENV["CONFIG_HOSTS"] != "www.example.com"
        raise "CONFIG_HOSTS debe ser www.example.com"
      end

      Rails.application.try(:reload_routes_unless_loaded)
      @current_usuario = ::Usuario.find(1)
      sign_in @current_usuario
    end

    # Cada prueba se ejecuta en una transacción de la base de datos
    # que después de la prueba se revierte. Por lo que no
    # debe preocuparse por restaurar/borrar lo que modifique/elimine/agregue
    # en cada prueba.

    test "debe presentar listado" do
      get admin_religiones_path

      assert_response :success
      assert_template :index
    end

    test "debe presentar resumen de existente" do
      get admin_religion_url(Religion.find(IDEX))

      assert_response :success
      assert_template :show
    end

    test "debe presentar formulario para nueva" do
      get new_admin_religion_path

      assert_response :success
      assert_template :new
    end

    test "debe crear nueva" do
      assert_difference("Religion.count") do
        post admin_religiones_path, params: {
          religion: RELIGION_NUEVA,
        }
      end

      ruta = admin_religion_path(assigns(:religion))

      assert_redirected_to ruta
    end

    test "debe actualizar existente" do
      patch admin_religion_path(Religion.find(IDEX)),
        params: { religion: { nombre: "YY" } }

      assert_redirected_to admin_religion_path(
        assigns(:religion),
      )
    end

    test "debe eliminar" do
      r = Religion.create!(RELIGION_NUEVA)
      assert_difference("Religion.count", -1) do
        delete admin_religion_url(Religion.find(r.id))
      end

      assert_redirected_to admin_religiones_path
    end
  end
end
