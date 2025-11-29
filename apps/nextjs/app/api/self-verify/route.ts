import { Insertable, Kysely, PostgresDialect, sql, Updateable } from 'kysely'
import { NextResponse } from 'next/server'
import { AllIds, DefaultConfigStore, SelfBackendVerifier } from '@selfxyz/core'

import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import type { DB, Usuario } from '@/db/db.d.ts'

// Reuse a single verifier instance
const selfBackendVerifier = new SelfBackendVerifier(
  'learn.tg',
  process.env.NEXT_PUBLIC_SELF_ENDPOINT || 'none',
  process.env.NEXT_PUBLIC_AUTH_URL != 'https://learn.tg', // mockPassport: false = mainnet, true = staging/testnet
  AllIds,
  new DefaultConfigStore({
    excludedCountries: [],
    ofac: false, // See https://t.me/localismfund/1/435
  }),
  'hex', // userIdentifierType
)

export async function POST(req: Request) {
  try {
    console.log('POST /api/self-verify/')
    // Extract data from the request
    const { attestationId, proof, publicSignals, userContextData } =
      await req.json()
    console.log('attestationId=', attestationId)
    console.log('proof=', proof)
    console.log('publicSignals=', publicSignals)
    console.log('userContextData=', userContextData)

    console.log(
      'NEXT_PUBLIC_SELF_ENDPOINT',
      process.env.NEXT_PUBLIC_SELF_ENDPOINT,
    )
    console.log('NEXT_PUBLiC_AUTH_RUL=', process.env.NEXT_PUBLIC_AUTH_URL)
    console.log('AllIds=', AllIds)
    console.log('selfBackendVerifier=', selfBackendVerifier)

    // Verify all required fields are present
    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return NextResponse.json(
        {
          message:
            'Proof, publicSignals, attestationId and userContextData are required',
        },
        { status: 200 },
      )
    }

    console.log('*OJO Verify the proof')
    // Verify the proof
    const result = await selfBackendVerifier.verify(
      attestationId, // Document type (1 = passport, 2 = EU ID card, 3 = Aadhaar)
      proof, // The zero-knowledge proof
      publicSignals, // Public signals array
      userContextData, // User context data (hex string)
    )
    console.log('OJO result=', result)

    // Check if verification was successful
    if (result.isValidDetails.isValid) {
      // Verification successful - process the result
      console.log('Verification successful')

      const wallet = result.userData.userIdentifier
      console.log('wallet=', wallet)

      const db = newKyselyPostgresql()

      let qBilleteraUsuario =
        await sql<any>`select usuario_id from billetera_usuario where lower(billetera) = lower(${wallet})`.execute(
          db,
        )
      console.log('usuario=', qBilleteraUsuario)
      if (qBilleteraUsuario.rows[0]?.usuario_id === null) {
        throw new Error('User not found')
      }
      console.log(
        'result.discloseOutput.nationality=',
        result.discloseOutput.nationality,
      )
      let ISOcode = result.discloseOutput.nationality
      if (ISOcode == 'D<<') {
        ISOcode = 'DEU'
      }
      let qCountryId =
        await sql<any>`select id from msip_pais where lower(alfa3) = lower(${ISOcode})`.execute(
          db,
        )
      console.log('qCountryId=', qCountryId)
      if (qCountryId.rows.length != 1 || qCountryId.rows[0]?.id === null) {
        throw new Error(`Country ${ISOcode} not found`)
      }
      let qRepetido =
        await sql<any>`select id from usuario where lower(passport_name) = lower(${result.discloseOutput.name as string}) AND passport_nationality = ${qCountryId.rows[0].id}`.execute(
          db,
        )
      console.log('** qRepetido=', qRepetido)
      if (
        qRepetido.rows.length > 1 ||
        (qRepetido.rows.length == 1 &&
          qRepetido.rows[0].id != qBilleteraUsuario.rows[0].usuario_id)
      ) {
        throw new Error(
          'Passport used with another wallet, cannot verify this one',
        )
      }

      console.log('usuario=', qBilleteraUsuario)
      if (qBilleteraUsuario.rows[0]?.usuario_id === null) {
        throw new Error('User not found')
      }

      let uUsuario: Updateable<Usuario> = {
        passport_name: result.discloseOutput.name,
        nombre: result.discloseOutput.name,
        passport_nationality: qCountryId.rows[0].id,
        pais_id: qCountryId.rows[0].id,
      }
      console.log('uUsuario=', uUsuario)
      let rupdate = await db
        .updateTable('usuario')
        .set(uUsuario)
        .where('id', '=', qBilleteraUsuario.rows[0].usuario_id)
        .execute()
      console.log('rupdate=', rupdate)
      return NextResponse.json({
        status: 'success',
        result: true,
        credentialSubject: result.discloseOutput,
      })
    } else {
      // Verification failed
      console.log(
        'Verification failed result.isValidDetails=',
        result.isValidDetails,
      )
      return NextResponse.json(
        {
          status: 'error',
          result: false,
          reason: 'Verification failed',
          error_code: 'VERIFICATION_FAILED',
          details: result.isValidDetails,
        },
        { status: 200 },
      )
    }
  } catch (error) {
    console.log('Error error=', error)
    return NextResponse.json(
      {
        status: 'error',
        result: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
        error_code: 'UNKNOWN_ERROR',
      },
      { status: 200 },
    )
  }
}
