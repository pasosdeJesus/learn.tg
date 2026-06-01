# Despliegue de Credenciales (SBTs) en learn.tg

> "Whatever you do, work at it with all your heart, as working for the Lord,
> not for human masters." (Colossians 3:23)

## Requisitos previos

1. Contrato `PasosDeJesusCredentials` desplegado y verificado en Celo/Celo Sepolia
   (ver [R-#26](https://github.com/pasosdeJesus/sivel3/issues/26)).
2. Archivos de despliegue en `apps/hardhat/deployments/PasosDeJesusCredentials/`
   (`celo.json`, `celoSepolia.json`, etc.).
3. `@pasosdejesus/m` >= 0.5.3 instalado (`apps/nextjs/node_modules/@pasosdejesus/m`).
4. Wallet con `MINTER_ROLE` en el contrato para `credentials:register-type`
   (la variable `PRIVATE_KEY` en `.env`).

---

## 1. Preparar íconos SVG de cursos

### 1.1 Crear directorio fuente

```bash
mkdir -p apps/nextjs/public/img/credential/source
```

### 1.2 Cursos actuales y sus imágenes

| id  | Curso                       | Imagen actual                          | Tamaño   | Ubicación |
|-----|-----------------------------|----------------------------------------|----------|-----------|
| 1   | Una relación con Jesús      | `/img/Jn6_col.jpg`                     | 59 KB    | `public/img/Jn6_col.jpg` |
| 2   | A relationship with Jesus   | `/img/Jn6_col.jpg`                     | 59 KB    | misma imagen de id=1 |
| 102 | goodDollar                  | `/en/gooddollar/gooddollar-darkblue.png`| —      | no existe en disco local |
| 103 | Web3 & UBI                  | `/img/2025/web3_ubi.png`              | 48 KB    | `public/img/2025/web3_ubi.png` |
| 104 | Ahorra en dólares en OKX    | `/img/OKX_Logo.svg`                   | 3.5 KB   | `public/img/OKX_Logo.svg` |

### 1.3 Convertir a SVG 512×512 y usarlos también como portadas

Cada ícono SVG de 512×512 servirá para **dos propósitos**:

1. **Imagen del SBT** — compuesta por `composeCredentialImage()` con borde, logo, candado, estrella
2. **Portada del curso en `/[lang]/[pathPrefix]`** — reemplazando el JPG/PNG actual en la página del curso

Para el propósito 2, basta con actualizar el campo `imagen` en `cor1440_gen_proyectofinanciero` para que apunte al SVG:

- **Formato:** SVG con `viewBox="0 0 512 512"`
- **Sin** `<script>`, `foreignObject`, URLs externas, `data:image/svg+xml`
- Contenido entre 50 y 50000 caracteres

| Archivo SVG a crear                                  | Desde                                        |
|------------------------------------------------------|----------------------------------------------|
| `public/img/credential/source/relacion-con-jesus.svg`| `public/img/Jn6_col.jpg`                     |
| `public/img/credential/source/gooddollar.svg`        | descargar de `https://learn.tg/en/gooddollar/gooddollar-darkblue.png` |
| `public/img/credential/source/web3-and-ubi.svg`      | `public/img/2025/web3_ubi.png`              |
| `public/img/credential/source/ahorra-en-okx.svg`     | `public/img/OKX_Logo.svg`                   |

#### Métodos de conversión

**Con Inkscape (recomendado):**

```bash
# Para JPG/PNG
inkscape public/img/Jn6_col.jpg \
  --export-plain-svg \
  --export-filename=public/img/credential/source/relacion-con-jesus.svg

# Luego editar el SVG para asegurar viewBox="0 0 512 512"
```

**Con ImageMagick (siluetas básicas):**

```bash
convert public/img/Jn6_col.jpg \
  -resize 512x512 \
  public/img/credential/source/relacion-con-jesus.svg
```

**Para OKX_Logo.svg (redimensionar):**

El archivo actual tiene `viewBox="0 0 84 84"`. Envolver en un SVG 512×512:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(214,214) scale(1)">
    <!-- contenido original de OKX_Logo.svg -->
  </g>
</svg>
```

### 1.4 Actualizar portadas de cursos

Una vez creados los SVGs, actualizar el campo `imagen` en la base de datos
para que `/[lang]/` muestre las nuevas imágenes vectoriales en lugar de los
JPG/PNG actuales:

```sql
-- Curso 1/2: Una relación con Jesús
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/relacion-con-jesus.svg'
WHERE id IN (1, 2);

-- Curso 103: Web3 & UBI
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/web3-and-ubi.svg'
WHERE id = 103;

-- Curso 104: Ahorra en dólares en OKX
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/ahorra-en-okx.svg'
WHERE id = 104;

-- Curso 102: goodDollar
UPDATE cor1440_gen_proyectofinanciero
SET imagen = '/img/credential/source/gooddollar.svg'
WHERE id = 102;
```

**Ventajas de usar SVGs como portadas:**
- ~10× más ligeros que JPG/PNG (2-5 KB vs 48-59 KB)
- Nítidos a cualquier resolución (el `object-cover` del `<Image>` escala sin pérdida)
- Mismos archivos fuente que los SBT — un solo mantenimiento

---

## 2. Registrar tipos de credencial en el contrato

Cada curso premium que emita credenciales debe registrarse una sola vez.
El `tokenId` se asigna secuencialmente por el contrato.

```bash
cd apps/nextjs

# Curso 1 — Una relación con Jesús (gratis)
bin/m credentials:register-type \
  --network celoSepolia \
  --site learn.tg \
  --type course_completion \
  --display "Una relación con Jesús" \
  --soulbound true \
  --course-id 1 \
  --icon public/img/credential/source/relacion-con-jesus.svg

# Curso 103 — Web3 & UBI (gratis)
bin/m credentials:register-type \
  --network celoSepolia \
  --site learn.tg \
  --type course_completion \
  --display "Web3 & UBI" \
  --soulbound true \
  --course-id 103 \
  --icon public/img/credential/source/web3-and-ubi.svg

# Curso 104 — Ahorra en dólares en OKX (gratis)
bin/m credentials:register-type \
  --network celoSepolia \
  --site learn.tg \
  --type course_completion \
  --display "Ahorra en dólares en OKX" \
  --soulbound true \
  --course-id 104 \
  --icon public/img/credential/source/ahorra-en-okx.svg
```

**Notas:**

- `--course-id` debe coincidir con el `id` de `cor1440_gen_proyectofinanciero`.
- `--premium` se omite para cursos gratuitos. Agregar `--premium` si `porPagar > 0`.
- `--icon` dispara `composeCredentialImage()` que genera el SVG compuesto y
  el PNG en `public/img/credential/{tokenId}.png`.
- El logo del sitio (`logo-learntg.svg`) y el badge PdJ vienen incluidos
  en `@pasosdejesus/m` como fallback.
- Si la wallet no tiene `MINTER_ROLE`, el registro fallará con
  `AccessControlUnauthorizedAccount`.

---

## 3. Sincronizar caché de metadatos

Después de registrar tipos, sincronizar la tabla `credential_metadata`:

```bash
cd apps/nextjs
bin/m credentials:sync-cache --network celoSepolia
```

Esto lee el contrato y actualiza `credential_metadata` con `name`, `type`,
`site`, `is_premium`, `is_soulbound` e `image_url` para cada `tokenId`.

---

## 4. Establecer URI base del sitio

Para que wallets y explorers resuelvan la metadata:

```bash
bin/m credentials:set-site-uri \
  --network celoSepolia \
  --site learn.tg \
  --uri "https://learn.tg/api/credential"
```

> Requiere `DEFAULT_ADMIN_ROLE` en el contrato (solo el deployer).

---

## 5. Verificar

```bash
# Listar tipos registrados
bin/m credentials:list-types --network celoSepolia

# Verificar endpoint de metadata
curl https://learn.tg/api/credential/14.json
# (reemplazar 14 por el tokenId asignado)

# Verificar endpoint de wallet
curl https://learn.tg/api/credential/wallet/0x...
```

---

## 6. Minteo automático

El minting ocurre automáticamente en `app/api/check-crossword/route.ts` cuando
un estudiante completa el 100% de las guías de un curso. El flujo:

1. Detecta `percentagecompleted >= 100`
2. Verifica `credential_emission` (off-chain) para evitar duplicados
3. Llama `mintCourseSBT()` de `@pasosdejesus/m/blockchain`
4. Registra en `credential_emission` con `usuario_id`, `course_id`,
   `token_id`, `chain_id`, `is_premium`, `hash`

---

## 7. Comandos adicionales

```bash
# Recomponer imagen de un token existente
bin/m credentials:recompose-image \
  --token-id 14 \
  --network celoSepolia \
  --icon public/img/credential/source/nuevo-icono.svg

# Otorgar MINTER_ROLE a una wallet (requiere DEFAULT_ADMIN_ROLE)
bin/m credentials:grant-minter \
  --network celoSepolia \
  --address 0x...

# Revocar credencial
bin/m credentials:revoke-credential \
  --network celoSepolia \
  --token-id 14 \
  --address 0x...

# Establecer suministro máximo
bin/m credentials:set-max-supply \
  --network celoSepolia \
  --token-id 14 \
  --max 1000
```

---

## Referencias

- [I130.md](../I130.md) — Issue de integración de credenciales
- [R-#26](https://github.com/pasosdeJesus/sivel3/issues/26) — Contrato PasosDeJesusCredentials
- [R-#33](https://github.com/pasosdeJesus/sivel3/issues/33) — Biblioteca `@pasosdejesus/m/blockchain`
- [`@pasosdejesus/m/src/blockchain/README.md`](../apps/nextjs/node_modules/@pasosdejesus/m/src/blockchain/README.md)
