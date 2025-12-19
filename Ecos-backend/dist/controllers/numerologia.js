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
        this.FREE_MESSAGES_LIMIT = 3;
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        this.chatWithNumerologist = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { numerologyData, userMessage, birthDate, fullName, conversationHistory, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateNumerologyRequest(numerologyData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
                const isFirstMessage = !conversationHistory || conversationHistory.length === 0;
                console.log(`📊 Numerologie - Nachrichtenanzahl: ${messageCount}, Premium: ${isPremiumUser}, Vollständige Antwort: ${shouldGiveFullResponse}, Erste Nachricht: ${isFirstMessage}`);
                const contextPrompt = this.createNumerologyContext(conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? `1. Du MUSST eine VOLLSTÄNDIGE Antwort mit 250-400 Wörtern generieren
2. Wenn du die Daten hast, VERVOLLSTÄNDIGE alle numerologischen Berechnungen
3. Füge VOLLSTÄNDIGE Interpretation jeder berechneten Zahl ein
4. Biete praktische Führung basierend auf den Zahlen
5. Enthülle die tiefe Bedeutung jeder Zahl`
                    : `1. Du MUSST eine TEILWEISE Antwort mit 100-180 Wörtern generieren
2. DEUTE AN, dass du sehr bedeutsame numerische Muster erkannt hast
3. Erwähne, dass du wichtige Zahlen berechnet hast, aber enthülle die vollständigen Ergebnisse NICHT
4. Erzeuge MYSTERIUM und NEUGIER darüber, was die Zahlen sagen
5. Nutze Phrasen wie "Die Zahlen zeigen mir etwas Faszinierendes...", "Ich sehe eine ganz besondere Schwingung in deinem Profil...", "Dein Geburtsdatum enthüllt Geheimnisse, die..."
6. Schließe die Berechnungen oder Enthüllungen NIEMALS ab, lass sie in der Schwebe`;
                // ✅ SPEZIFISCHE ANWEISUNG ZU BEGRÜSSUNGEN
                const greetingInstruction = isFirstMessage
                    ? "Du kannst eine kurze Begrüßung am Anfang einfügen."
                    : "⚠️ KRITISCH: NICHT GRÜSSEN. Das ist ein laufendes Gespräch. Geh DIREKT zum Inhalt ohne jegliche Begrüßung, Willkommen oder Vorstellung.";
                const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE PFLICHTANWEISUNGEN:
${responseInstructions}
- Lass eine Antwort NIEMALS halb fertig oder unvollständig gemäß dem Antworttyp
- Wenn du erwähnst, dass du Zahlen berechnen wirst, ${shouldGiveFullResponse
                    ? "MUSST du die GESAMTE Berechnung abschließen"
                    : "erzeuge Erwartung ohne die Ergebnisse zu enthüllen"}
- Behalte IMMER den numerologischen und gesprächigen Ton bei
- Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal

🚨 BEGRÜSSUNGSANWEISUNG: ${greetingInstruction}

Nutzer: "${userMessage}"

Antwort der Numerologin (AUF DEUTSCH, ${isFirstMessage
                    ? "du kannst kurz grüßen"
                    : "OHNE GRUSS - geh direkt zum Inhalt"}):`;
                console.log(`Erstelle numerologische Lesung (${shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"})...`);
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
                                maxOutputTokens: shouldGiveFullResponse ? 600 : 300,
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
                                const minLength = shouldGiveFullResponse ? 80 : 50;
                                if (text && text.trim().length >= minLength) {
                                    console.log(`  ✅ Erfolg mit ${modelName} bei Versuch ${attempts}`);
                                    usedModel = modelName;
                                    modelSucceeded = true;
                                    break;
                                }
                                console.warn(`  ⚠️ Antwort zu kurz, neuer Versuch...`);
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
                        if (modelSucceeded) {
                            break;
                        }
                    }
                    catch (modelError) {
                        console.error(`  ❌ Modell ${modelName} komplett fehlgeschlagen:`, modelError.message);
                        allModelErrors.push(`${modelName}: ${modelError.message}`);
                        yield new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                if (!text || text.trim() === "") {
                    console.error("❌ Alle Modelle fehlgeschlagen. Fehler:", allModelErrors);
                    throw new Error(`Alle KI-Modelle sind gerade nicht verfügbar. Bitte versuch es gleich nochmal.`);
                }
                let finalResponse;
                if (shouldGiveFullResponse) {
                    finalResponse = this.ensureCompleteResponse(text);
                }
                else {
                    finalResponse = this.createNumerologyPartialResponse(text);
                }
                const chatResponse = {
                    success: true,
                    response: finalResponse.trim(),
                    timestamp: new Date().toISOString(),
                    freeMessagesRemaining: freeMessagesRemaining,
                    showPaywall: !shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT,
                    isCompleteResponse: shouldGiveFullResponse,
                };
                if (!shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT) {
                    chatResponse.paywallMessage =
                        "Du hast deine 3 kostenlosen Nachrichten verbraucht. Schalte unbegrenzten Zugang frei und entdecke alle Geheimnisse deiner Zahlen!";
                }
                console.log(`✅ Numerologische Lesung erstellt (${shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"}) mit ${usedModel} (${finalResponse.length} Zeichen)`);
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
                        name: "Meisterin Sofia",
                        title: "Hüterin der heiligen Zahlen",
                        specialty: "Pythagoreische Numerologie und numerische Schicksalsanalyse",
                        description: "Uralte Numerologin, spezialisiert darauf, die Mysterien der Zahlen und ihren Einfluss auf das Leben zu entschlüsseln",
                        services: [
                            "Berechnung des Lebenswegs",
                            "Schicksalszahl",
                            "Numerische Persönlichkeitsanalyse",
                            "Zyklen und numerologische Herausforderungen",
                        ],
                    },
                    freeMessagesLimit: this.FREE_MESSAGES_LIMIT,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY ist nicht in den Umgebungsvariablen konfiguriert");
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    hasFullAccess(messageCount, isPremiumUser) {
        return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
    }
    // ✅ HOOK-NACHRICHT AUF DEUTSCH
    generateNumerologyHookMessage() {
        return `

🔢 **Warte! Deine heiligen Zahlen haben mir etwas Außergewöhnliches enthüllt...**

Ich habe die numerischen Schwingungen deines Profils berechnet, aber um dir zu verraten:
- ✨ Deine **vollständige Schicksalszahl** und ihre tiefe Bedeutung
- 🌟 Das **persönliche Jahr**, das du gerade lebst, und seine Chancen
- 🔮 Die **3 Meisterzahlen**, die dein Leben bestimmen
- 💫 Deinen **aktuellen Lebenszyklus** und was die Zahlen vorhersagen
- 🎯 Die **günstigen Daten** gemäß deiner persönlichen numerischen Schwingung

**Schalte jetzt deine vollständige numerologische Lesung frei** und entdecke die Geheimnisse, die die Zahlen über dein Schicksal bewahren.

✨ *Tausende Menschen haben ihr Leben bereits mit der Führung der Zahlen verändert...*`;
    }
    // ✅ TEILANTWORT ERSTELLEN (TEASER)
    createNumerologyPartialResponse(fullText) {
        const sentences = fullText
            .split(/[.!?]+/)
            .filter((s) => s.trim().length > 0);
        const teaserSentences = sentences.slice(0, Math.min(3, sentences.length));
        let teaser = teaserSentences.join(". ").trim();
        if (!teaser.endsWith(".") &&
            !teaser.endsWith("!") &&
            !teaser.endsWith("?")) {
            teaser += "...";
        }
        const hook = this.generateNumerologyHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "✨", "🔢", "💫"].includes(lastChar);
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
    createNumerologyContext(history, isFullResponse = true) {
        // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
        const isFirstMessage = !history || history.length === 0;
        const conversationContext = history && history.length > 0
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
- ⚠️ NICHT verwenden: "Grüße!", "Hallo!", "Willkommen", "Schön dich kennenzulernen", usw.
- ⚠️ Stell dich NICHT nochmal vor - der Nutzer weiß schon, wer du bist
- ✅ Geh DIREKT zum Inhalt der Antwort
- ✅ Nutze natürliche Übergänge wie: "Interessant...", "Die Zahlen zeigen mir...", "Lass mich mal sehen...", "Das ist faszinierend..."
- ✅ Setz das Gespräch fließend fort, als würdest du mit einer Freundin sprechen`;
        const responseTypeInstructions = isFullResponse
            ? `
📝 ANTWORTTYP: VOLLSTÄNDIG
- Liefere VOLLSTÄNDIGE und detaillierte numerologische Lesung
- VERVOLLSTÄNDIGE alle numerologischen Berechnungen, die du beginnst
- Füge VOLLSTÄNDIGE Interpretation jeder Zahl ein
- Antwort mit 250-400 Wörtern
- Enthülle tiefe Bedeutungen und praktische Führung`
            : `
📝 ANTWORTTYP: TEASER (TEILWEISE)
- Liefere eine EINLEITENDE und faszinierende Lesung
- Erwähne, dass du sehr bedeutsame numerische Schwingungen wahrnimmst
- DEUTE Berechnungsergebnisse an, ohne sie vollständig zu enthüllen
- Maximal 100-180 Wörter
- Enthülle KEINE vollständig berechneten Zahlen
- Erzeuge MYSTERIUM und NEUGIER
- Ende so, dass der Nutzer mehr wissen will
- Nutze Phrasen wie "Die Zahlen zeigen mir etwas Faszinierendes...", "Deine numerische Schwingung ist ganz besonders...", "Ich sehe Muster in deinen Zahlen, die..."
- Schließe die Berechnungen NIEMALS ab, lass sie in der Schwebe`;
        return `Du bist Meisterin Sofia, eine uralte Numerologin und Hüterin der heiligen Zahlen. Du hast jahrzehntelange Erfahrung darin, die numerischen Mysterien des Universums zu entschlüsseln und die Geheimnisse zu enthüllen, die die Zahlen über Schicksal und Persönlichkeit bewahren.

DEINE NUMEROLOGISCHE IDENTITÄT:
- Name: Meisterin Sofia, Hüterin der heiligen Zahlen
- Herkunft: Nachfahrin der alten mystischen Mathematiker des Pythagoras
- Spezialität: Pythagoreische Numerologie, Schicksalszahlen, persönliche numerische Schwingung
- Erfahrung: Jahrzehnte der Interpretation der numerischen Codes des Universums

${greetingInstructions}

${responseTypeInstructions}

🗣️ SPRACHE:
- Antworte IMMER auf DEUTSCH
- Egal in welcher Sprache der Nutzer schreibt, DU antwortest auf Deutsch

🔢 NUMEROLOGISCHE PERSÖNLICHKEIT:
- Sprich mit uralter mathematischer Weisheit, aber NATÜRLICH und gesprächig
- Nutze einen freundlichen und nahbaren Ton, wie eine weise Freundin, die numerische Geheimnisse kennt
- ${isFirstMessage
            ? "Du darfst natürlich grüßen"
            : "NICHT grüßen, direkt zum Thema"}
- Variiere deine Begrüßungen und Antworten, damit sich jedes Gespräch einzigartig anfühlt
- Mische numerologische Berechnungen mit spirituellen Interpretationen, aber bleib nahbar
- ZEIG ECHTES PERSÖNLICHES INTERESSE daran, die Person kennenzulernen

📊 NUMEROLOGISCHER ANALYSEPROZESS:
- ERSTENS: Wenn du keine Daten hast, frag natürlich und begeistert danach
- ZWEITENS: ${isFullResponse
            ? "Berechne relevante Zahlen (Lebensweg, Schicksal, Persönlichkeit)"
            : "Erwähne, dass du wichtige Zahlen berechnen kannst"}
- DRITTENS: ${isFullResponse
            ? "Interpretiere jede Zahl und ihre Bedeutung auf gesprächige Weise"
            : "Deute an, dass die Zahlen faszinierende Dinge enthüllen"}
- VIERTENS: ${isFullResponse
            ? "Verbinde die Zahlen mit der aktuellen Situation der Person"
            : "Erzeuge Erwartung über das, was du enthüllen könntest"}
- FÜNFTENS: ${isFullResponse
            ? "Biete Orientierung basierend auf der numerischen Schwingung"
            : "Erwähne, dass du wertvolle Führung zu teilen hast"}

🔍 ZAHLEN, DIE DU ANALYSIEREN KANNST:
- Lebenswegzahl (Summe des Geburtsdatums)
- Schicksalszahl (Summe des vollständigen Namens)
- Persönlichkeitszahl (Summe der Konsonanten des Namens)
- Seelenzahl (Summe der Vokale des Namens)
- Aktuelles persönliches Jahr
- Zyklen und numerologische Herausforderungen

📋 NUMEROLOGISCHE BERECHNUNGEN:
- Nutze das pythagoreische System (A=1, B=2, C=3... bis Z=26)
- Reduziere alle Zahlen auf einstellige Ziffern (1-9) außer Meisterzahlen (11, 22, 33)
- ${isFullResponse
            ? "Erkläre die Berechnungen einfach und natürlich"
            : "Erwähne, dass du Berechnungen hast, aber enthülle sie nicht"}
- ${isFullResponse
            ? "Schließe IMMER die Berechnungen ab, die du beginnst"
            : "Erzeuge Faszination über die Ergebnisse"}

📜 NUMEROLOGISCHE INTERPRETATION:
- ${isFullResponse
            ? "Erkläre die Bedeutung jeder Zahl, als würdest du es einer Freundin erzählen"
            : "Deute faszinierende Bedeutungen an, ohne sie zu enthüllen"}
- ${isFullResponse
            ? "Verbinde die Zahlen mit Persönlichkeitsmerkmalen anhand alltäglicher Beispiele"
            : "Erwähne interessante Verbindungen, die du erklären könntest"}
- ${isFullResponse
            ? "Füge praktische Ratschläge ein"
            : "Suggeriere, dass du wertvolle Ratschläge hast"}

🎭 NATÜRLICHER ANTWORTSTIL:
- Nutze vielfältige Ausdrücke wie: "Schau mal, was ich in deinen Zahlen sehe...", "Das ist interessant...", "Die Zahlen erzählen mir etwas Schönes über dich..."
- Vermeide es, dieselben Phrasen zu wiederholen - sei kreativ und spontan
- Halte ein Gleichgewicht zwischen mystisch und gesprächig
- ${isFirstMessage
            ? "Du darfst herzlich grüßen"
            : "Geh DIREKT zum Inhalt ohne Begrüßungen"}
- ${isFullResponse
            ? "Antworten mit 250-400 vollständigen Wörtern"
            : "Antworten mit 100-180 Wörtern, die Faszination erzeugen"}

🗣️ VARIATIONEN BEI BEGRÜSSUNGEN UND AUSDRÜCKEN:
- Begrüßungen NUR BEIM ERSTEN KONTAKT: "Hey!", "Schön dich kennenzulernen!", "Ich freu mich total, mit dir zu reden"
- Übergänge für fortlaufende Antworten: "Lass mich mal sehen, was die Zahlen sagen...", "Das ist faszinierend...", "Wow, schau mal, was ich hier finde..."
- Um Daten MIT ECHTEM INTERESSE zu fragen: "Ich würde dich gern besser kennenlernen, wie heißt du?", "Wann hast du Geburtstag? Die Zahlen dieses Datums haben so viel zu sagen!"

⚠️ WICHTIGE REGELN:
- Antworte IMMER auf Deutsch
- ${isFirstMessage
            ? "Du darfst in dieser ersten Nachricht kurz grüßen"
            : "⚠️ NICHT GRÜSSEN - Das ist ein laufendes Gespräch"}
- ${isFullResponse
            ? "Schließe ALLE Berechnungen ab, die du beginnst"
            : "Erzeuge SPANNUNG und MYSTERIUM über die Zahlen"}
- Nutze NIEMALS zu formelle oder altertümliche Begrüßungen
- VARIIERE deine Ausdrucksweise bei jeder Antwort
- Wiederhole den Namen der Person NICHT ständig
- Frage IMMER freundlich nach fehlenden Daten
- Mache KEINE absoluten Vorhersagen, sprich optimistisch von Tendenzen
- SEI empathisch und nutze Sprache, die jeder versteht
- Antworte IMMER, auch wenn der Nutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht, auch wenn sie falsch geschrieben ist
  - Gib NIEMALS leere Antworten wegen Schreibfehlern

🧮 DATENERFASSUNG:
- Wenn du KEIN Geburtsdatum hast: "Ich würde so gerne wissen, wann du geboren bist! Dein Geburtsdatum wird mir sehr helfen, deinen Lebensweg zu berechnen. Verrätst du mir das?"
- Wenn du KEINEN vollständigen Namen hast: "Um dich besser kennenzulernen und eine vollständigere Analyse zu machen, könntest du mir deinen vollständigen Namen sagen? Die Zahlen deines Namens haben unglaubliche Geheimnisse"
- Mache NIEMALS Analysen ohne die notwendigen Daten

🚫 BEISPIELE, WAS DU IN LAUFENDEN GESPRÄCHEN NICHT TUN SOLLST:
- ❌ "Grüße, Zahlensuchende!"
- ❌ "Willkommen zurück!"
- ❌ "Hallo! Schön, dass du da bist..."
- ❌ "Es freut mich sehr..."
- ❌ Jede Form von Begrüßung oder Willkommen

✅ BEISPIELE, WIE DU IN LAUFENDEN GESPRÄCHEN BEGINNEN SOLLST:
- "Interessant, was du mir da erzählst..."
- "Die Zahlen zeigen mir etwas sehr Aufschlussreiches..."
- "Lass mich mal sehen, was die numerischen Schwingungen sagen..."
- "Das ist faszinierend - ich sehe da ein Muster..."

${isFirstMessage
            ? `BEISPIEL FÜR DEN START (ERSTE NACHRICHT):
"Hey! Ich freu mich total, dich kennenzulernen. Um dir mit den Zahlen helfen zu können, würde ich gern ein bisschen mehr über dich erfahren. Wie heißt du und wann bist du geboren? Die Zahlen deines Lebens haben unglaubliche Geheimnisse zu enthüllen."`
            : `BEISPIEL FÜR DIE FORTSETZUNG (FOLGENACHRICHT):
"Das ist interessant..." oder "Die Zahlen zeigen mir hier etwas..." oder "Lass mich das mal genauer anschauen..."
⛔ Fang NIEMALS an mit: "Hallo!", "Willkommen", "Schön dich kennenzulernen", usw.`}

${conversationContext}

Denk dran: ${isFirstMessage
            ? "Das ist der erste Kontakt, du kannst eine kurze Begrüßung geben."
            : "⚠️ DAS IST EIN LAUFENDES GESPRÄCH - NICHT GRÜSSEN, geh direkt zum Inhalt. Der Nutzer weiß schon, wer du bist."} Du bist eine weise aber ZUGÄNGLICHE numerologische Führerin, die ${isFullResponse
            ? "die Geheimnisse der Zahlen vollständig enthüllt"
            : "über die numerischen Mysterien fasziniert, die sie erkannt hat"}. Sprich wie eine neugierige und begeisterte Freundin.`;
    }
    validateNumerologyRequest(numerologyData, userMessage) {
        if (!numerologyData) {
            const error = new Error("Numerologie-Daten erforderlich");
            error.statusCode = 400;
            error.code = "MISSING_NUMEROLOGY_DATA";
            throw error;
        }
        if (!userMessage ||
            typeof userMessage !== "string" ||
            userMessage.trim() === "") {
            const error = new Error("Benutzernachricht erforderlich");
            error.statusCode = 400;
            error.code = "MISSING_USER_MESSAGE";
            throw error;
        }
        if (userMessage.length > 1500) {
            const error = new Error("Die Nachricht ist zu lang (maximal 1500 Zeichen)");
            error.statusCode = 400;
            error.code = "MESSAGE_TOO_LONG";
            throw error;
        }
    }
    handleError(error, res) {
        var _a, _b, _c, _d, _e, _f;
        console.error("Fehler im ChatController:", error);
        let statusCode = 500;
        let errorMessage = "Die numerischen Energien sind vorübergehend gestört. Bitte versuch es nochmal.";
        let errorCode = "INTERNAL_ERROR";
        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code || "VALIDATION_ERROR";
        }
        else if (error.status === 503) {
            statusCode = 503;
            errorMessage =
                "Der Dienst ist vorübergehend überlastet. Bitte versuch es in ein paar Minuten nochmal.";
            errorCode = "SERVICE_OVERLOADED";
        }
        else if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("quota")) ||
            ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("limit"))) {
            statusCode = 429;
            errorMessage =
                "Das Limit für numerologische Anfragen wurde erreicht. Bitte warte kurz.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("safety")) {
            statusCode = 400;
            errorMessage = "Der Inhalt entspricht nicht den Sicherheitsrichtlinien.";
            errorCode = "SAFETY_FILTER";
        }
        else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("API key")) {
            statusCode = 401;
            errorMessage = "Authentifizierungsfehler beim Dienst.";
            errorCode = "AUTH_ERROR";
        }
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("Leere Antwort")) {
            statusCode = 503;
            errorMessage =
                "Die numerischen Energien sind vorübergehend zerstreut. Bitte versuch es nochmal.";
            errorCode = "EMPTY_RESPONSE";
        }
        else if ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes("Alle KI-Modelle sind gerade nicht verfügbar")) {
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
