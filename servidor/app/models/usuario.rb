# frozen_string_literal: true

require "cor1440_gen/concerns/models/usuario"

class Usuario < ActiveRecord::Base
  include Cor1440Gen::Concerns::Models::Usuario

  belongs_to :religion,
    optional: true,
    validate: true
  belongs_to :pais,
    class_name: "Msip::Pais",
    optional: true,
    validate: true

  has_many :billetera_usuario

  has_attached_file :foto,
    path: (Msip.ruta_anexos.to_s + "/fotos/:id_:filename")

  validates_attachment :foto, content_type: {
    content_type: ["image/jpg", "image/jpeg", "image/png", "image/gif"],
  }

  validates :foto_file_name, length: { maximum: 255 }

  def rol_usuario
    # No tiene restricciones de oficina
  end

  scope :filtrar_alterno, lambda { |otros_params|
    uid = []
    if otros_params["walletAddress"]
      uid = BilleteraUsuario.where(billetera: otros_params["walletAddress"])
        .pluck(:usuario_id)
    end
    where(id: uid)
  }
end
