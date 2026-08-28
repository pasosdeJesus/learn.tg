#!/usr/bin/env node
// sync-usdt.mjs — copia MockUSDT.sol desde el motor usdt (@pasosdejesus/usdt,
// https://gitlab.com/pasosdeJesus/m/-/work_items/35 §15.6) a <cwd>/contracts/_usdt_mock.sol.
//
// Hardhat no resuelve el link: externo del paquete (HH411 "is not installed"),
// así que el build copia el .sol y compila el artifact localmente. La fuente
// canónica es el motor; contracts/_usdt_mock.sol es un archivo GENERADO
// (derivado, no se edita a mano).
//
// Funciona desde cualquier proyecto cuyo node_modules tenga el paquete
// (apps/hardhat con link:, o packages/<motor>/contracts con symlink al
// node_modules de apps/hardhat).
import { cpSync, existsSync } from 'fs'
import { join } from 'path'

const cwd = process.cwd()
const src = join(cwd, 'node_modules', '@pasosdejesus', 'usdt', 'contracts', 'contracts', 'MockUSDT.sol')
const dst = join(cwd, 'contracts', '_usdt_mock.sol')

if (!existsSync(src)) {
  console.warn('[sync-usdt] @pasosdejesus/usdt no encontrado en node_modules — saltando')
  process.exit(0)
}
cpSync(src, dst)
console.log('[sync-usdt] MockUSDT.sol -> contracts/_usdt_mock.sol')
