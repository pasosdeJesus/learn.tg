# frozen_string_literal: true

class ApplicationController < Msip::ApplicationController
  # protect_from_forgery with: :exception

  def current_ability
    @current_ability ||= ::Ability.new(current_usuario)
  end

  # Sin definición de autorización por ser utilidad
end
