# frozen_string_literal: true

require "msip/concerns/models/pais"

module Msip
  # Primer nivel en división político administrativa: país. Ver:
  # https://gitlab.com/pasosdeJesus/division-politica
  class Pais < ActiveRecord::Base
    include Msip::Concerns::Models::Pais

    has_many :usuario,
      validate: true
  end
end
