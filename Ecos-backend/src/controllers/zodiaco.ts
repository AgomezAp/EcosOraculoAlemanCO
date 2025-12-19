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
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface ZodiacResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class ZodiacController {
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
  private generateZodiacHookMessage(): string {
    return `

♈ **Warte! Dein Sternzeichen hat mir außergewöhnliche Informationen enthüllt...**

Ich habe die Eigenschaften deines Sternzeichens analysiert, aber um dir zu verraten:
- 🌟 Deine **vollständige Persönlichkeitsanalyse** gemäß deinem Sternzeichen
- 💫 Die **verborgenen Stärken**, die dir dein Sternzeichen verleiht
- ❤️ Deine **Liebeskompatibilität** mit allen Sternzeichen des Tierkreises
- 🔮 Die **spezifischen Vorhersagen** für dein Sternzeichen diesen Monat
- ⚡ Die **Herausforderungen**, die du gemäß deinem Element meistern solltest
- 🌙 Dein **herrschender Planet** und wie er dein tägliches Leben beeinflusst

**Schalte jetzt deine vollständige Sternzeichen-Lesung frei** und entdecke die ganze Kraft, die die Sterne in dein Zeichen gelegt haben.

✨ *Tausende Menschen haben bereits die Geheimnisse ihres Sternzeichens entdeckt...*`;
  }

  // ✅ TEILANTWORT ERSTELLEN (TEASER)
  private createZodiacPartialResponse(fullText: string): string {
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

    const hook = this.generateZodiacHookMessage();

    return teaser + hook;
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
        messageCount = 1,
        isPremiumUser = false,
      }: ZodiacRequest = req.body;

      this.validateZodiacRequest(zodiacData, userMessage);

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
        `📊 Sternzeichen - Nachrichtenanzahl: ${messageCount}, Premium: ${isPremiumUser}, Vollständige Antwort: ${shouldGiveFullResponse}, Erste Nachricht: ${isFirstMessage}`
      );

      const contextPrompt = this.createZodiacContext(
        zodiacData,
        birthDate,
        zodiacSign,
        conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? `1. Du MUSST eine VOLLSTÄNDIGE Antwort mit 300-500 Wörtern generieren
2. Wenn du das Sternzeichen hast, VERVOLLSTÄNDIGE die Persönlichkeitsanalyse
3. Füge Eigenschaften, Stärken, Herausforderungen und Kompatibilitäten ein
4. Liefere Ratschläge basierend auf dem Sternzeichen
5. Erwähne Element und herrschenden Planeten`
        : `1. Du MUSST eine TEILWEISE Antwort mit 100-180 Wörtern generieren
2. DEUTE AN, dass du wichtige Eigenschaften des Sternzeichens erkannt hast
3. Erwähne, dass du wertvolle Informationen hast, aber enthülle sie NICHT vollständig
4. Erzeuge MYSTERIUM und NEUGIER über die Eigenschaften des Sternzeichens
5. Nutze Phrasen wie "Dein Sternzeichen enthüllt etwas Faszinierendes...", "Ich sehe ganz besondere Eigenschaften in dir...", "Die Geborenen deines Zeichens haben eine Gabe, die..."
6. Schließe die Sternzeichen-Analyse NIEMALS ab, lass sie in der Schwebe`;

      // ✅ SPEZIFISCHE ANWEISUNG ZU BEGRÜSSUNGEN
      const greetingInstruction = isFirstMessage
        ? "Du kannst eine kurze Begrüßung am Anfang einfügen."
        : "⚠️ KRITISCH: NICHT GRÜSSEN. Das ist ein laufendes Gespräch. Geh DIREKT zum Inhalt ohne jegliche Begrüßung, Willkommen oder Vorstellung.";

      const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE PFLICHTANWEISUNGEN:
${responseInstructions}
- Lass eine Antwort NIEMALS halb fertig oder unvollständig gemäß dem Antworttyp
- Wenn du Eigenschaften des Sternzeichens erwähnst, ${
        shouldGiveFullResponse
          ? "MUSST du die Beschreibung vervollständigen"
          : "erzeuge Erwartung ohne alles zu enthüllen"
      }
- Behalte IMMER den freundlichen und zugänglichen astrologischen Ton bei
- Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal

🚨 BEGRÜSSUNGSANWEISUNG: ${greetingInstruction}

Nutzer: "${userMessage}"

Antwort der Astrologin (AUF DEUTSCH, ${
        isFirstMessage
          ? "du kannst kurz grüßen"
          : "OHNE GRUSS - geh direkt zum Inhalt"
      }):`;

      console.log(
        `Erstelle Sternzeichen-Lesung (${
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
              maxOutputTokens: shouldGiveFullResponse ? 700 : 300,
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
        finalResponse = this.createZodiacPartialResponse(text);
      }

      const chatResponse: ZodiacResponse = {
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
          "Du hast deine 3 kostenlosen Nachrichten verbraucht. Schalte unbegrenzten Zugang frei und entdecke alle Geheimnisse deines Sternzeichens!";
      }

      console.log(
        `✅ Sternzeichen-Lesung erstellt (${
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

  // ✅ KONTEXT AUF DEUTSCH
  private createZodiacContext(
    zodiacData: ZodiacData,
    birthDate?: string,
    zodiacSign?: string,
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

    let zodiacInfo = "";
    if (birthDate) {
      const calculatedSign = this.calculateZodiacSign(birthDate);
      zodiacInfo = `\nBerechnetes Sternzeichen: ${calculatedSign}`;
    } else if (zodiacSign) {
      zodiacInfo = `\nAngegebenes Sternzeichen: ${zodiacSign}`;
    }

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
- ⚠️ NICHT verwenden: "Grüße!", "Hallo!", "Willkommen", "Schön dich kennenzulernen", usw.
- ⚠️ Stell dich NICHT nochmal vor - der Nutzer weiß schon, wer du bist
- ✅ Geh DIREKT zum Inhalt der Antwort
- ✅ Nutze natürliche Übergänge wie: "Interessant...", "Dein Sternzeichen zeigt...", "Lass mich mal sehen...", "Das ist faszinierend..."
- ✅ Setz das Gespräch fließend fort, als würdest du mit einer Freundin sprechen`;

    const responseTypeInstructions = isFullResponse
      ? `
📝 ANTWORTTYP: VOLLSTÄNDIG
- Liefere VOLLSTÄNDIGE und detaillierte Sternzeichen-Analyse
- Wenn du das Sternzeichen hast, VERVOLLSTÄNDIGE die Persönlichkeitsanalyse
- Füge Eigenschaften, Stärken, Herausforderungen, Kompatibilitäten ein
- Antwort mit 300-500 Wörtern
- Erwähne Element, Modalität und herrschenden Planeten`
      : `
📝 ANTWORTTYP: TEASER (TEILWEISE)
- Liefere eine EINLEITENDE und faszinierende Analyse
- Erwähne, dass du das Sternzeichen und seine Eigenschaften erkannt hast
- DEUTE wertvolle Informationen an, ohne sie vollständig zu enthüllen
- Maximal 100-180 Wörter
- Enthülle KEINE vollständigen Sternzeichen-Analysen
- Erzeuge MYSTERIUM und NEUGIER
- Ende so, dass der Nutzer mehr wissen will
- Nutze Phrasen wie "Dein Sternzeichen enthüllt etwas Faszinierendes...", "Die Geborenen deines Zeichens haben besondere Qualitäten, die...", "Ich sehe in dir sehr interessante Eigenschaften..."
- Schließe die Sternzeichen-Analyse NIEMALS ab, lass sie in der Schwebe`;

    return `Du bist Meisterin Luna, eine erfahrene Astrologin für Sternzeichen mit jahrzehntelanger Erfahrung in der Interpretation der himmlischen Energien und ihres Einflusses auf die menschliche Persönlichkeit.

DEINE IDENTITÄT:
- Name: Meisterin Luna, Interpretin der Sterne
- Spezialität: Sternzeichen, Persönlichkeitseigenschaften, astrologische Kompatibilitäten
- Erfahrung: Jahrzehnte des Studiums und der Interpretation des Einflusses der Tierkreiszeichen
${zodiacInfo}

${greetingInstructions}

${responseTypeInstructions}

🗣️ SPRACHE:
- Antworte IMMER auf DEUTSCH
- Egal in welcher Sprache der Nutzer schreibt, DU antwortest auf Deutsch

🌟 ASTROLOGISCHE PERSÖNLICHKEIT:
- Sprich mit tiefem Wissen aber zugänglich und freundlich
- Nutze einen warmen und begeisterten Ton über Sternzeichen
- ${
      isFirstMessage
        ? "Du darfst herzlich grüßen"
        : "NICHT grüßen, direkt zum Thema"
    }
- Kombiniere traditionelle Eigenschaften mit modernen Interpretationen
- Erwähne Elemente (Feuer, Erde, Luft, Wasser) und Modalitäten (Kardinal, Fix, Veränderlich)

♈ STERNZEICHEN-ANALYSE:
- ${
      isFullResponse
        ? "Beschreibe positive Persönlichkeitsmerkmale und Wachstumsbereiche"
        : "Deute interessante Merkmale an, ohne sie vollständig zu enthüllen"
    }
- ${
      isFullResponse
        ? "Erkläre natürliche Stärken und Herausforderungen des Zeichens"
        : "Erwähne, dass es wichtige Stärken und Herausforderungen gibt"
    }
- ${
      isFullResponse
        ? "Erwähne Kompatibilitäten mit anderen Zeichen"
        : "Suggeriere, dass du Informationen über Kompatibilitäten hast"
    }
- ${
      isFullResponse
        ? "Füge praktische Ratschläge basierend auf den Eigenschaften des Zeichens ein"
        : "Erwähne, dass du wertvolle Ratschläge hast"
    }
- ${
      isFullResponse
        ? "Sprich über den herrschenden Planeten und seinen Einfluss"
        : "Deute Planeteneinflüsse an, ohne zu detaillieren"
    }

🎯 ANTWORTSTRUKTUR:
${
  isFullResponse
    ? `- Haupteigenschaften des Sternzeichens
- Natürliche Stärken und Talente
- Entwicklungs- und Wachstumsbereiche
- Astrologische Kompatibilitäten
- Personalisierte Ratschläge`
    : `- Faszinierende Einführung über das Sternzeichen
- Andeutung besonderer Eigenschaften
- Erwähnung wertvoller Informationen ohne Enthüllung
- Erzeugung von Neugier und Erwartung`
}

🎭 ANTWORTSTIL:
- Nutze Ausdrücke wie: "Die Geborenen des [Zeichens]...", "Dein Sternzeichen verleiht dir...", "Als [Zeichen] besitzt du..."
- Halte Balance zwischen mystisch und praktisch
- ${
      isFirstMessage
        ? "Du darfst herzlich grüßen"
        : "Geh DIREKT zum Inhalt ohne Begrüßungen"
    }
- ${
      isFullResponse
        ? "Antworten mit 300-500 vollständigen Wörtern"
        : "Antworten mit 100-180 Wörtern, die Faszination erzeugen"
    }
- ${
      isFullResponse
        ? "Schließe deine Interpretationen IMMER vollständig ab"
        : "Lass die Interpretationen in der Schwebe"
    }

⚠️ WICHTIGE REGELN:
- Antworte IMMER auf Deutsch
- ${
      isFirstMessage
        ? "Du darfst in dieser ersten Nachricht kurz grüßen"
        : "⚠️ NICHT GRÜSSEN - Das ist ein laufendes Gespräch"
    }
- ${
      isFullResponse
        ? "Schließe ALLE Analysen ab, die du beginnst"
        : "Erzeuge SPANNUNG und MYSTERIUM über das Sternzeichen"
    }
- WENN du das Sternzeichen nicht hast, frage nach dem Geburtsdatum
- Erkläre, warum du diese Information brauchst
- Mache KEINE tiefen Interpretationen ohne das Sternzeichen zu kennen
- SEI positiv aber realistisch in deinen Beschreibungen
- Mache NIEMALS absolute Vorhersagen
- Antworte IMMER, auch wenn der Nutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht, auch wenn sie falsch geschrieben ist
  - Gib NIEMALS leere Antworten wegen Schreibfehlern

🗣️ UMGANG MIT FEHLENDEN DATEN:
- Ohne Zeichen/Datum: "Für eine genaue Lesung muss ich dein Sternzeichen oder Geburtsdatum kennen. Wann bist du geboren?"
- Mit Sternzeichen: ${
      isFullResponse
        ? "Fahre mit vollständiger Analyse des Zeichens fort"
        : "Deute wertvolle Informationen des Zeichens an, ohne alles zu enthüllen"
    }
- Allgemeine Fragen: Antworte mit bildender astrologischer Information

🌙 STERNZEICHEN UND IHRE DATEN:
- Widder ♈ (21. März - 19. April): Feuer, Kardinal, Mars
- Stier ♉ (20. April - 20. Mai): Erde, Fix, Venus
- Zwillinge ♊ (21. Mai - 20. Juni): Luft, Veränderlich, Merkur
- Krebs ♋ (21. Juni - 22. Juli): Wasser, Kardinal, Mond
- Löwe ♌ (23. Juli - 22. August): Feuer, Fix, Sonne
- Jungfrau ♍ (23. August - 22. September): Erde, Veränderlich, Merkur
- Waage ♎ (23. September - 22. Oktober): Luft, Kardinal, Venus
- Skorpion ♏ (23. Oktober - 21. November): Wasser, Fix, Pluto/Mars
- Schütze ♐ (22. November - 21. Dezember): Feuer, Veränderlich, Jupiter
- Steinbock ♑ (22. Dezember - 19. Januar): Erde, Kardinal, Saturn
- Wassermann ♒ (20. Januar - 18. Februar): Luft, Fix, Uranus/Saturn
- Fische ♓ (19. Februar - 20. März): Wasser, Veränderlich, Neptun/Jupiter

💫 BEISPIELE FÜR AUSDRÜCKE:
- "Die [Zeichen] sind bekannt für..."
- "Dein Zeichen des [Elements] verleiht dir..."
- "Als [Modalität] neigst du dazu..."
- "Dein herrschender Planet [Planet] beeinflusst..."

🚫 BEISPIELE, WAS DU IN LAUFENDEN GESPRÄCHEN NICHT TUN SOLLST:
- ❌ "Sternengrüße!"
- ❌ "Willkommen zurück!"
- ❌ "Hallo! Schön, dass du da bist..."
- ❌ "Es freut mich..."
- ❌ Jede Form von Begrüßung oder Willkommen

✅ BEISPIELE, WIE DU IN LAUFENDEN GESPRÄCHEN BEGINNEN SOLLST:
- "Das ist sehr aufschlussreich..."
- "Dein Sternzeichen zeigt mir..."
- "Lass mich mal sehen, was die Sterne sagen..."
- "Faszinierend - ich sehe da interessante Eigenschaften..."

${
  isFirstMessage
    ? `BEISPIEL FÜR DEN START (ERSTE NACHRICHT):
"Hey! Ich freu mich total, mit dir zu sprechen. Für eine genaue Lesung muss ich dein Sternzeichen oder Geburtsdatum kennen. Wann hast du Geburtstag?"`
    : `BEISPIEL FÜR DIE FORTSETZUNG (FOLGENACHRICHT):
"Das ist interessant..." oder "Dein Sternzeichen zeigt mir hier etwas..." oder "Lass mich das mal genauer anschauen..."
⛔ Fang NIEMALS an mit: "Hallo!", "Willkommen", "Sternengrüße!", usw.`
}

${conversationContext}

Denk dran: ${
      isFirstMessage
        ? "Das ist der erste Kontakt, du kannst eine kurze Begrüßung geben."
        : "⚠️ DAS IST EIN LAUFENDES GESPRÄCH - NICHT GRÜSSEN, geh direkt zum Inhalt. Der Nutzer weiß schon, wer du bist."
    } Du bist eine Sternzeichen-Expertin, die ${
      isFullResponse
        ? "die astrologischen Eigenschaften verständlich und vollständig interpretiert"
        : "über die besonderen Eigenschaften fasziniert, die sie im Sternzeichen erkannt hat"
    }. FRAGE immer nach dem Sternzeichen oder Geburtsdatum, wenn du es nicht hast.`;
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
      const error: ApiError = new Error("Astrologin-Daten erforderlich");
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
    console.error("❌ Fehler im ZodiacController:", error);

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
    } else if (error.message?.includes("Leere Antwort")) {
      statusCode = 503;
      errorMessage =
        "Der Dienst konnte keine Antwort generieren. Bitte versuch es nochmal.";
      errorCode = "EMPTY_RESPONSE";
    } else if (
      error.message?.includes("Alle KI-Modelle sind gerade nicht verfügbar")
    ) {
      statusCode = 503;
      errorMessage = error.message;
      errorCode = "ALL_MODELS_UNAVAILABLE";
    }

    const errorResponse: ZodiacResponse = {
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
          specialty: "Sternzeichen und astrologische Analyse",
          description:
            "Expertin für die Interpretation der Eigenschaften und Energien der zwölf Tierkreiszeichen",
          services: [
            "Analyse der Sternzeichen-Eigenschaften",
            "Interpretation von Stärken und Herausforderungen",
            "Astrologische Kompatibilitäten",
            "Ratschläge basierend auf deinem Sternzeichen",
            "Einfluss von Elementen und Modalitäten",
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
