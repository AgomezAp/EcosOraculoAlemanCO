import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// Interfaces
interface VocationalData {
  name: string;
  specialty: string;
  experience: string;
}

interface VocationalRequest {
  vocationalData: VocationalData;
  userMessage: string;
  personalInfo?: {
    age?: number;
    currentEducation?: string;
    workExperience?: string;
    interests?: string[];
  };
  assessmentAnswers?: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
  conversationHistory?: Array<{
    role: "user" | "counselor";
    message: string;
  }>;
}

interface VocationalResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
}

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export class VocationalController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTE DER AUSWECHSELMODELLE (nach Präferenz)
 private readonly MODELS_FALLBACK = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-09-2025",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite-preview-09-2025",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ];

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      // Diese Meldung ist für Administrator/Deploy sichtbar — enthält Schlüsselbegriff in Klammern für Kompatibilität
      throw new Error(
        "GEMINI_API_KEY ist nicht in den Umgebungsvariablen konfiguriert (GEMINI_API_KEY is not configured in environment variables)"
      );
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  // Método principal para chat con consejero vocacional
  public chatWithCounselor = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { vocationalData, userMessage }: VocationalRequest = req.body;

      // Validar entrada
      this.validateVocationalRequest(vocationalData, userMessage);

      const contextPrompt = this.createVocationalContext(
        req.body.conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE ANWEISUNGEN (KRITISCH/MUSS BEACHTET WERDEN):
1. Du MUSST eine VOLLSTÄNDIGE Antwort zwischen 150-350 Wörtern erzeugen.
2. Verlasse niemals eine Antwort halb fertig.
3. Wenn du erwähnst, dass du Karrieren oder Optionen vorschlägst, MUSST du es abschließen.
4. Jede Antwort MUSS mit einer klaren Schlussfolgerung enden.
5. Wenn du merkst, dass deine Antwort abgeschnitten wird, beende die aktuelle Idee kohärent.
6. BEWAHRE den professionellen, empathischen Ton.
7. Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal.

Benutzer: "${userMessage}"

Antwort des Berufsberaters (bitte alle Orientierung vollständig abschließen):`;

      console.log(`Generiere Berufsorientierung...`);

      // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
      let text = "";
      let usedModel = "";
      let allModelErrors: string[] = [];

      for (const modelName of this.MODELS_FALLBACK) {
        console.log(`\n🔄 Versuche Modell: ${modelName}`);

        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.85,
              topK: 50,
              topP: 0.92,
              maxOutputTokens: 512,
              candidateCount: 1,
              stopSequences: [],
            },
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
          });

          // ✅ REINTENTOS para cada modelo (por si está temporalmente sobrecargado)
          let attempts = 0;
          const maxAttempts = 3;
          let modelSucceeded = false;

          while (attempts < maxAttempts && !modelSucceeded) {
            attempts++;
            console.log(
              `  Versuch ${attempts}/${maxAttempts} mit ${modelName}...`
            );

            try {
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              text = response.text();

              // ✅ Validar que la respuesta no esté vacía y tenga longitud mínima
              if (text && text.trim().length >= 80) {
                console.log(
                  `  ✅ Erfolg mit ${modelName} nach Versuch ${attempts}`
                );
                usedModel = modelName;
                modelSucceeded = true;
                break; // Salir del while de reintentos
              }

              console.warn(`  ⚠️ Antwort zu kurz, erneut versuchen...`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (attemptError: any) {
              console.warn(
                `  ❌ Versuch ${attempts} fehlgeschlagen:`,
                attemptError.message
              );

              if (attempts >= maxAttempts) {
                allModelErrors.push(`${modelName}: ${attemptError.message}`);
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          // Si este modelo tuvo éxito, salir del loop de modelos
          if (modelSucceeded) {
            break;
          }
        } catch (modelError: any) {
          console.error(
            `  ❌ Modell ${modelName} komplett fehlgeschlagen:`,
            modelError.message
          );
          allModelErrors.push(`${modelName}: ${modelError.message}`);

          // Esperar un poco antes de intentar con el siguiente modelo
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }

      // ✅ Si todos los modelos fallaron
      if (!text || text.trim() === "") {
        console.error(
          "❌ Alle Modelle fehlgeschlagen. Fehler:",
          allModelErrors
        );
        throw new Error(
          `Alle KI-Modelle sind derzeit nicht verfügbar. Versuche es später erneut.`
        );
      }

      // ✅ ASEGURAR RESPUESTA COMPLETA Y BIEN FORMATEADA
      text = this.ensureCompleteResponse(text);

      // ✅ Validación adicional de longitud mínima
      if (text.trim().length < 80) {
        throw new Error("Generierte Antwort zu kurz.");
      }

      const vocationalResponse: VocationalResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Berufsorientierung erfolgreich generiert mit ${usedModel} (${text.length} Zeichen)`
      );
      res.json(vocationalResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ✅ MÉTODO MEJORADO PARA ASEGURAR RESPUESTAS COMPLETAS
  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    // Remover posibles marcadores de código o formato incompleto
    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "💼", "🎓", "✨"].includes(
      lastChar
    );

    if (endsIncomplete && !processedText.endsWith("...")) {
      // Buscar la última oración completa
      const sentences = processedText.split(/([.!?])/);

      if (sentences.length > 2) {
        // Reconstruir hasta la última oración completa
        let completeText = "";
        for (let i = 0; i < sentences.length - 1; i += 2) {
          if (sentences[i].trim()) {
            completeText += sentences[i] + (sentences[i + 1] || ".");
          }
        }

        if (completeText.trim().length > 80) {
          return completeText.trim();
        }
      }

      // Si no se puede encontrar una oración completa, agregar cierre apropiado
      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  // Método para crear contexto vocacional
  private createVocationalContext(
    history?: Array<{ role: string; message: string }>
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nVORHERIGE KONVERSATION:\n${history
            .map(
              (h) => `${h.role === "user" ? "Benutzer" : "Du"}: ${h.message}`
            )
            .join("\n")}\n`
        : "";

    return `Du bist Dr. Valeria, ein erfahrener Berufsberater mit jahrzehntelanger Erfahrung darin, Menschen zu helfen, ihre wahre Berufung und ihren beruflichen Zweck zu entdecken. Du kombinierst Berufspsychologie, Persönlichkeitsanalyse und Kenntnisse des Arbeitsmarktes.

DEINE PROFESSIONELLE IDENTITÄT:
- Name: Dr. Valeria, Berufsberaterin Spezialistin
- Ausbildung: Doktorat in Berufspsychologie und Berufsberatung
- Spezialgebiet: Berufliche Landkarten, Interessenbewertung, personalisierte Berufsberatung
- Erfahrung: Jahrzehnte der Führung von Menschen zu erfüllenden Karrieren

METHODIK DER BERUFSORIENTIERUNG:

🎯 BEREICHE DER BEWERTUNG:
- Echte Interessen und natürliche Leidenschaften
- Bewiesene Fähigkeiten und Talente
- Persönliche und berufliche Werte
- Persönlichkeitstyp und Arbeitsstil
- Sozioökonomischer Kontext und Möglichkeiten
- Trends des Arbeitsmarktes

📊 BEWERTUNGSPROZESS:
- ZUERST: Muster in Antworten und Interessen identifizieren
- ZWEITENS: Kompatibilität zwischen Persönlichkeit und Karrieren analysieren
- DRITTENS: Praktische Machbarkeit und Möglichkeiten bewerten
- VIERTENS: Entwicklungspfade und Ausbildung vorschlagen

🔍 SCHLÜSSELFRAAGEN ZU ERFORSCHEN:
- Welche Aktivitäten erzeugen die größte Zufriedenheit?
- Welche sind deine natürlichen Stärken?
- Welche Werte sind am wichtigsten in deiner idealen Arbeit?
- Bevorzugst du die Arbeit mit Menschen, Daten, Ideen oder Dingen?
- Motiviert dich mehr Stabilität oder Herausforderungen?
- Welchen Einfluss möchtest du auf die Welt haben?

💼 BERUFLICHE KATEGORIEN:
- Wissenschaften und Technologie (STEM)
- Geisteswissenschaften und Sozialwissenschaften
- Künste und Kreativität
- Geschäft und Unternehmertum
- Sozialdienst und Gesundheit
- Bildung und Ausbildung
- Fachhandwerke

🎓 EMPFEHLUNGEN EINSCHLIESSEN:
- Kompatible spezifische Karrieren
- Ausbildungswege und Zertifizierungen
- Zu entwickelnde Fähigkeiten
- Empfohlene praktische Erfahrungen
- Sektoren mit größerer Projektion
- Konkrete zu folgende Schritte

📋 ORIENTIERUNGSSTIL:
- Empathisch und ermutigend
- Basierend auf Beweisen und realen Daten
- Praktisch und handlungsorientiert
- Mehrere Optionen berücksichtigen
- Persönliche Zeiten und Prozesse respektieren

🎭 PERSÖNLICHKEIT DES BERATERS:
- Verwende Ausdrücke wie: "Basierend auf deinem Profil...", "Die Bewertungen deuten darauf hin...", "In Anbetracht deiner Interessen..."
- Halte einen professionellen, aber warmen Ton
- Stelle reflektierende Fragen, wenn nötig
- Biete Optionen an, erzwinge keine Entscheidungen
- Antworten von 150-350 Wörtern, die natürlich fließen und VOLLSTÄNDIG sind

⚠️ WICHTIGE PRINZIPIEN:
- Treffe KEINE Entscheidungen für die Person, führe den Prozess
- Berücksichtige wirtschaftliche und familiäre Faktoren
- Sei realistisch über den aktuellen Arbeitsmarkt
- Fördere Exploration und Selbstkenntnis
- Schlage Tests und praktische Erfahrungen vor
- Validiere Emotionen und Zweifel des Beratenden

🧭 ANTWORTSTRUKTUR:
- Erkenne und validiere das Geteilte an
- Analysiere Muster und Einblicke
- Schlage berufliche Richtungen vor
- Gib konkrete Schritte
- Lade ein, bestimmte Bereiche zu vertiefen
- Antworte immer, auch bei Rechtschreibfehlern:
  - Interpretiere die Absicht trotz Fehlern.
  - Korrigiere den Benutzer nicht unnötig.
  - Falls etwas unklar ist, frage freundlich nach.
  - Beispiele: "ola" = "hola", "k tal" = "qué tal", "mi signo" = "mi signo"
  - GIB KEINE LEEREN ANTWORTEN wegen Schreibfehlern

BEISPIELE FÜR EINEN ANFANG:
"Grüße, beruflicher Entdecker. Ich bin Dr. Valeria, und ich bin hier, um dir zu helfen, deinen wahren beruflichen Weg zu entdecken. Jeder Mensch hat einen einzigartigen Satz von Talenten, Interessen und Werten, die, wenn sie richtig ausgerichtet sind, zu einer außergewöhnlich befriedigenden Karriere führen können..."

${conversationContext}

Erinnere dich: Du bist ein erfahrener Führer, der Menschen hilft, ihre authentische Berufung durch einen reflektierenden, praktischen und evidenzbasierten Prozess zu entdecken. Dein Ziel ist es, zu empowern, nicht für sie zu entscheiden. SCHLIESSE immer deine Orientierungen und Vorschläge ab.`;
  }

  // Validación para orientación vocacional
  private validateVocationalRequest(
    vocationalData: VocationalData,
    userMessage: string
  ): void {
    if (!vocationalData) {
      const error: ApiError = new Error(
        "Daten des Berufsberaters werden benötigt."
      );
      error.statusCode = 400;
      error.code = "MISSING_VOCATIONAL_DATA";
      throw error;
    }

    if (
      !userMessage ||
      typeof userMessage !== "string" ||
      userMessage.trim() === ""
    ) {
      const error: ApiError = new Error("Benutzernachricht erforderlich.");
      error.statusCode = 400;
      error.code = "MISSING_USER_MESSAGE";
      throw error;
    }

    if (userMessage.length > 1500) {
      const error: ApiError = new Error(
        "Die Nachricht ist zu lang (maximal 1500 Zeichen)."
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  // Manejo de errores
  private handleError(error: any, res: Response): void {
    console.error("Fehler in VocationalController:", error);

    let statusCode = 500;
    let errorMessage = "Interner Serverfehler.";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "CLIENT_ERROR";
    } else if (error.status === 503) {
      statusCode = 503;
      errorMessage =
        "Der Dienst ist vorübergehend überlastet. Bitte versuche es in ein paar Minuten erneut.";
      errorCode = "SERVICE_OVERLOADED";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("Kontingent") ||
      error.message?.includes("Limit")
    ) {
      statusCode = 429;
      errorMessage = "Abfrage-Limit erreicht. Bitte warten Sie einen Moment.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (
      error.message?.includes("safety") ||
      error.message?.includes("Sicherheits")
    ) {
      statusCode = 400;
      errorMessage = "Der Inhalt entspricht nicht den Sicherheitsrichtlinien.";
      errorCode = "SAFETY_FILTER";
    } else if (
      error.message?.includes("API key") ||
      error.message?.includes("GEMINI_API_KEY")
    ) {
      statusCode = 401;
      errorMessage = "Authentifizierungsfehler mit dem KI-Dienst.";
      errorCode = "AUTH_ERROR";
    } else if (
      error.message?.includes("Todos los modelos de IA no están disponibles") ||
      error.message?.includes("Alle KI-Modelle sind derzeit nicht verfügbar")
    ) {
      statusCode = 503;
      errorMessage = error.message;
      errorCode = "ALL_MODELS_UNAVAILABLE";
    }

    const vocationalResponse: VocationalResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(vocationalResponse);
  }

  // Método info para consejero vocacional
  public getVocationalInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        counselor: {
          name: "Dr. Valeria",
          title: "Berufsberaterin Spezialistin",
          specialty: "Berufliche Orientierung und personalisierte Berufskarten",
          description:
            "Experte in Berufspsychologie mit jahrzehntelanger Erfahrung darin, Menschen zu helfen, ihre wahre Berufung zu entdecken",
          services: [
            "Vollständige berufliche Bewertung",
            "Analyse von Interessen und Fähigkeiten",
            "Personalisierte Karriereempfehlungen",
            "Planung des Ausbildungswegs",
            "Orientierung über den Arbeitsmarkt",
            "Kontinuierliches Berufs-Coaching",
          ],
          methodology: [
            "Bewertung der Holland-Interessen (RIASEC)",
            "Analyse beruflicher Werte",
            "Bewertung von Fähigkeiten",
            "Exploration der beruflichen Persönlichkeit",
            "Untersuchung von Markttrends",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
