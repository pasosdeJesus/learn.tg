# frozen_string_literal: true

module Admin
  class ReligionesController < Msip::Admin::BasicasController
    before_action :set_religion,
      only: [:show, :edit, :update, :destroy]
    load_and_authorize_resource class: ::Religion

    def clase
      "::Religion"
    end

    def set_religion
      @basica = Religion.find(params[:id])
    end

    def atributos_index
      [
        :id,
        :nombre,
        :observaciones,
        :fechacreacion_localizada,
        :habilitado,
      ]
    end

    def genclase
      "F"
    end

    def religion_params
      params.require(:religion).permit(*atributos_form)
    end
  end
end
