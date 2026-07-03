#!/bin/sh
# create-course.sh — Create a new learn.tg course with guides, vault, and SBT credential.
# Usage: ./scripts/create-course.sh "<Course Name>" <courseId> "<prefix>" <numGuides> "<usdtAmount>" "<slearnAmount>" "<icon.svg>"
#
# Example:
#   ./scripts/create-course.sh "Global Disciples" 5 "global-disciples" 4 "1.0" "1.0" "source/global-disciples.svg"
#
# What this script does:
#   1. Creates guide directory structure in resources/{en,es}/
#   2. Creates template .md files for each guide
#   3. Creates vault on LearnTGVaultsV4 with scholarship amounts
#   4. Registers credential type on PasosDeJesusCredentials
#   5. Syncs credential metadata cache
#
# Manual steps (see doc/how-to-create-a-course.md):
#   - Create course and guide records in Rails admin
#   - Write actual guide content in the generated .md files
#   - Prepare SVG icon at public/img/credential/source/

set -e

COURSE_NAME="$1"
COURSE_ID="$2"
PREFIX="$3"
NUM_GUIDES="$4"
USDT_AMOUNT="$5"
SLEARN_AMOUNT="$6"
ICON_PATH="$7"

if [ -z "$COURSE_NAME" ] || [ -z "$COURSE_ID" ] || [ -z "$PREFIX" ] || [ -z "$NUM_GUIDES" ] || [ -z "$USDT_AMOUNT" ] || [ -z "$SLEARN_AMOUNT" ]; then
  echo "Usage: $0 <Course Name> <courseId> <prefix> <numGuides> <usdtPerGuide> <slearnPerGuide> [icon.svg]"
  echo "Example: $0 \"Global Disciples\" 5 \"global-disciples\" 4 \"1.0\" \"1.0\" \"source/global-disciples.svg\""
  exit 1
fi

NETWORK="${NEXT_PUBLIC_NETWORK:-celoSepolia}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$PROJECT_DIR/../../resources"

echo "========================================"
echo "  Creating course: $COURSE_NAME"
echo "  ID: $COURSE_ID | Prefix: $PREFIX"
echo "  Guides: $NUM_GUIDES | USDT: $USDT_AMOUNT | SLEARN: $SLEARN_AMOUNT"
echo "  Network: $NETWORK"
echo "========================================"

# ── Step 1: Guide directory structure ──

echo ""
echo "[1/5] Creating guide templates..."

EN_DIR="$RESOURCES_DIR/en/$PREFIX"
ES_DIR="$RESOURCES_DIR/es/$PREFIX"

mkdir -p "$EN_DIR" "$ES_DIR"

for i in $(seq 1 "$NUM_GUIDES"); do
  EN_FILE="$EN_DIR/guide${i}.md"
  ES_FILE="$ES_DIR/guia${i}.md"
  
  if [ ! -f "$EN_FILE" ]; then
    cat > "$EN_FILE" <<EOF
# Guide $i — $COURSE_NAME

> TODO: Write guide content (400-600 words).
> See doc/how-to-create-a-course.md for guidelines.

## Introduction

## Core Content

## Action Step

## Reflection

---

## Crossword Puzzle
3-5 comprehension questions here. Answers stored as pipe-separated text
in \`billetera_usuario.answer_fib\`.
EOF
    echo "  Created: $EN_FILE"
  else
    echo "  Skipped: $EN_FILE (exists)"
  fi

  if [ ! -f "$ES_FILE" ]; then
    cat > "$ES_FILE" <<EOF
# Guía $i — $COURSE_NAME

> TODO: Escribir contenido de la guía (400-600 palabras).
> Ver doc/how-to-create-a-course.md para lineamientos.

## Introducción

## Contenido Principal

## Paso de Acción

## Reflexión

---

## Crucigrama
3-5 preguntas de comprensión aquí.
EOF
    echo "  Created: $ES_FILE"
  else
    echo "  Skipped: $ES_FILE (exists)"
  fi
done

# ── Step 2: Generate Kysely migration for DB records ──

COURSE_ID=$2
TODAY=$(date +%Y-%m-%d)
MIGRATION_TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATIONS_DIR="$PROJECT_DIR/db/migrations"
MIGRATION_NAME="${MIGRATION_TIMESTAMP}_create_course_${COURSE_ID}"
MIGRATION_FILE="$MIGRATIONS_DIR/${MIGRATION_NAME}.ts"

echo ""
echo "[2/5] Generating Kysely migration → db/migrations/${MIGRATION_NAME}.ts"

cat > "$MIGRATION_FILE" <<MIGEOF
import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql\`
    INSERT INTO cor1440_gen_proyectofinanciero (
      id, nombre, titulo, subtitulo, idioma, "prefijoRuta",
      fechainicio, fechaformulacion, responsable_id, estado, dificultad,
      monto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej,
      "sinBilletera", "conBilletera", chain_id,
      creditosMd, resumenMd,
      created_at, updated_at
    ) VALUES (
      $COURSE_ID, '$COURSE_NAME', '$COURSE_NAME', '$COURSE_NAME',
      'en', '/$PREFIX',
      '$TODAY', '$TODAY', 1, 'E', 'N',
      1.0, 1, 0, 0, 0, 0,
      true, true, 42220,
      'Prepared by Pasos de Jesús. Open content with license CC-BY Internacional 4.0.',
      '$COURSE_NAME',
      NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING
  \`.execute(db)

MIGEOF

for i in $(seq 1 "$NUM_GUIDES"); do
  GUIDE_NUM=$(printf "G%d" "$i")
  GUIDE_ID=$(($COURSE_ID * 100 + $i))
  cat >> "$MIGRATION_FILE" <<MIGEOF
  await sql\`
    INSERT INTO cor1440_gen_actividadpf (
      id, nombre, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, fecha, oficina_id,
      created_at, updated_at
    ) VALUES (
      $GUIDE_ID, '$COURSE_NAME Guide $i', '$COURSE_NAME — Guide $i',
      '$GUIDE_NUM', 'guide$i',
      $COURSE_ID, '$TODAY', 1,
      NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING
  \`.execute(db)

MIGEOF
done

cat >> "$MIGRATION_FILE" <<MIGEOF
}

export async function down(db: Kysely<any>): Promise<void> {
MIGEOF

for i in $(seq 1 "$NUM_GUIDES"); do
  GUIDE_ID=$(($COURSE_ID * 100 + $i))
  cat >> "$MIGRATION_FILE" <<MIGEOF
  await sql\`DELETE FROM cor1440_gen_actividadpf WHERE id = $GUIDE_ID\`.execute(db)
MIGEOF
done

cat >> "$MIGRATION_FILE" <<MIGEOF
  await sql\`DELETE FROM cor1440_gen_proyectofinanciero WHERE id = $COURSE_ID\`.execute(db)
}
MIGEOF

echo ""
echo "  Review the generated migration, then execute:"
echo "    bin/m db:migrate"
echo ""
echo "  Or manually in Rails admin:"
echo "    → https://learn.tg/admin"
echo "    → 'Proyectos Financieros': Título=$COURSE_NAME, Prefijo ruta=/$PREFIX, Idioma=en"

# ── Step 3: Vault + Credential ──

echo ""
echo "[3/5] Blockchain setup"

# Convert amounts to smallest units
USDT_RAW=$(echo "$USDT_AMOUNT * 1000000" | bc | cut -d. -f1)
SLEARN_RAW=$(echo "$SLEARN_AMOUNT * 100" | bc | cut -d. -f1)

echo ""
echo "  Create vault (run manually in apps/hardhat):"
echo "  bin/m wallet:send --name admin --to <VAULT_V4> --function \"createVault(uint256,uint256,uint256)\" --args \"$COURSE_ID,$USDT_RAW,$SLEARN_RAW\" --network $NETWORK"
echo ""

if [ -n "$ICON_PATH" ]; then
  ICON_FULL="public/img/credential/$ICON_PATH"
  echo "  Register credential type (run manually in apps/nextjs):"
  echo "  bin/m credentials:register-type --network $NETWORK --site learn.tg --type course_completion --display \"$COURSE_NAME\" --soulbound true --course-id $COURSE_ID --icon $ICON_FULL"
else
  echo "  Register credential type (run manually in apps/nextjs):"
  echo "  bin/m credentials:register-type --network $NETWORK --site learn.tg --type course_completion --display \"$COURSE_NAME\" --soulbound true --course-id $COURSE_ID"
fi

# ── Step 4: Sync ──

echo ""
echo "[4/5] Sync metadata (run manually in apps/nextjs):"
echo "  bin/m credentials:sync-cache --network $NETWORK"

echo ""
echo "========================================"
echo "  ✅ Course scaffold complete!"
echo ""
echo "  Next steps:"
echo "    1. Review migration: cat db/migrations/${MIGRATION_NAME}.ts"
echo "    2. Run migrations:  bin/m db:migrate"
echo "    3. Run the vault + credential commands above"
echo "    4. Write actual guide content in resources/{en,es}/$PREFIX/"
echo "    5. Verify: bin/m credentials:list-types --network $NETWORK"
echo "========================================"
