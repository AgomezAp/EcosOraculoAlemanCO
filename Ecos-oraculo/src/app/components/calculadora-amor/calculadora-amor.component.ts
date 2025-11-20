import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  CalculadoraAmorService,
  CompatibilityData,
  ConversationMessage,
  LoveCalculatorResponse,
  LoveExpertInfo,
} from '../../services/calculadora-amor.service';
import { Subject, takeUntil } from 'rxjs';
import { PaypalService } from '../../services/paypal.service';

import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';

@Component({
  selector: 'app-calculadora-amor',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    MatNativeDateModule,
    RecolectaDatosComponent,
    FortuneWheelComponent,
  ],
  templateUrl: './calculadora-amor.component.html',
  styleUrl: './calculadora-amor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculadoraAmorComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  textareaHeight: number = 45; // Altura inicial
  private readonly minTextareaHeight = 45;
  private readonly maxTextareaHeight = 120;
  // Variables principales del chat
  conversationHistory: ConversationMessage[] = [];
  currentMessage: string = '';
  messageInput = new FormControl('');
  isLoading: boolean = false;
  isTyping: boolean = false;
  hasStartedConversation: boolean = false;
  showDataForm: boolean = false;

  showDataModal: boolean = false;
  userData: any = null;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Variables para control de pagos
  showPaymentModal: boolean = false;

  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForLove: boolean = false;
  firstQuestionAsked: boolean = false;

  // NUEVA PROPIEDAD para controlar mensajes bloqueados
  blockedMessageId: string | null = null;
  //propiedades para la ruleta
  showFortuneWheel: boolean = false;
  lovePrizes: Prize[] = [
    {
      id: '1',
      name: '3 Drehungen des Liebesrades',
      color: '#ff69b4',
      icon: '💕',
    },
    {
      id: '2',
      name: '1 Premium-Kompatibilitätsanalyse',
      color: '#ff1493',
      icon: '💖',
    },
    {
      id: '4',
      name: 'Versuch es nochmal!',
      color: '#dc143c',
      icon: '💘',
    },
  ];
  private wheelTimer: any;
  private backendUrl = environment.apiUrl;

  // Formulario reactivo
  compatibilityForm: FormGroup;

  // Estado del componente
  loveExpertInfo: LoveExpertInfo | null = null;
  compatibilityData: CompatibilityData | null = null;

  // Subject para manejar unsubscriptions
  private destroy$ = new Subject<void>();

  // Info del experto en amor
  loveExpertInfo_display = {
    name: 'Meisterin Valentina',
    title: 'Wächterin der ewigen Liebe',
    specialty: 'Numerologie der Liebe und Seelenkompatibilität',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Willkommen, verliebte Seele! 💕 Ich bin die Meisterin Paula, und ich bin hier, um dir die Geheimnisse der wahren Liebe zu enthüllen. Die Liebeskarten flüstern Geschichten von vereinten Herzen und ewigen Leidenschaften. Bist du bereit, die Kompatibilität deiner Beziehung zu entdecken?',
    'Die Liebesenergien flüstern mir zu, dass du gekommen bist, um Antworten des Herzens zu suchen... Die Zahlen der Liebe enthüllen die Chemie zwischen den Seelen. Welches romantische Geheimnis möchtest du kennen?',
    'Willkommen im Tempel der ewigen Liebe. Die numerologischen Muster der Romantik haben deine Ankunft angekündigt. Lass mich die Kompatibilität deiner Beziehung durch die heilige Numerologie berechnen.',
    'Die Zahlen der Liebe tanzen vor mir und enthüllen deine Präsenz... Jede Berechnung enthüllt ein romantisches Schicksal. Welches Paar möchtest du, dass ich numerologisch für dich analysiere?',
  ];

  constructor(
    private calculadoraAmorService: CalculadoraAmorService,
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService // ← AGREGAR ESTA LÍNEA
  ) {
    this.compatibilityForm = this.createCompatibilityForm();
  }

  async ngOnInit(): Promise<void> {
    // ✅ Verificar pago SOLO de este servicio específico
    this.hasUserPaidForLove =
      sessionStorage.getItem('hasUserPaidForLove_liebesrechner') === 'true';

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          // ✅ Pago SOLO para este servicio (Liebesrechner)
          this.hasUserPaidForLove = true;
          sessionStorage.setItem('hasUserPaidForLove_liebesrechner', 'true');

          // NO usar localStorage global
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('loveBlockedMessageId');

          // Limpiar URL
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

          // ✅ MENSAJE DE CONFIRMACIÓN (usando conversationHistory.push con interfaz correcta)
          setTimeout(() => {
            const successMessage: ConversationMessage = {
              role: 'love_expert',
              message:
                '🎉 Zahlung erfolgreich abgeschlossen!\n\n' +
                '✨ Vielen Dank für deine Zahlung. Du hast jetzt vollen Zugriff auf die Liebesrechner.\n\n' +
                '💕 Lass uns gemeinsam die Geheimnisse der Liebe entdecken!\n\n' +
                '📌 Hinweis: Diese Zahlung gilt nur für den Liebesrechner-Service. Für andere Dienste ist eine separate Zahlung erforderlich.',
              timestamp: new Date(),
            };
            this.conversationHistory.push(successMessage);
            this.saveMessagesToSession();
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 200);
          }, 1000);
        } else {
          this.paymentError = 'Die Zahlung konnte nicht verifiziert werden.';

          setTimeout(() => {
            const errorMessage: ConversationMessage = {
              role: 'love_expert',
              message:
                '⚠️ Es gab ein Problem bei der Verifizierung deiner Zahlung. Bitte versuche es erneut oder kontaktiere unseren Support.',
              timestamp: new Date(),
            };
            this.conversationHistory.push(errorMessage);
            this.saveMessagesToSession();
            this.cdr.detectChanges();
          }, 800);
        }
      } catch (error) {
        console.error('Error verificando pago de PayPal:', error);
        this.paymentError = 'Fehler bei der Zahlungsüberprüfung';

        setTimeout(() => {
          const errorMessage: ConversationMessage = {
            role: 'love_expert',
            message:
              '❌ Leider ist ein Fehler bei der Zahlungsüberprüfung aufgetreten. Bitte versuche es später erneut.',
            timestamp: new Date(),
          };
          this.conversationHistory.push(errorMessage);
          this.saveMessagesToSession();
          this.cdr.detectChanges();
        }, 800);
      }
    }

    // ✅ NUEVO: Cargar datos del usuario desde sessionStorage
    const savedUserData = sessionStorage.getItem('userData');
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
      } catch (error) {
        this.userData = null;
      }
    } else {
      this.userData = null;
    }

    // ✅ REFACTORIZAR: Separar carga de datos
    this.loadLoveData();

    this.loadLoveExpertInfo();
    this.subscribeToCompatibilityData();

    // ✅ TAMBIÉN VERIFICAR PARA MENSAJES RESTAURADOS
    if (
      this.conversationHistory.length > 0 &&
      FortuneWheelComponent.canShowWheel()
    ) {
      this.showLoveWheelAfterDelay(2000);
    }
  }
  private loadLoveData(): void {
    const savedMessages = sessionStorage.getItem('loveMessages');
    const savedFirstQuestion = sessionStorage.getItem('loveFirstQuestionAsked');
    const savedBlockedMessageId = sessionStorage.getItem(
      'loveBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.conversationHistory = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
      } catch (error) {
        this.clearSessionData();
        this.initializeLoveWelcomeMessage();
      }
    } else {
      this.initializeLoveWelcomeMessage();
    }
  }
  private initializeLoveWelcomeMessage(): void {
    const randomWelcome =
      this.welcomeMessages[
        Math.floor(Math.random() * this.welcomeMessages.length)
      ];

    const welcomeMessage: ConversationMessage = {
      role: 'love_expert',
      message: randomWelcome,
      timestamp: new Date(),
    };

    this.conversationHistory.push(welcomeMessage);
    this.hasStartedConversation = true;

    // ✅ VERIFICACIÓN DE RULETA AMOROSA
    if (FortuneWheelComponent.canShowWheel()) {
      this.showLoveWheelAfterDelay(3000);
    } else {
    }
  }

  openDataModalForPayment(): void {
    // Cerrar otros modales que puedan estar abiertos
    this.showFortuneWheel = false;
    this.showPaymentModal = false;

    // Guardar el estado antes de proceder
    this.saveStateBeforePayment();

    // Abrir el modal de recolecta de datos
    setTimeout(() => {
      this.showDataModal = true;
      this.cdr.markForCheck();
    }, 100);
  }
  ngAfterViewChecked(): void {
    if (
      this.shouldAutoScroll &&
      this.conversationHistory.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.conversationHistory.length;
    }
  }

  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50;
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold;
    this.shouldAutoScroll = isNearBottom;
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  startConversation(): void {
    if (this.conversationHistory.length === 0) {
      this.initializeLoveWelcomeMessage();
    }
    this.hasStartedConversation = true;
  }

  /**
   * Crea el formulario reactivo para los datos de compatibilidad
   */
  private createCompatibilityForm(): FormGroup {
    return this.formBuilder.group({
      person1Name: ['', [Validators.required, Validators.minLength(2)]],
      person1BirthDate: ['', Validators.required],
      person2Name: ['', [Validators.required, Validators.minLength(2)]],
      person2BirthDate: ['', Validators.required],
    });
  }

  /**
   * Carga la información del experto en amor
   */
  private loadLoveExpertInfo(): void {
    this.calculadoraAmorService
      .getLoveExpertInfo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (info) => {
          this.loveExpertInfo = info;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Se suscribe a los datos de compatibilidad
   */
  private subscribeToCompatibilityData(): void {
    this.calculadoraAmorService.compatibilityData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.compatibilityData = data;
        if (data) {
          this.populateFormWithData(data);
        }
      });
  }

  /**
   * Puebla el formulario con los datos de compatibilidad
   */
  private populateFormWithData(data: CompatibilityData): void {
    this.compatibilityForm.patchValue({
      person1Name: data.person1Name,
      person1BirthDate: new Date(data.person1BirthDate),
      person2Name: data.person2Name,
      person2BirthDate: new Date(data.person2BirthDate),
    });
  }

  /**
   * Calcula la compatibilidad entre las dos personas
   */
  calculateCompatibility(): void {
    if (this.compatibilityForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    const formValues = this.compatibilityForm.value;
    const compatibilityData: CompatibilityData = {
      person1Name: formValues.person1Name.trim(),
      person1BirthDate: this.formatDateForService(formValues.person1BirthDate),
      person2Name: formValues.person2Name.trim(),
      person2BirthDate: this.formatDateForService(formValues.person2BirthDate),
    };

    this.isLoading = true;
    this.calculadoraAmorService
      .calculateCompatibility(compatibilityData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.handleCalculationResponse(response);
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError(error);
          this.cdr.markForCheck();
        },
        complete: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Maneja la respuesta del cálculo de compatibilidad
   */
  private handleCalculationResponse(response: LoveCalculatorResponse): void {
    if (response.success) {
      this.hasStartedConversation = true;
      this.showDataForm = false;

      // Agregar mensaje de confirmación del cálculo
      const calculationMsg: ConversationMessage = {
        role: 'love_expert',
        message: `✨ Ich habe die numerologische Analyse von ${this.compatibilityForm.value.person1Name} und ${this.compatibilityForm.value.person2Name} abgeschlossen. Die Zahlen der Liebe haben faszinierende Informationen über eure Kompatibilität enthüllt. Möchtest du die Details dieser Liebeslesung kennen?`,
        timestamp: new Date(),
      };

      this.conversationHistory.push(calculationMsg);
      this.saveMessagesToSession();
      this.shouldAutoScroll = true;
    } else {
    }
  }

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    // ✅ NUEVA LÓGICA: Verificar consultas amorosas gratuitas ANTES de verificar pago
    if (!this.hasUserPaidForLove && this.firstQuestionAsked) {
      // Verificar si tiene consultas amorosas gratis disponibles
      if (this.hasFreeLoveConsultationsAvailable()) {
        this.useFreeLoveConsultation();
        // Continuar con el mensaje sin bloquear
      } else {
        // Cerrar otros modales primero
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Guardar el mensaje para procesarlo después del pago
        sessionStorage.setItem('pendingLoveMessage', userMessage);

        this.saveStateBeforePayment();

        // Mostrar modal de datos con timeout
        setTimeout(() => {
          this.showDataModal = true;
          this.cdr.markForCheck();
        }, 100);

        return; // Salir aquí para no procesar el mensaje aún
      }
    }

    // Procesar mensaje normalmente
    this.processLoveUserMessage(userMessage);
  }
  private processLoveUserMessage(userMessage: string): void {
    this.shouldAutoScroll = true;

    // Agregar mensaje del usuario
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.conversationHistory.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isTyping = true;
    this.isLoading = true;

    const compatibilityData =
      this.calculadoraAmorService.getCompatibilityData();

    // Preparar historial de conversación
    const conversationHistoryForService = this.conversationHistory
      .slice(-10)
      .map((msg) => ({
        role:
          msg.role === 'user' ? ('user' as const) : ('love_expert' as const),
        message: msg.message,
      }));

    // Enviar al servicio
    this.calculadoraAmorService
      .chatWithLoveExpert(
        userMessage,
        compatibilityData?.person1Name,
        compatibilityData?.person1BirthDate,
        compatibilityData?.person2Name,
        compatibilityData?.person2BirthDate
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.isTyping = false;

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            const loveExpertMsg: ConversationMessage = {
              role: 'love_expert',
              message: response.response,
              timestamp: new Date(),
              id: messageId,
            };
            this.conversationHistory.push(loveExpertMsg);

            this.shouldAutoScroll = true;

            // ✅ LÓGICA MODIFICADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
            if (
              this.firstQuestionAsked &&
              !this.hasUserPaidForLove &&
              !this.hasFreeLoveConsultationsAvailable()
            ) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('loveBlockedMessageId', messageId);

              setTimeout(() => {
                this.saveStateBeforePayment();

                // Cerrar otros modales
                this.showFortuneWheel = false;
                this.showPaymentModal = false;

                // Mostrar modal de datos
                setTimeout(() => {
                  this.showDataModal = true;
                  this.cdr.markForCheck();
                }, 100);
              }, 2000);
            } else if (!this.firstQuestionAsked) {
              this.firstQuestionAsked = true;
              sessionStorage.setItem('loveFirstQuestionAsked', 'true');
            }

            this.saveMessagesToSession();
            this.cdr.markForCheck();
          } else {
            this.handleError(
              'Fehler beim Abrufen der Antwort des Liebesexperten'
            );
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.isTyping = false;
          this.handleError('Verbindungsfehler. Bitte versuche es erneut.');
          this.cdr.markForCheck();
        },
      });
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'loveFirstQuestionAsked',
      this.firstQuestionAsked.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem('loveBlockedMessageId', this.blockedMessageId);
    }
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.conversationHistory.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem('loveMessages', JSON.stringify(messagesToSave));
    } catch (error) {}
  }

  private clearSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForLove');
    sessionStorage.removeItem('loveMessages');
    sessionStorage.removeItem('loveFirstQuestionAsked');
    sessionStorage.removeItem('loveBlockedMessageId');
  }

  isMessageBlocked(message: ConversationMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForLove;
  }

  // ✅ MÉTODO MIGRADO A PAYPAL
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
      this.paymentError =
        'Keine Kundendaten gefunden. Bitte füllen Sie das Formular zuerst aus.';
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    const email = this.userData.email?.toString().trim();
    if (!email) {
      this.paymentError =
        'E-Mail erforderlich. Bitte füllen Sie das Formular aus.';
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    // ✅ Guardar mensaje pendiente si existe
    if (this.currentMessage?.trim()) {
      sessionStorage.setItem('pendingLoveMessage', this.currentMessage.trim());
    }
  }

  // ✅ MÉTODO MIGRADO A PAYPAL
  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      await this.paypalService.initiatePayment({
        amount: '5.00',
        currency: 'EUR',
        serviceName: 'Liebesrechner',
        returnPath: '/liebesrechner',
        cancelPath: '/liebesrechner',
      });
    } catch (error: any) {
      this.paymentError =
        error.message || 'Fehler beim Initialisieren der PayPal-Zahlung.';
      this.isProcessingPayment = false;
      this.cdr.markForCheck();
    }
  }

  // ✅ MÉTODO SIMPLIFICADO - PayPal no requiere cleanup
  cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  adjustTextareaHeight(event: any): void {
    const textarea = event.target;

    // Resetear altura para obtener scrollHeight correcto
    textarea.style.height = 'auto';

    // Calcular nueva altura basada en el contenido
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, this.minTextareaHeight),
      this.maxTextareaHeight
    );

    // Aplicar nueva altura
    this.textareaHeight = newHeight;
    textarea.style.height = newHeight + 'px';
  }
  onEnterPressed(event: KeyboardEvent): void {
    if (event.shiftKey) {
      // Permitir nueva línea con Shift+Enter
      return;
    }

    event.preventDefault();

    if (this.canSendMessage() && !this.isLoading) {
      this.sendMessage();
      // Resetear altura del textarea después del envío
      setTimeout(() => {
        this.textareaHeight = this.minTextareaHeight;
      }, 50);
    }
  }
  canSendMessage(): boolean {
    return !!(this.currentMessage && this.currentMessage.trim().length > 0);
  }

  // Método para resetear el chat
  resetChat(): void {
    // Limpiar el historial de conversación
    this.conversationHistory = [];

    // Limpiar el mensaje actual
    this.currentMessage = '';

    // Resetear flags
    this.isLoading = false;
    this.isTyping = false;

    // Agregar mensaje de bienvenida inicial
    this.addWelcomeMessage();

    // Forzar detección de cambios
    this.cdr.markForCheck();

    // Scroll al inicio
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }
  private addWelcomeMessage(): void {
    const welcomeMessage = {
      id: Date.now().toString(),
      role: 'love_expert' as const,
      message:
        'Hallo! Ich bin die Meisterin Paula, deine Führerin in der Welt der Liebe und numerologischen Kompatibilität. Wie kann ich dir heute helfen? 💕',
      timestamp: new Date(),
      isBlocked: false,
    };

    this.conversationHistory.push(welcomeMessage);
  }

  // ✅ Métodos de pago movidos arriba - eliminados duplicados

  savePersonalData(): void {
    // Implementar guardado de datos personales si es necesario
    this.showDataForm = false;
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  /**
   * Pregunta sobre compatibilidad
   */
  askAboutCompatibility(): void {
    const message =
      'Ich möchte die Kompatibilität zwischen zwei Personen kennen. Welche Informationen brauchst du von uns?';
    this.sendPredefinedMessage(message);
  }

  /**
   * Pregunta sobre los números del amor
   */
  askAboutNumbers(): void {
    const message =
      'Kannst du mir mehr Details über unsere Zahlen der Liebe und was sie für unsere Beziehung bedeuten erklären?';
    this.sendPredefinedMessage(message);
  }

  /**
   * Pide consejos para la relación
   */
  askAdvice(): void {
    const message =
      'Welche Ratschläge kannst du uns geben, um unsere Beziehung basierend auf unseren Kompatibilitätszahlen zu stärken?';
    this.sendPredefinedMessage(message);
  }

  /**
   * Envía un mensaje predefinido
   */
  private sendPredefinedMessage(message: string): void {
    this.currentMessage = message;
    this.sendMessage();
  }

  newConsultation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForLove) {
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('loveMessages');
      sessionStorage.removeItem('loveFirstQuestionAsked');
      sessionStorage.removeItem('loveBlockedMessageId');
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
    }

    this.conversationHistory = [];
    this.hasStartedConversation = false;
    this.calculadoraAmorService.resetService();
    this.compatibilityForm.reset();
    this.initializeLoveWelcomeMessage();
    this.cdr.markForCheck();
  }

  /**
   * TrackBy function para optimizar el rendering de mensajes
   */
  trackByMessage(index: number, message: ConversationMessage): string {
    return `${message.role}-${message.timestamp.getTime()}-${index}`;
  }

  /**
   * Formatea la hora de un mensaje
   */
  formatTime(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'N/A';
    }
  }

  private handleError(errorMessage: string): void {
    const errorMsg: ConversationMessage = {
      role: 'love_expert',
      message: `💕 Die Energien der Liebe schwanken... ${errorMessage} Versuche es erneut, wenn die romantischen Schwingungen stabilisiert sind.`,
      timestamp: new Date(),
    };
    this.conversationHistory.push(errorMsg);
    this.shouldAutoScroll = true;
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {}
  }

  /**
   * Formatea una fecha para el servicio
   */
  private formatDateForService(date: Date): string {
    if (!date) return '';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  /**
   * Marca todos los campos del formulario como tocados
   */
  private markFormGroupTouched(): void {
    Object.keys(this.compatibilityForm.controls).forEach((key) => {
      const control = this.compatibilityForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Verifica si el formulario tiene errores específicos
   */
  hasFormError(fieldName: string, errorType: string): boolean {
    const field = this.compatibilityForm.get(fieldName);
    return !!(
      field &&
      field.hasError(errorType) &&
      (field.dirty || field.touched)
    );
  }

  /**
   * Obtiene el mensaje de error para un campo específico
   */
  getFieldErrorMessage(fieldName: string): string {
    const field = this.compatibilityForm.get(fieldName);

    if (field?.hasError('required')) {
      return 'Dieses Feld ist erforderlich';
    }

    if (field?.hasError('minlength')) {
      return 'Mindestens 2 Zeichen';
    }

    return '';
  }

  clearConversation(): void {
    this.newConsultation();
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  getTimeString(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'N/A';
    }
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    // Convertir **texto** a <strong>texto</strong> para negrilla
    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Convertir saltos de línea a <br> para mejor visualización
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // Opcional: También puedes manejar *texto* (una sola asterisco) como cursiva
    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  onUserDataSubmitted(userData: any): void {
    // ✅ VALIDAR CAMPOS CRÍTICOS ANTES DE PROCEDER
    const requiredFields = ['email']; // ❌ QUITADO 'apellido'
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `Um mit der Zahlung fortzufahren, musst du folgendes ausfüllen: ${missingFields.join(
          ', '
        )}`
      );
      this.showDataModal = true; // Mantener modal abierto
      this.cdr.markForCheck();
      return;
    }

    // ✅ LIMPIAR Y GUARDAR datos INMEDIATAMENTE en memoria Y sessionStorage
    this.userData = {
      ...userData,
      email: userData.email?.toString().trim(),
    };

    // ✅ GUARDAR EN sessionStorage INMEDIATAMENTE
    try {
      sessionStorage.setItem('userData', JSON.stringify(this.userData));

      // Verificar que se guardaron correctamente
      const verificacion = sessionStorage.getItem('userData');
    } catch (error) {}

    this.showDataModal = false;
    this.cdr.markForCheck();

    // ✅ NUEVO: Enviar datos al backend como en otros componentes
    this.sendUserDataToBackend(userData);
  }
  private sendUserDataToBackend(userData: any): void {
    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        // ✅ LLAMAR A promptForPayment QUE INICIALIZA STRIPE
        this.promptForPayment();
      },
      error: (error) => {
        // ✅ AUN ASÍ ABRIR EL MODAL DE PAGO
        this.promptForPayment();
      },
    });
  }
  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  showLoveWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.wheelTimer = setTimeout(() => {
      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.showFortuneWheel = true;
        this.cdr.markForCheck();
      } else {
      }
    }, delayMs);
  }

  // ✅ MANEJAR PREMIO GANADO
  onPrizeWon(prize: Prize): void {
    const prizeMessage: ConversationMessage = {
      role: 'love_expert',
      message: `💕 Die wahre Liebe hat zu deinen Gunsten konspiriert! Du hast gewonnen: **${prize.name}** ${prize.icon}\n\nDie romantischen Kräfte des Universums haben entschieden, dich mit diesem himmlischen Geschenk zu segnen. Die Energie der Liebe fließt durch dich und enthüllt tiefere Geheimnisse über Kompatibilität und Romantik. Möge die ewige Liebe dich begleiten!`,
      timestamp: new Date(),
    };

    this.conversationHistory.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    this.processLovePrize(prize);
  }

  // ✅ PROCESAR PREMIO ESPECÍFICO
  private processLovePrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Lecturas Amorosas
        this.addFreeLoveConsultations(3);
        break;
      case '2': // 1 Análisis Premium
        this.addFreeLoveConsultations(1);
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        break;
      default:
    }
  }

  // ✅ AGREGAR CONSULTAS GRATIS
  private addFreeLoveConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeLoveConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeLoveConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForLove) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('loveBlockedMessageId');
    }
  }

  // ✅ VERIFICAR CONSULTAS GRATIS DISPONIBLES
  private hasFreeLoveConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeLoveConsultations') || '0'
    );
    return freeConsultations > 0;
  }
  private useFreeLoveConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeLoveConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem('freeLoveConsultations', remaining.toString());

      // Mostrar mensaje informativo
      const prizeMsg: ConversationMessage = {
        role: 'love_expert',
        message: `✨ *Du hast eine kostenlose Liebesberatung verwendet* ✨\n\nDir bleiben **${remaining}** kostenlose Liebesberatungen verfügbar.`,
        timestamp: new Date(),
      };
      this.conversationHistory.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  // ✅ CERRAR RULETA
  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  // ✅ ACTIVAR RULETA MANUALMENTE
  triggerLoveWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        'Du hast keine Drehungen verfügbar. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  // ✅ OBTENER ESTADO DE SPINS
  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }
}
