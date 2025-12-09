import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";

interface ZodiacData {
  name: string;
  specialty: string;
  experience: string;
}

interface ZodiacRequest {
  zodiacData: ZodiacData;
  userMessage: string;
  birthDate?: string;
  zodiacSign?: string;
  conversationHistory?: Array<{
    role: "user" | "astrologer";
    message: string;
  }>;
}

export class ZodiacController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
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
      throw new Error(
        "GEMINI_API_KEY ist nicht in den Umgebungsvariablen konfiguriert"
      );
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  public chatWithAstrologer = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        zodiacData,
        userMessage,
        birthDate,
        zodiacSign,
        conversationHistory,
      }: ZodiacRequest = req.body;

      // Validar entrada
      this.validateZodiacRequest(zodiacData, userMessage);

      const contextPrompt = this.createZodiacContext(
        zodiacData,
        birthDate,
        zodiacSign,
        conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ KRITISCHE VERPFLICHTENDE ANWEISUNGEN:
1. DU MUSST eine VOLLE Antwort zwischen 200-500 Wörtern generieren
2. LASS niemals eine Antwort unvollständig oder unvollendet
3. Wenn du Merkmale des Zeichens erwähnst, MUSST du die Beschreibung abschließen
4. Jede Antwort MUSS mit einer klaren Schlussfolgerung und einem Punkt enden
5. Wenn du bemerkst, dass deine Antwort abgeschnitten wird, beende die aktuelle Idee kohärent
6. HALTE immer den astrologischen Ton freundlich und zugänglich
7. Wenn die Nachricht Rechtschreibfehler hat, interpretiere die Absicht und antworte normal

Benutzer: "${userMessage}"

Antwort der Astrologin (stelle sicher, dass du deine gesamte astrologische Analyse abschließt, bevor du endest):`;

      console.log(`Generando lectura zodiacal...`);

      // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
      let text = "";
      let usedModel = "";
      let allModelErrors: string[] = [];

      for (const modelName of this.MODELS_FALLBACK) {
        console.log(`\n🔄 Trying model: ${modelName}`);

        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.85,
              topK: 50,
              topP: 0.92,
              maxOutputTokens: 600,
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
              `  Attempt ${attempts}/${maxAttempts} with ${modelName}...`
            );

            try {
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              text = response.text();

              // ✅ Validar que la respuesta no esté vacía y tenga longitud mínima
              if (text && text.trim().length >= 100) {
                console.log(
                  `  ✅ Success with ${modelName} on attempt ${attempts}`
                );
                usedModel = modelName;
                modelSucceeded = true;
                break; // Salir del while de reintentos
              }

              console.warn(`  ⚠️ Response too short, retrying...`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (attemptError: any) {
              console.warn(
                `  ❌ Attempt ${attempts} failed:`,
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
            `  ❌ Model ${modelName} failed completely:`,
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
        console.error("❌ All models failed. Errors:", allModelErrors);
        throw new Error(
          `Alle KI-Modelle sind derzeit nicht verfügbar. Versucht: ${this.MODELS_FALLBACK.join(
            ", "
          )}. Bitte versuche es in einem Moment erneut.`
        );
      }

      // ✅ ASEGURAR RESPUESTA COMPLETA Y BIEN FORMATEADA
      text = this.ensureCompleteResponse(text);

      // ✅ Validación adicional de longitud mínima
      if (text.trim().length < 100) {
        throw new Error("Generierte Antwort zu kurz");
      }

      const chatResponse: ChatResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Lectura zodiacal generada exitosamente con ${usedModel} (${text.length} caracteres)`
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
    const endsIncomplete = ![
      "!",
      "?",
      ".",
      "…",
      "✨",
      "🌟",
      "♈",
      "♉",
      "♊",
      "♋",
      "♌",
      "♍",
      "♎",
      "♏",
      "♐",
      "♑",
      "♒",
      "♓",
    ].includes(lastChar);

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

        if (completeText.trim().length > 100) {
          return completeText.trim();
        }
      }

      // Si no se puede encontrar una oración completa, agregar cierre apropiado
      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  private createZodiacContext(
    zodiacData: ZodiacData,
    birthDate?: string,
    zodiacSign?: string,
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

    let zodiacInfo = "";
    if (birthDate) {
      const calculatedSign = this.calculateZodiacSign(birthDate);
      zodiacInfo = `\nBerechnetes Tierkreiszeichen: ${calculatedSign}`;
    } else if (zodiacSign) {
      zodiacInfo = `\nBereitgestelltes Tierkreiszeichen: ${zodiacSign}`;
    }

    return `Du bist Meisterin Luna, eine erfahrene Astrologin in Tierkreiszeichen mit jahrzehntelanger Erfahrung in der Interpretation himmlischer Energien und ihrem Einfluss auf die menschliche Persönlichkeit.

DEINE IDENTITÄT:
- Name: Meisterin Luna, die Interpretin der Sterne
- Spezialität: Tierkreiszeichen, Persönlichkeitsmerkmale, astrologische Kompatibilitäten
- Erfahrung: Jahrzehnte des Studiums und der Interpretation des Einflusses der Tierkreiszeichen
${zodiacInfo}

WIE DU DICH VERHALTEN SOLLST:

🌟 ASTROLOGISCHE PERSÖNLICHKEIT:
- Sprich mit tiefem Wissen, aber zugänglich und freundlich
- Verwende einen warmen und enthusiastischen Ton über Tierkreiszeichen
- Kombiniere traditionelle Merkmale mit modernen Interpretationen
- Erwähne Elemente (Feuer, Erde, Luft, Wasser) und Modalitäten (Kardinal, Fest, Veränderlich)

♈ TIERKREISZEICHEN-ANALYSE:
- Beschreibe positive Persönlichkeitsmerkmale und Wachstumsbereiche
- Erkläre natürliche Stärken und Herausforderungen des Zeichens
- Erwähne Kompatibilitäten mit anderen Zeichen
- Schließe praktische Ratschläge basierend auf Zeichenmerkmalen ein
- Sprich über den regierenden Planeten und seinen Einfluss

🎯 ANTWORTSTRUKTUR:
- Hauptmerkmale des Zeichens
- Stärken und natürliche Talente
- Entwicklungsbereiche und Wachstum
- Astrologische Kompatibilitäten
- Personalisierte Ratschläge

🎭 ANTWORTSTIL:
- Verwende Ausdrücke wie: "Die Geborenen von [Zeichen]...", "Dein Zeichen verleiht dir...", "Als [Zeichen] besitzt du..."
- Halte Balance zwischen mystisch und praktisch
- Vollständige Antworten von 200-500 Wörtern
- BEENDE immer deine Interpretationen vollständig
- LASS niemals Zeichenmerkmale unvollständig

⚠️ WICHTIGE REGELN:
- WENN du das Tierkreiszeichen nicht hast, frage nach dem Geburtsdatum
- Erkläre, warum du diese Daten brauchst
- MACHE keine Interpretationen ohne das Zeichen zu kennen
- SEI positiv aber realistisch in deinen Beschreibungen
- MACHE niemals absolute Vorhersagen

🗣️ UMGANG MIT FEHLENDEN DATEN:
- Ohne Zeichen/Datum: "Um dir eine präzise Lesung zu geben, muss ich dein Tierkreiszeichen oder Geburtsdatum kennen. Wann bist du geboren?"
- Mit Zeichen: Fahre mit vollständiger Zeichenanalyse fort
- Allgemeine Fragen: Antworte mit bildender astrologischer Information

💫 BEISPIELE FÜR AUSDRÜCKE:
- "Die [Zeichen] sind bekannt für..."
- "Dein Zeichen des [Elements] verleiht dir..."
- "Als [Modalität] neigst du zu..."
- "Dein regierender Planet [Planet] beeinflusst..."
- ANTWORTE immer, unabhängig davon, ob der Benutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht des Benutzers, auch wenn sie falsch geschrieben ist
  - Korrigiere die Fehler des Benutzers nicht, verstehe einfach die Absicht
  - Wenn du etwas Spezifisches nicht verstehst, frage freundlich nach
  - GIB niemals leere Antworten wegen Rechtschreibfehlern

${conversationContext}

Erinnere dich: Du bist eine Expertin in Tierkreiszeichen, die astrologische Merkmale verständlich und nützlich interpretiert. FRAGE immer nach dem Zeichen oder Geburtsdatum, wenn du sie nicht hast. SCHLIESSE immer deine Interpretationen ab - lasse niemals astrologische Analysen unvollständig.`;
  }

  private calculateZodiacSign(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return "Widder ♈";
      if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return "Stier ♉";
      if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return "Zwillinge ♊";
      if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return "Krebs ♋";
      if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return "Löwe ♌";
      if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return "Jungfrau ♍";
      if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return "Waage ♎";
      if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return "Skorpion ♏";
      if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return "Schütze ♐";
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return "Steinbock ♑";
      if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return "Wassermann ♒";
      if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return "Fische ♓";

      return "Ungültiges Datum";
    } catch {
      return "Fehler bei Berechnung";
    }
  }

  private validateZodiacRequest(
    zodiacData: ZodiacData,
    userMessage: string
  ): void {
    if (!zodiacData) {
      const error: ApiError = new Error("Astrologendaten erforderlich");
      error.statusCode = 400;
      error.code = "MISSING_ZODIAC_DATA";
      throw error;
    }

    if (
      !userMessage ||
      typeof userMessage !== "string" ||
      userMessage.trim() === ""
    ) {
      const error: ApiError = new Error("Benutzernachricht erforderlich");
      error.statusCode = 400;
      error.code = "MISSING_USER_MESSAGE";
      throw error;
    }

    if (userMessage.length > 1500) {
      const error: ApiError = new Error(
        "Die Nachricht ist zu lang (maximal 1500 Zeichen)"
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  private handleError(error: any, res: Response): void {
    console.error("❌ Error en ZodiacController:", error);

    let statusCode = 500;
    let errorMessage = "Interner Serverfehler";
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
      error.message?.includes("limit")
    ) {
      statusCode = 429;
      errorMessage =
        "Das Abfragelimit wurde erreicht. Bitte warte einen Moment.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (error.message?.includes("safety")) {
      statusCode = 400;
      errorMessage = "Der Inhalt entspricht nicht den Sicherheitsrichtlinien.";
      errorCode = "SAFETY_FILTER";
    } else if (error.message?.includes("API key")) {
      statusCode = 401;
      errorMessage = "Authentifizierungsfehler mit dem KI-Dienst.";
      errorCode = "AUTH_ERROR";
    } else if (error.message?.includes("Respuesta vacía")) {
      statusCode = 503;
      errorMessage =
        "Der Dienst konnte keine Antwort generieren. Bitte versuche es erneut.";
      errorCode = "EMPTY_RESPONSE";
    } else if (
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

  public getZodiacInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        astrologer: {
          name: "Meisterin Luna",
          title: "Interpretin der Sterne",
          specialty: "Tierkreiszeichen und astrologische Analyse",
          description:
            "Expertin in der Interpretation der Merkmale und Energien der zwölf Tierkreiszeichen",
          services: [
            "Analyse der Merkmale des Tierkreiszeichens",
            "Interpretation von Stärken und Herausforderungen",
            "Astrologische Kompatibilitäten",
            "Ratschläge basierend auf deinem Zeichen",
            "Einfluss von Elementen und Modalitäten",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
