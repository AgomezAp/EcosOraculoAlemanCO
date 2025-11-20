# Guía de Integración PayPal - Rutas Dinámicas por Servicio

## 📍 Problema Resuelto

Cada servicio de la aplicación (Mapa Vocacional, Significado de Sueños, Zodiaco Chino, etc.) tiene su propia URL. Cuando un usuario paga, debe regresar a la página del servicio que solicitó el pago.

## 🔧 Solución Implementada

El backend de PayPal ahora acepta **rutas dinámicas** para cada servicio, permitiendo que cada componente especifique a dónde debe regresar el usuario después del pago.

---

## 📡 Backend - API PayPal

### Endpoint: `POST /api/paypal/create-order`

**Body de la petición:**
```json
{
  "amount": "5.00",           // Monto del pago (opcional, default: "5.00")
  "currency": "USD",          // Moneda (opcional, default: "USD")
  "serviceName": "Mapa Vocacional",  // Nombre del servicio
  "returnPath": "/vocational-map",   // Ruta donde volver después del pago exitoso
  "cancelPath": "/vocational-map"    // Ruta si el usuario cancela el pago
}
```

**Respuesta:**
```json
{
  "id": "ORDER_ID",
  "status": "CREATED",
  "links": [
    {
      "href": "https://www.sandbox.paypal.com/checkoutnow?token=XXX",
      "rel": "approve",
      "method": "GET"
    }
  ]
}
```

---

## 🎨 Frontend - Uso en Componentes

### 1. Importar el servicio PayPal

```typescript
import { PaypalService } from '../../services/paypal.service';

constructor(
  private paypalService: PaypalService
) {}
```

### 2. Configurar datos de la orden en `handlePaymentSubmit()`

```typescript
async handlePaymentSubmit(): Promise<void> {
  this.isProcessingPayment = true;
  this.paymentError = null;

  try {
    // Configurar datos específicos del servicio
    const orderData = {
      amount: '5.00',                    // Monto del servicio
      currency: 'USD',                   // Moneda
      serviceName: 'Mapa Vocacional',    // Nombre del servicio
      returnPath: '/vocational-map',     // ⚠️ IMPORTANTE: Tu ruta específica
      cancelPath: '/vocational-map'      // Ruta si cancela
    };

    // Iniciar pago (redirige a PayPal)
    await this.paypalService.initiatePayment(orderData);

    // El código después de esto NO se ejecuta (redirige a PayPal)
  } catch (error: any) {
    this.paymentError = error.message || 'Error al iniciar pago';
    this.isProcessingPayment = false;
  }
}
```

---

## 🗺️ Rutas por Servicio

Configura `returnPath` y `cancelPath` según tu componente:

| Servicio | Ruta Angular | returnPath | cancelPath |
|----------|--------------|------------|------------|
| Mapa Vocacional | `/vocational-map` | `/vocational-map` | `/vocational-map` |
| Significado de Sueños | `/dream-interpreter` | `/dream-interpreter` | `/dream-interpreter` |
| Zodiaco Chino | `/chinese-zodiac` | `/chinese-zodiac` | `/chinese-zodiac` |
| Animal Interior | `/inner-animal` | `/inner-animal` | `/inner-animal` |
| Tabla de Nacimiento | `/birth-chart` | `/birth-chart` | `/birth-chart` |
| Calculadora de Amor | `/love-calculator` | `/love-calculator` | `/love-calculator` |
| Lectura Numerología | `/numerology` | `/numerology` | `/numerology` |
| Información Zodiaco | `/zodiac-info` | `/zodiac-info` | `/zodiac-info` |

---

## 🔄 Flujo Completo del Pago

### 1️⃣ Usuario hace clic en "Pagar"
```typescript
handlePaymentSubmit() {
  // Configura orderData con returnPath específico
  await this.paypalService.initiatePayment(orderData);
}
```

### 2️⃣ Backend crea orden con rutas dinámicas
```typescript
// Backend recibe:
{
  returnPath: "/vocational-map",
  cancelPath: "/vocational-map"
}

// Genera return_url:
return_url: "http://localhost:3010/api/paypal/capture-order?service=%2Fvocational-map"
```

### 3️⃣ Usuario aprueba pago en PayPal
- PayPal redirige a: `http://localhost:3010/api/paypal/capture-order?token=XXX&service=%2Fvocational-map`

### 4️⃣ Backend captura pago y redirige
```typescript
// Backend decodifica service y redirige:
res.redirect(`http://localhost:4200/vocational-map?status=COMPLETED&token=JWT_TOKEN`)
```

### 5️⃣ Componente verifica pago en ngOnInit()
```typescript
ngOnInit() {
  const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();
  
  if (paymentStatus && paymentStatus.status === 'COMPLETED') {
    // Verificar token JWT
    const verification = await this.paypalService.verifyAndProcessPayment(paymentStatus.token);
    
    if (verification.valid) {
      // Pago confirmado - desbloquear contenido
      this.hasUserPaidForService = true;
    }
  }
}
```

---

## ⚙️ Variables de Entorno

### Backend `.env`
```env
PAYPAL_API_CLIENT=AXKw...
PAYPAL_API_SECRET=EDXt...
PAYPAL_API=https://api-m.sandbox.paypal.com
HOST=http://localhost:4200
JWT_SECRET_KEY=EcosDelOraculoJWT2025SecretKey
```

### Frontend `environment.ts`
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3010/'
};
```

---

## 📝 Ejemplo Completo - Mapa Vocacional

```typescript
import { PaypalService } from '../../services/paypal.service';

export class MapaVocacionalComponent implements OnInit {
  hasUserPaidForVocational = false;
  showPaymentModal = false;
  isProcessingPayment = false;
  paymentError: string | null = null;

  constructor(private paypalService: PaypalService) {}

  async ngOnInit(): Promise<void> {
    // Verificar si viene de PayPal
    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      const verification = await this.paypalService.verifyAndProcessPayment(
        paymentStatus.token
      );

      if (verification.valid && verification.status === 'approved') {
        this.hasUserPaidForVocational = true;
        sessionStorage.setItem('hasUserPaidForVocational', 'true');
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;

    try {
      const orderData = {
        amount: '5.00',
        currency: 'USD',
        serviceName: 'Mapa Vocacional',
        returnPath: '/vocational-map',
        cancelPath: '/vocational-map'
      };

      await this.paypalService.initiatePayment(orderData);
    } catch (error: any) {
      this.paymentError = error.message;
      this.isProcessingPayment = false;
    }
  }
}
```

---

## 🚨 Notas Importantes

1. **returnPath debe coincidir con la ruta Angular**: Si tu componente está en `/vocational-map`, usa esa ruta exacta.

2. **El HOST en .env debe apuntar al frontend**: 
   - Desarrollo: `HOST=http://localhost:4200`
   - Producción: `HOST=https://tudominio.com`

3. **Las rutas son relativas**: No incluyas el dominio en `returnPath`, solo la ruta: `/vocational-map` ✅, no `http://localhost:4200/vocational-map` ❌

4. **Verifica siempre en ngOnInit()**: Cada componente debe verificar el pago al cargar.

5. **Limpia la URL después de verificar**: Usa `window.history.replaceState()` para eliminar los parámetros de la URL.

---

## 🔍 Debugging

Si el pago no funciona:

1. **Revisa la consola del navegador**: Busca errores de PayPal
2. **Revisa logs del backend**: Verás los logs de creación y captura de orden
3. **Verifica las rutas**: Asegúrate que `returnPath` coincide con la ruta Angular
4. **Verifica HOST en .env**: Debe apuntar al frontend correcto

---

## ✅ Checklist de Integración

- [ ] Importar `PaypalService` en el componente
- [ ] Configurar `orderData` con `returnPath` y `cancelPath` específicos
- [ ] Implementar `handlePaymentSubmit()` con los datos correctos
- [ ] Verificar pago en `ngOnInit()` usando `checkPaymentStatusFromUrl()`
- [ ] Guardar estado del pago en `sessionStorage`
- [ ] Limpiar URL después de verificar
- [ ] Probar flujo completo: pago → PayPal → retorno → verificación

---

¡Listo! Cada servicio ahora puede redirigir a su propia página después del pago. 🎉
