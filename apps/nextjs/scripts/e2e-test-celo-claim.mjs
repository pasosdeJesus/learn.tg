import axios from 'axios';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celoAlfajores } from 'viem/chains';
import https from 'https';

// ADVERTENCIA DE SEGURIDAD:
// Esta clave privada es pública y conocida. Solo para desarrollo.
// NO USAR en mainnet. NO ENVIAR fondos reales a esta dirección.
const DEV_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// --- Parámetros de la Prueba ---
const BASE_URL = 'https://learn.tg:9001';
const LANG = 'es';
const COURSE_PREFIX = 'una-relacion-con-Jesus';
const GUIDE_SUFFIX = 'guia1';

// --- Configuración ---
const account = privateKeyToAccount(DEV_PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: celoAlfajores,
  transport: http(),
});

// Ignorar errores de certificados autofirmados en el entorno de desarrollo
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const apiClient = axios.create({
  baseURL: BASE_URL,
  httpsAgent,
});

console.log(`
Iniciando prueba E2E en adJ (Amor de Jesús) para el cobro de beca.
Sitio: ${BASE_URL}
Billetera: ${account.address}
Guía: ${COURSE_PREFIX}/${GUIDE_SUFFIX}
`);

async function runTest() {
  try {
    // 1. Verificar la existencia de la guía (el token se obtiene en el siguiente paso)
    console.log('PASO 1: Verificando la existencia de la guía...');
    await apiClient.get('/api/guide', {
      params: {
        lang: LANG,
        prefix: COURSE_PREFIX,
        guide: GUIDE_SUFFIX,
        walletAddress: account.address,
      },
    });
    console.log('-> Guía encontrada.');

    // 2. Obtener el crucigrama, sus respuestas y el token
    console.log('\nPASO 2: Obteniendo datos del crucigrama y token...');
    const crosswordResponse = await apiClient.get('/api/crossword', {
      params: {
        lang: LANG,
        prefix: COURSE_PREFIX,
        guide: GUIDE_SUFFIX,
        walletAddress: account.address,
        test: 'true',
      },
    });

    const { grid: initialGrid, result: solutions, token } = crosswordResponse.data;
    if (!initialGrid || !solutions || !token) {
      const errorDetails = JSON.stringify(crosswordResponse.data, null, 2);
      throw new Error(`No se pudieron obtener los datos completos del crucigrama. Respuesta: ${errorDetails}`);
    }
    console.log('-> Datos del crucigrama y soluciones obtenidas.');
    console.log(`-> Token obtenido: ${token.substring(0, 10)}...`);

    // 3. "Resolver" el crucigrama llenando las respuestas correctas
    console.log('\nPASO 3: Resolviendo el crucigrama...');
    const solvedGrid = initialGrid.map(row => 
      row.map(cell => ({ ...cell, userInput: '' }))
    );

    solutions.forEach(word => {
      for (let i = 0; i < word.answer.length; i++) {
        const x = word.startx - 1;
        const y = word.starty - 1;
        if (word.orientation === 'across') {
          if (solvedGrid[y] && solvedGrid[y][x + i]) {
            solvedGrid[y][x + i].userInput = word.answer[i];
          }
        } else { // down
          if (solvedGrid[y + i] && solvedGrid[y + i][x]) {
            solvedGrid[y + i][x].userInput = word.answer[i];
          }
        }
      }
    });
    console.log('-> Crucigrama resuelto con las respuestas correctas.');

    // 4. Enviar la solución para obtener la beca
    console.log('\nPASO 4: Enviando solución para recibir la beca...');
    const checkResponse = await apiClient.post('/api/check-crossword', {
      lang: LANG,
      prefix: COURSE_PREFIX,
      guide: GUIDE_SUFFIX,
      walletAddress: account.address,
      token,
      grid: solvedGrid,
    });
    
    const { scholarshipResult: txHash, message } = checkResponse.data;
    if (!txHash) {
      throw new Error(`El envío falló. Mensaje: ${message}`);
    }
    console.log(`-> Envío exitoso. Mensaje: "${message.split('\n')[0]}"`);
    console.log(`-> Hash de la transacción: ${txHash}`);

    // 5. Verificar que la transacción fue exitosa en la blockchain
    console.log('\nPASO 5: Verificando la transacción en Celo Alfajores...');
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