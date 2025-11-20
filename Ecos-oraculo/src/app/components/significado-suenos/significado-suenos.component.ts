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
  ConversationMessage,
  DreamInterpreterData,
  InterpretadorSuenosService,
} from '../../services/interpretador-suenos.service';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
@Component({
  selector: 'app-significado-suenos',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
    FortuneWheelComponent,
  ],
  templateUrl: './significado-suenos.component.html',
  styleUrl: './significado-suenos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignificadoSuenosComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  messageText: string = '';
  messageInput = new FormControl('');
  messages: ConversationMessage[] = [];
  isLoading = false;
  isTyping = false;
  hasStartedConversation = false;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  showFortuneWheel: boolean = false;
  wheelPrizes: Prize[] = [
    {
      id: '1',
      name: '3 weitere Drehungen',
      color: '#4ecdc4',
      icon: '🌙',
    },
    {
      id: '2',
      name: '1 Premium-Traumanalyse',
      color: '#45b7d1',
      icon: '✨',
    },
    // ✅ ELIMINADO: { id: '3', name: '2 Consultas Oníricas Extra', color: '#ffeaa7', icon: '🔮' },
    {
      id: '4',
      name: 'Versuche es nochmal!',
      color: '#ff7675',
      icon: '🔄',
    },
  ];
  private wheelTimer: any;

  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;

  // Variables para control de pagos
  showPaymentModal: boolean = false;

  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForDreams: boolean = false;
  firstQuestionAsked: boolean = false;

  // NUEVA PROPIEDAD para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  textareaHeight: number = 25; // Altura inicial
  private readonly minTextareaHeight = 45;
  private readonly maxTextareaHeight = 120;
  private backendUrl = environment.apiUrl;

  interpreterData: DreamInterpreterData = {
    name: 'Meisterin Alma',
    specialty: 'Traumdeutung und onirische Symbolik',
    experience:
      'Jahrhunderte der Interpretation von Botschaften des Unterbewusstseins',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Ah, ich sehe, du bist gekommen, um die Mysterien deiner onirischen Welt zu entschlüsseln... Träume sind Fenster zur Seele. Erzähl mir, welche Visionen dich besucht haben?',
    'Die kosmischen Energien flüstern mir zu, dass du Träume hast, die interpretiert werden müssen. Ich bin Meisterin Alma, Hüterin der onirischen Geheimnisse. Welche Botschaft des Unterbewusstseins beunruhigt dich?',
    'Willkommen, Reisender der Träume. Die astralen Ebenen haben mir deine Ankunft gezeigt. Lass mich dich durch die Symbole und Mysterien deiner nächtlichen Visionen führen.',
    'Der Kristall der Träume leuchtet bei deiner Anwesenheit auf... Ich spüre, dass du Visionen trägst, die entschlüsselt werden müssen. Vertraue meiner uralten Weisheit und teile deine Träume mit mir.',
  ];

  constructor(
    private dreamService: InterpretadorSuenosService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService // ← AGREGAR ESTA LÍNEA
  ) {}
  ngAfterViewInit(): void {
    this.setVideosSpeed(0.66); // 0.5 = más lento, 1 = normal
  }
  async ngOnInit(): Promise<void> {
    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          // ✅ Pago SOLO para este servicio (Traumdeutung)
          this.hasUserPaidForDreams = true;
          sessionStorage.setItem('hasUserPaidForDreams_traumdeutung', 'true');

          // NO usar localStorage global
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('dreamBlockedMessageId');

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

          // ✅ MENSAJE DE CONFIRMACIÓN (usando messages.push con interfaz correcta)
          setTimeout(() => {
            const successMessage: ConversationMessage = {
              role: 'interpreter',
              message:
                '🎉 Zahlung erfolgreich abgeschlossen!\n\n' +
                '✨ Vielen Dank für deine Zahlung. Du hast jetzt vollen Zugriff auf die Traumdeutung.\n\n' +
                '💭 Lass uns gemeinsam die Geheimnisse deiner Träume entdecken!\n\n' +
                '📌 Hinweis: Diese Zahlung gilt nur für den Traumdeutung-Service. Für andere Dienste ist eine separate Zahlung erforderlich.',
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
              role: 'interpreter',
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
            role: 'interpreter',
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

    // ✅ Verificar pago SOLO de este servicio específico
    this.hasUserPaidForDreams =
      sessionStorage.getItem('hasUserPaidForDreams_traumdeutung') === 'true';

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

    const savedMessages = sessionStorage.getItem('dreamMessages');
    const savedFirstQuestion = sessionStorage.getItem('firstQuestionAsked');
    const savedBlockedMessageId = sessionStorage.getItem('blockedMessageId');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp), // Convertir string a Date
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
      } catch (error) {
        // Si hay error, limpiar y empezar de nuevo
        this.clearSessionData();
        this.startConversation();
      }
    } else {
      // Si no hay mensajes guardados, iniciar conversación
      this.startConversation();
    }
  }

  private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v: any) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }

  showWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.wheelTimer = setTimeout(() => {
      // ✅ USAR MÉTODO ESTÁTICO DEL COMPONENTE RULETA
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
    // Mostrar mensaje del intérprete sobre el premio
    const prizeMessage: ConversationMessage = {
      role: 'interpreter',
      message: `🌙 Die kosmischen Energien haben dich gesegnet! Du hast gewonnen: **${prize.name}** ${prize.icon}\n\nDieses Geschenk des onirischen Universums wurde für dich aktiviert. Die Mysterien der Träume enthüllen sich dir mit größerer Klarheit. Möge das Glück dich bei deinen nächsten Interpretationen begleiten!`,
      timestamp: new Date(),
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    // Procesar el premio
    this.processDreamPrize(prize);
  }
  private processDreamPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Interpretaciones Gratis
        this.addFreeDreamConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.hasUserPaidForDreams = true;
        sessionStorage.setItem('hasUserPaidForDreams', 'true');

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('blockedMessageId');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: ConversationMessage = {
          role: 'interpreter',
          message:
            '✨ **Du hast vollen Premium-Zugang freigeschaltet!** ✨\n\nDie Geheimnisse der Traumwelt haben dir auf außergewöhnliche Weise zugelächelt. Du hast jetzt unbegrenzten Zugang zur gesamten Weisheit der Träume. Du kannst jederzeit nach Interpretationen, onirischen Symbolen und allen Geheimnissen des Unterbewusstseins fragen.\n\n🌙 *Die Tore des Reiches der Träume haben sich vollständig für dich geöffnet* 🌙',
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
  private addFreeDreamConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeDreamConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeDreamConsultations', newTotal.toString());

    // Si había un mensaje bloqueado, desbloquearlo
    if (this.blockedMessageId && !this.hasUserPaidForDreams) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('blockedMessageId');
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
  getDreamConsultationsCount(): number {
    const freeDreamConsultations = parseInt(
      sessionStorage.getItem('freeDreamConsultations') || '0'
    );
    const legacyFreeConsultations = parseInt(
      sessionStorage.getItem('freeConsultations') || '0'
    );

    return freeDreamConsultations + legacyFreeConsultations;
  }
  // Cerrar la ruleta
  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
    }
  }
  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50; // píxeles desde el bottom
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold;
    this.shouldAutoScroll = isNearBottom;
  }
  ngOnDestroy(): void {
    // Limpiar timer de la ruleta
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
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
        'Du hast keine Drehungen verfügbar. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }
  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }
  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  startConversation(): void {
    // Solo agregar mensaje de bienvenida si no hay mensajes
    if (this.messages.length === 0) {
      const randomWelcome =
        this.welcomeMessages[
          Math.floor(Math.random() * this.welcomeMessages.length)
        ];

      const welcomeMessage: ConversationMessage = {
        role: 'interpreter',
        message: randomWelcome,
        timestamp: new Date(),
      };

      this.messages.push(welcomeMessage);
    }
    this.hasStartedConversation = true;

    // ✅ VERIFICACIÓN SIMPLIFICADA
    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    } else {
    }
  }

  sendMessage(): void {
    if (this.messageText?.trim() && !this.isLoading) {
      const userMessage = this.messageText.trim();

      // ✅ NUEVA LÓGICA: Verificar premios disponibles ANTES de bloquear
      if (!this.hasUserPaidForDreams && this.firstQuestionAsked) {
        // Verificar si tiene consultas gratis disponibles
        if (this.hasFreeConsultationsAvailable()) {
          this.useFreeConsultation();
          // Continuar con el mensaje sin bloquear
        } else {
          // Si no tiene consultas gratis, mostrar modal de datos PRIMERO

          // ✅ Cerrar otros modales primero
          this.showFortuneWheel = false;
          this.showPaymentModal = false;

          // ✅ Guardar el mensaje para procesarlo después del pago
          sessionStorage.setItem('pendingUserMessage', userMessage);

          this.saveStateBeforePayment();

          // ✅ Mostrar modal de datos con timeout para asegurar el cambio
          setTimeout(() => {
            this.showDataModal = true;
            this.cdr.markForCheck();
          }, 100);

          return; // ✅ Salir aquí para no procesar el mensaje aún
        }
      }

      // ✅ ACTIVAR AUTO-SCROLL cuando se envía un mensaje
      this.shouldAutoScroll = true;

      // ✅ Procesar el mensaje normalmente
      this.processUserMessage(userMessage);
    }
  }
  private processUserMessage(userMessage: string): void {
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.messageText = '';
    this.isTyping = true;
    this.isLoading = true;

    const conversationHistory = this.messages.slice(0, -1);

    this.dreamService
      .chatWithInterpreter({
        interpreterData: this.interpreterData,
        userMessage: userMessage,
        conversationHistory: conversationHistory,
      })
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.isTyping = false;

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            const interpreterMsg: ConversationMessage = {
              role: 'interpreter',
              message: response.response,
              timestamp: new Date(),
              id: messageId,
            };
            this.messages.push(interpreterMsg);

            this.shouldAutoScroll = true;

            // ✅ ACTUALIZADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
            if (
              this.firstQuestionAsked &&
              !this.hasUserPaidForDreams &&
              !this.hasFreeConsultationsAvailable()
            ) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('blockedMessageId', messageId);

              // ✅ CAMBIO: Mostrar modal de datos en lugar de ir directo al pago
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
              sessionStorage.setItem('firstQuestionAsked', 'true');
            }

            this.saveMessagesToSession();
            this.cdr.markForCheck();
          } else {
            this.handleError('Fehler beim Abrufen der Antwort des Interpreten');
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
  // ✅ NUEVO: Verificar si tiene consultas gratis disponibles
  private hasFreeConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeConsultations') || '0'
    );

    return freeConsultations > 0;
  }

  // ✅ NUEVO: Usar una consulta gratis
  private useFreeConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem('freeConsultations', remaining.toString());
      // Mostrar mensaje informativo
      const prizeMsg: ConversationMessage = {
        role: 'interpreter',
        message: `✨ *Du hast eine kostenlose Beratung verwendet* ✨\n\nDir bleiben **${remaining}** kostenlose Beratungen verfügbar.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  // ✅ NUEVO: Obtener resumen de premios disponibles
  getPrizesAvailable(): string {
    const prizes: string[] = [];

    const freeConsultations = parseInt(
      sessionStorage.getItem('freeConsultations') || '0'
    );
    if (freeConsultations > 0) {
      prizes.push(
        `${freeConsultations} kostenlose${
          freeConsultations > 1 ? ' Beratungen' : ' Beratung'
        }`
      );
    }

    const freeInterpretations = parseInt(
      sessionStorage.getItem('freeInterpretations') || '0'
    );
    if (freeInterpretations > 0) {
      prizes.push(
        `${freeInterpretations} kostenlose${
          freeInterpretations > 1 ? ' Interpretationen' : ' Interpretation'
        }`
      );
    }

    if (sessionStorage.getItem('hasVIPConsultation') === 'true') {
      prizes.push('1 VIP-Beratung');
    }

    if (sessionStorage.getItem('hasPremiumReading') === 'true') {
      prizes.push('1 Premium-Lesung');
    }

    if (sessionStorage.getItem('hasMysticBonus') === 'true') {
      prizes.push('Mystischer Bonus aktiv');
    }

    return prizes.length > 0 ? prizes.join(', ') : 'Keine';
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'firstQuestionAsked',
      this.firstQuestionAsked.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem('blockedMessageId', this.blockedMessageId);
    }
  }

  // ✅ ARREGLO: Método para guardar mensajes corregido
  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem('dreamMessages', JSON.stringify(messagesToSave));
    } catch (error) {}
  }

  // ✅ NUEVO: Método para limpiar datos de sesión
  private clearSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForDreams');
    sessionStorage.removeItem('dreamMessages');
    sessionStorage.removeItem('firstQuestionAsked');
    sessionStorage.removeItem('blockedMessageId');
  }

  // MÉTODO PARA VERIFICAR SI UN MENSAJE ESTÁ BLOQUEADO
  isMessageBlocked(message: ConversationMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForDreams;
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
    if (this.messageText?.trim()) {
      sessionStorage.setItem('pendingDreamMessage', this.messageText.trim());
    }
  }

  // ✅ MÉTODO MIGRADO A PAYPAL
  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      // Iniciar el flujo de pago de PayPal (redirige al usuario)
      await this.paypalService.initiatePayment({
        amount: '5.00',
        currency: 'EUR',
        serviceName: 'Traumdeutung',
        returnPath: '/traumdeutung',
        cancelPath: '/traumdeutung',
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
  // Método para nueva consulta (resetear solo si no ha pagado)
  newConsultation(): void {
    // ✅ RESETEAR CONTROL DE SCROLL
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForDreams) {
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('dreamMessages');
      sessionStorage.removeItem('firstQuestionAsked');
      sessionStorage.removeItem('blockedMessageId');
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
      role: 'interpreter',
      message: `🔮 Die kosmischen Energien sind gestört... ${errorMessage} Versuche es erneut, wenn die Vibrationen stabilisiert sind.`,
      timestamp: new Date(),
    };
    this.messages.push(errorMsg);

    // ✅ ACTIVAR AUTO-SCROLL para mensajes de error
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

  // Actualizar el método onKeyPress
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.messageText?.trim() && !this.isLoading) {
        this.sendMessage();
        // Resetear altura del textarea después del envío
        setTimeout(() => {
          this.textareaHeight = this.minTextareaHeight;
        }, 50);
      }
    }
  }

  getTimeString(timestamp: Date | string): string {
    try {
      // Si es string, convertir a Date
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

      // Verificar que sea una fecha válida
      if (isNaN(date.getTime())) {
        return 'N/A';
      }

      return date.toLocaleTimeString('es-ES', {
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
        `Um mit der Zahlung fortzufahren, musst du folgende Felder ausfüllen: ${missingFields.join(
          ', '
        )}`
      );
      this.showDataModal = true; // Modal offen halten
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

    // Enviar datos al backend (opcional, no bloquea el pago)
    this.sendUserDataToBackend(userData);
  }
  private sendUserDataToBackend(userData: any): void {
    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        // ✅ LLAMAR A promptForPayment() PARA INICIALIZAR STRIPE
        this.promptForPayment();
      },
      error: (error) => {
        // ✅ AUN ASÍ PROCEDER AL PAGO
        this.promptForPayment();
      },
    });
  }
  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }
}
