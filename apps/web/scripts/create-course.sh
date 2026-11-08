#!/bin/sh
# create-course.sh — Create a new learn.tg course with guides, vault, and SBT credential.
# Usage: ./scripts/create-course.sh "<Course Name>" <en|es> "<prefix>" <numGuides> "<usdtAmount>" "<slearnAmount>" ["<icon.svg>"] [<courseId>] [--price <usd>] [--token-id <n>]
#
#   --price <usd>     price of the course → `porPagar`; the credential metadata becomes
#                     premium when it is greater than 0 (today nothing else set it)
#   --token-id <n>    id of the credential type on chain (ERC-1155). The generated
#                     migration creates the `credential_metadata` row with `course_id`
#                     and `is_premium`; without it, the migration still links an existing
#                     row by the course title.
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
#   # Paid course with the credential token id known:
#   ./scripts/create-course.sh "Global Disciples" en "global-disciples" 6 "1.0" "5.0" "source/gdcluster.svg" --price 120 --token-id 13
#
# What this script does:
#   1. Creates guide directory structure in resources/<lang>/
#   2. Creates template .md files for each guide
#   3. Generates Kysely migration for course + guide DB records, plus the credential
#      metadata link (`course_id`, `is_premium`)
#   4. Prints the vault command and the credential registration note
#
# Manual steps (see doc/how-to-create-a-course.md):
#   - Write actual guide content in the generated .md files
#   - Prepare SVG icon at public/img/credential/source/

set -e

# ── Opciones con nombre (se quitan antes de leer los posicionales) ──
#   --price <usd>     precio del curso → `porPagar` (vacío o 0 = gratuito)
#   --token-id <n>    id del tipo de credencial en la cadena (ERC-1155); con él la
#                     migración crea o corrige la fila de `credential_metadata`
PRICE=""
TOKEN_ID=""
POSITIONAL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --price) PRICE="$2"; shift 2 ;;
    --price=*) PRICE="${1#--price=}"; shift ;;
    --token-id) TOKEN_ID="$2"; shift 2 ;;
    --token-id=*) TOKEN_ID="${1#--token-id=}"; shift ;;
    --*)
      echo "Error: opción desconocida: $1"
      exit 1
      ;;
    *)
      POSITIONAL="$POSITIONAL
$1"
      shift
      ;;
  esac
done
# Reasigna posicionales: sin esto `--price` ocupaba el lugar del icono o del id.
OLD_IFS="$IFS"
IFS='
'
set -- $POSITIONAL
IFS="$OLD_IFS"

COURSE_NAME="$1"
LANG="$2"
PREFIX="$3"
NUM_GUIDES="$4"
USDT_AMOUNT="$5"
SLEARN_AMOUNT="$6"

if [ -z "$COURSE_NAME" ] || [ -z "$LANG" ] || [ -z "$PREFIX" ] || [ -z "$NUM_GUIDES" ] || [ -z "$USDT_AMOUNT" ] || [ -z "$SLEARN_AMOUNT" ]; then
  echo "Usage: $0 <Course Name> <en|es> <prefix> <numGuides> <usdtPerGuide> <slearnPerGuide> [icon.svg] [courseId] [--price <usd>] [--token-id <n>]"
  echo "Example: $0 \"Global Disciples\" en \"global-disciples\" 4 \"1.0\" \"1.0\""
  exit 1
fi

if [ "$LANG" != "en" ] && [ "$LANG" != "es" ]; then
  echo "Error: <lang> must be 'en' or 'es'"
  exit 1
fi

# Optional positionals: non-numeric = iconPath, numeric = courseId
COURSE_ID=""
ICON_PATH=""
for arg in "$7" "$8"; do
  if echo "$arg" | grep -qE '^[0-9]+$'; then
    COURSE_ID="$arg"
  elif [ -n "$arg" ]; then
    ICON_PATH="$arg"
  fi
done

if [ -n "$PRICE" ] && ! echo "$PRICE" | grep -qE '^[0-9]+(\.[0-9]+)?$'; then
  echo "Error: --price debe ser un número (por ejemplo 50 o 12.5)"
  exit 1
fi
if [ -n "$TOKEN_ID" ] && ! echo "$TOKEN_ID" | grep -qE '^[0-9]+$'; then
  echo "Error: --token-id debe ser un entero"
  exit 1
fi

NETWORK="${NEXT_PUBLIC_NETWORK:-celoSepolia}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$PROJECT_DIR/../../resources"

# La columna `credential_metadata.chain_id` es el nombre de la red, no el número:
# `celo` en producción y `celoSepolia` en desarrollo.
case "$NETWORK" in
  celo|mainnet) CHAIN_LABEL="celo" ;;
  *) CHAIN_LABEL="celoSepolia" ;;
esac

# `porPagar` (precio del curso en USD) es lo que decide `is_premium` en el metadato.
if [ -n "$PRICE" ]; then
  POR_PAGAR_SQL="$PRICE"
else
  POR_PAGAR_SQL="NULL"
fi
if [ -n "$TOKEN_ID" ]; then
  if [ -n "$ICON_PATH" ]; then
    IMAGE_URL="img/credential/$ICON_PATH"
  else
    IMAGE_URL="img/credential/$TOKEN_ID.png"
  fi
  IS_PREMIUM_SQL="($POR_PAGAR_SQL)::double precision > 0"
else
  IMAGE_URL=""
  IS_PREMIUM_SQL="false"
fi

# Bloque del metadato de la credencial: deja `course_id` e `is_premium` correctos y,
# con `--token-id`, crea o corrige la fila del tipo de credencial (el `token_id` lo
# asigna la cadena al registrar el tipo).
emit_credential_link() {
  cat <<MIGEOF

  // Metadato de la credencial del curso (R-#161 §12): \`course_id\` e \`is_premium\`
  // salen del curso que se acaba de crear (columna porPagar), nunca a mano.
  await sql\`
    UPDATE credential_metadata
       SET course_id = (SELECT id FROM cor1440_gen_proyectofinanciero
                         WHERE "prefijoRuta" = '/$PREFIX' AND idioma = '$LANG'
                         ORDER BY id DESC LIMIT 1),
           is_premium = COALESCE((SELECT "porPagar" FROM cor1440_gen_proyectofinanciero
                                   WHERE "prefijoRuta" = '/$PREFIX' AND idioma = '$LANG'
                                   ORDER BY id DESC LIMIT 1), 0) > 0,
           updated_at = now()
     WHERE type = 'course_completion'
       AND site = 'learn.tg'
       AND public.unaccent(lower(btrim(name))) = public.unaccent(lower(btrim('$COURSE_NAME')))
  \`.execute(db)
MIGEOF
  if [ -n "$TOKEN_ID" ]; then
    cat <<MIGEOF

  // Con \`--token-id\`: la fila del metadato existe aunque el tipo se registre después.
  await sql\`
    INSERT INTO credential_metadata (
      token_id, chain_id, name, type, site, is_premium, is_soulbound, image_url,
      course_id, updated_at
    ) VALUES (
      $TOKEN_ID, '$CHAIN_LABEL', '$COURSE_NAME', 'course_completion', 'learn.tg',
      COALESCE((SELECT "porPagar" FROM cor1440_gen_proyectofinanciero
                 WHERE "prefijoRuta" = '/$PREFIX' AND idioma = '$LANG'
                 ORDER BY id DESC LIMIT 1), 0) > 0,
      true, '$IMAGE_URL',
      (SELECT id FROM cor1440_gen_proyectofinanciero
        WHERE "prefijoRuta" = '/$PREFIX' AND idioma = '$LANG' ORDER BY id DESC LIMIT 1),
      now()
    )
    ON CONFLICT (token_id, chain_id) DO UPDATE
       SET name = EXCLUDED.name,
           is_premium = EXCLUDED.is_premium,
           course_id = EXCLUDED.course_id,
           updated_at = now()
  \`.execute(db)
MIGEOF
  fi
}

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
if [ -n "$PRICE" ]; then
  echo "  Price: $PRICE USD per student (porPagar — the credential metadata is premium)"
else
  echo "  Price: free (porPagar NULL)"
fi
if [ -n "$TOKEN_ID" ]; then
  echo "  Credential token id: $TOKEN_ID ($CHAIN_LABEL)"
fi
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

> TODO: Write guide content (400-700 words).
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

> TODO: Escribir contenido de la guía (400-700 palabras).
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
      "sinBilletera", "conBilletera", chain_id, "porPagar",
      "creditosMd", "resumenMd",
      created_at, updated_at
    ) VALUES (
      $COURSE_ID, '$COURSE_NAME', '$COURSE_NAME', '$COURSE_NAME',
      '$LANG', '/$PREFIX',
      '$TODAY', '$TODAY', 1, 'E', 'N',
      1.0, 1, 0, 0, 0, 0,
      true, true, 42220, $POR_PAGAR_SQL,
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
MIGEOF

  emit_credential_link >> "$MIGRATION_FILE"

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
      "sinBilletera", "conBilletera", chain_id, "porPagar",
      "creditosMd", "resumenMd",
      created_at, updated_at
    ) VALUES (
      '$COURSE_NAME', '$COURSE_NAME', '$COURSE_NAME',
      '$LANG', '/$PREFIX',
      '$TODAY', '$TODAY', 1, 'E', 'N',
      1.0, 1, 0, 0, 0, 0,
      true, true, 42220, $POR_PAGAR_SQL,
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

  emit_credential_link >> "$MIGRATION_FILE"

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
  echo "  Create vault (run manually in apps/contracts):"
  echo "  bin/m eng:opwallet:send --name admin --to <VAULT_V5> --function \"createVault(uint256,uint256,uint256)\" --args \"$COURSE_ID,$USDT_RAW,$SLEARN_RAW\" --network $NETWORK"
else
  echo "  Create vault (run manually in apps/contracts — replace <ID> with actual course ID):"
  echo "  bin/m eng:opwallet:send --name admin --to <VAULT_V5> --function \"createVault(uint256,uint256,uint256)\" --args \"<ID>,$USDT_RAW,$SLEARN_RAW\" --network $NETWORK"
fi
echo ""

# `eng:credentials:*` viene del plugin mpdj y sólo se registra cuando existe
# apps/contracts/deployments/PasosDeJesusCredentials/ (gitignoreada: en un clon sin
# despliegues la orden no aparece). `--course-id` es lo que liga el metadato al curso y
# `--premium` enciende el atributo "Premium" (por eso se pasa cuando --price > 0).
CRED_COURSE_ID="${COURSE_ID:-<ID>}"
CRED_PREMIUM=""
if [ -n "$PRICE" ] && [ "$PRICE" != "0" ]; then
  CRED_PREMIUM=" --premium"
fi
CRED_ICON=""
if [ -n "$ICON_PATH" ]; then
  CRED_ICON=" --icon public/img/credential/$ICON_PATH"
fi

echo "  Register credential type (mpdj; needs apps/contracts/deployments/PasosDeJesusCredentials/):"
echo "  bin/m eng:credentials:register-type --network $NETWORK --site learn.tg --type course_completion --display "$COURSE_NAME" --soulbound true --course-id $CRED_COURSE_ID$CRED_PREMIUM$CRED_ICON"
if [ -z "$COURSE_ID" ]; then
  echo "  (use the course id printed by the migration instead of <ID>)"
fi
if [ -n "$TOKEN_ID" ]; then
  echo "  If the credential token is $TOKEN_ID, the migration already wrote its metadata row."
fi

# ── Step 4: Credential metadata ──

echo ""
echo "[4/5] Sync metadata cache (mpdj)"
echo "  bin/m eng:credentials:sync-cache --network $NETWORK"
echo ""
echo "  The scaffold migration already links the metadata (course_id e is_premium desde"
echo "  porPagar); sync-cache lo refresca desde la cadena y no hace falta si se registró"
echo "  con --course-id y --premium."

echo ""
echo "========================================"
echo "  Course scaffold complete"
echo ""
echo "  Next steps:"
echo "    1. Review migration: cat db/migrations/${MIGRATION_NAME}.ts"
echo "    2. Run migrations:  bin/m db:migrate"
echo "    3. Run the vault command above and register the credential type on chain"
echo "    4. bin/m eng:credentials:list-types --network $NETWORK   (find the token id)"
echo "    5. Write actual guide content in resources/$LANG/$PREFIX/"
echo "    6. Verify the metadata: bin/m db:console \"SELECT token_id, name, is_premium, course_id FROM credential_metadata WHERE type = 'course_completion' ORDER BY token_id\""
echo "========================================"
