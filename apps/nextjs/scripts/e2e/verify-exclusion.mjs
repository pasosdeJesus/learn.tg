import 'dotenv/config'
import axios from 'axios'
import https from 'https'

// Configurar cliente HTTP que ignore certificados autofirmados (para desarrollo)
const apiClient = axios.create({
  baseURL: 'https://learn.tg:9001',
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  headers: {
    'User-Agent': 'Leaderboard-Exclusion-Verifier/1.0'
  }
})

// IDs de usuarios excluidos (según EXC.md)
const EXCLUDED_USER_IDS = [111, 101, 106, 103, 102]

async function verifyExclusion() {
  console.log('🔍 Verificando exclusión de usuarios del leaderboard')
  console.log('📅 Fecha:', new Date().toISOString())
  console.log('👥 IDs excluidos:', EXCLUDED_USER_IDS.join(', '))
  console.log('')

  try {
    // 1. Probar API de leaderboard con límite alto para obtener muchos usuarios
    console.log('📊 Consultando API de leaderboard...')
    const response = await apiClient.get('/api/leaderboard', {
      params: {
        lang: 'es',
        page: 1,
        limit: 100, // Obtener muchos registros
        sortBy: 'learningpoints',
        sortOrder: 'desc'
      }
    })

    if (response.status !== 200) {
      throw new Error(`API responded with status ${response.status}`)
    }

    const data = response.data
    const users = data.data || []
    console.log(`✅ API respondió con ${users.length} usuarios en la primera página`)
    console.log(`📈 Total de usuarios en leaderboard: ${data.pagination?.total || 'desconocido'}`)

    // 2. Verificar que ningún usuario excluido aparece en los resultados
    const excludedFound = users.filter(user => EXCLUDED_USER_IDS.includes(user.usuario_id))

    if (excludedFound.length === 0) {
      console.log('✅ Ningún usuario excluido encontrado en los resultados del leaderboard')
    } else {
      console.log('❌ USUARIOS EXCLUIDOS ENCONTRADOS EN LEADERBOARD:')
      excludedFound.forEach(user => {
        console.log(`   • ID: ${user.usuario_id}, Usuario: ${user.username}`)
      })
      process.exit(1)
    }

    // 3. Verificar que los países listados no incluyen países de usuarios excluidos
    // (esto es más complejo, requeriría consultar países de usuarios excluidos)
    // Por ahora solo confirmamos que la API responde correctamente

    // 4. Probar con diferentes parámetros (inglés, otro orden)
    console.log('\n🌐 Probando versión en inglés...')
    const enResponse = await apiClient.get('/api/leaderboard', {
      params: {
        lang: 'en',
        page: 1,
        limit: 10,
        sortBy: 'scholarship_usdt',
        sortOrder: 'desc'
      }
    })

    if (enResponse.status === 200) {
      const enData = enResponse.data
      const enExcludedFound = enData.data?.filter(user => EXCLUDED_USER_IDS.includes(user.usuario_id)) || []
      if (enExcludedFound.length === 0) {
        console.log('✅ Ningún usuario excluido encontrado en versión en inglés')
      } else {
        console.log('❌ Usuarios excluidos encontrados en versión en inglés')
        process.exit(1)
      }
    }

    // 5. Probar filtro por país (aleatorio) para asegurar que el filtro funciona
    if (data.countries && data.countries.length > 0) {
      const testCountry = data.countries[0].alfa2
      console.log(`\n🗺️  Probando filtro por país: ${testCountry}`)
      const countryResponse = await apiClient.get('/api/leaderboard', {
        params: {
          lang: 'es',
          country: testCountry,
          page: 1,
          limit: 50
        }
      })

      if (countryResponse.status === 200) {
        const countryData = countryResponse.data
        const countryExcludedFound = countryData.data?.filter(user => EXCLUDED_USER_IDS.includes(user.usuario_id)) || []
        if (countryExcludedFound.length === 0) {
          console.log(`✅ Ningún usuario excluido encontrado en filtro por país ${testCountry}`)
        } else {
          console.log(`❌ Usuarios excluidos encontrados en filtro por país ${testCountry}`)
          process.exit(1)
        }
      }
    }

    console.log('\n🎉 TODAS LAS VERIFICACIONES PASARON EXITOSAMENTE')
    console.log('Los usuarios excluidos no aparecen en el leaderboard.')
    process.exit(0)

  } catch (error) {
    console.error('\n❌ ERROR durante la verificación:', error.message)
    if (error.response) {
      console.error('   • Status:', error.response.status)
      console.error('   • Data:', JSON.stringify(error.response.data))
    }
    process.exit(1)
  }
}

verifyExclusion()