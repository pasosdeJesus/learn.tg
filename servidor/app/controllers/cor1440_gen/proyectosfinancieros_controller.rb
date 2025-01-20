require_dependency "cor1440_gen/concerns/controllers/proyectosfinancieros_controller"

module Cor1440Gen
  class ProyectosfinancierosController < Heb412Gen::ModelosController
    include Cor1440Gen::Concerns::Controllers::ProyectosfinancierosController

    before_action :set_proyectofinanciero,
      only: [:show, :edit, :update, :destroy]
    skip_before_action :set_proyectofinanciero, only: [:validar]

    load_and_authorize_resource  class: Cor1440Gen::Proyectofinanciero,
      only: [:new, :create, :destroy, :edit, :update, :show,
             :objetivospf]

    def atributos_index
      [ 
        :id, 
        :nombre 
      ] +
      [ 
        :financiador_ids =>  [] 
      ] +
      [ 
        :fechainicio_localizada,
        :fechacierre_localizada,
        :responsable,
        :proyectofinanciero_usuario,
      ] +
      [ :compromisos, 
        :monto, 
        :observaciones, 
        :objetivopf,
        :indicadorobjetivo,
        :resultadopf,
        :indicadorpf,
        :actividadpf
      ]
    end

    def atributos_filtro_antestabla
      [
        :idioma,
        :prefijoRuta,
      ]
    end

    def atributos_show
      atributos_index - [
        :objetivopf,
        :indicadorobjetivo,
        :resultadopf,
        :indicadorpf,
        :actividadpf
      ] + [ 
        :subtitulo,
        :idioma,
        :prefijoRuta,
        :imagen,
        :altImagen,
        :creditoImagen,
        :enlaceImagen,
        :imagen,
        :resumenMd,
        :conBilletera,
        :sinBilletera,
        :marcologico,
        :caracterizacion, 
        :beneficiario,
        :plantillahcm,
        :anexo_proyectofinanciero
      ]
    end

    def new
      new_cor1440_gen
      @registro.subtitulo = ((0...8).map { (65 + rand(26)).chr }.join)
      @registro.prefijoRuta = "/" + @registro.subtitulo
      @registro.save!
      redirect_to(cor1440_gen.edit_proyectofinanciero_path(@registro)) 
    end

    def index(c = nil)
      index_cor1440_gen(c)
      super(c)
    end

    def lista_proyectofinanciero_params
      l = [
        :altImagen,
        :creditoImagen,
        :conBilletera,
        :enlaceImagen,
        :idioma,
        :imagen,
        :prefijoRuta,
        :resumenMd,
        :imagen,
        :sinBilletera,
        :subtitulo
      ] + proyectofinanciero_params_cor1440_gen
      #at = proyectofinanciero_params_cor1440_gen.select {
      #  |i,v| i.class == Hash && i.keys == [:actividadpf_attributes]
      #}[0]
      #at[:actividadpf_attributes].insert(-1, :rutamd) 
      return l
    end


    def proyectofinanciero_params
      params.require(:proyectofinanciero).permit(
        lista_proyectofinanciero_params
      )
    end

  end 
end
