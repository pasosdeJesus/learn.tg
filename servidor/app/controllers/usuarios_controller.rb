# frozen_string_literal: true

require "cor1440_gen/concerns/controllers/usuarios_controller"

class UsuariosController < Msip::ModelosController
  include Cor1440Gen::Concerns::Controllers::UsuariosController

  # Sin definicion de autoridad por ser requerido por no autenticados

  def atributos_index
    [
      :id,
      :nusuario,
      :nombre,
      :email,
      :grupo_ids,
      :pais,
      :religion,
      :foto,
      :habilitado,
    ]
  end

  def atributos_form
    r = []
    if can?(:create, ::Usuario)
      r += [
        :nusuario,
        :nombre,
        :descripcion,
      ]
    end
    if can?(:manage, ::Usuario)
      r += [:rol]
    end
    if can?(:create, ::Usuario)
      r += [
        :email,
        :tema,
        :msip_grupo,
        :pais,
        :religion,
        :foto,
        :fechacreacion_localizada,
        :fechadeshabilitacion_localizada,
      ]
    end
    if can?(:manage, ::Usuario)
      r += [
        :idioma,
        :encrypted_password,
        :failed_attempts,
        :unlock_token,
        :locked_at,
      ]
    end
    r
  end

  def atributos_show
    r = []
    if can?(:read, ::Usuario)
      r += [
        :nusuario,
        :id,
        :nombre,
        :grupo,
        :email,
        :pais,
        :religion,
        :foto,
      ]
    end
    if can?(:manage, ::Usuario)
      r += [
        :rol,
        :idioma,
        :encrypted_password,
        :fechacreacion_localizada,
        :fechadeshabilitacion_localizada,
        :failed_attempts,
        :unlock_token,
        :locked_at,
      ]
    end
    r
  end

  def atributos_show_json
    atributos_show
  end

  def index_reordenar(c)
    if !params || !params[:filtro] || !params[:filtro][:bushabilitado]
      c = c.where("usuario.fechadeshabilitacion IS NULL")
    end
    c = c.reorder([:nombre])
    c
  end

  def index
    puts "OJO paso por index"
    super
  end

  def index_otros_formatos(format, params)
    puts "OJO paso por index_otros_formatos"
    render(:index, json: @registros)
  end

  def foto
    # Validar que el ID es un entero
    begin
      usuario_id = Integer(params[:id])
    rescue ArgumentError, TypeError
      # Si el ID no es un entero, enviar la imagen predeterminada
      send_file(
        Rails.root.join("app/assets/images/predeterminada.png"),
        type: "image/png",
        disposition: "inline",
      )
      return
    end

    @usuario = Usuario.find_by(id: usuario_id)

    # Verificar que el usuario y la foto existen
    if @usuario && @usuario.foto.present? && @usuario.foto.path
      ruta_foto = @usuario.foto.path
      # Verificar que el archivo existe y está dentro del directorio de anexos
      if File.exist?(ruta_foto) && ruta_foto.start_with?(Msip.ruta_anexos.to_s)
        send_file(ruta_foto, type: @usuario.foto_content_type, disposition: "inline")
      else
        # Si el archivo no existe o está fuera del directorio, enviar predeterminada
        send_file(
          Rails.root.join("app/assets/images/predeterminada.png"),
          type: "image/png",
          disposition: "inline",
        )
      end
    else
      # Si el usuario no existe o no tiene foto, enviar predeterminada
      send_file(
        Rails.root.join("app/assets/images/predeterminada.png"),
        type: "image/png",
        disposition: "inline",
      )
    end
  end

  def lista_params
    p = lista_params_cor1440_gen + [:foto, :religion_id, :pais_id]
    p
  end
end
