import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
export interface Prize {
  id: string;
  name: string;
  color: string;
  textColor?: string;
  icon?: string;
}

@Component({
  selector: 'app-fortune-wheel',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './fortune-wheel.component.html',
  styleUrl: './fortune-wheel.component.css',
})
export class FortuneWheelComponent implements OnInit, OnDestroy {
  @Input() isVisible: boolean = false;
  @Input() prizes: Prize[] = [
    { id: '1', name: '3 kostenlose Drehungen', color: '#4ecdc4', icon: '🎲' },
    { id: '2', name: '1 Premium-Konsultation', color: '#45b7d1', icon: '🔮' },
    { id: '4', name: 'Versuche es nochmal!', color: '#ff7675', icon: '🔄' },
  ];

  @Output() onPrizeWon = new EventEmitter<Prize>();
  @Output() onWheelClosed = new EventEmitter<void>();

  @ViewChild('wheelElement') wheelElement!: ElementRef;

  // ✅ EIGENSCHAFTEN FÜR DAS RAD
  segmentAngle: number = 0;
  currentRotation: number = 0;
  isSpinning: boolean = false;
  selectedPrize: Prize | null = null;
  wheelSpinning: boolean = false;

  // ✅ VERBESSERTE STATUSKONTROLLE
  canSpinWheel: boolean = true;
  isProcessingClick: boolean = false; // ✅ NEU: Mehrfachklicks verhindern
  hasUsedDailyFreeSpIn: boolean = false;
  nextFreeSpinTime: Date | null = null;
  spinCooldownTimer: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.segmentAngle = 360 / this.prizes.length;
    this.checkSpinAvailability();
    this.startSpinCooldownTimer();
  }

  ngOnDestroy(): void {
    if (this.spinCooldownTimer) {
      clearInterval(this.spinCooldownTimer);
    }
  }
  get currentWheelSpins(): number {
    return this.getWheelSpinsCount();
  }
  // ✅ HAUPTMETHODE ZUM ÜBERPRÜFEN, OB DAS RAD ANGEZEIGT WERDEN KANN
  static canShowWheel(): boolean {
    const wheelSpins = parseInt(sessionStorage.getItem('wheelSpins') || '0');
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');
    const today = new Date().toDateString();

 

    // Hat zusätzliche Drehungen für das Rad
    if (wheelSpins > 0) {
      return true;
    }

    // Neuer Benutzer (hat noch nie gedreht)
    if (!lastSpinDate) {
      return true;
    }

    // Hat bereits die kostenlose tägliche Drehung verwendet
    if (lastSpinDate === today) {
      return false;
    }

    // Neuer Tag - kann kostenlose Drehung verwenden
    return true;
  }

  // ✅ STATISCHE METHODE ZUM ÜBERPRÜFEN AUS ANDEREN KOMPONENTEN
  static getSpinStatus(): string {
    const wheelSpins = parseInt(sessionStorage.getItem('wheelSpins') || '0');
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');
    const today = new Date().toDateString();

    if (wheelSpins > 0) {
      return `${wheelSpins} Roulette-Drehungen verfügbar`;
    }

    if (!lastSpinDate) {
      return 'Kostenlose Drehung verfügbar';
    }

    if (lastSpinDate !== today) {
      return 'Tägliche Drehung verfügbar';
    }

    return 'Keine Drehungen heute verfügbar';
  }

  // ✅ VERFÜGBARKEIT VON DREHUNGEN ÜBERPRÜFEN
  checkSpinAvailability(): void {
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');
    const today = new Date().toDateString();
    const wheelSpins = this.getWheelSpinsCount();


    if (!lastSpinDate) {
      // Neuer Benutzer - erstes Mal
      this.canSpinWheel = true;
      this.hasUsedDailyFreeSpIn = false;
      return;
    }

    // Überprüfen, ob bereits die tägliche Drehung heute verwendet wurde
    if (lastSpinDate === today) {
      this.hasUsedDailyFreeSpIn = true;
      // Kann nur drehen, wenn zusätzliche Drehungen vorhanden sind
      this.canSpinWheel = wheelSpins > 0;
   
    } else {
      // Neuer Tag - kann kostenlose Drehung verwenden
      this.hasUsedDailyFreeSpIn = false;
      this.canSpinWheel = true;
    }
  }

  async spinWheel() {

    // ✅ STRIKTE VALIDIERUNGEN
    if (this.isProcessingClick) {
      return;
    }

    if (!this.canSpinWheel || this.wheelSpinning || this.isSpinning) {
      return;
    }

    // ✅ SOFORT BLOCKIEREN
    this.isProcessingClick = true;

    // ✅ STATUS VOR DEM DREHEN ANZEIGEN
    const wheelSpinsBefore = this.getWheelSpinsCount();
    const dreamConsultationsBefore = this.getDreamConsultationsCount();
    try {
      // ✅ BLOCKIERUNGSSTATUS
      this.wheelSpinning = true;
      this.isSpinning = true;
      this.canSpinWheel = false;
      this.selectedPrize = null;
      this.cdr.markForCheck(); // ✅ Änderungen erkennen

      // ✅ DREHUNG SOFORT VERWENDEN (DAS VERRINGERT DEN ZÄHLER)
      this.handleSpinUsage();

      // ✅ STATUS NACH DER VERWENDUNG ÜBERPRÜFEN
      const wheelSpinsAfter = this.getWheelSpinsCount();
      // ✅ GEWONNENEN PREIS BESTIMMEN
      const wonPrize = this.determineWonPrize();
      // ✅ ROTATIONSANIMATION
      const minSpins = 6;
      const maxSpins = 10;
      const randomSpins = Math.random() * (maxSpins - minSpins) + minSpins;
      const finalRotation = randomSpins * 360;

      // Rotation anwenden
      this.currentRotation += finalRotation;
    

      await this.waitForAnimation(3000);

      // ✅ ANIMATIONSSTATUS BEENDEN
      this.wheelSpinning = false;
      this.isSpinning = false;
      this.selectedPrize = wonPrize;
      this.cdr.markForCheck(); // ✅ KRITISCHE Änderungen erkennen


      // ✅ PREIS VERARBEITEN (DAS KANN MEHR DREHUNGEN/KONSULTATIONEN HINZUFÜGEN)
      await this.processPrizeWon(wonPrize);

      // ✅ STATUS NACH PREISVERARBEITUNG
      const finalWheelSpins = this.getWheelSpinsCount();
      const finalDreamConsultations = this.getDreamConsultationsCount();
      // ✅ VERFÜGBARKEIT BASIEREND AUF ENDSTATUS AKTUALISIEREN
      this.updateSpinAvailabilityAfterPrize(wonPrize);

      // ✅ PREISEREIGNIS AUSLÖSEN
      this.onPrizeWon.emit(wonPrize);

      this.cdr.markForCheck(); // ✅ Endgültige Änderungen erkennen

    } catch (error) {

      // ✅ STATUS BEI FEHLER ZURÜCKSETZEN
      this.wheelSpinning = false;
      this.isSpinning = false;
      this.selectedPrize = null;
      this.cdr.markForCheck(); // ✅ Änderungen bei Fehler erkennen

      // Verfügbarkeit wiederherstellen
      this.checkSpinAvailability();
    } finally {
      // ✅ BLOCKIERUNG NACH EINEM DELAY FREIGEBEN
      setTimeout(() => {
        this.isProcessingClick = false;

        // ✅ ENDGÜLTIGE VERFÜGBARKEITSÜBERPRÜFUNG
        this.checkSpinAvailability();

        this.cdr.markForCheck(); // ✅ Änderungen beim Freigeben erkennen

      }, 1000);
    }

  }
  private updateSpinAvailabilityAfterPrize(wonPrize: Prize): void {

    const wheelSpins = this.getWheelSpinsCount();
    const today = new Date().toDateString();
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');


    // ✅ VERFÜGBARKEITSLOGIK
    if (wheelSpins > 0) {
      // Hat zusätzliche Drehungen verfügbar
      this.canSpinWheel = true;
    } else if (!this.hasUsedDailyFreeSpIn) {
      // Überprüfen, ob tägliche Drehung verwendet werden kann (sollte hier nicht ankommen nach Verwendung)
      this.canSpinWheel = lastSpinDate !== today;
    } else {
      // Hat tägliche Drehung verwendet und hat keine zusätzlichen
      this.canSpinWheel = false;
    }

  }
  // ✅ HILFSFUNKTION ZUM WARTEN
  private waitForAnimation(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  private handleSpinUsage(): void {
    const wheelSpins = this.getWheelSpinsCount();
    const today = new Date().toDateString();
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');


    if (wheelSpins > 0) {
      // ✅ ZUSÄTZLICHE RAD-DREHUNG VERWENDEN
      const newCount = wheelSpins - 1;
      sessionStorage.setItem('wheelSpins', newCount.toString());

      // ✅ VERFÜGBARKEIT SOFORT AKTUALISIEREN
      this.checkSpinAvailability();
    } else {
      // ✅ KOSTENLOSE TÄGLICHE DREHUNG VERWENDEN
      sessionStorage.setItem('lastWheelSpinDate', today);
      sessionStorage.setItem('lastWheelSpinTime', Date.now().toString());
      this.hasUsedDailyFreeSpIn = true;
    }
  }

  // ✅ GEWONNENEN PREIS VERARBEITEN (VERBESSERT)
  private async processPrizeWon(prize: Prize): Promise<void> {

    switch (prize.id) {
      case '1': // 3 Kostenlose Rad-Drehungen
        this.grantWheelSpins(3);
        break;
      case '2': // 1 Kostenlose Traum-Konsultation
        this.grantDreamConsultations(1);
        break;
      case '4': // Versuche es nochmal
        this.grantRetryChance();
        break;
      default:
    }

    this.savePrizeToHistory(prize);
  }

  // ✅ RAD-DREHUNGEN VERGEBEN (GETRENNT)
  private grantWheelSpins(count: number): void {
    const currentSpins = this.getWheelSpinsCount();
    sessionStorage.setItem('wheelSpins', (currentSpins + count).toString());
  }

  // ✅ TRAUM-KONSULTATIONEN VERGEBEN (GETRENNT)
  private grantDreamConsultations(count: number): void {
    const currentConsultations = parseInt(
      sessionStorage.getItem('dreamConsultations') || '0'
    );
    sessionStorage.setItem(
      'dreamConsultations',
      (currentConsultations + count).toString()
    );

    // Nachricht freischalten, falls eine blockiert war
    const blockedMessageId = sessionStorage.getItem('blockedMessageId');
    const hasUserPaid =
      sessionStorage.getItem('hasUserPaidForDreams') === 'true';

    if (blockedMessageId && !hasUserPaid) {
      sessionStorage.removeItem('blockedMessageId');
    }
  }

  // ✅ EINE WEITERE CHANCE VERGEBEN (NEU)
  private grantRetryChance(): void {
  }
  shouldShowContinueButton(prize: Prize | null): boolean {
    if (!prize) return false;

    // Preise, die zusätzliche Drehungen vergeben (Modal nicht schließen)
    const spinsGrantingPrizes = ['1', '4']; // Nur 3 Drehungen und versuche nochmal
    return spinsGrantingPrizes.includes(prize.id);
  }
  shouldShowCloseButton(prize: Prize | null): boolean {
    if (!prize) return false;
    return prize.id === '2';
  }
  continueSpinning(): void {

    // ✅ STATUS ZURÜCKSETZEN, UM EINE WEITERE DREHUNG ZU ERLAUBEN
    this.selectedPrize = null;
    this.isProcessingClick = false;
    this.wheelSpinning = false;
    this.isSpinning = false;

    // ✅ AKTUALISIERTE VERFÜGBARKEIT ÜBERPRÜFEN
    this.checkSpinAvailability();

    this.cdr.markForCheck(); // ✅ Änderungen erkennen

  }

  // ✅ AKTUALISIERTE HILFSMETHODE
  hasFreeSpinsAvailable(): boolean {
    return this.getWheelSpinsCount() > 0;
  }

  getWheelSpinsCount(): number {
    return parseInt(sessionStorage.getItem('wheelSpins') || '0');
  }

  getFreeSpinsCount(): number {
    // Kompatibilität mit Template beibehalten
    return this.getWheelSpinsCount();
  }

  getDreamConsultationsCount(): number {
    return parseInt(sessionStorage.getItem('dreamConsultations') || '0');
  }

  getTimeUntilNextSpin(): string {
    if (!this.nextFreeSpinTime) return '';

    const now = new Date().getTime();
    const timeLeft = this.nextFreeSpinTime.getTime() - now;

    if (timeLeft <= 0) return '';

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  // ✅ PREIS BESTIMMEN (OHNE ÄNDERUNGEN)
  private determineWonPrize(): Prize {
    const random = Math.random();

    if (random < 0.2) {
      return this.prizes[0]; // 20% - 3 Kostenlose Drehungen
    } else if (random < 0.35) {
      return this.prizes[1]; // 15% - 1 Premium-Konsultation
    } else {
      return this.prizes[2]; // 65% - Versuche es nochmal
    }
  }

  // ✅ PREIS IN HISTORIE SPEICHERN
  private savePrizeToHistory(prize: Prize): void {
    const prizeHistory = JSON.parse(
      sessionStorage.getItem('prizeHistory') || '[]'
    );
    prizeHistory.push({
      prize: prize,
      timestamp: new Date().toISOString(),
      claimed: true,
    });
    sessionStorage.setItem('prizeHistory', JSON.stringify(prizeHistory));
  }

  // ✅ TIMER FÜR COOLDOWN
  startSpinCooldownTimer(): void {
    if (this.spinCooldownTimer) {
      clearInterval(this.spinCooldownTimer);
    }

    if (this.nextFreeSpinTime && !this.canSpinWheel) {
      this.spinCooldownTimer = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = this.nextFreeSpinTime!.getTime() - now;

        if (timeLeft <= 0) {
          this.canSpinWheel = true;
          this.nextFreeSpinTime = null;
          clearInterval(this.spinCooldownTimer);
          this.cdr.markForCheck(); // ✅ Änderungen erkennen, wenn Cooldown endet
        }
      }, 1000);
    }
  }

  // ✅ RAD SCHLIESSEN
  closeWheel() {
    this.onWheelClosed.emit();
    this.resetWheel();
    this.cdr.markForCheck(); // ✅ Änderungen beim Schließen erkennen
  }

  // ✅ RAD ZURÜCKSETZEN
  private resetWheel() {
    this.selectedPrize = null;
    this.wheelSpinning = false;
    this.isSpinning = false;
    this.isProcessingClick = false;
    this.cdr.markForCheck(); // ✅ Änderungen beim Zurücksetzen erkennen
  }

  // ✅ METHODE ZUM SCHLIESSEN AUS TEMPLATE
  onWheelClosedHandler() {
    this.closeWheel();
  }
}
