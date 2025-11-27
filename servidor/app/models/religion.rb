# frozen_string_literal: true

class Religion < ActiveRecord::Base
  include Msip::Basica

  has_many :usuario,
    validate: true
end
