/**
 * EJEMPLO DE INTEGRACIÓN DE PAYPAL EN EL FRONTEND
 * 
 * Este archivo muestra cómo integrar PayPal en tu componente Angular
 */
/* 
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs'; */
/* 
@Injectable({
  providedIn: 'root'
}) */
/* export class PaypalService {
  private apiUrl = 'http://localhost:3010/api/paypal';

  constructor(private http: HttpClient) {}

  /**
   * Crea una orden de pago en PayPal
   */
/*   createOrder(): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-order`, {});
  }
 */
  /**
   * Verifica el token JWT del pago
   */
/*   verifyPaymentToken(token: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-token`, { token });
  } 
} 

// =============================================================================
// EJEMPLO DE USO EN UN COMPONENTE
// =============================================================================

/*
import { Component } from '@angular/core';
import { PaypalService } from './services/paypal.service';

@Component({
  selector: 'app-payment',
  template: `
    <div class="payment-container">
      <h2>Realizar Pago</h2>
      
      <div *ngIf="!loading" class="payment-info">
        <p>Precio: $5.00 USD</p>
        <button (click)="initPayPalPayment()" class="pay-button">
          Pagar con PayPal
        </button>
      </div>

      <div *ngIf="loading" class="loading">
        <p>Procesando pago...</p>
      </div>

      <div *ngIf="paymentStatus === 'success'" class="success">
        <h3>¡Pago exitoso!</h3>
        <p>Tu pago ha sido procesado correctamente.</p>
      </div>

      <div *ngIf="paymentStatus === 'error'" class="error">
        <h3>Error en el pago</h3>
        <p>Hubo un problema procesando tu pago. Intenta nuevamente.</p>
      </div>
    </div>
  `
})
export class PaymentComponent {
  loading = false;
  paymentStatus: 'success' | 'error' | null = null;

  constructor(private paypalService: PaypalService) {
    // Verificar si venimos de una redirección de PayPal
    this.checkPaymentStatus();
  }

  initPayPalPayment() {
    this.loading = true;

    this.paypalService.createOrder().subscribe({
      next: (response) => {
        console.log('Orden creada:', response);
        
        // Buscar el link de aprobación
        const approveLink = response.links?.find(
          (link: any) => link.rel === 'approve'
        );

        if (approveLink) {
          // Redirigir al usuario a PayPal
          window.location.href = approveLink.href;
        } else {
          console.error('No se encontró el link de aprobación');
          this.loading = false;
          this.paymentStatus = 'error';
        }
      },
      error: (error) => {
        console.error('Error al crear orden:', error);
        this.loading = false;
        this.paymentStatus = 'error';
      }
    });
  }

  checkPaymentStatus() {
    // Obtener parámetros de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const token = urlParams.get('token');

    if (status === 'COMPLETED' && token) {
      // Verificar el token con el backend
      this.paypalService.verifyPaymentToken(token).subscribe({
        next: (response) => {
          if (response.valid && response.status === 'approved') {
            this.paymentStatus = 'success';
            
            // Aquí puedes:
            // 1. Desbloquear contenido premium
            // 2. Actualizar el estado del usuario
            // 3. Guardar la transacción en tu base de datos
            console.log('Pago verificado:', response);
          } else {
            this.paymentStatus = 'error';
          }
        },
        error: (error) => {
          console.error('Error verificando token:', error);
          this.paymentStatus = 'error';
        }
      });
    } else if (status === 'NOT_COMPLETED' || status === 'ERROR') {
      this.paymentStatus = 'error';
    }
  }
}
*/

// =============================================================================
// EJEMPLO DE USO DIRECTO (SIN SERVICIO)
// =============================================================================

/*
export class SimplePaymentComponent {
  
  async payWithPayPal() {
    try {
      // Crear orden
      const response = await fetch('http://localhost:3010/api/paypal/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      // Encontrar el link de aprobación
      const approveLink = data.links.find((link: any) => link.rel === 'approve');

      if (approveLink) {
        // Redirigir a PayPal
        window.location.href = approveLink.href;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar el pago');
    }
  }

  async verifyPayment(token: string) {
    try {
      const response = await fetch('http://localhost:3010/api/paypal/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      
      if (data.valid && data.status === 'approved') {
        console.log('Pago aprobado:', data);
        // Desbloquear contenido
      } else {
        console.log('Pago no válido');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
}
*/

// =============================================================================
// FLUJO COMPLETO DEL PAGO
// =============================================================================

/*
1. Usuario hace clic en "Pagar con PayPal"
   → Frontend llama a POST /api/paypal/create-order

2. Backend crea la orden en PayPal
   → Devuelve un objeto con links (approve, self, capture)

3. Frontend redirige al usuario al link "approve"
   → Usuario es llevado a PayPal para iniciar sesión y aprobar el pago

4. Usuario aprueba el pago en PayPal
   → PayPal redirige al usuario a: ${HOST}/api/paypal/capture-order?token=XXXXX

5. Backend captura el pago automáticamente
   → Genera un JWT token
   → Redirige al usuario a: ${HOST}/payment-success?status=COMPLETED&token=JWT

6. Frontend detecta la redirección
   → Verifica el JWT token con POST /api/paypal/verify-token
   → Muestra mensaje de éxito y desbloquea contenido

SI EL USUARIO CANCELA:
→ PayPal redirige a: ${HOST}/payment-cancelled
→ Frontend muestra mensaje de cancelación
*/

// =============================================================================
// CONFIGURACIÓN DE RUTAS EN ANGULAR
// =============================================================================

/*
// app.routes.ts
export const routes: Routes = [
  {
    path: 'payment',
    component: PaymentComponent
  },
  {
    path: 'payment-success',
    component: PaymentSuccessComponent
  },
  {
    path: 'payment-cancelled',
    component: PaymentCancelledComponent
  },
  {
    path: 'payment-error',
    component: PaymentErrorComponent
  }
];
*/
