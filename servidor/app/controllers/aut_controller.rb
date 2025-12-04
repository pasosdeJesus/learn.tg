# frozen_string_literal: true

class AutController < ApplicationController
  skip_before_action :verify_authenticity_token

  # Basado en propuesta de DeepSeek de Feb.2025
  def generar_nonce
    nonce = SecureRandom.hex(16)
    n = Nonce.create!(nonce: nonce)
    Nonce.where("created_at < ?", Date.today - 15).delete_all
    puts "OJO nonce generated"
    render(json: { nonce: n.nonce, emision: n.created_at.iso8601 })
  end

  def verificar_firma
    puts "OJO verificar_firma 1"
    direccion = params[:direccion]
    firma = params[:firma]
    mensaje = params[:mensaje]
    nonce = params[:nonce]
    if direccion.nil?
      render(json: { eror: "Falta parámetro direccion" }, status: :unauthorized)
      return
    end
    if firma.nil?
      render(json: { eror: "Falta parámetro firma" }, status: :unauthorized)
      return
    end
    if mensaje.nil?
      render(json: { eror: "Falta parámetro mensaje" }, status: :unauthorized)
      return
    end
    if nonce.nil?
      render(json: { eror: "Falta parámetro nonce" }, status: :unauthorized)
      return
    end
    if Nonce.where(nonce: nonce).count != 1
      render(json: { eror: "nonce no encontrado" }, status: :unauthorized)
      return
    end
    puts "OJO verificar_firma 2"
    rnonce = Nonce.find_by(nonce: nonce)
    emision = rnonce.created_at

    if Time.now.utc - emision.utc > 60 * 5
      # Máximo 5 minutos para que el usuario firme
      render(json: { eror: "nonce expiró" }, status: :unauthorized)
      return
    end
    puts "OJO verificar_firma 2.5 emision.utc=#{emision.utc}"

    if request.origin != Rails.configuration.x.maq_cliente
      render(json: { eror: "Diferencia en cliente esperado" }, status: :unauthorized)
      return
    end
    puts "OJO verificar_firma 3 request.origin=#{request.origin}"

    mensaje_esperado = formar_mensaje_siwe(
      direccion: direccion,
      nonce: nonce,
      dominio: request.host,
      uri: request.origin,
      declaracion: "Ingreso a learn.tg",
      emision: emision.iso8601,
    )

    if mensaje != mensaje_esperado
      puts "OJO mensaje mismatch"
      render(json: { eror: "Problema con mensajes" }, status: :unauthorized)
      return
    end
    puts "OJO verificar_firma 4"

    es_valida = es_valida_firma_ethereum?(
      mensaje: mensaje_esperado,
      firma: firma,
      direccion: direccion,
      mensajeorig: mensaje,
    )

    puts "OJO verificar_firma 5 es_valida=#{es_valida}"

    if es_valida
      session[:direccion_usuario] = direccion
      render(json: { success: true, direccion: direccion })
    else
      render(json: { error: "Firma invalida" }, status: :unauthorized)
    end
  end

  private

  def formar_mensaje_siwe(
    direccion:, nonce:, dominio:, uri:, declaracion:, emision:
  )
    <<~MESSAGE
      #{dominio} quiere que ingrese con su cuenta X Layer:
      #{direccion}

      #{declaracion}

      URI: #{uri}
      Version: 1
      Chain ID: 196
      Nonce: #{nonce}
      Emisión: #{emision}
    MESSAGE
  end

  def es_valida_firma_ethereum?(mensaje:, firma:, direccion:, mensajeorig:)
    puts "OJO es_valida_firma_ethereum? direccion=#{direccion[0..8]}..."
    Eth::Signature.verify(mensaje, firma, direccion, 196)
  rescue
    false
  end
end
