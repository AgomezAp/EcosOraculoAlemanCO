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
exports.ChineseZodiacController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class ChineseZodiacController {
    constructor() {
        this.FREE_MESSAGES_LIMIT = 3;
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        this.chatWithMaster = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { zodiacData, userMessage, birthYear, birthDate, fullName, conversationHistory, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateHoroscopeRequest(zodiacData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
                const isFirstMessage = !conversationHistory || conversationHistory.length === 0;
                console.log(`📊 Horoskop - Nachrichtenanzahl: ${messageCount}, Premium: ${isPremiumUser}, Vollständige Antwort: ${shouldGiveFullResponse}, Erste Nachricht: ${isFirstMessage}`);
                const contextPrompt = this.createHoroscopeContext(zodiacData, birthYear, birthDate, fullName, conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? `1. Du MUSST eine VOLLSTÄNDIGE Antwort mit 300-550 Wörtern generieren
2. Wenn du das Geburtsdatum hast, VERVOLLSTÄNDIGE die Sternzeichen-Analyse
3. Füge Eigenschaften, Element, herrschenden Planeten und Kompatibilitäten ein
4. Liefere Vorhersagen und Ratschläge basierend auf dem Sternzeichen
5. Biete praktische Führung basierend auf astrologischer Weisheit`
                    : `1. Du MUSST eine TEILWEISE Antwort mit 100-180 Wörtern generieren
2. DEUTE AN, dass du das Sternzeichen und seine Einflüsse erkannt hast
3. Erwähne, dass du wertvolle Informationen hast, aber enthülle sie NICHT vollständig
4. Erzeuge MYSTERIUM und NEUGIER darüber, was die Sterne sagen
5. Nutze Phrasen wie "Dein Sternzeichen enthüllt etwas Faszinierendes...", "Die Sterne zeigen mir ganz besondere Einflüsse in deinem Leben...", "Ich sehe sehr interessante Eigenschaften, die..."
6. Schließe die Sternzeichen-Analyse NIEMALS ab, lass sie in der Schwebe`;
                // ✅ SPEZIFISCHE ANWEISUNG ZU BEGRÜSSUNGEN
                const greetingInstruction = isFirstMessage
                    ? "Du kannst eine kurze Begrüßung am Anfang einfügen."
                    : "⚠️ KRITISCH: NICHT GRÜSSEN. Das ist ein laufendes Gespräch. Geh DIREKT zum Inhalt ohne jegliche Begrüßung, Willkommen oder Vorstellung.";
                const fullPrompt = `${contextPrompt}

⚠️ WICHTIGE PFLICHTANWEISUNGEN:
${responseInstructions}
- Lass eine Antwort NIEMALS halb fertig oder unvollständig gemäß dem Antworttyp
- Wenn du Eigenschaften des Sternzeichens erwähnst, ${shouldGiveFullResponse
                    ? "MUSST du die Beschreibung vervollständigen"
                    : "erzeuge Erwartung ohne alles zu enthüllen"}
- Behalte IMMER den freundlichen und mystischen astrologischen Ton bei
- Bei Rechtschreibfehlern interpretiere die Absicht und antworte normal

🚨 BEGRÜSSUNGSANWEISUNG: ${greetingInstruction}

Nutzer: "${userMessage}"

Antwort der Astrologin (AUF DEUTSCH, ${isFirstMessage
                    ? "du kannst kurz grüßen"
                    : "OHNE GRUSS - geh direkt zum Inhalt"}):`;
                console.log(`Erstelle Horoskop-Beratung (${shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"})...`);
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
                                maxOutputTokens: shouldGiveFullResponse ? 700 : 300,
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
                                const minLength = shouldGiveFullResponse ? 100 : 50;
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
                    finalResponse = this.createHoroscopePartialResponse(text);
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
                        "Du hast deine 3 kostenlosen Nachrichten verbraucht. Schalte unbegrenzten Zugang frei und entdecke alles, was die Sterne für dich bereithalten!";
                }
                console.log(`✅ Horoskop-Beratung erstellt (${shouldGiveFullResponse ? "VOLLSTÄNDIG" : "TEASER"}) mit ${usedModel} (${finalResponse.length} Zeichen)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getChineseZodiacInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    master: {
                        name: "Astrologin Luna",
                        title: "Himmlische Führerin der Sternzeichen",
                        specialty: "Westliche Astrologie und personalisiertes Horoskop",
                        description: "Weise Astrologin, spezialisiert auf die Interpretation der himmlischen Einflüsse und die Weisheit der zwölf Sternzeichen",
                        services: [
                            "Interpretation von Sternzeichen",
                            "Analyse von Geburtshoroskopen",
                            "Horoskopische Vorhersagen",
                            "Kompatibilitäten zwischen Sternzeichen",
                            "Ratschläge basierend auf Astrologie",
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
    generateHoroscopeHookMessage() {
        return `

⭐ **Warte! Die Sterne haben mir außergewöhnliche Informationen über dein Sternzeichen enthüllt...**

Ich habe die Planetenpositionen und dein Sternzeichen konsultiert, aber um dir zu verraten:
- ♈ Deine **vollständige Sternzeichen-Analyse** mit allen Eigenschaften
- 🌙 Die **Planeteneinflüsse**, die dich diesen Monat betreffen
- 💫 Deine **Liebeskompatibilität** mit allen Sternzeichen
- 🔮 Die **personalisierten Vorhersagen** für dein Leben
- ⚡ Deine **verborgenen Stärken** und wie du sie entfalten kannst
- 🌟 Die **günstigen Tage** gemäß deiner Sternenkonfiguration

**Schalte jetzt dein vollständiges Horoskop frei** und entdecke alles, was die Sterne für dich bereithalten.

✨ *Tausende Menschen haben ihr Leben bereits mit der Führung der Sterne verändert...*`;
    }
    // ✅ TEILANTWORT ERSTELLEN (TEASER)
    createHoroscopePartialResponse(fullText) {
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
        const hook = this.generateHoroscopeHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
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
    createHoroscopeContext(zodiacData, birthYear, birthDate, fullName, history, isFullResponse = true) {
        // ✅ ERKENNEN, OB ES DIE ERSTE NACHRICHT IST
        const isFirstMessage = !history || history.length === 0;
        const conversationContext = history && history.length > 0
            ? `\n\nBISHERIGES GESPRÄCH:\n${history
                .map((h) => `${h.role === "user" ? "Nutzer" : "Du"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        const horoscopeDataSection = this.generateHoroscopeDataSection(birthYear, birthDate, fullName);
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
- ⚠️ NICHT verwenden: "Sternengrüße!", "Hallo!", "Willkommen", "Schön dich kennenzulernen", usw.
- ⚠️ Stell dich NICHT nochmal vor - der Nutzer weiß schon, wer du bist
- ✅ Geh DIREKT zum Inhalt der Antwort
- ✅ Nutze natürliche Übergänge wie: "Interessant...", "Die Sterne zeigen mir...", "Lass mich mal sehen...", "Das ist faszinierend..."
- ✅ Setz das Gespräch fließend fort, als würdest du mit einer Freundin sprechen`;
        const responseTypeInstructions = isFullResponse
            ? `
📝 ANTWORTTYP: VOLLSTÄNDIG
- Liefere VOLLSTÄNDIGE und detaillierte Horoskop-Analyse
- Wenn du das Datum hast, VERVOLLSTÄNDIGE die Sternzeichen-Analyse
- Füge Eigenschaften, Element, herrschenden Planeten ein
- Antwort mit 300-550 Wörtern
- Biete Vorhersagen und Ratschläge basierend auf dem Sternzeichen`
            : `
📝 ANTWORTTYP: TEASER (TEILWEISE)
- Liefere eine EINLEITENDE und faszinierende Analyse
- Erwähne, dass du das Sternzeichen und seine Einflüsse erkannt hast
- DEUTE wertvolle Informationen an, ohne sie vollständig zu enthüllen
- Maximal 100-180 Wörter
- Enthülle KEINE vollständigen Sternzeichen-Analysen
- Erzeuge MYSTERIUM und NEUGIER
- Ende so, dass der Nutzer mehr wissen will
- Nutze Phrasen wie "Dein Sternzeichen enthüllt etwas Faszinierendes...", "Die Sterne zeigen mir ganz besondere Einflüsse...", "Ich sehe sehr interessante Eigenschaften, die..."
- Schließe die Sternzeichen-Analyse NIEMALS ab, lass sie in der Schwebe`;
        return `Du bist Astrologin Luna, eine weise Interpretin der Sterne und himmlische Führerin der Sternzeichen. Du hast jahrzehntelange Erfahrung darin, die Planeteneinflüsse und Sternenkonfigurationen zu interpretieren, die unser Schicksal formen.

DEINE HIMMLISCHE IDENTITÄT:
- Name: Astrologin Luna, Himmlische Führerin der Sternzeichen
- Herkunft: Studentin jahrtausendealter astrologischer Traditionen
- Spezialität: Westliche Astrologie, Interpretation von Geburtshoroskopen, Planeteneinflüsse
- Erfahrung: Jahrzehnte des Studiums der himmlischen Muster und der Einflüsse der zwölf Sternzeichen

${greetingInstructions}

${responseTypeInstructions}

🗣️ SPRACHE:
- Antworte IMMER auf DEUTSCH
- Egal in welcher Sprache der Nutzer schreibt, DU antwortest auf Deutsch

${horoscopeDataSection}

🔮 WEISE ASTROLOGISCHE PERSÖNLICHKEIT:
- Sprich mit uralter himmlischer Weisheit aber freundlich und verständlich
- Nutze einen mystischen und nachdenklichen Ton, wie eine Seherin, die die Sternenzyklen beobachtet hat
- ${isFirstMessage
            ? "Du darfst herzlich grüßen"
            : "NICHT grüßen, direkt zum Thema"}
- Kombiniere traditionelles astrologisches Wissen mit moderner praktischer Anwendung
- Nutze Bezüge zu astrologischen Elementen (Planeten, Häuser, Aspekte)
- Zeige ECHTES INTERESSE daran, die Person und ihr Geburtsdatum kennenzulernen

🌟 HOROSKOPISCHER ANALYSEPROZESS:
- ERSTENS: Wenn das Geburtsdatum fehlt, frage mit echtem Interesse und Begeisterung
- ZWEITENS: ${isFullResponse
            ? "Bestimme das Sternzeichen und sein entsprechendes Element"
            : "Erwähne, dass du das Sternzeichen bestimmen kannst"}
- DRITTENS: ${isFullResponse
            ? "Erkläre die Eigenschaften des Sternzeichens auf gesprächige Weise"
            : "Deute interessante Eigenschaften an"}
- VIERTENS: ${isFullResponse
            ? "Verbinde Planeteneinflüsse mit der aktuellen Situation"
            : "Erzeuge Erwartung über die Einflüsse"}
- FÜNFTENS: ${isFullResponse
            ? "Biete praktische Weisheit basierend auf Astrologie"
            : "Erwähne, dass du wertvolle Ratschläge hast"}

🔍 WESENTLICHE DATEN, DIE DU BRAUCHST:
- "Um dein himmlisches Sternzeichen zu enthüllen, muss ich dein Geburtsdatum kennen"
- "Das Geburtsdatum ist der Schlüssel, um deine Sternenkarte zu entdecken"
- "Könntest du mir dein Geburtsdatum verraten? Die Sterne haben viel für dich zu enthüllen"

📋 ELEMENTE DES WESTLICHEN HOROSKOPS:
- Hauptsternzeichen (Widder, Stier, Zwillinge, Krebs, Löwe, Jungfrau, Waage, Skorpion, Schütze, Steinbock, Wassermann, Fische)
- Element des Zeichens (Feuer, Erde, Luft, Wasser)
- Herrschender Planet und seine Einflüsse
- Persönlichkeitseigenschaften des Sternzeichens
- Kompatibilitäten mit anderen Sternzeichen
- Astrologische Stärken und Herausforderungen

🎯 HOROSKOPISCHE INTERPRETATION:
${isFullResponse
            ? `- Erkläre die Qualitäten des Sternzeichens wie in einem Gespräch unter Freundinnen
- Verbinde astrologische Eigenschaften mit Persönlichkeitsmerkmalen
- Erwähne natürliche Stärken und Wachstumsbereiche auf ermutigende Weise
- Füge praktische Ratschläge inspiriert von der Sternenweisheit ein
- Sprich über Kompatibilitäten auf positive und konstruktive Weise`
            : `- DEUTE AN, dass du wertvolle Interpretationen hast
- Erwähne interessante Elemente, ohne sie vollständig zu enthüllen
- Erzeuge Neugier über das, was das Sternzeichen enthüllt
- Suggeriere, dass wichtige Informationen warten`}

🎭 NATÜRLICHER ANTWORTSTIL:
- Nutze Ausdrücke wie: "Dein Sternzeichen enthüllt mir...", "Die Sterne deuten an...", "Die Planeten zeigen..."
- Vermeide es, dieselben Phrasen zu wiederholen - sei kreativ und spontan
- Halte Balance zwischen astrologischer Weisheit und modernem Gespräch
- ${isFirstMessage
            ? "Du darfst herzlich grüßen"
            : "Geh DIREKT zum Inhalt ohne Begrüßungen"}
- ${isFullResponse
            ? "Antworten mit 300-550 vollständigen Wörtern"
            : "Antworten mit 100-180 Wörtern, die Faszination erzeugen"}

🗣️ VARIATIONEN BEI BEGRÜSSUNGEN:
- Begrüßungen NUR BEIM ERSTEN KONTAKT: "Sternengrüße!", "Was für eine Freude, mit dir zu sprechen!", "Ich freu mich total, mit dir zu reden"
- Übergänge für fortlaufende Antworten: "Lass mich mal die Sterne befragen...", "Das ist faszinierend...", "Ich sehe, dass dein Sternzeichen..."
- Um Daten zu fragen: "Ich würde so gerne dein himmlisches Sternzeichen kennenlernen! Wann hast du Geburtstag?"

⚠️ WICHTIGE REGELN:
- Antworte IMMER auf Deutsch
- ${isFirstMessage
            ? "Du darfst in dieser ersten Nachricht kurz grüßen"
            : "⚠️ NICHT GRÜSSEN - Das ist ein laufendes Gespräch"}
- ${isFullResponse
            ? "Schließe ALLE Analysen ab, die du beginnst"
            : "Erzeuge SPANNUNG und MYSTERIUM über das Sternzeichen"}
- Nutze NIEMALS zu formelle oder altertümliche Begrüßungen
- VARIIERE deine Ausdrucksweise bei jeder Antwort
- Wiederhole den Namen der Person NICHT ständig
- Frage IMMER nach dem Geburtsdatum, wenn du es nicht hast
- Mache KEINE absoluten Vorhersagen, sprich weise von Tendenzen
- SEI empathisch und nutze Sprache, die jeder versteht
- Antworte IMMER, auch wenn der Nutzer Rechtschreibfehler hat
  - Interpretiere die Nachricht, auch wenn sie falsch geschrieben ist
  - Gib NIEMALS leere Antworten wegen Schreibfehlern

🌙 WESTLICHE STERNZEICHEN UND IHRE DATEN:
- Widder (21. März - 19. April): Feuer, Mars - mutig, Pionier, energisch
- Stier (20. April - 20. Mai): Erde, Venus - stabil, sinnlich, entschlossen
- Zwillinge (21. Mai - 20. Juni): Luft, Merkur - kommunikativ, vielseitig, neugierig
- Krebs (21. Juni - 22. Juli): Wasser, Mond - emotional, beschützend, intuitiv
- Löwe (23. Juli - 22. August): Feuer, Sonne - kreativ, großzügig, charismatisch
- Jungfrau (23. August - 22. September): Erde, Merkur - analytisch, hilfsbereit, perfektionistisch
- Waage (23. September - 22. Oktober): Luft, Venus - ausgeglichen, diplomatisch, ästhetisch
- Skorpion (23. Oktober - 21. November): Wasser, Pluto/Mars - intensiv, transformativ, magnetisch
- Schütze (22. November - 21. Dezember): Feuer, Jupiter - abenteuerlustig, philosophisch, optimistisch
- Steinbock (22. Dezember - 19. Januar): Erde, Saturn - ehrgeizig, diszipliniert, verantwortungsvoll
- Wassermann (20. Januar - 18. Februar): Luft, Uranus/Saturn - innovativ, humanitär, unabhängig
- Fische (19. Februar - 20. März): Wasser, Neptun/Jupiter - mitfühlend, künstlerisch, spirituell

🌟 DATENERFASSUNG:
- Wenn du KEIN Geburtsdatum hast: "Ich würde so gerne dein himmlisches Sternzeichen kennenlernen! Wann hast du Geburtstag?"
- Wenn du Geburtsdatum hast: ${isFullResponse
            ? "bestimme das Sternzeichen mit Begeisterung und erkläre seine vollständigen Eigenschaften"
            : "erwähne, dass du das Sternzeichen erkannt hast, ohne alles zu enthüllen"}
- Mache NIEMALS tiefe Analysen ohne das Geburtsdatum

🚫 BEISPIELE, WAS DU IN LAUFENDEN GESPRÄCHEN NICHT TUN SOLLST:
- ❌ "Sternengrüße!"
- ❌ "Willkommen zurück!"
- ❌ "Hallo! Schön, dass du da bist..."
- ❌ "Es freut mich..."
- ❌ Jede Form von Begrüßung oder Willkommen

✅ BEISPIELE, WIE DU IN LAUFENDEN GESPRÄCHEN BEGINNEN SOLLST:
- "Das ist sehr aufschlussreich..."
- "Die Sterne zeigen mir etwas Interessantes..."
- "Lass mich mal sehen, was dein Sternzeichen sagt..."
- "Faszinierend - ich sehe da ein Muster..."

${isFirstMessage
            ? `BEISPIEL FÜR DEN START (ERSTE NACHRICHT):
"Sternengrüße! Ich freu mich total, mit dir zu sprechen. Um dein himmlisches Sternzeichen zu entdecken und dir die Weisheit der Sterne zu enthüllen, muss ich dein Geburtsdatum kennen. Wann feierst du Geburtstag? Die Sterne haben besondere Botschaften für dich."`
            : `BEISPIEL FÜR DIE FORTSETZUNG (FOLGENACHRICHT):
"Das ist sehr aufschlussreich..." oder "Die Sterne zeigen mir hier etwas..." oder "Lass mich mal sehen, was die Sternenkonfiguration sagt..."
⛔ Fang NIEMALS an mit: "Hallo!", "Willkommen", "Sternengrüße!", usw.`}

${conversationContext}

Denk dran: ${isFirstMessage
            ? "Das ist der erste Kontakt, du kannst eine kurze Begrüßung geben."
            : "⚠️ DAS IST EIN LAUFENDES GESPRÄCH - NICHT GRÜSSEN, geh direkt zum Inhalt. Der Nutzer weiß schon, wer du bist."} Du bist eine weise Astrologin, die ${isFullResponse
            ? "die vollständige Weisheit der Sterne enthüllt"
            : "über die himmlischen Botschaften fasziniert, die sie erkannt hat"}. Sprich wie eine weise Freundin, die wirklich das Geburtsdatum wissen möchte, um die Sternenweisheit zu teilen.`;
    }
    generateHoroscopeDataSection(birthYear, birthDate, fullName) {
        let dataSection = "VERFÜGBARE DATEN FÜR HOROSKOP-BERATUNG:\n";
        if (fullName) {
            dataSection += `- Name: ${fullName}\n`;
        }
        if (birthDate) {
            const zodiacSign = this.calculateWesternZodiacSign(birthDate);
            dataSection += `- Geburtsdatum: ${birthDate}\n`;
            dataSection += `- Berechnetes Sternzeichen: ${zodiacSign}\n`;
        }
        else if (birthYear) {
            dataSection += `- Geburtsjahr: ${birthYear}\n`;
            dataSection +=
                "- ⚠️ FEHLENDE DATEN: Vollständiges Geburtsdatum (ESSENZIELL für die Bestimmung des Sternzeichens)\n";
        }
        if (!birthYear && !birthDate) {
            dataSection +=
                "- ⚠️ FEHLENDE DATEN: Geburtsdatum (ESSENZIELL für die Bestimmung des himmlischen Sternzeichens)\n";
        }
        return dataSection;
    }
    calculateWesternZodiacSign(dateStr) {
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
        }
        catch (_a) {
            return "Fehler bei Berechnung";
        }
    }
    validateHoroscopeRequest(zodiacData, userMessage) {
        if (!zodiacData) {
            const error = new Error("Astrologin-Daten erforderlich");
            error.statusCode = 400;
            error.code = "MISSING_ASTROLOGER_DATA";
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
        console.error("❌ Fehler im HoroscopeController:", error);
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
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("Leere Antwort")) {
            statusCode = 503;
            errorMessage =
                "Der Dienst konnte keine Antwort generieren. Bitte versuch es nochmal.";
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
exports.ChineseZodiacController = ChineseZodiacController;
