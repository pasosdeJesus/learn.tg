# frozen_string_literal: true

class BilleteraUsuario < ActiveRecord::Base
  belongs_to :usuario
end
