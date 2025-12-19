import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environmets.prod';

// ✅ Interface für die Daten der Berufsberaterin
interface VocationalData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

// ✅ Request-Interface - EXPORTIERT
export interface VocationalRequest {
  vocationalData: VocationalData;
  userMessage: string;
  personalInfo?: any;
  assessmentAnswers?: any[];
  conversationHistory?: Array<{
    role: 'user' | 'counselor';
    message: string;
  }>;
  // ✅ NEUE FELDER für das System mit 3 kostenlosen Nachrichten
  messageCount?: number;
  isPremiumUser?: boolean;
}

// ✅ Response-Interface - EXPORTIERT
export interface VocationalResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
  // ✅ NEUE FELDER, die das Backend zurückgibt
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

// ✅ Interface für Beraterin-Informationen - EXPORTIERT
export interface CounselorInfo {
  success: boolean;
  counselor: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit?: number;
  timestamp: string;
}

interface AssessmentQuestion {
  id: number;
  question: string;
  options: Array<{
    value: string;
    label: string;
    category: string;
  }>;
}

interface AssessmentAnswer {
  question: string;
  answer: string;
  category: string;
}

interface VocationalProfile {
  name: string;
  description: string;
  characteristics: string[];
  workEnvironments: string[];
}

@Injectable({
  providedIn: 'root',
})
export class MapaVocacionalService {
  private appUrl: string;
  private apiUrl: string;

  // Standarddaten der Berufsberaterin
  private defaultVocationalData: VocationalData = {
    name: 'Dr. Valeria',
    title: 'Spezialistin für Berufsberatung',
    specialty: 'Karriereorientierung und personalisierte berufliche Landkarten',
    experience:
      'Jahre der Erfahrung in Berufsberatung und Karriereentwicklung',
  };

  // Berufliche Profile
  private vocationalProfiles: { [key: string]: VocationalProfile } = {
    realistic: {
      name: 'Realistisch',
      description:
        'Bevorzugt praktische Aktivitäten und die Arbeit mit Werkzeugen, Maschinen oder Tieren.',
      characteristics: ['Praktisch', 'Mechanisch', 'Sportlich', 'Direkt'],
      workEnvironments: [
        'Im Freien',
        'Werkstätten',
        'Labore',
        'Bauwesen',
      ],
    },
    investigative: {
      name: 'Forschend',
      description:
        'Löst gerne komplexe Probleme und führt Forschungen durch.',
      characteristics: ['Analytisch', 'Neugierig', 'Unabhängig', 'Zurückhaltend'],
      workEnvironments: [
        'Labore',
        'Universitäten',
        'Forschungszentren',
      ],
    },
    artistic: {
      name: 'Künstlerisch',
      description:
        'Schätzt Selbstausdruck, Kreativität und unstrukturierte Arbeit.',
      characteristics: ['Kreativ', 'Originell', 'Unabhängig', 'Ausdrucksstark'],
      workEnvironments: ['Studios', 'Theater', 'Kreativagenturen', 'Museen'],
    },
    social: {
      name: 'Sozial',
      description: 'Arbeitet bevorzugt mit Menschen, hilft und lehrt gerne.',
      characteristics: ['Kooperativ', 'Empathisch', 'Geduldig', 'Großzügig'],
      workEnvironments: [
        'Schulen',
        'Krankenhäuser',
        'NGOs',
        'Sozialdienste',
      ],
    },
    enterprising: {
      name: 'Unternehmerisch',
      description:
        'Führt, überzeugt und trifft gerne Geschäftsentscheidungen.',
      characteristics: ['Ehrgeizig', 'Energisch', 'Dominant', 'Optimistisch'],
      workEnvironments: ['Unternehmen', 'Vertrieb', 'Politik', 'Startups'],
    },
    conventional: {
      name: 'Konventionell',
      description:
        'Bevorzugt geordnete Aktivitäten nach festgelegten Verfahren.',
      characteristics: ['Organisiert', 'Präzise', 'Effizient', 'Praktisch'],
      workEnvironments: [
        'Büros',
        'Banken',
        'Buchhaltung',
        'Verwaltung',
      ],
    },
  };

  constructor(private http: HttpClient) {
    this.appUrl = environment.apiUrl;
    this.apiUrl = 'api/vocational';
  }

  /**
   * ✅ HAUPTMETHODE: Nachricht mit Nachrichtenzähler senden
   */
  sendMessageWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    personalInfo?: any,
    assessmentAnswers?: any[],
    conversationHistory?: Array<{ role: 'user' | 'counselor'; message: string }>
  ): Observable<VocationalResponse> {
    const request: VocationalRequest = {
      vocationalData: this.defaultVocationalData,
      userMessage: userMessage.trim(),
      personalInfo,
      assessmentAnswers,
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Sende Berufsberatungsnachricht:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<VocationalResponse>(`${this.appUrl}${this.apiUrl}/counselor`, request)
      .pipe(
        timeout(60000),
        map((response: VocationalResponse) => {
          console.log('📥 Berufsberatungsantwort:', {
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
          console.error('Fehler bei Berufsberatungskommunikation:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as VocationalResponse);
        })
      );
  }

  /**
   * Legacy-Methode für Kompatibilität
   */
  sendMessage(
    userMessage: string,
    personalInfo?: any,
    assessmentAnswers?: any[],
    conversationHistory?: Array<{ role: 'user' | 'counselor'; message: string }>
  ): Observable<string> {
    const request: VocationalRequest = {
      vocationalData: this.defaultVocationalData,
      userMessage: userMessage.trim(),
      personalInfo,
      assessmentAnswers,
      conversationHistory,
      messageCount: 1,
      isPremiumUser: false,
    };

    return this.http
      .post<VocationalResponse>(`${this.appUrl}${this.apiUrl}/counselor`, request)
      .pipe(
        timeout(30000),
        map((response: VocationalResponse) => {
          if (response.success && response.response) {
            return response.response;
          }
          throw new Error(response.error || 'Ungültige Antwort vom Server');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Fehler bei Berufsberatungskommunikation:', error);
          return of(this.getErrorMessage(error));
        })
      );
  }

  /**
   * Assessment-Fragen abrufen
   */
  getAssessmentQuestions(): Observable<AssessmentQuestion[]> {
    return of(this.getDefaultQuestions());
  }

  /**
   * Assessment-Antworten analysieren
   */
  analyzeAssessment(answers: AssessmentAnswer[]): Observable<any> {
    const categoryCount: { [key: string]: number } = {};

    answers.forEach((answer) => {
      if (answer.category) {
        categoryCount[answer.category] =
          (categoryCount[answer.category] || 0) + 1;
      }
    });

    const total = answers.length;
    const distribution = Object.entries(categoryCount)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const dominantCategory = distribution[0]?.category || 'social';
    const dominantProfile =
      this.vocationalProfiles[dominantCategory] ||
      this.vocationalProfiles['social'];

    return of({
      profileDistribution: distribution,
      dominantProfile,
      recommendations: this.getRecommendations(dominantCategory),
    });
  }

  /**
   * Kategorie-Emoji abrufen
   */
  getCategoryEmoji(category: string): string {
    const emojis: { [key: string]: string } = {
      realistic: '🔧',
      investigative: '🔬',
      artistic: '🎨',
      social: '🤝',
      enterprising: '💼',
      conventional: '📊',
    };
    return emojis[category] || '⭐';
  }

  /**
   * Kategorie-Farbe abrufen
   */
  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      realistic: '#4CAF50',
      investigative: '#2196F3',
      artistic: '#9C27B0',
      social: '#FF9800',
      enterprising: '#F44336',
      conventional: '#607D8B',
    };
    return colors[category] || '#757575';
  }

  /**
   * Standardfragen abrufen
   */
  private getDefaultQuestions(): AssessmentQuestion[] {
    return [
      {
        id: 1,
        question:
          'Welche Art von Aktivität machst du am liebsten in deiner Freizeit?',
        options: [
          {
            value: 'a',
            label: 'Dinge bauen oder reparieren',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Lesen und neue Themen erforschen',
            category: 'investigative',
          },
          { value: 'c', label: 'Kunst oder Musik schaffen', category: 'artistic' },
          { value: 'd', label: 'Anderen Menschen helfen', category: 'social' },
          {
            value: 'e',
            label: 'Veranstaltungen organisieren oder Gruppen leiten',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Informationen ordnen und klassifizieren',
            category: 'conventional',
          },
        ],
      },
      {
        id: 2,
        question:
          'In welcher Art von Arbeitsumgebung würdest du dich am wohlsten fühlen?',
        options: [
          {
            value: 'a',
            label: 'Im Freien oder in einer Werkstatt',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'In einem Labor oder Forschungszentrum',
            category: 'investigative',
          },
          { value: 'c', label: 'In einem kreativen Studio', category: 'artistic' },
          {
            value: 'd',
            label: 'In einer Schule oder einem Krankenhaus',
            category: 'social',
          },
          {
            value: 'e',
            label: 'In einem Unternehmen oder Startup',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'In einem gut organisierten Büro',
            category: 'conventional',
          },
        ],
      },
      {
        id: 3,
        question: 'Welche dieser Fähigkeiten beschreibt dich am besten?',
        options: [
          {
            value: 'a',
            label: 'Handwerkliche und technische Fähigkeiten',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Analytisches Denken',
            category: 'investigative',
          },
          {
            value: 'c',
            label: 'Kreativität und Vorstellungskraft',
            category: 'artistic',
          },
          { value: 'd', label: 'Empathie und Kommunikation', category: 'social' },
          {
            value: 'e',
            label: 'Führung und Überzeugungskraft',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Organisation und Präzision',
            category: 'conventional',
          },
        ],
      },
      {
        id: 4,
        question: 'Welche Art von Problem würdest du am liebsten lösen?',
        options: [
          {
            value: 'a',
            label: 'Eine defekte Maschine reparieren',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Herausfinden, warum etwas auf eine bestimmte Weise funktioniert',
            category: 'investigative',
          },
          {
            value: 'c',
            label: 'Etwas Neues und Originelles entwerfen',
            category: 'artistic',
          },
          {
            value: 'd',
            label: 'Jemandem bei einem persönlichen Problem helfen',
            category: 'social',
          },
          {
            value: 'e',
            label: 'Eine Geschäftsmöglichkeit finden',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Einen bestehenden Prozess optimieren',
            category: 'conventional',
          },
        ],
      },
      {
        id: 5,
        question: 'Welches Schulfach hat dir am meisten gefallen?',
        options: [
          {
            value: 'a',
            label: 'Sport oder Technik',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Naturwissenschaften oder Mathematik',
            category: 'investigative',
          },
          { value: 'c', label: 'Kunst oder Musik', category: 'artistic' },
          {
            value: 'd',
            label: 'Sozialwissenschaften oder Sprachen',
            category: 'social',
          },
          { value: 'e', label: 'Wirtschaft oder Debatte', category: 'enterprising' },
          {
            value: 'f',
            label: 'Informatik oder Buchhaltung',
            category: 'conventional',
          },
        ],
      },
    ];
  }

  /**
   * Empfehlungen nach Kategorie abrufen
   */
  private getRecommendations(category: string): string[] {
    const recommendations: { [key: string]: string[] } = {
      realistic: [
        'Maschinenbau oder Bauingenieurwesen',
        'Wartungstechniker',
        'Tischlerei oder Elektrik',
        'Landwirtschaft oder Tiermedizin',
      ],
      investigative: [
        'Naturwissenschaften oder Medizin',
        'Wissenschaftliche Forschung',
        'Datenanalyse',
        'Programmierung und Softwareentwicklung',
      ],
      artistic: [
        'Grafik- oder Industriedesign',
        'Bildende Kunst oder Musik',
        'Architektur',
        'Audiovisuelle Produktion',
      ],
      social: [
        'Psychologie oder Sozialarbeit',
        'Pädagogik oder Erziehung',
        'Krankenpflege oder Medizin',
        'Personalwesen',
      ],
      enterprising: [
        'Betriebswirtschaft',
        'Marketing und Vertrieb',
        'Jura',
        'Unternehmertum',
      ],
      conventional: [
        'Buchhaltung und Finanzen',
        'Öffentliche Verwaltung',
        'Assistenz der Geschäftsführung',
        'Logistik und Operations',
      ],
    };
    return recommendations[category] || recommendations['social'];
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
      return 'Keine Verbindung zur Berufsberaterin möglich. Versuch es in ein paar Minuten nochmal.';
    }

    return 'Entschuldigung, ich habe gerade technische Schwierigkeiten. Bitte versuch es später nochmal.';
  }
}