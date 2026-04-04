import 'dotenv/config';
import axios from 'axios';
import https from 'https';

// Configurar cliente HTTP que ignore certificados autofirmados (para desarrollo)
const apiClient = axios.create({
  baseURL: 'https://learn.tg:9001',
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  headers: {
    'User-Agent': 'Leaderboard-E2E-Test/1.0'
  }
});

// Textos esperados en español
const EXPECTED_SPANISH = {
  title: 'Tabla de Clasificación',
  subtitle: 'Sigue las contribuciones y logros de los usuarios',
  countryLabel: 'País:',
  allCountries: 'Todos los países',
  tableHeaders: {
    rank: 'Posición',
    user: 'Usuario',
    country: 'País',
    learningPoints: 'Puntos de Aprendizaje',
    scholarship: 'Beca (USDT)',
    ubi: 'UBI (CELO)',
    donations: 'Donaciones (USDT)'
  },
  explanations: {
    learningPoints: 'Puntos de Aprendizaje se ganan completando crucigramas y haciendo donaciones.',
    scholarship: 'Beca (USDT) se recibe como becas educativas.',
    ubi: 'UBI (CELO) se recibe a través de reclamos de ingreso básico universal.',
    donations: 'Donaciones (USDT) son contribuciones hechas para apoyar la plataforma.'
  }
};

// Textos esperados en inglés
const EXPECTED_ENGLISH = {
  title: 'Leaderboard',
  subtitle: 'Track user contributions and achievements',
  countryLabel: 'Country:',
  allCountries: 'All countries',
  tableHeaders: {
    rank: 'Rank',
    user: 'User',
    country: 'Country',
    learningPoints: 'Learning Points',
    scholarship: 'Scholarship (USDT)',
    ubi: 'UBI (CELO)',
    donations: 'Donations (USDT)'
  },
  explanations: {
    learningPoints: 'Learning Points are earned by completing crosswords and giving donations.',
    scholarship: 'Scholarship (USDT) is received as educational grants.',
    ubi: 'UBI (CELO) is received through universal basic income claims.',
    donations: 'Donations (USDT) are contributions made to support the platform.'
  }
};

// Función para normalizar HTML eliminando comentarios, etiquetas y espacios extra
function normalizeHtml(html) {
  // Eliminar comentarios HTML
  let cleaned = html.replace(/<!--.*?-->/gs, ' ');
  // Eliminar etiquetas HTML (conserva el contenido entre ellas)
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  // Reemplazar múltiples espacios, saltos de línea, etc. con un solo espacio
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned.trim();
}

// Función para verificar si un texto existe en el HTML
function verifyText(html, expectedText, description) {
  // Normalizar HTML eliminando comentarios y espacios extra
  const normalizedHtml = normalizeHtml(html);
  const normalizedExpected = normalizeHtml(expectedText);
  const found = normalizedHtml.includes(normalizedExpected);
  if (found) {
    console.log(`✅ ${description}: "${expectedText}"`);
    return true;
  } else {
    console.log(`❌ ${description}: NO SE ENCONTRÓ "${expectedText}"`);
    // Mostrar fragmento del HTML normalizado para debugging
    const snippet = normalizedHtml.substring(0, 1000);
    console.log(`   Fragmento HTML normalizado (primeros 1000 chars): ${snippet.substring(0, 300)}...`);
    // También mostrar el texto esperado normalizado
    console.log(`   Texto esperado normalizado: "${normalizedExpected}"`);
    return false;
  }
}

// Función para verificar múltiples textos
function verifyTexts(html, expectedTexts, description) {
  console.log(`\n🔍 Verificando ${description}:`);
  let allPassed = true;

  for (const [key, text] of Object.entries(expectedTexts)) {
    if (typeof text === 'object') {
      // Si es un objeto anidado, verificar recursivamente
      console.log(`  📋 ${key}:`);
      for (const [subKey, subText] of Object.entries(text)) {
        const passed = verifyText(html, subText, `    ${subKey}`);
        if (!passed) allPassed = false;
      }
    } else {
      const passed = verifyText(html, text, `  ${key}`);
      if (!passed) allPassed = false;
    }
  }

  return allPassed;
}

// Función para verificar elementos HTML importantes
function verifyStructure(html, lang) {
  console.log(`\n🏗️  Verificando estructura para ${lang}:`);
  const checks = [
    { selector: 'h1', description: 'Título principal (h1)' },
    { selector: 'table', description: 'Tabla de datos' },
    { selector: 'thead', description: 'Cabecera de tabla' },
    { selector: 'tbody', description: 'Cuerpo de tabla' },
    { selector: 'select', description: 'Selector de país' },
    { selector: 'button', description: 'Botones (paginación/ordenamiento)' }
  ];

  let allPresent = true;
  for (const check of checks) {
    const regex = new RegExp(`<${check.selector}[^>]*>`, 'i');
    const found = regex.test(html);
    if (found) {
      console.log(`✅ ${check.description}`);
    } else {
      console.log(`❌ ${check.description} NO ENCONTRADO`);
      allPresent = false;
    }
  }

  return allPresent;
}

// Función para probar API de leaderboard
async function testLeaderboardAPI(lang) {
  console.log(`\n📊 Probando API de leaderboard para ${lang}:`);

  try {
    // Probar endpoint básico
    const response = await apiClient.get('/api/leaderboard', {
      params: {
        lang,
        page: 1,
        limit: 10,
        sortBy: 'learningpoints',
        sortOrder: 'desc'
      }
    });

    if (response.status === 200) {
      console.log(`✅ API responde correctamente (status: ${response.status})`);

      const data = response.data;
      const hasData = data.data && Array.isArray(data.data);
      const hasCountries = data.countries && Array.isArray(data.countries);
      const hasPagination = data.pagination;

      console.log(`   • Datos de usuarios: ${hasData ? `✅ (${data.data.length} registros)` : '❌'}`);
      console.log(`   • Lista de países: ${hasCountries ? `✅ (${data.countries.length} países)` : '❌'}`);
      console.log(`   • Paginación: ${hasPagination ? '✅' : '❌'}`);

      if (hasPagination) {
        console.log(`     - Página: ${data.pagination.page}`);
        console.log(`     - Límite: ${data.pagination.limit}`);
        console.log(`     - Total: ${data.pagination.total}`);
        console.log(`     - Total páginas: ${data.pagination.totalPages}`);
      }

      return { success: true, data };
    } else {
      console.log(`❌ API respondió con status: ${response.status}`);
      return { success: false, error: `Status ${response.status}` };
    }
  } catch (error) {
    console.log(`❌ Error al probar API: ${error.message}`);
    if (error.response) {
      console.log(`   • Status: ${error.response.status}`);
      console.log(`   • Data: ${JSON.stringify(error.response.data)}`);
    }
    return { success: false, error: error.message };
  }
}

// Función principal para probar un idioma
async function testLanguage(lang) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌐 PROBANDO LEADERBOARD EN ${lang.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);

  const expectedTexts = lang === 'es' ? EXPECTED_SPANISH : EXPECTED_ENGLISH;
  const url = `/${lang}/leaderboard`;

  try {
    // 1. Descargar página HTML
    console.log(`\n📥 Descargando página: ${url}`);
    const response = await apiClient.get(url, {
      responseType: 'text',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = response.data;
    console.log(`✅ Página descargada (${html.length} bytes)`);

    // 2. Verificar textos en el idioma correcto
    const textsPassed = verifyTexts(html, expectedTexts, `textos en ${lang}`);

    // 3. Verificar estructura HTML
    const structurePassed = verifyStructure(html, lang);

    // 4. Probar API de leaderboard
    const apiResult = await testLeaderboardAPI(lang);

    // Resumen
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 RESUMEN PARA ${lang.toUpperCase()}:`);
    console.log(`${'='.repeat(60)}`);
    console.log(`• Textos en ${lang}: ${textsPassed ? '✅ PASÓ' : '❌ FALLÓ'}`);
    console.log(`• Estructura HTML: ${structurePassed ? '✅ PASÓ' : '❌ FALLÓ'}`);
    console.log(`• API de leaderboard: ${apiResult.success ? '✅ PASÓ' : '❌ FALLÓ'}`);

    return {
      success: textsPassed && structurePassed && apiResult.success,
      textsPassed,
      structurePassed,
      apiSuccess: apiResult.success,
      htmlLength: html.length
    };

  } catch (error) {
    console.log(`\n❌ ERROR al probar ${lang}: ${error.message}`);
    if (error.response) {
      console.log(`• Status: ${error.response.status}`);
      console.log(`• Data: ${error.response.data}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Función principal
async function runTest() {
  console.log('🚀 INICIANDO PRUEBAS E2E DEL LEADERBOARD');
  console.log('🔗 URL base: https://learn.tg:9001');
  console.log('📅 Fecha:', new Date().toISOString());
  console.log('');

  try {
    // Probar ambos idiomas
    const esResult = await testLanguage('es');
    const enResult = await testLanguage('en');

    // Resumen final
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎯 RESUMEN FINAL DE PRUEBAS');
    console.log(`${'='.repeat(60)}`);
    console.log('ESPAÑOL:');
    console.log(`  • Textos: ${esResult.textsPassed ? '✅' : '❌'}`);
    console.log(`  • Estructura: ${esResult.structurePassed ? '✅' : '❌'}`);
    console.log(`  • API: ${esResult.apiSuccess ? '✅' : '❌'}`);
    console.log(`  • Resultado: ${esResult.success ? '✅ PASÓ' : '❌ FALLÓ'}`);

    console.log('\nINGLÉS:');
    console.log(`  • Textos: ${enResult.textsPassed ? '✅' : '❌'}`);
    console.log(`  • Estructura: ${enResult.structurePassed ? '✅' : '❌'}`);
    console.log(`  • API: ${enResult.apiSuccess ? '✅' : '❌'}`);
    console.log(`  • Resultado: ${enResult.success ? '✅ PASÓ' : '❌ FALLÓ'}`);

    console.log(`\n${'='.repeat(60)}`);

    const allPassed = esResult.success && enResult.success;
    if (allPassed) {
      console.log('🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
      console.log('La internacionalización del leaderboard está funcionando correctamente.');
      process.exit(0);
    } else {
      console.log('⚠️  ALGUNAS PRUEBAS FALLARON. Revisar los errores arriba.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR FATAL DURANTE LAS PRUEBAS:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar pruebas
runTest();