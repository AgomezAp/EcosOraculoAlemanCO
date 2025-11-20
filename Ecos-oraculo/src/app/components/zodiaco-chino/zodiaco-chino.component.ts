import {
  AfterViewChecked,
  AfterViewInit,
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
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ZodiacoChinoService } from '../../services/zodiaco-chino.service';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PaypalService } from "../../services/paypal.service";

import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environmets.prod';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';

interface ChatMessage {
  role: 'user' | 'master';
  message: string;
  timestamp?: string;
  id?: string;
}

interface MasterInfo {
  success: boolean;
  master: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  timestamp: string;
}

interface ZodiacAnimal {
  animal?: string;
  symbol?: string;
  year?: number;
  element?: string;
  traits?: string[];
}
@Component({
  selector: 'app-zodiaco-chino',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
    FortuneWheelComponent,
  ],
  templateUrl: './zodiaco-chino.component.html',
  styleUrl: './zodiaco-chino.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZodiacoChinoComponent
  implements OnInit, AfterViewChecked, OnDestroy, AfterViewInit
{
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // Propiedades principales
  masterInfo: MasterInfo | null = null;
  userForm: FormGroup;
  isFormCompleted = false;
  isLoading = false;
  currentMessage = '';
  conversationHistory: ChatMessage[] = [];
  zodiacAnimal: ZodiacAnimal = {};
  showDataForm = true;
  isTyping: boolean = false;
  private shouldScrollToBottom = false;
  private shouldAutoScroll = true;
  private lastMessageCount = 0;
  //Variables para control de fortuna
  showFortuneWheel: boolean = false;
  horoscopePrizes: Prize[] = [
    {
      id: '1',
      name: '3 Drehungen des Sternzeichenrades',
      color: '#4ecdc4',
      icon: '🔮',
    },
    {
      id: '2',
      name: '1 Premium-Sternzeichenanalyse',
      color: '#45b7d1',
      icon: '✨',
    },
    // ✅ ELIMINADO: { id: '3', name: '2 Consultas Astrológicas Extra', color: '#ffeaa7', icon: '🌟' },
    {
      id: '4',
      name: 'Versuche es nochmal!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;
  // Variables para control de pagos
  showPaymentModal: boolean = false;

  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForHoroscope: boolean = false;
  firstQuestionAsked: boolean = false;
  blockedMessageId: string | null = null;
  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;
  private backendUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private zodiacoChinoService: ZodiacoChinoService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService
  ) {
    // Configuración del formulario para horóscopo
    this.userForm = this.fb.group({
      fullName: [''],
      birthYear: [
        '',
        [Validators.required, Validators.min(1900), Validators.max(2024)],
      ],
      birthDate: [''],
      initialQuestion: [
        'Was können Sie mir über mein Sternzeichen und Horoskop sagen?',
      ],
    });
  }
  ngAfterViewInit(): void {
    this.setVideosSpeed(0.7); // 0.5 = más lento, 1 = normal
  }
  private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }
  async ngOnInit(): Promise<void> {
    // ✅ Verificar si venimos de PayPal después de un pago
    this.hasUserPaidForHoroscope =
      sessionStorage.getItem('hasUserPaidForHoroscope_horoskop') === 'true';

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          // ✅ Pago SOLO para este servicio (Horoskop)
          this.hasUserPaidForHoroscope = true;
          sessionStorage.setItem('hasUserPaidForHoroscope_horoskop', 'true');

          // NO usar localStorage global
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('horoscopeBlockedMessageId');

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

          // ✅ MENSAJE DE CONFIRMACIÓN (usando firma correcta de addMessage)
          setTimeout(() => {
            this.addMessage(
              'master',
              '🎉 Zahlung erfolgreich abgeschlossen!\n\n' +
                '✨ Vielen Dank für deine Zahlung. Du hast jetzt vollen Zugriff auf das Chinesische Horoskop.\n\n' +
                '🐉 Lass uns gemeinsam deine astrologische Zukunft entdecken!\n\n' +
                '📌 Hinweis: Diese Zahlung gilt nur für den Horoskop-Service. Für andere Dienste ist eine separate Zahlung erforderlich.'
            );
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 200);
          }, 1000);
        } else {
          this.paymentError = 'Die Zahlung konnte nicht verifiziert werden.';

          setTimeout(() => {
            this.addMessage(
              'master',
              '⚠️ Es gab ein Problem bei der Verifizierung deiner Zahlung. Bitte versuche es erneut oder kontaktiere unseren Support.'
            );
            this.cdr.detectChanges();
          }, 800);
        }
      } catch (error) {
        console.error('Error verificando pago de PayPal:', error);
        this.paymentError = 'Fehler bei der Zahlungsüberprüfung';

        setTimeout(() => {
          this.addMessage(
            'master',
            '❌ Leider ist ein Fehler bei der Zahlungsüberprüfung aufgetreten. Bitte versuche es später erneut.'
          );
          this.cdr.detectChanges();
        }, 800);
      }
    }

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

    // Cargar datos guardados específicos del horóscopo
    this.loadHoroscopeData();

    // ✅ PayPal verifica en ngOnInit() arriba - ya no necesitamos checkHoroscopePaymentStatus()

    this.loadMasterInfo();

    // Solo agregar mensaje de bienvenida si no hay mensajes guardados
    if (this.conversationHistory.length === 0) {
      this.initializeHoroscopeWelcomeMessage();
    }

    // ✅ TAMBIÉN VERIFICAR PARA MENSAJES RESTAURADOS
    if (
      this.conversationHistory.length > 0 &&
      FortuneWheelComponent.canShowWheel()
    ) {
      this.showHoroscopeWheelAfterDelay(2000);
    }
  }
  private loadHoroscopeData(): void {
    const savedMessages = sessionStorage.getItem('horoscopeMessages');
    const savedFirstQuestion = sessionStorage.getItem(
      'horoscopeFirstQuestionAsked'
    );
    const savedBlockedMessageId = sessionStorage.getItem(
      'horoscopeBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.conversationHistory = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp,
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
      } catch (error) {
        this.clearHoroscopeSessionData();
        this.initializeHoroscopeWelcomeMessage();
      }
    }
  }
  private initializeHoroscopeWelcomeMessage(): void {
    const welcomeMessage = `Willkommen und hallo im Reich der Sterne! 🔮✨

Ich bin die Astrologin María, himmlische Führerin der Sternzeichen. Jahrzehntelang habe ich die Einflüsse der Planeten und Konstellationen studiert, die unser Schicksal lenken.

Jede Person wird unter dem Schutz eines Sternzeichens geboren, das ihre Persönlichkeit, ihr Schicksal und ihren Lebensweg beeinflusst. Um die Geheimnisse deines Horoskops und die himmlischen Einflüsse zu enthüllen, brauche ich dein Geburtsdatum.

Die zwölf Zeichen (Widder, Stier, Zwillinge, Krebs, Löwe, Jungfrau, Waage, Skorpion, Schütze, Steinbock, Wassermann und Fische) haben uralte Weisheit zu teilen.

Bist du bereit zu entdecken, was die Sterne über dein Schicksal verraten? 🌙`;

    this.addMessage('master', welcomeMessage);

    // ✅ VERIFICACIÓN DE RULETA HOROSCÓPICA
    if (FortuneWheelComponent.canShowWheel()) {
      this.showHoroscopeWheelAfterDelay(3000);
    } else {
    }
  }
  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }

    if (
      this.shouldAutoScroll &&
      this.conversationHistory.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.conversationHistory.length;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
    // ✅ PayPal no requiere limpieza de elementos
  }

  // ✅ Método eliminado - PayPal maneja verificación en ngOnInit()

  private saveHoroscopeMessagesToSession(): void {
    try {
      const messagesToSave = this.conversationHistory.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp,
      }));
      sessionStorage.setItem(
        'horoscopeMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {}
  }

  private clearHoroscopeSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForHoroscope');
    sessionStorage.removeItem('horoscopeMessages');
    sessionStorage.removeItem('horoscopeFirstQuestionAsked');
    sessionStorage.removeItem('horoscopeBlockedMessageId');
  }

  private saveHoroscopeStateBeforePayment(): void {
    this.saveHoroscopeMessagesToSession();
    sessionStorage.setItem(
      'horoscopeFirstQuestionAsked',
      this.firstQuestionAsked.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'horoscopeBlockedMessageId',
        this.blockedMessageId
      );
    }
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForHoroscope
    );
  }

  // ✅ MÉTODO MIGRADO A PAYPAL
  async promptForHoroscopePayment(): Promise<void> {
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

    // Guardar mensaje pendiente si existe
    if (this.currentMessage) {
      sessionStorage.setItem('pendingHoroscopeMessage', this.currentMessage);
    }
  }

  // ✅ MÉTODO MIGRADO A PAYPAL
  async handleHoroscopePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      // Iniciar el flujo de pago de PayPal (redirige al usuario)
      await this.paypalService.initiatePayment({
        amount: '5.00',
        currency: 'EUR',
        serviceName: 'Chinesisches Horoskop',
        returnPath: '/horoskop',
        cancelPath: '/horoskop',
      });

      // El código después de esta línea NO se ejecutará porque
      // el usuario será redirigido a PayPal
    } catch (error: any) {
      this.paymentError =
        error.message || 'Fehler beim Initialisieren der PayPal-Zahlung.';
      this.isProcessingPayment = false;
      this.cdr.markForCheck();
    }
  }

  // ✅ MÉTODO SIMPLIFICADO - PayPal no requiere cleanup
  cancelHoroscopePayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  startChatWithoutForm(): void {
    this.showDataForm = false;
  }

  // Cargar información del maestro
  loadMasterInfo(): void {
    this.zodiacoChinoService.getMasterInfo().subscribe({
      next: (info) => {
        this.masterInfo = info;
      },
      error: (error) => {
        // Información predeterminada en caso de error
        this.masterInfo = {
          success: true,
          master: {
            name: 'Astrologin María',
            title: 'Himmlische Führerin der Zeichen',
            specialty: 'Westliche Astrologie und personalisiertes Horoskop',
            description:
              'Weise Astrologin, spezialisiert auf die Interpretation himmlischer Einflüsse und der Weisheit der zwölf Sternzeichen',
            services: [
              'Interpretation von Sternzeichen',
              'Analyse von Astralkarten',
              'Horoskop-Vorhersagen',
              'Kompatibilität zwischen Zeichen',
              'Astrologiebasierte Ratschläge',
            ],
          },
          timestamp: new Date().toISOString(),
        };
      },
    });
  }

  // Iniciar consulta del horóscopo
  startConsultation(): void {
    if (this.userForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.cdr.markForCheck(); // ✅ Detectar cambio de loading

      const formData = this.userForm.value;

      // Calcular animal del zodiaco

      const initialMessage =
        formData.initialQuestion ||
        'Hallo! Ich würde gerne mehr über mein Sternzeichen und Horoskop erfahren.';

      // Agregar mensaje del usuario
      this.addMessage('user', initialMessage);

      // Marcar que se hizo la primera pregunta
      if (!this.firstQuestionAsked) {
        this.firstQuestionAsked = true;
        sessionStorage.setItem('horoscopeFirstQuestionAsked', 'true');
      }

      // Preparar datos para enviar al backend
      const consultationData = {
        zodiacData: {
          name: 'Astrologin María',
          specialty: 'Westliche Astrologie und personalisiertes Horoskop',
          experience:
            'Jahrzehnte der Erfahrung in astrologischer Interpretation',
        },
        userMessage: initialMessage,
        fullName: formData.fullName,
        birthYear: formData.birthYear?.toString(),
        birthDate: formData.birthDate,
        conversationHistory: this.conversationHistory,
      };

      // Llamar al servicio
      this.zodiacoChinoService.chatWithMaster(consultationData).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success && response.response) {
            this.addMessage('master', response.response);
            this.isFormCompleted = true;
            this.showDataForm = false;
            this.saveHoroscopeMessagesToSession();
            this.cdr.markForCheck();
          } else {
            this.handleError('Fehler in der Antwort der Astrologin');
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.handleError(
            'Fehler beim Verbinden mit der Astrologin: ' +
              (error.error?.error || error.message)
          );
          this.cdr.markForCheck();
        },
      });
    }
  }

  sendMessage(): void {
    if (this.currentMessage.trim() && !this.isLoading) {
      const message = this.currentMessage.trim();

      // ✅ LÓGICA ACTUALIZADA: Verificar acceso premium O consultas gratuitas
      if (!this.hasUserPaidForHoroscope && this.firstQuestionAsked) {
        // Verificar si tiene consultas horoscópicas gratis disponibles
        if (this.hasFreeHoroscopeConsultationsAvailable()) {
          this.useFreeHoroscopeConsultation();
          // Continuar con el mensaje sin bloquear
        } else {
          // Si no tiene consultas gratis NI acceso premium, mostrar modal de datos

          // Cerrar otros modales primero
          this.showFortuneWheel = false;
          this.showPaymentModal = false;

          // Guardar el mensaje para procesarlo después del pago
          sessionStorage.setItem('pendingHoroscopeMessage', message);

          this.saveHoroscopeStateBeforePayment();

          // Mostrar modal de datos con timeout
          setTimeout(() => {
            this.showDataModal = true;
            this.cdr.markForCheck();
          }, 100);

          return; // Salir aquí para no procesar el mensaje aún
        }
      }

      // Procesar mensaje normalmente
      this.processHoroscopeUserMessage(message);
    }
  }
  private processHoroscopeUserMessage(message: string): void {
    this.currentMessage = '';
    this.isLoading = true;
    this.isTyping = true;
    this.cdr.markForCheck(); // ✅ Detectar cambios de estado

    // Agregar mensaje del usuario
    this.addMessage('user', message);

    const formData = this.userForm.value;
    const consultationData = {
      zodiacData: {
        name: 'Astrologin María',
        specialty: 'Westliche Astrologie und personalisiertes Horoskop',
        experience: 'Jahrzehnte der Erfahrung in astrologischer Interpretation',
      },
      userMessage: message,
      fullName: formData.fullName,
      birthYear: formData.birthYear?.toString(),
      birthDate: formData.birthDate,
      conversationHistory: this.conversationHistory,
    };

    this.zodiacoChinoService.chatWithMaster(consultationData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.isTyping = false;
        this.cdr.markForCheck(); // ✅ Detectar fin de loading

        if (response.success && response.response) {
          const messageId = Date.now().toString();

          this.addMessage('master', response.response, messageId);

          // ✅ LÓGICA ACTUALIZADA: Solo bloquear si NO tiene acceso premium Y no tiene consultas gratis
          if (
            this.firstQuestionAsked &&
            !this.hasUserPaidForHoroscope && // No tiene acceso premium
            !this.hasFreeHoroscopeConsultationsAvailable() // No tiene consultas gratis
          ) {
            this.blockedMessageId = messageId;
            sessionStorage.setItem('horoscopeBlockedMessageId', messageId);

            setTimeout(() => {
              this.saveHoroscopeStateBeforePayment();

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
            sessionStorage.setItem('horoscopeFirstQuestionAsked', 'true');
          }

          this.saveHoroscopeMessagesToSession();
          this.cdr.markForCheck();
        } else {
          this.handleError('Fehler in der Antwort der Astrologin');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.isTyping = false;
        this.handleError(
          'Fehler beim Verbinden mit der Astrologin: ' +
            (error.error?.error || error.message)
        );
        this.cdr.markForCheck();
      },
    });
  }

  // Manejar tecla Enter
  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Alternar formulario
  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  // Reiniciar consulta
  resetConsultation(): void {
    this.conversationHistory = [];
    this.isFormCompleted = false;
    this.showDataForm = true;
    this.currentMessage = '';
    this.zodiacAnimal = {};
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;

    // Limpiar sessionStorage específico del horóscopo
    if (!this.hasUserPaidForHoroscope) {
      this.clearHoroscopeSessionData();
    } else {
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeFirstQuestionAsked');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
    }

    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        'Was können Sie mir über mein Sternzeichen und Horoskop sagen?',
    });
    this.initializeHoroscopeWelcomeMessage();
  }

  // Explorar compatibilidad
  exploreCompatibility(): void {
    const message =
      'Könnten Sie über die Kompatibilität meines Sternzeichens mit anderen Zeichen sprechen?';
    this.currentMessage = message;
    this.sendMessage();
  }

  // Explorar elementos
  exploreElements(): void {
    const message =
      'Wie beeinflussen die Planeten meine Persönlichkeit und mein Schicksal?';
    this.currentMessage = message;
    this.sendMessage();
  }

  // Métodos auxiliares
  private addMessage(
    role: 'user' | 'master',
    message: string,
    id?: string
  ): void {
    const newMessage: ChatMessage = {
      role,
      message,
      timestamp: new Date().toISOString(),
      id: id || undefined,
    };
    this.conversationHistory.push(newMessage);
    this.shouldScrollToBottom = true;
    this.saveHoroscopeMessagesToSession();
    this.cdr.markForCheck(); // ✅ CRÍTICO: Detectar cambios en mensajes
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      try {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      } catch (err) {}
    }
  }

  private handleError(message: string): void {
    this.addMessage(
      'master',
      `Es tut mir leid, ${message}. Bitte versuchen Sie es erneut.`
    );
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

  formatTime(timestamp?: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByMessage(index: number, message: ChatMessage): string {
    return `${message.role}-${message.timestamp}-${index}`;
  }

  // Auto-resize del textarea
  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // Manejar tecla Enter
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Limpiar chat
  clearChat(): void {
    this.conversationHistory = [];
    this.currentMessage = '';
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;
    this.isLoading = false;

    // Limpiar sessionStorage específico del horóscopo (pero NO userData)
    sessionStorage.removeItem('horoscopeMessages');
    sessionStorage.removeItem('horoscopeFirstQuestionAsked');
    sessionStorage.removeItem('horoscopeBlockedMessageId');

    this.shouldScrollToBottom = true;
    this.initializeHoroscopeWelcomeMessage();
  }
  resetChat(): void {
    // 1. Reset de arrays y mensajes
    this.conversationHistory = [];
    this.currentMessage = '';

    // 2. Reset de estados de carga y typing
    this.isLoading = false;
    this.isTyping = false;

    // 3. Reset de estados de formulario
    this.isFormCompleted = false;
    this.showDataForm = true;

    // 4. Reset de estados de pago y bloqueo
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;

    // 5. Reset de modales
    this.showPaymentModal = false;
    this.showDataModal = false;
    this.showFortuneWheel = false;

    // 6. Reset de variables de scroll y contadores
    this.shouldScrollToBottom = false;
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0; // ← Esta era tu variable contador

    // 7. Reset del zodiac animal
    this.zodiacAnimal = {};

    // 8. ✅ PayPal no requiere cleanup de elementos
    this.isProcessingPayment = false;
    this.paymentError = null;

    // 9. Limpiar timers
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    // 10. Limpiar sessionStorage específico del horóscopo (pero NO userData)
    sessionStorage.removeItem('horoscopeMessages');
    sessionStorage.removeItem('horoscopeFirstQuestionAsked');
    sessionStorage.removeItem('horoscopeBlockedMessageId');
    sessionStorage.removeItem('pendingHoroscopeMessage');
    // NO limpiar 'userData' ni 'hasUserPaidForHoroscope'

    // 11. Reset del formulario
    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        'Was können Sie mir über mein Sternzeichen und Horoskop sagen?',
    });

    // 12. Reinicializar mensaje de bienvenida
    this.initializeHoroscopeWelcomeMessage();
    this.cdr.markForCheck();
  }
  onUserDataSubmitted(userData: any): void {
    // ✅ VALIDAR CAMPOS CRÍTICOS ANTES DE PROCEDER
    const requiredFields = ['email']; // ❌ QUITADO 'apellido' - ahora está unificado con nombre
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `Um fortzufahren, müssen Sie folgendes ausfüllen: ${missingFields.join(
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
        this.promptForHoroscopePayment();
      },
      error: (error) => {
        this.promptForHoroscopePayment();
      },
    });
  }
  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }
  showHoroscopeWheelAfterDelay(delayMs: number = 3000): void {
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
        this.cdr.markForCheck(); // ✅ Forzar detección de cambios
      } else {
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ChatMessage = {
      role: 'master',
      message: `🔮 Die Sterne haben sich zu deinen Gunsten verschworen! Du hast gewonnen: **${prize.name}** ${prize.icon}\n\nDie himmlischen Kräfte haben beschlossen, dich mit diesem heiligen Geschenk zu segnen. Die Sternzeichen-Energie fließt durch dich, tiefere Geheimnisse deines persönlichen Horoskops enthüllend. Möge die astrologische Weisheit dich erleuchten!`,
      timestamp: new Date().toISOString(),
    };

    this.conversationHistory.push(prizeMessage);
    this.shouldScrollToBottom = true;
    this.saveHoroscopeMessagesToSession();

    this.processHoroscopePrize(prize);
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  triggerHoroscopeWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck(); // ✅ Forzar detección de cambios
    } else {
      alert(
        'Du hast keine Drehungen mehr verfügbar. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processHoroscopePrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Lecturas Horoscópicas
        this.addFreeHoroscopeConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.hasUserPaidForHoroscope = true;
        sessionStorage.setItem('hasUserPaidForHoroscope', 'true');

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('horoscopeBlockedMessageId');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: ChatMessage = {
          role: 'master',
          message:
            '🌟 **Du hast den vollständigen Premium-Zugang freigeschaltet!** 🌟\n\nDie Sterne haben außergewöhnlich auf dich gelächelt. Jetzt hast du unbegrenzten Zugang zu all meiner astrologischen Weisheit. Du kannst so oft wie du möchtest über dein Horoskop, Kompatibilität, Vorhersagen und alle himmlischen Geheimnisse konsultieren.\n\n✨ *Das Universum hat alle Türen für dich geöffnet* ✨',
          timestamp: new Date().toISOString(),
        };
        this.conversationHistory.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveHoroscopeMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        break;
      default:
    }
  }

  private addFreeHoroscopeConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeHoroscopeConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForHoroscope) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('horoscopeBlockedMessageId');
    }
  }

  private hasFreeHoroscopeConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeHoroscopeConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem(
        'freeHoroscopeConsultations',
        remaining.toString()
      );

      const prizeMsg: ChatMessage = {
        role: 'master',
        message: `✨ *Du hast eine kostenlose astrologische Lesung verwendet* ✨\n\nDir bleiben **${remaining}** astrologische Konsultationen verfügbar.`,
        timestamp: new Date().toISOString(),
      };
      this.conversationHistory.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveHoroscopeMessagesToSession();
    }
  }

  debugHoroscopeWheel(): void {
    this.showFortuneWheel = true;
    this.cdr.markForCheck(); // ✅ Forzar detección de cambios
  }

  // ✅ MÉTODO AUXILIAR para el template
  getHoroscopeConsultationsCount(): number {
    return parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );
  }
}
