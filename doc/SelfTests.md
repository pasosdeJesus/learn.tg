# Self Verification — Test Report

### Entorno

| Fecha | Dispositivo | Navegador | Wallet | Opera | Comentarios | 
|-----------|-------|---|---|---|
| 2026-05-11 | Androdi 16 | Brave 1.89.145 | Nativa de Brave | Si | Abre self |
| 2026-05-12 | Desktop | Chromium 141.0.7390.54 | One Key | Si | Debe usarse
telefono para escanear |
| 2026-05-12 | Android 16 | Incorporado en Wallet | OneKey | 
| Wallet | Billetera nativa de Brave |
| Red | Celo Mainnet |

### Configuración de producción

| Parámetro | Valor |
|-----------|-------|
| `endpoint` | `https://learntg.pdJ.app/api/self-verify` |
| `endpointType` | `https` |
| `scope` | `learn.tg` |
| `IS_PRODUCTION` | `true` |
| `deeplinkCallback` | `window.location.href` (la misma página de perfil) |

### Prueba 1: Brave Desktop (con billetera nativa Brave)

| Aspecto | Resultado |
|---------|-----------|
| Abre Self app | ✅ Sí |
| Verificación en Self | ✅ Exitosa |
| Server `POST /api/self-verify` | ✅ `SUCCESS - returning success response` |
| Se cierra diálogo al volver | ✅ Sí (fix focus event) |
| Datos actualizados en perfil | ✅ Nombre y país actualizados |

**Observaciones:** Funciona correctamente. El `deeplinkCallback` redirige de vuelta al perfil.

### Prueba 2: Brave Desktop (sin `deeplinkCallback`)

| Aspecto | Resultado |
|---------|-----------|
| Abre Self app | ✅ Sí |
| Server procesa verificación | ✅ Sí |
| Diálogo se queda abierto al volver | ❌ No cerraba |
| Fix focus event | ✅ Agregado — cierra diálogo al detectar `window focus` |

### Prueba 3: MetaMask Mobile Android

| Aspecto | Resultado |
|---------|-----------|
| Abre Self app | ❌ No — muestra QR (no deep link desde in-app browser) |
| QR escaneable | ❌ Usuario está en el celular, no puede escanear desde otra cámara |
| `deeplinkCallback` | ⏳ Pendiente de probar (el redirect HTTPS sí debería funcionar) |

### Pruebas anteriores (abril 2026)

| Wallet | Deep link | QR | Notas |
|--------|-----------|----|-------|
| **MetaMask** Android | ❌ | ❌ | In-app browser no permite deep links |
| **OneKey** Android | ❌ | ❌ | Mismo problema |
| **OKX Web3 Wallet** Android | ❌ | ❌ | Mismo problema |
| **Chrome** Android | ✅ | N/A | Deep link abre Self app |
| **Safari** iOS | ✅ | N/A | Deep link abre Self app |

## Flujo de verificación actual

```
Usuario → [Click "Verify with Self"] → SelfAppBuilder.build()
  → ¿Es mobile? (isMobile=true)
    → ¿Wallet browser? (isWalletBrowser)
      → Sí: muestra texto explicativo (sin acción)
      → No: botón "Open Self App" → deep link → Self app
        → Self app verifica → POST a /api/self-verify
        → Self app redirige a deeplinkCallback
        → Página se recarga → diálogo cerrado → datos actualizados
  → No (desktop): QR Code → SelfQRcodeWrapper
    → Self app escanea QR → verifica
    → onSuccess → cierra diálogo
```

## Problemas conocidos

### 1. Wallet browsers (MetaMask, OneKey, OKX)

**Problema:** Los in-app browsers de wallets no permiten deep links a apps externas ni escanear QRs desde el mismo dispositivo.

**Solución parcial con `deeplinkCallback`:**
1. Mostrar botón "Copiar enlace" con el `getUniversalLink(selfApp)`
2. Usuario copia, abre Chrome/Safari, pega el enlace
3. Self app se abre, verifica
4. Self app redirige a `deeplinkCallback` (la página de perfil)
5. La página se recarga con datos actualizados

**Por implementar:** Botón "Copiar enlace" para wallet browsers (actualmente solo muestran texto explicativo).

### 2. Diálogo no se cierra en mobile sin `SelfQRcodeWrapper`

**Problema:** En mobile (no wallet browser), al abrir Self app con deep link, el `SelfQRcodeWrapper` no está presente para disparar `onSuccess`.

**Solución:** Agregamos evento `window focus` que llama a `onSuccess()` cuando el usuario regresa de Self app. El `deeplinkCallback` ahora redirige de vuelta al perfil, haciendo que se recargue.

### 3. Error `d.slice is not a function` en `/api/self-verify`

**Problema:** El log `proof ? proof.slice(0, 50) + '...' : null` fallaba porque `proof` es un objeto, no un string.

**Solución:** Corregido el log para usar `Object.keys(proof)` en lugar de `.slice()`.

### 4. Error `m.slice is not a function` en `/api/self-verify`

**Problema:** Otro log con `.slice()` sobre un objeto.

**Solución:** Eliminado el `.slice()` del debug logging.

## Variables de depuración

| Variable | Propósito |
|----------|-----------|
| `NEXT_PUBLIC_M_DEBUGGER_CONSOLE=1` | Activa consola flotante en `/[lang]/profile` |
| `?debug=1` | También activa la consola (por URL) |
| Prefijo `[SelfVerify]` en console.log | Logs del endpoint de verificación |
| Prefijo `[SelfVerify:xxxxx]` en server | Logs del servidor con requestId único |

## Cómo probar manualmente

1. Abrir `https://learn.tg/en/profile?debug=1`
2. Conectar wallet y firmar sesión
3. Click "Verify with self"
4. Seguir el flujo según el dispositivo
5. Revisar console del navegador (mensajes `[SelfVerify]`)
6. Revisar terminal del servidor (mensajes `[SelfVerify:abc123]`)
