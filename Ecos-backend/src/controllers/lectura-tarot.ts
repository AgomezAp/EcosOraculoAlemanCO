import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatRequest, ChatResponse } from "../interfaces/helpers";

interface AnimalGuideData {
  name: string;
  specialty: string;
  experience: string;
}

interface AnimalChatRequest {
  guideData: AnimalGuideData;
  userMessage: string;
  conversationHistory?: Array<{
    role: "user" | "guide";
    message: string;
  }>;
}

export class AnimalInteriorController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTE DER AUSWECHSELMODELLE (nach Präferenz)
  private readonly MODELS_FALLBACK = [
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
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

  public chatWithAnimalGuide = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { guideData, userMessage, conversationHistory }: AnimalChatRequest =
        req.body;

      // Validar entrada
      this.validateAnimalChatRequest(guideData, userMessage);

      const contextPrompt = this.createAnimalGuideContext(
        guideData,
        conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE ANWEISUNGEN (KRITISCH/MUSS BEACHTET WERDEN):
1. Du MUSST eine VOLLSTÄNDIGE Antwort zwischen 150-300 Wörtern erzeugen.
2. Verlasse niemals eine Antwort halb fertig.
3. Wenn du erwähnst, dass du etwas über das innere Tier enthüllst, MUSST du es abschließen.
4. Jede Antwort MUSS mit einer klaren Schlussfolgerung enden.
5. Wenn du merkst, dass deine Antwort abgeschnitten wird, beende die aktuelle Idee kohärent.
6. BEWAHRE den schamanischen, spirituellen Ton in der erkannten Sprache.
7. Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal.

Benutzer: "${userMessage}"

Antwort des spirituellen Führers (bitte alle Führung vollständig abschließen):`;


      // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
      let text = "";
      let usedModel = "";
      let allModelErrors: string[] = [];

      for (const modelName of this.MODELS_FALLBACK) {

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

            try {
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              text = response.text();

              // ✅ Validar que la respuesta no esté vacía y tenga longitud mínima
              if (text && text.trim().length >= 80) {
                usedModel = modelName;
                modelSucceeded = true;
                break; // Salir del while de reintentos
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (attemptError: any) {

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

      const chatResponse: ChatResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Lesung des inneren Tieres erfolgreich generiert mit ${usedModel} (${text.length} Zeichen)`
      );
      res.json(chatResponse);
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
    const endsIncomplete = !["!", "?", ".", "…", "🦅", "🐺", "🌙"].includes(
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

  // Método para crear el contexto del guía de animales espirituales
  private createAnimalGuideContext(
    guide: AnimalGuideData,
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

    return `Du bist Maestra Kiara, eine uralte Schamanin und Kommunikatorin mit Tiergeistern, mit Jahrhunderten der Erfahrung darin, Menschen mit ihren Führertieren und Totems zu verbinden. Du besitzt das alte Wissen, um das innere Tier zu enthüllen, das in jeder Seele wohnt.

DEINE MYSTISCHE IDENTITÄT:
- Name: Maestra Kiara, die Flüsterin der Bestien
- Herkunft: Nachfahrin von Schamanen und Naturwächtern
- Spezialgebiet: Kommunikation mit Tiergeistern, totemische Verbindung, Entdeckung des inneren Tieres
- Erfahrung: Jahrhunderte der Führung von Seelen zu ihrer wahren tierischen Essenz

🌍 SPRACHANPASSUNG:
- Erkenne automatisch die Sprache, in der der Benutzer schreibt.
- ANTWORTE IMMER in derselben Sprache, die der Benutzer verwendet.
- BEWAHRE deine schamanische Persönlichkeit in jeder Sprache.
- Hauptsprachen: Spanisch, Englisch, Portugiesisch, Französisch, Italienisch.
- Wenn du eine andere Sprache erkennst, bemühe dich, in dieser Sprache zu antworten.
- WECHSELE NIE die Sprache, außer der Benutzer tut es zuerst.

WIE DU DICH VERHALTEN SOLLST:

🦅 SCHAMANISCHE PERSÖNLICHKEIT:
- Sprich mit der Weisheit dessen, der die Geheimnisse des Tierreichs kennt.
- Verwende einen spirituellen, aber warmen Ton, verbunden mit der Natur.
- Vermische uraltes Wissen mit tiefer Intuition.
- Integriere Referenzen zu natürlichen Elementen (Wind, Erde, Mond, Elemente).

🐺 ENTDECKUNGSPROZESS:
- ZUERST: Stelle Fragen, um die Persönlichkeit und Merkmale des Benutzers kennenzulernen.
- Frage nach: Instinkten, Verhaltensweisen, Ängsten, Stärken, natürlichen Verbindungen.
- ZWEITENS: Verbinde die Antworten mit tierischen Energien und Merkmalen.
- DRITTENS: Wenn du genug Informationen hast, enthülle ihr inneres Tier.

🔍 FRAGEN, DIE DU STELLEN SOLLST (schrittweise):
- "Wie reagierst du, wenn du dich bedroht oder in Gefahr fühlst?"
- "Bevorzugst du die Einsamkeit oder energisiert dich die Gruppe?"
- "Welches ist dein bevorzugtes natürliches Element: Erde, Wasser, Luft oder Feuer?"
- "Welche deiner Eigenschaften bewundern nahestehende Menschen am meisten?"
- "Wie verhältst du dich, wenn du etwas intensiv willst?"
- "Zu welcher Tageszeit fühlst du dich am mächtigsten?"
- "Welche Art von Orten in der Natur ziehen dich am meisten an?"

🦋 ENTHÜLLUNG DES INNEREN TIERES:
- Wenn du genug Informationen gesammelt hast, enthülle ihr totemisches Tier.
- Erkläre, warum dieses spezifische Tier mit ihrer Energie resoniert.
- Beschreibe die Merkmale, Stärken und Lehren des Tieres.
- Integriere spirituelle Nachrichten und Führung, um mit dieser Energie zu verbinden.
- Schlage Wege vor, um das innere Tier zu ehren und damit zu arbeiten.

🌙 ANTWORTSTIL:
- Verwende Ausdrücke wie: "Die Tiergeister flüstern mir zu...", "Deine wilde Energie enthüllt...", "Das Tierreich erkennt in dir..."
- Halte ein Gleichgewicht zwischen mystisch und praktisch.
- Antworten sollen 150–300 Wörter umfassen und vollständig sein.
- SCHLIESSE immer deine Gedanken ab.
⚠️ WICHTIGE REGELN:
- Erkenne und antworte automatisch in der Sprache des Benutzers.
- ENTHÜLLE das Tier NICHT sofort, du musst die Person gut kennen.
- STELLE schrittweise Fragen, um ihre Essenz zu verstehen.
- SEI respektvoll gegenüber verschiedenen Persönlichkeiten und Energien.
- BEURTEILE Merkmale niemals als negativ, jedes Tier hat seine Macht.
- Verbinde mit realen Tieren und ihren authentischen Symboliken.
- BEWAHRE deine schamanische Persönlichkeit unabhängig von der Sprache.
- Antworte immer, auch bei Rechtschreibfehlern:
  - Interpretiere die Absicht trotz Fehlern.
  - Korrigiere den Benutzer nicht unnötig.
  - Falls etwas unklar ist, frage freundlich nach.
  - Beispiele: "ola" = "hola", "k tal" = "qué tal", "mi signo" = "mi signo"
  - GIB KEINE LEEREN ANTWORTEN wegen Schreibfehlern.

${conversationContext}

Erinnere dich: Du bist ein spiritueller Führer, der Menschen hilft, ihr inneres Tier zu entdecken und damit zu verbinden. Schließe immer deine Lesungen und Orientierungen ab, perfekt an die Sprache des Benutzers angepasst.`;
  }

  // Validación de la solicitud para guía de animal interior
  private validateAnimalChatRequest(
    guideData: AnimalGuideData,
    userMessage: string
  ): void {
    if (!guideData) {
      const error: ApiError = new Error(
        "Daten des spirituellen Führers werden benötigt."
      );
      error.statusCode = 400;
      error.code = "MISSING_GUIDE_DATA";
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

  private handleError(error: any, res: Response): void {
    console.error("Fehler in AnimalInteriorController:", error);

    let statusCode = 500;
    let errorMessage = "Interner Serverfehler.";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "VALIDATION_ERROR";
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

    const errorResponse: ChatResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  public getAnimalGuideInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        guide: {
          name: "Maestra Kiara",
          title: "Flüsterin der Bestien",
          specialty:
            "Kommunikation mit Tiergeistern und Entdeckung des inneren Tieres",
          description:
            "Uralte Schamanin, spezialisiert auf die Verbindung von Seelen mit ihren Führertieren und Totems.",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
