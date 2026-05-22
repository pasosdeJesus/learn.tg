import 'dotenv/config';
import { createPublicClient, http, erc20Abi } from 'viem';
import { celoSepolia } from 'viem/chains';
import { readFileSync } from 'fs';

const LearnTGVaultsAbi = JSON.parse(readFileSync('./abis/LearnTGVaults.json', 'utf8'));
const CeloUbiAbi = JSON.parse(readFileSync('./abis/CeloUbi.json', 'utf8'));

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS;
const USDT_DECIMALS = parseInt(process.env.NEXT_PUBLIC_USDT_DECIMALS || '6', 10);
const LEARNTG_VAULT = process.env.NEXT_PUBLIC_DEPLOYED_AT;
const CELO_UBI = process.env.NEXT_PUBLIC_CELOUBI_ADDRESS;
const NEW_PRIVATE_KEY = process.env.PRIVATE_KEY; // Updated private key
const OLD_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

// Derive address from private key (simple for testing)
import { privateKeyToAccount } from 'viem/accounts';
const newAccount = privateKeyToAccount(NEW_PRIVATE_KEY);
const NEW_ADDRESS = newAccount.address;

console.log('🔍 Contract and Balance Verification');
console.log('====================================\n');

if (!RPC_URL) {
  console.error('Missing RPC URL');
  process.exit(1);
}

const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(RPC_URL),
});

async function getCode(address) {
  try {
    const code = await publicClient.getCode({ address });
    return code !== '0x' && code !== '0x0';
  } catch (error) {
    console.error(`  Error getting code for ${address}:`, error.message);
    return false;
  }
}

async function getUSDTBalance(address) {
  try {
    const balance = await publicClient.readContract({
      address: USDT_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });
    return Number(balance) / (10 ** USDT_DECIMALS);
  } catch (error) {
    console.error(`  Error reading USDT balance for ${address}:`, error.message);
    return null;
  }
}

async function getCELOBalance(address) {
  try {
    const balance = await publicClient.getBalance({ address });
    return Number(balance) / 1e18;
  } catch (error) {
    console.error(`  Error reading CELO balance for ${address}:`, error.message);
    return null;
  }
}

async function readContractFunction(address, abi, functionName, args = []) {
  try {
    const result = await publicClient.readContract({
      address,
      abi,
      functionName,
      args,
    });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('📊 Account Balances:');
  console.log('--------------------');

  // New account (from updated private key)
  console.log(`\n1️⃣ New Account (from updated PRIVATE_KEY):`);
  console.log(`   Address: ${NEW_ADDRESS}`);
  const newUSDT = await getUSDTBalance(NEW_ADDRESS);
  const newCELO = await getCELOBalance(NEW_ADDRESS);
  console.log(`   USDT: ${newUSDT !== null ? newUSDT.toFixed(2) : 'N/A'} USDT`);
  console.log(`   CELO: ${newCELO !== null ? newCELO.toFixed(6) : 'N/A'} CELO`);

  // Old Hardhat account
  console.log(`\n2️⃣ Old Hardhat Account #0:`);
  console.log(`   Address: ${OLD_ADDRESS}`);
  const oldUSDT = await getUSDTBalance(OLD_ADDRESS);
  const oldCELO = await getCELOBalance(OLD_ADDRESS);
  console.log(`   USDT: ${oldUSDT !== null ? oldUSDT.toFixed(2) : 'N/A'} USDT`);
  console.log(`   CELO: ${oldCELO !== null ? oldCELO.toFixed(6) : 'N/A'} CELO`);

  console.log('\n📜 Contract Verification:');
  console.log('------------------------');

  // LearnTGVaults contract
  if (LEARNTG_VAULT) {
    console.log(`\n1️⃣ LearnTGVaults Contract:`);
    console.log(`   Address: ${LEARNTG_VAULT}`);
    const hasCode = await getCode(LEARNTG_VAULT);
    console.log(`   Code deployed: ${hasCode ? '✅ Yes' : '❌ No'}`);

    if (hasCode) {
      // Try to read owner
      const ownerResult = await readContractFunction(LEARNTG_VAULT, LearnTGVaultsAbi, 'owner');
      if (ownerResult.success) {
        console.log(`   Owner: ${ownerResult.result}`);
      } else {
        console.log(`   ❌ Failed to read owner: ${ownerResult.error}`);
      }

      // Try to read USDT token address
      const usdtTokenResult = await readContractFunction(LEARNTG_VAULT, LearnTGVaultsAbi, 'usdtToken');
      if (usdtTokenResult.success) {
        console.log(`   USDT Token: ${usdtTokenResult.result}`);
      }

      // Check balances
      const vaultUSDT = await getUSDTBalance(LEARNTG_VAULT);
      const vaultCELO = await getCELOBalance(LEARNTG_VAULT);
      console.log(`   USDT Balance: ${vaultUSDT !== null ? vaultUSDT.toFixed(2) : 'N/A'} USDT`);
      console.log(`   CELO Balance: ${vaultCELO !== null ? vaultCELO.toFixed(6) : 'N/A'} CELO`);
    }
  }

  // CeloUBI contract
  if (CELO_UBI) {
    console.log(`\n2️⃣ CeloUBI Contract:`);
    console.log(`   Address: ${CELO_UBI}`);
    const hasCode = await getCode(CELO_UBI);
    console.log(`   Code deployed: ${hasCode ? '✅ Yes' : '❌ No'}`);

    if (hasCode) {
      const ubiUSDT = await getUSDTBalance(CELO_UBI);
      const ubiCELO = await getCELOBalance(CELO_UBI);
      console.log(`   USDT: ${ubiUSDT !== null ? ubiUSDT.toFixed(2) : 'N/A'} USDT`);
      console.log(`   CELO: ${ubiCELO !== null ? ubiCELO.toFixed(6) : 'N/A'} CELO`);
    }
  }

  console.log('\n📋 Summary:');
  console.log('-----------');
  console.log('• Verify contract deployment matches expectations');
  console.log('• Ensure accounts have sufficient balances for testing');
  console.log('• If LearnTGVaults shows no code, check RPC endpoint');
  console.log('• If contracts show code but functions fail, check ABI compatibility');
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});