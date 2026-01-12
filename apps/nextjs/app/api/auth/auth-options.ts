// From
// https://github.com/0xRowdy/nextauth-siwe-route-handlers/blob/main/src/app/api/auth/auth-options.ts
import { submitReferral } from '@divvi/referral-sdk'
import { Insertable, Kysely, PostgresDialect, sql, Updateable } from 'kysely'
import { headers } from "next/headers";
import { NextAuthOptions, Session } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getCsrfToken } from 'next-auth/react'
import { Pool } from 'pg'
import { SiweMessage } from 'siwe'
import { Address } from 'viem'

import type { DB, BilleteraUsuario, Usuario } from '@/db/db.d.ts'
import { newKyselyPostgresql } from '@/.config/kysely.config'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Ethereum',
      credentials: {
        message: {
          label: 'Message',
          type: 'text',
          placeholder: '0x0',
        },
        signature: {
          label: 'Signature',
          type: 'text',
          placeholder: '0x0',
        },
      },
      async authorize(credentials, req) {
        console.log(
          'OJO authorize. credentials=',
          credentials,
          ' req=',
          req,
          new Date(),
        )
        const headersList = req.headers!;
        console.log("OJO headersList=", headersList)
        const forwardedFor = headersList["x-forwarded-for"];
        console.log("OJO forwardedFor=", forwardedFor)
        const realIp = headersList["x-real-ip"];
        console.log("OJO realIp=", realIp)
        const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "127.0.0.1";
        console.log("OJO ip=", ip)

        try {
          console.log(
            new Date(),
            'OJO credentials.message=',
            credentials?.message,
          )
          const siwe = new SiweMessage(credentials?.message || '')
          console.log(new Date(), 'OJO siwe=', siwe)
          const nextAuthUrl = new URL(
            process.env.NEXT_PUBLIC_AUTH_URL as string,
          )
          console.log(new Date(), 'OJO nextAuthUrl=', nextAuthUrl)

          // From https://github.com/nextauthjs/next-auth/discussions/7923
          const result = await siwe.verify({
            signature: (credentials?.signature || '0x0') as Address,
            domain: nextAuthUrl.host,
            nonce: await getCsrfToken({ req: { headers: req.headers } }),
          })
          console.log(new Date(), 'OJO verify result=', result)
          console.log(new Date(), 'OJO nonce=', result.data.nonce)

          if (result.success) {
            console.log(new Date(), 'OJO siwe.address=', siwe.address)

            console.log(new Date(), 'OJO Submitting referral ', new Date())
            if (process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg') {
              const sr = await submitReferral({
                message: credentials?.message || '',
                signature: (credentials?.signature || '0x0') as Address,
                chainId: result.data.chainId,
              })
              console.log(new Date(), 'OJO Submitted ', sr)
            }
            const db = newKyselyPostgresql()
            const now = new Date()

            const puser = await sql<number>`
              SELECT usuario_id 
              FROM billetera_usuario
              WHERE billetera=${sql.val(siwe.address)}`.execute(db)
            console.log(new Date(), 'puser=', puser)
            console.log(new Date(), 'puser.rows=', puser.rows)

            if (puser.rows.length == 0) {
              const address15 =
                siwe.address.slice(0, 7) + '...' + siwe.address.slice(-5)
              console.log(
                new Date(),
                'OJO address15=',
                address15,
                ', address15.length',
                address15.length,
              )
              const nuser: Insertable<Usuario> = {
                nombre: siwe.address,
                nusuario: address15,
                email: `${address15}@localhost`,
                current_sign_in_at: now,
                current_sign_in_ip: ip,
                created_at: now,
                updated_at: now,
              }
              const iuser = await db
                .insertInto('usuario')
                .values(nuser)
                .returningAll()
                .executeTakeFirstOrThrow()
              console.log(new Date(), 'After insert iuser=', iuser)

              const nWalletUser: Insertable<BilleteraUsuario> = {
                usuario_id: iuser.id,
                billetera: siwe.address,
                token: result.data.nonce,
                created_at: now,
                updated_at: now,
              }
              const iWalletUser = await db
                .insertInto('billetera_usuario')
                .values(nWalletUser)
                .returningAll()
                .executeTakeFirstOrThrow()
              console.log(new Date(), 'After insert iWalletUser=', iWalletUser)
            } else {
              console.log(
                new Date(),
                'existe ',
                (puser.rows[0] as any).usuario_id,
              )
              const cUser = await db
                .selectFrom('usuario')
                .where('id', '=', (puser.rows[0] as any).usuario_id)
                .selectAll()
                .executeTakeFirst()
              console.log(new Date(), 'cUser=', cUser)
              console.log(
                new Date(), 
                'cUser.current_sign_in_ip=', cUser?.current_sign_in_ip
              )
              const uWalletUser: any = {
                token: result.data.nonce,
                updated_at: now,
              }
              const rUpdate = await db
                .updateTable('billetera_usuario')
                .set(uWalletUser)
                .where('usuario_id', '=', (puser.rows[0] as any).usuario_id)
                .execute()
              console.log(new Date(), 'After update rUpdate=', rUpdate)
              let uUser: Updateable<Usuario> = {
                last_sign_in_ip: cUser?.current_sign_in_ip ?? null,
                last_sign_in_at: cUser?.current_sign_in_at ?? null,
                current_sign_in_ip: ip,
                current_sign_in_at: now,
                updated_at: now,
              }
              let uUpdate = await db
                .updateTable('usuario')
                .set(uUser)
                .where('id', '=', (puser.rows[0] as any).usuario_id)
                .execute()
              console.log(new Date(), 'After update uUpdate=', uUpdate)
            }
            console.log(new Date(), 'OJO Before return. ', new Date())

            return {
              id: siwe.address,
            }
          }
          return null
        } catch (e) {
          console.log(new Date(), 'OJO exception e=', e)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      console.log(
        new Date(),
        'OJO session. session=',
        session,
        ', token=',
        token,
      )
      if (token.sub) {
        session.address = token.sub
        if (!session.user) {
          session.user = { name: token.sub }
        } else {
          session.user.name = token.sub
        }
      }
      return session
    },
  },
}
