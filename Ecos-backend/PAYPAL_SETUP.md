# Variables de Entorno para PayPal

Agrega estas variables a tu archivo `.env` en la carpeta `Ecos-backend`:

```env
# ===== PAYPAL CONFIGURATION =====
# Credenciales de la API de PayPal
PAYPAL_API_CLIENT=tu_client_id_de_paypal
PAYPAL_API_SECRET=tu_secret_de_paypal

# URL base de la API de PayPal
# Para producción: https://api-m.paypal.com
# Para sandbox/pruebas: https://api-m.sandbox.paypal.com
PAYPAL_API=https://api-m.sandbox.paypal.com

# URL del host (tu dominio o localhost para desarrollo)
# Ejemplo para desarrollo: http://localhost:4200
# Ejemplo para producción: https://tudominio.com
HOST=http://localhost:4200

# Secret key para JWT (debe ser una clave segura y única)
# Genera una con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRET_KEY=tu_secret_key_para_jwt_aqui
```

## Cómo obtener las credenciales de PayPal

### 1. Crear una cuenta de desarrollador de PayPal
- Ve a: https://developer.paypal.com/
- Inicia sesión o crea una cuenta

### 2. Crear una aplicación
1. Ve al Dashboard de desarrollador
2. Navega a "Apps & Credentials"
3. Haz clic en "Create App"
4. Elige "Merchant" como tipo de integración
5. Dale un nombre a tu aplicación

### 3. Obtener las credenciales
- **Client ID**: Lo encontrarás en la sección "REST API apps" de tu aplicación
- **Secret**: Haz clic en "Show" debajo del Client ID para revelar el Secret

### 4. Modo Sandbox vs Producción
- **Sandbox**: Para pruebas (usa `https://api-m.sandbox.paypal.com`)
  - Puedes crear cuentas de prueba en el Dashboard
  - No se procesa dinero real
  
- **Producción**: Para pagos reales (usa `https://api-m.paypal.com`)
  - Debes cambiar las credenciales de Sandbox a Live
  - Se procesará dinero real

## Configuración de URLs de retorno

Las URLs configuradas en el controlador son:

- **return_url**: `${HOST}/api/paypal/capture-order` - A donde PayPal redirige después de aprobar el pago
- **cancel_url**: `${HOST}/payment-cancelled` - A donde redirige si el usuario cancela

Asegúrate de que estas rutas existan en tu frontend.

## Endpoints disponibles

Una vez configurado, tendrás estos endpoints:

```
POST   /api/paypal/create-order       - Crea una nueva orden de pago
GET    /api/paypal/capture-order      - Captura el pago (callback de PayPal)
GET    /api/paypal/cancel             - Maneja la cancelación
POST   /api/paypal/verify-token       - Verifica el token JWT del pago
```

## Ejemplo de uso desde el frontend

```typescript
// Crear una orden
const response = await fetch('http://localhost:3010/api/paypal/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
});

const data = await response.json();

// Redirigir al usuario a PayPal para aprobar el pago
const approveLink = data.links.find(link => link.rel === 'approve');
window.location.href = approveLink.href;
```

## Notas importantes

1. El precio está hardcodeado en `5.00 USD` en el controlador. Puedes modificarlo o hacerlo dinámico según tus necesidades.

2. El `brand_name` está configurado como "Ecos del Oráculo". Cámbialo si lo deseas.

3. Los tokens JWT expiran en 5 minutos por seguridad. Ajusta según necesites.

4. Asegúrate de que tu `SECRET_KEY` sea segura y única. Nunca la compartas públicamente.
