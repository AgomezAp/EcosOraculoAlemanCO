import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { NumerologiaService } from '../../services/numerologia.service';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PaypalService } from '../../services/paypal.service';

import { HttpClient } from '@angular/common/http';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
interface NumerologyMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}
interface ConversationMessage {
  role: 'user' | 'numerologist';
  message: string;
  timestamp: Date;
  id?: string;
}

@Component({
  selector: 'app-historia-sagrada',
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
  templateUrl: './lectura-numerologia.component.html',
  styleUrl: './lectura-numerologia.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LecturaNumerologiaComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  messages: ConversationMessage[] = [];
  currentMessage: string = '';
  messageInput = new FormControl('');
  isLoading: boolean = false;
  isTyping: boolean = false;
  hasStartedConversation: boolean = false;
  showDataForm: boolean = false;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;
  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;

  // Variables para control de pagos
  showPaymentModal: boolean = false;

  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForNumerology: boolean = false;
  firstQuestionAsked: boolean = false;
  //Modal de rueda de la fortuna
  showFortuneWheel: boolean = false;
  numerologyPrizes: Prize[] = [
    {
      id: '1',
      name: '3 Würfe des numerologischen Rades',
      color: '#4ecdc4',
      icon: '🔢',
    },
    {
      id: '2',
      name: '1 Premium Numerologische Analyse',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: 'Versuch es nochmal!',
      color: '#ff7675',
      icon: '🔄',
    },
  ];
  private wheelTimer: any;
  // NUEVA PROPIEDAD para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  private backendUrl = environment.apiUrl;

  // Datos personales
  fullName: string = '';
  birthDate: string = '';

  // Números calculados
  personalNumbers = {
    lifePath: 0,
    destiny: 0,
  };

  // Info del numerólogo
  numerologistInfo = {
    name: 'Meisterin Sofía',
    title: 'Wächterin der Heiligen Zahlen',
    specialty: 'Numerologie und universelle numerische Vibration',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Sei gegrüßt, Suchender der numerischen Weisheit... Die Zahlen sind die Sprache des Universums und enthüllen die Geheimnisse deines Schicksals. Was möchtest du über deine numerische Vibration wissen?',
    'Die numerischen Energien flüstern mir zu, dass du gekommen bist, um Antworten zu suchen... Ich bin Meisterin Sofía, Wächterin der heiligen Zahlen. Welches numerische Geheimnis beunruhigt dich?',
    'Willkommen im Tempel der heiligen Zahlen. Die mathematischen Muster des Kosmos haben deine Ankunft angekündigt. Lass mich dir die Geheimnisse deines numerischen Codes enthüllen.',
    'Die Zahlen tanzen vor mir und enthüllen deine Präsenz... Jede Zahl hat eine Bedeutung, jede Berechnung enthüllt ein Schicksal. Welche Zahlen möchtest du, dass ich für dich interpretiere?',
  ];

  constructor(
    @Optional() public dialogRef: MatDialogRef<LecturaNumerologiaComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    private numerologyService: NumerologiaService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService // ← AGREGAR ESTA LÍNEA
  ) {}
  ngAfterViewInit(): void {
    this.setVideosSpeed(0.67); // 0.5 = más lento, 1 = normal
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
    // ✅ Verificar pago SOLO de este servicio específico
    this.hasUserPaidForNumerology =
      sessionStorage.getItem('hasUserPaidForNumerology_numerologie') === 'true';

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          // ✅ Pago SOLO para este servicio (Numerologie)
          this.hasUserPaidForNumerology = true;
          sessionStorage.setItem('hasUserPaidForNumerology_numerologie', 'true');

          // NO usar localStorage global
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('numerologyBlockedMessageId');

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

          // ✅ MENSAJE DE CONFIRMACIÓN
          setTimeout(() => {
            const successMessage: ConversationMessage = {
              role: 'numerologist',
              message:
                '🎉 Zahlung erfolgreich abgeschlossen!\n\n' +
                '✨ Vielen Dank für deine Zahlung. Du hast jetzt vollen Zugriff auf die Numerologie-Lesung.\n\n' +
                '🔢 Lass uns gemeinsam die Geheimnisse der Zahlen entdecken!\n\n' +
                '📌 Hinweis: Diese Zahlung gilt nur für den Numerologie-Service. Für andere Dienste ist eine separate Zahlung erforderlich.',
              timestamp: new Date(),
            };
            this.messages.push(successMessage);
            this.saveMessagesToSession();
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 200);
          }, 1000);
        } else {
          this.paymentError = 'Die Zahlung konnte nicht verifiziert werden.';

          setTimeout(() => {
            const errorMessage: ConversationMessage = {
              role: 'numerologist',
              message:
                '⚠️ Es gab ein Problem bei der Verifizierung deiner Zahlung. Bitte versuche es erneut oder kontaktiere unseren Support.',
              timestamp: new Date(),
            };
            this.messages.push(errorMessage);
            this.saveMessagesToSession();
            this.cdr.detectChanges();
          }, 800);
        }
      } catch (error) {
        console.error('Error verificando pago de PayPal:', error);
        this.paymentError = 'Fehler bei der Zahlungsüberprüfung';

        setTimeout(() => {
          const errorMessage: ConversationMessage = {
            role: 'numerologist',
            message:
              '❌ Leider ist ein Fehler bei der Zahlungsüberprüfung aufgetreten. Bitte versuche es später erneut.',
            timestamp: new Date(),
          };
          this.messages.push(errorMessage);
          this.saveMessagesToSession();
          this.cdr.detectChanges();
        }, 800);
      }
    }

    // ✅ MEJORADO: Cargar datos del usuario desde sessionStorage

    // ✅ MOSTRAR TODO EL CONTENIDO DE sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key);
      }
    }

    const savedUserData = sessionStorage.getItem('userData');

    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
        const requiredFields = ['email'];
        const availableFields = requiredFields.filter(
          (field) => this.userData[field]
        );
        const missingFields = requiredFields.filter(
          (field) => !this.userData[field]
        );

        if (missingFields.length > 0) {
        }
      } catch (error) {
        this.userData = null;
      }
    } else {
      this.userData = null;
    }

    const savedMessages = sessionStorage.getItem('numerologyMessages');
    const savedFirstQuestion = sessionStorage.getItem(
      'numerologyFirstQuestionAsked'
    );
    const savedBlockedMessageId = sessionStorage.getItem(
      'numerologyBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
      } catch (error) {
        this.clearSessionData();
        this.startConversation();
      }
    } else {
      this.startConversation();
    }

    // Probar conexión
    this.numerologyService.testConnection().subscribe({
      next: (response) => {},
      error: (error) => {},
    });

    if (this.hasStartedConversation && FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(2000);
    }
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }
  triggerFortuneWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        'Du hast keine Würfe verfügbar. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }
  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }
  private processNumerologyPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Lecturas Gratis
        this.addFreeNumerologyConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.hasUserPaidForNumerology = true;
        sessionStorage.setItem('hasUserPaidForNumerology', 'true');

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('numerologyBlockedMessageId');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: ConversationMessage = {
          role: 'numerologist',
          message:
            '✨ **Du hast den vollständigen Premium-Zugang freigeschaltet!** ✨\n\nDie heiligen Zahlen haben sich auf außergewöhnliche Weise verschworen, um dir zu helfen. Jetzt hast du unbegrenzten Zugang zu all dem numerologischen Wissen. Du kannst über deinen Lebensweg, Schicksalszahlen, numerische Kompatibilitäten und alle Geheimnisse der Numerologie so oft konsultieren, wie du möchtest.\n\n🔢 *Das numerische Universum hat alle seine Geheimnisse für dich enthüllt* 🔢',
          timestamp: new Date(),
        };
        this.messages.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        break;
      default:
    }
  }
  private addFreeNumerologyConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeNumerologyConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeNumerologyConsultations', newTotal.toString());

    // Si había un mensaje bloqueado, desbloquearlo
    if (this.blockedMessageId && !this.hasUserPaidForNumerology) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('numerologyBlockedMessageId');
    }
  }

  private hasFreeNumerologyConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeNumerologyConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeNumerologyConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeNumerologyConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem(
        'freeNumerologyConsultations',
        remaining.toString()
      );

      // Mostrar mensaje informativo
      const prizeMsg: ConversationMessage = {
        role: 'numerologist',
        message: `✨ *Du hast eine kostenlose numerologische Konsultation verwendet* ✨\n\nDir bleiben **${remaining}** kostenlose numerologische Konsultationen.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
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
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }
  startConversation(): void {
    if (this.messages.length === 0) {
      const randomWelcome =
        this.welcomeMessages[
          Math.floor(Math.random() * this.welcomeMessages.length)
        ];

      const welcomeMessage: ConversationMessage = {
        role: 'numerologist',
        message: randomWelcome,
        timestamp: new Date(),
      };

      this.messages.push(welcomeMessage);
    }
    this.hasStartedConversation = true;

    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    } else {
    }
  }

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    // ✅ NUEVA LÓGICA: Verificar consultas numerológicas gratuitas ANTES de verificar pago
    if (!this.hasUserPaidForNumerology && this.firstQuestionAsked) {
      // Verificar si tiene consultas numerológicas gratis disponibles
      if (this.hasFreeNumerologyConsultationsAvailable()) {
        this.useFreeNumerologyConsultation();
        // Continuar con el mensaje sin bloquear
      } else {
        // Si no tiene consultas gratis, mostrar modal de datos

        // Cerrar otros modales primero
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Guardar el mensaje para procesarlo después del pago
        sessionStorage.setItem('pendingNumerologyMessage', userMessage);

        this.saveStateBeforePayment();

        // Mostrar modal de datos con timeout
        setTimeout(() => {
          this.showDataModal = true;
          this.cdr.markForCheck();
        }, 100);

        return; // Salir aquí para no procesar el mensaje aún
      }
    }

    this.shouldAutoScroll = true;

    // Agregar mensaje del usuario
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isTyping = true;
    this.isLoading = true;

    // Preparar historial de conversación
    const conversationHistory = this.messages.slice(-10).map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('numerologist' as const),
      message: msg.message,
    }));

    // Enviar al servicio
    this.numerologyService
      .sendMessage(
        userMessage,
        this.birthDate || undefined,
        this.fullName || undefined,
        conversationHistory
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.isTyping = false;

          if (response) {
            const messageId = Date.now().toString();

            const numerologistMsg: ConversationMessage = {
              role: 'numerologist',
              message: response,
              timestamp: new Date(),
              id: messageId,
            };
            this.messages.push(numerologistMsg);

            this.shouldAutoScroll = true;

            // ✅ LÓGICA MODIFICADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
            if (
              this.firstQuestionAsked &&
              !this.hasUserPaidForNumerology &&
              !this.hasFreeNumerologyConsultationsAvailable()
            ) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('numerologyBlockedMessageId', messageId);

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
              sessionStorage.setItem('numerologyFirstQuestionAsked', 'true');
            }

            this.saveMessagesToSession();
            this.cdr.markForCheck();
          } else {
            this.handleError('Error al obtener respuesta del numerólogo');
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
      'numerologyFirstQuestionAsked',
      this.firstQuestionAsked.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'numerologyBlockedMessageId',
        this.blockedMessageId
      );
    }
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem(
        'numerologyMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {}
  }

  private clearSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForNumerology');
    sessionStorage.removeItem('numerologyMessages');
    sessionStorage.removeItem('numerologyFirstQuestionAsked');
    sessionStorage.removeItem('numerologyBlockedMessageId');
    // ✅ NO ELIMINAR userData para mantener los datos entre sesiones
    // sessionStorage.removeItem('userData'); // Comentado para mantener los datos
  }

  isMessageBlocked(message: ConversationMessage): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForNumerology
    );
  }

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
      sessionStorage.setItem('pendingNumerologyMessage', this.currentMessage.trim());
    }
  }

  // ✅ MÉTODO MIGRADO A PAYPAL
  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      await this.paypalService.initiatePayment({
        amount: '4.00',
        currency: 'EUR',
        serviceName: 'Numerologie-Lesung',
        returnPath: '/numerologie-lesung',
        cancelPath: '/numerologie-lesung',
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

  savePersonalData(): void {
    if (this.fullName) {
      this.personalNumbers.destiny =
        this.numerologyService.calculateDestinyNumber(this.fullName);
    }

    if (this.birthDate) {
      this.personalNumbers.lifePath = this.numerologyService.calculateLifePath(
        this.birthDate
      );
    }

    this.showDataForm = false;

    if (this.personalNumbers.lifePath || this.personalNumbers.destiny) {
      let numbersMessage = 'Ich habe deine heiligen Zahlen berechnet:\n\n';

      if (this.personalNumbers.lifePath) {
        numbersMessage += `🔹 Lebensweg: ${
          this.personalNumbers.lifePath
        } - ${this.numerologyService.getNumberMeaning(
          this.personalNumbers.lifePath
        )}\n\n`;
      }

      if (this.personalNumbers.destiny) {
        numbersMessage += `🔹 Schicksalszahl: ${
          this.personalNumbers.destiny
        } - ${this.numerologyService.getNumberMeaning(
          this.personalNumbers.destiny
        )}\n\n`;
      }

      numbersMessage +=
        'Möchtest du, dass ich tiefer in die Interpretation einer dieser Zahlen eingehe?';

      const numbersMsg: ConversationMessage = {
        role: 'numerologist',
        message: numbersMessage,
        timestamp: new Date(),
      };
      this.messages.push(numbersMsg);
      this.saveMessagesToSession();
    }
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  newConsultation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForNumerology) {
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('numerologyMessages');
      sessionStorage.removeItem('numerologyFirstQuestionAsked');
      sessionStorage.removeItem('numerologyBlockedMessageId');
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
    }

    this.messages = [];
    this.hasStartedConversation = false;
    this.startConversation();
    this.cdr.markForCheck();
  }

  private handleError(errorMessage: string): void {
    const errorMsg: ConversationMessage = {
      role: 'numerologist',
      message: `🔢 Die kosmischen Zahlen sind in Fluktuation... ${errorMessage} Versuche es erneut, wenn die numerischen Vibrationen sich stabilisiert haben.`,
      timestamp: new Date(),
    };
    this.messages.push(errorMsg);
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

  closeModal(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
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

    // ✅ NUEVO: Enviar datos al backend como en el componente de sueños
    this.sendUserDataToBackend(userData);
  }

  // ✅ NUEVO: Agregar método para enviar al backend (como en el componente de sueños)
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
  onPrizeWon(prize: Prize): void {
    const prizeMessage: ConversationMessage = {
      role: 'numerologist',
      message: `🔢 ¡Los números sagrados te han bendecido! Has ganado: **${prize.name}** ${prize.icon}\n\nLas vibraciones numéricas del universo han decidido favorecerte con este regalo cósmico. La energía de los números antiguos fluye a través de ti, revelando secretos más profundos de tu destino numerológico. ¡Que la sabiduría de los números te guíe!`,
      timestamp: new Date(),
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    this.processNumerologyPrize(prize);
  }

  showWheelAfterDelay(delayMs: number = 3000): void {
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
      }
    }, delayMs);
  }
}
