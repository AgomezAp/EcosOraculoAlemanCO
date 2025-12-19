import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
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
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  InformacionZodiacoService,
  ZodiacRequest,
  ZodiacResponse,
  AstrologerData,
} from '../../services/informacion-zodiaco.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { PaypalService } from '../../services/paypal.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';

interface ZodiacMessage {
  content: string;
  isUser: boolean;
  timestamp: Date;
  sender?: string;
  id?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  isCompleteResponse?: boolean;
  isPrizeAnnouncement?: boolean;
}

@Component({
  selector: 'app-informacion-zodiaco',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './informacion-zodiaco.component.html',
  styleUrl: './informacion-zodiaco.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformacionZodiacoComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Haupt-Chat-Variablen
  currentMessage: string = '';
  messages: ZodiacMessage[] = [];
  isLoading = false;
  hasStartedConversation = false;

  // Scroll-Steuerungsvariablen
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Variablen für Datenmodal
  showDataModal: boolean = false;
  userData: any = null;

  // Variablen für Zahlungssteuerung
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForAstrology: boolean = false;

  // ✅ NEU: System mit 3 kostenlosen Nachrichten
  private userMessageCount: number = 0;
  private readonly FREE_MESSAGES_LIMIT = 3;

  // Konfiguration des Glücksrades
  showFortuneWheel: boolean = false;
  astralPrizes: Prize[] = [
    {
      id: '1',
      name: '3 Würfe des Astralrades',
      color: '#4ecdc4',
      icon: '🔮',
    },
    { id: '2', name: '1 Premium-Astrallesung', color: '#45b7d1', icon: '✨' },
    {
      id: '4',
      name: 'Versuche es erneut!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];

  private wheelTimer: any;
  blockedMessageId: string | null = null;
  private backendUrl = environment.apiUrl;

  astrologerInfo = {
    name: 'Meisterin Carla',
    title: 'Hüterin der Sterne',
    specialty: 'Spezialistin für Astrologie und Sternzeichen',
  };

  // Zufällige Willkommensnachrichten
  welcomeMessages = [
    'Willkommen, kosmische Seele. Die Sterne haben mir dein Kommen zugeflüstert... Welche Geheimnisse des Tierkreises möchtest du heute entschlüsseln?',
    'Die Planeten richten sich aus, um dich zu empfangen. Ich bin Meisterin Carla, Interpretin der himmlischen Schicksale. Worüber möchtest du bezüglich deines Sternzeichens oder himmlischer Aspekte beraten werden?',
    'Das Universum vibriert mit deiner Anwesenheit... Die Sternbilder tanzen und erwarten deine Fragen. Erlaube mir, dich durch die Wege des Tierkreises zu führen.',
    'Ah, ich sehe, dass die Sterne dich zu mir geführt haben. Die Geheimnisse der Sternzeichen warten darauf, enthüllt zu werden. Was beunruhigt dich am Firmament?',
  ];

  constructor(
    private http: HttpClient,
    private zodiacoService: InformacionZodiacoService,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    @Optional() public dialogRef: MatDialogRef<InformacionZodiacoComponent>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService
  ) {}

  async ngOnInit(): Promise<void> {
    // Zahlungsstatus laden
    this.hasUserPaidForAstrology =
      sessionStorage.getItem('hasUserPaidForZodiacInfo_zodiacInfo') === 'true';

    // ✅ NEU: Nachrichtenzähler laden
    const savedMessageCount = sessionStorage.getItem('zodiacUserMessageCount');
    if (savedMessageCount) {
      this.userMessageCount = parseInt(savedMessageCount, 10);
    }

    // PayPal-Zahlung verifizieren
    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForAstrology = true;
          sessionStorage.setItem('hasUserPaidForZodiacInfo_zodiacInfo', 'true');
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('astrologyBlockedMessageId');

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          this.messages.push({
            sender: this.astrologerInfo.name,
            content:
              '✨ Zahlung bestätigt! Du hast jetzt unbegrenzten Zugang zu meiner gesamten Erfahrung und himmlischen Weisheit.',
            timestamp: new Date(),
            isUser: false,
          });

          this.cdr.markForCheck();
        }
      } catch (error) {
        this.paymentError = 'Fehler bei der Zahlungsverifizierung';
      }
    }

    // Benutzerdaten aus sessionStorage laden
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

    // Gespeicherte Nachrichten laden
    const savedMessages = sessionStorage.getItem('astrologyMessages');
    const savedBlockedMessageId = sessionStorage.getItem(
      'astrologyBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
      } catch (error) {
        this.clearSessionData();
        this.startConversation();
      }
    } else {
      this.startConversation();
    }

    // Glücksrad anzeigen wenn zutreffend
    if (this.hasStartedConversation && FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(2000);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  // ✅ NEU: Verbleibende kostenlose Nachrichten abrufen
  getFreeMessagesRemaining(): number {
    if (this.hasUserPaidForAstrology) {
      return -1; // Unbegrenzt
    }
    return Math.max(0, this.FREE_MESSAGES_LIMIT - this.userMessageCount);
  }

  // ✅ NEU: Zugang prüfen
  private hasAccess(): boolean {
    // Premium = unbegrenzter Zugang
    if (this.hasUserPaidForAstrology) {
      return true;
    }

    // Hat kostenlose Beratungen vom Glücksrad
    if (this.hasFreeAstrologyConsultationsAvailable()) {
      return true;
    }

    // Innerhalb des Limits der kostenlosen Nachrichten
    if (this.userMessageCount < this.FREE_MESSAGES_LIMIT) {
      return true;
    }

    return false;
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

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ZodiacMessage = {
      isUser: false,
      content: `🌟 Die kosmischen Energien haben dich gesegnet! Du hast gewonnen: **${prize.name}** ${prize.icon}\n\nDieses Geschenk des Universums wurde für dich aktiviert. Die Geheimnisse des Tierkreises werden dir mit größerer Klarheit offenbart. Möge das astrale Glück dich bei deinen nächsten Beratungen begleiten!`,
      timestamp: new Date(),
      isPrizeAnnouncement: true,
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    this.processAstralPrize(prize);
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
        'Du hast keine Würfe mehr verfügbar. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processAstralPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Kostenlose Beratungen
        this.addFreeAstrologyConsultations(3);
        break;
      case '2': // 1 Premium-Lesung - VOLLER ZUGANG
        this.hasUserPaidForAstrology = true;
        sessionStorage.setItem('hasUserPaidForZodiacInfo_zodiacInfo', 'true');

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('astrologyBlockedMessageId');
        }

        const premiumMessage: ZodiacMessage = {
          isUser: false,
          content:
            '✨ **Du hast den vollständigen Premium-Zugang freigeschaltet!** ✨\n\nDie Sterne haben sich auf außergewöhnliche Weise ausgerichtet, um dir zu helfen. Du hast jetzt unbegrenzten Zugang zu allem astralen Wissen. Du kannst Sternzeichen, Kompatibilitäten, astrologische Vorhersagen und alle himmlischen Geheimnisse so oft anfragen, wie du möchtest.\n\n🌟 *Die Sterne haben alle ihre kosmischen Türen für dich geöffnet* 🌟',
          timestamp: new Date(),
        };
        this.messages.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      case '4': // Noch eine Chance
        break;
      default:
    }
  }

  private addFreeAstrologyConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeAstrologyConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForAstrology) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('astrologyBlockedMessageId');
    }

    // Informationsnachricht
    const infoMessage: ZodiacMessage = {
      isUser: false,
      content: `✨ *Du hast ${count} kostenlose Astralberatungen erhalten* ✨\n\nDu hast jetzt **${newTotal}** Beratungen verfügbar, um die Mysterien des Tierkreises zu erkunden.`,
      timestamp: new Date(),
    };
    this.messages.push(infoMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
  }

  private hasFreeAstrologyConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeAstrologyConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem(
        'freeAstrologyConsultations',
        remaining.toString()
      );

      const prizeMsg: ZodiacMessage = {
        isUser: false,
        content: `✨ *Du hast eine kostenlose Astralberatung verwendet* ✨\n\nDir bleiben noch **${remaining}** kostenlose Astralberatungen.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
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

      const welcomeMessage: ZodiacMessage = {
        isUser: false,
        content: randomWelcome,
        timestamp: new Date(),
      };

      this.messages.push(welcomeMessage);
    }
    this.hasStartedConversation = true;

    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    }
  }

  // ✅ MODIFIZIERT: sendMessage() mit System für 3 kostenlose Nachrichten
  sendMessage(): void {
    if (this.currentMessage?.trim() && !this.isLoading) {
      const userMessage = this.currentMessage.trim();

      // Nächste Nachrichtennummer berechnen
      const nextMessageCount = this.userMessageCount + 1;

      console.log(
        `📊 Nachricht #${nextMessageCount}, Premium: ${this.hasUserPaidForAstrology}, Limit: ${this.FREE_MESSAGES_LIMIT}`
      );

      // ✅ Zugang prüfen
      const canSendMessage =
        this.hasUserPaidForAstrology ||
        this.hasFreeAstrologyConsultationsAvailable() ||
        nextMessageCount <= this.FREE_MESSAGES_LIMIT;

      if (!canSendMessage) {
        console.log('❌ Kein Zugang - Zahlungsmodal anzeigen');

        // Andere Modals schließen
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Ausstehende Nachricht speichern
        sessionStorage.setItem('pendingAstrologyMessage', userMessage);
        this.saveStateBeforePayment();

        // Datenmodal anzeigen
        setTimeout(() => {
          this.showDataModal = true;
          this.cdr.markForCheck();
        }, 100);

        return;
      }

      // ✅ Wenn kostenlose Rad-Beratung verwendet wird (nach den 3 kostenlosen)
      if (
        !this.hasUserPaidForAstrology &&
        nextMessageCount > this.FREE_MESSAGES_LIMIT &&
        this.hasFreeAstrologyConsultationsAvailable()
      ) {
        this.useFreeAstrologyConsultation();
      }

      this.shouldAutoScroll = true;
      this.processUserMessage(userMessage, nextMessageCount);
    }
  }

  // ✅ MODIFIZIERT: processUserMessage() um messageCount an Backend zu senden
  private processUserMessage(userMessage: string, messageCount: number): void {
    // Benutzernachricht hinzufügen
    const userMsg: ZodiacMessage = {
      isUser: true,
      content: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    // ✅ Zähler aktualisieren
    this.userMessageCount = messageCount;
    sessionStorage.setItem(
      'zodiacUserMessageCount',
      this.userMessageCount.toString()
    );

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    // ✅ Antwort mit messageCount generieren
    this.generateAstrologyResponse(userMessage, messageCount).subscribe({
      next: (response: ZodiacResponse) => {
        this.isLoading = false;

        const messageId = Date.now().toString();
        const astrologerMsg: ZodiacMessage = {
          isUser: false,
          content: response.response || '',
          timestamp: new Date(),
          id: messageId,
          freeMessagesRemaining: response.freeMessagesRemaining,
          showPaywall: response.showPaywall,
          isCompleteResponse: response.isCompleteResponse,
        };
        this.messages.push(astrologerMsg);

        this.shouldAutoScroll = true;

        console.log(
          `📊 Antwort - Verbleibende Nachrichten: ${response.freeMessagesRemaining}, Paywall: ${response.showPaywall}, Vollständig: ${response.isCompleteResponse}`
        );

        // ✅ Paywall anzeigen wenn Backend es anzeigt
        if (response.showPaywall && !this.hasUserPaidForAstrology) {
          this.blockedMessageId = messageId;
          sessionStorage.setItem('astrologyBlockedMessageId', messageId);

          setTimeout(() => {
            this.saveStateBeforePayment();

            this.showFortuneWheel = false;
            this.showPaymentModal = false;

            setTimeout(() => {
              this.showDataModal = true;
              this.cdr.markForCheck();
            }, 100);
          }, 2500);
        }

        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        this.isLoading = false;
        console.error('Fehler in Antwort:', error);

        const errorMsg: ZodiacMessage = {
          isUser: false,
          content:
            '🌟 Entschuldigung, die kosmischen Energien sind vorübergehend gestört. Bitte versuche es in einigen Momenten erneut.',
          timestamp: new Date(),
        };
        this.messages.push(errorMsg);
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
    });
  }

  // ✅ MODIFIZIERT: generateAstrologyResponse() um messageCount und isPremiumUser einzuschließen
  private generateAstrologyResponse(
    userMessage: string,
    messageCount: number
  ): Observable<ZodiacResponse> {
    // Konversationsverlauf erstellen
    const conversationHistory = this.messages
      .filter(
        (msg) =>
          msg.content && msg.content.trim() !== '' && !msg.isPrizeAnnouncement
      )
      .slice(-10) // Letzte 10 Nachrichten für Kontext
      .map((msg) => ({
        role: msg.isUser ? ('user' as const) : ('astrologer' as const),
        message: msg.content,
      }));

    // Astrologen-Daten
    const astrologerData: AstrologerData = {
      name: this.astrologerInfo.name,
      title: this.astrologerInfo.title,
      specialty: this.astrologerInfo.specialty,
      experience:
        'Jahrhunderte Erfahrung in der Interpretation himmlischer Schicksale und Sterneneinflüsse',
    };

    // ✅ Request mit messageCount und isPremiumUser
    const request: ZodiacRequest = {
      zodiacData: astrologerData,
      userMessage,
      conversationHistory,
      messageCount: messageCount,
      isPremiumUser: this.hasUserPaidForAstrology,
    };

    console.log('📤 Sende Request:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.zodiacoService.chatWithAstrologer(request).pipe(
      map((response: ZodiacResponse) => {
        console.log('📥 Antwort erhalten:', {
          success: response.success,
          freeMessagesRemaining: response.freeMessagesRemaining,
          showPaywall: response.showPaywall,
          isCompleteResponse: response.isCompleteResponse,
        });

        if (response.success) {
          return response;
        } else {
          throw new Error(response.error || 'Unbekannter Dienstfehler');
        }
      }),
      catchError((error: any) => {
        console.error('Fehler in generateAstrologyResponse:', error);
        return of({
          success: true,
          response:
            '🌟 Die Sterne sind vorübergehend verschleiert. Bitte versuche es in einigen Momenten erneut.',
          timestamp: new Date().toISOString(),
          freeMessagesRemaining: this.getFreeMessagesRemaining(),
          showPaywall: false,
          isCompleteResponse: true,
        });
      })
    );
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'zodiacUserMessageCount',
      this.userMessageCount.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'astrologyBlockedMessageId',
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
        'astrologyMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {
      console.error('Fehler beim Speichern der Nachrichten:', error);
    }
  }

  // ✅ MODIFIZIERT: clearSessionData() einschließlich Zähler
  private clearSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForZodiacInfo_zodiacInfo');
    sessionStorage.removeItem('astrologyMessages');
    sessionStorage.removeItem('astrologyBlockedMessageId');
    sessionStorage.removeItem('zodiacUserMessageCount');
    sessionStorage.removeItem('freeAstrologyConsultations');
    sessionStorage.removeItem('pendingAstrologyMessage');
  }

  isMessageBlocked(message: any): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForAstrology
    );
  }

  async promptForPayment(): Promise<void> {
    this.showPaymentModal = true;
    this.cdr.markForCheck();
    this.paymentError = null;
    this.isProcessingPayment = false;

    // Benutzerdaten validieren
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
        'Kundendaten nicht gefunden. Bitte fülle zuerst das Formular aus.';
      this.showPaymentModal = false;
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    const email = this.userData.email?.toString().trim();
    if (!email) {
      this.paymentError =
        'E-Mail-Adresse erforderlich. Bitte fülle das Formular aus.';
      this.showPaymentModal = false;
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    if (this.currentMessage) {
      sessionStorage.setItem('pendingZodiacInfoMessage', this.currentMessage);
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      await this.paypalService.initiatePayment({
        amount: '4.00',
        currency: 'EUR',
        serviceName: 'Premium-Tierkreisinformation',
        returnPath: '/sternzeichen-informationen',
        cancelPath: '/sternzeichen-informationen',
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

  // ✅ MODIFIZIERT: clearConversation() mit Zähler-Reset
  clearConversation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForAstrology) {
      this.userMessageCount = 0;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('astrologyMessages');
      sessionStorage.removeItem('astrologyBlockedMessageId');
      sessionStorage.removeItem('zodiacUserMessageCount');
      this.userMessageCount = 0;
      this.blockedMessageId = null;
    }

    this.messages = [];
    this.hasStartedConversation = false;
    this.startConversation();
    this.cdr.markForCheck();
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {}
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    // **Text** zu <strong>Text</strong> konvertieren
    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Zeilenumbrüche zu <br> konvertieren
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // *Text* zu Kursiv konvertieren
    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  onUserDataSubmitted(userData: any): void {
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `Um mit der Zahlung fortzufahren, musst du folgendes ausfüllen: ${missingFields.join(
          ', '
        )}`
      );
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    this.userData = {
      ...userData,
      email: userData.email?.toString().trim(),
    };

    try {
      sessionStorage.setItem('userData', JSON.stringify(this.userData));
    } catch (error) {
      console.error('Fehler beim Speichern der userData:', error);
    }

    this.showDataModal = false;
    this.cdr.markForCheck();

    this.sendUserDataToBackend(userData);
  }

  private sendUserDataToBackend(userData: any): void {
    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        console.log('Daten an Backend gesendet:', response);
        this.promptForPayment();
      },
      error: (error) => {
        console.error('Fehler beim Senden der Daten:', error);
        this.promptForPayment();
      },
    });
  }

  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }
}
