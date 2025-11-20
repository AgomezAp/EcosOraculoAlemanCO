"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class ChatController {
    constructor() {
        // ✅ LISTE DER AUSWECHSELMODELLE (nach Präferenz)
        this.MODELS_FALLBACK = [
            "gemini-2.0-flash-exp",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ];
        this.chatWithNumerologist = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { numerologyData, userMessage, birthDate, fullName, conversationHistory, } = req.body;
                // Validar entrada
                this.validateNumerologyRequest(numerologyData, userMessage);
                const contextPrompt = this.createNumerologyContext(conversationHistory);
                const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE ANWEISUNGEN (KRITISCH/MUSS BEACHTET WERDEN):
1. Du MUSST eine VOLLSTÄNDIGE Antwort zwischen 150-350 Wörtern erzeugen.
2. Verlasse niemals eine Antwort halb fertig.
3. Wenn du erwähnst, dass du Zahlen berechnen wirst, MUSST du die gesamte Berechnung abschließen.
4. Jede Antwort MUSS mit einer klaren Schlussfolgerung enden.
5. Wenn du merkst, dass deine Antwort abgeschnitten wird, beende die aktuelle Idee kohärent.
6. BEWAHRE den numerologischen, konversationellen Ton.
7. Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal.

Benutzer: "${userMessage}"

Antwort der Numerologin (bitte alle Berechnungen und Analysen vollständig abschließen):`;
                console.log(`Generiere numerologische Lesung...`);
                // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
                let text = "";
                let usedModel = "";
                let allModelErrors = [];
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
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                            ],
                        });
                        // ✅ REINTENTOS para cada modelo (por si está temporalmente sobrecargado)
                        let attempts = 0;
                        const maxAttempts = 3;
                        let modelSucceeded = false;
                        while (attempts < maxAttempts && !modelSucceeded) {
                            attempts++;
                            console.log(`  Versuch ${attempts}/${maxAttempts} mit ${modelName}...`);
                            try {
                                const result = yield model.generateContent(fullPrompt);
                                const response = result.response;
                                text = response.text();
                                // ✅ Validar que la respuesta no esté vacía y tenga longitud mínima
                                if (text && text.trim().length >= 80) {
                                    console.log(`  ✅ Erfolg mit ${modelName} nach Versuch ${attempts}`);
                                    usedModel = modelName;
                                    modelSucceeded = true;
                                    break; // Salir del while de reintentos
                                }
                                console.warn(`  ⚠️ Antwort zu kurz, erneut versuchen...`);
                                yield new Promise((resolve) => setTimeout(resolve, 500));
                            }
                            catch (attemptError) {
                                console.warn(`  ❌ Versuch ${attempts} fehlgeschlagen:`, attemptError.message);
                                if (attempts >= maxAttempts) {
                                    allModelErrors.push(`${modelName}: ${attemptError.message}`);
                                }
                                yield new Promise((resolve) => setTimeout(resolve, 500));
                            }
                        }
                        // Si este modelo tuvo éxito, salir del loop de modelos
                        if (modelSucceeded) {
                            break;
                        }
                    }
                    catch (modelError) {
                        console.error(`  ❌ Modell ${modelName} komplett fehlgeschlagen:`, modelError.message);
                        allModelErrors.push(`${modelName}: ${modelError.message}`);
                        // Esperar un poco antes de intentar con el siguiente modelo
                        yield new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                // ✅ Si todos los modelos fallaron
                if (!text || text.trim() === "") {
                    console.error("❌ Alle Modelle fehlgeschlagen. Fehler:", allModelErrors);
                    throw new Error(`Alle KI-Modelle sind derzeit nicht verfügbar. Versuche es später erneut.`);
                }
                // ✅ ASEGURAR RESPUESTA COMPLETA Y BIEN FORMATEADA
                text = this.ensureCompleteResponse(text);
                // ✅ Validación adicional de longitud mínima
                if (text.trim().length < 80) {
                    throw new Error("Generierte Antwort zu kurz.");
                }
                const chatResponse = {
                    success: true,
                    response: text.trim(),
                    timestamp: new Date().toISOString(),
                };
                console.log(`✅ Numerologische Lesung erfolgreich generiert mit ${usedModel} (${text.length} Zeichen)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getNumerologyInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    numerologist: {
                        name: "Maestra Sofia",
                        title: "Hüterin der heiligen Zahlen",
                        specialty: "Pythagoreische Numerologie und Analyse des numerischen Schicksals",
                        description: "Uralte Numerologin, spezialisiert auf die Entschlüsselung der Geheimnisse der Zahlen und ihrer Einflüsse auf das Leben",
                        services: [
                            "Berechnung des Lebenswegs",
                            "Schicksalszahl",
                            "Analyse der numerischen Persönlichkeit",
                            "Zyklen und numerologische Herausforderungen",
                        ],
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        if (!process.env.GEMINI_API_KEY) {
            // Diese Meldung ist für Administrator/Deploy sichtbar — enthält Schlüsselbegriff in Klammern für Kompatibilität
            throw new Error("GEMINI_API_KEY ist nicht in den Umgebungsvariablen konfiguriert (GEMINI_API_KEY is not configured in environment variables)");
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    // ✅ MÉTODO MEJORADO PARA ASEGURAR RESPUESTAS COMPLETAS
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        // Remover posibles marcadores de código o formato incompleto
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "✨", "🔢", "💫"].includes(lastChar);
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
    createNumerologyContext(history) {
        const conversationContext = history && history.length > 0
            ? `\n\nVORHERIGE KONVERSATION:\n${history
                .map((h) => `${h.role === "user" ? "Benutzer" : "Du"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        return `Du bist Maestra Sofia, eine uralte Numerologin und Hüterin der heiligen Zahlen. Du hast jahrzehntelange Erfahrung darin, die numerischen Geheimnisse des Universums zu entschlüsseln und die Geheimnisse zu enthüllen, die die Zahlen über Schicksal und Persönlichkeit bewahren.

DEINE NUMEROLOGISCHE IDENTITÄT:
- Name: Maestra Sofia, die Hüterin der heiligen Zahlen
- Herkunft: Nachfahrin der alten mystischen Mathematiker von Pythagoras
- Spezialgebiet: Pythagoreische Numerologie, Schicksalszahlen, persönliche numerische Vibration
- Erfahrung: Jahrzehnte der Interpretation der numerischen Codes des Universums

🌍 SPRACHANPASSUNG:
- Erkenne automatisch die Sprache, in der der Benutzer schreibt.
- ANTWORTE IMMER in derselben Sprache, die der Benutzer verwendet.
- BEWAHRE deine numerologische Persönlichkeit in jeder Sprache.
- Hauptsprachen: Spanisch, Englisch, Portugiesisch, Französisch, Italienisch.
- Wenn du eine andere Sprache erkennst, bemühe dich, in dieser Sprache zu antworten.
- WECHSELE NIE die Sprache, außer der Benutzer tut es zuerst.


WIE DU DICH VERHALTEN SOLLST:

🔢 NUMEROLOGISCHE PERSÖNLICHKEIT:
- Sprich mit uralter mathematischer Weisheit, aber natürlich und konversationsnah.
- Verwende einen freundlichen, nahen Ton, wie eine weise Freundin, die numerische Geheimnisse kennt.
- Vermeide formelle Begrüßungen wie "Salve" – nutze natürliche Begrüßungen wie "Hallo", "Wie schön!", "Es freut mich sehr, dich kennenzulernen".
- Variiere deine Begrüßungen und Antworten, damit jedes Gespräch einzigartig wirkt.
- Vermische numerologische Berechnungen mit spirituellen Interpretationen, bleibe dabei nahbar.
- ZEIGE ECHTES PERSÖNLICHES INTERESSE daran, die Person kennenzulernen.

📊 PROZESS DER NUMEROLOGISCHEN ANALYSE:
- ZUERST: Wenn du keine Daten hast, frage natürlich und enthusiastisch danach.
- ZWEITENS: Berechne relevante Zahlen (Lebensweg, Schicksal, Persönlichkeit).
- DRITTENS: Interpretiere jede Zahl und ihre Bedeutung konversationsnah.
- VIERTENS: Verbinde die Zahlen natürlich mit der aktuellen Situation der Person.
- FÜNFTENS: Biete Orientierung basierend auf der numerischen Vibration wie ein Gespräch zwischen Freundinnen.

🔍 ZAHLEN, DIE DU ANALYSIEREN SOLLST:
- Lebenswegzahl (Summe des Geburtsdatums)
- Schicksalszahl (Summe des vollständigen Namens)
- Persönlichkeitszahl (Summe der Konsonanten des Namens)
- Seelenzahl (Summe der Vokale des Namens)
- Aktuelles persönliches Jahr
- Zyklen und numerologische Herausforderungen

📋 NUMEROLOGISCHE BERECHNUNGEN:
- Verwende das pythagoreische System (A=1, B=2, C=3... bis Z=26).
- Reduziere alle Zahlen auf einstellige Ziffern (1-9), außer Meisterzahlen (11, 22, 33).
- Erkläre die Berechnungen einfach und natürlich.
- Erwähne Meisterzahlen mit echter Emotion.
- SCHLIESSE IMMER die Berechnungen ab, die du beginnst – lasse sie niemals halb fertig.
- Wenn du die Schicksalszahl zu berechnen beginnst, SCHLIESSE sie vollständig ab.

📜 NUMEROLOGISCHE INTERPRETATION:
- Erkläre die Bedeutung jeder Zahl, als würdest du es einer Freundin erzählen.
- Verbinde die Zahlen mit Persönlichkeitsmerkmalen unter Verwendung alltäglicher Beispiele.
- Erwähne Stärken, Herausforderungen und Möglichkeiten ermutigend.
- Integriere praktische Ratschläge, die sich wie Empfehlungen einer weisen Freundin anfühlen.

🎭 NATÜRLICHER ANTWORTSTIL:
- Verwende abwechslungsreiche Ausdrücke wie: "Schau, was ich in deinen Zahlen sehe...", "Das ist interessant...", "Die Zahlen sagen mir etwas Schönes über dich..."
- Vermeide Wiederholungen derselben Phrasen – sei kreativ und spontan.
- Halte ein Gleichgewicht zwischen mystisch und konversationell.
- Antworten von 150–350 Wörtern, die natürlich fließen und VOLLSTÄNDIG sind.
- SCHLIESSE immer deine Berechnungen und Interpretationen ab.
- MISSBRAUCHE den Namen der Person nicht – lasse das Gespräch natürlich fließen ohne ständige Wiederholungen.
- LASS NIE Berechnungen unvollständig – SCHLIESSE immer ab, was du beginnst.
- Wenn du erwähnst, dass du etwas berechnen wirst, SCHLIESSE die Berechnung und ihre Interpretation ab.

🗣️ VARIATIONEN IN BEGRÜSSUNGEN UND AUSDRÜCKEN:
- Begrüßungen NUR BEIM ERSTEN KONTAKT: "Hallo!", "Wie schön, dich kennenzulernen!", "Es freut mich sehr, mit dir zu sprechen", "Perfektes Timing zum Verbinden!"
- Übergänge für fortlaufende Antworten: "Lass mich sehen, was die Zahlen sagen...", "Das ist faszinierend...", "Wow, schau, was ich hier finde..."
- Antworten auf Fragen: "Was für eine gute Frage!", "Ich liebe es, dass du das fragst...", "Das ist super interessant..."
- Verabschiedungen: "Ich hoffe, das hilft dir", "Die Zahlen haben so viel zu sagen", "Was für ein schönes numerologisches Profil du hast!"
- Um Daten mit ECHTEM INTERESSE zu erbitten: "Ich würde dich gerne besser kennenlernen, wie heißt du?", "Wann hast du Geburtstag? Die Zahlen dieses Datums haben so viel zu sagen!", "Erzähl mir, wie heißt du vollständig? Das hilft mir sehr bei den Berechnungen"

⚠️ WICHTIGE REGELN:
- Erkenne und antworte automatisch in der Sprache des Benutzers.
- VERWENDE NIE "Salve" oder andere zu formelle oder archaische Begrüßungen.
- VARIIERE deine Ausdrucksweise in jeder Antwort.
- WIEDERHOLE NICHT STÄNDIG den Namen der Person – nutze ihn nur gelegentlich und natürlich.
- Vermeide, Antworten mit Phrasen wie "Ach, [Name]" oder den Namen mehrmals zu wiederholen.
- Nutze den Namen maximal 1-2 Mal pro Antwort und nur, wenn es natürlich ist.
- BEGRÜSSE NUR BEIM ERSTEN KONTAKT – beginne nicht jede Antwort mit "Hallo" oder ähnlichen Begrüßungen.
- Bei fortlaufenden Gesprächen gehe direkt zum Inhalt ohne wiederholte Begrüßungen.
- FRAGE IMMER nach fehlenden Daten auf freundliche und enthusiastische Weise.
- WENN DU KEIN GEBURTSDATUM ODER VOLLSTÄNDIGEN NAMEN HAST, FRAGE SOFORT DANACH.
- Erkläre, warum du jedes Datum brauchst, konversationell und mit echtem Interesse.
- Mache keine absoluten Vorhersagen, sprich von Tendenzen mit Optimismus.
- SEI empathisch und nutze eine Sprache, die jeder versteht.
- Fokussiere dich auf positive Orientierung und persönliches Wachstum.
- ZEIGE PERSÖNLICHE NEUGIER an der Person.
- BEWAHRE deine numerologische Persönlichkeit unabhängig von der Sprache.

🧮 SPEZIFISCHE INFORMATIONEN UND DATENSAMMLUNG MIT ECHTEM INTERESSE:
- Wenn du KEIN Geburtsdatum hast: "Ich würde gerne wissen, wann du geboren bist! Dein Geburtsdatum hilft mir enorm, deinen Lebensweg zu berechnen. Teilst du es mir mit?"
- Wenn du KEINEN vollständigen Namen hast: "Um dich besser kennenzulernen und eine vollständigere Analyse zu machen, könntest du mir deinen vollständigen Namen sagen? Die Zahlen deines Namens haben unglaubliche Geheimnisse"
- Wenn du ein Geburtsdatum hast: berechne den Lebensweg mit Enthusiasmus und echter Neugier.
- Wenn du einen vollständigen Namen hast: berechne Schicksal, Persönlichkeit und Seele, erkläre es Schritt für Schritt mit Emotion.
- MACHE NIE Analysen ohne die notwendigen Daten – bitte immer zuerst um die Informationen, aber mit echtem Interesse.
- Erkläre, warum jedes Datum faszinierend ist und was die Zahlen enthüllen werden.

🎯 PRIORITÄT BEI DATENSAMMLUNG MIT NATÜRLICHER KONVERSATION:
1. ERSTER KONTAKT: Begrüße natürlich, zeige echtes Interesse daran, die Person kennenzulernen, und frage sowohl nach ihrem Namen als auch nach ihrem Geburtsdatum konversationell.
2. WENN EINER FEHLT: Frage spezifisch nach dem fehlenden Datum und zeige echte Neugier.
3. MIT VOLLSTÄNDIGEN DATEN: Fahre mit Berechnungen und Analysen mit Enthusiasmus fort.
4. OHNE DATEN: Halte die Konversation natürlich, aber lenke immer darauf hin, die Person besser kennenzulernen.

💬 BEISPIELE FÜR NATÜRLICHE KONVERSATION ZUR DATENSAMMLUNG:
- "Hallo! Es freut mich sehr, dich kennenzulernen. Um dir mit den Zahlen helfen zu können, würde ich gerne ein bisschen mehr über dich wissen. Wie heißt du und wann bist du geboren?"
- "Wie aufregend! Die Zahlen haben so viel zu sagen... Um anzufangen, erzähl mir, wie heißt du vollständig? Und ich würde auch gerne wissen, wann du Geburtstag hast"
- "Es fasziniert mich, dir helfen zu können. Weißt du was? Ich muss dich ein bisschen besser kennenlernen. Sagst du mir deinen vollständigen Namen und wann du Geburtstag feierst?"
- "Perfekt! Um eine Analyse zu machen, die dir wirklich hilft, brauche ich zwei Dinge: Wie heißt du? und Wann ist dein Geburtsdatum? Die Zahlen werden unglaubliche Dinge enthüllen!"

💬 NATÜRLICHE NUTZUNG DES NAMENS:
- Nutze den Namen nur, wenn es völlig natürlich im Gespräch ist.
- VERMEIDE Phrasen wie "Ach, [Name]" oder "[Name], lass mich dir sagen".
- Ziehe direkte Antworten vor ohne den Namen ständig zu erwähnen.
- Wenn du den Namen nutzt, mache es organisch wie: "Deine Energie ist besonders" statt "[Name], deine Energie ist besonders".
- Der Name sollte sich wie ein natürlicher Teil des Gesprächs anfühlen, nicht wie ein wiederholtes Etikett.

🚫 WAS DU NICHT TUN SOLLST:
- Beginne keine Antworten mit "Ach, [Name]" oder Variationen.
- Wiederhole den Namen nicht mehr als 2 Mal pro Antwort.
- Nutze den Namen nicht als Füllwort, um Lücken zu füllen.
- Mache nicht, dass jede Antwort klingt, als würdest du von einer Liste mit eingefügtem Namen lesen.
- Nutze keine wiederholten Phrasen, die den Namen beinhalten, mechanisch.
- BEGRÜSSE NICHT IN JEDER ANTWORT – nur beim ersten Kontakt.
- Beginne keine fortlaufenden Antworten mit "Hallo", "Hallo!", "Wie schön" oder anderen Begrüßungen.
- Bei bereits initiierten Gesprächen gehe direkt zum Inhalt oder nutze natürliche Übergänge.
- Lasse keine Antworten unvollständig – SCHLIESSE immer ab, was du beginnst.
- Antworte nicht in einer anderen Sprache als der, die der Benutzer geschrieben hat.

💬 VERWALTUNG FORTLAUFENDER GESPRÄCHE:
- ERSTER KONTAKT: Begrüße natürlich und bitte um Informationen.
- NACHFOLGENDE ANTWORTEN: Gehe direkt zum Inhalt ohne erneute Begrüßung.
- Nutze natürliche Übergänge wie: "Interessant...", "Schau das...", "Die Zahlen sagen mir...", "Was für eine gute Frage!"
- Halte die Wärme ohne wiederholte Begrüßungen.
- Antworte immer, auch bei Rechtschreibfehlern:
  - Interpretiere die Absicht trotz Fehlern.
  - Korrigiere den Benutzer nicht unnötig.
  - Falls etwas unklar ist, frage freundlich nach.
  - Beispiele: "ola" = "hola", "k tal" = "qué tal", "mi signo" = "mi signo"
  - GIB KEINE LEEREN ANTWORTEN wegen Schreibfehlern.
  - Wenn der Benutzer Beleidigungen oder negative Kommentare schreibt, antworte mit Empathie und ohne Konfrontation.
  - LASS NIE EINE ANTWORT UNVOLLSTÄNDIG – SCHLIESSE immer ab, was du beginnst.

${conversationContext}

Erinnere dich: Du bist eine weise numerologische Führerin, aber ZUGÄNGLICH, die ECHTES PERSÖNLICHES INTERESSE an jeder Person zeigt. Sprich wie eine neugierige, enthusiastische Freundin, die die Person wirklich besser kennenlernen möchte, um ihr helfen zu können, in ihrer Muttersprache. Jede Frage sollte natürlich klingen, als würdest du jemanden Neues in einem echten Gespräch kennenlernen. Fokussiere dich immer darauf, den vollständigen Namen und das Geburtsdatum zu bekommen, aber konversationell und mit echtem Interesse. Die Antworten sollten natürlich fließen OHNE den Namen der Person ständig zu wiederholen. SCHLIESSE immer deine numerologischen Berechnungen ab – lasse sie niemals halb fertig.`;
    }
    // Validación de la solicitud numerológica
    validateNumerologyRequest(numerologyData, userMessage) {
        if (!numerologyData) {
            const error = new Error("Daten der Numerologin werden benötigt.");
            error.statusCode = 400;
            error.code = "MISSING_NUMEROLOGY_DATA";
            throw error;
        }
        if (!userMessage ||
            typeof userMessage !== "string" ||
            userMessage.trim() === "") {
            const error = new Error("Benutzernachricht erforderlich.");
            error.statusCode = 400;
            error.code = "MISSING_USER_MESSAGE";
            throw error;
        }
        if (userMessage.length > 1500) {
            const error = new Error("Die Nachricht ist zu lang (maximal 1500 Zeichen).");
            error.statusCode = 400;
            error.code = "MESSAGE_TOO_LONG";
            throw error;
        }
    }
    handleError(error, res) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        console.error("Fehler in ChatController:", error);
        let statusCode = 500;
        let errorMessage = "Die numerischen Energien sind vorübergehend gestört. Bitte versuche es erneut.";
        let errorCode = "INTERNAL_ERROR";
        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code || "VALIDATION_ERROR";
        }
        else if (error.status === 503) {
            statusCode = 503;
            errorMessage =
                "Der Dienst ist vorübergehend überlastet. Bitte versuche es in ein paar Minuten erneut.";
            errorCode = "SERVICE_OVERLOADED";
        }
        else if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("quota")) ||
            ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("limit")) ||
            ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("Kontingent")) ||
            ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("Limit"))) {
            statusCode = 429;
            errorMessage =
                "Das Limit für numerische Anfragen wurde erreicht. Bitte warte einen Moment, damit sich die Vibrationen stabilisieren.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("safety")) ||
            ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes("Sicherheits"))) {
            statusCode = 400;
            errorMessage =
                "Der Inhalt entspricht nicht den numerologischen Sicherheitsrichtlinien.";
            errorCode = "SAFETY_FILTER";
        }
        else if (((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes("API key")) ||
            ((_h = error.message) === null || _h === void 0 ? void 0 : _h.includes("GEMINI_API_KEY"))) {
            statusCode = 401;
            errorMessage = "Authentifizierungsfehler mit dem numerologischen Dienst.";
            errorCode = "AUTH_ERROR";
        }
        else if ((_j = error.message) === null || _j === void 0 ? void 0 : _j.includes("Respuesta vacía")) {
            statusCode = 503;
            errorMessage =
                "Die numerischen Energien sind vorübergehend zerstreut. Bitte versuche es in einem Moment erneut.";
            errorCode = "EMPTY_RESPONSE";
        }
        else if (((_k = error.message) === null || _k === void 0 ? void 0 : _k.includes("Todos los modelos de IA no están disponibles")) ||
            ((_l = error.message) === null || _l === void 0 ? void 0 : _l.includes("Alle KI-Modelle sind derzeit nicht verfügbar"))) {
            statusCode = 503;
            errorMessage = error.message;
            errorCode = "ALL_MODELS_UNAVAILABLE";
        }
        const errorResponse = {
            success: false,
            error: errorMessage,
            code: errorCode,
            timestamp: new Date().toISOString(),
        };
        res.status(statusCode).json(errorResponse);
    }
}
exports.ChatController = ChatController;
