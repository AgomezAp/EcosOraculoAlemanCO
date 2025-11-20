#!/usr/bin/env node

/**
 * SCRIPT DE MIGRACIÓN AUTOMÁTICA DE STRIPE A PAYPAL
 * 
 * Este script automatiza la migración de todos los componentes que usan Stripe a PayPal
 * 
 * USO:
 * node migrate-to-paypal.js
 */

const fs = require('fs');
const path = require('path');

// Lista de componentes a migrar
const components = [
  'mapa-vocacional',
  'significado-suenos',
  'zodiaco-chino',
  'informacion-zodiaco',
  'lectura-numerologia',
  'animal-interior',
  'tabla-nacimiento',
  'calculadora-amor'
];

const componentsPath = path.join(__dirname, 'src', 'app', 'components');

// Funciones de reemplazo
const migrations = {
  // 1. Eliminar imports de Stripe
  removeStripeImports: (content) => {
    return content.replace(
      /import\s*{\s*loadStripe,\s*Stripe,\s*StripeElements,\s*StripePaymentElement,?\s*}\s*from\s*['"]@stripe\/stripe-js['"];?\s*/g,
      ''
    );
  },

  // 2. Agregar import de PayPal Service
  addPayPalImport: (content) => {
    // Buscar dónde están los imports de servicios
    const serviceImportRegex = /import.*Service.*from.*services/;
    if (serviceImportRegex.test(content)) {
      // Agregar después del último import de servicio
      return content.replace(
        /(import.*Service.*from.*services.*\n)/g,
        `$1import { PaypalService } from '../../services/paypal.service';\n`
      );
    }
    return content;
  },

  // 3. Eliminar variables de Stripe
  removeStripeVariables: (content) => {
    return content
      .replace(/stripe:\s*Stripe\s*\|\s*null\s*=\s*null;?\s*/g, '')
      .replace(/elements:\s*StripeElements\s*\|\s*undefined;?\s*/g, '')
      .replace(/paymentElement:\s*StripePaymentElement\s*\|\s*undefined;?\s*/g, '')
      .replace(/clientSecret:\s*string\s*\|\s*null\s*=\s*null;?\s*/g, '')
      .replace(/private\s+stripePublishableKey\s*=\s*['"].*?['"];?\s*/g, '')
      .replace(/private\s+backendUrl\s*=\s*environment\.apiUrl;?\s*/g, '');
  },

  // 4. Agregar PaypalService al constructor
  addPayPalToConstructor: (content) => {
    // Buscar el constructor y agregar PaypalService si no está
    const constructorRegex = /(constructor\s*\([^)]*)(private\s+cdr:\s*ChangeDetectorRef\s*)/;
    if (constructorRegex.test(content) && !content.includes('private paypalService: PaypalService')) {
      return content.replace(
        constructorRegex,
        '$1$2,\n    private paypalService: PaypalService'
      );
    }
    return content;
  },

  // 5. Reemplazar ngOnInit
  replaceNgOnInit: (content) => {
    // Buscar y reemplazar la inicialización de Stripe
    return content.replace(
      /\/\/ AGREGADO - Inicializar Stripe[\s\S]*?try\s*{[\s\S]*?this\.stripe\s*=\s*await\s*loadStripe\(this\.stripePublishableKey\);?[\s\S]*?}\s*catch\s*\([^)]*\)\s*{[\s\S]*?}/g,
      `// Verificar si venimos de PayPal después de un pago
    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();
    
    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(paymentStatus.token);
        
        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForVocational = true;
          sessionStorage.setItem('hasUserPaidForVocational', 'true');
          this.blockedMessageId = null;
          sessionStorage.removeItem('vocationalBlockedMessageId');
          
          // Limpiar URL
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
      sessionStorage.getItem('hasUserPaidForVocational') === 'true';`
    );
  },

  // 6. Eliminar checkPaymentStatus de Stripe
  removeCheckPaymentStatus: (content) => {
    return content.replace(
      /\/\/ AGREGADO - Verificar estado de pago desde URL[\s\S]*?private\s+checkPaymentStatus\(\):\s*void\s*{[\s\S]*?}\s*}/g,
      ''
    );
  },

  // 7. Reemplazar promptForPayment
  replacePromptForPayment: (content) => {
    const promptForPaymentRegex = /async\s+promptForPayment\(\):\s*Promise<void>\s*{[\s\S]*?(?=\n\s{2}[a-zA-Z]|\n})/;
    
    const newPromptForPayment = `async promptForPayment(): Promise<void> {
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
  }`;

    return content.replace(promptForPaymentRegex, newPromptForPayment);
  },

  // 8. Reemplazar handlePaymentSubmit
  replaceHandlePaymentSubmit: (content) => {
    const handlePaymentRegex = /async\s+handlePaymentSubmit\(\):\s*Promise<void>\s*{[\s\S]*?(?=\n\s{2}[a-zA-Z]|\n})/;
    
    const newHandlePayment = `async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      // Iniciar el flujo de pago de PayPal
      await this.paypalService.initiatePayment();
    } catch (error: any) {
      this.paymentError = error.message || 'Fehler beim Initialisieren der PayPal-Zahlung.';
      this.isProcessingPayment = false;
      this.cdr.markForCheck();
    }
  }`;

    return content.replace(handlePaymentRegex, newHandlePayment);
  },

  // 9. Simplificar cancelPayment
  replaceCancelPayment: (content) => {
    return content.replace(
      /cancelPayment\(\):\s*void\s*{[\s\S]*?}/g,
      `cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }`
    );
  },

  // 10. Eliminar referencias a ngOnDestroy de Stripe
  removeStripeFromDestroy: (content) => {
    return content.replace(
      /if\s*\(this\.paymentElement\)\s*{[\s\S]*?this\.paymentElement\.destroy\(\);?[\s\S]*?this\.paymentElement\s*=\s*undefined;?[\s\S]*?}/g,
      ''
    );
  }
};

// Función principal de migración
function migrateComponent(componentName) {
  const componentPath = path.join(componentsPath, componentName, `${componentName}.component.ts`);
  
  if (!fs.existsSync(componentPath)) {
    console.log(`❌ Componente no encontrado: ${componentName}`);
    return;
  }

  console.log(`\n🔄 Migrando: ${componentName}...`);
  
  let content = fs.readFileSync(componentPath, 'utf8');
  
  // Aplicar todas las migraciones en orden
  content = migrations.removeStripeImports(content);
  content = migrations.addPayPalImport(content);
  content = migrations.removeStripeVariables(content);
  content = migrations.addPayPalToConstructor(content);
  content = migrations.replaceNgOnInit(content);
  content = migrations.removeCheckPaymentStatus(content);
  content = migrations.replacePromptForPayment(content);
  content = migrations.replaceHandlePaymentSubmit(content);
  content = migrations.replaceCancelPayment(content);
  content = migrations.removeStripeFromDestroy(content);
  
  // Guardar el archivo
  fs.writeFileSync(componentPath, content, 'utf8');
  
  console.log(`✅ ${componentName} migrado exitosamente`);
}

// Ejecutar migración
console.log('🚀 Iniciando migración de Stripe a PayPal...\n');

components.forEach(migrateComponent);

console.log('\n✨ Migración completada!');
console.log('\n📝 Próximos pasos:');
console.log('1. Revisar los archivos migrados');
console.log('2. Ejecutar npm install para asegurar dependencias');
console.log('3. Compilar: npm run build o ng build');
console.log('4. Probar el flujo de pago en cada componente');
console.log('5. Actualizar las variables de entorno en backend/.env');
