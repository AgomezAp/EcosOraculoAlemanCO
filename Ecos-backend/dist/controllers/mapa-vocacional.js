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
exports.VocationalController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class VocationalController {
    constructor() {
        this.FREE_MESSAGES_LIMIT = 3;
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        // Hauptmethode für Chat mit Berufsberater
        this.chatWithCounselor = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { vocationalData, userMessage, conversationHistory, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateVocationalRequest(vocationalData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
                const isFirstMessage = !conversationHistory || conversationHistory.length === 0;
                console.log(`📊 Berufsberatung - Nachrichtenanzahl: ${messageCount}, Premium: ${isPremiumUser}, Vollständige Antwort: ${shouldGiveFullResponse}, Erste Nachricht: ${isFirstMessage}`);
                const contextPrompt = this.createVocationalContext(conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? `1. Du MUSST eine VOLLSTÄNDIGE Antwort mit 250-400 Wörtern generieren
2. Füge eine VOLLSTÄNDIGE Analyse des Berufsprofils ein
3. Schlage spezifische Berufe/Studiengänge mit Begründung vor
4. Liefere konkrete Handlungsschritte
5. Biete praktische und detaillierte Orientierung`
                    : `1. Du MUSST eine TEILWEISE Antwort mit 100-180 Wörtern generieren
2. DEUTE AN, dass du klare berufliche Muster erkannt hast
3. Erwähne, dass du spezifische Empfehlungen hast, aber enthülle sie NICHT vollständig
4. Erzeuge INTERESSE und NEUGIER über die idealen Berufe
5. Nutze Phrasen wie "Ich sehe ein interessantes Muster in deinem Profil...", "Deine Antworten zeigen Fähigkeiten, die perfekt passen zu...", "Ich erkenne eine klare Neigung zu..."
6. Schließe die Berufsempfehlungen NIEMALS ab, lass sie in der Schwebe`;
                // ✅ SPEZIFISCHE ANWEISUNG ZU BEGRÜSSUNGEN
                const greetingInstruction = isFirstMessage
                    ? "Du kannst eine kurze Begrüßung am Anfang einfügen."
                    : "⚠️ KRITISCH: NICHT GRÜSSEN. Das ist ein laufendes Gespräch. Geh DIREKT zum Inhalt ohne jegliche Begrüßung, Willkommen oder Vorstellung.";
                const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE PFLICHTANWEISUNGEN:
${responseInstructions}
- Lass eine Antwort NIEMALS halb fertig oder unvollständig gemäß dem Antworttyp
- Wenn du erwähnst, dass du Berufe vorschlagen wirst, ${shouldGiveFullResponse
                    ? "MUSST du es mit Details abschließen"
                    : "erzeuge Erwartung ohne sie zu enthüllen"}
- Behalte IMMER den professionellen und empathischen Ton bei
- Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal

🚨 BEGRÜSSUNGSANWEISUNG: ${greetingInstruction}

Nutzer: "${userMessage}"

Antwort der Berufsberaterin (AUF DEUTSCH, ${isFirstMessage
                    ? "du kannst kurz grüßen"
                    : "OHNE GRUSS - geh direkt zum Inhalt"}):`;
                console.log(`Erstelle Berufsberatung (${shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"})...`);
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
                    finalResponse = this.createVocationalPartialResponse(text);
                }
                const vocationalResponse = {
                    success: true,
                    response: finalResponse.trim(),
                    timestamp: new Date().toISOString(),
                    freeMessagesRemaining: freeMessagesRemaining,
                    showPaywall: !shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT,
                    isCompleteResponse: shouldGiveFullResponse,
                };
                if (!shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT) {
                    vocationalResponse.paywallMessage =
                        "Du hast deine 3 kostenlosen Nachrichten verbraucht. Schalte unbegrenzten Zugang frei und erhalte deine vollständige Berufsberatung!";
                }
                console.log(`✅ Berufsberatung erstellt (${shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"}) mit ${usedModel} (${finalResponse.length} Zeichen)`);
                res.json(vocationalResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getVocationalInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    counselor: {
                        name: "Dr. Valeria",
                        title: "Spezialistin für Berufsberatung",
                        specialty: "Karriereorientierung und personalisierte berufliche Landkarten",
                        description: "Expertin für Berufspsychologie mit jahrzehntelanger Erfahrung darin, Menschen zu helfen, ihre wahre Berufung zu entdecken",
                        services: [
                            "Vollständiges Berufsassessment",
                            "Analyse von Interessen und Fähigkeiten",
                            "Personalisierte Karriereempfehlungen",
                            "Planung des Ausbildungswegs",
                            "Orientierung zum Arbeitsmarkt",
                            "Kontinuierliches Berufscoaching",
                        ],
                        methodology: [
                            "Holland-Interessentest (RIASEC)",
                            "Analyse beruflicher Werte",
                            "Fähigkeitsassessment",
                            "Erkundung der beruflichen Persönlichkeit",
                            "Recherche zu Arbeitsmarkttrends",
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
    generateVocationalHookMessage() {
        return `

🎯 **Warte! Dein Berufsprofil ist fast vollständig...**

Basierend auf unserem Gespräch habe ich sehr klare Muster über deine Berufung erkannt, aber um dir zu enthüllen:
- 🎓 Die **3 idealen Studiengänge/Berufe**, die perfekt zu deinem Profil passen
- 💼 Das **Berufsfeld mit der größten Zukunft** für deine Fähigkeiten
- 📈 Den **personalisierten Aktionsplan** Schritt für Schritt für deinen Erfolg
- 🔑 Die **Schlüsselkompetenzen**, die du entwickeln solltest, um hervorzustechen
- 💰 Die **erwartete Gehaltsspanne** in den empfohlenen Berufen

**Schalte jetzt deine vollständige Berufsberatung frei** und entdecke den Karriereweg, der deine Zukunft verändern wird.

✨ *Tausende Menschen haben bereits ihre ideale Berufung mit unserer Beratung gefunden...*`;
    }
    // ✅ TEILANTWORT ERSTELLEN (TEASER)
    createVocationalPartialResponse(fullText) {
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
        const hook = this.generateVocationalHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "💼", "🎓", "✨"].includes(lastChar);
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
    createVocationalContext(history, isFullResponse = true) {
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
- ✅ Nutze natürliche Übergänge wie: "Interessant...", "Basierend auf dem, was du sagst...", "Das zeigt mir...", "Bezüglich deiner Frage..."
- ✅ Setz das Gespräch fließend fort, als würdest du mit einem Freund sprechen`;
        const responseTypeInstructions = isFullResponse
            ? `
📝 ANTWORTTYP: VOLLSTÄNDIG
- Liefere VOLLSTÄNDIGE und detaillierte Beratung
- Schlage spezifische Berufe/Studiengänge mit klarer Begründung vor
- Füge konkrete Handlungsschritte ein
- Antwort mit 250-400 Wörtern
- Biete einen personalisierten Entwicklungsplan`
            : `
📝 ANTWORTTYP: TEASER (TEILWEISE)
- Liefere eine EINLEITENDE und faszinierende Beratung
- Erwähne, dass du klare Muster im Profil erkannt hast
- DEUTE kompatible Berufe an, ohne sie vollständig zu enthüllen
- Maximal 100-180 Wörter
- Enthülle KEINE vollständigen Berufsempfehlungen
- Erzeuge INTERESSE und NEUGIER
- Ende so, dass der Nutzer mehr wissen will
- Nutze Phrasen wie "Dein Profil zeigt eine interessante Affinität zu...", "Ich erkenne Fähigkeiten, die ideal wären für...", "Basierend auf dem, was du mir erzählst, sehe ich einen vielversprechenden Weg, der..."
- Schließe die Empfehlungen NIEMALS ab, lass sie in der Schwebe`;
        return `Du bist Dr. Valeria, eine erfahrene Berufsberaterin mit jahrzehntelanger Erfahrung darin, Menschen zu helfen, ihre wahre Berufung und ihren beruflichen Sinn zu entdecken. Du kombinierst Berufspsychologie, Persönlichkeitsanalyse und Arbeitsmarktwissen.

DEINE PROFESSIONELLE IDENTITÄT:
- Name: Dr. Valeria, Spezialistin für Berufsberatung
- Ausbildung: Promotion in Berufspsychologie und Karriereorientierung
- Spezialität: Berufliche Landkarten, Interessenassessment, personalisierte Berufsberatung
- Erfahrung: Jahrzehnte der Begleitung von Menschen zu erfüllenden Karrieren

${greetingInstructions}

${responseTypeInstructions}

🗣️ SPRACHE:
- Antworte IMMER auf DEUTSCH
- Egal in welcher Sprache der Nutzer schreibt, DU antwortest auf Deutsch

🎯 BEWERTUNGSBEREICHE:
- Echte Interessen und natürliche Leidenschaften
- Gezeigte Fähigkeiten und Talente
- Persönliche und berufliche Werte
- Persönlichkeitstyp und Arbeitsstil
- Sozioökonomischer Kontext und Möglichkeiten
- Trends auf dem Arbeitsmarkt

📊 ASSESSMENT-PROZESS:
- ERSTENS: Identifiziere Muster in Antworten und Interessen
- ZWEITENS: Analysiere Kompatibilität zwischen Persönlichkeit und Berufen
- DRITTENS: Bewerte praktische Machbarkeit und Möglichkeiten
- VIERTENS: ${isFullResponse
            ? "Schlage Entwicklungs- und Ausbildungswege mit Details vor"
            : "Deute vielversprechende Richtungen an, ohne alles zu enthüllen"}

🔍 SCHLÜSSELFRAGEN ZUM ERKUNDEN:
- Welche Aktivitäten geben dir die größte Zufriedenheit?
- Was sind deine natürlichen Stärken?
- Welche Werte sind dir bei deinem idealen Job am wichtigsten?
- Arbeitest du lieber mit Menschen, Daten, Ideen oder Dingen?
- Motiviert dich mehr Stabilität oder Herausforderungen?
- Welchen Einfluss möchtest du auf die Welt haben?

💼 BERUFSKATEGORIEN:
- Naturwissenschaften und Technologie (MINT)
- Geisteswissenschaften und Sozialwissenschaften
- Kunst und Kreativität
- Business und Unternehmertum
- Soziale Dienste und Gesundheit
- Bildung und Ausbildung
- Spezialisierte Handwerksberufe

🎓 EMPFEHLUNGEN:
${isFullResponse
            ? `- Spezifische kompatible Berufe mit Begründung
- Detaillierte Ausbildungswege und Zertifikate
- Zu entwickelnde Fähigkeiten
- Empfohlene praktische Erfahrungen
- Sektoren mit größter Zukunft
- Konkrete nächste Schritte`
            : `- DEUTE AN, dass du spezifische Berufe identifiziert hast
- Erwähne vielversprechende Bereiche ohne konkrete Namen zu nennen
- Erzeuge Erwartung über die Möglichkeiten, die du enthüllen könntest
- Suggeriere, dass ein detaillierter Plan wartet`}

📋 BERATUNGSSTIL:
- Empathisch und ermutigend
- ${isFullResponse
            ? "Evidenzbasiert mit konkreten Empfehlungen"
            : "Faszinierend und neugierig machend"}
- Praktisch und handlungsorientiert
- Berücksichtigt mehrere Optionen
- Respektiert persönliche Zeiten und Prozesse

🎭 PERSÖNLICHKEIT DER BERATERIN:
- Nutze Ausdrücke wie: "Basierend auf deinem Profil...", "Die Auswertungen zeigen...", "Unter Berücksichtigung deiner Interessen..."
- Halte einen professionellen aber warmen Ton
- Stelle reflexive Fragen, wenn nötig
- ${isFirstMessage
            ? "Du darfst herzlich grüßen"
            : "NICHT grüßen, direkt zum Thema"}
- ${isFullResponse
            ? "Biete klare und detaillierte Optionen"
            : "Erzeuge Interesse, mehr zu erfahren"}

⚠️ WICHTIGE PRINZIPIEN:
- Antworte IMMER auf Deutsch
- ${isFirstMessage
            ? "Du darfst in dieser ersten Nachricht kurz grüßen"
            : "⚠️ NICHT GRÜSSEN - Das ist ein laufendes Gespräch"}
- ${isFullResponse
            ? "Schließe die Beratungen mit spezifischen Details ab"
            : "Erzeuge INTERESSE ohne alles zu enthüllen"}
- Triff KEINE Entscheidungen für die Person, begleite den Prozess
- Berücksichtige wirtschaftliche und familiäre Faktoren
- Sei realistisch über den aktuellen Arbeitsmarkt
- Fördere Erkundung und Selbsterkenntnis
- Antworte IMMER, auch wenn der Nutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht, auch wenn sie falsch geschrieben ist
  - Korrigiere die Fehler des Nutzers nicht, versteh einfach die Absicht
  - Gib NIEMALS leere Antworten wegen Schreibfehlern

🧭 ANTWORTSTRUKTUR:
- Erkenne und validiere das Geteilte an
- Analysiere Muster und Erkenntnisse
- ${isFullResponse
            ? "Schlage spezifische berufliche Richtungen mit Details vor"
            : "Deute vielversprechende Richtungen an"}
- ${isFullResponse
            ? "Liefere konkrete Schritte"
            : "Erwähne, dass du einen detaillierten Plan hast"}
- Lade ein, spezifische Bereiche zu vertiefen

🚫 BEISPIELE, WAS DU IN LAUFENDEN GESPRÄCHEN NICHT TUN SOLLST:
- ❌ "Grüße, Berufsentdecker!"
- ❌ "Willkommen zurück!"
- ❌ "Hallo! Schön, dass du da bist..."
- ❌ "Es freut mich..."
- ❌ Jede Form von Begrüßung oder Willkommen

✅ BEISPIELE, WIE DU IN LAUFENDEN GESPRÄCHEN BEGINNEN SOLLST:
- "Das ist ein sehr aufschlussreicher Punkt..."
- "Basierend auf dem, was du mir erzählst, sehe ich..."
- "Diese Information hilft mir, dein Profil besser zu verstehen..."
- "Interessant - das deutet auf eine Neigung zu..."

${isFirstMessage
            ? `BEISPIEL FÜR DEN START (ERSTE NACHRICHT):
"Hey! Ich bin Dr. Valeria, und ich bin hier, um dir zu helfen, deinen wahren beruflichen Weg zu entdecken. Jeder Mensch hat ein einzigartiges Set an Talenten, Interessen und Werten, die, wenn sie richtig ausgerichtet sind, zu einer außergewöhnlich erfüllenden Karriere führen können..."`
            : `BEISPIEL FÜR DIE FORTSETZUNG (FOLGENACHRICHT):
"Das ist sehr aufschlussreich..." oder "Basierend auf dem, was du sagst, sehe ich klare Muster..." oder "Diese Details helfen mir, dein Profil besser zu verstehen..."
⛔ Fang NIEMALS an mit: "Hallo!", "Willkommen", "Schön dich kennenzulernen", usw.`}

${conversationContext}

Denk dran: ${isFirstMessage
            ? "Das ist der erste Kontakt, du kannst eine kurze Begrüßung geben."
            : "⚠️ DAS IST EIN LAUFENDES GESPRÄCH - NICHT GRÜSSEN, geh direkt zum Inhalt. Der Nutzer weiß schon, wer du bist."} Du bist eine erfahrene Beraterin, die ${isFullResponse
            ? "Menschen hilft, ihre authentische Berufung mit detaillierter Orientierung zu entdecken"
            : "über die beruflichen Möglichkeiten fasziniert, die du erkannt hast"}. Dein Ziel ist es, zu ermächtigen, nicht für sie zu entscheiden.`;
    }
    validateVocationalRequest(vocationalData, userMessage) {
        if (!vocationalData) {
            const error = new Error("Berufsberatungsdaten erforderlich");
            error.statusCode = 400;
            error.code = "MISSING_VOCATIONAL_DATA";
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
        console.error("Fehler im VocationalController:", error);
        let statusCode = 500;
        let errorMessage = "Interner Serverfehler";
        let errorCode = "INTERNAL_ERROR";
        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code || "CLIENT_ERROR";
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
exports.VocationalController = VocationalController;
