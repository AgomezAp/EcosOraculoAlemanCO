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
import { PaypalService } from '../../services/paypal.service';

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
  ],
  templateUrl: './zodiaco-chino.component.html',
  styleUrl: './zodiaco-chino.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZodiacoChinoComponent
  implements OnInit, AfterViewChecked, OnDestroy, AfterViewInit
{
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // Haupteigenschaften
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

  // Variablen für Glücksrad-Steuerung
  showFortuneWheel: boolean = false;
  horoscopePrizes: Prize[] = [
    {
      id: '1',
      name: '3 Drehungen des Sternzeichen-Rades',
      color: '#4ecdc4',
      icon: '🔮',
    },
    {
      id: '2',
      name: '1 Premium-Sternzeichen-Analyse',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: 'Versuche es erneut!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;

  // Variablen für Zahlungssteuerung
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForHoroscope: boolean = false;
  blockedMessageId: string | null = null;

  // ✅ NEU: System mit 3 kostenlosen Nachrichten
  private userMessageCount: number = 0;
  private readonly FREE_MESSAGES_LIMIT = 3;

  // Daten zum Senden
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
    // Formularkonfiguration für Horoskop
    this.userForm = this.fb.group({
      fullName: [''],
      birthYear: [
        '',
        [Validators.required, Validators.min(1900), Validators.max(2024)],
      ],
      birthDate: [''],
      initialQuestion: [
        'Was kannst du mir über mein Sternzeichen und Horoskop sagen?',
      ],
    });
  }

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.7);
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
    // ✅ Prüfen, ob wir nach einer Zahlung von PayPal zurückkommen
    this.hasUserPaidForHoroscope =
      sessionStorage.getItem('hasUserPaidForHoroscope_horoskop') === 'true';

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          // ✅ Zahlung NUR für diesen Service (Horoskop)
          this.hasUserPaidForHoroscope = true;
          sessionStorage.setItem('hasUserPaidForHoroscope_horoskop', 'true');

          // Kein globaler localStorage verwenden
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('horoscopeBlockedMessageId');

          // URL bereinigen
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          // Zahlungsmodal schließen
          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;
          this.cdr.markForCheck();

          // ✅ BESTÄTIGUNGSNACHRICHT
          setTimeout(() => {
            this.addMessage(
              'master',
              '🎉 Zahlung erfolgreich abgeschlossen!\n\n' +
                '✨ Vielen Dank für deine Zahlung. Du hast jetzt vollen Zugang zum Horoskop.\n\n' +
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
              '⚠️ Bei der Verifizierung deiner Zahlung ist ein Problem aufgetreten. Bitte versuche es erneut oder kontaktiere unseren Support.'
            );
            this.cdr.detectChanges();
          }, 800);
        }
      } catch (error) {
        console.error('Fehler bei der PayPal-Zahlungsverifizierung:', error);
        this.paymentError = 'Fehler bei der Zahlungsverifizierung';

        setTimeout(() => {
          this.addMessage(
            'master',
            '❌ Leider ist bei der Verifizierung deiner Zahlung ein Fehler aufgetreten. Bitte versuche es später erneut.'
          );
          this.cdr.detectChanges();
        }, 800);
      }
    }

    // ✅ NEU: Nachrichtenzähler laden
    const savedMessageCount = sessionStorage.getItem(
      'horoscopeUserMessageCount'
    );
    if (savedMessageCount) {
      this.userMessageCount = parseInt(savedMessageCount, 10);
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

    // Gespeicherte Horoskop-Daten laden
    this.loadHoroscopeData();

    this.loadMasterInfo();

    // Willkommensnachricht nur hinzufügen, wenn keine gespeicherten Nachrichten vorhanden
    if (this.conversationHistory.length === 0) {
      this.initializeHoroscopeWelcomeMessage();
    }

    // ✅ AUCH FÜR WIEDERHERGESTELLTE NACHRICHTEN PRÜFEN
    if (
      this.conversationHistory.length > 0 &&
      FortuneWheelComponent.canShowWheel()
    ) {
      this.showHoroscopeWheelAfterDelay(2000);
    }
  }

  private loadHoroscopeData(): void {
    const savedMessages = sessionStorage.getItem('horoscopeMessages');
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
        this.blockedMessageId = savedBlockedMessageId || null;
      } catch (error) {
        this.clearHoroscopeSessionData();
        this.initializeHoroscopeWelcomeMessage();
      }
    }
  }

  private initializeHoroscopeWelcomeMessage(): void {
    const welcomeMessage = `Willkommen im Reich der Sterne! 🔮✨

Ich bin Astrologin Maria, himmlische Führerin der Sternzeichen. Seit Jahrzehnten studiere ich die Einflüsse der Planeten und Sternbilder, die unser Schicksal lenken.

Jeder Mensch wird unter dem Schutz eines Sternzeichens geboren, das seine Persönlichkeit, sein Schicksal und seinen Lebensweg beeinflusst. Um die Geheimnisse deines Horoskops und die himmlischen Einflüsse zu enthüllen, benötige ich dein Geburtsdatum.

Die zwölf Zeichen (Widder, Stier, Zwillinge, Krebs, Löwe, Jungfrau, Waage, Skorpion, Schütze, Steinbock, Wassermann und Fische) haben uralte Weisheit zu teilen.

Bist du bereit zu entdecken, was die Sterne über dein Schicksal offenbaren? 🌙`;

    this.addMessage('master', welcomeMessage);

    // ✅ HOROSKOP-RAD PRÜFUNG
    if (FortuneWheelComponent.canShowWheel()) {
      this.showHoroscopeWheelAfterDelay(3000);
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
  }

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
    sessionStorage.removeItem('horoscopeBlockedMessageId');
    sessionStorage.removeItem('horoscopeUserMessageCount');
    sessionStorage.removeItem('freeHoroscopeConsultations');
    sessionStorage.removeItem('pendingHoroscopeMessage');
  }

  private saveHoroscopeStateBeforePayment(): void {
    this.saveHoroscopeMessagesToSession();
    sessionStorage.setItem(
      'horoscopeUserMessageCount',
      this.userMessageCount.toString()
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

  // ✅ METHODE MIGRIERT ZU PAYPAL
  async promptForHoroscopePayment(): Promise<void> {
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

    // Ausstehende Nachricht speichern falls vorhanden
    if (this.currentMessage) {
      sessionStorage.setItem('pendingHoroscopeMessage', this.currentMessage);
    }
  }

  // ✅ METHODE MIGRIERT ZU PAYPAL
  async handleHoroscopePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      // PayPal-Zahlungsfluss starten (leitet den Benutzer weiter)
      await this.paypalService.initiatePayment({
        amount: '4.00',
        currency: 'EUR',
        serviceName: 'Horoskop',
        returnPath: '/horoskop',
        cancelPath: '/horoskop',
      });

      // Der Code nach dieser Zeile wird NICHT ausgeführt, da
      // der Benutzer zu PayPal weitergeleitet wird
    } catch (error: any) {
      this.paymentError =
        error.message || 'Fehler beim Initialisieren der PayPal-Zahlung.';
      this.isProcessingPayment = false;
      this.cdr.markForCheck();
    }
  }

  // ✅ VEREINFACHTE METHODE - PayPal erfordert kein Cleanup
  cancelHoroscopePayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  startChatWithoutForm(): void {
    this.showDataForm = false;
  }

  // Meister-Informationen laden
  loadMasterInfo(): void {
    this.zodiacoChinoService.getMasterInfo().subscribe({
      next: (info) => {
        this.masterInfo = info;
      },
      error: (error) => {
        // Standardinformationen bei Fehler
        this.masterInfo = {
          success: true,
          master: {
            name: 'Astrologin Maria',
            title: 'Himmlische Führerin der Sternzeichen',
            specialty: 'Westliche Astrologie und personalisiertes Horoskop',
            description:
              'Weise Astrologin, spezialisiert auf die Interpretation himmlischer Einflüsse und die Weisheit der zwölf Sternzeichen',
            services: [
              'Interpretation von Sternzeichen',
              'Analyse von Geburtshoroskopen',
              'Horoskop-Vorhersagen',
              'Kompatibilität zwischen Sternzeichen',
              'Astrologische Beratung',
            ],
          },
          timestamp: new Date().toISOString(),
        };
      },
    });
  }

  // Horoskop-Beratung starten
  startConsultation(): void {
    if (this.userForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.cdr.markForCheck();

      const formData = this.userForm.value;

      const initialMessage =
        formData.initialQuestion ||
        'Hallo! Ich würde gerne mehr über mein Sternzeichen und Horoskop erfahren.';

      // Benutzernachricht hinzufügen
      this.addMessage('user', initialMessage);

      // Daten für Backend vorbereiten
      const consultationData = {
        zodiacData: {
          name: 'Astrologin Maria',
          specialty: 'Westliche Astrologie und personalisiertes Horoskop',
          experience:
            'Jahrzehntelange Erfahrung in astrologischer Interpretation',
        },
        userMessage: initialMessage,
        fullName: formData.fullName,
        birthYear: formData.birthYear?.toString(),
        birthDate: formData.birthDate,
        conversationHistory: this.conversationHistory,
      };

      // ✅ Service mit Nachrichtenzähler aufrufen (erste Nachricht = 1)
      this.zodiacoChinoService
        .chatWithMasterWithCount(
          consultationData,
          1,
          this.hasUserPaidForHoroscope
        )
        .subscribe({
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
              'Fehler bei der Verbindung zur Astrologin: ' +
                (error.error?.error || error.message)
            );
            this.cdr.markForCheck();
          },
        });
    }
  }

  // ✅ NEU: Verbleibende kostenlose Nachrichten abrufen
  getFreeMessagesRemaining(): number {
    if (this.hasUserPaidForHoroscope) {
      return -1; // Unbegrenzt
    }
    return Math.max(0, this.FREE_MESSAGES_LIMIT - this.userMessageCount);
  }

  sendMessage(): void {
    if (this.currentMessage.trim() && !this.isLoading) {
      const message = this.currentMessage.trim();

      // Nächste Nachrichtennummer berechnen
      const nextMessageCount = this.userMessageCount + 1;

      console.log(
        `📊 Horoskop - Nachricht #${nextMessageCount}, Premium: ${this.hasUserPaidForHoroscope}, Limit: ${this.FREE_MESSAGES_LIMIT}`
      );

      // ✅ Zugang prüfen
      const canSendMessage =
        this.hasUserPaidForHoroscope ||
        this.hasFreeHoroscopeConsultationsAvailable() ||
        nextMessageCount <= this.FREE_MESSAGES_LIMIT;

      if (!canSendMessage) {
        console.log('❌ Kein Zugang - Zahlungsmodal anzeigen');

        // Andere Modals schließen
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Ausstehende Nachricht speichern
        sessionStorage.setItem('pendingHoroscopeMessage', message);
        this.saveHoroscopeStateBeforePayment();

        // Datenmodal anzeigen
        setTimeout(() => {
          this.showDataModal = true;
          this.cdr.markForCheck();
        }, 100);

        return;
      }

      // ✅ Wenn kostenlose Rad-Beratung verwendet wird (nach den 3 kostenlosen)
      if (
        !this.hasUserPaidForHoroscope &&
        nextMessageCount > this.FREE_MESSAGES_LIMIT &&
        this.hasFreeHoroscopeConsultationsAvailable()
      ) {
        this.useFreeHoroscopeConsultation();
      }

      // Nachricht normal verarbeiten
      this.processHoroscopeUserMessage(message, nextMessageCount);
    }
  }

  private processHoroscopeUserMessage(
    message: string,
    messageCount: number
  ): void {
    this.currentMessage = '';
    this.isLoading = true;
    this.isTyping = true;
    this.cdr.markForCheck();

    // Benutzernachricht hinzufügen
    this.addMessage('user', message);

    // ✅ Zähler aktualisieren
    this.userMessageCount = messageCount;
    sessionStorage.setItem(
      'horoscopeUserMessageCount',
      this.userMessageCount.toString()
    );

    const formData = this.userForm.value;
    const consultationData = {
      zodiacData: {
        name: 'Astrologin Maria',
        specialty: 'Westliche Astrologie und personalisiertes Horoskop',
        experience:
          'Jahrzehntelange Erfahrung in astrologischer Interpretation',
      },
      userMessage: message,
      fullName: formData.fullName,
      birthYear: formData.birthYear?.toString(),
      birthDate: formData.birthDate,
      conversationHistory: this.conversationHistory,
    };

    // ✅ Service mit Nachrichtenzähler aufrufen
    this.zodiacoChinoService
      .chatWithMasterWithCount(
        consultationData,
        messageCount,
        this.hasUserPaidForHoroscope
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.isTyping = false;
          this.cdr.markForCheck();

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            this.addMessage('master', response.response, messageId);

            // ✅ Paywall anzeigen wenn Limit überschritten UND keine Rad-Beratungen vorhanden
            const shouldShowPaywall =
              !this.hasUserPaidForHoroscope &&
              messageCount > this.FREE_MESSAGES_LIMIT &&
              !this.hasFreeHoroscopeConsultationsAvailable();

            if (shouldShowPaywall) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('horoscopeBlockedMessageId', messageId);

              setTimeout(() => {
                this.saveHoroscopeStateBeforePayment();

                // Andere Modals schließen
                this.showFortuneWheel = false;
                this.showPaymentModal = false;

                // Datenmodal anzeigen
                setTimeout(() => {
                  this.showDataModal = true;
                  this.cdr.markForCheck();
                }, 100);
              }, 2000);
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
            'Fehler bei der Verbindung zur Astrologin: ' +
              (error.error?.error || error.message)
          );
          this.cdr.markForCheck();
        },
      });
  }

  // Enter-Taste behandeln
  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Formular umschalten
  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  // Beratung zurücksetzen
  resetConsultation(): void {
    this.conversationHistory = [];
    this.isFormCompleted = false;
    this.showDataForm = true;
    this.currentMessage = '';
    this.zodiacAnimal = {};
    this.blockedMessageId = null;

    // ✅ Zähler zurücksetzen
    if (!this.hasUserPaidForHoroscope) {
      this.userMessageCount = 0;
      this.clearHoroscopeSessionData();
    } else {
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      this.userMessageCount = 0;
    }

    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        'Was kannst du mir über mein Sternzeichen und Horoskop sagen?',
    });
    this.initializeHoroscopeWelcomeMessage();
  }

  // Kompatibilität erkunden
  exploreCompatibility(): void {
    const message =
      'Könntest du über die Kompatibilität meines Sternzeichens mit anderen Zeichen sprechen?';
    this.currentMessage = message;
    this.sendMessage();
  }

  // Elemente erkunden
  exploreElements(): void {
    const message =
      'Wie beeinflussen die Planeten meine Persönlichkeit und mein Schicksal?';
    this.currentMessage = message;
    this.sendMessage();
  }

  // Hilfsmethoden
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
    this.cdr.markForCheck();
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
      `Entschuldigung, ${message}. Bitte versuche es erneut.`
    );
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    // **Text** zu <strong>Text</strong> für Fettschrift konvertieren
    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Zeilenumbrüche zu <br> für bessere Anzeige konvertieren
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // Optional: *Text* (einzelnes Sternchen) als Kursiv behandeln
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

  // Auto-resize des Textbereichs
  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // Tastendruck behandeln
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Chat löschen
  clearChat(): void {
    this.conversationHistory = [];
    this.currentMessage = '';
    this.blockedMessageId = null;
    this.isLoading = false;

    // ✅ Zähler zurücksetzen
    if (!this.hasUserPaidForHoroscope) {
      this.userMessageCount = 0;
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      sessionStorage.removeItem('freeHoroscopeConsultations');
      sessionStorage.removeItem('pendingHoroscopeMessage');
    } else {
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      this.userMessageCount = 0;
    }

    this.shouldScrollToBottom = true;
    this.initializeHoroscopeWelcomeMessage();
  }

  resetChat(): void {
    // 1. Arrays und Nachrichten zurücksetzen
    this.conversationHistory = [];
    this.currentMessage = '';

    // 2. Lade- und Typing-Status zurücksetzen
    this.isLoading = false;
    this.isTyping = false;

    // 3. Formularstatus zurücksetzen
    this.isFormCompleted = false;
    this.showDataForm = true;

    // 4. Zahlungs- und Sperrstatus zurücksetzen
    this.blockedMessageId = null;

    // 5. Modals zurücksetzen
    this.showPaymentModal = false;
    this.showDataModal = false;
    this.showFortuneWheel = false;

    // 6. Scroll-Variablen und Zähler zurücksetzen
    this.shouldScrollToBottom = false;
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    // 7. Zodiac-Tier zurücksetzen
    this.zodiacAnimal = {};

    // 8. ✅ PayPal erfordert kein Element-Cleanup
    this.isProcessingPayment = false;
    this.paymentError = null;

    // 9. Timer löschen
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    // 10. ✅ Zähler zurücksetzen und sessionStorage löschen
    if (!this.hasUserPaidForHoroscope) {
      this.userMessageCount = 0;
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      sessionStorage.removeItem('freeHoroscopeConsultations');
      sessionStorage.removeItem('pendingHoroscopeMessage');
    } else {
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      this.userMessageCount = 0;
    }
    // NICHT 'userData' oder 'hasUserPaidForHoroscope' löschen

    // 11. Formular zurücksetzen
    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        'Was kannst du mir über mein Sternzeichen und Horoskop sagen?',
    });

    // 12. Willkommensnachricht neu initialisieren
    this.initializeHoroscopeWelcomeMessage();
    this.cdr.markForCheck();
  }

  onUserDataSubmitted(userData: any): void {
    // ✅ KRITISCHE FELDER VOR DEM FORTFAHREN VALIDIEREN
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `Um fortzufahren, musst du folgendes ausfüllen: ${missingFields.join(
          ', '
        )}`
      );
      this.showDataModal = true; // Modal offen halten
      this.cdr.markForCheck();
      return;
    }

    // ✅ Daten SOFORT im Speicher UND sessionStorage bereinigen und speichern
    this.userData = {
      ...userData,
      email: userData.email?.toString().trim(),
    };

    // ✅ SOFORT in sessionStorage speichern
    try {
      sessionStorage.setItem('userData', JSON.stringify(this.userData));

      // Überprüfen, ob korrekt gespeichert wurde
      const verificacion = sessionStorage.getItem('userData');
    } catch (error) {}

    this.showDataModal = false;
    this.cdr.markForCheck();

    // ✅ NEU: Daten wie in anderen Komponenten an Backend senden
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
        this.cdr.markForCheck();
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ChatMessage = {
      role: 'master',
      message: `🔮 Die Sterne haben zu deinen Gunsten konspiriert! Du hast gewonnen: **${prize.name}** ${prize.icon}\n\nDie himmlischen Kräfte haben beschlossen, dich mit diesem heiligen Geschenk zu segnen. Die Energie des Sternzeichens fließt durch dich und offenbart tiefere Geheimnisse deines persönlichen Horoskops. Möge die astrologische Weisheit dich erleuchten!`,
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
      this.cdr.markForCheck();
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
      case '1': // 3 Horoskop-Lesungen
        this.addFreeHoroscopeConsultations(3);
        break;
      case '2': // 1 Premium-Analyse - VOLLER ZUGANG
        this.hasUserPaidForHoroscope = true;
        sessionStorage.setItem('hasUserPaidForHoroscope', 'true');

        // Blockierte Nachricht entsperren
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('horoscopeBlockedMessageId');
        }

        // Spezielle Nachricht für diesen Preis hinzufügen
        const premiumMessage: ChatMessage = {
          role: 'master',
          message:
            '🌟 **Du hast den vollständigen Premium-Zugang freigeschaltet!** 🌟\n\nDie Sterne haben dir außerordentlich zugelächelt. Du hast jetzt unbegrenzten Zugang zu meiner gesamten astrologischen Weisheit. Du kannst dein Horoskop, Kompatibilität, Vorhersagen und alle himmlischen Geheimnisse so oft anfragen, wie du möchtest.\n\n✨ *Das Universum hat dir alle Türen geöffnet* ✨',
          timestamp: new Date().toISOString(),
        };
        this.conversationHistory.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveHoroscopeMessagesToSession();
        break;
      case '4': // Noch eine Chance
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
        message: `✨ *Du hast eine kostenlose astrologische Lesung verwendet* ✨\n\nDir bleiben noch **${remaining}** astrologische Beratungen verfügbar.`,
        timestamp: new Date().toISOString(),
      };
      this.conversationHistory.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveHoroscopeMessagesToSession();
    }
  }

  debugHoroscopeWheel(): void {
    this.showFortuneWheel = true;
    this.cdr.markForCheck();
  }

  // ✅ HILFSMETHODE für das Template
  getHoroscopeConsultationsCount(): number {
    return parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );
  }
}
