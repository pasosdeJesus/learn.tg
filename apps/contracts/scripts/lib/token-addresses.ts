// Direcciones de token del ecosistema, desde `mpdj` (`ecosystem-addresses`), no del `.env`:
// `mpdj` resuelve por red (mainnet = canónicas) y sólo usa `NEXT_PUBLIC_*` para Sepolia.
//
// Se importa de forma **dinámica** porque `mpdj` es ESM y estos scripts corren bajo
// `hardhat run` (ts-node en CJS): un `require` del subpath falla con
// `ERR_PACKAGE_PATH_NOT_EXPORTED` (`exports` sólo declara `import`).
//
// "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)

export interface TokenAddresses {
  network: 'celo' | 'celoSepolia'
  usdt: `0x${string}`
  slearn: `0x${string}`
}

export async function tokenAddresses(): Promise<TokenAddresses> {
  const { resolveNetwork, USDT_ADDRESSES, SLEARN_ADDRESSES } = await import(
    '@pasosdejesus/mpdj/blockchain/ecosystem-addresses'
  )
  const network = resolveNetwork()
  return { network, usdt: USDT_ADDRESSES[network], slearn: SLEARN_ADDRESSES[network] }
}
