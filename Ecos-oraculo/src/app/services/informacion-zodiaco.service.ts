import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../environments/environmets.prod';

// ✅ Aktualisierte Interfaces für das Backend
export interface AstrologerData {
  name: string;
  title: string;
  specialty: string;
  experience: string;
}

export interface ZodiacRequest {
  zodiacData: AstrologerData;
  userMessage: string;
  birthDate?: string;
  zodiacSign?: string;
  conversationHistory?: Array<{
    role: 'user' | 'astrologer';
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface ZodiacResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export interface AstrologerInfoResponse {
  success: boolean;
  astrologer: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class InformacionZodiacoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Sendet eine Nachricht an die Astrologin und erhält eine Antwort
   */
  chatWithAstrologer(request: ZodiacRequest): Observable<ZodiacResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    // ✅ Cambiado de 'api/zodiac/chat' a 'api/zodiaco/chat'
    return this.http
      .post<ZodiacResponse>(`${this.apiUrl}api/zodiaco/chat`, request, {
        headers,
      })
      .pipe(
        timeout(60000), // 60 Sekunden Timeout
        catchError((error) => {
          console.error('Fehler in chatWithAstrologer:', error);

          let errorMessage =
            'Fehler bei der Kommunikation mit der Astrologin. Bitte versuch es nochmal.';
          let errorCode = 'NETWORK_ERROR';

          if (error.status === 429) {
            errorMessage =
              'Zu viele Anfragen. Bitte warte einen Moment, bevor du fortfährst.';
            errorCode = 'RATE_LIMIT';
          } else if (error.status === 503) {
            errorMessage =
              'Der Dienst ist vorübergehend nicht verfügbar. Versuch es in ein paar Minuten nochmal.';
            errorCode = 'SERVICE_UNAVAILABLE';
          } else if (error.status === 400) {
            errorMessage =
              error.error?.error ||
              'Ungültige Anfrage. Überprüfe deine Nachricht.';
            errorCode = error.error?.code || 'BAD_REQUEST';
          } else if (error.status === 401) {
            errorMessage = 'Authentifizierungsfehler beim Dienst.';
            errorCode = 'AUTH_ERROR';
          } else if (error.name === 'TimeoutError') {
            errorMessage =
              'Die Anfrage hat zu lange gedauert. Bitte versuch es nochmal.';
            errorCode = 'TIMEOUT';
          }

          return throwError(() => ({
            success: false,
            error: errorMessage,
            code: errorCode,
            timestamp: new Date().toISOString(),
          }));
        })
      );
  }

  /**
   * Ruft Informationen über die Astrologin ab
   */
  getAstrologerInfo(): Observable<AstrologerInfoResponse> {
    return this.http
      .get<AstrologerInfoResponse>(`${this.apiUrl}api/zodiac/info`)
      .pipe(
        timeout(10000),
        catchError((error) => {
          console.error('Fehler in getAstrologerInfo:', error);
          return throwError(() => ({
            success: false,
            error: 'Fehler beim Abrufen der Astrologin-Informationen',
            timestamp: new Date().toISOString(),
          }));
        })
      );
  }

  /**
   * Berechnet das Sternzeichen basierend auf dem Geburtsdatum
   */
  calculateZodiacSign(birthDate: string): string {
    try {
      const date = new Date(birthDate);
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return 'Widder ♈';
      if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return 'Stier ♉';
      if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return 'Zwillinge ♊';
      if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return 'Krebs ♋';
      if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return 'Löwe ♌';
      if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return 'Jungfrau ♍';
      if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return 'Waage ♎';
      if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return 'Skorpion ♏';
      if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return 'Schütze ♐';
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return 'Steinbock ♑';
      if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return 'Wassermann ♒';
      if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return 'Fische ♓';

      return 'Unbekanntes Sternzeichen';
    } catch {
      return 'Ungültiges Datum';
    }
  }
}
