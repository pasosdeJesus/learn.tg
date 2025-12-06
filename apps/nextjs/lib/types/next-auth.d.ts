import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    address?: string
    user?: {
      name?: string
      email?: string
      image?: string
    }
  }

  interface User {
    address?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    address?: string
  }
}
