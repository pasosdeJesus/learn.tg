// Types for the Hardhat modules the test files import. `bin/m contract:test` mocks both
// at runtime (it injects a compatible `hre` and the network helpers of the in-memory
// chain), so the tests keep their imports; without Hardhat installed, TypeScript needs
// these declarations to resolve them.
declare module 'hardhat' {
  export const ethers: any
  export const network: any
  export const artifacts: any
  const hre: {
    ethers: any
    network: any
    artifacts: any
  }
  export default hre
}

declare module '@nomicfoundation/hardhat-toolbox/network-helpers.js' {
  export function loadFixture<T>(fixture: () => Promise<T>): Promise<T>
  export const time: {
    increase(seconds: number): Promise<void>
    increaseTo(timestamp: number): Promise<void>
  }
}

declare module '@nomicfoundation/hardhat-network-helpers' {
  export function loadFixture<T>(fixture: () => Promise<T>): Promise<T>
  export const time: {
    increase(seconds: number): Promise<void>
    increaseTo(timestamp: number): Promise<void>
  }
}
