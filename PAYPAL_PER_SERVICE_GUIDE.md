# 🔐 Guía de Pagos por Servicio Individual - PayPal

## 📋 Resumen Ejecutivo

**IMPORTANTE**: Cada servicio requiere un pago **INDIVIDUAL y SEPARADO**. Pagar por un servicio NO desbloquea otros servicios.

Esta guía explica cómo implementar pagos PayPal individuales para cada componente de Ecos del Oráculo.

---

## ✅ Componente Completado: Mapa Vocacional (Berufskarte)

### Estado
- ✅ **Migrado completamente a PayPal**
- ✅ **Pago exclusivo para este servicio**
- ✅ **Mensaje de confirmación visible en alemán**
- ✅ **SessionStorage específico**: `hasUserPaidForVocational_berufskarte`

### Ruta Angular
```
/berufskarte
```

---

## 🔄 Servicios Pendientes de Migración

| Servicio | Ruta Angular | Variable SessionStorage Sugerida | Estado |
|----------|--------------|----------------------------------|--------|
| **Interpretador de Sueños** | `/traumdeutung` | `hasUserPaidForDreams_traumdeutung` | ⏳ Pendiente |
| **Numerología** | `/numerologie-lesung` | `hasUserPaidForNumerology_numerologie` | ⏳ Pendiente |
| **Animal Interior** | `/inneres-tier` | `hasUserPaidForAnimal_inneresTier` | ⏳ Pendiente |
| **Tabla de Nacimiento** | `/geburtstabelle` | `hasUserPaidForBirthTable_geburtstabelle` | ⏳ Pendiente |
| **Zodiaco Chino** | `/horoskop` | `hasUserPaidForChineseZodiac_horoskop` | ⏳ Pendiente |
| **Calculadora de Amor** | `/liebesrechner` | `hasUserPaidForLove_liebesrechner` | ⏳ Pendiente |
| **Información del Zodiaco** | `/zodiac-information` | `hasUserPaidForZodiacInfo_zodiacInfo` | ⏳ Pendiente |

---

## 🛠️ Pasos de Implementación por Componente

### 1️⃣ Importar PayPal Service

```typescript
import { PaypalService } from '../../services/paypal.service';

export class TuComponente {
  private paypalService = inject(PaypalService);
  private cdr = inject(ChangeDetectorRef);
  
  // Variables de pago
  hasUserPaidForThisService = false;  // ⚠️ Cambiar nombre según servicio
  showPaymentModal = false;
  isProcessingPayment = false;
  paymentError: string | null = null;
}
```

---

### 2️⃣ Configurar ngOnInit con Verificación de Pago

```typescript
async ngOnInit(): Promise<void> {
  // ✅ PASO 1: Verificar si ya pagó este servicio ESPECÍFICO
  this.hasUserPaidForThisService =
    sessionStorage.getItem('hasUserPaidForThisService_ROUTE') === 'true';

  // ✅ PASO 2: Verificar pago en URL después de redirección
  const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

  if (paymentStatus && paymentStatus.status === 'COMPLETED') {
    try {
      const verification = await this.paypalService.verifyAndProcessPayment(
        paymentStatus.token
      );

      if (verification.valid && verification.status === 'approved') {
        // ✅ PASO 3: Guardar pago SOLO para este servicio
        this.hasUserPaidForThisService = true;
        sessionStorage.setItem('hasUserPaidForThisService_ROUTE', 'true');
        
        // ⚠️ IMPORTANTE: NO guardar en localStorage global
        localStorage.removeItem('paypal_payment_completed'); 

        // ✅ PASO 4: Limpiar bloqueos del servicio
        this.blockedMessageId = null;
        sessionStorage.removeItem('thisServiceBlockedMessageId');

        // ✅ PASO 5: Limpiar URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );

        // Cerrar modal de pago
        this.showPaymentModal = false;
        this.isProcessingPayment = false;
        this.paymentError = null;
        this.cdr.markForCheck();

        // ✅ PASO 6: MENSAJE DE CONFIRMACIÓN VISIBLE
        setTimeout(() => {
          this.addMessage({
            sender: this.counselorInfo.name,
            content:
              '🎉 Zahlung erfolgreich abgeschlossen!\n\n' +
              '✨ Vielen Dank für deine Zahlung. Du hast jetzt vollen Zugriff auf [NOMBRE DEL SERVICIO EN ALEMÁN].\n\n' +
              '💫 Lass uns gemeinsam [DESCRIPCIÓN DEL SERVICIO]!\n\n' +
              '📌 Hinweis: Diese Zahlung gilt nur für den [NOMBRE]-Service. Für andere Dienste ist eine separate Zahlung erforderlich.',
            timestamp: new Date(),
            isUser: false,
          });

          this.cdr.detectChanges();
          setTimeout(() => {
            this.scrollToBottom();
            this.cdr.markForCheck();
          }, 200);
        }, 1000);

      } else {
        // ⚠️ Pago no válido
        this.paymentError = 'Die Zahlung konnte nicht verifiziert werden.';
        
        setTimeout(() => {
          this.addMessage({
            sender: this.counselorInfo.name,
            content:
              '⚠️ Es gab ein Problem bei der Verifizierung deiner Zahlung. Bitte versuche es erneut oder kontaktiere unseren Support.',
            timestamp: new Date(),
            isUser: false,
          });
          this.cdr.detectChanges();
        }, 800);
      }
    } catch (error) {
      console.error('Error verificando pago de PayPal:', error);
      this.paymentError = 'Fehler bei der Zahlungsüberprüfung';
      
      setTimeout(() => {
        this.addMessage({
          sender: this.counselorInfo.name,
          content:
            '❌ Leider ist ein Fehler bei der Zahlungsüberprüfung aufgetreten. Bitte versuche es später erneut.',
          timestamp: new Date(),
          isUser: false,
        });
        this.cdr.detectChanges();
      }, 800);
    }
  }
}
```

---

### 3️⃣ Método de Envío de Pago

```typescript
async handlePaymentSubmit(): Promise<void> {
  if (this.isProcessingPayment) {
    return;
  }

  this.isProcessingPayment = true;
  this.paymentError = null;

  try {
    await this.paypalService.initiatePayment({
      amount: '5.00',  // ⚠️ Cambiar según el precio del servicio
      currency: 'EUR',
      serviceName: 'NOMBRE_DEL_SERVICIO',
      returnPath: '/RUTA-ANGULAR-EN-ALEMAN',  // ⚠️ Ver tabla arriba
      cancelPath: '/RUTA-ANGULAR-EN-ALEMAN',
    });
  } catch (error) {
    console.error('Error al iniciar pago:', error);
    this.paymentError = 'Fehler beim Starten der Zahlung';
    this.isProcessingPayment = false;
  }
}
```

---

## 📝 Checklist de Migración por Servicio

Para **cada componente**:

- [ ] 1. Importar `PaypalService` y `ChangeDetectorRef`
- [ ] 2. Crear variables: `hasUserPaidForThisService`, `showPaymentModal`, `isProcessingPayment`, `paymentError`
- [ ] 3. Cambiar `hasUserPaidForThisService` por nombre específico (ej: `hasUserPaidForDreams`)
- [ ] 4. Implementar `ngOnInit()` con verificación de pago
- [ ] 5. Crear `sessionStorage` único: `hasUserPaidForXXX_ROUTE`
- [ ] 6. Implementar `handlePaymentSubmit()` con la ruta correcta en alemán
- [ ] 7. Personalizar mensaje de confirmación en alemán con nombre del servicio
- [ ] 8. Verificar que NO se use `localStorage.getItem('paypal_payment_completed')`
- [ ] 9. Probar flujo completo: modal → PayPal → redirección → mensaje visible
- [ ] 10. Verificar que pagar un servicio NO desbloquee otros servicios

---

## 🚨 Errores Comunes a Evitar

### ❌ ERROR 1: Usar localStorage global
```typescript
// ❌ MAL - Esto desbloqueará TODOS los servicios
localStorage.setItem('paypal_payment_completed', 'true');
```

```typescript
// ✅ BIEN - Pago específico por servicio
sessionStorage.setItem('hasUserPaidForDreams_traumdeutung', 'true');
```

---

### ❌ ERROR 2: Ruta en inglés
```typescript
// ❌ MAL - Angular no encontrará la ruta
returnPath: '/dream-interpreter'
```

```typescript
// ✅ BIEN - Ruta en alemán según app.routes.ts
returnPath: '/traumdeutung'
```

---

### ❌ ERROR 3: Variable genérica
```typescript
// ❌ MAL - Difícil de mantener
hasUserPaid = true;
```

```typescript
// ✅ BIEN - Específico y claro
hasUserPaidForDreams_traumdeutung = true;
```

---

### ❌ ERROR 4: Mensaje sin retraso
```typescript
// ❌ MAL - El mensaje puede no mostrarse
this.addMessage({ ... });
```

```typescript
// ✅ BIEN - Esperar a que la vista esté renderizada
setTimeout(() => {
  this.addMessage({ ... });
  this.cdr.detectChanges();
  setTimeout(() => this.scrollToBottom(), 200);
}, 1000);
```

---

## 🧪 Pruebas de Verificación

### Caso de Prueba 1: Pago Individual
1. ✅ Ir a `/berufskarte` (Mapa Vocacional)
2. ✅ Pagar el servicio
3. ✅ Verificar que se desbloquea el contenido
4. ✅ Ir a `/traumdeutung` (Sueños)
5. ✅ **VERIFICAR QUE SIGUE BLOQUEADO** ← Crítico

### Caso de Prueba 2: Mensajes Visibles
1. ✅ Completar pago en PayPal
2. ✅ Esperar redirección
3. ✅ **VERIFICAR QUE APARECE MENSAJE DE CONFIRMACIÓN**
4. ✅ Verificar que el mensaje incluye el nombre del servicio
5. ✅ Verificar que indica que el pago es solo para ese servicio

### Caso de Prueba 3: SessionStorage Aislado
1. ✅ Pagar `/berufskarte`
2. ✅ Abrir DevTools → Application → Session Storage
3. ✅ Verificar que existe `hasUserPaidForVocational_berufskarte = 'true'`
4. ✅ Verificar que NO existe `hasUserPaidForDreams_traumdeutung`
5. ✅ Cerrar pestaña y volver a abrir → Servicio bloqueado de nuevo

---

## 📊 Estado Actual del Proyecto

### ✅ Completado
- Backend PayPal configurado (`/api/paypal/create-order`, `/api/paypal/capture-order`, `/api/paypal/verify-token`)
- Servicio PayPal Angular con soporte de rutas dinámicas
- Mapa Vocacional (`/berufskarte`) migrado con pago individual
- Documentación de rutas alemanas (`RUTAS_ANGULAR_ALEMAN.md`)
- Eliminación de métodos globales de pago (`hasCompletedPayment()` removido)

### ⏳ Pendiente
- Migrar 7 componentes restantes siguiendo esta guía
- Probar flujo completo de cada servicio
- Configurar credenciales de producción de PayPal

---

## 🔗 Referencias

- **Rutas Angular**: `RUTAS_ANGULAR_ALEMAN.md`
- **Backend PayPal**: `Ecos-backend/src/controllers/paypal.ts`
- **Frontend PayPal Service**: `Ecos-oraculo/src/app/services/paypal.service.ts`
- **Ejemplo Completo**: `Ecos-oraculo/src/app/components/mapa-vocacional/mapa-vocacional.component.ts`

---

## 💡 Notas Finales

1. **SessionStorage vs LocalStorage**:
   - SessionStorage: Se borra al cerrar la pestaña (ideal para pagos por sesión)
   - LocalStorage: Persiste entre sesiones (NO usar para pagos individuales)

2. **Nombres de Variables**:
   - Usar nomenclatura descriptiva: `hasUserPaidForDreams_traumdeutung`
   - Incluir la ruta en el nombre para evitar confusiones

3. **Mensajes de Confirmación**:
   - Siempre en alemán
   - Incluir emoji de celebración 🎉
   - Mencionar el nombre específico del servicio
   - Indicar que el pago es solo para ese servicio

4. **Testing**:
   - Probar cada servicio individualmente
   - Verificar que los pagos NO se crucen entre servicios
   - Confirmar que los mensajes aparecen correctamente

---

**Última actualización**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Estado del proyecto**: Mapa Vocacional completado, 7 servicios pendientes
