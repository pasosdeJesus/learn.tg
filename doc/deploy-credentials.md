# Credential Deployment (SBTs) on learn.tg

> "Whatever you do, work at it with all your heart, as working for the Lord,
> not for human masters." (Colossians 3:23)

## Prerequisites

1. `PasosDeJesusCredentials` contract deployed and verified on Celo / Celo Sepolia
   (see [R-#26](https://github.com/pasosdeJesus/sivel3/issues/26)).
2. Deployment files in `apps/contracts/deployments/PasosDeJesusCredentials/`
   (`celo.json`, `celoSepolia.json`, etc.).
3. `@pasosdejesus/m` >= 0.5.3 installed (`apps/web/node_modules/@pasosdejesus/m`).
4. Wallet with `MINTER_ROLE` on the contract for `credentials:register-type`
   (the `PRIVATE_KEY` env variable in `.env`).

---

## 1. Prepare SVG Course Icons

### 1.1 Create source directory

```bash
mkdir -p apps/web/public/img/credential/source
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

| SVG icon in `public/img/credential/source/`           | From                                        |
|------------------------------------------------------|----------------------------------------------|
| `relacion-con-Jesus.svg`                             | `public/img/Jn6_col.jpg` (ES course 1)      |
| `a-relationship-with-Jesus.svg`                      | `public/img/Jn6_col.jpg` (EN course 2)      |
| `web3_ubi.svg`                                       | `public/img/2025/web3_ubi.png`              |
| `ahorra-en-okx.svg`                                  | `public/img/OKX_Logo.svg`                   |
| `gdcluster.svg`                                      | Global Disciples course icon                |
| (goodDollar)                                         | no SVG in the repo; source is `/en/gooddollar/gooddollar-darkblue.png` |

#### Conversion methods

**With Inkscape (recommended):**

```bash
# For JPG/PNG
inkscape public/img/Jn6_col.jpg \
  --export-plain-svg \
  --export-filename=public/img/credential/source/relacion-con-Jesus.svg

# Then edit SVG to ensure viewBox="0 0 512 512"
```

**With ImageMagick (basic silhouettes):**

```bash
convert public/img/Jn6_col.jpg \
  -resize 512x512 \
  public/img/credential/source/relacion-con-Jesus.svg
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
SET imagen = '/img/credential/source/relacion-con-Jesus.svg'
WHERE id IN (1, 2);

-- Course 103: Web3 & UBI
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/web3_ubi.svg'
WHERE id = 103;

-- Course 104: Ahorra en dólares en OKX
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/ahorra-en-okx.svg'
WHERE id = 104;

-- Course 102: goodDollar — no SVG icon in the repo yet; add one before setting `imagen`.
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
cd apps/web

# Course 1 — Una relación con Jesús (free)
bin/m eng:credentials:register-type \
  --network celoSepolia \
  --site learn.tg \
  --type course_completion \
  --display "Una relación con Jesús" \
  --soulbound true \
  --course-id 1 \
  --icon public/img/credential/source/relacion-con-Jesus.svg

# Course 103 — Web3 & UBI (free)
bin/m eng:credentials:register-type \
  --network celoSepolia \
  --site learn.tg \
  --type course_completion \
  --display "Web3 & UBI" \
  --soulbound true \
  --course-id 103 \
  --icon public/img/credential/source/web3_ubi.svg

# Course 104 — Ahorra en dólares en OKX (free)
bin/m eng:credentials:register-type \
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
cd apps/web
bin/m eng:credentials:sync-cache --network celoSepolia
```

This reads the contract and updates `credential_metadata` with `name`, `type`,
`site`, `is_premium`, `is_soulbound`, and `image_url` for each `tokenId`.

---

## 3b. The PNG behind `image_url`

Every `credential_metadata` row promises an image at `img/credential/<tokenId>.png`.
`register-type` (the `mpdj` plugin) composes the badge in
`public/img/credential/generated/<tokenId>.svg` and rasterizes it with
`rsvg-convert -w 512 -h 512` (installed in adJ as part of the base system). When that
step does not run — a clone without `apps/contracts/deployments/`, or the warning
`cred.image_failed` going unnoticed — the row points to a file that does not exist and
the site answers its own HTML instead of an image (soft 404, R-#161 §7).

Regenerate the missing PNGs from the SVGs:

```bash
cd apps/web
node bin/credential-icons.mjs --list    # mapping and what is missing
node bin/credential-icons.mjs           # create the missing ones (512x512)
node bin/credential-icons.mjs --force   # rebuild all
```

Source of each badge, in order: `public/img/credential/generated/<tokenId>.svg` (the
composed badge), the course icon (`cor1440_gen_proyectofinanciero.imagen` when it is an
SVG), and the source SVG listed in §1.3. The last step picks the SVG by the course's
**`prefijoRuta`**, never by `id`: course ids and token ids differ between development and
production, which is exactly why these PNGs are gitignored and generated on each site
(reading that site's `credential_metadata`). Commit the PNGs: the site
serves them and the PWA caches them for offline reading.

The PNGs are **not committed** (`.gitignore`: `apps/web/public/img/credential/*png`), so
`make all` and `make prod` run `make credential-icons` (after `pnpm i`) to leave them in
place on every deploy; running the target by hand does the same.

That step is safe on a site that already works: it **never overwrites an existing PNG**
(only `--force` does) and it runs with `--allow-offline`, so a build without the database
or without `rsvg-convert` prints a warning and continues instead of aborting the deploy.

Tokens without a course (`1`–`8` here) are **not learn.tg credentials**: the contract
registry also holds the types of other projects (sivel3's participation badges), and their
image is not learn.tg's to serve. The script lists them as skipped and never invents art,
so the build still succeeds; the only credential PNG learn.tg needs is the course one
(token 13 in development, see `--list`).

---

## 4. Set Site Base URI

So wallets and explorers can resolve metadata:

```bash
bin/m eng:credentials:set-site-uri \
  --network celoSepolia \
  --site learn.tg \
  --uri "https://learn.tg/api/credential"
```

> Requires `DEFAULT_ADMIN_ROLE` on the contract (deployer only).

---

## 5. Verify

```bash
# List registered types
bin/m eng:credentials:list-types --network celoSepolia

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
3. Calls `mintCourseCredential()` (the `@learn-tg/rewards` engine), which delegates to
   `@pasosdejesus/mpdj/blockchain` (`mintCourseWithRetry`)
4. Records in `credential_emission` with `usuario_id`, `course_id`,
   `token_id`, `chain_id`, `is_premium`, `hash`

---

## 7. Additional Commands

```bash
# Recompose image for an existing token
bin/m eng:credentials:recompose-image \
  --token-id 14 \
  --network celoSepolia \
  --site learn.tg \
  --icon public/img/credential/source/new-icon.svg

# Grant MINTER_ROLE to a wallet (requires DEFAULT_ADMIN_ROLE)
bin/m eng:credentials:grant-minter \
  --network celoSepolia \
  --address 0x...

# Revoke credential
bin/m eng:credentials:revoke-credential \
  --network celoSepolia \
  --token-id 14 \
  --address 0x...

# Set max supply
bin/m eng:credentials:set-max-supply \
  --network celoSepolia \
  --token-id 14 \
  --max 1000
```

---

## References

- [R-#130](https://github.com/pasosdeJesus/learn.tg/issues/130) — Credential integration issue
- [R-#26](https://github.com/pasosdeJesus/sivel3/issues/26) — PasosDeJesusCredentials contract
- [R-#33](https://github.com/pasosdeJesus/sivel3/issues/33) — `@pasosdejesus/m/blockchain` library
- [`@pasosdejesus/m/src/blockchain/README.md`](../apps/web/node_modules/@pasosdejesus/m/src/blockchain/README.md)
