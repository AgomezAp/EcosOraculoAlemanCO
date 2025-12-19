import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, timeout, catchError, map } from 'rxjs';
import { environment } from '../environments/environments';

interface ChineseZodiacData {
  name: string;
  specialty: string;
  experience: string;
}

interface ChatMessage {
  role: 'user' | 'master';
  message: string;
  timestamp?: string;
}

export interface ChineseZodiacRequest {
  zodiacData: ChineseZodiacData;
  userMessage: string;
  birthYear?: string;
  birthDate?: string;
  fullName?: string;
  conversationHistory?: ChatMessage[];
  // ✅ Campos para el sistema de 3 mensajes gratis
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface ChatResponse {
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

export interface MasterInfo {
  success: boolean;
  master: {
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
export class ZodiacoChinoService {
  private apiUrl = `${environment.apiUrl}api/zodiaco-chino`;

  // ✅ Datos por defecto del maestro (EN ALEMÁN)
  private defaultZodiacData: ChineseZodiacData = {
    name: 'Meister Li Wei',
    specialty: 'Chinesische Astrologie und die fünf Elemente',
    experience:
      'Jahrzehntelange Erfahrung in den Geheimnissen des chinesischen Tierkreises',
  };

  constructor(private http: HttpClient) {}

  /**
   * Obtener información del maestro
   */
  getMasterInfo(): Observable<MasterInfo> {
    return this.http.get<MasterInfo>(`${this.apiUrl}/info`).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Fehler beim Abrufen der Meister-Info:', error);
        return of({
          success: false,
          master: {
            name: 'Meister Li Wei',
            title: 'Hüter der Geheimnisse des chinesischen Tierkreises',
            specialty: 'Chinesische Astrologie und die fünf Elemente',
            description: 'Fehler bei der Verbindung mit dem Meister',
            services: [],
          },
          freeMessagesLimit: 3,
          timestamp: new Date().toISOString(),
        } as MasterInfo);
      })
    );
  }

  /**
   * ✅ MÉTODO PRINCIPAL: Enviar mensaje con contador de mensajes
   */
  chatWithMasterWithCount(
    request: ChineseZodiacRequest,
    messageCount: number,
    isPremiumUser: boolean
  ): Observable<ChatResponse> {
    const fullRequest: ChineseZodiacRequest = {
      ...request,
      zodiacData: request.zodiacData || this.defaultZodiacData,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Nachricht an den Meister senden:', {
      messageCount: fullRequest.messageCount,
      isPremiumUser: fullRequest.isPremiumUser,
    });

    return this.http
      .post<ChatResponse>(`${this.apiUrl}/chat`, fullRequest)
      .pipe(
        timeout(60000),
        map((response: ChatResponse) => {
          console.log('📥 Antwort vom Meister:', {
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
          console.error('Fehler bei der Kommunikation mit dem Meister:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as ChatResponse);
        })
      );
  }

  /**
   * Método legacy para compatibilidad
   */
  chatWithMaster(request: ChineseZodiacRequest): Observable<ChatResponse> {
    const fullRequest: ChineseZodiacRequest = {
      ...request,
      zodiacData: request.zodiacData || this.defaultZodiacData,
    };

    return this.http
      .post<ChatResponse>(`${this.apiUrl}/chat`, fullRequest)
      .pipe(
        timeout(30000),
        catchError((error: HttpErrorResponse) => {
          console.error('Fehler bei der Kommunikation mit dem Meister:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as ChatResponse);
        })
      );
  }

  /**
   * ✅ Obtener el animal del zodíaco chino según el año
   */
  getChineseZodiacAnimal(year: number): string {
    const animals: { [key: number]: string } = {
      0: 'Affe', // Mono
      1: 'Hahn', // Gallo
      2: 'Hund', // Perro
      3: 'Schwein', // Cerdo
      4: 'Ratte', // Rata
      5: 'Büffel', // Buey
      6: 'Tiger', // Tigre
      7: 'Hase', // Conejo
      8: 'Drache', // Dragón
      9: 'Schlange', // Serpiente
      10: 'Pferd', // Caballo
      11: 'Ziege', // Cabra
    };

    const index = year % 12;
    return animals[index] || 'Unbekannt';
  }

  /**
   * ✅ Obtener el elemento según el año
   */
  getChineseElement(year: number): string {
    const elements: { [key: number]: string } = {
      0: 'Metall', // Metal
      1: 'Metall',
      2: 'Wasser', // Agua
      3: 'Wasser',
      4: 'Holz', // Madera
      5: 'Holz',
      6: 'Feuer', // Fuego
      7: 'Feuer',
      8: 'Erde', // Tierra
      9: 'Erde',
    };

    const index = year % 10;
    return elements[index] || 'Unbekannt';
  }

  /**
   * ✅ Obtener descripción del animal del zodíaco
   */
  getAnimalDescription(animal: string): string {
    const descriptions: { [key: string]: string } = {
      Ratte: 'Intelligent, anpassungsfähig, schnell denkend und charmant',
      Büffel: 'Fleißig, zuverlässig, stark und entschlossen',
      Tiger: 'Mutig, selbstbewusst, wettbewerbsfähig und unberechenbar',
      Hase: 'Ruhig, elegant, freundlich und verantwortungsbewusst',
      Drache: 'Selbstbewusst, intelligent, enthusiastisch und ehrgeizig',
      Schlange: 'Rätselhaft, intelligent, weise und intuitiv',
      Pferd: 'Energisch, unabhängig, ungeduldig und abenteuerlustig',
      Ziege: 'Sanft, kreativ, mitfühlend und beharrlich',
      Affe: 'Schlau, neugierig, verspielt und klug',
      Hahn: 'Beobachtend, fleißig, mutig und selbstbewusst',
      Hund: 'Loyal, ehrlich, vorsichtig und freundlich',
      Schwein: 'Großzügig, mitfühlend, fleißig und gesellig',
    };

    return descriptions[animal] || 'Beschreibung nicht verfügbar';
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
      return 'Verbindung zum Meister des chinesischen Tierkreises nicht möglich. Bitte versuche es in einigen Minuten erneut.';
    }

    if (error.error?.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Zu viele Anfragen. Bitte warte einen Moment.';
    }

    if (error.error?.code === 'MISSING_ZODIAC_DATA') {
      return 'Fehler in den Tierkreis-Daten. Bitte versuche es erneut.';
    }

    if (error.error?.code === 'ALL_MODELS_UNAVAILABLE') {
      return 'Alle KI-Modelle sind vorübergehend nicht verfügbar. Bitte versuche es in einigen Minuten erneut.';
    }

    return 'Entschuldigung, die kosmischen Energien des chinesischen Tierkreises sind im Moment blockiert. Ich lade dich ein, zu meditieren und es später erneut zu versuchen.';
  }
}
