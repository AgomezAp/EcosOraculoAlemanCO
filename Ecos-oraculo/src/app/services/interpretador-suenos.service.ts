import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environments';

export interface DreamInterpreterData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

export interface ConversationMessage {
  role: 'user' | 'interpreter';
  message: string;
  timestamp: Date | string;
  id?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  isCompleteResponse?: boolean;
  isPrizeAnnouncement?: boolean;
}

export interface DreamChatRequest {
  interpreterData: DreamInterpreterData;
  userMessage: string;
  conversationHistory?: ConversationMessage[];
  // ✅ NEUE FELDER für das System mit 3 kostenlosen Nachrichten
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface DreamChatResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp: string;
  // ✅ NEUE FELDER, die das Backend zurückgibt
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export interface InterpreterInfo {
  success: boolean;
  interpreter: {
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
export class InterpretadorSuenosService {
  private apiUrl = `${environment.apiUrl}`;

  // Standarddaten der Traumdeuterin
  private defaultInterpreterData: DreamInterpreterData = {
    name: 'Meisterin Alma',
    title: 'Hüterin der Träume',
    specialty: 'Traumdeutung und Traumsymbolik',
    experience:
      'Jahrhunderte Erfahrung in der Interpretation von Botschaften des Unterbewusstseins',
  };

  constructor(private http: HttpClient) {}

  /**
   * ✅ HAUPTMETHODE: Nachricht mit Nachrichtenzähler senden
   */
  chatWithInterpreterWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    conversationHistory?: ConversationMessage[]
  ): Observable<DreamChatResponse> {
    const request: DreamChatRequest = {
      interpreterData: this.defaultInterpreterData,
      userMessage: userMessage.trim(),
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Sende Traumnachricht:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<DreamChatResponse>(`${this.apiUrl}interpretador-sueno`, request)
      .pipe(
        timeout(60000),
        map((response: DreamChatResponse) => {
          console.log('📥 Traumantwort:', {
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
          console.error('Fehler bei Kommunikation mit Traumdeuterin:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as DreamChatResponse);
        })
      );
  }

  /**
   * Legacy-Methode für Kompatibilität
   */
  chatWithInterpreter(
    request: DreamChatRequest
  ): Observable<DreamChatResponse> {
    const fullRequest: DreamChatRequest = {
      ...request,
      interpreterData: request.interpreterData || this.defaultInterpreterData,
      messageCount: request.messageCount || 1,
      isPremiumUser: request.isPremiumUser || false,
    };

    return this.http
      .post<DreamChatResponse>(`${this.apiUrl}interpretador-sueno`, fullRequest)
      .pipe(
        timeout(30000),
        catchError((error: HttpErrorResponse) => {
          console.error('Fehler in chatWithInterpreter:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as DreamChatResponse);
        })
      );
  }

  /**
   * Informationen der Traumdeuterin abrufen
   */
  getInterpreterInfo(): Observable<InterpreterInfo> {
    return this.http
      .get<InterpreterInfo>(`${this.apiUrl}interpretador-sueno/info`)
      .pipe(
        timeout(10000),
        catchError((error: HttpErrorResponse) => {
          console.error('Fehler beim Abrufen der Traumdeuterin-Info:', error);
          return of({
            success: false,
            interpreter: {
              name: 'Meisterin Alma',
              title: 'Hüterin der Träume',
              specialty: 'Traumdeutung und Traumsymbolik',
              description: 'Fehler bei der Verbindung mit der Traumdeuterin',
              services: [],
            },
            freeMessagesLimit: 3,
            timestamp: new Date().toISOString(),
          } as InterpreterInfo);
        })
      );
  }

  /**
   * HTTP-Fehlerbehandlung
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 429) {
      return 'Du hast zu viele Anfragen gestellt. Bitte warte einen Moment, bevor du fortfährst.';
    }

    if (error.status === 503) {
      return 'Der Dienst ist vorübergehend nicht verfügbar. Versuch es in ein paar Minuten nochmal.';
    }

    if (error.status === 0) {
      return 'Keine Verbindung zur Traumdeuterin möglich. Versuch es in ein paar Minuten nochmal.';
    }

    if (error.error?.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Zu viele Anfragen. Bitte warte einen Moment.';
    }

    if (error.error?.code === 'ALL_MODELS_UNAVAILABLE') {
      return 'Alle KI-Modelle sind vorübergehend nicht verfügbar. Versuch es in ein paar Minuten nochmal.';
    }

    return 'Entschuldigung, die Traumenergien sind gerade gestört. Versuch es später nochmal.';
  }
}
