// From
// https://github.com/0xRowdy/nextauth-siwe-route-handlers/blob/main/src/app/api/auth/%5B...nextauth%5D/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/app/api/auth/auth-options'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
