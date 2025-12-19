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

  // Daten zum Senden
  showDataModal: boolean = false;
  userData: any = null;

  // Eigenschaften zur Scroll-Steuerung
  private shouldScrollToBottom: boolean = true;
  private isUserScrolling: boolean = false;
  private lastMessageCount: number = 0;

  // Daten der Führerin
  private guideData: AnimalGuideData = {
    name: 'Schamanin Kiara',
    specialty: 'Führerin der Inneren Tiere',
    experience: 'Spezialistin für spirituelle Verbindung mit dem Tierreich',
  };

  // Eigenschaften für das Glücksrad
  showFortuneWheel: boolean = false;
  animalPrizes: Prize[] = [
    {
      id: '1',
      name: '3 Drehungen am Tierrad',
      color: '#4ecdc4',
      icon: '🦉',
    },
    {
      id: '2',
      name: '1 Premium-Tierführer',
      color: '#45b7d1',
      icon: '🦋',
    },
    {
      id: '4',
      name: 'Versuche es nochmal!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;

  // ✅ NEU: System mit 3 kostenlosen Nachrichten
  private readonly FREE_MESSAGES_LIMIT = 3;
  private userMessageCount: number = 0; // Zähler der Benutzernachrichten

  // Stripe/Zahlung
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForAnimal: boolean = false;
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
    if (this.backgroundVideo && this.backgroundVideo.nativeElement) {
      this.backgroundVideo.nativeElement.playbackRate = 0.6;
    }
  }

  async ngOnInit(): Promise<void> {
    this.hasUserPaidForAnimal =
      sessionStorage.getItem('hasUserPaidForAnimal_inneresTier') === 'true';

    // ✅ NEU: Nachrichtenzähler aus sessionStorage laden
    const savedMessageCount = sessionStorage.getItem(
      'animalInteriorUserMessageCount'
    );
    if (savedMessageCount) {
      this.userMessageCount = parseInt(savedMessageCount, 10) || 0;
    }

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

          // URL bereinigen
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          this.addMessage({
            sender: this.guideData.name,
            content:
              '✨ Zahlung bestätigt! Jetzt hast du unbegrenzten Zugang zu meiner gesamten Erfahrung und Weisheit des Tierreichs.',
            timestamp: new Date(),
            isUser: false,
          });

          // ✅ NEU: Ausstehende Nachricht verarbeiten, falls vorhanden
          const pendingMessage = sessionStorage.getItem('pendingAnimalMessage');
          if (pendingMessage) {
            sessionStorage.removeItem('pendingAnimalMessage');
            setTimeout(() => {
              this.currentMessage = pendingMessage;
              this.sendMessage();
            }, 1000);
          }

          this.cdr.markForCheck();
        }
      } catch (error) {
        console.error('Fehler bei der PayPal-Zahlungsverifizierung:', error);
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

    const savedMessages = sessionStorage.getItem('animalInteriorMessages');
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
        this.blockedMessageId = savedBlockedMessageId || null;
        this.lastMessageCount = this.chatMessages.length;
      } catch (error) {
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
      sender: 'Schamanin Kiara',
      content: `🦉 Hallo, Suchender! Ich bin Kiara, deine spirituelle Führerin des Tierreichs. Ich bin hier, um dir zu helfen, dein inneres Tier zu entdecken und dich mit ihm zu verbinden.

Was möchtest du über dein Krafttier erkunden?`,
      timestamp: new Date(),
      isUser: false,
    });

    if (FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(3000);
    }
  }

  ngAfterViewChecked(): void {
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

  // ✅ NEU: Methode zur Überprüfung, ob der Benutzer vollen Zugang hat
  private hasFullAccess(): boolean {
    // Hat Zugang wenn: bezahlt hat, kostenlose Rad-Beratungen hat, oder Limit nicht überschritten
    return (
      this.hasUserPaidForAnimal ||
      this.hasFreeAnimalConsultationsAvailable() ||
      this.userMessageCount < this.FREE_MESSAGES_LIMIT
    );
  }

  // ✅ NEU: Verbleibende kostenlose Nachrichten abrufen
  getFreeMessagesRemaining(): number {
    const bonusConsultations = parseInt(
      sessionStorage.getItem('freeAnimalConsultations') || '0'
    );
    const baseRemaining = Math.max(
      0,
      this.FREE_MESSAGES_LIMIT - this.userMessageCount
    );
    return baseRemaining + bonusConsultations;
  }

  // ✅ MODIFIZIERTE HAUPTMETHODE
  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;
    const userMessage = this.currentMessage.trim();

    // ✅ NEUE LOGIK: Zugang VOR dem Senden der Nachricht überprüfen
    if (!this.hasUserPaidForAnimal) {
      // Prüfen, ob kostenlose Rad-Beratungen verfügbar sind
      if (this.hasFreeAnimalConsultationsAvailable()) {
        this.useFreeAnimalConsultation();
        // Mit der Nachricht fortfahren
      }
      // Prüfen, ob noch kostenlose Nachrichten vom anfänglichen Limit übrig sind
      else if (this.userMessageCount < this.FREE_MESSAGES_LIMIT) {
        // Zähler erhöhen (erfolgt nach dem Senden)
      }
      // Wenn Limit überschritten, Datenmodal anzeigen
      else {
        // Zuerst andere Modals schließen
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Nachricht speichern, um sie nach der Zahlung zu verarbeiten
        sessionStorage.setItem('pendingAnimalMessage', userMessage);
        this.saveStateBeforePayment();

        // Datenmodal anzeigen
        setTimeout(() => {
          this.showDataModal = true;
          this.cdr.markForCheck();
        }, 100);

        return; // Beenden ohne die Nachricht zu verarbeiten
      }
    }

    this.shouldScrollToBottom = true;
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

    // ✅ NEU: Benutzernachrichtenzähler erhöhen
    if (
      !this.hasUserPaidForAnimal &&
      !this.hasFreeAnimalConsultationsAvailable()
    ) {
      this.userMessageCount++;
      sessionStorage.setItem(
        'animalInteriorUserMessageCount',
        this.userMessageCount.toString()
      );
    }

    // conversationHistory vorbereiten
    const conversationHistory = this.chatMessages.slice(-10).map((msg) => ({
      role: msg.isUser ? ('user' as const) : ('guide' as const),
      message: msg.content,
    }));

    // ✅ NEU: Request mit messageCount und isPremiumUser vorbereiten
    const chatRequest: AnimalChatRequest = {
      guideData: this.guideData,
      userMessage: userMessage,
      conversationHistory: conversationHistory,
      messageCount: this.userMessageCount, // ✅ NEU
      isPremiumUser: this.hasUserPaidForAnimal, // ✅ NEU
    };

    this.animalService.chatWithGuide(chatRequest).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.shouldScrollToBottom = true;

        if (response.success && response.response) {
          const messageId = Date.now().toString();
          this.addMessage({
            sender: 'Schamanin Kiara',
            content: response.response,
            timestamp: new Date(),
            isUser: false,
            id: messageId,
          });

          // ✅ NEU: Backend-Antwort mit Paywall-Information verarbeiten
          if (response.showPaywall && !this.hasUserPaidForAnimal) {
            this.blockedMessageId = messageId;
            sessionStorage.setItem('animalInteriorBlockedMessageId', messageId);

            // Datenmodal nach kurzer Verzögerung anzeigen
            setTimeout(() => {
              this.saveStateBeforePayment();
              this.showFortuneWheel = false;
              this.showPaymentModal = false;

              setTimeout(() => {
                this.showDataModal = true;
                this.cdr.markForCheck();
              }, 100);
            }, 2000);
          }

          // ✅ NEU: Nachricht über verbleibende kostenlose Nachrichten anzeigen, falls zutreffend
          if (
            response.freeMessagesRemaining !== undefined &&
            response.freeMessagesRemaining > 0 &&
            !this.hasUserPaidForAnimal
          ) {
            // Optional: Anzeigen, wie viele kostenlose Nachrichten übrig sind
            console.log(
              `Verbleibende kostenlose Nachrichten: ${response.freeMessagesRemaining}`
            );
          }
        } else {
          this.addMessage({
            sender: 'Schamanin Kiara',
            content:
              '🦉 Es tut mir leid, ich konnte mich gerade nicht mit der Tierweisheit verbinden. Bitte versuche es erneut.',
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
          sender: 'Schamanin Kiara',
          content:
            '🦉 Es gab einen Fehler bei der spirituellen Verbindung. Bitte versuche es erneut.',
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
      'animalInteriorUserMessageCount',
      this.userMessageCount.toString()
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
        'Keine Kundendaten gefunden. Bitte fülle zuerst das Formular aus.';
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    const email = this.userData.email?.toString().trim();
    if (!email) {
      this.paymentError =
        'E-Mail-Adresse erforderlich. Bitte fülle das Formular aus.';
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

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
        amount: '4.00',
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
    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );
    formattedContent = formattedContent.replace(/\n/g, '<br>');
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
    this.isUserScrolling = !isAtBottom;
    if (isAtBottom) {
      this.isUserScrolling = false;
    }
  }

  onUserStartScroll(): void {
    this.isUserScrolling = true;
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
    this.chatMessages = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;
    this.userMessageCount = 0; // ✅ NEU: Zähler zurücksetzen
    this.blockedMessageId = null;
    this.isLoading = false;

    sessionStorage.removeItem('animalInteriorMessages');
    sessionStorage.removeItem('animalInteriorUserMessageCount'); // ✅ NEU
    sessionStorage.removeItem('animalInteriorBlockedMessageId');

    this.shouldScrollToBottom = true;

    this.addMessage({
      sender: 'Schamanin Kiara',
      content: `🦉 Hallo, Suchender! Ich bin Kiara, deine spirituelle Führerin des Tierreichs. Ich bin hier, um dir zu helfen, dein inneres Tier zu entdecken und dich mit ihm zu verbinden.

Was möchtest du über dein Krafttier erkunden?`,
      timestamp: new Date(),
      isUser: false,
    });

    if (FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(3000);
    }
  }

  onUserDataSubmitted(userData: any): void {
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `Um mit der Zahlung fortzufahren, musst du Folgendes ausfüllen: ${missingFields.join(
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
    } catch (error) {}

    this.showDataModal = false;
    this.cdr.markForCheck();

    this.sendUserDataToBackend(userData);
  }

  private sendUserDataToBackend(userData: any): void {
    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        this.promptForPayment();
      },
      error: (error) => {
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
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ChatMessage = {
      sender: 'Schamanin Kiara',
      content: `🦉 Die Tiergeister haben gesprochen! Du hast gewonnen: **${prize.name}** ${prize.icon}\n\nDie alten Hüter des Tierreichs haben beschlossen, dich mit diesem heiligen Geschenk zu segnen. Die spirituelle Energie fließt durch dich und verbindet dich tiefer mit deinem inneren Tier. Möge die uralte Weisheit dich führen!`,
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
      case '1': // 3 Spirituelle Verbindungen
        this.addFreeAnimalConsultations(3);
        break;
      case '2': // 1 Premium-Führung - VOLLSTÄNDIGER ZUGANG
        this.hasUserPaidForAnimal = true;
        sessionStorage.setItem('hasUserPaidForAnimal_inneresTier', 'true');

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('animalInteriorBlockedMessageId');
        }

        const premiumMessage: ChatMessage = {
          sender: 'Schamanin Kiara',
          content:
            '🦋 **Du hast den vollständigen Premium-Zugang freigeschaltet!** 🦋\n\nDie Tiergeister haben dir auf außergewöhnliche Weise zugelächelt. Jetzt hast du unbegrenzten Zugang zur gesamten Weisheit des Tierreichs. Du kannst so oft du möchtest nach deinem inneren Tier, spirituellen Verbindungen und allen uralten Geheimnissen fragen.\n\n✨ *Die Hüter des Tierreichs haben dir alle Türen geöffnet* ✨',
          timestamp: new Date(),
          isUser: false,
        };
        this.chatMessages.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveMessagesToSession();
        break;
      case '4': // Noch eine Chance
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
        sender: 'Schamanin Kiara',
        content: `✨ *Du hast eine kostenlose spirituelle Verbindung verwendet* ✨\n\nDir verbleiben **${remaining}** Beratungen mit dem Tierreich.`,
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
