import { Injectable } from '@angular/core';
import { environment } from '../environments/environments';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timeout, catchError, map } from 'rxjs';

export interface BirthChartRequest {
  chartData: {
    name: string;
    specialty: string;
    experience: string;
  };
  userMessage: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: 'user' | 'astrologer';
    message: string;
  }>;
  // ✅ Campos para el sistema de 3 mensajes gratis
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface BirthChartResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp: string;
  // ✅ Campos que devuelve el backend
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export interface AstrologerInfo {
  success: boolean;
  astrologer: {
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
export class TablaNacimientoService {
  private apiUrl = `${environment.apiUrl}api/tabla-nacimiento`;

  // ✅ Datos por defecto del astrólogo (EN ALEMÁN)
  private defaultChartData = {
    name: 'Meisterin Aurora',
    title: 'Hüterin der Himmlischen Karten',
    specialty: 'Westliche und vedische Astrologie',
    experience: 'Jahrzehntelange Erfahrung in der Interpretation von Geburtshoroskopen',
  };

  constructor(private http: HttpClient) {}

  /**
   * ✅ MÉTODO PRINCIPAL: Enviar mensaje con contador de mensajes
   */
  chatWithAstrologerWithCount(
    request: BirthChartRequest,
    messageCount: number,
    isPremiumUser: boolean
  ): Observable<BirthChartResponse> {
    const fullRequest: BirthChartRequest = {
      ...request,
      chartData: request.chartData || this.defaultChartData,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Nachricht an Astrologen senden:', {
      messageCount: fullRequest.messageCount,
      isPremiumUser: fullRequest.isPremiumUser,
    });

    return this.http
      .post<BirthChartResponse>(`${this.apiUrl}/chat`, fullRequest)
      .pipe(
        timeout(60000),
        map((response: BirthChartResponse) => {
          console.log('📥 Antwort vom Astrologen:', {
            success: response.success,
            freeMessagesRemaining: response.freeMessagesRemaining,
            showPaywall: response.showPaywall,
          });

          if (response.success) {
            return response;
          }
          throw new Error(response.error || 'Ungültige Antwort vom Server');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Fehler bei der Kommunikation mit dem Astrologen:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as BirthChartResponse);
        })
      );
  }

  /**
   * Método legacy para compatibilidad
   */
  chatWithAstrologer(request: BirthChartRequest): Observable<BirthChartResponse> {
    const fullRequest: BirthChartRequest = {
      ...request,
      chartData: request.chartData || this.defaultChartData,
    };

    return this.http
      .post<BirthChartResponse>(`${this.apiUrl}/chat`, fullRequest)
      .pipe(
        timeout(30000),
        catchError((error: HttpErrorResponse) => {
          console.error('Fehler bei der Kommunikation mit dem Astrologen:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as BirthChartResponse);
        })
      );
  }

  /**
   * Obtener información del astrólogo
   */
  getBirthChartInfo(): Observable<AstrologerInfo> {
    return this.http.get<AstrologerInfo>(`${this.apiUrl}/info`).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Fehler beim Abrufen der Astrologen-Info:', error);
        return of({
          success: false,
          astrologer: {
            name: 'Meisterin Aurora',
            title: 'Hüterin der Himmlischen Karten',
            specialty: 'Westliche und vedische Astrologie',
            description: 'Fehler bei der Verbindung mit der Astrologin',
            services: [],
          },
          freeMessagesLimit: 3,
          timestamp: new Date().toISOString(),
        } as AstrologerInfo);
      })
    );
  }

  /**
   * ✅ Manejo de errores HTTP (MENSAJES EN ALEMÁN)
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 429) {
      return 'Du hast zu viele Anfragen gestellt. Bitte warte einen Moment, bevor du fortfährst.';
    }

    if (error.status === 503) {
      return 'Der Dienst ist vorübergehend nicht verfügbar. Bitte versuche es in einigen Minuten erneut.';
    }

    if (error.status === 0) {
      return 'Verbindung zur Astrologie-Meisterin nicht möglich. Bitte versuche es in einigen Minuten erneut.';
    }

    if (error.error?.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Zu viele Anfragen. Bitte warte einen Moment.';
    }

    if (error.error?.code === 'MISSING_CHART_DATA') {
      return 'Fehler in den Geburtshoroskop-Daten. Bitte versuche es erneut.';
    }

    if (error.error?.code === 'ALL_MODELS_UNAVAILABLE') {
      return 'Alle KI-Modelle sind vorübergehend nicht verfügbar. Bitte versuche es in einigen Minuten erneut.';
    }

    return 'Entschuldigung, die astrologischen Energien sind im Moment blockiert. Ich lade dich ein, zu meditieren und es später erneut zu versuchen.';
  }
}