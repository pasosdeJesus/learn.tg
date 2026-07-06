# How to Create a New Course on learn.tg

> *"The beginning of wisdom is this: Get wisdom. Though it cost all you have, get understanding."* (Proverbs 4:7)

A step-by-step guide to creating a fully functional course with scholarships (USDT + SLEARN) and an SBT credential badge. The `create-course.sh` script automates the technical scaffolding — you focus on content.

---

## Overview

| Step | Where | What | Automated? |
|------|-------|------|------------|
| 0 | `scripts/create-course.sh` | Generate guide templates + DB SQL | ✅ |
| 1 | `tmp/` (SQL file) | Execute DB records for course + guides | ⚠️ Review then run |
| 2 | `resources/` | Write guide content (Markdown) | ❌ Manual |
| 3 | Smart Contract | Create vault with scholarship amounts | ⚠️ Review then run |
| 4 | `public/img/` | Prepare 512×512 SVG icon | ❌ Manual |
| 5 | Smart Contract | Register credential type | ⚠️ Review then run |
| 6 | `bin/m` | Sync credential metadata cache | ⚠️ Review then run |

> **Why "review then run"?** On-chain operations (vault, credential) are printed by the script, not auto-executed. A human reviews before running. No script should move funds or register credentials without verification.

---

## 0. Run the Course Creation Script

```bash
cd apps/nextjs

./scripts/create-course.sh "Global Disciples" 5 "global-disciples" 4 "1.0" "1.0" "source/global-disciples.svg"
```

This generates:
- Guide templates in `resources/{en,es}/`
- SQL file at `tmp/create-course-5.sql` with course + guide records
- Commands for vault creation, credential registration, and metadata sync

---

## 1. Create Course and Guides (Database)

### 1.1 Review and execute the generated SQL

```bash
# Review the SQL first
cat tmp/create-course-5.sql

# Execute it
bin/m db:console < tmp/create-course-5.sql
```

The SQL inserts into `cor1440_gen_proyectofinanciero` (course) and `cor1440_gen_actividadpf` (guides) with auto-calculated IDs.

> **Bilingual courses**: The SQL generates an English (`idioma='en'`) course record. For Spanish, manually create a second record with `idioma='es'` and the Spanish prefix.

### 1.2 Course record fields

| Field | Example | Notes |
|-------|---------|-------|
| **Título** | *Tools to Bring Global Disciples* | Course display name |
| **Prefijo ruta** | `global-disciples` | URL path (lowercase, hyphens) |
| **Idioma** | `en` or `es` | Language for this course instance |
| **Por pagar** | `0` (free) or `> 0` (premium) | Premium courses require SLEARN payment |

### 1.3 Guide record fields

| Field | Example (EN) | Notes |
|-------|-------------|-------|
| **Proyecto financiero** | Course ID | Links guide to course |
| **Título** | *What is Global Disciples?* | Display name |
| **Nombre corto** | `guide1` | Used for ordering (alphabetical) |
| **Sufijo ruta** | `guide1` | URL segment + Markdown file name |

> **Important**: `sufijoRuta` **must** be non-empty for published guides. `nombrecorto` determines the order in the crossword validation API.

---

## 2. Write Guide Content (Markdown)

Guides live in `resources/{lang}/{prefijoRuta}/` and use the pedagogy of service (5 pillars: Focus, Brevity, Action, Joyful Engagement, Accessible Tone).

### 2.1 Directory structure

```
resources/
  en/
    global-disciples/
      guide1.md    ← What is Global Disciples?
      guide2.md    ← Form Your Cluster
      guide3.md    ← Fund Your Cluster Mission
      guide4.md    ← Sustain and Grow
  es/
    discipulos-globales/
      guia1.md     ← ¿Qué es Global Disciples?
      guia2.md     ← Forma tu Clúster
      guia3.md     ← Financia tu Misión de Clúster
      guia4.md     ← Sostén y Crece
```

> The file name must match `sufijoRuta` exactly — no `.md.md` extension.

### 2.2 Guide format

Each guide should be **400-600 words** (~5-7 minutes to complete). Structure:

```markdown
# Guide Title

## Introduction
Brief hook (1-2 sentences). Connect to the learner's context.

## Core Content
2-4 short sections with clear headings. Use:
- Short paragraphs
- Bullets for lists
- **Bold** for key terms
- Emojis sparingly for joyful tone (😊 🙏 🌍)

## Action Step
A practical takeaway the learner can implement immediately.

## Reflection
(Optional) Personal application question.

---

## Crossword Puzzle (Comprehension Questions)
3-5 questions that test understanding. Each answer becomes a cell
in the crossword grid the student fills in.

Answers are stored as pipe-separated text in `billetera_usuario.answer_fib`
(e.g., `Jesus | love | Sierra Leone`).
```

### 2.3 Crossword Puzzle

Each guide must include **3-5 comprehension questions** that form the crossword puzzle assessment. Answers are pipe-separated text stored in `billetera_usuario.answer_fib` by the Rails backend after guide viewing.

Example:
```
Jesus | love | Sierra Leone | disciple | cluster
```

### 2.4 Content guidelines

| Pillar | Application |
|--------|------------|
| **Focus** | One clear learning objective per guide |
| **Brevity** | 400-600 words, completable in ~7 minutes |
| **Action** | Every guide ends with a concrete action |
| **Joyful** | Informal, relational tone. Use emojis sparingly for warmth |
| **Accessible** | Simple language, short sentences, avoid jargon |

---

## 3. Create Vault with Scholarship Amounts

Each course needs a vault on the `LearnTGVaultsV4` contract that defines how much USDT and SLEARN students earn per completed guide.

### 3.1 Create the vault

```bash
cd apps/hardhat

# Amounts in smallest units: USDT = 6 decimals, SLEARN = 2 decimals
# Example: 1.0 USDT + 1.0 SLEARN per guide for course ID 5
bin/m wallet:send --name admin --to <VAULT_V4> \
  --function "createVault(uint256,uint256,uint256)" \
  --args "5,1000000,100"
```

### 3.2 Set per-guide amounts (if vault already exists)

```bash
bin/m wallet:send --name admin --to <VAULT_V4> \
  --function "setAmountPerGuide(uint256,uint256,uint256)" \
  --args "5,1000000,100"
```

> See `doc/runbook.md` §4 for full vault commands.

---

## 4. Prepare SBT Icon (SVG 512×512)

Each course needs a 512×512 SVG icon for the credential badge and course cover.

### 4.1 Create the source SVG

Place in `apps/nextjs/public/img/credential/source/`:

```bash
mkdir -p apps/nextjs/public/img/credential/source

# If converting from JPG/PNG:
inkscape source.jpg --export-plain-svg \
  --export-filename=apps/nextjs/public/img/credential/source/global-disciples.svg
```

### 4.2 Requirements

- `viewBox="0 0 512 512"`
- No `<script>`, `foreignObject`, external URLs
- 50–50,000 characters

---

## 5. Register Credential Type on Contract

Register the SBT credential type on the `PasosDeJesusCredentials` contract:

```bash
cd apps/nextjs

bin/m credentials:register-type \
  --network celo \
  --site learn.tg \
  --type course_completion \
  --display "Global Disciples Advocate" \
  --soulbound true \
  --course-id 5 \
  --icon public/img/credential/source/global-disciples.svg
```

For premium courses, add `--premium`.

---

## 6. Sync Metadata Cache

```bash
cd apps/nextjs
bin/m credentials:sync-cache --network celo
```

---

## 7. Verify

```bash
# List registered credential types — find your tokenId
bin/m credentials:list-types --network celo

# Verify metadata endpoint
curl https://learn.tg/api/credential/{tokenId}

# Check vault exists and has correct amounts
bin/m wallet:call --name admin --to <VAULT_V4> \
  --function "vaults(uint256)" --args "5" --network celo
```

---

## Quick Reference

| What | Where | Command/Example |
|------|-------|----------------|
| Scaffold course | `scripts/create-course.sh` | `./scripts/create-course.sh "Name" 5 "prefix" 4 "1.0" "1.0" "icon.svg"` |
| Course + guide records | SQL file → `bin/m db:console` | Review then execute |
| Guide content | `resources/{lang}/{prefijoRuta}/{sufijoRuta}.md` | 400-600 words, 3-5 crossword questions |
| Vault | `LearnTGVaultsV4.createVault(id, usdt, slearn)` | `bin/m wallet:send` (review first) |
| SBT icon | `public/img/credential/source/` | 512×512 SVG |
| Credential type | `PasosDeJesusCredentials.registerCredentialType` | `bin/m credentials:register-type` (review first) |
| Metadata sync | DB `credential_metadata` | `bin/m credentials:sync-cache` |

---

> *"Whatever you do, work at it with all your heart, as working for the Lord."* (Colossians 3:23)
