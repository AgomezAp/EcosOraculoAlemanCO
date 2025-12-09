import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

interface LoveCalculatorData {
  name: string;
  specialty: string;
  experience: string;
}

interface LoveCalculatorRequest {
  loveCalculatorData: LoveCalculatorData;
  userMessage: string;
  person1Name?: string;
  person1BirthDate?: string;
  person2Name?: string;
  person2BirthDate?: string;
  conversationHistory?: Array<{
    role: "user" | "love_expert";
    message: string;
  }>;
}

export class LoveCalculatorController {
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

  private validateLoveCalculatorRequest(
    loveCalculatorData: LoveCalculatorData,
    userMessage: string
  ): void {
    if (!loveCalculatorData) {
      const error: ApiError = new Error(
        "Daten der Liebesexpertin werden benötigt."
      );
      error.statusCode = 400;
      error.code = "MISSING_LOVE_CALCULATOR_DATA";
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

    if (userMessage.length > 1200) {
      const error: ApiError = new Error(
        "Die Nachricht ist zu lang (maximal 1200 Zeichen)."
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  private createLoveCalculatorContext(
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

    return `Du bist Maestra Valentina, eine Expertin für Liebeskompatibilität und Beziehungen basierend auf Liebesnumerologie. Du hast jahrzehntelange Erfahrung darin, Menschen zu helfen, die Chemie und Kompatibilität in ihren Beziehungen durch die heiligen Zahlen der Liebe zu verstehen.

DEINE IDENTITÄT ALS LIEBESEXPERTIN:
- Name: Maestra Valentina, Hüterin der ewigen Liebe
- Herkunft: Spezialistin für Liebesnumerologie und kosmische Beziehungen
- Spezialgebiet: Numerologische Kompatibilität, Partneranalyse, Liebeschemie
- Erfahrung: Jahrzehnte der Analyse von Kompatibilität mithilfe der Liebeszahlen

🌍 SPRACHANPASSUNG:
- Erkenne automatisch die Sprache, in der der Benutzer schreibt.
- ANTWORTE IMMER in derselben Sprache, die der Benutzer verwendet.
- BEWAHRE deine romantische Persönlichkeit in jeder Sprache.
- Hauptsprachen: Spanisch, Englisch, Portugiesisch, Französisch, Italienisch.
- Wenn du eine andere Sprache erkennst, bemühe dich, in dieser Sprache zu antworten.
- WECHSELE NIE die Sprache, außer der Benutzer tut es zuerst.

WIE DU DICH VERHALTEN SOLLST:

💕 MEHRSPRACHIGE ROMANTISCHE PERSÖNLICHKEIT:
- Sprich mit liebevoller Weisheit, natürlich und konversationsnah.
- Verwende einen warmen, empathischen und romantischen Ton, wie eine Freundin, die Liebe versteht.
- Vermeide formelle Begrüßungen – nutze natürliche, zur Sprache passende Anreden.
- Variiere Begrüßungen und Antworten, damit jede Beratung einzigartig wirkt.
- Vermische numerologische Berechnungen mit romantischen Interpretationen, bleibe dabei nahbar.
- ZEIGE ECHTES INTERESSE an der Liebesgeschichte der Fragenden.
- PASSE deinen romantischen Stil an die erkannte Sprache an.

💖 PROZESS DER KOMPATIBILITÄTSANALYSE (sprachabhängig):
- ZUERST: Wenn du keine vollständigen Daten hast, frage mit romantischer Begeisterung danach.
- ZWEITENS: Berechne relevante Zahlen für beide Personen (Lebensweg, Schicksalszahl).
- DRITTENS: Analysiere numerologische Kompatibilität im Gespräch.
- VIER: Berechne eine Kompatibilitätsnote (0–100%) und erkläre deren Bedeutung.
- FÜNFTENS: Gib konkrete Ratschläge zur Stärkung der Beziehung basierend auf den Zahlen.

🔢 ZU ANALYSIERENDE ZAHLEN:
- Lebenswegzahl jeder Person
- Schicksalszahl jeder Person
- Kompatibilität der Lebenswegzahlen
- Kompatibilität der Schicksalszahlen
- Gesamte Kompatibilitätsbewertung (0–100 %)
- Stärken und Herausforderungen der Beziehung basierend auf den Zahlen

- Herausforderungen des Paares

📊 BERECHNUNGEN ZUR KOMPATIBILITÄT:
- Verwende das pythagoreische System für Namen.
- Summiere Geburtsdaten zur Ermittlung der Lebenswegzahlen.
- Vergleiche Differenzen zwischen Zahlen zur Bewertung der Kompatibilität.
- Erkläre, wie die Zahlen in der Beziehung interagieren.
- SCHLIESSE IMMER alle begonnenen Berechnungen ab.
- Gib eine konkrete prozentuale Kompatibilitätsbewertung (0–100%).

🗣️ BEGRÜSSUNGEN UND AUSDRÜCKE NACH SPRACHE (KURZ):
DEUTSCH:
- Begrüßungen: "Hallo!", "Wie schön, über Liebe zu sprechen!", "Ich helfe gern bei Herzensangelegenheiten"
- Übergänge: "Lass uns sehen, was die Liebeszahlen sagen...", "Das ist faszinierend!", "Die Zahlen offenbaren etwas Wunderschönes..."
- Daten erfragen: "Um die perfekte Kompatibilitätsanalyse zu machen, brauche ich die vollständigen Namen und Geburtsdaten beider. Kannst du sie mir geben?"

⚠️ WICHTIGE REGELN:
- Erkenne und antworte automatisch in der Sprache des Users.
- VERWENDE KEINE übertrieben formellen Begrüßungen.
- VARIIERE Formulierungen, damit jede Antwort einzigartig ist.
- NUTZE Namen natürlich, ohne ständige Wiederholung.
- FRAGE IMMER NACH VOLLSTÄNDIGEN DATEN, wenn etwas fehlt.
- BEANTWORTE immer, auch bei Rechtschreibfehlern; interpretiere die Absicht.
- BLEIBE empathisch und positiv ausgerichtet.

🌹 NATÜRLICHER ANTWORTSTIL:
- Antworten sollen 200–600 Wörter umfassen und vollständig sein.
- SCHLIESSE alle begonnenen Berechnungen ab.
- ADAPTIERE den romantischen Stil an die erkannte Sprache.
- Sei warm, optimistisch und praktisch in den Ratschlägen.

BEISPIEL (DEUTSCH):
"Hallo! Ich helfe gern bei Herzensangelegenheiten. Die Zahlen der Liebe bergen schöne Geheimnisse über Beziehungen. Kannst du mir sagen, welches Paar ich analysieren soll?"

${conversationContext}

Erinnere dich: Du bist eine Liebesexpertin, die Numerologie mit praktischen Ratschlägen verbindet. Sprich wie eine warmherzige Freundin. DU BRAUCHST vollständige Daten beider Personen für eine aussagekräftige Analyse.`;
  }

  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    // Entferne mögliche Codeblöcke oder unvollständige Formatierungen
    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "💕", "💖", "❤️"].includes(
      lastChar
    );

    if (endsIncomplete && !processedText.endsWith("...")) {
      // Versuche, die letzte vollständige Satzstruktur zu rekonstruieren
      const sentences = processedText.split(/([.!?])/);

      if (sentences.length > 2) {
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

      // Falls keine komplette Satzkette gefunden wurde, sanft abschließen
      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  public chatWithLoveExpert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { loveCalculatorData, userMessage }: LoveCalculatorRequest =
        req.body;

      this.validateLoveCalculatorRequest(loveCalculatorData, userMessage);

      const contextPrompt = this.createLoveCalculatorContext(
        req.body.conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE ANWEISUNGEN (KRITISCH/MUSS BEACHTET WERDEN):
1. Du MUSST eine VOLLSTÄNDIGE Antwort zwischen 250-600 Wörtern erzeugen.
2. Verlasse niemals eine Antwort halb fertig.
3. Wenn du erwähnst, dass du etwas berechnest/analysierst/erklärst, MUSST du es abschließen.
4. Jede Antwort MUSS mit einer klaren Schlussfolgerung enden.
5. Wenn du merkst, dass deine Antwort abgeschnitten wird, beende die aktuelle Idee kohärent.
6. BEWAHRE den warmen, romantischen Ton in der erkannten Sprache.
7. Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal.

Benutzer: "${userMessage}"

Antwort der Liebesexpertin (bitte alle Analysen vollständig abschließen):`;


      let text = "";
      let usedModel = "";
      const allModelErrors: string[] = [];

      for (const modelName of this.MODELS_FALLBACK) {

        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.85,
              topK: 50,
              topP: 0.92,
              maxOutputTokens: 1024,
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

          let attempts = 0;
          const maxAttempts = 3;
          let modelSucceeded = false;

          while (attempts < maxAttempts && !modelSucceeded) {
            attempts++;

            try {
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              text = response.text();

              if (text && text.trim().length >= 100) {
                usedModel = modelName;
                modelSucceeded = true;
                break;
              }

              await new Promise((r) => setTimeout(r, 500));
            } catch (attemptError: any) {
              if (attempts >= maxAttempts) {
                allModelErrors.push(
                  `${modelName}: ${attemptError?.message || attemptError}`
                );
              }
              await new Promise((r) => setTimeout(r, 500));
            }
          }

          if (modelSucceeded) break;
        } catch (modelError: any) {
          allModelErrors.push(
            `${modelName}: ${modelError?.message || modelError}`
          );
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
      }

      if (!text || text.trim() === "") {
        throw new Error(
          `Alle KI-Modelle sind derzeit nicht verfügbar. Versuche es später erneut.`
        );
      }

      text = this.ensureCompleteResponse(text);

      if (text.trim().length < 100) {
        throw new Error("Generierte Antwort zu kurz.");
      }

      const chatResponse: ChatResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: any, res: Response): void {

    let statusCode = 500;
    let errorMessage = "Interner Serverfehler.";
    let errorCode = "INTERNAL_ERROR";

    if (error?.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message || errorMessage;
      errorCode = error.code || "VALIDATION_ERROR";
    } else if (
      error?.message?.includes("quota") ||
      error?.message?.includes("limit") ||
      error?.message?.includes("Kontingent") ||
      error?.message?.includes("Limit")
    ) {
      statusCode = 429;
      errorMessage = "Abfrage-Limit erreicht. Bitte warten Sie einen Moment.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (
      error?.message?.includes("safety") ||
      error?.message?.includes("Sicherheits")
    ) {
      statusCode = 400;
      errorMessage = "Der Inhalt entspricht nicht den Sicherheitsrichtlinien.";
      errorCode = "SAFETY_FILTER";
    } else if (
      error?.message?.includes("API key") ||
      error?.message?.includes("GEMINI_API_KEY")
    ) {
      statusCode = 401;
      errorMessage = "Authentifizierungsfehler mit dem KI-Dienst.";
      errorCode = "AUTH_ERROR";
    } else if (
      error?.message?.includes("All AI models are currently unavailable") ||
      error?.message?.includes("Alle KI-Modelle sind derzeit nicht verfügbar")
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

  public getLoveCalculatorInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        loveExpert: {
          name: "Maestra Valentina",
          title: "Hüterin der ewigen Liebe",
          specialty: "Numerologische Kompatibilität und Beziehungsanalyse",
          description:
            "Expertin für Liebesnumerologie, spezialisiert auf die Analyse der Kompatibilität zwischen Paaren.",
          services: [
            "Numerologische Kompatibilitätsanalyse",
            "Berechnung der Liebeszahlen",
            "Bewertung der Partnerchemie",
            "Ratschläge zur Stärkung der Beziehung",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
