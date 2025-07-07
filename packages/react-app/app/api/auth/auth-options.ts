// From
// https://github.com/0xRowdy/nextauth-siwe-route-handlers/blob/main/src/app/api/auth/auth-options.ts
import { submitReferral } from '@divvi/referral-sdk'
import { Insertable, Kysely, PostgresDialect, sql, Updateable } from 'kysely';
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getCsrfToken } from "next-auth/react";
import { SiweMessage } from "siwe";

import defineConfig from '@/.config/kysely.config.ts'
import type { DB, BilleteraUsuario, Usuario } from '@/db/db.d.ts';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Ethereum",
      credentials: {
        message: {
          label: "Message",
          type: "text",
          placeholder: "0x0",
        },
        signature: {
          label: "Signature",
          type: "text",
          placeholder: "0x0",
        },
      },
      async authorize(credentials, req) {
        console.log("OJO authorize. credentials=", credentials, " req=", req)
        try {
          console.log("OJO credentials.message=", credentials?.message)
          const siwe = new SiweMessage( credentials?.message || "")
          console.log("OJO siwe=", siwe)
          const nextAuthUrl = new URL(process.env.NEXTAUTH_URL as string);
          console.log("OJO nextAuthUrl=", nextAuthUrl)

          // From https://github.com/nextauthjs/next-auth/discussions/7923
          const result = await siwe.verify({
            signature: credentials?.signature || "0x0",
            domain: nextAuthUrl.host,
            nonce: await getCsrfToken({ req: { headers: req.headers } }),
          });
          console.log("OJO result=", result)
          console.log("OJO nonce=", result.data.nonce)

          if (result.success) {
            console.log("OJO siwe.address=", siwe.address)
            //localStorage.setItem('authToken', signature)

            console.log("OJO Submitting referral " + (new Date()))
            const sr = await submitReferral({
              message: credentials?.message || "",
              signature: credentials?.signature || "0x0",
              chainId: result.data.chainId,
            })
            console.log("OJO Submitted ", sr, (new Date()))
            const db = new Kysely<DB>({
              dialect: defineConfig.dialect
            })

            let now = new Date()

            let puser = await sql<number>`
              SELECT usuario_id 
              FROM billetera_usuario
              WHERE billetera=${sql.val(siwe.address)}`
              .execute(db)
            console.log("puser=", puser) 
            console.log("puser.rows=", puser.rows) 

            if (puser.rows.length == 0) {
              let address15 = siwe.address.slice(0,7) + "..." +
                siwe.address.slice(-5)
              console.log("OJO address15=", address15,
                          ", address15.length", address15.length)
              let nuser:Insertable<Usuario> = {
                nombre: siwe.address,
                nusuario: address15,
                email: `${address15}@localhost`,
                current_sign_in_at: now,
                current_sign_in_ip: '0.0.0.0', 
                created_at: now,
                updated_at: now,
              }
              let iuser = await db
                .insertInto('usuario')
                .values(nuser)
                .returningAll()
                .executeTakeFirstOrThrow()
              console.log("After insert iuser=", iuser)

              let nWalletUser:Insertable<BilleteraUsuario> = {
                usuario_id: iuser.id,
                billetera: siwe.address,
                token: result.data.nonce,
                created_at: now,
                updated_at: now,
              }
              let iWalletUser= await db
                .insertInto('billetera_usuario')
                .values(nWalletUser)
                .returningAll()
                .executeTakeFirstOrThrow()
              console.log("After insert iWalletUser=", iWalletUser)
            } else {
              console.log("existe ", puser.rows[0].usuario_id)

              let uWalletUser:Updateable<Usuario> = {
                token: result.data.nonce,
                updated_at: now,
              }
              let rUpdate=await db.updateTable('billetera_usuario')
              .set(uWalletUser)
              .where('usuario_id', '=', puser.rows[0].usuario_id).execute()
              console.log("After update rUpdate=", rUpdate)
            }

            return {
              id: siwe.address
            };
          }
          return null;
        } catch (e) {
          console.log("OJO exception e=", e)
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      console.log("OJO session. session=", session, ", token=", token)
      session.address = token.sub;
      session.user.name = token.sub;
      return session;
    },
  },
};
