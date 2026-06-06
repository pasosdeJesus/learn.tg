#!/usr/bin/env node 

import fs from 'fs'
import path from 'path'
import 'dotenv/config.js'
import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })

// Configuration - directory files
const HARDHAT_ARTIFACTS_PATH = './artifacts/contracts'
const NEXTJS_ABI_PATH = '../nextjs/abis'
const ENV_FILE = '../.env'
const DEPLOYMENTS_DIR = './deployments'

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

function readDeploymentAddress(contractPath) {
  const net = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
  const file = path.join(DEPLOYMENTS_DIR, ...contractPath.split('/'), `${net}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')).address
}

function updateEnvVar(envContent, varName, value) {
  const regex = new RegExp(`^${varName}=.*$`, 'm')
  if (regex.test(envContent)) {
    return envContent.replace(regex, `${varName}=${value}`)
  }
  return envContent + `\n${varName}=${value}\n`
}

// Main script
console.log("🔄 Syncing ABIs and addresses to React app...")

try {
  // 1. Sync ABIs
  const artifactFiles = walkDir(HARDHAT_ARTIFACTS_PATH)
  const abis = {}
  artifactFiles.forEach(filepath => {
    const artifact = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    const filename = path.basename(filepath)
    const contractName = filename.replace('.json', '')
    const dirName = path.basename(path.dirname(filepath))
    if (!abis[contractName] || contractName === dirName) {
      abis[contractName] = artifact.abi
    }
  })

  for (const [contractName, abi] of Object.entries(abis)) {
    const abiPath = path.join(NEXTJS_ABI_PATH, `${contractName}.json`)
    fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2))
    console.log(`  Copied ABI for ${contractName}`)
  }

  // 2. Sync deployment addresses to .env
  const slearnAddr = readDeploymentAddress('SLEARN')
  if (slearnAddr) {
    let envContent = fs.readFileSync(ENV_FILE, 'utf8')
    envContent = updateEnvVar(envContent, 'NEXT_PUBLIC_SLEARN_ADDRESS', slearnAddr)
    fs.writeFileSync(ENV_FILE, envContent)
    console.log(`  Synced NEXT_PUBLIC_SLEARN_ADDRESS=${slearnAddr}`)
  }

  console.log("✅ Sync complete!")
} catch (error) {
  console.error("❌ Error syncing:", error)
  process.exit(1)
}
