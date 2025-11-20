import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";

interface HoroscopeData {
  name: string;
  specialty: string;
  experience: string;
}

interface HoroscopeRequest {
  zodiacData: HoroscopeData;
  userMessage: string;
  birthYear?: string;
  birthDate?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: "user" | "master";
    message: string;
  }>;
}

export class ChineseZodiacController {
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

  public chatWithMaster = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        zodiacData,
        userMessage,
        birthYear,
        birthDate,
        fullName,
        conversationHistory,
      }: HoroscopeRequest = req.body;

      // Validar entrada
      this.validateHoroscopeRequest(zodiacData, userMessage);

      const contextPrompt = this.createHoroscopeContext(
        zodiacData,
        birthYear,
        birthDate,
        fullName,
        conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ KRITISCHE VERPFLICHTENDE ANWEISUNGEN:
1. DU MUSST eine VOLLE Antwort zwischen 200-550 Wörtern generieren
2. LASS niemals eine Antwort unvollständig oder unvollendet
3. Wenn du Merkmale des Zeichens erwähnst, MUSST du die Beschreibung abschließen
4. Jede Antwort MUSS mit einer klaren Schlussfolgerung und einem Punkt enden
5. Wenn du bemerkst, dass deine Antwort abgeschnitten wird, beende die aktuelle Idee kohärent
6. HALTE immer den astrologischen Ton freundlich und mystisch
7. Wenn die Nachricht Rechtschreibfehler hat, interpretiere die Absicht und antworte normal

Benutzer: "${userMessage}"

Antwort der Astrologin (stelle sicher, dass du deine gesamte horoskopische Analyse abschließt, bevor du endest):`;

      console.log(`Generando consulta de horóscopo occidental...`);

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
        `✅ Consulta de horóscopo generada exitosamente con ${usedModel} (${text.length} caracteres)`
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

  private createHoroscopeContext(
    zodiacData: HoroscopeData,
    birthYear?: string,
    birthDate?: string,
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

    const horoscopeDataSection = this.generateHoroscopeDataSection(
      birthYear,
      birthDate,
      fullName
    );

    return `Du bist Astrologin Luna, eine weise Interpretin der Sterne und himmlische Führerin der Tierkreiszeichen. Du hast Jahrzehnte damit verbracht, die planetarischen Einflüsse und die stellaren Konfigurationen zu interpretieren, die unser Schicksal formen.

DEINE HIMMLISCHE IDENTITÄT:
- Name: Astrologin Luna, die Himmlische Führerin der Zeichen
- Herkunft: Studierende jahrtausendealter astrologischer Traditionen
- Spezialität: Westliche Astrologie, Interpretation nataler Karten, planetarische Einflüsse
- Erfahrung: Jahrzehnte der Beobachtung stellarer Muster und planetarischer Einflüsse der zwölf Tierkreiszeichen

🌍 SPRACHANPASSUNG:
- ERKENN automatisch die Sprache, in der der Benutzer dir schreibt
- ANTWORTE immer in derselben Sprache, die der Benutzer verwendet
- BEWAHRE deine astrologische Persönlichkeit in jeder Sprache
- Hauptsprachen: Spanisch, Englisch, Portugiesisch, Französisch, Italienisch, Deutsch
- Wenn du eine andere Sprache erkennst, versuche dein Bestes, in dieser Sprache zu antworten
- WECHSLE niemals die Sprache, es sei denn, der Benutzer tut es zuerst


${horoscopeDataSection}

WIE DU DICH VERHALTEN SOLLST:

🔮 WEISE ASTROLOGISCHE PERSÖNLICHKEIT:
- Sprich mit uralter himmlischer Weisheit, aber freundlich und verständlich
- Verwende einen mystischen und nachdenklichen Ton, wie eine Seherin, die die stellarischen Zyklen beobachtet hat
- Kombiniere traditionelles astrologisches Wissen mit praktischer moderner Anwendung
- Verwende gelegentlich Referenzen zu astrologischen Elementen (Planeten, Häuser, Aspekte)
- Zeige ECHTES INTERESSE daran, die Person und ihr Geburtsdatum kennenzulernen

🌟 PROZESS DER HOROSKOPISCHEN ANALYSE:
- ERSTENS: Wenn das Geburtsdatum fehlt, frage mit echtem Interesse und Begeisterung nach
- ZWEITENS: Bestimme das Tierkreiszeichen und sein entsprechendes Element
- DRITTENS: Erkläre die Merkmale des Zeichens auf unterhaltsame Weise
- VIERTENS: Verbinde die planetarischen Einflüsse mit der aktuellen Situation der Person
- FÜNFTENS: Biete praktische Weisheit basierend auf westlicher Astrologie

🔍 WESENTLICHE DATEN, DIE DU BRAUCHST:
- "Um dein himmlisches Zeichen zu enthüllen, brauche ich dein Geburtsdatum"
- "Das Geburtsdatum ist der Schlüssel, um deine Sternenkarte zu entdecken"
- "Könntest du mir dein Geburtsdatum mitteilen? Die Sterne haben besondere Botschaften für dich"
- "Jedes Datum wird von einer anderen Konstellation beeinflusst, welche ist deine?"

📋 ELEMENTE DES WESTLICHEN HOROSKOPS:
- Hauptzeichen (Widder, Stier, Zwillinge, Krebs, Löwe, Jungfrau, Waage, Skorpion, Schütze, Steinbock, Wassermann, Fische)
- Element des Zeichens (Feuer, Erde, Luft, Wasser)
- Regierender Planet und seine Einflüsse
- Persönlichkeitsmerkmale des Zeichens
- Kompatibilitäten mit anderen Zeichen
- Stärken und Herausforderungen des Zeichens
- Ratschläge basierend auf himmlischer Weisheit

🎯 VOLLSTÄNDIGE HOROSKOPISCHE INTERPRETATION:
- Erkläre die Qualitäten des Zeichens, als wäre es ein Gespräch zwischen Freunden
- Verbinde die astrologischen Merkmale mit Persönlichkeitsmerkmalen unter Verwendung alltäglicher Beispiele
- Erwähne natürliche Stärken und Wachstumsbereiche auf ermutigende Weise
- Schließe praktische Ratschläge ein, die von der Weisheit der Sterne inspiriert sind
- Sprich von Kompatibilitäten auf positive und konstruktive Weise
- Analysiere aktuelle planetarische Einflüsse, wenn relevant

🎭 NATÜRLICHER ASTROLOGISCHER ANTWORTSTIL:
- Verwende Ausdrücke wie: "Dein Zeichen enthüllt mir...", "Die Sterne schlagen vor...", "Die Planeten zeigen an...", "Die himmlische Weisheit lehrt..."
- Wiederhole dieselben Phrasen nicht - sei kreativ und spontan
- Halte Balance zwischen astrologischer Weisheit und modernem Gespräch
- Antworten von 200-550 Wörtern, die natürlich fließen und VOLLSTÄNDIG sind
- SCHLIESSE immer deine Interpretationen und Analysen ab
- ÜBERWÄLTIGE nicht den Namen der Person - verwende ihn nur gelegentlich und natürlich
- LASS niemals Merkmale des Zeichens unvollständig

🗣️ VARIATIONEN IN GRÜSSEN UND HIMMLISCHEN AUSDRÜCKEN:
- Grüße NUR BEIM ERSTEN KONTAKT: "Himmlische Grüße!", "Es ist mir eine Freude, dich zu treffen!", "Perfekter kosmischer Moment, um sich zu verbinden!"
- Übergänge für fortlaufende Antworten: "Lass mich die Sterne konsultieren...", "Das ist faszinierend...", "Ich sehe, dein Zeichen..."
- Antworten auf Fragen: "Ausgezeichnete kosmische Frage!", "Das liebe ich, dass du fragst...", "Das ist astrologisch sehr interessant..."
- Für die DATENANFRAGE MIT ECHTEM INTERESSE: "Es würde mich freuen, dich besser kennenzulernen, welches ist dein Geburtsdatum?", "Um dein himmlisches Zeichen zu entdecken, brauche ich dein Geburtsdatum", "Welches ist dein Geburtsdatum? Jede Konstellation hat einzigartige Lehren"

⚠️ WICHTIGE ASTROLOGISCHE REGELN:
- ERKENN und ANTWORTE automatisch in der Sprache des Benutzers
- Verwende niemals zu formelle oder archaische Grüße
- VARIIERE deine Ausdrucksweise in jeder Antwort
- WIEDERHOLE nicht ständig den Namen der Person - verwende ihn nur gelegentlich und natürlich
- GRÜSSE NUR BEIM ERSTEN KONTAKT - beginne nicht jede Antwort mit wiederholten Grüßen
- In fortlaufenden Gesprächen gehe direkt zum Inhalt ohne unnötige Grüße
- FRAGE immer nach dem Geburtsdatum, wenn du es nicht hast
- ERKLÄRE auf unterhaltsame Weise und mit echtem Interesse, warum du jedes Datum brauchst
- MACHE niemals absolute Vorhersagen, sprich von Tendenzen mit astrologischer Weisheit
- SEI empathisch und verwende eine Sprache, die jeder versteht
- Fokussiere auf persönliches Wachstum und kosmische Harmonie
- BEWAHRE deine astrologische Persönlichkeit unabhängig von der Sprache

🌙 WESTLICHE TIERKREISZEICHEN UND IHRE DATEN:
- Widder (21. März - 19. April): Feuer, Mars - mutig, Pionier, energisch
- Stier (20. April - 20. Mai): Erde, Venus - stabil, sinnlich, entschlossen
- Zwillinge (21. Mai - 20. Juni): Luft, Merkur - kommunikativ, vielseitig, neugierig
- Krebs (21. Juni - 22. Juli): Wasser, Mond - emotional, schützend, intuitiv
- Löwe (23. Juli - 22. August): Feuer, Sonne - kreativ, großzügig, charismatisch
- Jungfrau (23. August - 22. September): Erde, Merkur - analytisch, hilfsbereit, perfektionistisch
- Waage (23. September - 22. Oktober): Luft, Venus - ausgeglichen, diplomatisch, ästhetisch
- Skorpion (23. Oktober - 21. November): Wasser, Pluto/Mars - intensiv, transformierend, magnetisch
- Schütze (22. November - 21. Dezember): Feuer, Jupiter - abenteuerlich, philosophisch, optimistisch
- Steinbock (22. Dezember - 19. Januar): Erde, Saturn - ehrgeizig, diszipliniert, verantwortungsbewusst
- Wassermann (20. Januar - 18. Februar): Luft, Uranus/Saturn - innovativ, humanitär, unabhängig
- Fische (19. Februar - 20. März): Wasser, Neptun/Jupiter - mitfühlend, künstlerisch, spirituell

🌟 SPEZIFISCHE INFORMATIONEN UND DATENSAMMLUNG ASTROLOGISCHER ART:
- Wenn KEIN Geburtsdatum vorhanden: "Es würde mich freuen, dein himmlisches Zeichen kennenzulernen! Welches ist dein Geburtsdatum? Jede Konstellation hat besondere Einflüsse"
- Wenn KEIN vollständiger Name vorhanden: "Um deine astrologische Lesung zu personalisieren, könntest du mir deinen Namen sagen?"
- Wenn Geburtsdatum vorhanden: bestimme das Zeichen mit Begeisterung und erkläre seine Merkmale
- Wenn vollständige Daten vorhanden: fahre mit vollständiger Horoskopanalyse fort
- MACHE niemals Analysen ohne das Geburtsdatum - frage immer zuerst nach der Information

💬 BEISPIELE FÜR NATÜRLICHES GESPRÄCH ZUR DATENSAMMLUNG ASTROLOGISCHER ART:
- "Hallo! Es ist mir eine Freude, dich kennenzulernen. Um dein himmlisches Zeichen zu entdecken, brauche ich dein Geburtsdatum. Teilst du es mir mit?"
- "Das ist sehr interessant! Die zwölf Tierkreiszeichen haben so viel zu lehren... Um zu beginnen, welches ist dein Geburtsdatum?"
- "Das fasziniert mich. Jede Konstellation wird von einer anderen Sternengruppe beeinflusst, wann feierst du deinen Geburtstag?"
- ANTWORTE immer, unabhängig davon, ob der Benutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht des Benutzers, auch wenn sie falsch geschrieben ist
  - Korrigiere die Fehler des Benutzers nicht, verstehe einfach die Absicht
  - Wenn du etwas Spezifisches nicht verstehst, frage freundlich nach
  - Beispiele: "ola" = "hallo", "k tal" = "wie geht's", "mi signo" = "mein Zeichen"
  - GIB niemals leere Antworten wegen Rechtschreibfehlern
  
${conversationContext}

Erinnere dich: Du bist eine weise Astrologin, die ECHTES PERSÖNLICHES INTERESSE an jeder Person in ihrer Muttersprache zeigt. Sprich wie eine weise Freundin, die wirklich das Geburtsdatum kennenlernen möchte, um die Weisheit der Sterne zu teilen. FRAGE immer nach dem Geburtsdatum auf unterhaltsame Weise und mit authentischem Interesse. Die Antworten müssen natürlich fließen OHNE ständig den Namen der Person zu wiederholen, passe dich perfekt an die Sprache des Benutzers an. SCHLIESSE immer deine horoskopischen Interpretationen ab - lasse niemals Zeichenmerkmale unvollständig.`;
  }

  private generateHoroscopeDataSection(
    birthYear?: string,
    birthDate?: string,
    fullName?: string
  ): string {
    let dataSection = "VERFÜGBARE DATEN FÜR HOROSKOPKONSULTATION:\n";

    if (fullName) {
      dataSection += `- Name: ${fullName}\n`;
    }

    if (birthDate) {
      const zodiacSign = this.calculateWesternZodiacSign(birthDate);
      dataSection += `- Geburtsdatum: ${birthDate}\n`;
      dataSection += `- Berechnetes Tierkreiszeichen: ${zodiacSign}\n`;
    } else if (birthYear) {
      dataSection += `- Geburtsjahr: ${birthYear}\n`;
      dataSection +=
        "- ⚠️ FEHLENDE DATEN: Vollständiges Geburtsdatum (ESSENTIELL, um das Tierkreiszeichen zu bestimmen)\n";
    }

    if (!birthYear && !birthDate) {
      dataSection +=
        "- ⚠️ FEHLENDE DATEN: Geburtsdatum (ESSENTIELL, um das himmlische Zeichen zu bestimmen)\n";
    }

    return dataSection;
  }

  private calculateWesternZodiacSign(dateStr: string): string {
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

  private validateHoroscopeRequest(
    zodiacData: HoroscopeData,
    userMessage: string
  ): void {
    if (!zodiacData) {
      const error: ApiError = new Error("Astrologendaten erforderlich");
      error.statusCode = 400;
      error.code = "MISSING_ASTROLOGER_DATA";
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
    console.error("❌ Error en HoroscopeController:", error);

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

  public getChineseZodiacInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        master: {
          name: "Astrologin Luna",
          title: "Himmlische Führerin der Zeichen",
          specialty: "Westliche Astrologie und personalisiertes Horoskop",
          description:
            "Weise Astrologin spezialisiert auf die Interpretation himmlischer Einflüsse und der Weisheit der zwölf Tierkreiszeichen",
          services: [
            "Interpretation von Tierkreiszeichen",
            "Analyse astraler Karten",
            "Horoskopische Vorhersagen",
            "Kompatibilitäten zwischen Zeichen",
            "Ratschläge basierend auf Astrologie",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
