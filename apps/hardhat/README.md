# Soliidty Contracts with Hardhat

In 2025, on OpenBSD/adJ hardhat 3 doesn't work, so we have to use
hardhat 2 that only supports ethers.


## How to use

1. If running on OpenBSD/adJ run bin/prepadJ.sh to compile solidity-analizer 

2. Create a copy of `.env.example` and rename it to `.env`.

   1. If you will work in testet in NETWORK use `celoSepolia` for mainnet in
      NETWORK set `celo`
   2. For the **smart contract deployment** you will need the `PRIVATE_KEY` 
      set in `.env`. **Never** use a wallet with real funds for development. 
      Always have a separate wallet for testing. 
   3. For the **smart contract verification** you will need a 
      [Blockscout API Key](https://.io/myapikey) `BLOCKSCOUT_API_KEY` 
      set in `.env`.

3. Compile the contract 

```bash
yarn build
```

4. Deploy the contract

Make sure your wallet is funded when deploying to testnet or mainnet. 
You can get test tokens for deploying it on Sepolia from the 
[Celo Faucet](https://faucet.celo.org/celo-sepolia).

```bash
bin/deployLearnTGVaults
```

It will present the address where it is deployed. Copy and paste that 
address in the variable `DEPLOYED_AT` of the file `.env`

4. Verify operation of the contract

```bash
bin/verifyLearnTGVaults
```


4. Verify source code of the deployed contract

```bash
bin/contractVerification
```

5. ABI Synchronization

The project includes automatic ABI synchronization with your Nextjs app. 
ABIs are synced to `../nextjs-app/abis/` during compilation.

- **Automatic Syncing**:
  - The ABIs only sync automatically when you run:
    ```bash
    yarn compile
    ```
    or
    ```bash
    npm run compile
    ```

- **Manual Syncing**:
  - To sync ABIs manually without compilation:
    - With npm:
      ```bash
      npm run sync:abis
      ```
    - With Yarn:
      ```bash
      yarn sync:abis
      ```

##### Configuration
- The sync script (`sync-abis.js`) is made executable automatically 
during `npm install` or `yarn install` by the `postinstall` hook in 
`package.json`.
- **To disable automatic syncing**, remove the `sync-abis.js` 
call from the `compile` script in `package.json`. 
This configuration provides a flexible and consistent workflow for 
both `yarn` and `npm` users.
