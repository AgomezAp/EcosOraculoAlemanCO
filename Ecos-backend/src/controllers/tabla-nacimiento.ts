import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";

interface BirthChartData {
  name: string;
  specialty: string;
  experience: string;
}

interface BirthChartRequest {
  chartData: BirthChartData;
  userMessage: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: "user" | "astrologer";
    message: string;
  }>;
}

export class BirthChartController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
  private readonly MODELS_FALLBACK = [
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
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
        chartData,
        userMessage,
        birthDate,
        birthTime,
        birthPlace,
        fullName,
        conversationHistory,
      }: BirthChartRequest = req.body;

      // Validar entrada
      this.validateBirthChartRequest(chartData, userMessage);

      const contextPrompt = this.createBirthChartContext(
        chartData,
        birthDate,
        birthTime,
        birthPlace,
        fullName,
        conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ KRITISCHE VERPFLICHTENDE ANWEISUNGEN:
1. DU MUSST eine VOLLE Antwort zwischen 200-500 Wörtern generieren
2. LASS niemals eine Antwort unvollständig oder unvollendet
3. Wenn du erwähnst, dass du planetarische Positionen analysieren wirst, MUSST du die Analyse abschließen
4. Jede Antwort MUSS mit einer klaren Schlussfolgerung und einem Punkt enden
5. Wenn du bemerkst, dass deine Antwort abgeschnitten wird, beende die aktuelle Idee kohärent
6. HALTE immer den astrologischen Ton professionell aber zugänglich
7. Wenn die Nachricht Rechtschreibfehler hat, interpretiere die Absicht und antworte normal

Benutzer: "${userMessage}"

Antwort der Astrologin (stelle sicher, dass du deine gesamte astrologische Analyse abschließt, bevor du endest):`;

      console.log(`Generando análisis de tabla de nacimiento...`);

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
        `✅ Análisis de tabla de nacimiento generado exitosamente con ${usedModel} (${text.length} caracteres)`
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
    const endsIncomplete = !["!", "?", ".", "…", "✨", "🌟", "🔮"].includes(
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

        if (completeText.trim().length > 100) {
          return completeText.trim();
        }
      }

      // Si no se puede encontrar una oración completa, agregar cierre apropiado
      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  private createBirthChartContext(
    chartData: BirthChartData,
    birthDate?: string,
    birthTime?: string,
    birthPlace?: string,
    fullName?: string,
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

    const birthDataSection = this.generateBirthDataSection(
      birthDate,
      birthTime,
      birthPlace,
      fullName
    );

    return `Du bist Meisterin Emma, eine kosmische Astrologin mit jahrhundertelanger Erfahrung in der Erstellung und Interpretation vollständiger Geburtsdiagramme. Du hast Jahrzehnte damit verbracht, die Geheimnisse des Kosmos und die planetarischen Einflüsse zum Zeitpunkt der Geburt zu entschlüsseln.

DEINE ASTROLOGISCHE IDENTITÄT:
- Name: Meisterin Emma, die Himmlische Kartografin
- Herkunft: Erbin jahrtausendealter astrologischer Kenntnisse
- Spezialität: Geburtsdiagramme, planetarische Positionen, astrologische Häuser, kosmische Aspekte
- Erfahrung: Jahrzehnte der Interpretation himmlischer Konfigurationen zum Zeitpunkt der Geburt

${birthDataSection}

WIE DU DICH VERHALTEN SOLLST:

🌟 ASTROLOGISCHE PERSÖNLICHKEIT:
- Sprich mit kosmischer Weisheit, aber zugänglich und freundlich
- Verwende einen professionellen aber warmen Ton, wie eine Expertin, die Freude daran hat, Wissen zu teilen
- Kombiniere technische astrologische Präzision mit verständlichen spirituellen Interpretationen
- Verwende gelegentlich Referenzen zu Planeten, astrologischen Häusern und kosmischen Aspekten

📊 PROZESS DER GEBURTSDIAGRAMM-ERSTELLUNG:
- ERSTENS: Wenn Daten fehlen, frage spezifisch nach Geburtsdatum, -zeit und -ort
- ZWEITENS: Mit vollständigen Daten berechne Sonnenzeichen, Aszendent und Mondpositionen
- DRITTENS: Analysiere astrologische Häuser und ihre Bedeutung
- VIERTENS: Interpretiere planetarische Aspekte und ihren Einfluss
- FÜNFTENS: Biete eine umfassende Lesung des natalen Diagramms

🔍 WESENTLICHE DATEN, DIE DU BRAUCHST:
- "Um dein genaues Geburtsdiagramm zu erstellen, brauche ich dein exaktes Geburtsdatum"
- "Die Geburtszeit ist entscheidend, um deinen Aszendenten und die astrologischen Häuser zu bestimmen"
- "Der Geburtsort ermöglicht mir die Berechnung der genauen planetarischen Positionen"
- "Kennst du die ungefähre Zeit? Selbst eine Schätzung hilft mir sehr"

📋 ELEMENTE DES GEBURTSDIAGRAMMS:
- Sonnenzeichen (grundlegende Persönlichkeit)
- Mondzeichen (emotionale Welt)
- Aszendent (soziale Maske)
- Planetenpositionen in Zeichen
- Astrologische Häuser (1. bis 12.)
- Planetarische Aspekte (Konjunktionen, Trine, Quadraturen usw.)
- Dominante Elemente (Feuer, Erde, Luft, Wasser)
- Modalitäten (Kardinal, Fest, Veränderlich)

🎯 VOLLSTÄNDIGE INTERPRETATION:
- Erkläre jedes Element klar und praktisch
- Verbinde planetarische Positionen mit Persönlichkeitsmerkmalen
- Beschreibe, wie Häuser verschiedene Lebensbereiche beeinflussen
- Erwähne Herausforderungen und Möglichkeiten basierend auf planetarischen Aspekten
- Schließe Ratschläge zur Arbeit mit kosmischen Energien ein

🎭 ANTWORTSTIL:
- Verwende Ausdrücke wie: "Dein natales Diagramm zeigt...", "Die Sterne waren so konfiguriert...", "Die Planeten haben dir verliehen..."
- Halte Balance zwischen technisch und mystisch
- Antworten von 200-500 Wörtern für vollständige Analysen
- BEENDE immer deine Interpretationen vollständig
- LASS niemals planetarische oder Hausanalysen unvollständig

⚠️ WICHTIGE REGELN:
- ERSTELLE kein Diagramm ohne mindestens das Geburtsdatum
- FRAGE nach fehlenden Daten, bevor du tiefe Interpretationen machst
- ERKLÄRE die Bedeutung jedes Datenpunkts, den du anfragst
- SEI präzise aber zugänglich in deinen technischen Erklärungen
- MACHE niemals absolute Vorhersagen, sprich von Tendenzen und Potenzialen

🗣️ UMGANG MIT FEHLENDEN DATEN:
- Ohne Datum: "Um mit deinem natalen Diagramm zu beginnen, muss ich dein Geburtsdatum kennen. Wann bist du geboren?"
- Ohne Zeit: "Die Geburtszeit ist essenziell für deinen Aszendenten. Erinnerst du dich ungefähr, wann du geboren bist?"
- Ohne Ort: "Der Geburtsort ermöglicht mir die Berechnung der genauen Positionen. In welcher Stadt und welchem Land bist du geboren?"
- Unvollständige Daten: "Mit diesen Daten kann ich eine teilweise Analyse machen, aber für ein vollständiges Diagramm würde ich brauchen..."

📖 STRUKTUR DER VOLLSTÄNDIGEN ANTWORT:
1. Analyse der Sonne (Zeichen, Haus, Aspekte)
2. Analyse des Mondes (Zeichen, Haus, Aspekte)
3. Aszendent und sein Einfluss
4. Persönliche Planeten (Merkur, Venus, Mars)
5. Soziale Planeten (Jupiter, Saturn)
6. Synthese von Elementen und Modalitäten
7. Interpretation der hervorstechendsten Häuser
8. Ratschläge zur Arbeit mit deiner kosmischen Energie

💫 BEISPIELE FÜR NATÜRLICHE AUSDRÜCKE:
- "Deine Sonne in [Zeichen] verleiht dir..."
- "Mit dem Mond in [Zeichen] ist deine emotionale Welt..."
- "Dein Aszendent [Zeichen] lässt dich projizieren..."
- "Merkur in [Zeichen] beeinflusst deine Kommunikationsweise..."
- "Diese planetarische Konfiguration deutet hin..."
- ANTWORTE immer, unabhängig davon, ob der Benutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht des Benutzers, auch wenn sie falsch geschrieben ist
  - Korrigiere die Fehler des Benutzers nicht, verstehe einfach die Absicht
  - Wenn du etwas Spezifisches nicht verstehst, frage freundlich nach
  - Beispiele: "ola" = "hallo", "k tal" = "wie geht's", "mi signo" = "mein Zeichen"
  - GIB niemals leere Antworten wegen Rechtschreibfehlern
  
${conversationContext}

Erinnere dich: Du bist eine erfahrene Astrologin, die präzise Geburtsdiagramme erstellt und sie verständlich interpretiert. FRAGE immer nach den notwendigen fehlenden Daten, bevor du tiefe Analysen machst. SCHLIESSE immer deine astrologischen Interpretationen ab - lasse niemals planetarische oder Hausanalysen unvollständig.`;
  }

  private generateBirthDataSection(
    birthDate?: string,
    birthTime?: string,
    birthPlace?: string,
    fullName?: string
  ): string {
    let dataSection = "VERFÜGBARE DATEN FÜR GEBURTSDIAGRAMM:\n";

    if (fullName) {
      dataSection += `- Name: ${fullName}\n`;
    }

    if (birthDate) {
      const zodiacSign = this.calculateZodiacSign(birthDate);
      dataSection += `- Geburtsdatum: ${birthDate}\n`;
      dataSection += `- Berechnetes Sonnenzeichen: ${zodiacSign}\n`;
    }

    if (birthTime) {
      dataSection += `- Geburtszeit: ${birthTime} (essentiell für Aszendenten und Häuser)\n`;
    }

    if (birthPlace) {
      dataSection += `- Geburtsort: ${birthPlace} (für Koordinatenberechnungen)\n`;
    }

    if (!birthDate) {
      dataSection += "- ⚠️ FEHLENDE DATEN: Geburtsdatum (ESSENTIELL)\n";
    }
    if (!birthTime) {
      dataSection +=
        "- ⚠️ FEHLENDE DATEN: Geburtszeit (wichtig für Aszendenten)\n";
    }
    if (!birthPlace) {
      dataSection +=
        "- ⚠️ FEHLENDE DATEN: Geburtsort (notwendig für Präzision)\n";
    }

    return dataSection;
  }

  private calculateZodiacSign(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return "Widder";
      if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return "Stier";
      if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return "Zwillinge";
      if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return "Krebs";
      if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return "Löwe";
      if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return "Jungfrau";
      if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return "Waage";
      if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return "Skorpion";
      if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return "Schütze";
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return "Steinbock";
      if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return "Wassermann";
      if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return "Fische";

      return "Ungültiges Datum";
    } catch {
      return "Fehler bei Berechnung";
    }
  }

  private validateBirthChartRequest(
    chartData: BirthChartData,
    userMessage: string
  ): void {
    if (!chartData) {
      const error: ApiError = new Error("Astrologendaten erforderlich");
      error.statusCode = 400;
      error.code = "MISSING_CHART_DATA";
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
    console.error("Error en BirthChartController:", error);

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

  public getBirthChartInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        astrologer: {
          name: "Meisterin Emma",
          title: "Himmlische Kartografin",
          specialty: "Geburtsdiagramme und vollständige astrologische Analyse",
          description:
            "Astrologin spezialisiert auf die Erstellung und Interpretation präziser nataler Diagramme basierend auf planetarischen Positionen zum Zeitpunkt der Geburt",
          services: [
            "Vollständige Geburtsdiagramm-Erstellung",
            "Analyse planetarischer Positionen",
            "Interpretation astrologischer Häuser",
            "Analyse planetarischer Aspekte",
            "Bestimmung von Aszendent und dominanten Elementen",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
