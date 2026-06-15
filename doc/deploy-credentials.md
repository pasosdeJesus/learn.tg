# Credential Deployment (SBTs) on learn.tg

> "Whatever you do, work at it with all your heart, as working for the Lord,
> not for human masters." (Colossians 3:23)

## Prerequisites

1. `PasosDeJesusCredentials` contract deployed and verified on Celo / Celo Sepolia
   (see [R-#26](https://github.com/pasosdeJesus/sivel3/issues/26)).
2. Deployment files in `apps/hardhat/deployments/PasosDeJesusCredentials/`
   (`celo.json`, `celoSepolia.json`, etc.).
3. `@pasosdejesus/m` >= 0.5.3 installed (`apps/nextjs/node_modules/@pasosdejesus/m`).
4. Wallet with `MINTER_ROLE` on the contract for `credentials:register-type`
   (the `PRIVATE_KEY` env variable in `.env`).

---

## 1. Prepare SVG Course Icons

### 1.1 Create source directory

```bash
mkdir -p apps/nextjs/public/img/credential/source
```

### 1.2 Current courses and their images

| id  | Course                       | Current image                          | Size   | Location |
|-----|-----------------------------|----------------------------------------|----------|-----------|
| 1   | Una relación con Jesús      | `/img/Jn6_col.jpg`                     | 59 KB    | `public/img/Jn6_col.jpg` |
| 2   | A relationship with Jesus   | `/img/Jn6_col.jpg`                     | 59 KB    | same image as id=1 |
| 102 | goodDollar                  | `/en/gooddollar/gooddollar-darkblue.png`| —      | not on local disk |
| 103 | Web3 & UBI                  | `/img/2025/web3_ubi.png`              | 48 KB    | `public/img/2025/web3_ubi.png` |
| 104 | Ahorra en dólares en OKX    | `/img/OKX_Logo.svg`                   | 3.5 KB   | `public/img/OKX_Logo.svg` |

### 1.3 Convert to 512×512 SVG and use as course covers

Each 512×512 SVG icon will serve **two purposes**:

1. **SBT image** — composed by `composeCredentialImage()` with border, logo, lock, star
2. **Course cover on `/[lang]/[pathPrefix]`** — replacing the current JPG/PNG on the course page

For purpose 2, just update the `imagen` field in `cor1440_gen_proyectofinanciero` to point to the SVG:

- **Format:** SVG with `viewBox="0 0 512 512"`
- **No** `<script>`, `foreignObject`, external URLs, `data:image/svg+xml`
- Content between 50 and 50000 characters

| SVG file to create                                    | From                                        |
|------------------------------------------------------|----------------------------------------------|
| `public/img/credential/source/relacion-con-jesus.svg`| `public/img/Jn6_col.jpg`                     |
| `public/img/credential/source/gooddollar.svg`        | download from `https://learn.tg/en/gooddollar/gooddollar-darkblue.png` |
| `public/img/credential/source/web3-and-ubi.svg`      | `public/img/2025/web3_ubi.png`              |
| `public/img/credential/source/ahorra-en-okx.svg`     | `public/img/OKX_Logo.svg`                   |

#### Conversion methods

**With Inkscape (recommended):**

```bash
# For JPG/PNG
inkscape public/img/Jn6_col.jpg \
  --export-plain-svg \
  --export-filename=public/img/credential/source/relacion-con-jesus.svg

# Then edit SVG to ensure viewBox="0 0 512 512"
```

**With ImageMagick (basic silhouettes):**

```bash
convert public/img/Jn6_col.jpg \
  -resize 512x512 \
  public/img/credential/source/relacion-con-jesus.svg
```

**For OKX_Logo.svg (resize):**

The current file has `viewBox="0 0 84 84"`. Wrap in a 512×512 SVG:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(214,214) scale(1)">
    <!-- original OKX_Logo.svg content -->
  </g>
</svg>
```

### 1.4 Update course covers

Once the SVGs are created, update the `imagen` field in the database so
`/[lang]/` shows the new vector images instead of the current JPG/PNG:

```sql
-- Course 1/2: Una relación con Jesús
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/relacion-con-jesus.svg'
WHERE id IN (1, 2);

-- Course 103: Web3 & UBI
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/web3-and-ubi.svg'
WHERE id = 103;

-- Course 104: Ahorra en dólares en OKX
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/ahorra-en-okx.svg'
WHERE id = 104;

-- Course 102: goodDollar
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/gooddollar.svg'
WHERE id = 102;
```

**Advantages of using SVGs as covers:**
- ~10× lighter than JPG/PNG (2-5 KB vs 48-59 KB)
- Sharp at any resolution (`object-cover` on `<Image>` scales without loss)
- Same source files as SBTs — single maintenance point

---

## 2. Register Credential Types on the Contract

Each premium course that issues credentials must be registered exactly once.
`tokenId` is assigned sequentially by the contract.

```bash
cd apps/nextjs

# Course 1 — Una relación con Jesús (free)
bin/m credentials:register-type \
  --network celoSepolia \
  --site learn.tg \
  --type course_completion \
  --display "Una relación con Jesús" \
  --soulbound true \
  --course-id 1 \
  --icon public/img/credential/source/relacion-con-jesus.svg

# Course 103 — Web3 & UBI (free)
bin/m credentials:register-type \
  --network celoSepolia \
  --site learn.tg \
  --type course_completion \
  --display "Web3 & UBI" \
  --soulbound true \
  --course-id 103 \
  --icon public/img/credential/source/web3-and-ubi.svg

# Course 104 — Ahorra en dólares en OKX (free)
bin/m credentials:register-type \
  --network celoSepolia \
  --site learn.tg \
  --type course_completion \
  --display "Ahorra en dólares en OKX" \
  --soulbound true \
  --course-id 104 \
  --icon public/img/credential/source/ahorra-en-okx.svg
```

**Notes:**

- `--course-id` must match the `id` from `cor1440_gen_proyectofinanciero`.
- `--premium` is omitted for free courses. Add `--premium` if `porPagar > 0`.
- `--icon` triggers `composeCredentialImage()` which generates the composite SVG and
  PNG at `public/img/credential/{tokenId}.png`.
- The site logo (`logo-learntg.svg`) and PdJ badge are included
  in `@pasosdejesus/m` as fallback.
- If the wallet lacks `MINTER_ROLE`, registration will fail with
  `AccessControlUnauthorizedAccount`.

---

## 3. Sync Metadata Cache

After registering types, sync the `credential_metadata` table:

```bash
cd apps/nextjs
bin/m credentials:sync-cache --network celoSepolia
```

This reads the contract and updates `credential_metadata` with `name`, `type`,
`site`, `is_premium`, `is_soulbound`, and `image_url` for each `tokenId`.

---

## 4. Set Site Base URI

So wallets and explorers can resolve metadata:

```bash
bin/m credentials:set-site-uri \
  --network celoSepolia \
  --site learn.tg \
  --uri "https://learn.tg/api/credential"
```

> Requires `DEFAULT_ADMIN_ROLE` on the contract (deployer only).

---

## 5. Verify

```bash
# List registered types
bin/m credentials:list-types --network celoSepolia

# Verify metadata endpoint
curl https://learn.tg/api/credential/14.json
# (replace 14 with the assigned tokenId)

# Verify wallet endpoint
curl https://learn.tg/api/credential/wallet/0x...
```

---

## 6. Automatic Minting

Minting happens automatically in `app/api/check-crossword/route.ts` when
a student completes 100% of a course's guides. The flow:

1. Detects `percentagecompleted >= 100`
2. Checks `credential_emission` (off-chain) to prevent duplicates
3. Calls `mintCourseSBT()` from `@pasosdejesus/m/blockchain`
4. Records in `credential_emission` with `usuario_id`, `course_id`,
   `token_id`, `chain_id`, `is_premium`, `hash`

---

## 7. Additional Commands

```bash
# Recompose image for an existing token
bin/m credentials:recompose-image \
  --token-id 14 \
  --network celoSepolia \
  --icon public/img/credential/source/new-icon.svg

# Grant MINTER_ROLE to a wallet (requires DEFAULT_ADMIN_ROLE)
bin/m credentials:grant-minter \
  --network celoSepolia \
  --address 0x...

# Revoke credential
bin/m credentials:revoke-credential \
  --network celoSepolia \
  --token-id 14 \
  --address 0x...

# Set max supply
bin/m credentials:set-max-supply \
  --network celoSepolia \
  --token-id 14 \
  --max 1000
```

---

## References

- [I130.md](../I130.md) — Credential integration issue
- [R-#26](https://github.com/pasosdeJesus/sivel3/issues/26) — PasosDeJesusCredentials contract
- [R-#33](https://github.com/pasosdeJesus/sivel3/issues/33) — `@pasosdejesus/m/blockchain` library
- [`@pasosdejesus/m/src/blockchain/README.md`](../apps/nextjs/node_modules/@pasosdejesus/m/src/blockchain/README.md)
