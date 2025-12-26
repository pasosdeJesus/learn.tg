#!/usr/bin/env node 

import fs from 'fs'
import path from 'path'
import 'dotenv/config.js'

// Configuration - directory files
const HARDHAT_ARTIFACTS_PATH = './artifacts/contracts'
const NEXTJS_ABI_PATH = '../nextjs/abis'
const NEXTJS_ENV_PATH = '../nextjs/.env'

const env_replacements = [
  ['DEPLOYED_AT_1', 'NEXT_PUBLIC_DEPLOYED_AT_1'],
  ['DEPLOYED_AT', 'NEXT_PUBLIC_DEPLOYED_AT'],
  ['USDT_ADDRESS', 'NEXT_PUBLIC_USDT_ADDRESS'],
  ['USDT_DECIMALS', 'NEXT_PUBLIC_USDT_DECIMALS'],
  ['CCOP_ADDRESS', 'NEXT_PUBLIC_CCOP_ADDRESS'],
  ['CCOP_DECIMALS', 'NEXT_PUBLIC_CCOP_DECIMALS'],
  ['GOODDOLLAR_ADDRESS', 'NEXT_PUBLIC_GOODDOLLAR_ADDRESS'],
  ['GOODDOLLAR_DECIMALS', 'NEXT_PUBLIC_GOODDOLLAR_DECIMALS'],
  ['CELOUBI_ADDRESS', 'NEXT_PUBLIC_CELOUBI_ADDRESS'],
]

// Create the React ABI directory if it doesn't exist
if (!fs.existsSync(NEXTJS_ABI_PATH)) {
  fs.mkdirSync(NEXTJS_ABI_PATH, { recursive: true })
}

// Function to walk through directories recursively
function walkDir(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(filePath))
    } else {
      if (file.endsWith('.json') && !file.includes('.dbg.')) {
        results.push(filePath)
      }
    }
  })
  return results
}

// Main script
console.log("🔄 Syncing ABIs to React app...")

try {
  // Find all artifact JSON files
  const artifactFiles = walkDir(HARDHAT_ARTIFACTS_PATH)

  artifactFiles.forEach(filepath => {
    // Read and parse the artifact file
    const artifact = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    const filename = path.basename(filepath)
    const contractName = filename.replace('.json', '')

    // Extract and save just the ABI
    const abiPath = path.join(NEXTJS_ABI_PATH, `${contractName}.json`)
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2))
    console.log(`Copied ABI for ${contractName}`)
  })

  console.log("✅ ABI sync complete!")

  env_replacements.forEach((ve) => {
    if (typeof process.env[ve[0]] == "undefined") {
      console.error(`Not defined ${ve[0]} in .env`)
      process.exit(1)
    } else {
      console.log(`*** ${ve[0]} is ${process.env[ve[0]]}`)
    }
  })
  if (fs.statSync(NEXTJS_ENV_PATH)) {
    fs.readFile(NEXTJS_ENV_PATH, 'utf8', function (err,data) {
      if (err) {
        return console.log(err)
      }
      env_replacements.forEach((ve) => {
        let s1 = RegExp(`^\s*${ve[1]}\s*=.*`, "m")
        let s2 = `${ve[1]}=${process.env[ve[0]]}`
        var result = data.replace(s1, s2)
        console.log(`*******Updated ${ve[1]} in ${NEXTJS_ENV_PATH}`)
        data = result
      })

      fs.writeFile(NEXTJS_ENV_PATH, data, 'utf8', function (err) {
        if (err) return console.log(err)
      })
    })
    console.log("✅ Update of environment variables complete!")
  } else {
    console.error(`Environment file ${NEXTJS_ENV_PATH} not found`)
  }
} catch (error) {
  console.error("❌ Error syncing ABIs:", error)
  process.exit(1)
}
