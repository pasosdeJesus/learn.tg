# Test Utilities Commons (@pasosdeJesus/m)

**"Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)**

Este directorio contiene utilidades genéricas de mocking para pruebas, diseñadas para ser reutilizables en múltiples proyectos que utilicen stacks similares. Estas utilidades han sido extraídas y adaptadas del proyecto `learn.tg` para formar parte de la biblioteca `@pasosdeJesus/m`.

## 📁 Estructura

```
test-utils/commons/
├── index.ts              # Re-exporta todos los mocks genéricos
├── fs-mocks.ts           # Mocks para sistema de archivos (fs/promises)
├── kysely-mocks.ts       # Mocks para Kysely ORM y PostgreSQL
├── radix-mocks.tsx       # Mocks para componentes Radix UI
├── rainbowkit-mocks.ts   # Mocks para autenticación (RainbowKit, Wagmi, NextAuth, SIWE)
└── viem-mocks.ts         # Mocks para cliente blockchain Viem
```

## 🧪 Módulos Disponibles

### 1. `fs-mocks.ts` – Sistema de archivos

**Propósito:** Mockear módulos `fs/promises` y `node:fs/promises` para pruebas que leen archivos.

**Funciones:**
- `createFsMocks(options?)`: Crea mocks configurables con contenido personalizado o errores.

**Uso:**
```typescript
import { createFsMocks } from '@/test-utils/commons/fs-mocks'

const fsMocks = createFsMocks({
  readFileContent: '# Contenido mock',
  readFileError: new Error('File not found')
})

beforeAll(() => {
  fsMocks.setupFsMocks()
})

beforeEach(() => {
  fsMocks.resetFsMocks()
  fsMocks.setupCommonResponses()
})
```

**Puntos importantes:**
- Usa `vi.hoisted()` para evitar problemas de inicialización
- Mockea tanto `fs/promises` como `node:fs/promises`
- Incluye funciones `setupFsMocks()`, `resetFsMocks()`, `setupCommonResponses()`

### 2. `kysely-mocks.ts` – ORM de base de datos

**Propósito:** Mockear Kysely y PostgreSQL para pruebas de acceso a base de datos.

**Funciones:**
- `createMockKysely(options?)`: Crea instancia mock configurable de Kysely
- `apiDbMocks` / `libDbMocks`: Instancias pre-configuradas para API routes y librerías

**Opciones configurables:**
- `executeTakeFirst`, `execute`, `sqlExecute`: Implementaciones personalizadas
- `configPath`: ⚠️ **Opcional pero actualmente no funcional** debido a hoisting de `vi.mock`. La ruta está hardcodeada a `@/.config/kysely.config`. Para rutas diferentes, configurar alias en Vite o mockear manualmente.
- `skipConfigMock`: Si es `true`, no mockea el módulo de configuración

**Uso:**
```typescript
import { createMockKysely } from '@/test-utils/commons/kysely-mocks'

const dbMocks = createMockKysely({
  executeTakeFirst: async () => ({ id: 1, name: 'Test User' }),
  // configPath: '@/db/config', // ⚠️ No funcional debido a hoisting de vi.mock
})

beforeAll(() => {
  dbMocks.setupMocks()
})

beforeEach(() => {
  dbMocks.resetMocks()
  dbMocks.setupCommonResponses()
  // Configurar respuestas específicas
  dbMocks.mockExecuteTakeFirst.mockResolvedValue({ id: 1 })
})
```

**Puntos importantes:**
- Mock completo de Kysely con query builder fluido (`selectFrom().where().execute()`)
- Incluye mock para `sql` con método `val()` para template tags
- Mock para `pg.Pool` de PostgreSQL
- **Lección aprendida:** El método `sql.val()` es crucial para queries que usan template tags

### 3. `radix-mocks.tsx` – Componentes UI

**Propósito:** Mockear componentes Radix UI para pruebas de componentes React.

**Mocks incluidos:**
- `portalMock`, `popoverMock`, `menubarMock`, `dropdownMenuMock`
- `dialogMock`, `toastMock`, `tooltipMock`, `accordionMock`
- `scrollAreaMock`, `tabsMock`, y componentes comunes (`Slot`, `Label`, `Separator`)

**Uso:**
```typescript
// Importar al inicio del archivo de tests (antes de importar componentes)
import '@/test-utils/commons/radix-mocks'

// Los componentes Radix ahora están mockeados con versiones simplificadas
// que incluyen data-testid para selección en tests
```

**Puntos importantes:**
- Todos los mocks usan `React.forwardRef` para compatibilidad
- Incluyen `data-testid` para fácil selección en tests
- **Lección aprendida:** Algunos componentes como `ScrollArea` renderizan múltiples elementos con el mismo `data-testid`; usar `getAllByTestId` y seleccionar el elemento apropiado
- **Lección aprendida:** Componentes que usan `Portal` deben mockearse para renderizar hijos directamente

### 4. `rainbowkit-mocks.ts` – Autenticación Web3

**Propósito:** Mockear autenticación con RainbowKit, Wagmi, NextAuth y Sign-In With Ethereum (SIWE).

**Funciones:**
- `createAuthMocks(config?)`: Crea mocks configurables
- `apiAuthMocks`: Instancia pre-configurada para API routes

**Configuración (`AuthMockConfig`):**
- `address`, `isConnected`, `sessionData`, `csrfToken`, `siweVerificationSuccess`
- `chainId`: ID de cadena (default: 1)
- `mockAxios`, `mockWagmi`, `mockSiwe`, `mockNextAuth`: Habilitar/deshabilitar mocks específicos
- `axiosMock`: Implementaciones personalizadas para métodos de axios

**Uso:**
```typescript
import { createAuthMocks } from '@/test-utils/commons/rainbowkit-mocks'

const authMocks = createAuthMocks({
  address: '0x123...',
  chainId: 8453, // Base chain
  mockAxios: true,
  axiosMock: {
    post: vi.fn().mockResolvedValue({ data: { success: true } })
  }
})

beforeAll(() => {
  authMocks.setupMocks()
  authMocks.setupDefaultImplementations()
})

beforeEach(() => {
  authMocks.resetMocks()
  // Actualizar configuración dinámica
  authMocks.updateConfig({ isConnected: false })
})
```

**Puntos importantes:**
- **Lección aprendida:** Algunos componentes usan `axios.post` mientras otros usan `fetch`; mockear ambos
- **Lección aprendida:** Los scores de usuario vienen de APIs, no de `useSession()`; mockear `fetch` apropiadamente
- **Lección aprendida:** Configurar `chainId` correctamente para pruebas de multi-cadena
- Incluye función `updateConfig()` para cambios dinámicos durante tests

### 5. `viem-mocks.ts` – Cliente Blockchain

**Propósito:** Mockear Viem para interacciones con blockchain.

**Mocks:**
- `viemMocks`: `createPublicClient`, `createWalletClient`, `getContract`, `encodeFunctionData`, etc.
- `viemChainsMocks`: Objeto con cadenas mock (`celo`, `celoSepolia` por defecto)

**Uso:**
```typescript
import { viemMocks, viemChainsMocks } from '@/test-utils/commons/viem-mocks'

// Extender cadenas disponibles
viemChainsMocks.ethereum = {}
viemChainsMocks.base = {}

// Usar en tests
viemMocks.createPublicClient.mockReturnValue({ ... })
```

**Puntos importantes:**
- Las cadenas mock son extensibles; agregar nuevas cadenas según necesidad
- **Lección aprendida:** Algunas funciones como `privateKeyToAccount` y `formatUnits` son necesarias para pruebas de transacciones

## 🚀 Ejemplos de Uso Completo

### Configuración para Tests de API Routes

```typescript
import { createMockKysely, createAuthMocks } from '@/test-utils/commons'

// Setup global
const dbMocks = createMockKysely({ skipConfigMock: true })
const authMocks = createAuthMocks({ mockAxios: false })

beforeAll(() => {
  dbMocks.setupMocks()
  authMocks.setupMocks()
  authMocks.setupDefaultImplementations()
})

beforeEach(() => {
  dbMocks.resetMocks()
  authMocks.resetMocks()
  // Configuraciones específicas del test
  dbMocks.mockExecuteTakeFirst.mockResolvedValue({ id: 1 })
  authMocks.updateConfig({ address: '0xtest...' })
})

afterAll(() => {
  vi.clearAllMocks()
})
```

### Configuración para Tests de Componentes

```typescript
import '@/test-utils/commons/radix-mocks'
import { createAuthMocks } from '@/test-utils/commons/rainbowkit-mocks'
import { render, screen } from '@testing-library/react'

const authMocks = createAuthMocks({
  mockAxios: false,
  mockSiwe: false,
  mockNextAuth: true
})

beforeAll(() => {
  authMocks.setupMocks()
  authMocks.setupDefaultImplementations()
})

test('renders component with wallet connection', () => {
  authMocks.updateConfig({ isConnected: true })
  render(<MyComponent />)
  expect(screen.getByText('Connected')).toBeInTheDocument()
})
```

## 📝 Puntos Importantes Aprendidos

### 1. **Orden de imports**
Los mocks de Radix UI deben importarse **antes** de importar cualquier componente que los use. Colocar `import '@/test-utils/commons/radix-mocks'` al inicio del archivo de tests.

### 2. **Múltiples elementos con mismo testid**
Componentes como `ScrollArea` renderizan múltiples elementos con el mismo `data-testid`. Usar `getAllByTestId` y seleccionar el elemento apropiado.

### 3. **axios vs fetch**
Algunos componentes usan `axios` mientras otros usan `fetch` nativo. Mockear ambos según corresponda:
- Componentes: generalmente usan `fetch` para datos iniciales
- Handlers: pueden usar `axios.post` para actualizaciones

### 4. **Scores de usuario**
Los scores (`learningscore`, `profilescore`) vienen de APIs (respuestas `fetch`), no de `useSession().data.user`. Mockear correctamente las respuestas de `fetch`.

### 5. **Configuración dinámica**
Usar `updateConfig()` para cambiar estado de autenticación durante tests (ej: simular desconexión).

### 6. **Template tags de SQL**
El mock de Kysely debe incluir `sql.val()` para queries que usan template tags como ```sql`SELECT * FROM table` ``.

### 7. **Manejo de errores**
Configurar mocks para simular errores (ej: `mockRejectedValue`) probar flujos de error.

### 8. **Hoisting de `vi.mock` en Vitest**
Las llamadas `vi.mock` se hoisted al nivel superior del módulo y no pueden depender de variables locales definidas dentro de funciones. Para mocks dinámicos usar strings literales o configurar alias en Vite.

### 9. **Variables capturadas en closures**
Cuando se usan `vi.hoisted`, las variables externas deben capturarse antes de la función hoisted. Ejemplo:
```typescript
// CORRECTO: capturar antes de vi.hoisted
const capturedVar = externalVar
const mocks = vi.hoisted(() => {
  // Usar capturedVar, no externalVar
})

// INCORRECTO: variable externa no accesible
const mocks = vi.hoisted(() => {
  // ReferenceError: externalVar is not defined
})
```

### 10. **Mock de módulos con rutas dinámicas**
`vi.mock` no acepta rutas dinámicas (variables) debido al hoisting. Para mockear módulos con rutas configurables:
1. Usar string literal y configurar alias en `vite.config.ts`
2. O crear múltiples mocks para diferentes rutas
3. O deshabilitar el mock (`skipConfigMock: true`) y mockear manualmente

### 11. **Errores comunes recientes y soluciones**
- **`ReferenceError: configPath is not defined`**: Causado por usar variable en `vi.mock`. Solución: usar string literal `'@/.config/kysely.config'`.
- **`ReferenceError: axiosMock is not defined`**: Variable no capturada en closure. Solución: capturar `axiosMock` antes de `vi.hoisted`.
- **`ReferenceError: path is not defined`**: Similar a `configPath`, variable no accesible en ámbito de `vi.mock`.

## 🔧 Configuración para Otros Proyectos

Estas utilidades pueden usarse en otros proyectos con las siguientes adaptaciones:

### 1. **Kysely Configuration**
Si el proyecto usa una ruta diferente para la configuración de Kysely:
```typescript
// ⚠️ configPath actualmente no funcional debido a hoisting de vi.mock
// Para rutas diferentes, configurar alias en Vite o mockear manualmente
createMockKysely({ skipConfigMock: true }) // Y mockear manualmente el módulo
```

### 2. **Blockchain Chains**
Extender las cadenas disponibles en `viemChainsMocks`:
```typescript
import { viemChainsMocks } from '@/test-utils/commons/viem-mocks'
viemChainsMocks.ethereum = {}
viemChainsMocks.polygon = {}
```

### 3. **Radix UI Components**
Si se usan componentes Radix no incluidos, extender `radix-mocks.tsx`:
```typescript
// En setup de tests
vi.mock('@radix-ui/react-slider', () => ({
  Root: /* mock implementation */
}))
```

### 4. **Variables de entorno**
Asegurar que las variables de entorno requeridas estén definidas en tests:
```typescript
process.env.NEXT_PUBLIC_API_URL = 'http://test.example.com'
```

## 🤝 Contribución

Las utilidades están diseñadas para ser parte de `@pasosdeJesus/m`. Para contribuir:

1. **Mantener compatibilidad**: Cambios que rompan compatibilidad deben ser versionados
2. **Documentar**: Actualizar esta documentación con nuevos features
3. **Testear**: Asegurar que las utilidades funcionen en múltiples proyectos
4. **Principios cristianos**: Trabajar con diligencia, humildad y amor (Colosenses 3:23)

## 🚀 Migración a @pasosdeJesus/m

Estas utilidades están destinadas a ser movidas al paquete `@pasosdeJesus/m` ubicado en `../m`. El plan de migración incluye:

1. **Estructura del paquete**: Analizar la estructura existente en `../m`
2. **Integración gradual**: Mover módulos uno por uno manteniendo compatibilidad
3. **Actualización de imports**: Cambiar `@/test-utils/common` a `@pasosdeJesus/m` en los tests
4. **Documentación**: Actualizar READMEs y guías de migración

Para detalles del plan, ver `TEST-MUEVE.md` en el directorio raíz.

## 📄 Licencia

Parte de `@pasosdeJesus/m` – Utilidades para proyectos "Pasos de Jesús".

---

*"For God has not given us a spirit of timidity, but of power, love, and self-discipline" (2 Timothy 1:7)*
