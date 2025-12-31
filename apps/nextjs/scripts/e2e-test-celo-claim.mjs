import 'dotenv/config';
import axios from 'axios';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { celoSepolia } from 'viem/chains';
import https from 'https';
import { SiweMessage } from 'siwe';

// Funciones para manejo de cookies (de test-auth-cookies.mjs)
function parseCookieHeader(cookieHeader) {
  // cookieHeader es un string 'name=value; attr1=val1; attr2=val2'
  // Retorna solo 'name=value'
  return cookieHeader.split(';')[0].trim();
}

function updateCookies(currentCookies, setCookieHeaders) {
  let cookieMap = new Map();
  // Parsear cookies existentes
  if (currentCookies) {
    currentCookies.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name && valueParts.length) {
        cookieMap.set(name, `${name}=${valueParts.join('=')}`);
      }
    });
  }
  // Actualizar con nuevas cookies
  if (setCookieHeaders) {
    setCookieHeaders.forEach(header => {
      const cookie = parseCookieHeader(header);
      const [name, ...valueParts] = cookie.split('=');
      if (name && valueParts.length) {
        cookieMap.set(name, cookie);
      }
    });
  }
  // Reconstruir string de cookies
  return Array.from(cookieMap.values()).join('; ');
}

// ADVERTENCIA DE SEGURIDAD:
// Usar clave privada desde variables de entorno. Solo para desarrollo.
// NO USAR en mainnet. NO ENVIAR fondos reales a esta dirección.
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://celo-sepolia.infura.io/v3/';

// --- Parámetros de la Prueba ---
const BASE_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'https://learn.tg:9001';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://learn.tg:3500/learntg-admin';
const LANG = 'en';
const COURSE_PREFIX = 'a-relationship-with-Jesus';
const GUIDE_SUFFIX = 'guide1';
const CHAIN_ID = 11142220; // Celo Sepolia
// IDs from database (see servidor/db/datos-basicas.sql)
const COURSE_ID = 2; // A relationship with Jesus
const GUIDE_ID = 1;  // First guide ordered by nombrecorto

// Question-answer pairs from resources/en/a-relationship-with-Jesus/guide1.md
// Multiple clue substrings for flexible matching
const QUESTION_ANSWER_PAIRS = [
  { clueSubstrings: ['A landscape mentioned', 'landscape mentioned'], answer: 'mountain' },
  { clueSubstrings: ['Jesus had sent His disciples', 'sent His disciples to'], answer: 'Bethsaida' },
  { clueSubstrings: ['After sending away the people', 'Jesus went to'], answer: 'pray' },
  { clueSubstrings: ['Seeing His disciples distress', 'came close to the boat', 'walking on the sea'], answer: 'walking' },
  { clueSubstrings: ['The disciples cried', 'thought that the one walking', 'was a ghost'], answer: 'ghost' },
  { clueSubstrings: ['As soon as the disciples got scared', 'Cheer up! Its i I! Don\'t be', 'Don\'t be'], answer: 'afraid' },
  { clueSubstrings: ['Then Jesus went into the boat', 'the wind ceased', 'wind'], answer: 'ceased' },
  { clueSubstrings: ['If you read the passage before', 'miraculous sharing of bread', 'their hearts were'], answer: 'hardened' }
];

// --- Configuración ---
// Generar billetera aleatoria para la prueba
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
let cookies = ''; // Para almacenar cookies de sesión
const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(RPC_URL),
});

// Ignorar errores de certificados autofirmados en el entorno de desarrollo
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Crear instancia de axios con manejo manual de cookies
const apiClient = axios.create({
  baseURL: BASE_URL,
  httpsAgent,
  // NO usar withCredentials, manejamos cookies manualmente
  headers: {
    'User-Agent': 'Test Script',
    'Accept': 'application/json, text/plain, */*',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`,
  },
  maxRedirects: 0,
});

// Interceptor para guardar cookies recibidas
apiClient.interceptors.response.use((response) => {
  const setCookie = response.headers['set-cookie'];
  if (setCookie) {
    cookies = updateCookies(cookies, setCookie);
    console.log(`📦 Cookies actualizadas: ${cookies.slice(0, 80)}...`);
  }
  return response;
});

// Interceptor para enviar cookies en cada request
apiClient.interceptors.request.use((config) => {
  if (cookies) {
    config.headers.Cookie = cookies;
    console.log(`📤 Enviando cookies: ${cookies.slice(0, 80)}...`);
  }
  return config;
});

// Normalize clue text for matching
function normalizeClue(text) {
  return text
    .replace(/\n/g, ' ')          // replace newlines with spaces
    .replace(/\s+/g, ' ')         // collapse multiple spaces
    .replace(/[“”"]/g, '"')       // normalize quotes
    .replace(/[‘’']/g, "'")       // normalize apostrophes
    .replace(/[_\-\—]/g, ' ')     // replace underscores, dashes with space
    .trim()
    .toLowerCase();
}

// Función para obtener perfil de usuario desde la API de Rails
async function getUserProfile(walletAddress, csrfToken) {
  try {
    const url = `${API_BASE}/usuarios.json`;
    const params = new URLSearchParams({
      'filtro[walletAddress]': walletAddress,
      'walletAddress': walletAddress,
      'token': csrfToken
    });
    const fullUrl = `${url}?${params.toString()}`;
    console.log(`   URL: ${fullUrl}`);

    // Hacer solicitud GET a API de Rails
    const response = await axios.get(fullUrl, {
      httpsAgent: httpsAgent,
      headers: {
        'Cookie': cookies || '',
        'User-Agent': 'Test Script',
        'Accept': 'application/json',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/`,
      },
      maxRedirects: 0,
    });

    if (response.status === 200 && response.data && Array.isArray(response.data) && response.data.length > 0) {
      const userData = response.data[0];
      return {
        profilescore: userData.profilescore,
        learningscore: userData.learningscore,
        nombre: userData.nombre,
        email: userData.email,
        raw: userData
      };
    } else {
      throw new Error(`Respuesta inesperada: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error(`   Error obteniendo perfil: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

console.log(`
Starting E2E test for CELO scholarship claim with random wallet.
Site: ${BASE_URL}
Wallet: ${account.address}
Private key: ${privateKey.slice(0, 10)}...
Course: ${COURSE_PREFIX} (ID: ${COURSE_ID})
Guide: ${GUIDE_SUFFIX} (ID: ${GUIDE_ID})
`);

async function runTest() {
  try {
    // 0. Autenticación SIWE y actualización de puntaje
    console.log('PASO 0: Autenticación SIWE con billetera aleatoria...');
    console.log(`   Billetera: ${account.address}`);

    // 0.1 Obtener CSRF token
    console.log('\n   0.1 GET /api/auth/csrf');
    const csrfRes = await apiClient.get('/api/auth/csrf');
    console.log(`      Status: ${csrfRes.status}`);
    const csrfToken = csrfRes.data.csrfToken;
    console.log(`      Token: ${csrfToken.slice(0, 10)}...`);

    // 0.2 Construir mensaje SIWE
    console.log('\n   0.2 Construyendo SIWE message...');
    // Para billetera nueva, no hay referral tag
    const referralTag = '';
    const siweMessage = new SiweMessage({
      domain: 'learn.tg:9001',
      address: account.address,
      statement: `Sign in to Learn through games with DIVVI tracking.${referralTag ? ` Referral Tag: ${referralTag}` : ''}`,
      uri: BASE_URL,
      version: '1',
      chainId: CHAIN_ID,
      nonce: csrfToken,
      issuedAt: new Date().toISOString(),
    });
    const siweMessageText = siweMessage.prepareMessage();
    console.log(`      Message start: ${siweMessageText.slice(0, 100)}...`);

    // 0.3 Firmar mensaje
    console.log('\n   0.3 Firmando...');
    const signature = await account.signMessage({ message: siweMessageText });
    console.log(`      Signature: ${signature.slice(0, 10)}...`);

    // 0.4 Autenticar
    console.log('\n   0.4 POST /api/auth/callback/credentials');
    const formData = new URLSearchParams();
    formData.append('csrfToken', csrfToken);
    formData.append('message', siweMessageText);
    formData.append('signature', signature);
    formData.append('redirect', 'false');
    formData.append('callbackUrl', `${BASE_URL}/`);
    formData.append('json', 'true');

    const authRes = await apiClient.post('/api/auth/callback/credentials', formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log(`      Status: ${authRes.status}`);
    console.log(`      Data: ${JSON.stringify(authRes.data)}`);
    console.log('   ✅ Autenticación exitosa');

    // 0.5 Obtener nuevo CSRF token después de autenticación
    console.log('\n   0.5 Nuevo CSRF token (post-autenticación)...');
    let newToken = csrfToken;
    try {
      const newCsrfRes = await apiClient.get('/api/auth/csrf');
      newToken = newCsrfRes.data.csrfToken;
      console.log(`      Token: ${newToken.slice(0, 10)}...`);
    } catch (error) {
      console.log(`      Error: ${error.message}`);
    }

    // 0.6 Actualizar puntaje de perfil
    console.log('\n   0.6 Actualizando puntaje de perfil (update-scores)...');
    try {
      const response = await apiClient.post('/api/update-scores', {
        lang: LANG,
        walletAddress: account.address,
        token: newToken,
      });
      console.log(`      Status: ${response.status}`);
      console.log(`      Profile score: ${response.data.profilescore}`);
      console.log(`      Learning score: ${response.data.learningscore}`);
      console.log(`      Message: ${response.data.message}`);
      if (response.data.profilescore >= 50) {
        console.log(`      ✅ Puntaje suficiente para becas (${response.data.profilescore} puntos)`);
      } else {
        console.log(`      ⚠️  Puntaje insuficiente: ${response.data.profilescore} (se necesitan 50+)`);
      }
    } catch (error) {
      console.log(`      Error: ${error.message}`);
      if (error.response) {
        console.log(`      Status: ${error.response.status}`);
        console.log(`      Data: ${JSON.stringify(error.response.data)}`);
      }
    }

    // 0.7 Verificar perfil en API
    console.log('\n   0.7 Verificando perfil en API...');
    const profile = await getUserProfile(account.address, newToken);
    if (profile) {
      console.log(`      Profile score: ${profile.profilescore}`);
      console.log(`      Learning score: ${profile.learningscore}`);
      if (profile.profilescore === 52) {
        console.log('      ✅ Puntaje correcto (52) en perfil API');
      } else {
        console.log(`      ❌ Puntaje incorrecto: ${profile.profilescore} (esperado 52)`);
      }
    } else {
      console.log('      ❌ No se pudo obtener perfil');
    }

    // 1. Verificar la existencia de la guía (el token se obtiene en el siguiente paso)
    console.log('\nPASO 1: Verificando la existencia de la guía...');
    await apiClient.get('/api/guide', {
      params: {
        lang: LANG,
        prefix: COURSE_PREFIX,
        guide: GUIDE_SUFFIX,
        walletAddress: account.address,
      },
    });
    console.log('-> Guía encontrada.');

    // 3. Obtener el crucigrama y placements
    console.log('\nPASO 3: Obteniendo datos del crucigrama...');
    const crosswordResponse = await apiClient.get('/api/crossword', {
      params: {
        lang: LANG,
        prefix: COURSE_PREFIX,
        guide: GUIDE_SUFFIX,
        walletAddress: account.address,
        token: newToken,
        test: 'true',
      },
    });
    console.log('Crossword response keys:', Object.keys(crosswordResponse.data));

    const { grid: initialGrid, placements } = crosswordResponse.data;
    if (!initialGrid || !placements) {
      const errorDetails = JSON.stringify(crosswordResponse.data, null, 2);
      throw new Error(`Could not get complete crossword data. Response: ${errorDetails}`);
    }
    console.log(`-> Crossword grid: ${initialGrid.length}x${initialGrid[0].length}`);
    console.log(`-> Placements: ${placements.length} words`);

    // 4. "Resolver" el crucigrama llenando las respuestas correctas
    console.log('\nPASO 4: Solving crossword with correct answers...');
    const solvedGrid = initialGrid.map(row =>
      row.map(cell => ({ ...cell, userInput: '' }))
    );

    // Check placements count matches expected
    if (placements.length !== QUESTION_ANSWER_PAIRS.length) {
      throw new Error(`Placements count (${placements.length}) does not match expected count (${QUESTION_ANSWER_PAIRS.length})`);
    }

    // Fill grid with correct answers by matching clues
    placements.forEach((placement, index) => {
      const clue = placement.clue;
      const normalizedClue = normalizeClue(clue);
      // Find matching question-answer pair
      let pair = null;
      for (const p of QUESTION_ANSWER_PAIRS) {
        for (const sub of p.clueSubstrings) {
          if (normalizedClue.includes(normalizeClue(sub))) {
            pair = p;
            break;
          }
        }
        if (pair) break;
      }
      if (!pair) {
        console.error('Normalized clue:', normalizedClue);
        console.error('Available substrings:', QUESTION_ANSWER_PAIRS.map(p => p.clueSubstrings).flat());
        throw new Error(`Could not find answer for clue: ${clue.substring(0, 80)}...`);
      }
      const answer = pair.answer;
      let { row, col, direction } = placement;
      console.log(`  Placement ${index + 1}: row=${row}, col=${col}, dir=${direction}, answer="${answer}"`);
      console.log(`    Clue: ${clue.substring(0, 80)}...`);

      // Adjust row/col if out of bounds (should not happen but safeguard)
      const gridRows = solvedGrid.length;
      const gridCols = solvedGrid[0].length;
      if (row >= gridRows) {
        console.warn(`    Adjusting row ${row} to ${gridRows - 1}`);
        row = gridRows - 1;
      }
      if (col >= gridCols) {
        console.warn(`    Adjusting col ${col} to ${gridCols - 1}`);
        col = gridCols - 1;
      }

      for (let i = 0; i < answer.length; i++) {
        const currentRow = direction === 'down' ? row + i : row;
        const currentCol = direction === 'across' ? col + i : col;

        // Skip if out of bounds (should not happen after adjustment)
        if (currentRow >= gridRows || currentCol >= gridCols) {
          console.warn(`    Skipping cell out of bounds: row ${currentRow}, col ${currentCol}`);
          continue;
        }

        if (solvedGrid[currentRow] && solvedGrid[currentRow][currentCol]) {
          // Use uppercase letter for consistency with validation
          solvedGrid[currentRow][currentCol].userInput = answer[i].toUpperCase();
        } else {
          console.warn(`    Warning: Cell undefined at row ${currentRow}, col ${currentCol}`);
        }
      }
    });
    console.log('-> Crossword solved with correct answers.');

    // 5. Enviar la solución para obtener la beca
    console.log('\nPASO 5: Submitting solution for scholarship...');
    const checkResponse = await apiClient.post('/api/check-crossword', {
      courseId: COURSE_ID,
      guideId: GUIDE_ID,
      lang: LANG,
      grid: solvedGrid,
      placements: placements,
      walletAddress: account.address,
      token: newToken,
    });

    console.log('Check response status:', checkResponse.status);
    console.log('Check response data:', JSON.stringify(checkResponse.data, null, 2));

    const { scholarshipResult: txHash, message: msg } = checkResponse.data;
    if (!txHash) {
      throw new Error(`Submission failed. Message: ${msg}`);
    }
    console.log(`-> Submission successful. Message: "${msg.split('\n')[0]}"`);
    console.log(`-> Transaction hash: ${txHash}`);

    // 6. Verificar que la transacción fue exitosa en la blockchain
    console.log('\nPASO 6: Verificando la transacción en Celo Sepolia...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'success') {
      console.log('✅ ÉXITO: La transacción de la beca fue minada y confirmada en la blockchain.');
      console.log(`-> Block number: ${receipt.blockNumber}`);
    } else {
      throw new Error(`La transacción de la beca falló. Estado: ${receipt.status}`);
    }

    console.log('\nPrueba completada con éxito. El flujo de cobro de beca funciona.');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA PRUEBA:');
    if (error.response) {
      console.error(`- Status: ${error.response.status}`);
      console.error('- Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

runTest();