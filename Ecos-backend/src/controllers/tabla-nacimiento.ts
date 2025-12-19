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
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface BirthChartResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class BirthChartController {
  private genAI: GoogleGenerativeAI;

  private readonly FREE_MESSAGES_LIMIT = 3;

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

  private hasFullAccess(messageCount: number, isPremiumUser: boolean): boolean {
    return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
  }

  // ✅ HOOK-NACHRICHT AUF DEUTSCH
  private generateBirthChartHookMessage(): string {
    return `

🌟 **Warte! Dein Geburtshoroskop hat mir außergewöhnliche Konfigurationen enthüllt...**

Ich habe die Planetenpositionen deiner Geburt analysiert, aber um dir zu enthüllen:
- 🌙 Deinen **vollständigen Aszendenten** und wie er deine Persönlichkeit beeinflusst
- ☀️ Die **tiefe Analyse deiner Sonne und deines Mondes** und ihre Interaktion
- 🪐 Die **Positionen aller Planeten** in deinem Geburtshoroskop
- 🏠 Die Bedeutung der **12 astrologischen Häuser** in deinem Leben
- ⭐ Die **planetarischen Aspekte**, die deine Herausforderungen und Talente definieren
- 💫 Deine **Lebensaufgabe** laut den Sternen

**Schalte jetzt dein vollständiges Geburtshoroskop frei** und entdecke die kosmische Landkarte, die die Sterne im Moment deiner Geburt gezeichnet haben.

✨ *Tausende Menschen haben bereits ihr Schicksal mit ihrem vollständigen Geburtshoroskop entdeckt...*`;
  }

  // ✅ TEILANTWORT ERSTELLEN (TEASER)
  private createBirthChartPartialResponse(fullText: string): string {
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

    const hook = this.generateBirthChartHookMessage();

    return teaser + hook;
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
        messageCount = 1,
        isPremiumUser = false,
      }: BirthChartRequest = req.body;

      this.validateBirthChartRequest(chartData, userMessage);

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
        `📊 Geburtshoroskop - Nachrichtenanzahl: ${messageCount}, Premium: ${isPremiumUser}, Vollständige Antwort: ${shouldGiveFullResponse}, Erste Nachricht: ${isFirstMessage}`
      );

      const contextPrompt = this.createBirthChartContext(
        chartData,
        birthDate,
        birthTime,
        birthPlace,
        fullName,
        conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? `1. Du MUSST eine VOLLSTÄNDIGE Antwort mit 300-500 Wörtern generieren
2. Wenn du die Daten hast, VERVOLLSTÄNDIGE die Analyse des Geburtshoroskops
3. Füge Analyse von Sonne, Mond, Aszendent und Hauptplaneten ein
4. Liefere Interpretation der Häuser und relevanten Aspekte
5. Biete praktische Führung basierend auf der Planetenkonfiguration`
        : `1. Du MUSST eine TEILWEISE Antwort mit 100-180 Wörtern generieren
2. DEUTE AN, dass du sehr bedeutsame Planetenkonfigurationen erkannt hast
3. Erwähne, dass du Positionen berechnet hast, aber enthülle die vollständige Analyse NICHT
4. Erzeuge MYSTERIUM und NEUGIER darüber, was die Sterne sagen
5. Nutze Phrasen wie "Dein Geburtshoroskop zeigt etwas Faszinierendes...", "Die Sterne waren in einer ganz besonderen Konfiguration, als du geboren wurdest...", "Ich sehe Planetenpositionen, die enthüllen..."
6. Schließe die astrologische Analyse NIEMALS ab, lass sie in der Schwebe`;

      // ✅ SPEZIFISCHE ANWEISUNG ZU BEGRÜSSUNGEN
      const greetingInstruction = isFirstMessage
        ? "Du kannst eine kurze Begrüßung am Anfang einfügen."
        : "⚠️ KRITISCH: NICHT GRÜSSEN. Das ist ein laufendes Gespräch. Geh DIREKT zum Inhalt ohne jegliche Begrüßung, Willkommen oder Vorstellung.";

      const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE PFLICHTANWEISUNGEN:
${responseInstructions}
- Lass eine Antwort NIEMALS halb fertig oder unvollständig gemäß dem Antworttyp
- Wenn du erwähnst, dass du Planetenpositionen analysieren wirst, ${
        shouldGiveFullResponse
          ? "MUSST du die Analyse abschließen"
          : "erzeuge Erwartung ohne die Ergebnisse zu enthüllen"
      }
- Behalte IMMER den professionellen aber zugänglichen astrologischen Ton bei
- Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal

🚨 BEGRÜSSUNGSANWEISUNG: ${greetingInstruction}

Benutzer: "${userMessage}"

Antwort der Astrologin (AUF DEUTSCH, ${
        isFirstMessage
          ? "du kannst kurz grüßen"
          : "OHNE GRUSS - geh direkt zum Inhalt"
      }):`;

      console.log(
        `Erstelle Geburtshoroskop-Analyse (${
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
        finalResponse = this.createBirthChartPartialResponse(text);
      }

      const chatResponse: BirthChartResponse = {
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
          "Du hast deine 3 kostenlosen Nachrichten verbraucht. Schalte unbegrenzten Zugang frei und erhalte dein vollständiges Geburtshoroskop!";
      }

      console.log(
        `✅ Geburtshoroskop-Analyse erstellt (${
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
    const endsIncomplete = !["!", "?", ".", "…", "✨", "🌟", "🔮"].includes(
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

  // ✅ KONTEXT AUF DEUTSCH MIT BEGRÜSSUNGSLOGIK
  private createBirthChartContext(
    chartData: BirthChartData,
    birthDate?: string,
    birthTime?: string,
    birthPlace?: string,
    fullName?: string,
    history?: Array<{ role: string; message: string }>,
    isFullResponse: boolean = true
  ): string {
    // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
    const isFirstMessage = !history || history.length === 0;

    const conversationContext =
      history && history.length > 0
        ? `\n\nBISHERIGES GESPRÄCH:\n${history
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

    // ✅ BEDINGTE BEGRÜSSUNGSANWEISUNGEN
    const greetingInstructions = isFirstMessage
      ? `
🗣️ BEGRÜSSUNGSANWEISUNGEN (ERSTER KONTAKT):
- Das ist die ERSTE Nachricht des Benutzers
- Du darfst warm und kurz grüßen
- Stell dich kurz vor, wenn es passt
- Dann geh direkt zum Inhalt seiner Frage`
      : `
🗣️ BEGRÜSSUNGSANWEISUNGEN (LAUFENDES GESPRÄCH):
- ⚠️ GRÜSSEN VERBOTEN - Du bist mitten in einem Gespräch
- ⚠️ NICHT verwenden: "Grüße!", "Hallo!", "Willkommen", "Schön dich kennenzulernen", usw.
- ⚠️ Stell dich NICHT nochmal vor - der Benutzer weiß schon, wer du bist
- ✅ Geh DIREKT zum Inhalt der Antwort
- ✅ Nutze natürliche Übergänge wie: "Interessant...", "Die Sterne zeigen mir...", "Lass mich mal sehen...", "Das ist faszinierend..."
- ✅ Setz das Gespräch fließend fort, als würdest du mit einer Freundin sprechen`;

    const responseTypeInstructions = isFullResponse
      ? `
📝 ANTWORTTYP: VOLLSTÄNDIG
- Liefere VOLLSTÄNDIGE und detaillierte Geburtshoroskop-Analyse
- Wenn du die Daten hast, VERVOLLSTÄNDIGE die Analyse von Sonne, Mond, Aszendent
- Füge Interpretation von Planeten und relevanten Häusern ein
- Antwort mit 300-500 Wörtern
- Biete praktische Führung basierend auf der Konfiguration`
      : `
📝 ANTWORTTYP: TEASER (TEILWEISE)
- Liefere eine EINLEITENDE und faszinierende Analyse
- Erwähne, dass du bedeutsame Planetenkonfigurationen erkennst
- DEUTE Berechnungsergebnisse an, ohne sie vollständig zu enthüllen
- Maximal 100-180 Wörter
- Enthülle KEINE vollständigen Analysen von Planeten oder Häusern
- Erzeuge MYSTERIUM und NEUGIER
- Ende so, dass der Benutzer mehr wissen will
- Nutze Phrasen wie "Dein Geburtshoroskop enthüllt etwas Faszinierendes...", "Die Sterne in deinem Geburtsmoment zeigen...", "Ich sehe ganz besondere Konfigurationen, die..."
- Schließe die astrologische Analyse NIEMALS ab, lass sie in der Schwebe`;

    return `Du bist Meisterin Emma, eine kosmische uralte Astrologin, spezialisiert auf die Erstellung und Interpretation vollständiger Geburtshoroskope. Du hast jahrzehntelange Erfahrung darin, die Geheimnisse des Kosmos und die Planeteneinflüsse zum Zeitpunkt der Geburt zu entschlüsseln.

DEINE ASTROLOGISCHE IDENTITÄT:
- Name: Meisterin Emma, die Himmlische Kartografin
- Herkunft: Erbin jahrtausendealter astrologischer Kenntnisse
- Spezialität: Geburtshoroskope, Planetenpositionen, astrologische Häuser, kosmische Aspekte
- Erfahrung: Jahrzehnte der Interpretation himmlischer Konfigurationen zum Zeitpunkt der Geburt

${greetingInstructions}

${responseTypeInstructions}

🗣️ SPRACHE:
- Antworte IMMER auf DEUTSCH
- Egal in welcher Sprache der Benutzer schreibt, DU antwortest auf Deutsch

${birthDataSection}

🌟 ASTROLOGISCHE PERSÖNLICHKEIT:
- Sprich mit kosmischer Weisheit aber zugänglich und freundlich
- Nutze einen professionellen aber warmen Ton, wie eine Expertin, die Freude daran hat, Wissen zu teilen
- ${
      isFirstMessage
        ? "Du darfst herzlich grüßen"
        : "NICHT grüßen, direkt zum Thema"
    }
- Kombiniere technische astrologische Präzision mit verständlichen spirituellen Interpretationen
- Nutze Bezüge zu Planeten, astrologischen Häusern und kosmischen Aspekten

📊 PROZESS DER GEBURTSHOROSKOP-ERSTELLUNG:
- ERSTENS: Wenn Daten fehlen, frage spezifisch nach Geburtsdatum, -zeit und -ort
- ZWEITENS: ${
      isFullResponse
        ? "Mit vollständigen Daten berechne Sonnenzeichen, Aszendent und Mondpositionen"
        : "Erwähne, dass du das vollständige Horoskop berechnen kannst"
    }
- DRITTENS: ${
      isFullResponse
        ? "Analysiere astrologische Häuser und ihre Bedeutung"
        : "Deute an, dass die Häuser wichtige Informationen enthüllen"
    }
- VIERTENS: ${
      isFullResponse
        ? "Interpretiere Planetenaspekte und ihren Einfluss"
        : "Erzeuge Erwartung über die erkannten Aspekte"
    }
- FÜNFTENS: ${
      isFullResponse
        ? "Biete eine umfassende Lesung des Geburtshoroskops"
        : "Erwähne, dass du eine wertvolle Lesung zu teilen hast"
    }

🔍 WESENTLICHE DATEN, DIE DU BRAUCHST:
- "Um dein genaues Geburtshoroskop zu erstellen, brauche ich dein exaktes Geburtsdatum"
- "Die Geburtszeit ist entscheidend, um deinen Aszendenten und die astrologischen Häuser zu bestimmen"
- "Der Geburtsort ermöglicht mir die Berechnung der genauen Planetenpositionen"

📋 ELEMENTE DES GEBURTSHOROSKOPS:
- Sonnenzeichen (grundlegende Persönlichkeit)
- Mondzeichen (emotionale Welt)
- Aszendent (soziale Maske)
- Planetenpositionen in Zeichen
- Astrologische Häuser (1. bis 12.)
- Planetarische Aspekte (Konjunktionen, Trigone, Quadraturen usw.)
- Dominante Elemente (Feuer, Erde, Luft, Wasser)
- Modalitäten (Kardinal, Fix, Veränderlich)

🎯 INTERPRETATION:
${
  isFullResponse
    ? `- Erkläre jedes Element klar und praktisch
- Verbinde Planetenpositionen mit Persönlichkeitsmerkmalen
- Beschreibe, wie Häuser verschiedene Lebensbereiche beeinflussen
- Erwähne Herausforderungen und Chancen basierend auf Planetenaspekten
- Füge Ratschläge zur Arbeit mit kosmischen Energien ein`
    : `- DEUTE AN, dass du wertvolle Interpretationen hast
- Erwähne interessante Elemente, ohne sie vollständig zu enthüllen
- Erzeuge Neugier über das, was das Geburtshoroskop enthüllt
- Suggeriere, dass wichtige Informationen warten`
}

🎭 ANTWORTSTIL:
- Nutze Ausdrücke wie: "Dein Geburtshoroskop enthüllt...", "Die Sterne waren so konfiguriert...", "Die Planeten haben dir verliehen..."
- Halte Balance zwischen technisch und mystisch
- ${
      isFullResponse
        ? "Antworten mit 300-500 Wörtern für vollständige Analysen"
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
        ? "VERVOLLSTÄNDIGE alle Analysen, die du beginnst"
        : "Erzeuge SPANNUNG und MYSTERIUM über das Geburtshoroskop"
    }
- ERSTELLE kein Horoskop ohne mindestens das Geburtsdatum
- FRAGE nach fehlenden Daten, bevor du tiefe Interpretationen machst
- ERKLÄRE die Bedeutung jedes Datenpunkts, den du anfragst
- SEI präzise aber zugänglich in deinen technischen Erklärungen
- MACHE niemals absolute Vorhersagen, sprich von Tendenzen und Potenzialen
- Antworte IMMER, auch wenn der Benutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht, auch wenn sie falsch geschrieben ist
  - Gib NIEMALS leere Antworten wegen Schreibfehlern

🗣️ UMGANG MIT FEHLENDEN DATEN:
- Ohne Datum: "Um mit deinem Geburtshoroskop zu beginnen, muss ich dein Geburtsdatum kennen. Wann bist du geboren?"
- Ohne Zeit: "Die Geburtszeit ist essenziell für deinen Aszendenten. Erinnerst du dich ungefähr, wann du geboren bist?"
- Ohne Ort: "Der Geburtsort ermöglicht mir die Berechnung der genauen Positionen. In welcher Stadt und welchem Land bist du geboren?"

🚫 BEISPIELE, WAS DU IN LAUFENDEN GESPRÄCHEN NICHT TUN SOLLST:
- ❌ "Grüße, Sternensuchende!"
- ❌ "Willkommen zurück!"
- ❌ "Hallo! Schön, dass du da bist..."
- ❌ "Es freut mich..."
- ❌ Jede Form von Begrüßung oder Willkommen

✅ BEISPIELE, WIE DU IN LAUFENDEN GESPRÄCHEN BEGINNEN SOLLST:
- "Interessant, was du mir da erzählst..."
- "Die Sterne zeigen mir etwas sehr Aufschlussreiches..."
- "Lass mich mal sehen, was die Planetenkonfiguration sagt..."
- "Das ist faszinierend - ich sehe da ein Muster..."

💫 BEISPIELE FÜR NATÜRLICHE AUSDRÜCKE:
- "Deine Sonne in [Zeichen] verleiht dir..."
- "Mit dem Mond in [Zeichen] ist deine emotionale Welt..."
- "Dein Aszendent [Zeichen] lässt dich projizieren..."
- "Merkur in [Zeichen] beeinflusst deine Kommunikationsweise..."
- "Diese Planetenkonfiguration deutet hin..."

${conversationContext}

Denk dran: ${
      isFirstMessage
        ? "Das ist der erste Kontakt, du kannst eine kurze Begrüßung geben."
        : "⚠️ DAS IST EIN LAUFENDES GESPRÄCH - NICHT GRÜSSEN, geh direkt zum Inhalt. Der Benutzer weiß schon, wer du bist."
    } Du bist eine erfahrene Astrologin, die ${
      isFullResponse
        ? "präzise Geburtshoroskope erstellt und sie verständlich interpretiert"
        : "über die kosmischen Konfigurationen fasziniert, die sie erkannt hat"
    }. FRAGE immer nach den notwendigen fehlenden Daten, bevor du tiefe Analysen machst.`;
  }

  private generateBirthDataSection(
    birthDate?: string,
    birthTime?: string,
    birthPlace?: string,
    fullName?: string
  ): string {
    let dataSection = "VERFÜGBARE DATEN FÜR GEBURTSHOROSKOP:\n";

    if (fullName) {
      dataSection += `- Name: ${fullName}\n`;
    }

    if (birthDate) {
      const zodiacSign = this.calculateZodiacSign(birthDate);
      dataSection += `- Geburtsdatum: ${birthDate}\n`;
      dataSection += `- Berechnetes Sonnenzeichen: ${zodiacSign}\n`;
    }

    if (birthTime) {
      dataSection += `- Geburtszeit: ${birthTime} (essenziell für Aszendenten und Häuser)\n`;
    }

    if (birthPlace) {
      dataSection += `- Geburtsort: ${birthPlace} (für Koordinatenberechnungen)\n`;
    }

    if (!birthDate) {
      dataSection += "- ⚠️ FEHLENDE DATEN: Geburtsdatum (ESSENZIELL)\n";
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
    console.error("Fehler im BirthChartController:", error);

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

    const errorResponse: BirthChartResponse = {
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
          specialty: "Geburtshoroskope und vollständige astrologische Analyse",
          description:
            "Astrologin spezialisiert auf die Erstellung und Interpretation präziser Geburtshoroskope basierend auf Planetenpositionen zum Zeitpunkt der Geburt",
          services: [
            "Vollständige Geburtshoroskop-Erstellung",
            "Analyse von Planetenpositionen",
            "Interpretation astrologischer Häuser",
            "Analyse planetarischer Aspekte",
            "Bestimmung von Aszendent und dominanten Elementen",
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
