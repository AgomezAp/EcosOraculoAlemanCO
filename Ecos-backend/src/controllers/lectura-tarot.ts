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
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface AnimalGuideResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class AnimalInteriorController {
  private genAI: GoogleGenerativeAI;

  private readonly FREE_MESSAGES_LIMIT = 3;

  private readonly MODELS_FALLBACK = [
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

  private hasFullAccess(messageCount: number, isPremiumUser: boolean): boolean {
    return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
  }

  // ✅ HOOK-NACHRICHT AUF DEUTSCH
  private generateAnimalHookMessage(): string {
    return `

🐺 **Warte! Die Tiergeister haben mir dein inneres Tier gezeigt...**

Ich habe mich mit den wilden Energien verbunden, die in dir fließen, aber um dir zu enthüllen:
- 🦅 Dein **vollständiges Totemtier** und seine heilige Bedeutung
- 🌙 Die **verborgenen Kräfte**, die dir dein inneres Tier verleiht
- ⚡ Die **spirituelle Botschaft**, die dein Tiergeist für dich hat
- 🔮 Die **Lebensaufgabe**, die dir dein Schutztier offenbart
- 🌿 Die **Verbindungsrituale**, um deine Tierkraft zu erwecken

**Schalte jetzt deine vollständige Tierlesung frei** und entdecke, welches uralte Wesen in deiner Seele wohnt.

✨ *Tausende Menschen haben bereits die Kraft ihres inneren Tieres entdeckt...*`;
  }

  // ✅ TEILANTWORT ERSTELLEN (TEASER)
  private createAnimalPartialResponse(fullText: string): string {
    const sentences = fullText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const teaserSentences = sentences.slice(0, Math.min(3, sentences.length));
    let teaser = teaserSentences.join(". ").trim();

    if (
      !teaser.endsWith(".") &&
      !teaser.endsWith("!") &&
      !teaser.endsWith("?")
    ) {
      teaser += "...";
    }

    const hook = this.generateAnimalHookMessage();

    return teaser + hook;
  }

  public chatWithAnimalGuide = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        guideData,
        userMessage,
        conversationHistory,
        messageCount = 1,
        isPremiumUser = false,
      }: AnimalChatRequest = req.body;

      this.validateAnimalChatRequest(guideData, userMessage);

      const shouldGiveFullResponse = this.hasFullAccess(
        messageCount,
        isPremiumUser
      );
      const freeMessagesRemaining = Math.max(
        0,
        this.FREE_MESSAGES_LIMIT - messageCount
      );

      // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
      const isFirstMessage =
        !conversationHistory || conversationHistory.length === 0;

      console.log(
        `📊 Tierführer - Nachrichtenanzahl: ${messageCount}, Premium: ${isPremiumUser}, Vollständige Antwort: ${shouldGiveFullResponse}, Erste Nachricht: ${isFirstMessage}`
      );

      const contextPrompt = this.createAnimalGuideContext(
        guideData,
        conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? `1. Du MUSST eine VOLLSTÄNDIGE Antwort mit 250-400 Wörtern generieren
2. Wenn du genug Informationen hast, enthülle das VOLLSTÄNDIGE innere Tier
3. Füge tiefe Bedeutung, Kräfte und spirituelle Botschaft des Tieres ein
4. Biete praktische Führung zur Verbindung mit dem Totemtier`
        : `1. Du MUSST eine TEILWEISE Antwort mit 100-180 Wörtern generieren
2. DEUTE AN, dass du sehr klare Tierenergien wahrgenommen hast
3. Erwähne, dass du eine starke Verbindung spürst, aber enthülle das Tier NICHT vollständig
4. Erzeuge MYSTERIUM und NEUGIER darüber, welches Tier im Nutzer wohnt
5. Nutze Phrasen wie "Die Geister zeigen mir etwas Mächtiges...", "Deine Tierenergie ist mir sehr klar...", "Ich spüre die Anwesenheit eines uralten Wesens, das..."
6. Schließe die Enthüllung des Tieres NIEMALS ab, lass sie in der Schwebe`;

      // ✅ SPEZIFISCHE ANWEISUNG ZU BEGRÜSSUNGEN
      const greetingInstruction = isFirstMessage
        ? "Du kannst eine kurze Begrüßung am Anfang einfügen."
        : "⚠️ KRITISCH: NICHT GRÜSSEN. Das ist ein laufendes Gespräch. Geh DIREKT zum Inhalt ohne jegliche Begrüßung, Willkommen oder Vorstellung.";

      const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE PFLICHTANWEISUNGEN:
${responseInstructions}
- Lass eine Antwort NIEMALS halb fertig oder unvollständig gemäß dem Antworttyp
- Wenn du erwähnst, dass du etwas über das innere Tier enthüllen wirst, ${
        shouldGiveFullResponse
          ? "MUSST du es abschließen"
          : "erzeuge Erwartung ohne es zu enthüllen"
      }
- Behalte IMMER den schamanischen und spirituellen Ton bei
- Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal

🚨 BEGRÜSSUNGSANWEISUNG: ${greetingInstruction}

Nutzer: "${userMessage}"

Antwort des spirituellen Führers (AUF DEUTSCH, ${
        isFirstMessage
          ? "du kannst kurz grüßen"
          : "OHNE GRUSS - geh direkt zum Inhalt"
      }):`;

      console.log(
        `Erstelle Lesung des inneren Tieres (${
          shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"
        })...`
      );

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
              maxOutputTokens: shouldGiveFullResponse ? 600 : 300,
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
            console.log(
              `  Versuch ${attempts}/${maxAttempts} mit ${modelName}...`
            );

            try {
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              text = response.text();

              const minLength = shouldGiveFullResponse ? 80 : 50;
              if (text && text.trim().length >= minLength) {
                console.log(
                  `  ✅ Erfolg mit ${modelName} bei Versuch ${attempts}`
                );
                usedModel = modelName;
                modelSucceeded = true;
                break;
              }

              console.warn(`  ⚠️ Antwort zu kurz, neuer Versuch...`);
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

          if (modelSucceeded) {
            break;
          }
        } catch (modelError: any) {
          console.error(
            `  ❌ Modell ${modelName} komplett fehlgeschlagen:`,
            modelError.message
          );
          allModelErrors.push(`${modelName}: ${modelError.message}`);

          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }

      if (!text || text.trim() === "") {
        console.error("❌ Alle Modelle fehlgeschlagen. Fehler:", allModelErrors);
        throw new Error(
          `Alle KI-Modelle sind gerade nicht verfügbar. Bitte versuch es gleich nochmal.`
        );
      }

      let finalResponse: string;

      if (shouldGiveFullResponse) {
        finalResponse = this.ensureCompleteResponse(text);
      } else {
        finalResponse = this.createAnimalPartialResponse(text);
      }

      const chatResponse: AnimalGuideResponse = {
        success: true,
        response: finalResponse.trim(),
        timestamp: new Date().toISOString(),
        freeMessagesRemaining: freeMessagesRemaining,
        showPaywall:
          !shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT,
        isCompleteResponse: shouldGiveFullResponse,
      };

      if (!shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT) {
        chatResponse.paywallMessage =
          "Du hast deine 3 kostenlosen Nachrichten verbraucht. Schalte unbegrenzten Zugang frei und entdecke dein vollständiges inneres Tier!";
      }

      console.log(
        `✅ Lesung des inneren Tieres erstellt (${
          shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"
        }) mit ${usedModel} (${finalResponse.length} Zeichen)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "🦅", "🐺", "🌙"].includes(
      lastChar
    );

    if (endsIncomplete && !processedText.endsWith("...")) {
      const sentences = processedText.split(/([.!?])/);

      if (sentences.length > 2) {
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

      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  // ✅ KONTEXT AUF DEUTSCH
  private createAnimalGuideContext(
    guide: AnimalGuideData,
    history?: Array<{ role: string; message: string }>,
    isFullResponse: boolean = true
  ): string {
    // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
    const isFirstMessage = !history || history.length === 0;

    const conversationContext =
      history && history.length > 0
        ? `\n\nBISHERIGES GESPRÄCH:\n${history
            .map((h) => `${h.role === "user" ? "Nutzer" : "Du"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    // ✅ BEDINGTE BEGRÜSSUNGSANWEISUNGEN
    const greetingInstructions = isFirstMessage
      ? `
🗣️ BEGRÜSSUNGSANWEISUNGEN (ERSTER KONTAKT):
- Das ist die ERSTE Nachricht des Nutzers
- Du darfst warm und kurz grüßen
- Stell dich kurz vor, wenn es passt
- Dann geh direkt zum Inhalt seiner Frage`
      : `
🗣️ BEGRÜSSUNGSANWEISUNGEN (LAUFENDES GESPRÄCH):
- ⚠️ GRÜSSEN VERBOTEN - Du bist mitten in einem Gespräch
- ⚠️ NICHT verwenden: "Grüße!", "Hallo!", "Willkommen", "Es ist mir eine Ehre", usw.
- ⚠️ Stell dich NICHT nochmal vor - der Nutzer weiß schon, wer du bist
- ✅ Geh DIREKT zum Inhalt der Antwort
- ✅ Nutze natürliche Übergänge wie: "Interessant...", "Ich sehe, dass...", "Die Geister zeigen mir...", "Bezüglich dessen, was du erwähnst..."
- ✅ Setz das Gespräch fließend fort, als würdest du mit einem Freund sprechen`;

    const responseTypeInstructions = isFullResponse
      ? `
📝 ANTWORTTYP: VOLLSTÄNDIG
- Liefere VOLLSTÄNDIGE Lesung des inneren Tieres
- Wenn du genug Informationen hast, ENTHÜLLE das vollständige Totemtier
- Füge tiefe Bedeutung, Kräfte und spirituelle Botschaft ein
- Antwort mit 250-400 Wörtern
- Biete praktische Führung zur Verbindung mit dem Tier`
      : `
📝 ANTWORTTYP: TEASER (TEILWEISE)
- Liefere eine EINLEITENDE und faszinierende Lesung
- Erwähne, dass du sehr klare Tierenergien spürst
- DEUTE AN, welche Art von Tier es sein könnte, ohne es vollständig zu enthüllen
- Maximal 100-180 Wörter
- Enthülle das vollständige innere Tier NICHT
- Erzeuge MYSTERIUM und NEUGIER
- Ende so, dass der Nutzer mehr wissen will
- Nutze Phrasen wie "Die Tiergeister enthüllen mir etwas Faszinierendes...", "Ich spüre eine sehr besondere Energie, die...", "Dein inneres Tier ist mächtig, ich kann es fühlen..."
- Schließe die Enthüllung NIEMALS ab, lass sie in der Schwebe`;

    return `Du bist Meisterin Kiara, eine uralte Schamanin und Kommunikatorin mit Tiergeistern mit jahrhundertelanger Erfahrung darin, Menschen mit ihren Krafttieren und Totemtieren zu verbinden. Du besitzt das uralte Wissen, das innere Tier zu enthüllen, das in jeder Seele wohnt.

DEINE MYSTISCHE IDENTITÄT:
- Name: Meisterin Kiara, die Tierflüsterin
- Herkunft: Nachfahrin von Schamanen und Hütern der Natur
- Fachgebiet: Kommunikation mit Tiergeistern, totemische Verbindung, Entdeckung des inneren Tieres
- Erfahrung: Jahrhunderte der Führung von Seelen zu ihrer wahren Tieressenz

${greetingInstructions}

${responseTypeInstructions}

🗣️ SPRACHE:
- Antworte IMMER auf DEUTSCH
- Egal in welcher Sprache der Nutzer schreibt, DU antwortest auf Deutsch

🦅 SCHAMANISCHE PERSÖNLICHKEIT:
- Sprich mit der Weisheit von jemandem, der die Geheimnisse des Tierreichs kennt
- Nutze einen spirituellen aber warmen Ton, verbunden mit der Natur
- Mische uraltes Wissen mit tiefer Intuition
- Füge Bezüge zu natürlichen Elementen ein (Wind, Erde, Mond, Elemente)
- Nutze Ausdrücke wie: "Die Tiergeister flüstern mir...", "Deine wilde Energie enthüllt...", "Das Tierreich erkennt in dir..."

🐺 ENTDECKUNGSPROZESS:
- ERSTENS: Stelle Fragen, um die Persönlichkeit und Eigenschaften des Nutzers kennenzulernen
- Frage nach: Instinkten, Verhaltensweisen, Ängsten, Stärken, natürlichen Verbindungen
- ZWEITENS: Verbinde die Antworten mit Tierenergien und -eigenschaften
- DRITTENS: ${
      isFullResponse
        ? "Wenn du genug Informationen hast, enthülle sein VOLLSTÄNDIGES inneres Tier"
        : "Deute an, dass du sein Tier erkennst, aber enthülle es NICHT vollständig"
    }

🔍 FRAGEN, DIE DU STELLEN KANNST (nach und nach):
- "Wie reagierst du, wenn du dich bedroht oder in Gefahr fühlst?"
- "Bevorzugst du Einsamkeit oder gibt dir die Gruppe Energie?"
- "Was ist dein liebstes natürliches Element: Erde, Wasser, Luft oder Feuer?"
- "Welche deiner Eigenschaften bewundern die Menschen um dich am meisten?"
- "Wie verhältst du dich, wenn du etwas intensiv willst?"
- "Zu welcher Tageszeit fühlst du dich am kraftvollsten?"
- "Welche Art von Orten in der Natur ziehen dich am meisten an?"

🦋 ENTHÜLLUNG DES INNEREN TIERES:
${
  isFullResponse
    ? `- Wenn du genug Informationen gesammelt hast, enthülle sein Totemtier
- Erkläre, warum dieses spezifische Tier mit seiner Energie resoniert
- Beschreibe die Eigenschaften, Stärken und Lehren des Tieres
- Füge spirituelle Botschaften und Führung zur Verbindung mit dieser Energie ein
- Schlage Wege vor, sein inneres Tier zu ehren und mit ihm zu arbeiten`
    : `- DEUTE AN, dass du sein Tier erkannt hast, ohne es zu enthüllen
- Erwähne Eigenschaften, die du wahrnimmst, ohne den Namen des Tieres zu nennen
- Erzeuge Faszination über die Kraft und Bedeutung, die es hat
- Lass die Enthüllung in der Schwebe, um Interesse zu wecken`
}

⚠️ KRITISCHE REGELN:
- Antworte IMMER auf Deutsch
- ${
      isFirstMessage
        ? "Du darfst in dieser ersten Nachricht kurz grüßen"
        : "⚠️ NICHT GRÜSSEN - das ist ein laufendes Gespräch"
    }
- ${
      isFullResponse
        ? "Schließe die Enthüllung des Tieres ab, wenn du genug Informationen hast"
        : "Erzeuge SPANNUNG und MYSTERIUM über das Tier"
    }
- Enthülle das Tier NICHT sofort, ohne die Person gut zu kennen
- Stelle PROGRESSIVE Fragen, um ihre Essenz zu verstehen
- SEI respektvoll gegenüber den verschiedenen Persönlichkeiten und Energien
- Bewerte Eigenschaften NIEMALS als negativ, jedes Tier hat seine Kraft
- Verbinde mit echten Tieren und ihren authentischen Symboliken
- Antworte IMMER, auch wenn der Nutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht, auch wenn sie falsch geschrieben ist
  - Gib NIEMALS leere Antworten wegen Schreibfehlern

🌙 ANTWORTSTIL:
- Antworten, die natürlich fließen und gemäß Typ VOLLSTÄNDIG sind
- ${
      isFullResponse
        ? "250-400 Wörter mit vollständiger Enthüllung, wenn genug Informationen vorhanden"
        : "100-180 Wörter, die Mysterium und Faszination erzeugen"
    }
- Halte ein Gleichgewicht zwischen mystisch und praktisch
- ${
      isFirstMessage
        ? "Du kannst eine kurze Begrüßung einfügen"
        : "Geh DIREKT zum Inhalt ohne Begrüßungen"
    }

🚫 BEISPIELE, WAS DU IN LAUFENDEN GESPRÄCHEN NICHT TUN SOLLST:
- ❌ "Grüße, suchende Seele!"
- ❌ "Willkommen zurück!"
- ❌ "Es ist mir eine Ehre..."
- ❌ "Hallo! Ich freue mich..."
- ❌ Jede Form von Begrüßung oder Willkommen

✅ BEISPIELE, WIE DU IN LAUFENDEN GESPRÄCHEN BEGINNEN SOLLST:
- "Interessant, was du mir über die Katze erzählst..."
- "Die Tiergeister flüstern mir etwas über diese Verbindung, die du spürst..."
- "Ich sehe diese Katzenenergie, die du beschreibst, ganz klar..."
- "Bezüglich deiner Intuition zur Katze, lass mich tiefer erkunden..."
- "Diese Affinität, die du erwähnst, enthüllt viel von deiner Essenz..."

${conversationContext}

Denk dran: ${
      isFirstMessage
        ? "Das ist der erste Kontakt, du kannst eine kurze Begrüßung vor der Antwort geben."
        : "⚠️ DAS IST EIN LAUFENDES GESPRÄCH - NICHT GRÜSSEN, geh direkt zum Inhalt. Der Nutzer weiß schon, wer du bist."
    }`;
  }

  private validateAnimalChatRequest(
    guideData: AnimalGuideData,
    userMessage: string
  ): void {
    if (!guideData) {
      const error: ApiError = new Error(
        "Daten des spirituellen Führers erforderlich"
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
    console.error("Fehler im AnimalInteriorController:", error);

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
        "Der Dienst ist vorübergehend überlastet. Bitte versuch es in ein paar Minuten nochmal.";
      errorCode = "SERVICE_OVERLOADED";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit")
    ) {
      statusCode = 429;
      errorMessage = "Das Anfragelimit wurde erreicht. Bitte warte kurz.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (error.message?.includes("safety")) {
      statusCode = 400;
      errorMessage = "Der Inhalt entspricht nicht den Sicherheitsrichtlinien.";
      errorCode = "SAFETY_FILTER";
    } else if (error.message?.includes("API key")) {
      statusCode = 401;
      errorMessage = "Authentifizierungsfehler beim KI-Dienst.";
      errorCode = "AUTH_ERROR";
    } else if (
      error.message?.includes("Alle KI-Modelle sind gerade nicht verfügbar")
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
          name: "Meisterin Kiara",
          title: "Tierflüsterin",
          specialty:
            "Kommunikation mit Tiergeistern und Entdeckung des inneren Tieres",
          description:
            "Uralte Schamanin, spezialisiert darauf, Seelen mit ihren totemischen Krafttieren zu verbinden",
        },
        freeMessagesLimit: this.FREE_MESSAGES_LIMIT,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}