import { mkdirSync, symlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Ensure findHardhatDir resolves to THIS directory (option 1: cwd/apps/hardhat)
const appsDir = join(__dirname, 'apps');
if (!existsSync(appsDir)) mkdirSync(appsDir, { recursive: true });
const linkPath = join(appsDir, 'hardhat');
if (!existsSync(linkPath)) symlinkSync(__dirname, linkPath);

process.chdir(linkPath);

const { runContractTest } = await import('../../../m/packages/contract-test/dist/runner.js');
await runContractTest();
