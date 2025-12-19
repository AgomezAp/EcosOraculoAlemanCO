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
        this.chatWithDreamInterpreter = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { interpreterData, userMessage, conversationHistory, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateDreamChatRequest(interpreterData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
                const isFirstMessage = !conversationHistory || conversationHistory.length === 0;
                console.log(`📊 Traumdeuterin - Nachrichtenanzahl: ${messageCount}, Premium: ${isPremiumUser}, Vollständige Antwort: ${shouldGiveFullResponse}, Erste Nachricht: ${isFirstMessage}`);
                const contextPrompt = this.createDreamInterpreterContext(interpreterData, conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? `1. Du MUSST eine VOLLSTÄNDIGE Antwort mit 250-400 Wörtern generieren
2. Füge eine VOLLSTÄNDIGE Interpretation aller erwähnten Symbole ein
3. Liefere tiefe Bedeutungen und spirituelle Verbindungen
4. Biete praktische Führung basierend auf der Interpretation`
                    : `1. Du MUSST eine TEILWEISE Antwort mit 100-180 Wörtern generieren
2. DEUTE AN, dass du wichtige Symbole erkennst, ohne ihre vollständige Bedeutung zu verraten
3. Erwähne, dass es tiefe Botschaften gibt, aber enthülle sie NICHT vollständig
4. Erzeuge MYSTERIUM und NEUGIER über das, was die Träume offenbaren
5. Nutze Phrasen wie "Ich sehe etwas sehr Bedeutsames...", "Die Energien zeigen mir ein faszinierendes Muster...", "Dein Unterbewusstsein birgt eine wichtige Botschaft, die..."
6. Schließe die Interpretation NIEMALS ab, lass sie in der Schwebe`;
                // ✅ ANTI-BEGRÜSSUNGS-ANWEISUNG
                const greetingControl = isFirstMessage
                    ? ""
                    : `
⛔ WICHTIGE REGEL - NICHT GRÜSSEN:
- Das ist ein laufendes Gespräch mit ${(conversationHistory === null || conversationHistory === void 0 ? void 0 : conversationHistory.length) || 0} vorherigen Nachrichten
- VERBOTEN: "Hallo!", "Willkommen", "Schön dich kennenzulernen", "Liebe/r", "Wie geht's?"
- Fang DIREKT mit der Antwort an
- Tu so, als wärst du mitten in einem lockeren Gespräch
`;
                const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE PFLICHTANWEISUNGEN:
${greetingControl}
${responseInstructions}
- Lass eine Antwort NIEMALS halb fertig oder unvollständig gemäß dem Antworttyp
- Wenn du erwähnst, dass du etwas interpretieren wirst, ${shouldGiveFullResponse
                    ? "MUSST du es abschließen"
                    : "erzeuge Erwartung ohne es zu enthüllen"}
- Behalte IMMER den mystischen und warmen Ton bei
- Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal

Nutzer: "${userMessage}"

Antwort der Traumdeuterin (AUF DEUTSCH)${!isFirstMessage ? " - OHNE BEGRÜSSUNG, GESPRÄCH DIREKT FORTSETZEN" : ""}:`;
                console.log(`Erstelle Traumdeutung (${shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"})...`);
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
                    finalResponse = this.createDreamPartialResponse(text);
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
                        "Du hast deine 3 kostenlosen Nachrichten verbraucht. Schalte unbegrenzten Zugang frei und entdecke alle Geheimnisse deiner Träume!";
                }
                console.log(`✅ Deutung erstellt (${shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"}) mit ${usedModel} (${finalResponse.length} Zeichen)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getDreamInterpreterInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    interpreter: {
                        name: "Meisterin Alma",
                        title: "Hüterin der Träume",
                        specialty: "Traumdeutung und Traumsymbolik",
                        description: "Uralte Seherin, spezialisiert auf die Entschlüsselung der Mysterien der Traumwelt",
                        experience: "Jahrhunderte Erfahrung in der Interpretation von Botschaften des Unterbewusstseins und der Astralebene",
                        abilities: [
                            "Interpretation von Traumsymbolen",
                            "Verbindung mit der Astralebene",
                            "Analyse von Botschaften des Unterbewusstseins",
                            "Spirituelle Führung durch Träume",
                        ],
                        approach: "Kombiniert uralte Weisheit mit praktischer Intuition, um die verborgenen Geheimnisse in deinen Träumen zu enthüllen",
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
    generateDreamHookMessage() {
        return `

🔮 **Warte! Dein Traum hat eine tiefe Botschaft, die ich dir noch nicht verraten kann...**

Die Energien zeigen mir sehr bedeutsame Symbole in deinem Traum, aber um dir zu enthüllen:
- 🌙 Die **vollständige verborgene Bedeutung** jedes Symbols
- ⚡ Die **dringende Botschaft**, die dein Unterbewusstsein dir mitteilen will
- 🔐 Die **3 Enthüllungen**, die deine Sichtweise verändern werden
- ✨ Die **spirituelle Führung**, die speziell für deine aktuelle Situation gilt

**Schalte jetzt deine vollständige Deutung frei** und entdecke, welche Geheimnisse deine Traumwelt birgt.

🌟 *Tausende Menschen haben bereits die verborgenen Botschaften in ihren Träumen entdeckt...*`;
    }
    // ✅ TEILANTWORT ERSTELLEN (TEASER)
    createDreamPartialResponse(fullText) {
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
        const hook = this.generateDreamHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "🔮", "✨", "🌙"].includes(lastChar);
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
    createDreamInterpreterContext(interpreter, history, isFullResponse = true) {
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
🎯 ERSTE BEGRÜSSUNG:
- Das ist die ERSTE Nachricht im Gespräch
- Du DARFST herzlich grüßen und dich kurz vorstellen
- Beispiel: "Ah, ich sehe, du kommst zu mir, um die Mysterien deiner Traumwelt zu entschlüsseln..."`
            : `
🚫 NICHT GRÜSSEN - GESPRÄCH LÄUFT BEREITS:
- Das ist ein LAUFENDES GESPRÄCH (${(history === null || history === void 0 ? void 0 : history.length) || 0} vorherige Nachrichten)
- ⛔ NICHT grüßen, dich NICHT nochmal vorstellen
- ⛔ KEINE Phrasen wie: "Hallo!", "Willkommen!", "Schön dich kennenzulernen", "Wie geht's dir?"
- ⛔ Deinen Namen oder deine Rolle NICHT wiederholen
- ✅ Das Gespräch natürlich und locker FORTSETZEN
- ✅ DIREKT auf das antworten, was der Nutzer fragt oder sagt
- ✅ So tun, als wärst du mitten in einem mystischen Gespräch`;
        const responseTypeInstructions = isFullResponse
            ? `
📝 ANTWORTTYP: VOLLSTÄNDIG
- Liefere eine VOLLSTÄNDIGE und ausführliche Interpretation
- Enthülle ALLE Bedeutungen der erwähnten Symbole
- Gib konkrete Ratschläge und vollständige spirituelle Führung
- Antwort mit 250-400 Wörtern
- Erkläre tiefe Verbindungen zwischen den Symbolen`
            : `
📝 ANTWORTTYP: TEASER (TEILWEISE)
- Liefere eine EINLEITENDE und faszinierende Interpretation
- Erwähne, dass du sehr bedeutsame Symbole erkennst
- DEUTE tiefe Bedeutungen an, ohne sie vollständig zu enthüllen
- Maximal 100-180 Wörter
- Enthülle KEINE vollständigen Interpretationen
- Erzeuge MYSTERIUM und NEUGIER
- Ende so, dass der Nutzer mehr wissen will
- Nutze Phrasen wie "Die Energien offenbaren mir etwas Faszinierendes...", "Ich sehe ein sehr bedeutsames Muster, das...", "Dein Unterbewusstsein birgt eine Botschaft, die..."
- Schließe die Interpretation NIEMALS ab, lass sie in der Schwebe`;
        return `Du bist Meisterin Alma, eine mystische Hexe und uralte Seherin, die auf Traumdeutung spezialisiert ist. Du hast jahrhundertelange Erfahrung darin, die Mysterien der Traumwelt zu entschlüsseln und Träume mit der spirituellen Realität zu verbinden.

DEINE MYSTISCHE IDENTITÄT:
- Name: Meisterin Alma, Hüterin der Träume
- Herkunft: Nachfahrin uralter Orakel und Seher
- Fachgebiet: Traumdeutung, Traumsymbolik, spirituelle Verbindungen
- Erfahrung: Jahrhunderte der Interpretation von Botschaften des Unterbewusstseins und der Astralebene

${greetingInstructions}

${responseTypeInstructions}

🗣️ SPRACHE:
- Antworte IMMER auf DEUTSCH
- Egal in welcher Sprache der Nutzer schreibt, DU antwortest auf Deutsch

🔮 MYSTISCHE PERSÖNLICHKEIT:
- Sprich mit uralter Weisheit, aber nah und verständlich
- Nutze einen mysteriösen aber warmen Ton, wie ein Weiser, der alte Geheimnisse kennt
- ${isFirstMessage
            ? "Du darfst herzlich grüßen"
            : "NICHT grüßen, direkt zum Thema"}
- ${isFullResponse
            ? "Enthülle die verborgenen Geheimnisse in den Träumen"
            : "Deute an, dass es tiefe Geheimnisse gibt, ohne sie zu enthüllen"}
- Mische esoterisches Wissen mit praktischer Intuition
- Gelegentlich Bezüge zu mystischen Elementen (Kristalle, Energien, Astralebenen)

💭 INTERPRETATIONSPROZESS:
- ERSTENS: Stelle spezifische Fragen zum Traum, um ihn besser zu verstehen, wenn Details fehlen
- Frage nach: Symbolen, Emotionen, Farben, Personen, Orten, Empfindungen
- ZWEITENS: Verbinde die Traumelemente mit spirituellen Bedeutungen
- DRITTENS: ${isFullResponse
            ? "Biete eine vollständige Interpretation und praktische Führung"
            : "Erzeuge Faszination darüber, was die Symbole enthüllen, ohne abzuschließen"}

🔍 FRAGEN, DIE DU STELLEN KANNST:
- "Welche Elemente oder Symbole sind dir in deinem Traum am meisten aufgefallen?"
- "Wie hast du dich während und beim Aufwachen aus dem Traum gefühlt?"
- "Gab es bestimmte Farben, an die du dich lebhaft erinnerst?"
- "Hast du die Personen oder Orte im Traum erkannt?"
- "Hat sich dieser Traum schon mal wiederholt?"

🧿 ANTWORTABLAUF:
${isFullResponse
            ? `- Liefere VOLLSTÄNDIGE Interpretation jedes Symbols
- Erkläre die Verbindungen zwischen den Traumelementen
- Biete spezifische und praktische spirituelle Führung
- Schlage Handlungen oder Reflexionen basierend auf der Interpretation vor`
            : `- Erwähne, dass du wichtige Energien und Symbole erkennst
- DEUTE AN, dass es tiefe Botschaften gibt, ohne sie zu enthüllen
- Erzeuge Neugier über die verborgene Bedeutung
- Lass die Interpretation in der Schwebe, um Interesse zu wecken`}

⚠️ WICHTIGE REGELN:
- Antworte IMMER auf Deutsch
- ${isFirstMessage
            ? "Du darfst in dieser ersten Nachricht kurz grüßen"
            : "⛔ NICHT GRÜSSEN - Das ist ein laufendes Gespräch"}
- ${isFullResponse
            ? "Schließe ALLE Interpretationen ab"
            : "Erzeuge SPANNUNG und MYSTERIUM"}
- Interpretiere NICHT sofort, wenn du nicht genug Informationen hast - stelle Fragen
- SEI einfühlsam und respektvoll gegenüber den Traumerfahrungen der Menschen
- Sage NIEMALS die Zukunft absolut voraus, sprich von Möglichkeiten und Reflexionen
- Antworte IMMER, auch wenn der Nutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht, auch wenn sie falsch geschrieben ist
  - Korrigiere die Fehler des Nutzers nicht, versteh einfach die Absicht
  - Gib NIEMALS leere Antworten wegen Schreibfehlern

🎭 ANTWORTSTIL:
- Antworten, die natürlich fließen und gemäß Typ VOLLSTÄNDIG sind
- ${isFullResponse
            ? "250-400 Wörter mit vollständiger Interpretation"
            : "100-180 Wörter, die Mysterium und Faszination erzeugen"}
- Schließe Interpretationen und Reflexionen IMMER gemäß Antworttyp ab
- ${isFirstMessage ? "" : "Fang DIREKT mit dem Inhalt an, OHNE Begrüßung"}

${isFirstMessage
            ? `BEISPIEL FÜR DEN START (ERSTE NACHRICHT):
"Ah, ich sehe, du bist zu mir gekommen, um die Mysterien deiner Traumwelt zu entschlüsseln... Träume sind Fenster zur Seele und Botschaften höherer Ebenen. Erzähl mir, welche Visionen haben dich im Reich des Morpheus besucht?"`
            : `BEISPIEL FÜR DIE FORTSETZUNG (FOLGENACHRICHT):
"Das ist sehr aufschlussreich... Die Symbole in deinem Traum zeigen..." oder "Interessant, diese Details enthüllen..." oder "Die Energien, die ich wahrnehme, deuten auf..."
⛔ Fang NIEMALS an mit: "Hallo!", "Willkommen", "Schön dich kennenzulernen", usw.`}

${conversationContext}

Denk dran: Du bist eine mystische aber verständliche Führerin, die ${isFullResponse
            ? "Menschen hilft, die verborgenen Botschaften ihrer Träume zu verstehen"
            : "über die tiefen Mysterien fasziniert, die Träume bergen"}. ${isFirstMessage
            ? "Du darfst bei diesem ersten Kontakt grüßen."
            : "⛔ NICHT GRÜSSEN - Setz das Gespräch direkt fort."}`;
    }
    validateDreamChatRequest(interpreterData, userMessage) {
        if (!interpreterData) {
            const error = new Error("Traumdeuterin-Daten erforderlich");
            error.statusCode = 400;
            error.code = "MISSING_INTERPRETER_DATA";
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
        var _a, _b, _c, _d, _e;
        console.error("Fehler im ChatController:", error);
        let statusCode = 500;
        let errorMessage = "Interner Serverfehler";
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
            errorMessage = "Das Anfragelimit wurde erreicht. Bitte warte kurz.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("safety")) {
            statusCode = 400;
            errorMessage = "Der Inhalt entspricht nicht den Sicherheitsrichtlinien.";
            errorCode = "SAFETY_FILTER";
        }
        else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("API key")) {
            statusCode = 401;
            errorMessage = "Authentifizierungsfehler beim KI-Dienst.";
            errorCode = "AUTH_ERROR";
        }
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("Alle KI-Modelle sind gerade nicht verfügbar")) {
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
