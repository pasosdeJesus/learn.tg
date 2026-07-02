#!/usr/bin/env node

/**
 * Autenticación con manejo manual de cookies
 */

import 'dotenv/config';
import axios from 'axios';
import https from 'https';
import { SiweMessage } from 'siwe';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

// Funciones para manejo de cookies
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

const BASE_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'https://learn.tg:9001';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://learn.tg:3500/learntg-admin';
const CHAIN_ID = 11142220;

// Función para obtener perfil de usuario desde la API de Rails
async function getUserProfile(httpsAgent, cookiesString, walletAddress, csrfToken) {
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
        'Cookie': cookiesString || '',
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

// Generar billetera aleatoria
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
console.log('🔐 Autenticación con billetera aleatoria');
console.log(`Billetera: ${account.address}`);
console.log(`Clave privada: ${privateKey.slice(0, 10)}...\n`);

// Configurar agente HTTPS
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Variable para almacenar cookies
let cookies = '';

// Crear instancia de axios
const api = axios.create({
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
api.interceptors.response.use((response) => {
  const setCookie = response.headers['set-cookie'];
  if (setCookie) {
    cookies = updateCookies(cookies, setCookie);
    console.log(`📦 Cookies actualizadas: ${cookies.slice(0, 80)}...`);
  }
  return response;
});

// Interceptor para enviar cookies en cada request
api.interceptors.request.use((config) => {
  if (cookies) {
    config.headers.Cookie = cookies;
    console.log(`📤 Enviando cookies: ${cookies.slice(0, 80)}...`);
  }
  return config;
});

async function main() {
  try {
    // 1. Obtener CSRF token
    console.log('\n1. GET /api/auth/csrf');
    const csrfRes = await api.get('/api/auth/csrf');
    console.log(`   Status: ${csrfRes.status}`);
    const csrfToken = csrfRes.data.csrfToken;
    console.log(`   Token: ${csrfToken.slice(0, 10)}...`);

    // 2. Construir mensaje SIWE
    console.log('\n2. Construyendo SIWE message...');
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

    const message = siweMessage.prepareMessage();
    console.log(`   Message start: ${message.slice(0, 100)}...`);

    // 3. Firmar
    console.log('\n3. Firmando...');
    const signature = await account.signMessage({ message });
    console.log(`   Signature: ${signature.slice(0, 10)}...`);

    // 4. Autenticar - probar diferentes endpoints y formatos
    console.log('\n4. Probando diferentes endpoints de autenticación...');

    // Formato 1: /api/auth/callback/credentials (form data)
    console.log('\n   a) POST /api/auth/callback/credentials (form data)');
    const formData = new URLSearchParams();
    formData.append('csrfToken', csrfToken);
    formData.append('message', message);
    formData.append('signature', signature);
    formData.append('redirect', 'false');
    formData.append('callbackUrl', `${BASE_URL}/`);
    formData.append('json', 'true');

    try {
      const res1 = await api.post('/api/auth/callback/credentials', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      console.log(`      Status: ${res1.status}`);
      console.log(`      Location: ${res1.headers.location || '(none)'}`);
      if (res1.data) console.log(`      Data: ${JSON.stringify(res1.data)}`);
    } catch (error) {
      console.log(`      Error: ${error.message}`);
      if (error.response) {
        console.log(`      Status: ${error.response.status}`);
        console.log(`      Data: ${JSON.stringify(error.response.data)}`);
      }
    }

    // Formato 2: /api/auth/[...nextauth] (JSON)
    console.log('\n   b) POST /api/auth/[...nextauth] (JSON)');
    const jsonData = {
      csrfToken,
      message,
      signature,
      redirect: false,
      callbackUrl: `${BASE_URL}/`,
      json: true,
    };

    try {
      const res2 = await api.post('/api/auth/[...nextauth]', jsonData, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(`      Status: ${res2.status}`);
      console.log(`      Location: ${res2.headers.location || '(none)'}`);
      if (res2.data) console.log(`      Data: ${JSON.stringify(res2.data)}`);
    } catch (error) {
      console.log(`      Error: ${error.message}`);
      if (error.response) {
        console.log(`      Status: ${error.response.status}`);
        console.log(`      Data: ${JSON.stringify(error.response.data)}`);
      }
    }

    // Formato 3: /api/auth/signin/credentials (form data)
    console.log('\n   c) POST /api/auth/signin/credentials (form data)');
    try {
      const res3 = await api.post('/api/auth/signin/credentials', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      console.log(`      Status: ${res3.status}`);
      console.log(`      Location: ${res3.headers.location || '(none)'}`);
      if (res3.data) console.log(`      Data: ${JSON.stringify(res3.data)}`);
    } catch (error) {
      console.log(`      Error: ${error.message}`);
      if (error.response) {
        console.log(`      Status: ${error.response.status}`);
        console.log(`      Data: ${JSON.stringify(error.response.data)}`);
      }
    }

    // 5. Verificar sesión
    console.log('\n5. GET /api/auth/session');
    try {
      const sessionRes = await api.get('/api/auth/session');
      console.log(`   Status: ${sessionRes.status}`);
      console.log(`   Data: ${JSON.stringify(sessionRes.data)}`);
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }

    // 6. Nuevo CSRF token
    console.log('\n6. Nuevo CSRF token');
    let newToken = csrfToken;
    try {
      const newCsrfRes = await api.get('/api/auth/csrf');
      newToken = newCsrfRes.data.csrfToken;
      console.log(`   Status: ${newCsrfRes.status}`);
      console.log(`   Token: ${newToken.slice(0, 10)}...`);
      console.log(`   ¿Diferente? ${newToken !== csrfToken ? 'Sí' : 'No'}`);
      console.log(`   💡 Token para update-scores: ${newToken.slice(0, 10)}...`);
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }

    // 6.5 Obtener perfil inicial antes de update-scores
    console.log('\n6.5 Perfil inicial desde API...');
    let initialProfile = null;
    try {
      initialProfile = await getUserProfile(httpsAgent, cookies, account.address, newToken);
      if (initialProfile) {
        console.log(`   Profile score inicial: ${initialProfile.profilescore}`);
        console.log(`   Learning score inicial: ${initialProfile.learningscore}`);
      } else {
        console.log('   ❌ No se pudo obtener perfil inicial');
      }
    } catch (error) {
      console.log(`   Error obteniendo perfil inicial: ${error.message}`);
    }

    // 7. Actualizar puntaje de perfil
    console.log('\n7. Actualizando puntaje de perfil (update-scores)...');
    try {
      const response = await api.post('/api/update-scores', {
        lang: 'en',
        walletAddress: account.address,
        token: newToken,
      });
      console.log(`   Status: ${response.status}`);
      console.log(`   Profile score: ${response.data.profilescore}`);
      console.log(`   Learning score: ${response.data.learningscore}`);
      console.log(`   Message: ${response.data.message}`);
      if (response.data.profilescore >= 50) {
        console.log(`   ✅ Puntaje suficiente para becas (${response.data.profilescore} puntos)`);
      } else {
        console.log(`   ⚠️  Puntaje insuficiente: ${response.data.profilescore} (se necesitan 50+)`);
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
    }

    // 8. Verificar perfil después de update-scores
    console.log('\n8. Verificando perfil después de update-scores...');
    let updatedProfile = null;
    try {
      updatedProfile = await getUserProfile(httpsAgent, cookies, account.address, newToken);
      if (updatedProfile) {
        console.log(`   Profile score final: ${updatedProfile.profilescore}`);
        console.log(`   Learning score final: ${updatedProfile.learningscore}`);
        if (updatedProfile.profilescore === 52) {
          console.log('   ✅ Puntaje correcto (52) en perfil API');
        } else {
          console.log(`   ❌ Puntaje incorrecto en perfil API: ${updatedProfile.profilescore} (esperado 52)`);
        }
      } else {
        console.log('   ❌ No se pudo obtener perfil actualizado');
      }
    } catch (error) {
      console.log(`   Error obteniendo perfil actualizado: ${error.message}`);
    }

    console.log('\n🎯 Script completado.');
    console.log(`Cookies finales: ${cookies ? cookies.slice(0, 100) + '...' : '(none)'}`);

  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Headers: ${JSON.stringify(error.response.headers)}`);
    }
    process.exit(1);
  }
}

main();