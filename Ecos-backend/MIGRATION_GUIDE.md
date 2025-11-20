# 🔄 Guía de Migración de Stripe a PayPal

## Cambios Necesarios en Cada Componente

### 1. Imports a Reemplazar

**❌ ELIMINAR:**
```typescript
import {
  loadStripe,
  Stripe,
  StripeElements,
  StripePaymentElement,
} from '@stripe/stripe-js';
```

**✅ AGREGAR:**
```typescript
import { PaypalService } from '../../services/paypal.service';
```

### 2. Variables de Clase a Reemplazar

**❌ ELIMINAR:**
```typescript
stripe: Stripe | null = null;
elements: StripeElements | undefined;
paymentElement: StripePaymentElement | undefined;
clientSecret: string | null = null;
isProcessingPayment: boolean = false;
paymentError: string | null = null;
private stripePublishableKey = 'pk_test_...';
private backendUrl = environment.apiUrl;
```

**✅ REEMPLAZAR POR:**
```typescript
isProcessingPayment: boolean = false;
paymentError: string | null = null;
```

### 3. Inyección en Constructor

**❌ ELIMINAR:**
```typescript
private http: HttpClient
```

**✅ AGREGAR:**
```typescript
private paypalService: PaypalService
```

### 4. Método ngOnInit() - Eliminar Inicialización de Stripe

**❌ ELIMINAR:**
```typescript
async ngOnInit() {
  // Inicializar Stripe
  try {
    this.stripe = await loadStripe(this.stripePublishableKey);
  } catch (error) {
    console.error('Error loading Stripe.js:', error);
  }
  
  // Verificar payment_intent en URL...
  const urlParams = new URLSearchParams(window.location.search);
  const paymentIntent = urlParams.get('payment_intent');
  const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
  
  if (paymentIntent && paymentIntentClientSecret && this.stripe) {
    this.stripe
      .retrievePaymentIntent(paymentIntentClientSecret)
      .then(({ paymentIntent }) => {
        // ... manejo de payment intent
      });
  }
}
```

**✅ REEMPLAZAR POR:**
```typescript
async ngOnInit() {
  // Verificar si venimos de PayPal después de un pago
  const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();
  
  if (paymentStatus && paymentStatus.status === 'COMPLETED') {
    try {
      const verification = await this.paypalService.verifyAndProcessPayment(paymentStatus.token);
      
      if (verification.valid && verification.status === 'approved') {
        this.hasUserPaidForVocational = true; // O el nombre que corresponda
        sessionStorage.setItem('hasUserPaidForVocational', 'true');
        
        this.blockedMessageId = null;
        sessionStorage.removeItem('vocationalBlockedMessageId');
        
        // Limpiar URL sin recargar la página
        window.history.replaceState({}, document.title, window.location.pathname);
        
        this.addMessage({
          sender: this.counselorInfo.name,
          content: '✨ Zahlung bestätigt! Jetzt kannst du auf all meine Erfahrung zugreifen.',
          timestamp: new Date(),
          isUser: false,
        });
        
        this.cdr.markForCheck();
      }
    } catch (error) {
      console.error('Error verificando pago de PayPal:', error);
      this.paymentError = 'Fehler bei der Zahlungsüberprüfung';
    }
  }
  
  // Verificar si ya hay un pago guardado
  this.hasUserPaidForVocational = this.paypalService.hasCompletedPayment() || 
    sessionStorage.getItem('hasUserPaidForVocational') === 'true';
  
  // ... resto del código de inicialización
}
```

### 5. Método promptForPayment() - Completamente Reemplazado

**❌ ELIMINAR TODO EL MÉTODO (incluye creación de payment intent, montaje de Stripe Elements, etc.)**

**✅ REEMPLAZAR POR:**
```typescript
async promptForPayment(): Promise<void> {
  this.showPaymentModal = true;
  this.cdr.markForCheck();
  this.paymentError = null;
  this.isProcessingPayment = false;

  // Validar que existan datos de usuario
  if (!this.userData) {
    const savedUserData = sessionStorage.getItem('userData');
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
      } catch (error) {
        this.userData = null;
      }
    }
  }

  if (!this.userData) {
    this.paymentError = 'Keine Kundendaten gefunden. Bitte füllen Sie das Formular zuerst aus.';
    this.showDataModal = true;
    this.cdr.markForCheck();
    return;
  }

  // Validación de email
  const email = this.userData.email?.toString().trim();
  if (!email) {
    this.paymentError = 'E-Mail erforderlich. Bitte füllen Sie das Formular aus.';
    this.showDataModal = true;
    this.cdr.markForCheck();
    return;
  }

  // Guardar mensaje pendiente si existe
  if (this.currentMessage) {
    sessionStorage.setItem('pendingVocationalMessage', this.currentMessage);
  }
}
```

### 6. Método handlePaymentSubmit() - Completamente Reemplazado

**❌ ELIMINAR TODO EL MÉTODO (confirmPayment con Stripe, manejo de paymentIntent, etc.)**

**✅ REEMPLAZAR POR:**
```typescript
async handlePaymentSubmit(): Promise<void> {
  this.isProcessingPayment = true;
  this.paymentError = null;
  this.cdr.markForCheck();

  try {
    // Iniciar el flujo de pago de PayPal
    // Esto redirigirá al usuario a PayPal
    await this.paypalService.initiatePayment();
    
    // La ejecución se detendrá aquí porque el usuario será redirigido
    // Cuando vuelva de PayPal, ngOnInit() manejará la verificación
  } catch (error: any) {
    this.paymentError = error.message || 'Fehler beim Initialisieren der PayPal-Zahlung.';
    this.isProcessingPayment = false;
    this.cdr.markForCheck();
  }
}
```

### 7. Método cancelPayment() - Simplificado

**❌ ELIMINAR:**
```typescript
cancelPayment(): void {
  this.showPaymentModal = false;
  this.clientSecret = null;
  if (this.paymentElement) {
    try {
      this.paymentElement.destroy();
    } catch (error) {}
    finally {
      this.paymentElement = undefined;
    }
  }
  this.isProcessingPayment = false;
  this.paymentError = null;
}
```

**✅ REEMPLAZAR POR:**
```typescript
cancelPayment(): void {
  this.showPaymentModal = false;
  this.isProcessingPayment = false;
  this.paymentError = null;
  this.cdr.markForCheck();
}
```

## Componentes a Actualizar

1. ✅ mapa-vocacional.component.ts
2. ✅ significado-suenos.component.ts
3. ✅ zodiaco-chino.component.ts
4. ✅ informacion-zodiaco.component.ts
5. ✅ lectura-numerologia.component.ts
6. ✅ animal-interior.component.ts
7. ✅ tabla-nacimiento.component.ts
8. ✅ calculadora-amor.component.ts

## Cambios en HTML/CSS

Los templates HTML pueden permanecer prácticamente iguales. Solo necesitas:

**❌ ELIMINAR del HTML:**
```html
<div id="payment-element-container"></div>
```

**✅ REEMPLAZAR POR:**
```html
<div class="paypal-info">
  <p>Al hacer clic en "Pagar", serás redirigido a PayPal para completar tu pago de forma segura.</p>
  <p><strong>Precio:</strong> €5.00</p>
</div>
```

## Variables de Entorno

No olvides configurar en `Ecos-backend/.env`:

```env
PAYPAL_API_CLIENT=tu_client_id
PAYPAL_API_SECRET=tu_secret
PAYPAL_API=https://api-m.sandbox.paypal.com
HOST=http://localhost:4200
SECRET_KEY=tu_secret_key_para_jwt
```

## Testing

Después de la migración, prueba:

1. ✅ Iniciar pago → debe redirigir a PayPal
2. ✅ Aprobar pago en PayPal → debe volver a la app y desbloquear contenido
3. ✅ Cancelar pago → debe permitir intentar de nuevo
4. ✅ Verificar que el pago se persiste en localStorage
5. ✅ Recargar la página → el contenido premium debe seguir desbloqueado

## Notas Importantes

- PayPal requiere redirección completa (no puede embeberse como Stripe)
- El flujo es: Modal → Clic en Pagar → Redirige a PayPal → Usuario aprueba → Vuelve a la app → Verificación
- El estado del pago se guarda en localStorage y sessionStorage
- No necesitas `@stripe/stripe-js` en package.json después de migrar
