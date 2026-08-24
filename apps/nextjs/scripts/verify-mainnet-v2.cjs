// Read-only verification of ClusterFundsV2 mainnet deployment + SLEARN authorization.
const { createPublicClient, http } = require('viem')
const { celo } = require('viem/chains')
const fs = require('fs')

const RPC = 'https://forno.celo.org'
const V1 = '0xB31925E72402e91de01784b4512B2A83D3e2CFBD' // ClusterFunds mainnet (REQ/155)
const V2 = '0x3F524c8E7003f9D4bF95134898593CD9E7Fcc7a7'  // ClusterFundsV2 mainnet
const SLEARN = '0x27fd41Bea85C39254f2B12789eB37a1543152CC1' // SLEARN mainnet (REQ/155)

const v2Abi = JSON.parse(fs.readFileSync('abis/ClusterFundsV2.json', 'utf8'))
const v1Abi = JSON.parse(fs.readFileSync('abis/ClusterFunds.json', 'utf8'))

const client = createPublicClient({ chain: celo, transport: http(RPC) })

async function call(abi, address, fn, args) {
  try {
    const r = await client.readContract({ address, abi, functionName: fn, args })
    return r
  } catch (e) {
    return `ERR ${e.shortMessage || e.message}`.slice(0, 120)
  }
}

async function main() {
  console.log(`RPC: ${RPC}`)
  console.log(`V2: ${V2}`)
  console.log(`V1: ${V1}`)
  console.log(`SLEARN: ${SLEARN}\n`)

  console.log('— ClusterFundsV2 —')
  console.log('  owner:', await call(v2Abi, V2, 'owner', []))
  console.log('  donorCashbackPct:', await call(v2Abi, V2, 'donorCashbackPct', []))
  const cfg = await call(v2Abi, V2, 'getFeeConfig', [])
  console.log('  feeConfig:', JSON.stringify(cfg)?.slice(0, 200))
  console.log('  getCountryBalance(CO):', await call(v2Abi, V2, 'getCountryBalance', ['CO']))
  console.log('  getCountryBalance(SL):', await call(v2Abi, V2, 'getCountryBalance', ['SL']))

  console.log('\n— ClusterFunds V1 (saldo debe ser 0 si se migró) —')
  console.log('  getCountryBalance(CO):', await call(v1Abi, V1, 'getCountryBalance', ['CO']))
  console.log('  getCountryBalance(SL):', await call(v1Abi, V1, 'getCountryBalance', ['SL']))

  console.log('\n— SLEARN authorization —')
  const slearnAbi = [{ name: 'authorizedTransfers', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'bool' }] }]
  console.log('  authorizedTransfers[V2]:', await call(slearnAbi, SLEARN, 'authorizedTransfers', [V2]))
  console.log('  authorizedTransfers[V1]:', await call(slearnAbi, SLEARN, 'authorizedTransfers', [V1]))
}

main().catch(e => { console.error(e); process.exit(1) })
