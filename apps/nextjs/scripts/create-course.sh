#!/bin/sh
# create-course.sh — Create a new learn.tg course with guides, vault, and SBT credential.
# Usage: ./scripts/create-course.sh "<Course Name>" <en|es> "<prefix>" <numGuides> "<usdtAmount>" "<slearnAmount>" ["<icon.svg>"] [<courseId>]
#
# Examples:
#   # English course, auto-generated ID:
#   ./scripts/create-course.sh "Global Disciples" en "global-disciples" 4 "1.0" "1.0"
#
#   # Spanish course with icon, auto ID:
#   ./scripts/create-course.sh "Discípulos Globales" es "discipulos-globales" 4 "1.0" "1.0" "source/global-disciples.svg"
#
#   # English course with icon + explicit ID:
#   ./scripts/create-course.sh "Global Disciples" en "global-disciples" 4 "1.0" "1.0" "source/global-disciples.svg" 5
#
# What this script does:
#   1. Creates guide directory structure in resources/<lang>/
#   2. Creates template .md files for each guide
#   3. Generates Kysely migration for course + guide DB records
#   4. Prints commands for vault, credential, and metadata sync
#
# Manual steps (see doc/how-to-create-a-course.md):
#   - Write actual guide content in the generated .md files
#   - Prepare SVG icon at public/img/credential/source/

set -e

COURSE_NAME="$1"
LANG="$2"
PREFIX="$3"
NUM_GUIDES="$4"
USDT_AMOUNT="$5"
SLEARN_AMOUNT="$6"

if [ -z "$COURSE_NAME" ] || [ -z "$LANG" ] || [ -z "$PREFIX" ] || [ -z "$NUM_GUIDES" ] || [ -z "$USDT_AMOUNT" ] || [ -z "$SLEARN_AMOUNT" ]; then
  echo "Usage: $0 <Course Name> <en|es> <prefix> <numGuides> <usdtPerGuide> <slearnPerGuide> [icon.svg] [courseId]"
  echo "Example: $0 \"Global Disciples\" en \"global-disciples\" 4 \"1.0\" \"1.0\""
  exit 1
fi

if [ "$LANG" != "en" ] && [ "$LANG" != "es" ]; then
  echo "Error: <lang> must be 'en' or 'es'"
  exit 1
fi

# Detect optional args: non-numeric = iconPath, numeric = courseId
COURSE_ID=""
ICON_PATH=""
for arg in "$7" "$8"; do
  if echo "$arg" | grep -qE '^[0-9]+$'; then
    COURSE_ID="$arg"
  elif [ -n "$arg" ]; then
    ICON_PATH="$arg"
  fi
done

NETWORK="${NEXT_PUBLIC_NETWORK:-celoSepolia}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$PROJECT_DIR/../../resources"

# Guide file prefix by language
if [ "$LANG" = "en" ]; then
  GUIDE_FILE_PREFIX="guide"
else
  GUIDE_FILE_PREFIX="guia"
fi

echo "========================================"
echo "  Creating course: $COURSE_NAME"
echo "  Language: $LANG"
if [ -n "$COURSE_ID" ]; then
  echo "  ID: $COURSE_ID (explicit)"
else
  echo "  ID: auto-generated"
fi
echo "  Prefix: $PREFIX"
echo "  Guides: $NUM_GUIDES | USDT: $USDT_AMOUNT | SLEARN: $SLEARN_AMOUNT"
echo "  Network: $NETWORK"
echo "========================================"

# ── Step 1: Guide directory structure ──

echo ""
echo "[1/5] Creating guide templates..."

GUIDE_DIR="$RESOURCES_DIR/$LANG/$PREFIX"
mkdir -p "$GUIDE_DIR"

for i in $(seq 1 "$NUM_GUIDES"); do
  GUIDE_FILE="$GUIDE_DIR/${GUIDE_FILE_PREFIX}${i}.md"

  if [ ! -f "$GUIDE_FILE" ]; then
    if [ "$LANG" = "en" ]; then
      cat > "$GUIDE_FILE" <<EOF
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
    else
      cat > "$GUIDE_FILE" <<EOF
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
    fi
    echo "  Created: $GUIDE_FILE"
  else
    echo "  Skipped: $GUIDE_FILE (exists)"
  fi
done

# ── Step 2: Generate Kysely migration for DB records ──

TODAY=$(date +%Y-%m-%d)
MIGRATION_TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATIONS_DIR="$PROJECT_DIR/db/migrations"
PREFIX_SAFE=$(echo "$PREFIX" | tr '-' '_')
if [ -n "$COURSE_ID" ]; then
  MIGRATION_NAME="${MIGRATION_TIMESTAMP}_create_course_${COURSE_ID}_${LANG}_${PREFIX_SAFE}"
else
  MIGRATION_NAME="${MIGRATION_TIMESTAMP}_create_course_${LANG}_${PREFIX_SAFE}"
fi
MIGRATION_FILE="$MIGRATIONS_DIR/${MIGRATION_NAME}.ts"

echo ""
echo "[2/5] Generating Kysely migration → db/migrations/${MIGRATION_NAME}.ts"

if [ -n "$COURSE_ID" ]; then
  # ── Explicit course ID: validate, insert, fix sequence ──
  cat > "$MIGRATION_FILE" <<MIGEOF
import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Verify ID is not already in use
  const existing = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select('id')
    .where('id', '=', $COURSE_ID)
    .executeTakeFirst()
  if (existing) {
    throw new Error('Course ID $COURSE_ID already exists. Choose a different ID or omit it for auto-generation.')
  }

  await sql\`
    INSERT INTO cor1440_gen_proyectofinanciero (
      id, nombre, titulo, subtitulo, idioma, "prefijoRuta",
      fechainicio, fechaformulacion, responsable_id, estado, dificultad,
      monto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej,
      "sinBilletera", "conBilletera", chain_id,
      "creditosMd", "resumenMd",
      created_at, updated_at
    ) VALUES (
      $COURSE_ID, '$COURSE_NAME', '$COURSE_NAME', '$COURSE_NAME',
      '$LANG', '/$PREFIX',
      '$TODAY', '$TODAY', 1, 'E', 'N',
      1.0, 1, 0, 0, 0, 0,
      true, true, 42220,
      'Prepared by Pasos de Jesús. Open content with license CC-BY Internacional 4.0.',
      '$COURSE_NAME',
      NOW(), NOW()
    )
  \`.execute(db)

  // Advance sequence past explicit ID
  await sql\`SELECT setval('cor1440_gen_proyectofinanciero_id_seq', GREATEST($COURSE_ID, (SELECT COALESCE(MAX(id), 0) FROM cor1440_gen_proyectofinanciero)))\`.execute(db)

  // Logical framework: 1 objective + 1 result (auto-generated IDs)
  const obj = await sql<{ id: number }>\`
    INSERT INTO cor1440_gen_objetivopf (proyectofinanciero_id, numero, objetivo)
    VALUES ($COURSE_ID, 'O1', '$COURSE_NAME')
    RETURNING id
  \`.execute(db)
  const objectiveId = obj.rows[0].id

  const res = await sql<{ id: number }>\`
    INSERT INTO cor1440_gen_resultadopf (proyectofinanciero_id, objetivopf_id, numero, resultado)
    VALUES ($COURSE_ID, \${objectiveId}, 'R1', '$COURSE_NAME')
    RETURNING id
  \`.execute(db)
  const resultId = res.rows[0].id

MIGEOF

  for i in $(seq 1 "$NUM_GUIDES"); do
    GUIDE_NUM=$(printf "G%d" "$i")
    GUIDE_ID=$(($COURSE_ID * 100 + $i))
    cat >> "$MIGRATION_FILE" <<MIGEOF
  await sql\`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      $GUIDE_ID, '$COURSE_NAME — Guide $i',
      '$GUIDE_NUM', 'guide$i',
      $COURSE_ID, \${resultId}
    )
  \`.execute(db)

MIGEOF
  done

  cat >> "$MIGRATION_FILE" <<MIGEOF
  // Advance actividadpf sequence past explicit IDs
  await sql\`SELECT setval('cor1440_gen_actividadpf_id_seq', GREATEST($(($COURSE_ID * 100 + $NUM_GUIDES)), (SELECT COALESCE(MAX(id), 0) FROM cor1440_gen_actividadpf)))\`.execute(db)
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
  await sql\`DELETE FROM cor1440_gen_resultadopf WHERE proyectofinanciero_id = $COURSE_ID\`.execute(db)
  await sql\`DELETE FROM cor1440_gen_objetivopf WHERE proyectofinanciero_id = $COURSE_ID\`.execute(db)
  await sql\`DELETE FROM cor1440_gen_proyectofinanciero WHERE id = $COURSE_ID\`.execute(db)
}
MIGEOF

else
  # ── Auto-generated course ID: let DB assign, return it ──
  cat > "$MIGRATION_FILE" <<MIGEOF
import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  const course = await sql<{ id: number }>\`
    INSERT INTO cor1440_gen_proyectofinanciero (
      nombre, titulo, subtitulo, idioma, "prefijoRuta",
      fechainicio, fechaformulacion, responsable_id, estado, dificultad,
      monto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej,
      "sinBilletera", "conBilletera", chain_id,
      creditosMd, resumenMd,
      created_at, updated_at
    ) VALUES (
      '$COURSE_NAME', '$COURSE_NAME', '$COURSE_NAME',
      '$LANG', '/$PREFIX',
      '$TODAY', '$TODAY', 1, 'E', 'N',
      1.0, 1, 0, 0, 0, 0,
      true, true, 42220,
      'Prepared by Pasos de Jesús. Open content with license CC-BY Internacional 4.0.',
      '$COURSE_NAME',
      NOW(), NOW()
    )
    RETURNING id
  \`.execute(db)
  const courseId = course.rows[0].id
  console.log('[create-course] Generated course ID:', courseId)

  // Logical framework: 1 objective + 1 result
  const obj = await sql<{ id: number }>\`
    INSERT INTO cor1440_gen_objetivopf (proyectofinanciero_id, numero, objetivo)
    VALUES (\${courseId}, 'O1', '$COURSE_NAME')
    RETURNING id
  \`.execute(db)
  const objectiveId = obj.rows[0].id

  const res = await sql<{ id: number }>\`
    INSERT INTO cor1440_gen_resultadopf (proyectofinanciero_id, objetivopf_id, numero, resultado)
    VALUES (\${courseId}, \${objectiveId}, 'R1', '$COURSE_NAME')
    RETURNING id
  \`.execute(db)
  const resultId = res.rows[0].id

MIGEOF

  for i in $(seq 1 "$NUM_GUIDES"); do
    GUIDE_NUM=$(printf "G%d" "$i")
    cat >> "$MIGRATION_FILE" <<MIGEOF
  await sql\`
    INSERT INTO cor1440_gen_actividadpf (
      titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      '$COURSE_NAME — Guide $i',
      '$GUIDE_NUM', 'guide$i',
      \${courseId}, \${resultId}
    )
  \`.execute(db)

MIGEOF
  done

  cat >> "$MIGRATION_FILE" <<'MIGEOF'
}

export async function down(db: Kysely<any>): Promise<void> {
  const course = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select('id')
    .where('prefijoRuta', '=', '/$PREFIX')
    .where('idioma', '=', '$LANG')
    .executeTakeFirst()

  if (course) {
    await sql`DELETE FROM cor1440_gen_actividadpf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_resultadopf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_objetivopf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_proyectofinanciero WHERE id = ${course.id}`.execute(db)
  }
}
MIGEOF

  # Expand $PREFIX and $LANG in the quoted heredoc
  sed -i "s|/\\\$PREFIX|/$PREFIX|g" "$MIGRATION_FILE"
  sed -i "s|\\\$LANG|$LANG|g" "$MIGRATION_FILE"
fi

echo ""
echo "  Review the generated migration, then execute:"
echo "    bin/m db:migrate"
if [ -n "$COURSE_ID" ]; then
  echo ""
  echo "  Course ID: $COURSE_ID (explicit — sequence auto-adjusted)"
else
  echo ""
  echo "  Course ID: auto-generated (check migration output after running)"
  echo "  Use the printed ID for the vault + credential commands below."
fi

# ── Step 3: Vault + Credential ──

echo ""
echo "[3/5] Blockchain setup"

# Convert amounts to smallest units
USDT_RAW=$(echo "$USDT_AMOUNT * 1000000" | bc | cut -d. -f1)
SLEARN_RAW=$(echo "$SLEARN_AMOUNT * 100" | bc | cut -d. -f1)

echo ""
if [ -n "$COURSE_ID" ]; then
  echo "  Create vault (run manually in apps/hardhat):"
  echo "  bin/m wallet:send --name admin --to <VAULT_V4> --function \"createVault(uint256,uint256,uint256)\" --args \"$COURSE_ID,$USDT_RAW,$SLEARN_RAW\" --network $NETWORK"
else
  echo "  Create vault (run manually in apps/hardhat — replace <ID> with actual course ID):"
  echo "  bin/m wallet:send --name admin --to <VAULT_V4> --function \"createVault(uint256,uint256,uint256)\" --args \"<ID>,$USDT_RAW,$SLEARN_RAW\" --network $NETWORK"
fi
echo ""

if [ -n "$ICON_PATH" ]; then
  ICON_FULL="public/img/credential/$ICON_PATH"
  echo "  Register credential type (run manually in apps/nextjs):"
  if [ -n "$COURSE_ID" ]; then
    echo "  bin/m credentials:register-type --network $NETWORK --site learn.tg --type course_completion --display \"$COURSE_NAME\" --soulbound true --course-id $COURSE_ID --icon $ICON_FULL"
  else
    echo "  bin/m credentials:register-type --network $NETWORK --site learn.tg --type course_completion --display \"$COURSE_NAME\" --soulbound true --course-id <ID> --icon $ICON_FULL"
  fi
else
  echo "  Register credential type (run manually in apps/nextjs):"
  if [ -n "$COURSE_ID" ]; then
    echo "  bin/m credentials:register-type --network $NETWORK --site learn.tg --type course_completion --display \"$COURSE_NAME\" --soulbound true --course-id $COURSE_ID"
  else
    echo "  bin/m credentials:register-type --network $NETWORK --site learn.tg --type course_completion --display \"$COURSE_NAME\" --soulbound true --course-id <ID>"
  fi
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
echo "    4. Write actual guide content in resources/$LANG/$PREFIX/"
echo "    5. Verify: bin/m credentials:list-types --network $NETWORK"
echo "========================================"
