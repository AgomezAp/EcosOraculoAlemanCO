import { CommonModule } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  BirthChartRequest,
  BirthChartResponse,
  TablaNacimientoService,
} from '../../services/tabla-nacimiento.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PaypalService } from '../../services/paypal.service';

import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import { Observable, map, catchError, of } from 'rxjs';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';

interface BirthChartMessage {
  content: string;
  isUser: boolean;
  timestamp: Date;
  sender: string;
}

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}

interface ChartData {
  sunSign?: string;
  moonSign?: string;
  ascendant?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
}

interface AstrologerInfo {
  name: string;
  title: string;
  specialty: string;
}

@Component({
  selector: 'app-tabla-nacimiento',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './tabla-nacimiento.component.html',
  styleUrl: './tabla-nacimiento.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaNacimientoComponent
  implements OnInit, AfterViewChecked, OnDestroy, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  // Chat und Nachrichten
  messages: Message[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;

  // Scroll-Steuerung
  private shouldScrollToBottom: boolean = true;
  private isUserScrolling: boolean = false;
  private lastMessageCount: number = 0;

  // Persönliche Daten und Horoskop
  chartData: ChartData = {};
  fullName: string = '';
  birthDate: string = '';
  birthTime: string = '';
  birthPlace: string = '';
  showDataForm: boolean = false;

  // Astrologen-Informationen
  astrologerInfo: AstrologerInfo = {
    name: 'Meisterin Emma',
    title: 'Hüterin der himmlischen Konfigurationen',
    specialty: 'Spezialistin für Geburtshoroskope und transpersonale Astrologie',
  };

  // Daten zum Senden
  showDataModal: boolean = false;
  userData: any = null;

  // Variablen für das Glücksrad
  showFortuneWheel: boolean = false;
  birthChartPrizes: Prize[] = [
    {
      id: '1',
      name: '3 Drehungen des Geburtsrades',
      color: '#4ecdc4',
      icon: '🌟',
    },
    {
      id: '2',
      name: '1 Premium-Geburtshoroskop-Analyse',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: 'Versuche es erneut!',
      color: '#ff7675',
      icon: '🔮',
    },
  ];
  private wheelTimer: any;

  // Zahlungssystem
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForBirthTable: boolean = false;
  blockedMessageId: string | null = null;

  // ✅ NEU: System mit 3 kostenlosen Nachrichten
  private userMessageCount: number = 0;
  private readonly FREE_MESSAGES_LIMIT = 3;

  private backendUrl = environment.apiUrl;

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    @Optional() public dialogRef: MatDialogRef<TablaNacimientoComponent>,
    private http: HttpClient,
    private tablaNacimientoService: TablaNacimientoService,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService
  ) {}

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.6);
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
    this.hasUserPaidForBirthTable =
      sessionStorage.getItem('hasUserPaidForBirthTable_geburtstabelle') ===
      'true';

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForBirthTable = true;
          sessionStorage.setItem(
            'hasUserPaidForBirthTable_geburtstabelle',
            'true'
          );
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('vocationalBlockedMessageId');

          // URL bereinigen
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          this.messages.push({
            sender: 'Meisterin Emma',
            content:
              '✨ Zahlung bestätigt! Du hast jetzt Zugang zu meiner gesamten Erfahrung.',
            timestamp: new Date(),
            isUser: false,
          });

          this.saveMessagesToSession();
          this.cdr.markForCheck();
        }
      } catch (error) {
        console.error('Fehler bei der PayPal-Zahlungsverifizierung:', error);
        this.paymentError = 'Fehler bei der Zahlungsverifizierung';
      }
    }

    // ✅ NEU: Nachrichtenzähler laden
    const savedMessageCount = sessionStorage.getItem('birthChartUserMessageCount');
    if (savedMessageCount) {
      this.userMessageCount = parseInt(savedMessageCount, 10);
    }

    // ✅ NEU: Benutzerdaten aus sessionStorage laden
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

    // Gespeicherte Daten laden
    this.loadSavedData();

    // Willkommensnachricht
    if (this.messages.length === 0) {
      this.initializeBirthChartWelcomeMessage();
    }

    // ✅ AUCH FÜR WIEDERHERGESTELLTE NACHRICHTEN PRÜFEN
    if (this.messages.length > 0 && FortuneWheelComponent.canShowWheel()) {
      this.showBirthChartWheelAfterDelay(2000);
    }
  }

  private initializeBirthChartWelcomeMessage(): void {
    this.addMessage({
      sender: 'Meisterin Emma',
      content: `🌟 Hallo, Suchender der himmlischen Geheimnisse! Ich bin Emma, deine Führerin im Kosmos der astralen Konfigurationen.

Ich bin hier, um die verborgenen Geheimnisse in deinem Geburtshoroskop zu entschlüsseln. Die Sterne haben auf diesen Moment gewartet, um dir ihre Weisheit zu offenbaren.

Welchen Aspekt deines Geburtshoroskops möchtest du zuerst erkunden?`,
      timestamp: new Date(),
      isUser: false,
    });

    // ✅ GEBURTSHOROSKOP-RAD PRÜFUNG
    if (FortuneWheelComponent.canShowWheel()) {
      this.showBirthChartWheelAfterDelay(3000);
    }
  }

  ngAfterViewChecked(): void {
    if (
      this.shouldScrollToBottom &&
      !this.isUserScrolling &&
      this.messages.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  private loadSavedData(): void {
    const savedMessages = sessionStorage.getItem('birthChartMessages');
    const savedBlockedMessageId = sessionStorage.getItem(
      'birthChartBlockedMessageId'
    );
    const savedChartData = sessionStorage.getItem('birthChartData');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.blockedMessageId = savedBlockedMessageId || null;
        this.lastMessageCount = this.messages.length;
      } catch (error) {
        // Beschädigte Daten bereinigen
        this.initializeBirthChartWelcomeMessage();
      }
    }

    if (savedChartData) {
      try {
        this.chartData = JSON.parse(savedChartData);
        this.fullName = this.chartData.fullName || '';
        this.birthDate = this.chartData.birthDate || '';
        this.birthTime = this.chartData.birthTime || '';
        this.birthPlace = this.chartData.birthPlace || '';
      } catch (error) {}
    }
  }

  // ✅ NEU: Verbleibende kostenlose Nachrichten abrufen
  getFreeMessagesRemaining(): number {
    if (this.hasUserPaidForBirthTable) {
      return -1; // Unbegrenzt
    }
    return Math.max(0, this.FREE_MESSAGES_LIMIT - this.userMessageCount);
  }

  sendMessage(): void {
    if (this.currentMessage?.trim() && !this.isLoading) {
      const userMessage = this.currentMessage.trim();

      // Nächste Nachrichtennummer berechnen
      const nextMessageCount = this.userMessageCount + 1;

      console.log(
        `📊 Geburtshoroskop - Nachricht #${nextMessageCount}, Premium: ${this.hasUserPaidForBirthTable}, Limit: ${this.FREE_MESSAGES_LIMIT}`
      );

      // ✅ Zugang prüfen
      const canSendMessage =
        this.hasUserPaidForBirthTable ||
        this.hasFreeBirthChartConsultationsAvailable() ||
        nextMessageCount <= this.FREE_MESSAGES_LIMIT;

      if (!canSendMessage) {
        console.log('❌ Kein Zugang - Zahlungsmodal anzeigen');

        // Andere Modals schließen
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Ausstehende Nachricht speichern
        sessionStorage.setItem('pendingBirthChartMessage', userMessage);
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
        !this.hasUserPaidForBirthTable &&
        nextMessageCount > this.FREE_MESSAGES_LIMIT &&
        this.hasFreeBirthChartConsultationsAvailable()
      ) {
        this.useFreeBirthChartConsultation();
      }

      this.shouldScrollToBottom = true;

      // Nachricht normal verarbeiten
      this.processBirthChartUserMessage(userMessage, nextMessageCount);
    }
  }

  private processBirthChartUserMessage(userMessage: string, messageCount: number): void {
    // Benutzernachricht hinzufügen
    const userMsg = {
      sender: 'Du',
      content: userMessage,
      timestamp: new Date(),
      isUser: true,
    };
    this.messages.push(userMsg);

    // ✅ Zähler aktualisieren
    this.userMessageCount = messageCount;
    sessionStorage.setItem(
      'birthChartUserMessageCount',
      this.userMessageCount.toString()
    );

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isLoading = true;

    // ✅ Echten Geburtshoroskop-Service mit Zähler verwenden
    this.generateAstrologicalResponse(userMessage, messageCount).subscribe({
      next: (response: any) => {
        this.isLoading = false;

        const messageId = Date.now().toString();
        const astrologerMsg = {
          sender: 'Meisterin Emma',
          content: response,
          timestamp: new Date(),
          isUser: false,
          id: messageId,
        };
        this.messages.push(astrologerMsg);

        this.shouldScrollToBottom = true;

        // ✅ Paywall anzeigen wenn Limit überschritten UND keine Rad-Beratungen vorhanden
        const shouldShowPaywall =
          !this.hasUserPaidForBirthTable &&
          messageCount > this.FREE_MESSAGES_LIMIT &&
          !this.hasFreeBirthChartConsultationsAvailable();

        if (shouldShowPaywall) {
          this.blockedMessageId = messageId;
          sessionStorage.setItem('birthChartBlockedMessageId', messageId);

          setTimeout(() => {
            this.saveStateBeforePayment();

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

        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        this.isLoading = false;

        const errorMsg = {
          sender: 'Meisterin Emma',
          content:
            '🌟 Entschuldigung, die himmlischen Konfigurationen sind vorübergehend gestört. Bitte versuche es in einigen Momenten erneut.',
          timestamp: new Date(),
          isUser: false,
        };
        this.messages.push(errorMsg);
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
    });
  }

  private generateAstrologicalResponse(
    userMessage: string,
    messageCount: number
  ): Observable<string> {
    // Konversationsverlauf für den Kontext erstellen
    const conversationHistory = this.messages
      .filter((msg) => msg.content && msg.content.trim() !== '')
      .map((msg) => ({
        role: msg.isUser ? ('user' as const) : ('astrologer' as const),
        message: msg.content,
      }));

    // Anfrage mit der korrekten Struktur erstellen
    const request: BirthChartRequest = {
      chartData: {
        name: this.astrologerInfo.name,
        specialty: this.astrologerInfo.specialty,
        experience:
          'Jahrhunderte Erfahrung in der Interpretation himmlischer Konfigurationen und Geheimnisse der Geburtshoroskope',
      },
      userMessage,
      birthDate: this.birthDate,
      birthTime: this.birthTime,
      birthPlace: this.birthPlace,
      fullName: this.fullName,
      conversationHistory,
    };

    // ✅ Service mit Nachrichtenzähler aufrufen
    return this.tablaNacimientoService
      .chatWithAstrologerWithCount(
        request,
        messageCount,
        this.hasUserPaidForBirthTable
      )
      .pipe(
        map((response: BirthChartResponse) => {
          if (response.success && response.response) {
            return response.response;
          } else {
            throw new Error(response.error || 'Unbekannter Dienstfehler');
          }
        }),
        catchError((error: any) => {
          return of(
            '🌟 Die himmlischen Konfigurationen sind vorübergehend verschleiert. Die Sterne flüstern mir zu, dass ich meine kosmischen Energien aufladen muss. Bitte versuche es in einigen Momenten erneut.'
          );
        })
      );
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    this.saveChartData();
    sessionStorage.setItem(
      'birthChartUserMessageCount',
      this.userMessageCount.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'birthChartBlockedMessageId',
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
        'birthChartMessages',
        JSON.stringify(messagesToSave)
      );
    } catch {}
  }

  private saveChartData(): void {
    try {
      const dataToSave = {
        ...this.chartData,
        fullName: this.fullName,
        birthDate: this.birthDate,
        birthTime: this.birthTime,
        birthPlace: this.birthPlace,
      };
      sessionStorage.setItem('birthChartData', JSON.stringify(dataToSave));
    } catch {}
  }

  isMessageBlocked(message: Message): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForBirthTable
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
      sessionStorage.setItem('pendingBirthTableMessage', this.currentMessage);
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
        serviceName: 'Geburtstabelle',
        returnPath: '/geburtstabelle',
        cancelPath: '/geburtstabelle',
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

  // Methoden zur Verwaltung persönlicher Daten
  savePersonalData(): void {
    this.chartData = {
      ...this.chartData,
      fullName: this.fullName,
      birthDate: this.birthDate,
      birthTime: this.birthTime,
      birthPlace: this.birthPlace,
    };

    // Beispiel-Sternzeichen basierend auf den Daten generieren
    if (this.birthDate) {
      this.generateSampleChartData();
    }

    this.saveChartData();
    this.showDataForm = false;

    this.shouldScrollToBottom = true;
    this.addMessage({
      sender: 'Meisterin Emma',
      content: `🌟 Perfekt, ${this.fullName}. Ich habe deine himmlischen Daten registriert. Die Konfigurationen deiner Geburt in ${this.birthPlace} am ${this.birthDate} offenbaren einzigartige Muster im Kosmos. Auf welchen spezifischen Aspekt deines Geburtshoroskops möchtest du dich konzentrieren?`,
      timestamp: new Date(),
      isUser: false,
    });
  }

  private generateSampleChartData(): void {
    // Beispieldaten basierend auf dem Geburtsdatum generieren
    const date = new Date(this.birthDate);
    const month = date.getMonth() + 1;

    const zodiacSigns = [
      'Steinbock',
      'Wassermann',
      'Fische',
      'Widder',
      'Stier',
      'Zwillinge',
      'Krebs',
      'Löwe',
      'Jungfrau',
      'Waage',
      'Skorpion',
      'Schütze',
    ];
    const signIndex = Math.floor((month - 1) / 1) % 12;
    this.chartData.sunSign = zodiacSigns[signIndex];
    this.chartData.moonSign = zodiacSigns[(signIndex + 4) % 12];
    this.chartData.ascendant = zodiacSigns[(signIndex + 8) % 12];
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  // Hilfsmethoden
  addMessage(message: Message): void {
    this.messages.push(message);
    this.shouldScrollToBottom = true;
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

  onScroll(event: any): void {
    const element = event.target;
    const isAtBottom =
      element.scrollHeight - element.scrollTop === element.clientHeight;
    this.isUserScrolling = !isAtBottom;
    if (isAtBottom) this.isUserScrolling = false;
  }

  onUserStartScroll(): void {
    this.isUserScrolling = true;
    setTimeout(() => {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        const isAtBottom =
          element.scrollHeight - element.scrollTop === element.clientHeight;
        if (isAtBottom) this.isUserScrolling = false;
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

  closeModal(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }

  clearChat(): void {
    // Chat-Nachrichten löschen
    this.messages = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;

    // ✅ Zähler und Status zurücksetzen
    if (!this.hasUserPaidForBirthTable) {
      this.userMessageCount = 0;
      this.blockedMessageId = null;
      sessionStorage.removeItem('birthChartMessages');
      sessionStorage.removeItem('birthChartBlockedMessageId');
      sessionStorage.removeItem('birthChartData');
      sessionStorage.removeItem('birthChartUserMessageCount');
      sessionStorage.removeItem('freeBirthChartConsultations');
      sessionStorage.removeItem('pendingBirthChartMessage');
    } else {
      sessionStorage.removeItem('birthChartMessages');
      sessionStorage.removeItem('birthChartBlockedMessageId');
      sessionStorage.removeItem('birthChartData');
      sessionStorage.removeItem('birthChartUserMessageCount');
      this.userMessageCount = 0;
      this.blockedMessageId = null;
    }

    this.isLoading = false;

    // Angeben, dass gescrollt werden soll weil eine neue Nachricht da ist
    this.shouldScrollToBottom = true;

    // Separate Methode zur Initialisierung verwenden
    this.initializeBirthChartWelcomeMessage();
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
        // ✅ promptForPayment aufrufen, das Stripe initialisiert
        this.promptForPayment();
      },
      error: (error) => {
        // ✅ TROTZDEM Zahlungsmodal öffnen
        this.promptForPayment();
      },
    });
  }

  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  showBirthChartWheelAfterDelay(delayMs: number = 3000): void {
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
    const prizeMessage: Message = {
      sender: 'Meisterin Emma',
      content: `🌟 Die himmlischen Konfigurationen haben zu deinen Gunsten konspiriert! Du hast gewonnen: **${prize.name}** ${prize.icon}\n\nDie alten Hüter der Sterne haben beschlossen, dich mit diesem heiligen Geschenk zu segnen. Die kosmische Energie fließt durch dich und offenbart tiefere Geheimnisse deines Geburtshoroskops. Möge die himmlische Weisheit dich erleuchten!`,
      timestamp: new Date(),
      isUser: false,
    };

    this.messages.push(prizeMessage);
    this.shouldScrollToBottom = true;
    this.saveMessagesToSession();

    this.processBirthChartPrize(prize);
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  triggerBirthChartWheel(): void {
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

  private processBirthChartPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Astrale Lesungen
        this.addFreeBirthChartConsultations(3);
        break;
      case '2': // 1 Premium-Analyse - VOLLER ZUGANG
        this.hasUserPaidForBirthTable = true;
        sessionStorage.setItem('hasUserPaidBirthChart', 'true');

        // Blockierte Nachricht entsperren
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('birthChartBlockedMessageId');
        }

        // Spezielle Nachricht für diesen Preis hinzufügen
        const premiumMessage: Message = {
          sender: 'Meisterin Emma',
          content:
            '🌟 **Du hast den vollständigen Premium-Zugang freigeschaltet!** 🌟\n\nDie himmlischen Konfigurationen haben dir außerordentlich zugelächelt. Du hast jetzt unbegrenzten Zugang zu meiner gesamten Weisheit über Geburtshoroskope. Du kannst über deine astrale Konfiguration, Planeten, Häuser und alle himmlischen Geheimnisse so oft anfragen, wie du möchtest.\n\n✨ *Das Universum hat dir alle Türen geöffnet* ✨',
          timestamp: new Date(),
          isUser: false,
        };
        this.messages.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveMessagesToSession();
        break;
      case '4': // Noch eine Chance
        break;
      default:
    }
  }

  private addFreeBirthChartConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeBirthChartConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeBirthChartConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForBirthTable) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('birthChartBlockedMessageId');
    }
  }

  private hasFreeBirthChartConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeBirthChartConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeBirthChartConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeBirthChartConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem(
        'freeBirthChartConsultations',
        remaining.toString()
      );

      const prizeMsg: Message = {
        sender: 'Meisterin Emma',
        content: `✨ *Du hast eine kostenlose astrale Lesung verwendet* ✨\n\nDir bleiben noch **${remaining}** himmlische Beratungen verfügbar.`,
        timestamp: new Date(),
        isUser: false,
      };

      this.messages.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveMessagesToSession();
    }
  }

  debugBirthChartWheel(): void {
    this.showFortuneWheel = true;
    this.cdr.markForCheck();
  }

  // ✅ HILFSMETHODE für das Template
  getBirthChartConsultationsCount(): number {
    return parseInt(
      sessionStorage.getItem('freeBirthChartConsultations') || '0'
    );
  }

  // ✅ HILFSMETHODE für Parsing im Template
  parseInt(value: string): number {
    return parseInt(value);
  }
}