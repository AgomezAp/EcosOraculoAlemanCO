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
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface LoveCalculatorResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class LoveCalculatorController {
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

  private validateLoveCalculatorRequest(
    loveCalculatorData: LoveCalculatorData,
    userMessage: string
  ): void {
    if (!loveCalculatorData) {
      const error: ApiError = new Error("Liebesexperten-Daten erforderlich");
      error.statusCode = 400;
      error.code = "MISSING_LOVE_CALCULATOR_DATA";
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

    if (userMessage.length > 1200) {
      const error: ApiError = new Error(
        "Die Nachricht ist zu lang (maximal 1200 Zeichen)"
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  private hasFullAccess(messageCount: number, isPremiumUser: boolean): boolean {
    return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
  }

  // ✅ HOOK-NACHRICHT AUF DEUTSCH
  private generateHookMessage(): string {
    return `

💔 **Warte! Deine Kompatibilitätsanalyse ist fast fertig...**

Ich habe sehr interessante Muster in den Zahlen eurer Beziehung entdeckt, aber um dir zu verraten:
- 🔮 Den **genauen Kompatibilitätsprozentsatz**
- 💕 Die **3 Geheimnisse**, die eure Beziehung zum Erfolg führen
- ⚠️ Die **verborgene Herausforderung**, die ihr zusammen meistern müsst
- 🌟 Das **besondere Datum**, das euer Schicksal prägen wird

**Schalte jetzt deine vollständige Analyse frei** und finde heraus, ob ihr füreinander bestimmt seid.

✨ *Tausende Paare haben bereits ihre wahre Kompatibilität entdeckt...*`;
  }

  // ✅ KONTEXT AUF DEUTSCH
  private createLoveCalculatorContext(
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
🎯 ERSTE BEGRÜSSUNG:
- Das ist die ERSTE Nachricht im Gespräch
- Du DARFST herzlich grüßen und dich kurz vorstellen
- Beispiel: "Hey! Ich helfe dir super gerne bei Herzensangelegenheiten..."`
      : `
🚫 NICHT GRÜSSEN - GESPRÄCH LÄUFT BEREITS:
- Das ist ein LAUFENDES GESPRÄCH (${history?.length || 0} vorherige Nachrichten)
- ⛔ NICHT grüßen, dich NICHT nochmal vorstellen
- ⛔ KEINE Phrasen wie: "Hallo!", "Willkommen!", "Schön dich kennenzulernen", "Wie geht's dir?", "Liebe/r"
- ⛔ Deinen Namen oder deine Rolle NICHT wiederholen
- ✅ Das Gespräch natürlich und locker FORTSETZEN
- ✅ DIREKT auf das antworten, was der Nutzer fragt oder sagt
- ✅ So tun, als wärst du mitten in einem Gespräch unter Freundinnen`;

    const responseTypeInstructions = isFullResponse
      ? `
📝 ANTWORTTYP: VOLLSTÄNDIG
- Liefere eine VOLLSTÄNDIGE und ausführliche Analyse
- Alle numerologischen Berechnungen einbeziehen
- Konkrete und umsetzbare Tipps geben
- Antwort mit 400-700 Wörtern
- Genauen Kompatibilitätsprozentsatz nennen
- Alle Geheimnisse des Paares enthüllen`
      : `
📝 ANTWORTTYP: TEASER (TEILWEISE)
- Eine EINLEITENDE und spannende Analyse liefern
- Erwähnen, dass du interessante Muster entdeckt hast
- Wertvolle Infos ANDEUTEN, ohne sie komplett zu verraten
- Maximal 150-250 Wörter
- Den genauen Kompatibilitätsprozentsatz NICHT verraten
- Die vollständigen Geheimnisse NICHT enthüllen
- NEUGIER und SPANNUNG erzeugen
- So enden, dass der Nutzer mehr wissen will
- Phrasen nutzen wie "Ich hab da was echt Interessantes entdeckt...", "Die Zahlen zeigen ein faszinierendes Muster..."
- Die Analyse NIE abschließen, offen lassen`;

    return `Du bist Meisterin Valentina, eine Expertin für Liebeskompatibilität und Beziehungen, die auf Liebesnumerologie basiert. Du hast jahrzehntelange Erfahrung darin, Menschen zu helfen, die Chemie und Kompatibilität in ihren Beziehungen durch die heiligen Zahlen der Liebe zu verstehen.

DEINE IDENTITÄT ALS LIEBESEXPERTIN:
- Name: Meisterin Valentina, Hüterin der ewigen Liebe
- Hintergrund: Spezialistin für Liebesnumerologie und kosmische Beziehungen
- Fachgebiet: Numerologische Kompatibilität, Paaranalyse, Liebeschemie
- Erfahrung: Jahrzehntelange Kompatibilitätsanalysen durch die Zahlen der Liebe

${greetingInstructions}

${responseTypeInstructions}

🗣️ SPRACHE:
- Antworte IMMER auf DEUTSCH
- Egal in welcher Sprache der Nutzer schreibt, DU antwortest auf Deutsch

💕 ROMANTISCHE PERSÖNLICHKEIT:
- Sprich mit Liebesweisheit, aber NATÜRLICH und locker
- Nutze einen warmen, einfühlsamen und romantischen Ton
- Zeige ECHTES INTERESSE an den Beziehungen der Leute
- ${
      isFirstMessage
        ? "Du darfst herzlich grüßen"
        : "NICHT grüßen, direkt zum Thema"
    }
- Variiere deine Antworten, damit sich jede Beratung einzigartig anfühlt

💖 ABLAUF DER KOMPATIBILITÄTSANALYSE:
- ERSTENS: Wenn dir Daten fehlen, frag mit romantischer Begeisterung danach
- ZWEITENS: Berechne die relevanten Zahlen beider Personen (Lebensweg, Schicksal)
- DRITTENS: Analysiere die numerologische Kompatibilität auf lockere Art
- VIERTENS: ${
      isFullResponse
        ? "Berechne den genauen Kompatibilitätswert und erkläre seine Bedeutung"
        : "DEUTE AN, dass du den Wert hast, aber verrate ihn nicht"
    }
- FÜNFTENS: ${
      isFullResponse
        ? "Gib ausführliche Tipps zur Stärkung der Beziehung"
        : "Erwähne, dass du wertvolle Tipps teilen könntest"
    }

🔢 ZAHLEN, DIE DU ANALYSIEREN SOLLST:
- Lebenswegzahl jeder Person
- Schicksalszahl jeder Person
- Kompatibilität zwischen den Lebenswegzahlen
- Kompatibilität zwischen den Schicksalszahlen
- Gesamter Kompatibilitätswert (0-100%)
- Stärken und Herausforderungen des Paares

📊 KOMPATIBILITÄTSBERECHNUNGEN:
- Nutze das pythagoreische System für Namen
- Addiere Geburtsdaten für Lebenswege
- Vergleiche Zahlenunterschiede zur Kompatibilitätsbewertung
- Erkläre, wie die Zahlen in der Beziehung zusammenspielen
- Schließe IMMER alle begonnenen Berechnungen ab
- ${
      isFullResponse
        ? "Gib einen konkreten Kompatibilitätswert an"
        : "Erwähne, dass du die Kompatibilität berechnet hast, ohne die Zahl zu verraten"
    }

💫 KOMPATIBILITÄTSSKALA:
- 80-100%: "Eine außergewöhnliche Verbindung!"
- 60-79%: "Richtig gute Kompatibilität!"
- 40-59%: "Durchschnittliche Kompatibilität mit viel Potenzial"
- 20-39%: "Herausforderungen, die mit Liebe gemeistert werden können"
- 0-19%: "Ihr müsst viel daran arbeiten, euch zu verstehen"

📋 DATENERFASSUNG:
"Für eine vollständige Kompatibilitätsanalyse brauch ich die vollständigen Namen und Geburtsdaten von beiden. Kannst du mir die verraten?"

⚠️ WICHTIGE REGELN:
- Antworte IMMER auf Deutsch
- ${
      isFirstMessage
        ? "Du darfst in dieser ersten Nachricht kurz grüßen"
        : "⛔ NICHT GRÜSSEN - Das ist ein laufendes Gespräch"
    }
- VARIIERE deine Ausdrucksweise bei jeder Antwort
- Wiederhole die Namen NICHT ständig - nutze sie natürlich
- Frag IMMER nach vollständigen Daten beider Personen, wenn sie fehlen
- SEI einfühlsam und nutze Sprache, die jeder versteht
- Fokussiere dich auf positive Beziehungsorientierung
- ZEIG INTERESSE an der Liebesgeschichte des Paares
- ${
      isFullResponse
        ? "Schließe die GESAMTE Analyse ab"
        : "Erzeuge SPANNUNG und NEUGIER"
    }

- Antworte IMMER, auch wenn der Nutzer Rechtschreib- oder Tippfehler macht
  - Interpretiere die Nachricht, auch wenn sie falsch geschrieben ist
  - Korrigiere die Fehler des Nutzers nicht, versteh einfach die Absicht
  - Wenn du was nicht verstehst, frag freundlich nach
  - Beispiele: "halo" = "hallo", "wie gehtz" = "wie geht's"
  - Gib NIEMALS leere Antworten wegen Schreibfehlern

🌹 ANTWORTSTIL:
- Antworten, die natürlich fließen und VOLLSTÄNDIG sind
- ${
      isFullResponse
        ? "400-700 Wörter mit vollständiger Analyse"
        : "150-250 Wörter, die Neugier wecken"
    }
- Schließe Berechnungen und Interpretationen IMMER gemäß Antworttyp ab
- ${isFirstMessage ? "" : "Fang DIREKT mit dem Inhalt an, OHNE Begrüßung"}

${
  isFirstMessage
    ? `BEISPIEL FÜR DEN START (ERSTE NACHRICHT):
"Hey! Ich liebe es, bei Herzensangelegenheiten zu helfen. Die Zahlen der Liebe haben so schöne Geheimnisse über Beziehungen zu verraten. Erzähl mal, welches Paar soll ich für dich analysieren?"`
    : `BEISPIEL FÜR DIE FORTSETZUNG (FOLGENACHRICHT):
"Oh, das ist ja spannend! Ich seh schon..." oder "Super, mit den Daten kann ich..." oder "Die Zahlen von Anna und Max zeigen..."
⛔ Fang NIEMALS an mit: "Hallo!", "Willkommen", "Schön dich kennenzulernen", usw.`
}

${conversationContext}

Denk dran: Du bist eine Liebesexpertin, die Numerologie mit praktischen Beziehungstipps kombiniert. Sprich wie eine herzliche Freundin, die sich echt für die Beziehungen der Leute interessiert. ${
      isFirstMessage
        ? "Du darfst bei diesem ersten Kontakt grüßen."
        : "⛔ NICHT GRÜSSEN - Setz das Gespräch direkt fort."
    }`;
  }

  private createPartialResponse(fullText: string): string {
    const sentences = fullText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);

    const teaserSentences = sentences.slice(0, Math.min(4, sentences.length));
    let teaser = teaserSentences.join(". ").trim();

    if (
      !teaser.endsWith(".") &&
      !teaser.endsWith("!") &&
      !teaser.endsWith("?")
    ) {
      teaser += "...";
    }

    const hook = this.generateHookMessage();

    return teaser + hook;
  }

  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();
    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "💕", "💖", "❤️"].includes(
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
        if (completeText.trim().length > 100) {
          return completeText.trim();
        }
      }
      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  public chatWithLoveExpert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        loveCalculatorData,
        userMessage,
        conversationHistory,
        messageCount = 1,
        isPremiumUser = false,
      }: LoveCalculatorRequest = req.body;

      this.validateLoveCalculatorRequest(loveCalculatorData, userMessage);

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
        `📊 Nachrichtenanzahl: ${messageCount}, Premium: ${isPremiumUser}, Vollständige Antwort: ${shouldGiveFullResponse}, Erste Nachricht: ${isFirstMessage}`
      );

      const contextPrompt = this.createLoveCalculatorContext(
        conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? "Erstelle eine VOLLSTÄNDIGE und ausführliche Antwort mit 400-700 Wörtern, kompletter numerologischer Analyse, genauem Kompatibilitätsprozentsatz und konkreten Tipps."
        : "Erstelle eine TEILWEISE und SPANNENDE Antwort mit 150-250 Wörtern. DEUTE wertvolle Infos an, ohne sie zu verraten. Erzeuge NEUGIER. Gib KEINE genauen Prozentsätze. Schließe die Analyse NICHT ab.";

      // ✅ ANTI-BEGRÜSSUNGS-ANWEISUNG
      const greetingControl = isFirstMessage
        ? ""
        : `
⛔ WICHTIGE REGEL - NICHT GRÜSSEN:
- Das ist ein laufendes Gespräch mit ${
            conversationHistory?.length || 0
          } vorherigen Nachrichten
- VERBOTEN: "Hallo!", "Willkommen", "Schön dich kennenzulernen", "Liebe/r", "Wie geht's?"
- Fang DIREKT mit der Antwort an
- Tu so, als wärst du mitten in einem lockeren Gespräch
`;

      const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE ANWEISUNGEN:
${greetingControl}
${responseInstructions}

Nutzer: "${userMessage}"

Antwort der Liebesexpertin (AUF DEUTSCH)${
        !isFirstMessage ? " - OHNE BEGRÜSSUNG, GESPRÄCH DIREKT FORTSETZEN" : ""
      }:`;

      console.log(
        `Erstelle Liebeskompatibilitätsanalyse (${
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
              maxOutputTokens: shouldGiveFullResponse ? 1024 : 512,
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

              const minLength = shouldGiveFullResponse ? 100 : 50;
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
        console.error(
          "❌ Alle Modelle fehlgeschlagen. Fehler:",
          allModelErrors
        );
        throw new Error(
          `Alle KI-Modelle sind gerade nicht verfügbar. Bitte versuch es gleich nochmal.`
        );
      }

      let finalResponse: string;

      if (shouldGiveFullResponse) {
        finalResponse = this.ensureCompleteResponse(text);
      } else {
        finalResponse = this.createPartialResponse(text);
      }

      const chatResponse: LoveCalculatorResponse = {
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
          "Du hast deine 3 kostenlosen Nachrichten verbraucht. Schalte unbegrenzten Zugang frei und entdecke alle Geheimnisse eurer Kompatibilität!";
      }

      console.log(
        `✅ Analyse erstellt (${
          shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"
        }) mit ${usedModel} (${finalResponse.length} Zeichen)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: any, res: Response): void {
    console.error("Fehler im LoveCalculatorController:", error);

    let statusCode = 500;
    let errorMessage = "Interner Serverfehler";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "VALIDATION_ERROR";
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

  public getLoveCalculatorInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        loveExpert: {
          name: "Meisterin Valentina",
          title: "Hüterin der ewigen Liebe",
          specialty: "Numerologische Kompatibilität und Beziehungsanalyse",
          description:
            "Expertin für Liebesnumerologie, spezialisiert auf die Analyse der Kompatibilität zwischen Paaren",
          services: [
            "Numerologische Kompatibilitätsanalyse",
            "Berechnung der Liebeszahlen",
            "Bewertung der Paarchemie",
            "Tipps zur Stärkung von Beziehungen",
          ],
        },
        freeMessagesLimit: this.FREE_MESSAGES_LIMIT,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
