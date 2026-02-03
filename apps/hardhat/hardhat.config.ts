import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import { config as dotEnvConfig } from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import { task } from "hardhat/config";
import { task } from "hardhat/config";


dotEnvConfig();


task("check-transfer", "Check token transfer from tx hash")
.addParam("tx", "Transaction hash")
.addParam("token", "Token contract address")
.setAction(async (taskArgs, hre) => {
  const { ethers } = hre;
  const { tx, token } = taskArgs;

  const receipt = await ethers.provider.getTransactionReceipt(tx);
  if (!receipt) {
    console.log("Transaction not found");
    return;
  }

  const TokenABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "function decimals() view returns (uint8)"
  ];

  const tokenContract = new ethers.Contract(token, TokenABI, ethers.provider);
  const decimals = await tokenContract.decimals();

  const transferEventTopic = ethers.id("Transfer(address,address,uint256)");
  const transferLogs = receipt.logs.filter(log => log.topics[0] === transferEventTopic);

  if (transferLogs.length === 0) {
    console.log("No Transfer event found");
    return;
  }

  for (const log of transferLogs) {
    const parsedLog = tokenContract.interface.parseLog(log);
    console.log("Amount:", ethers.formatUnits(parsedLog.args.value, decimals));
  }
});

const config: HardhatUserConfig = {
  networks: {
    celo: {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: 'https://forno.celo.org',
    },
    celoSepolia: {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: 'https://forno.celo-sepolia.celo-testnet.org/',
    },

    'base-sepolia': {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: 'https://sepolia.base.org',
    },
  },
  etherscan: {
    apiKey: {
      celoSepolia: process.env.BLOCKSCOUT_API_KEY ?? '',
      celo: process.env.BLOCKSCOUT_API_KEY ?? '',
      'base-sepolia': process.env.BASESCAN_API_KEY ?? '',
    },
    customChains: [
      {
        network: 'celoSepolia',
        chainId: 11_142_220,
        urls: {
          apiURL: 'https://celo-sepolia.blockscout.com/api',
          browserURL: 'https://celo-sepolia.blockscout.com/',
        },
      },
      {
        chainId: 42_220,
        network: 'celo',
        urls: {
          apiURL: 'https://celo.blockscout.com/api',
          browserURL: 'https://celo.blockscout.com/',
        },
      },
      {
        chainId: 84532,
        network: 'base-sepolia',
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org/',
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  solidity: '0.8.24',
};

export default config;
