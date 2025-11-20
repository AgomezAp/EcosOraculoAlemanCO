# 📋 INSTRUCCIONES PASO A PASO: Migración de Stripe a PayPal

## ✅ SERVICIO PAYPAL CREADO

Ya se creó el servicio de PayPal en:

- `src/app/services/paypal.service.ts` ✅

Este servicio centraliza toda la lógica de pagos y será usado por todos los componentes.

---

## 🔧 PASOS PARA CADA COMPONENTE

Debes aplicar estos cambios en **CADA UNO** de los siguientes componentes:

1. `mapa-vocacional.component.ts`
2. `significado-suenos.component.ts`
3. `zodiaco-chino.component.ts`
4. `informacion-zodiaco.component.ts`
5. `lectura-numerologia.component.ts`
6. `animal-interior.component.ts`
7. `tabla-nacimiento.component.ts`
8. `calculadora-amor.component.ts`

---

## 📝 CAMBIOS EXACTOS POR COMPONENTE

### PASO 1: Modificar Imports (Inicio del archivo)

**BUSCA estas líneas:**

```typescript
import { loadStripe, Stripe, StripeElements, StripePaymentElement } from "@stripe/stripe-js";
```

**ELIMÍNALAS completamente**

**AGREGA esta línea** (después de otros imports de servicios):

```typescript
import { PaypalService } from "../../services/paypal.service";
```

---

### PASO 2: Eliminar Variables de Stripe

**BUSCA y ELIMINA estas variables:**

```typescript
stripe: Stripe | null = null;
elements: StripeElements | undefined;
paymentElement: StripePaymentElement | undefined;
clientSecret: string | null = null;
private stripePublishableKey = 'pk_test_...';  // Esta línea completa
private backendUrl = environment.apiUrl;
```

**MANTÉN estas variables** (NO las elimines):

```typescript
showPaymentModal: boolean = false;
isProcessingPayment: boolean = false;
paymentError: string | null = null;
hasUserPaidForVocational: boolean = false;  // O el nombre que corresponda
```

---

### PASO 3: Actualizar Constructor

**BUSCA el constructor que se ve así:**

```typescript
constructor(
  private servicioX: ...,
  private http: HttpClient,
  private elRef: ElementRef<HTMLElement>,
  private cdr: ChangeDetectorRef
) {}
```

**AGREGA** `private paypalService: PaypalService` antes del cierre:

```typescript
constructor(
  private servicioX: ...,
  private http: HttpClient,
  private elRef: ElementRef<HTMLElement>,
  private cdr: ChangeDetectorRef,
  private paypalService: PaypalService  // ← AGREGAR ESTA LÍNEA
) {}
```

---

### PASO 4: Modificar ngOnInit()

**BUSCA** esta sección en `ngOnInit()`:

```typescript
// AGREGADO - Inicializar Stripe
try {
  this.stripe = await loadStripe(this.stripePublishableKey);
} catch (error) {
  this.paymentError = "...";
}
```

**REEMPLÁZALA** por:

```typescript
// Verificar si venimos de PayPal después de un pago
const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

if (paymentStatus && paymentStatus.status === "COMPLETED") {
  try {
    const verification = await this.paypalService.verifyAndProcessPayment(paymentStatus.token);

    if (verification.valid && verification.status === "approved") {
      this.hasUserPaidForVocational = true; // O el nombre correspondiente
      sessionStorage.setItem("hasUserPaidForVocational", "true");

      this.blockedMessageId = null;
      sessionStorage.removeItem("vocationalBlockedMessageId");

      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);

      this.addMessage({
        sender: this.counselorInfo.name, // O el nombre correspondiente
        content: "✨ Zahlung bestätigt! Jetzt kannst du auf all meine Erfahrung zugreifen.",
        timestamp: new Date(),
        isUser: false,
      });

      this.cdr.markForCheck();
    }
  } catch (error) {
    console.error("Error verificando pago de PayPal:", error);
    this.paymentError = "Fehler bei der Zahlungsüberprüfung";
  }
}

// Verificar si ya hay un pago guardado
this.hasUserPaidForVocacional = this.paypalService.hasCompletedPayment() || sessionStorage.getItem("hasUserPaidForVocational") === "true";
```

**TAMBIÉN BUSCA Y ELIMINA** esta sección completa si existe:

```typescript
// AGREGADO - Verificar URL para pagos exitosos
this.checkPaymentStatus();
```

Y elimina el método `checkPaymentStatus()` completo que se ve así:

```typescript
private checkPaymentStatus(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentIntent = urlParams.get('payment_intent');
  // ... resto del código
}
```

---

### PASO 5: Reemplazar promptForPayment()

**BUSCA** el método completo `async promptForPayment()` (puede tener 50-100 líneas)

**REEMPLÁZALO COMPLETAMENTE** por:

```typescript
async promptForPayment(): Promise<void> {
  this.showPaymentModal = true;
  this.cdr.markForCheck();
  this.paymentError = null;
  this.isProcessingPayment = false;

  // Validar datos de usuario
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

---

### PASO 6: Reemplazar handlePaymentSubmit()

**BUSCA** el método completo `async handlePaymentSubmit()` (puede tener 30-80 líneas)

**REEMPLÁZALO COMPLETAMENTE** por:

```typescript
async handlePaymentSubmit(): Promise<void> {
  this.isProcessingPayment = true;
  this.paymentError = null;
  this.cdr.markForCheck();

  try {
    // Iniciar el flujo de pago de PayPal (redirige al usuario)
    await this.paypalService.initiatePayment();

    // El código después de esta línea NO se ejecutará porque
    // el usuario será redirigido a PayPal
  } catch (error: any) {
    this.paymentError = error.message || 'Fehler beim Initialisieren der PayPal-Zahlung.';
    this.isProcessingPayment = false;
    this.cdr.markForCheck();
  }
}
```

---

### PASO 7: Simplificar cancelPayment()

**BUSCA** el método `cancelPayment()` que se ve así:

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

**REEMPLÁZALO** por:

```typescript
cancelPayment(): void {
  this.showPaymentModal = false;
  this.isProcessingPayment = false;
  this.paymentError = null;
  this.cdr.markForCheck();
}
```

---

### PASO 8: Limpiar ngOnDestroy()

**BUSCA** en `ngOnDestroy()` esta sección:

```typescript
if (this.paymentElement) {
  try {
    this.paymentElement.destroy();
  } catch (error) {
  } finally {
    this.paymentElement = undefined;
  }
}
```

**ELIM Í NALA completamente** (pero deja el resto de `ngOnDestroy()` intacto)

---

## ⚠️ NOTAS IMPORTANTES

1. **No cambies nombres de variables** que sean específicos del componente:

   - Algunos componentes usan `hasUserPaidForDreams` en vez de `hasUserPaidForVocational`
   - Algunos usan `dreamInterpreterInfo` en vez de `counselorInfo`
   - Mantén los nombres originales de cada componente

2. **Adapta los mensajes en alemán** si son diferentes en cada componente

3. **Verifica que compila** después de cada componente:

   ```bash
   ng build --watch
   ```

4. **No elimines** el código de la ruleta de premios si existe

---

## 🧪 TESTING DESPUÉS DE MIGRAR

Para cada componente migrado:

1. ✅ Abre el componente en el navegador
2. ✅ Intenta enviar un mensaje que requiera pago
3. ✅ Verifica que se abra el modal de pago
4. ✅ Haz clic en "Pagar"
5. ✅ Deberías ser redirigido a PayPal
6. ✅ Cancela o completa el pago
7. ✅ Verifica que vuelves a la aplicación
8. ✅ Si pagaste, verifica que el contenido se desbloquee

---

## 📊 PROGRESO DE MIGRACIÓN

Marca cada componente cuando lo completes:

- [x] mapa-vocacional.component.ts
- [x] significado-suenos.component.ts
- [ ] zodiaco-chino.component.ts
- [x] informacion-zodiaco.component.ts
- [x] lectura-numerologia.component.ts
- [x] animal-interior.component.ts
- [x] tabla-nacimiento.component.ts
- [x] calculadora-amor.component.ts

---

## 🆘 SI TIENES PROBLEMAS

**Error de compilación:**

- Verifica que eliminaste TODAS las referencias a `Stripe`, `StripeElements`, etc.
- Asegúrate de que agregaste `PaypalService` al constructor

**El pago no funciona:**

- Verifica las variables de entorno en `Ecos-backend/.env`
- Revisa la consola del navegador para errores
- Verifica que el backend esté corriendo

**No desbloquea el contenido:**

- Verifica que el nombre de la variable sea correcto (`hasUserPaidForVocational` o similar)
- Revisa que `sessionStorage` se esté guardando correctamente

---

¿Listo para comenzar? Empieza con un componente, pruébalo, y luego continúa con el siguiente. ¡Buena suerte! 🚀
