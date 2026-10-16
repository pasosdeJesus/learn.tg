import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    address?: string
    /** R-#265 §3.8: cuenta (usuario) a la que pertenece la sesión, no la billetera. */
    usuarioId?: number
    user?: {
      name?: string
      email?: string
      image?: string
    }
  }

  interface User {
    address?: string
    /** Cuenta resuelta por el motor `wallet` en el inicio de sesión. */
    usuarioId?: number
    /** Época de sesión de la cuenta (R-#250): permite revocarla con un UPDATE. */
    sessionEpoch?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    address?: string
    usuarioId?: number
    sessionEpoch?: number
  }
}
