// From
// https://github.com/0xRowdy/nextauth-siwe-route-handlers/blob/main/src/app/api/auth/auth-options.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getCsrfToken } from "next-auth/react";
import { SiweMessage } from "siwe";

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

          const signature = credentials?.signature || ""
          // From https://github.com/nextauthjs/next-auth/discussions/7923
          const result = await siwe.verify({
            signature: signature,
            domain: nextAuthUrl.host,
            nonce: await getCsrfToken({ req: { headers: req.headers } }),
          });
          console.log("OJO result=", result)
          console.log("OJO signature=", signature)
          
          if (result.success) {
            console.log("OJO siwe.address=", siwe.address)
            return {
              id: siwe.address,
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
