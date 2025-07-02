module ApplicationHelper

  IDIOMAS=["en", "es"]


  def self.verificaToken(request, merr)
    if request[:walletAddress]
      if !request[:token]
        merr << "No token"
        return false
      end
      b=BilleteraUsuario.where(billetera: request[:walletAddress])
      if b.count == 0
        merr << "No BilleteraUsuario for #{request[:walletAddress]}"
        return false
      end
      if b.take.token != request[:token]
        merr << "Different tokens #{b.take.token} and #{request[:token]}"
        return false
      end
    end
    return true
  end
 
end
