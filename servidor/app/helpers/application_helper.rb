# frozen_string_literal: true

module ApplicationHelper
  IDIOMAS = ["en", "es"]
  def self.usuarioBilleteraToken(request, merr)
    if request[:walletAddress]
      unless request[:token]
        merr << "No token"
        return
      end
      b = BilleteraUsuario.where(billetera: request[:walletAddress])
      if b.count == 0
        merr << "No BilleteraUsuario for #{request[:walletAddress]}"
        return
      end
      ub = b.take
      if ub.token != request[:token]
        merr << "Different tokens #{b.take.token} and #{request[:token]}"
        return
      end
      return ub.usuario
    end
    nil
  end

  def self.verificaToken(request, merr)
    if request[:walletAddress]
      unless request[:token]
        merr << "No token"
        return false
      end
      b = BilleteraUsuario.where(billetera: request[:walletAddress])
      if b.count == 0
        merr << "No BilleteraUsuario for #{request[:walletAddress]}"
        return false
      end
      if b.take.token != request[:token]
        merr << "Different tokens #{b.take.token} and #{request[:token]}"
        return false
      end
    end
    true
  end
end
