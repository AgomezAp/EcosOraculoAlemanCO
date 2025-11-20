import { CommonModule } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AnimalChatRequest,
  AnimalGuideData,
  AnimalInteriorService,
} from '../../services/animal-interior.service';
import { PaypalService } from '../../services/paypal.service';
import { HttpClient } from '@angular/common/http';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
interface Message {
  role: 'user' | 'guide';
  content: string;
  timestamp: Date;
}

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}
@Component({
  selector: 'app-animal-interior',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
    FortuneWheelComponent,
  ],
  templateUrl: './animal-interior.component.html',
  styleUrl: './animal-interior.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimalInteriorComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  chatMessages: ChatMessage[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;
  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;
  // Propiedades para controlar el scroll
  private shouldScrollToBottom: boolean = true;
  private isUserScrolling: boolean = false;
  private lastMessageCount: number = 0;

  // Datos del guía
  private guideData: AnimalGuideData = {
    name: 'Schamane Olivia',
    specialty: 'Führerin der Inneren Tiere',
    experience: 'Spezialistin für spirituelle Verbindung mit dem Tierreich',
  };
  //Propiedades para la ruleta
  showFortuneWheel: boolean = false;
  animalPrizes: Prize[] = [
    {
      id: '1',
      name: '3 Drehungen des Tier-Rads',
      color: '#4ecdc4',
      icon: '🦉',
    },
    { id: '2', name: '1 Premium-Tierführer', color: '#45b7d1', icon: '🦋' },
    {
      id: '4',
      name: 'Versuche es nochmal!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;
  // Stripe/payment
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForAnimal: boolean = false;
  firstQuestionAsked: boolean = false;
  blockedMessageId: string | null = null;
  private backendUrl = environment.apiUrl;

  constructor(
    private animalService: AnimalInteriorService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService
  ) {}
  @ViewChild('backgroundVideo') backgroundVideo!: ElementRef<HTMLVideoElement>;

  ngAfterViewInit(): void {
    // Ajusta la velocidad del video de fondo (0.5 = la mitad de velocidad)
    if (this.backgroundVideo && this.backgroundVideo.nativeElement) {
      this.backgroundVideo.nativeElement.playbackRate = 0.6;
    }
  }

  async ngOnInit(): Promise<void> {
    this.hasUserPaidForAnimal = sessionStorage.getItem('hasUserPaidForAnimal_inneresTier') === 'true';
    
    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForAnimal = true;
          sessionStorage.setItem('hasUserPaidForAnimal_inneresTier', 'true');
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('animalInteriorBlockedMessageId');

          // Clear URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          this.addMessage({
            sender: this.guideData.name,
            content:
              '✨ Zahlung bestätigt! Jetzt kannst du auf all meine Erfahrung zugreifen.',
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

    const savedMessages = sessionStorage.getItem('animalInteriorMessages');
    const savedFirstQuestion = sessionStorage.getItem(
      'animalInteriorFirstQuestionAsked'
    );
    const savedBlockedMessageId = sessionStorage.getItem(
      'animalInteriorBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.chatMessages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
        this.lastMessageCount = this.chatMessages.length;
      } catch (error) {
        // Limpiar datos corruptos
        this.initializeWelcomeMessage();
      }
    }

    if (this.chatMessages.length === 0) {
      this.initializeWelcomeMessage();
    }

    if (this.chatMessages.length > 0 && FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(2000);
    }
  }
  private initializeWelcomeMessage(): void {
    this.addMessage({
      sender: 'Schamane Olivia',
      content: `🦉 Hallo, Suchender! Ich bin Olivia, deine spirituelle Führerin des Tierreichs. Ich bin hier, um dir zu helfen, dein inneres Tier zu entdecken und dich damit zu verbinden.

Was möchtest du über deinen Tiergeist erkunden?`,
      timestamp: new Date(),
      isUser: false,
    });

    if (FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(3000);
    } else {
    }
  }
  ngAfterViewChecked(): void {
    // Solo hacer scroll automático si hay nuevos mensajes y el usuario no está haciendo scroll manual
    if (
      this.shouldScrollToBottom &&
      !this.isUserScrolling &&
      this.chatMessages.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.chatMessages.length;
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }
  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;
    const userMessage = this.currentMessage.trim();

    // ✅ NUEVA LÓGICA: Verificar consultas animales gratuitas ANTES de verificar pago
    if (!this.hasUserPaidForAnimal && this.firstQuestionAsked) {
      // Verificar si tiene consultas animales gratis disponibles
      if (this.hasFreeAnimalConsultationsAvailable()) {
        this.useFreeAnimalConsultation();
        // Continuar con el mensaje sin bloquear
      } else {
        // Si no tiene consultas gratis, mostrar modal de datos

        // Cerrar otros modales primero
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Guardar el mensaje para procesarlo después del pago
        sessionStorage.setItem('pendingAnimalMessage', userMessage);

        this.saveStateBeforePayment();

        // Mostrar modal de datos con timeout
        setTimeout(() => {
          this.showDataModal = true;
          this.cdr.markForCheck();
        }, 100);

        return; // Salir aquí para no procesar el mensaje aún
      }
    }

    this.shouldScrollToBottom = true;

    // Procesar mensaje normalmente
    this.processUserMessage(userMessage);
  }
  private processUserMessage(userMessage: string): void {
    this.addMessage({
      sender: 'Du',
      content: userMessage,
      timestamp: new Date(),
      isUser: true,
    });

    this.currentMessage = '';
    this.isLoading = true;

    // Preparar conversationHistory para tu servicio
    const conversationHistory = this.chatMessages.slice(-10).map((msg) => ({
      role: msg.isUser ? ('user' as const) : ('guide' as const),
      message: msg.content,
    }));

    // Preparar el request según tu interfaz
    const chatRequest: AnimalChatRequest = {
      guideData: this.guideData,
      userMessage: userMessage,
      conversationHistory: conversationHistory,
    };

    this.animalService.chatWithGuide(chatRequest).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.shouldScrollToBottom = true;

        if (response.success && response.response) {
          const messageId = Date.now().toString();
          this.addMessage({
            sender: 'Schamane Olivia',
            content: response.response,
            timestamp: new Date(),
            isUser: false,
            id: messageId,
          });

          // ✅ LÓGICA MODIFICADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
          if (
            this.firstQuestionAsked &&
            !this.hasUserPaidForAnimal &&
            !this.hasFreeAnimalConsultationsAvailable()
          ) {
            this.blockedMessageId = messageId;
            sessionStorage.setItem('animalInteriorBlockedMessageId', messageId);
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
            sessionStorage.setItem('animalInteriorFirstQuestionAsked', 'true');
          }
        } else {
          this.addMessage({
            sender: 'Schamane Olivia',
            content:
              '🦉 Entschuldigung, ich konnte in diesem Moment nicht mit der Tierweisheit verbinden. Versuche es erneut.',
            timestamp: new Date(),
            isUser: false,
          });
        }
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isLoading = false;
        this.shouldScrollToBottom = true;
        this.addMessage({
          sender: 'Schamane Olivia',
          content:
            '🦉 Es gab einen Fehler in der spirituellen Verbindung. Versuche es erneut.',
          timestamp: new Date(),
          isUser: false,
        });
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
    });
  }
  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'animalInteriorFirstQuestionAsked',
      this.firstQuestionAsked.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'animalInteriorBlockedMessageId',
        this.blockedMessageId
      );
    }
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.chatMessages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem(
        'animalInteriorMessages',
        JSON.stringify(messagesToSave)
      );
    } catch {}
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForAnimal;
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

    // Guardar mensaje pendiente si existe
    if (this.currentMessage) {
      sessionStorage.setItem('pendingAnimalMessage', this.currentMessage);
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      await this.paypalService.initiatePayment({
        amount: '5.00',
        currency: 'EUR',
        serviceName: 'Inneres Tier',
        returnPath: '/inneres-tier',
        cancelPath: '/inneres-tier',
      });
    } catch (error: any) {
      this.paymentError =
        error.message || 'Fehler beim Initialisieren der PayPal-Zahlung.';
      this.isProcessingPayment = false;
      this.cdr.markForCheck();
    }
  }

  cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  addMessage(message: ChatMessage): void {
    this.chatMessages.push(message);
    this.shouldScrollToBottom = true;
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

  getTimeString(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onScroll(event: any): void {
    const element = event.target;
    const isAtBottom =
      element.scrollHeight - element.scrollTop === element.clientHeight;

    // Si el usuario no está en el fondo, está haciendo scroll manual
    this.isUserScrolling = !isAtBottom;

    // Si el usuario vuelve al fondo, permitir scroll automático nuevamente
    if (isAtBottom) {
      this.isUserScrolling = false;
    }
  }

  onUserStartScroll(): void {
    // Indicar que el usuario está haciendo scroll manual
    this.isUserScrolling = true;

    // Después de 3 segundos sin actividad, permitir scroll automático nuevamente
    setTimeout(() => {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        const isAtBottom =
          element.scrollHeight - element.scrollTop === element.clientHeight;
        if (isAtBottom) {
          this.isUserScrolling = false;
        }
      }
    }, 3000);
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch {}
  }

  clearChat(): void {
    // Limpiar mensajes del chat
    this.chatMessages = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;

    // Resetear estados
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;
    this.isLoading = false;

    // Limpiar sessionStorage
    sessionStorage.removeItem('animalInteriorMessages');
    sessionStorage.removeItem('animalInteriorFirstQuestionAsked');
    sessionStorage.removeItem('animalInteriorBlockedMessageId');

    // Indicar que se debe hacer scroll porque hay un mensaje nuevo
    this.shouldScrollToBottom = true;

    // Agregar mensaje de bienvenida inicial
    this.addMessage({
      sender: 'Schamane Olivia',
      content: `🦉 Hallo, Suchender! Ich bin Olivia, deine spirituelle Führerin des Tierreichs. Ich bin hier, um dir zu helfen, dein inneres Tier zu entdecken und dich damit zu verbinden.

Was möchtest du über deinen Tiergeist erkunden?`,
      timestamp: new Date(),
      isUser: false,
    });
    if (FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(3000);
    } else {
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
  showAnimalWheelAfterDelay(delayMs: number = 3000): void {
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

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ChatMessage = {
      sender: 'Schamane Olivia',
      content: `🦉 Die Tiergeister haben gesprochen! Du hast gewonnen: **${prize.name}** ${prize.icon}\n\nDie alten Wächter des Tierreichs haben entschieden, dich mit diesem heiligen Geschenk zu segnen. Die spirituelle Energie fließt durch dich, verbindet dich tiefer mit deinem inneren Tier. Möge die uralte Weisheit dich führen!`,
      timestamp: new Date(),
      isUser: false,
    };

    this.chatMessages.push(prizeMessage);
    this.shouldScrollToBottom = true;
    this.saveMessagesToSession();

    this.processAnimalPrize(prize);
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  triggerAnimalWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        'Du hast keine verfügbaren Drehungen. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processAnimalPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Conexiones Espirituales
        this.addFreeAnimalConsultations(3);
        break;
      case '2': // 1 Guía Premium - ACCESO COMPLETO
        this.hasUserPaidForAnimal = true;
        sessionStorage.setItem('hasUserPaidAnimalInterior', 'true');

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('animalInteriorBlockedMessageId');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: ChatMessage = {
          sender: 'Schamane Olivia',
          content:
            '🦋 **Du hast den vollständigen Premium-Zugang freigeschaltet!** 🦋\n\nDie Tiergeister haben dich auf außergewöhnliche Weise angelächelt. Jetzt hast du unbegrenzten Zugang zu all der Weisheit des Tierreichs. Du kannst so oft wie du möchtest über dein inneres Tier, spirituelle Verbindungen und alle uralten Mysterien konsultieren.\n\n✨ *Die Wächter des Tierreichs haben alle ihre Türen für dich geöffnet* ✨',
          timestamp: new Date(),
          isUser: false,
        };
        this.chatMessages.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        break;
      default:
    }
  }
  private addFreeAnimalConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeAnimalConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeAnimalConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForAnimal) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('animalInteriorBlockedMessageId');
    }
  }

  private hasFreeAnimalConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAnimalConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeAnimalConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAnimalConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem('freeAnimalConsultations', remaining.toString());

      const prizeMsg: ChatMessage = {
        sender: 'Schamane Olivia',
        content: `✨ *Du hast eine kostenlose spirituelle Verbindung verwendet* ✨\n\nDir bleiben **${remaining}** Beratungen mit dem Tierreich verfügbar.`,
        timestamp: new Date(),
        isUser: false,
      };
      this.chatMessages.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveMessagesToSession();
    }
  }

  debugAnimalWheel(): void {
    this.showFortuneWheel = true;
    this.cdr.markForCheck();
  }
}
