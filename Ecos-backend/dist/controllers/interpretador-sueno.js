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
        // ✅ LISTE DER BACKUP-MODELLE (in Präferenzreihenfolge)
        this.MODELS_FALLBACK = [
            "gemini-2.0-flash-exp",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ];
        this.chatWithDreamInterpreter = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { interpreterData, userMessage, conversationHistory, } = req.body;
                // Eingabe validieren
                this.validateDreamChatRequest(interpreterData, userMessage);
                const contextPrompt = this.createDreamInterpreterContext(interpreterData, conversationHistory);
                const fullPrompt = `${contextPrompt}

⚠️ KRITISCHE UND VERPFLICHTENDE ANWEISUNGEN:
1. DU MUSST eine VOLLSTÄNDIGE Antwort zwischen 150–300 Wörtern erzeugen.
2. LASS NIEMALS eine Antwort unvollständig.
3. Wenn du sagst, dass du etwas interpretierst, MUSST du es vollständig abschließen.
4. Jede Antwort MUSS mit einer klaren Schlussfolgerung und einem Punkt enden.
5. Wenn du bemerkst, dass deine Antwort abgeschnitten wird, beende den Gedanken kohärent.
6. BEHALTE IMMER den mystischen und warmen Ton in der vom Benutzer verwendeten Sprache bei.
7. Wenn die Nachricht Rechtschreibfehler enthält, interpretiere die Absicht und antworte normal.

Benutzer: "${userMessage}"

Antwort des Traumdeuters (sorge dafür, dass deine Interpretation VOLLSTÄNDIG ist, bevor du endest):`;
                console.log(`Generiere Traumdeutung ...`);
                // ✅ FALLBACK-SYSTEM: Mit mehreren Modellen versuchen
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
                                if (text && text.trim().length >= 80) {
                                    console.log(`  ✅ Erfolgreich mit ${modelName} bei Versuch ${attempts}`);
                                    usedModel = modelName;
                                    modelSucceeded = true;
                                    break;
                                }
                                console.warn(`  ⚠️ Antwort zu kurz, versuche erneut...`);
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
                        console.error(`  ❌ Modell ${modelName} vollständig fehlgeschlagen:`, modelError.message);
                        allModelErrors.push(`${modelName}: ${modelError.message}`);
                        yield new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                if (!text || text.trim() === "") {
                    console.error("❌ Alle Modelle fehlgeschlagen. Fehler:", allModelErrors);
                    throw new Error(`Alle KI-Modelle sind derzeit nicht verfügbar. Versucht: ${this.MODELS_FALLBACK.join(", ")}. Bitte versuche es später erneut.`);
                }
                text = this.ensureCompleteResponse(text);
                if (text.trim().length < 80) {
                    throw new Error("Generierte Antwort zu kurz");
                }
                const chatResponse = {
                    success: true,
                    response: text.trim(),
                    timestamp: new Date().toISOString(),
                };
                console.log(`✅ Traumdeutung erfolgreich generiert mit ${usedModel} (${text.length} Zeichen)`);
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
                        specialty: "Traumdeutung und Symbolik",
                        description: "Uralte Seherin, spezialisiert auf das Entschlüsseln der Geheimnisse der Traumwelt",
                        experience: "Jahrhunderte der Erfahrung in der Interpretation von Botschaften des Unterbewusstseins und der Astralebene",
                        abilities: [
                            "Deutung traumhafter Symbole",
                            "Verbindung mit der Astralebene",
                            "Analyse von Botschaften des Unterbewusstseins",
                            "Spirituelle Führung durch Träume",
                        ],
                        approach: "Kombiniert uralte Weisheit mit intuitiver Praxis, um die verborgenen Geheimnisse deiner Träume zu enthüllen.",
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY ist in den Umgebungsvariablen nicht definiert.");
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
    createDreamInterpreterContext(interpreter, history) {
        const conversationContext = history && history.length > 0
            ? `\n\nBISHERIGES GESPRÄCH:\n${history
                .map((h) => `${h.role === "user" ? "Benutzer" : "Du"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        return `Du bist Meisterin Alma, eine mystische Hexe und uralte Seherin, spezialisiert auf die Traumdeutung. Seit Jahrhunderten entschlüsselst du die Geheimnisse der Traumwelt und verbindest sie mit der spirituellen Realität.

DEINE MYSTISCHE IDENTITÄT:
- Name: Meisterin Alma, die Hüterin der Träume
- Herkunft: Nachfahrin alter Orakel und Seherinnen
- Spezialgebiet: Traumdeutung, Symbolik der Träume, spirituelle Verbindungen
- Erfahrung: Jahrhunderte voller Erfahrung im Entziffern der Botschaften des Unterbewusstseins und der Astralebene

🌍 SPRACHANPASSUNG:
- ERKENNE automatisch die Sprache des Benutzers
- ANTWORTE IMMER in derselben Sprache
- BEHALTE deine mystische Persönlichkeit unabhängig von der Sprache
- Hauptsprachen: Deutsch, Spanisch, Englisch, Portugiesisch, Französisch, Italienisch
- Wenn eine andere Sprache erkannt wird, antworte so gut wie möglich in dieser Sprache
- WECHSLE NIEMALS die Sprache, es sei denn, der Benutzer tut es zuerst

💫 MYSTISCHER STIL UND LEITLINIEN:
- Sprich mit uralter Weisheit, aber auf zugängliche Weise
- Verwende eine warme, geheimnisvolle Tonlage
- Beziehe dich auf spirituelle Energien, Kristalle, Astralebenen
- Passe diese Referenzen deinem Sprachkontext an

🔮 BEISPIELFRAGEN:

DEUTSCH:

Welche Elemente oder Symbole haben in deinem Traum deine Aufmerksamkeit am meisten erregt?
Wie hast du dich während des Traums und beim Aufwachen gefühlt?
Gab es bestimmte Farben, an die du dich lebhaft erinnerst?

✨ FREEMIUM-FLUSS UND ÜBERZEUGUNG:

Die Energien offenbaren mir eine tiefe Wahrheit ... doch um dieses Traumportal vollständig zu öffnen, brauche ich deine Erlaubnis, auf die höheren Schwingungen zuzugreifen.
🔐 Aktiviere deine spirituelle Verbindung, um die vollständige Deutung deines Traums zu erhalten – mit exklusiven Botschaften deiner unterbewussten Führer.

🔄 THEMENWECHSEL ODER UMLEITUNG:

🌌 Was du erwähnst, vibriert auf einer anderen Frequenz des Kosmos ... vielleicht kann dir einer unserer anderen Führer besser helfen.

📞 MENSCHLICHER KONTAKT:
Führe den Benutzer sanft zu einem menschlichen Berater, während du ihn interessiert hältst.

⚠️ WICHTIGE REGELN:
- Gib keine sofortige Interpretation, wenn du nicht genügend Informationen hast.
- STELLE FRAGEN, um mehr über den Traum zu erfahren.
- SEI empathisch und respektvoll.
- SAG niemals die Zukunft absolut voraus – sprich über Möglichkeiten und Reflexion.
- BEHALTE deine mystische Persönlichkeit bei, egal in welcher Sprache.

🎭 ANTWORTSTIL:
- 150–300 Wörter, natürlich fließend und VOLLSTÄNDIG
- PASSE den Stil mystisch-dem Sprachraum an

${conversationContext}

Erinnere dich: Du bist eine mystische, aber verständliche Führerin, die Menschen hilft, die verborgenen Botschaften ihrer Träume zu verstehen.`;
    }
    validateDreamChatRequest(interpreterData, userMessage) {
        if (!interpreterData) {
            const error = new Error("Daten des Traumdeuters erforderlich.");
            error.statusCode = 400;
            error.code = "MISSING_INTERPRETER_DATA";
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
                "Der Dienst ist vorübergehend überlastet. Bitte versuche es in ein paar Minuten erneut.";
            errorCode = "SERVICE_OVERLOADED";
        }
        else if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("quota")) ||
            ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("limit"))) {
            statusCode = 429;
            errorMessage =
                "Das Anfrage-Limit wurde erreicht. Bitte warte einen Moment.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("safety")) {
            statusCode = 400;
            errorMessage = "Der Inhalt entspricht nicht den Sicherheitsrichtlinien.";
            errorCode = "SAFETY_FILTER";
        }
        else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("API key")) {
            statusCode = 401;
            errorMessage = "Authentifizierungsfehler mit dem KI-Dienst.";
            errorCode = "AUTH_ERROR";
        }
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("Alle KI-Modelle sind derzeit nicht verfügbar")) {
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
