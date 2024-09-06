# frozen_string_literal: true

require "cor1440_gen/concerns/models/proyectofinanciero"

module Cor1440Gen
  class Proyectofinanciero < ActiveRecord::Base
    include Cor1440Gen::Concerns::Models::Proyectofinanciero

    validates :idioma,
      presence: true
    validates :prefijoRuta,
      presence: true,
      format: { 
        with: /\A\/[a-zA-Z].*\z/,
        message: "debe comenzar con /"
      }
    validates :subtitulo,
      presence: true

  end
end
