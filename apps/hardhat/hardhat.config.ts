import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import { config as dotEnvConfig } from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';

dotEnvConfig();

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
