// Test RPC connectivity — verifies if our IP can reach the RPC endpoint
const RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://celo-sepolia.g.alchemy.com/v2/fin_q7tcB_QLb6PcPsWpK'

async function test() {
  console.log('Testing RPC:', RPC)
  console.log('')
  
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
    })
    const data = await res.json()
    
    if (data.error) {
      console.log('❌ BLOCKED')
      console.log('Error:', data.error.message)
      console.log('Code:', data.error.code)
      return
    }
    
    const chainId = parseInt(data.result, 16)
    console.log('✅ Connected! Chain ID:', chainId)
    
    // Try balance check
    const addr = process.argv[2] || '0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C'
    const res2 = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [addr, 'latest'],
        id: 2,
      }),
    })
    const data2 = await res2.json()
    if (data2.error) {
      console.log('Balance check blocked:', data2.error.message)
    } else {
      const bal = BigInt(data2.result)
      console.log('Address:', addr)
      console.log('Balance:', (Number(bal) / 1e18).toFixed(6), 'CELO')
    }
  } catch (e) {
    console.log('❌ NETWORK ERROR:', e.message)
  }
}

test()
