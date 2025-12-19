import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environmets.prod';

// ✅ Interface para los datos del numerólogo
interface NumerologyData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

// ✅ Interface del Request - EXPORTADA
export interface NumerologyRequest {
  numerologyData: NumerologyData;
  userMessage: string;
  birthDate?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: 'user' | 'numerologist';
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

// ✅ Interface del Response - EXPORTADA
export interface NumerologyResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

// ✅ Interface para información del numerólogo - EXPORTADA
export interface NumerologyInfo {
  success: boolean;
  numerologist: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit?: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class NumerologiaService {
  private appUrl: string;
  private apiUrl: string;

  // Datos por defecto del numerólogo (EN ALEMÁN)
  private defaultNumerologyData: NumerologyData = {
    name: 'Meisterin Sophia',
    title: 'Hüterin der Heiligen Zahlen',
    specialty: 'Pythagoreische Numerologie',
    experience:
      'Jahrzehntelange Erfahrung mit den numerischen Schwingungen des Universums',
  };

  constructor(private http: HttpClient) {
    this.appUrl = environment.apiUrl;
    this.apiUrl = 'api/numerology';
  }

  /**
   * ✅ MÉTODO PRINCIPAL: Enviar mensaje con contador de mensajes
   */
  sendMessageWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    birthDate?: string,
    fullName?: string,
    conversationHistory?: Array<{
      role: 'user' | 'numerologist';
      message: string;
    }>
  ): Observable<NumerologyResponse> {
    const request: NumerologyRequest = {
      numerologyData: this.defaultNumerologyData,
      userMessage: userMessage.trim(),
      birthDate,
      fullName,
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Enviando mensaje al numerólogo:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<NumerologyResponse>(
        `${this.appUrl}${this.apiUrl}/numerologist`,
        request
      )
      .pipe(
        timeout(60000),
        map((response: NumerologyResponse) => {
          console.log('📥 Respuesta del numerólogo:', {
            success: response.success,
            freeMessagesRemaining: response.freeMessagesRemaining,
            showPaywall: response.showPaywall,
            isCompleteResponse: response.isCompleteResponse,
          });

          if (response.success) {
            return response;
          }
          throw new Error(response.error || 'Ungültige Antwort vom Server');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error en comunicación con numerólogo:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as NumerologyResponse);
        })
      );
  }

  /**
   * Método legacy para compatibilidad
   */
  sendMessage(
    userMessage: string,
    birthDate?: string,
    fullName?: string,
    conversationHistory?: Array<{
      role: 'user' | 'numerologist';
      message: string;
    }>
  ): Observable<string> {
    const request: NumerologyRequest = {
      numerologyData: this.defaultNumerologyData,
      userMessage: userMessage.trim(),
      birthDate,
      fullName,
      conversationHistory,
      messageCount: 1,
      isPremiumUser: false,
    };

    console.log(
      'Enviando mensaje al numerólogo (legacy):',
      this.apiUrl + '/numerologist'
    );

    return this.http
      .post<NumerologyResponse>(
        `${this.appUrl}${this.apiUrl}/numerologist`,
        request
      )
      .pipe(
        timeout(30000),
        map((response: NumerologyResponse) => {
          console.log('Respuesta del numerólogo:', response);
          if (response.success && response.response) {
            return response.response;
          }
          throw new Error(response.error || 'Ungültige Antwort vom Server');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error en comunicación con numerólogo:', error);
          return of(this.getErrorMessage(error));
        })
      );
  }

  /**
   * Obtener información del numerólogo
   */
  getNumerologyInfo(): Observable<NumerologyInfo> {
    return this.http
      .get<NumerologyInfo>(`${this.appUrl}${this.apiUrl}/numerologist/info`)
      .pipe(
        timeout(10000),
        catchError((error: HttpErrorResponse) => {
          console.error('Error obteniendo info del numerólogo:', error);
          return of({
            success: false,
            numerologist: {
              name: 'Meisterin Sophia',
              title: 'Hüterin der Heiligen Zahlen',
              specialty: 'Pythagoreische Numerologie',
              description: 'Fehler bei der Verbindung mit der Numerologin',
              services: [],
            },
            freeMessagesLimit: 3,
            timestamp: new Date().toISOString(),
          } as NumerologyInfo);
        })
      );
  }

  /**
   * Probar conexión con el backend
   */
  testConnection(): Observable<any> {
    return this.http.get(`${this.appUrl}api/health`).pipe(
      timeout(5000),
      catchError((error: HttpErrorResponse) => {
        console.error('Error de conexión:', error);
        return of({
          success: false,
          error: 'Verbindung zum Numerologie-Dienst nicht möglich',
        });
      })
    );
  }

  /**
   * Calcular número del camino de vida
   */
  calculateLifePath(birthDate: string): number {
    try {
      const numbers = birthDate.replace(/\D/g, '');
      const sum = numbers
        .split('')
        .reduce((acc, digit) => acc + parseInt(digit), 0);
      return this.reduceToSingleDigit(sum);
    } catch {
      return 0;
    }
  }

  /**
   * Calcular número del destino basado en el nombre
   */
  calculateDestinyNumber(name: string): number {
    const letterValues: { [key: string]: number } = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      E: 5,
      F: 6,
      G: 7,
      H: 8,
      I: 9,
      J: 1,
      K: 2,
      L: 3,
      M: 4,
      N: 5,
      O: 6,
      P: 7,
      Q: 8,
      R: 9,
      S: 1,
      T: 2,
      U: 3,
      V: 4,
      W: 5,
      X: 6,
      Y: 7,
      Z: 8,
    };

    const sum = name
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .split('')
      .reduce((acc, letter) => {
        return acc + (letterValues[letter] || 0);
      }, 0);

    return this.reduceToSingleDigit(sum);
  }

  /**
   * Obtener interpretación básica de un número (EN ALEMÁN)
   */
  getNumberMeaning(number: number): string {
    const meanings: { [key: number]: string } = {
      1: 'Führung, Unabhängigkeit, Pionier',
      2: 'Zusammenarbeit, Diplomatie, Sensibilität',
      3: 'Kreativität, Kommunikation, Ausdruck',
      4: 'Stabilität, harte Arbeit, Organisation',
      5: 'Freiheit, Abenteuer, Veränderung',
      6: 'Verantwortung, Fürsorge, Harmonie',
      7: 'Spiritualität, Selbstreflexion, Analyse',
      8: 'Materielle Macht, Ehrgeiz, Erfolge',
      9: 'Humanität, Mitgefühl, Weisheit',
      11: 'Inspiration, Intuition, Erleuchtung (Meisterzahl)',
      22: 'Meisterbaumeister, praktische Vision (Meisterzahl)',
      33: 'Meisterheiler, Dienst an der Menschheit (Meisterzahl)',
    };

    return meanings[number] || 'Nicht erkannte Zahl';
  }

  /**
   * Método auxiliar para reducir a dígito único
   */
  private reduceToSingleDigit(num: number): number {
    while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
      num = num
        .toString()
        .split('')
        .reduce((acc, digit) => acc + parseInt(digit), 0);
    }
    return num;
  }

  /**
   * Manejo de errores HTTP (MENSAJES EN ALEMÁN)
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 429) {
      return 'Du hast zu viele Anfragen gestellt. Bitte warte einen Moment, bevor du fortfährst.';
    }

    if (error.status === 503) {
      return 'Der Dienst ist vorübergehend nicht verfügbar. Bitte versuche es in einigen Minuten erneut.';
    }

    if (error.status === 0) {
      return 'Verbindung zur Numerologie-Meisterin nicht möglich. Bitte versuche es in einigen Minuten erneut.';
    }

    if (error.error?.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Zu viele Anfragen. Bitte warte einen Moment.';
    }

    if (error.error?.code === 'MISSING_NUMEROLOGY_DATA') {
      return 'Fehler in den Numerologen-Daten. Bitte versuche es erneut.';
    }

    if (error.error?.code === 'ALL_MODELS_UNAVAILABLE') {
      return 'Alle KI-Modelle sind vorübergehend nicht verfügbar. Bitte versuche es in einigen Minuten erneut.';
    }

    return 'Entschuldigung, die numerologischen Energien sind im Moment blockiert. Ich lade dich ein, zu meditieren und es später erneut zu versuchen.';
  }
}
