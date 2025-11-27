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
        with: %r{\A/[a-zA-Z].*\z},
        message: "debe comenzar con /",
      }
    validates :subtitulo,
      presence: true

    scope :filtro_idioma, lambda { |i|
      where(idioma: i)
    }

    scope :filtro_prefijoRuta, lambda { |p|
      where(prefijoRuta: p)
    }

    scope :filtro_conBilletera, lambda { |c|
      where(conBilletera: c)
    }
  end
end
