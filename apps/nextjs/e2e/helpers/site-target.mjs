/**
 * Destino del sitio bajo prueba.
 *
 * El helper de `m` (`initTestEnv`) arma siempre `base` con `https`
 * (`https://${IPDES}:${PUERTOPRU}`), así que un spec que sólo use `env.base` no
 * puede correr contra un `next dev` local en HTTP: navega a
 * `https://localhost:4000` y muere con `ERR_SSL_PROTOCOL_ERROR`. Con `SITE_URL`
 * apuntando al servidor local (`http://localhost:4000`) el spec corre en la VM.
 *
 * Además de `base` se derivan `host` y `domainPort`, porque el SIWE firma
 * `domain = window.location.host` (R-#233): si el spec firma con el host del dev
 * site y navega al local, `siwe.verify()` falla con `DOMAIN_MISMATCH`.
 *
 * Uso:
 *   const { base, host, domainPort } = resolveSiteTarget(env)
 */
export function resolveSiteTarget(env) {
  const siteUrl = process.env.SITE_URL
  if (!siteUrl) return { base: env.base, host: env.host, domainPort: env.domainPort }

  const url = new URL(siteUrl)
  return {
    base: url.origin,
    host: url.hostname,
    domainPort: url.port ? `:${url.port}` : '',
  }
}
