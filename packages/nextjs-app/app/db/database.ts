// Archivo puente para que los tests que hacen vi.mock('../../../db/database')
// desde app/api/.../__tests__ apunten aquí y puedan mockear el objeto db
// Re-exporta realmente el módulo raíz ../../db/database
export * from '../../db/database'
export { db } from '../../db/database'
