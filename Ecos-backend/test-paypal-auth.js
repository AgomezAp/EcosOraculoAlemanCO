/**
 * Script de prueba para verificar autenticación de PayPal
 * Ejecutar con: node test-paypal-auth.js
 */

require('dotenv').config();
const axios = require('axios');

const PAYPAL_API_CLIENT = process.env.PAYPAL_API_CLIENT;
const PAYPAL_API_SECRET = process.env.PAYPAL_API_SECRET;
const PAYPAL_API = process.env.PAYPAL_API;

console.log('\n========================================');
console.log('🔍 VERIFICACIÓN DE CREDENCIALES PAYPAL');
console.log('========================================\n');

console.log('📋 Variables de entorno cargadas:');
console.log('PAYPAL_API_CLIENT:', PAYPAL_API_CLIENT ? `${PAYPAL_API_CLIENT.substring(0, 20)}...` : '❌ NO ENCONTRADO');
console.log('PAYPAL_API_SECRET:', PAYPAL_API_SECRET ? `${PAYPAL_API_SECRET.substring(0, 10)}...` : '❌ NO ENCONTRADO');
console.log('PAYPAL_API:', PAYPAL_API || '❌ NO ENCONTRADO');
console.log('');

if (!PAYPAL_API_CLIENT || !PAYPAL_API_SECRET) {
  console.error('❌ ERROR: Credenciales de PayPal no configuradas en .env');
  process.exit(1);
}

async function testPayPalAuth() {
  try {
    console.log('🔄 Intentando autenticar con PayPal...\n');
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(
      `${PAYPAL_API}/v1/oauth2/token`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: PAYPAL_API_CLIENT,
          password: PAYPAL_API_SECRET,
        },
      }
    );

    console.log('✅ AUTENTICACIÓN EXITOSA!\n');
    console.log('📄 Respuesta de PayPal:');
    console.log('  - Scope:', response.data.scope);
    console.log('  - Access Token:', response.data.access_token.substring(0, 30) + '...');
    console.log('  - Token Type:', response.data.token_type);
    console.log('  - App ID:', response.data.app_id);
    console.log('  - Expira en:', response.data.expires_in, 'segundos');
    console.log('\n✅ Las credenciales de PayPal son VÁLIDAS');
    console.log('');
    
    return true;
  } catch (error) {
    console.error('\n❌ ERROR DE AUTENTICACIÓN\n');
    
    if (error.response) {
      console.error('📄 Respuesta del servidor PayPal:');
      console.error('  - Status:', error.response.status);
      console.error('  - Error:', JSON.stringify(error.response.data, null, 2));
      console.error('');
      
      if (error.response.data.error === 'invalid_client') {
        console.error('💡 POSIBLES CAUSAS:');
        console.error('  1. Client ID incorrecto');
        console.error('  2. Secret Key incorrecto');
        console.error('  3. Credenciales de producción en URL de sandbox (o viceversa)');
        console.error('  4. Espacios en blanco al inicio/final de las credenciales');
        console.error('');
        console.error('🔧 SOLUCIÓN:');
        console.error('  - Verifica que PAYPAL_API_CLIENT y PAYPAL_API_SECRET sean correctos');
        console.error('  - Asegúrate de usar credenciales de SANDBOX con https://api-m.sandbox.paypal.com');
        console.error('  - Revisa que no haya comillas ni espacios en el archivo .env');
      }
    } else if (error.request) {
      console.error('📡 No se recibió respuesta del servidor PayPal');
      console.error('  - Verifica tu conexión a internet');
      console.error('  - Verifica que PAYPAL_API sea correcto:', PAYPAL_API);
    } else {
      console.error('⚠️ Error configurando la petición:', error.message);
    }
    
    console.error('');
    return false;
  }
}

testPayPalAuth()
  .then(success => {
    if (success) {
      console.log('========================================');
      console.log('✅ PRUEBA COMPLETADA CON ÉXITO');
      console.log('========================================\n');
      process.exit(0);
    } else {
      console.log('========================================');
      console.log('❌ PRUEBA FALLIDA');
      console.log('========================================\n');
      process.exit(1);
    }
  });
