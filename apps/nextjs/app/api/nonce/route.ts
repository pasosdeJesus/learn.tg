
import { NextResponse } from 'next/server';
import { generateNonce } from 'siwe';
import { db } from '@/db/database'; // Assuming you have a db instance

/**
 * @swagger
 * /api/nonce:
 *   get:
 *     summary: Generates and stores a unique nonce for signing.
 *     description: Creates a single-use nonce for the SIWE process and stores it in the database, associated with the user's wallet address. This nonce has a 5-minute expiration time.
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: walletAddress
 *         required: true
 *         description: The user's wallet address.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A unique nonce string.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'a1b2c3d4e5f6g7h8'
 *       400:
 *         description: Wallet address is required.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('walletAddress');

  if (!walletAddress) {
    return new NextResponse('Wallet address is required', { status: 400 });
  }

  const nonce = generateNonce();
  const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

  await db.updateTable('billetera_usuario')
    .set({
      nonce: nonce,
      nonce_expires_at: expires,
    })
    .where('billetera', '=', walletAddress)
    .execute();
  
  return new NextResponse(nonce, {
    status: 200,
    headers: {
        'Content-Type': 'text/plain',
    }
  });
}

