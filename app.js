// app.js - Học Hán Tự (White Theme, Spaced Repetition, Draw Review & No Timeout)

// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================
const SESSION_SIZE = 50;
const ACTIVE_POOL = 7;
const S_MIN = 6.0;
const S_MAX = 1829.480804;

const REVIEW_TYPES = {
    DEFINITION: "definition",
    DRAW: "draw",
    RT1_CHAR_TO_HANVI_MCQ: "char_to_hanvi_mcq",
    RT2_CHAR_TO_HANVI_TYPING: "char_to_hanvi_typing",
    RT3_CHAR_TO_MEANING_MCQ: "char_to_meaning_mcq",
    RT4_HANVI_TO_CHAR_MCQ: "hanvi_to_char_mcq",
    RT5_MEANING_TO_CHAR_MCQ: "meaning_to_char_mcq"
};

const BOOTSTRAP_SEQUENCE = [
    { mode: "definition", slot: 1 },
    { mode: "definition", slot: 2 },
    { mode: "definition", slot: 3 },
    { mode: "review", slot: 1 },
    { mode: "review", slot: 2 },
    { mode: "review", slot: 3 },
    { mode: "definition", slot: 4 },
    { mode: "review", slot: 1 },
    { mode: "review", slot: 2 },
    { mode: "review", slot: 4 },
    { mode: "review", slot: 3 },
    { mode: "definition", slot: 5 },
    { mode: "review", slot: 1 },
    { mode: "review", slot: 4 },
    { mode: "review", slot: 5 },
    { mode: "review", slot: 2 },
    { mode: "review", slot: 3 },
    { mode: "definition", slot: 6 },
    { mode: "review", slot: 5 },
    { mode: "review", slot: 1 },
    { mode: "review", slot: 6 },
    { mode: "review", slot: 4 },
    { mode: "review", slot: 2 },
    { mode: "definition", slot: 7 },
    { mode: "review", slot: 6 },
    { mode: "review", slot: 3 },
    { mode: "review", slot: 7 },
    { mode: "review", slot: 5 },
    { mode: "review", slot: 1 },
    { mode: "review", slot: 4 }
];

const SETS_CONFIG = {
    set1: { name: "Bộ 1: 0% → 65%", file: "set1_0_65.json", count: 210 },
    set2: { name: "Bộ 2: 65% → 85%", file: "set2_65_85.json", count: 411 },
    set3: { name: "Bộ 3: 85% → 95%", file: "set3_85_95.json", count: 666 },
    set4: { name: "Bộ 4: 95% → 100%", file: "set4_95_100.json", count: 2322 }
};

// ==========================================
// STATE VARIABLES
// ==========================================
let currentSetId = null;
let currentDataSet = [];
let wordStates = [];
let currentMode = "learn"; // 'learn' | 'review'
let activeTab = "session"; // 'session' | 'learned'
let answered = false;
let currentCard = null;
let sessionRuntime = null;

// Drawing canvas state
let isDrawing = false;
let drawCtx = null;
let lastDrawX = 0;
let lastDrawY = 0;

// Audio sound effects for feedback
let correctAudio = null;
let wrongAudio = null;
try {
    correctAudio = new Audio("./audio/true.wav");
    wrongAudio = new Audio("./audio/false.wav");
} catch (e) {
    console.warn("Feedback audio fallback:", e);
}

// ==========================================
// DOM ELEMENTS
// ==========================================
const homeView = document.getElementById("homeView");
const studyView = document.getElementById("studyView");
const backToHomeBtn = document.getElementById("backToHomeBtn");
const currentSetBadge = document.getElementById("currentSetBadge");

const learnModeBtn = document.getElementById("learnModeBtn");
const reviewModeBtn = document.getElementById("reviewModeBtn");
const learnedWordsTabBtn = document.getElementById("learnedWordsTabBtn");

const cardContainer = document.getElementById("cardContainer");
const progressFill = document.getElementById("progressFill");
const learnedProgressFill = document.getElementById("learnedProgressFill");

const wordText = document.getElementById("wordText");
const meaningText = document.getElementById("meaningText");
const promptText = document.getElementById("promptText");

// Single Centered Definition Box
const definitionDetailBox = document.getElementById("definitionDetailBox");
const defCharDisplay = document.getElementById("defCharDisplay");
const defHanviDisplay = document.getElementById("defHanviDisplay");
const defMeaningDisplay = document.getElementById("defMeaningDisplay");
const defVocabWrap = document.getElementById("defVocabWrap");

// Draw Review Mode
const drawWrap = document.getElementById("drawWrap");
const drawCharTop = document.getElementById("drawCharTop");
const drawHanviTop = document.getElementById("drawHanviTop");
const drawCanvas = document.getElementById("drawCanvas");
const drawClearBtn = document.getElementById("drawClearBtn");
const drawNextBtn = document.getElementById("drawNextBtn");

const choicesWrap = document.getElementById("choicesWrap");
const typingWrap = document.getElementById("typingWrap");
const typingInput = document.getElementById("typingInput");
const feedbackText = document.getElementById("feedbackText");
const cardFooterGuide = document.getElementById("cardFooterGuide");

const learnedWordsPanel = document.getElementById("learnedWordsPanel");
const learnedWordsList = document.getElementById("learnedWordsList");
const learnedCountSub = document.getElementById("learnedCountSub");
const learnedSearchInput = document.getElementById("learnedSearchInput");
const resetProgressBtn = document.getElementById("resetProgressBtn");

// ==========================================
// SRS / SPACED REPETITION MATH
// ==========================================
function masteryScoreFromStability(stability) {
    const safeStability = Math.max(S_MIN, Number(stability) || S_MIN);
    const raw = 1 + 99 * Math.log(safeStability / S_MIN) / Math.log(S_MAX / S_MIN);
    return Math.max(1, Math.min(100, raw));
}

function computeUrgency(counter, stability) {
    const safeCounter = Math.max(0, Number(counter) || 0);
    const safeStability = Math.max(S_MIN, Number(stability) || S_MIN);
    return Math.exp(-safeCounter / safeStability) - 0.85;
}

function createRtCounter() {
    return {
        [REVIEW_TYPES.DRAW]: 0,
        [REVIEW_TYPES.RT1_CHAR_TO_HANVI_MCQ]: 0,
        [REVIEW_TYPES.RT2_CHAR_TO_HANVI_TYPING]: 0,
        [REVIEW_TYPES.RT3_CHAR_TO_MEANING_MCQ]: 0,
        [REVIEW_TYPES.RT4_HANVI_TO_CHAR_MCQ]: 0,
        [REVIEW_TYPES.RT5_MEANING_TO_CHAR_MCQ]: 0
    };
}

function createInitialWordState(id) {
    return {
        id,
        bootstrap_slot: null,
        stability: 6,
        counter: 0,
        distance: 1,
        grow_rate: 1.4,
        urgency: computeUrgency(0, 6),
        mastery_score: masteryScoreFromStability(6),
        RTcounter: createRtCounter(),
        draw_count: 0,
        first_def_shown: false,
        total_card_seen: 0,
        total_incorrect: 0,
        recent_queue: [0, 0, 0, 0, 0]
    };
}

function initializeIntroducedWordState(state) {
    return {
        ...state,
        stability: 6,
        counter: 0,
        distance: 1,
        grow_rate: 1.4,
        urgency: computeUrgency(0, 6),
        mastery_score: masteryScoreFromStability(6),
        RTcounter: createRtCounter(),
        draw_count: state.draw_count || 0,
        first_def_shown: state.first_def_shown || false,
        total_card_seen: 1,
        total_incorrect: 0,
        recent_queue: [0, 0, 0, 0, 0]
    };
}

function recalculateWordMetrics(state) {
    state.stability = Math.max(6, Number(state.stability) || 6);
    state.counter = Math.max(0, Number(state.counter) || 0);
    state.urgency = computeUrgency(state.counter, state.stability);
    state.mastery_score = masteryScoreFromStability(state.stability);
    return state;
}

function processReview(state, reviewType, isCorrect) {
    if (!state || !state.RTcounter) {
        return { wordState: state, shouldShowDefinitionImmediately: false };
    }

    if (!Array.isArray(state.recent_queue)) {
        state.recent_queue = [0, 0, 0, 0, 0];
    }

    const safeTotalSeen = Math.max(1, Number(state.total_card_seen) || 1);

    if (isCorrect) {
        state.recent_queue.push(0);
        if (state.grow_rate < 1.4) {
            state.grow_rate = Math.min(1.4, state.grow_rate + 0.07);
        }
        state.distance = Math.max(1, Math.ceil((Number(state.distance) || 1) * (Number(state.grow_rate) || 1.4)));
        state.stability = Math.max(6, state.distance / 0.16252);
        state.counter = 0;
        state.RTcounter[reviewType] = (Number(state.RTcounter[reviewType]) || 0) + 1;
        if (reviewType === REVIEW_TYPES.DRAW) {
            state.draw_count = (state.draw_count || 0) + 1;
        }
    } else {
        state.total_incorrect = (Number(state.total_incorrect) || 0) + 1;
        state.recent_queue.push(1);

        const recentErrors = state.recent_queue.reduce((s, v) => s + (v ? 1 : 0), 0);
        const errorRatio = state.total_incorrect / safeTotalSeen;

        let grow = 1.4;
        if (recentErrors > 3 || errorRatio > 0.3) grow = 1.2;
        else if (recentErrors === 3 || errorRatio > 0.25) grow = 1.25;
        else if (recentErrors === 2 || errorRatio > 0.2) grow = 1.3;
        else if (recentErrors === 1 || errorRatio > 0.15) grow = 1.35;

        state.grow_rate = grow;
        state.distance = Math.max(1, Math.ceil((Number(state.distance) || 1) / 4));
        state.stability = Math.max(6, state.distance / 0.16252);
        state.counter = 0;
    }

    state.recent_queue.shift();
    state.total_card_seen = safeTotalSeen + 1;
    recalculateWordMetrics(state);

    return {
        wordState: state,
        shouldShowDefinitionImmediately: !isCorrect
    };
}

// ==========================================
// STORAGE MANAGEMENT PER SET
// ==========================================
function getStorageKey(setId) {
    return `hanzi_state_${setId}`;
}

function getBootstrapKey(setId) {
    return `hanzi_bootstrap_${setId}`;
}

function loadSetState(setId, totalWords) {
    const raw = localStorage.getItem(getStorageKey(setId));
    if (!raw) {
        const initial = Array.from({ length: totalWords }, (_, i) => createInitialWordState(i));
        saveSetState(setId, initial);
        return initial;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const map = new Map(parsed.map(s => [s.id, s]));
            const merged = [];
            for (let i = 0; i < totalWords; i++) {
                const ext = map.get(i);
                merged.push(ext ? { ...createInitialWordState(i), ...ext, RTcounter: { ...createRtCounter(), ...(ext.RTcounter || {}) } } : createInitialWordState(i));
            }
            return merged;
        }
    } catch (e) {
        console.error("Error loading state:", e);
    }
    const fallback = Array.from({ length: totalWords }, (_, i) => createInitialWordState(i));
    saveSetState(setId, fallback);
    return fallback;
}

function saveSetState(setId, states) {
    localStorage.setItem(getStorageKey(setId), JSON.stringify(states));
}

function clearSetState(setId) {
    localStorage.removeItem(getStorageKey(setId));
    localStorage.removeItem(getBootstrapKey(setId));
}

function loadBootstrapState(setId) {
    const raw = localStorage.getItem(getBootstrapKey(setId));
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function saveBootstrapState(setId, state) {
    localStorage.setItem(getBootstrapKey(setId), JSON.stringify(state));
}

// ==========================================
// HOME VIEW & SETS PROGRESS
// ==========================================
function refreshHomeProgress() {
    for (const [setId, cfg] of Object.entries(SETS_CONFIG)) {
        const raw = localStorage.getItem(getStorageKey(setId));
        let learnedCount = 0;
        let totalMastery = 0;

        if (raw) {
            try {
                const states = JSON.parse(raw);
                if (Array.isArray(states)) {
                    const learned = states.filter(s => (s.total_card_seen || 0) > 0);
                    learnedCount = learned.length;
                    if (learnedCount > 0) {
                        const sum = learned.reduce((acc, s) => acc + (s.mastery_score || 0), 0);
                        totalMastery = Math.round(sum / learnedCount);
                    }
                }
            } catch (e) { }
        }

        const pct = Math.round((learnedCount / cfg.count) * 100);

        const pctEl = document.getElementById(`${setId}-pct`);
        const fillEl = document.getElementById(`${setId}-fill`);
        const learnedEl = document.getElementById(`${setId}-learned`);
        const masteryEl = document.getElementById(`${setId}-mastery`);

        if (pctEl) pctEl.textContent = `${pct}%`;
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (learnedEl) learnedEl.textContent = `${learnedCount} / ${cfg.count} chữ đã học`;
        if (masteryEl) masteryEl.textContent = `${totalMastery}%`;
    }
}

// ==========================================
// SET LOADING & NAVIGATION
// ==========================================
async function openSet(setId) {
    currentSetId = setId;
    const cfg = SETS_CONFIG[setId];
    if (!cfg) return;

    try {
        const resp = await fetch(`./${cfg.file}`, { cache: "no-store" });
        if (!resp.ok) throw new Error(`Could not fetch ${cfg.file}`);
        currentDataSet = await resp.json();
    } catch (e) {
        alert(`Không thể tải dữ liệu ${cfg.file}: ${e.message}`);
        return;
    }

    wordStates = loadSetState(setId, currentDataSet.length);
    currentSetBadge.textContent = cfg.name;

    homeView.classList.add("hidden");
    studyView.classList.remove("hidden");

    switchStudyTab("session");
    startSession(currentMode);
}

function returnToHome() {
    studyView.classList.add("hidden");
    homeView.classList.remove("hidden");
    refreshHomeProgress();
}

// ==========================================
// SESSION BUILDER & WORKFLOW
// ==========================================
function isWordIntroduced(state) {
    return (Number(state?.total_card_seen) || 0) > 0;
}

function selectReviewTypeForWord(wordState, entry) {
    const eligible = [
        REVIEW_TYPES.RT1_CHAR_TO_HANVI_MCQ,
        REVIEW_TYPES.RT2_CHAR_TO_HANVI_TYPING,
        REVIEW_TYPES.RT3_CHAR_TO_MEANING_MCQ,
        REVIEW_TYPES.RT4_HANVI_TO_CHAR_MCQ,
        REVIEW_TYPES.RT5_MEANING_TO_CHAR_MCQ
    ];

    // If word hasn't completed 3 draw reviews, include Draw review in eligible pool
    if ((wordState.draw_count || 0) < 3) {
        eligible.push(REVIEW_TYPES.DRAW);
    }

    const unseen = eligible.filter(t => (wordState.RTcounter?.[t] || 0) === 0);
    const pool = unseen.length > 0 ? unseen : eligible;
    return pool[Math.floor(Math.random() * pool.length)];
}

function createSessionRuntime(mode) {
    const bootstrapData = loadBootstrapState(currentSetId) || {
        slots: Array(ACTIVE_POOL).fill(null),
        stepIndex: 0
    };

    return {
        mode,
        bootstrapSlots: bootstrapData.slots,
        bootstrapStepIndex: bootstrapData.stepIndex,
        queue: [],
        recentWordHistory: [],
        completedInSession: 0
    };
}

function persistBootstrapRuntime() {
    if (!sessionRuntime) return;
    saveBootstrapState(currentSetId, {
        slots: sessionRuntime.bootstrapSlots,
        stepIndex: sessionRuntime.bootstrapStepIndex
    });
}

function recordWordInHistory(wordId) {
    if (!sessionRuntime) return;
    if (!Array.isArray(sessionRuntime.recentWordHistory)) {
        sessionRuntime.recentWordHistory = [];
    }
    sessionRuntime.recentWordHistory.push(wordId);
    while (sessionRuntime.recentWordHistory.length > 2) {
        sessionRuntime.recentWordHistory.shift();
    }
}

function getNextCard() {
    if (!sessionRuntime) return null;
    if (!Array.isArray(sessionRuntime.recentWordHistory)) {
        sessionRuntime.recentWordHistory = [];
    }

    const introduced = wordStates.filter(s => isWordIntroduced(s));
    const unintroduced = wordStates.filter(s => !isWordIntroduced(s));
    const totalWordsCount = introduced.length + unintroduced.length;

    // 1. Check recovery queue or immediate first-draw queue
    if (sessionRuntime.queue.length > 0) {
        let queueIndex = -1;
        for (let i = 0; i < sessionRuntime.queue.length; i++) {
            const item = sessionRuntime.queue[i];
            // First draw right after first definition is allowed directly
            if (item.isFirstDraw || !sessionRuntime.recentWordHistory.includes(item.wordId) || totalWordsCount < 3) {
                queueIndex = i;
                break;
            }
        }
        if (queueIndex !== -1) {
            const card = sessionRuntime.queue.splice(queueIndex, 1)[0];
            recordWordInHistory(card.wordId);
            return card;
        }
    }

    // 2. Learn Mode: Ensure bootstrap slots are filled
    if (sessionRuntime.mode === "learn") {
        for (let i = 0; i < ACTIVE_POOL; i++) {
            if (sessionRuntime.bootstrapSlots[i] === null && unintroduced.length > 0) {
                const pick = unintroduced.shift();
                sessionRuntime.bootstrapSlots[i] = pick.id;
                wordStates[pick.id] = initializeIntroducedWordState(wordStates[pick.id]);
                wordStates[pick.id].bootstrap_slot = i + 1;
                saveSetState(currentSetId, wordStates);
            }
        }

        // Advance through bootstrap sequence if candidate word is valid
        if (sessionRuntime.bootstrapStepIndex < BOOTSTRAP_SEQUENCE.length) {
            const step = BOOTSTRAP_SEQUENCE[sessionRuntime.bootstrapStepIndex];
            const wordId = sessionRuntime.bootstrapSlots[step.slot - 1];

            if (wordId !== null && wordId !== undefined) {
                const canUse = !sessionRuntime.recentWordHistory.includes(wordId) || totalWordsCount < 3;
                if (canUse) {
                    sessionRuntime.bootstrapStepIndex++;
                    persistBootstrapRuntime();
                    recordWordInHistory(wordId);
                    if (step.mode === "definition") {
                        return { wordId, cardType: REVIEW_TYPES.DEFINITION };
                    } else {
                        return {
                            wordId,
                            cardType: selectReviewTypeForWord(wordStates[wordId], currentDataSet[wordId])
                        };
                    }
                }
            }
        }

        // If unintroduced words exist, occasionally introduce a new word
        if (unintroduced.length > 0 && Math.random() < 0.35) {
            const pick = unintroduced[0];
            wordStates[pick.id] = initializeIntroducedWordState(wordStates[pick.id]);
            saveSetState(currentSetId, wordStates);
            recordWordInHistory(pick.id);
            return { wordId: pick.id, cardType: REVIEW_TYPES.DEFINITION };
        }
    }

    // 3. Review Mode or Standard SRS Candidate Selection
    const refreshedIntroduced = wordStates.filter(s => isWordIntroduced(s));
    if (refreshedIntroduced.length === 0) {
        if (unintroduced.length > 0) {
            const pick = unintroduced[0];
            wordStates[pick.id] = initializeIntroducedWordState(wordStates[pick.id]);
            saveSetState(currentSetId, wordStates);
            recordWordInHistory(pick.id);
            return { wordId: pick.id, cardType: REVIEW_TYPES.DEFINITION };
        }
        return null;
    }

    // Filter candidates strictly excluding the last 2 words
    let validCandidates = refreshedIntroduced.filter(s => !sessionRuntime.recentWordHistory.includes(s.id));

    if (validCandidates.length === 0) {
        if (sessionRuntime.mode === "learn" && unintroduced.length > 0) {
            const pick = unintroduced[0];
            wordStates[pick.id] = initializeIntroducedWordState(wordStates[pick.id]);
            saveSetState(currentSetId, wordStates);
            recordWordInHistory(pick.id);
            return { wordId: pick.id, cardType: REVIEW_TYPES.DEFINITION };
        }

        if (sessionRuntime.recentWordHistory.length > 0) {
            const lastWordId = sessionRuntime.recentWordHistory[sessionRuntime.recentWordHistory.length - 1];
            validCandidates = refreshedIntroduced.filter(s => s.id !== lastWordId);
        }
        if (validCandidates.length === 0) {
            validCandidates = refreshedIntroduced;
        }
    }

    let maxUrgency = -Infinity;
    validCandidates.forEach(s => {
        maxUrgency = Math.max(maxUrgency, Number(s.urgency) || 0);
    });
    const bestCandidates = validCandidates.filter(s => (Number(s.urgency) || 0) >= maxUrgency - 0.08);
    const selected = bestCandidates[Math.floor(Math.random() * bestCandidates.length)];

    recordWordInHistory(selected.id);
    return {
        wordId: selected.id,
        cardType: selectReviewTypeForWord(selected, currentDataSet[selected.id])
    };
}

function startSession(mode = "learn") {
    currentMode = mode;
    learnModeBtn.classList.toggle("active", mode === "learn");
    reviewModeBtn.classList.toggle("active", mode === "review");

    sessionRuntime = createSessionRuntime(mode);
    advanceToNextCard();
}

function advanceToNextCard() {
    answered = false;
    feedbackText.textContent = "";
    feedbackText.className = "";

    const card = getNextCard();
    if (!card) {
        renderEmptyState();
        return;
    }

    currentCard = card;
    sessionRuntime.completedInSession = (sessionRuntime.completedInSession + 1) % SESSION_SIZE;
    const pct = Math.min(100, Math.round(((sessionRuntime.completedInSession || 1) / SESSION_SIZE) * 100));
    progressFill.style.width = `${pct}%`;

    renderCard(card);
}

function renderEmptyState() {
    wordText.classList.add("hidden");
    meaningText.classList.add("hidden");
    definitionDetailBox.classList.add("hidden");
    drawWrap.classList.add("hidden");
    choicesWrap.classList.add("hidden");
    typingWrap.classList.add("hidden");
    promptText.textContent = "Bạn đã hoàn thành tất cả chữ trong bộ này!";
    cardFooterGuide.classList.add("hidden");
}

// ==========================================
// CARD RENDERING
// ==========================================
function renderCard(card) {
    const entry = currentDataSet[card.wordId];
    if (!entry) return;

    // Reset visibility
    wordText.classList.add("hidden");
    meaningText.classList.add("hidden");
    definitionDetailBox.classList.add("hidden");
    drawWrap.classList.add("hidden");
    choicesWrap.classList.add("hidden");
    typingWrap.classList.add("hidden");
    choicesWrap.innerHTML = "";
    typingInput.value = "";
    typingInput.className = "";
    promptText.classList.remove("hidden");
    cardFooterGuide.classList.remove("hidden");

    switch (card.cardType) {
        case REVIEW_TYPES.DEFINITION:
            renderDefinitionCard(entry, card);
            break;
        case REVIEW_TYPES.DRAW:
            renderDrawCard(entry, card);
            break;
        case REVIEW_TYPES.RT1_CHAR_TO_HANVI_MCQ:
            renderCharToHanviMcq(entry, card);
            break;
        case REVIEW_TYPES.RT2_CHAR_TO_HANVI_TYPING:
            renderCharToHanviTyping(entry, card);
            break;
        case REVIEW_TYPES.RT3_CHAR_TO_MEANING_MCQ:
            renderCharToMeaningMcq(entry, card);
            break;
        case REVIEW_TYPES.RT4_HANVI_TO_CHAR_MCQ:
            renderHanviToCharMcq(entry, card);
            break;
        case REVIEW_TYPES.RT5_MEANING_TO_CHAR_MCQ:
            renderMeaningToCharMcq(entry, card);
            break;
        default:
            renderDefinitionCard(entry, card);
    }
}

// ----------------------------------------------------
// 0. DEFINITION CARD (Centered, one container, no button)
// ----------------------------------------------------
function renderDefinitionCard(entry, card) {
    promptText.textContent = "";

    // 1. Big character
    defCharDisplay.textContent = entry.char;

    // 2. Hanvi below character (No "Hán Việt" prefix)
    defHanviDisplay.textContent = entry.hanvi || "";

    // 3. Meaning (smaller and lighter)
    const meaningsText = (entry.meaning || []).join(", ");
    defMeaningDisplay.textContent = meaningsText || "";

    // 4. Compact vocabulary chips
    defVocabWrap.innerHTML = "";
    if (entry.vocabulary && entry.vocabulary.length > 0) {
        defVocabWrap.classList.remove("hidden");
        entry.vocabulary.slice(0, 4).forEach(v => {
            const chip = document.createElement("span");
            chip.className = "def-vocab-chip";
            chip.innerHTML = `
                <span class="chip-word">${v.word}</span>
                <span class="chip-hanvi">(${v.hanvi})</span>
            `;
            defVocabWrap.appendChild(chip);
        });
    } else {
        defVocabWrap.classList.add("hidden");
    }

    definitionDetailBox.classList.remove("hidden");
    cardFooterGuide.textContent = "Vuốt (mobile) hoặc nhấn Enter (máy tính) để tiếp tục";

    // If this is the very first definition of this word, schedule the first Draw card right after!
    const st = wordStates[card.wordId];
    if (st && !st.first_def_shown) {
        st.first_def_shown = true;
        st.draw_count = 1;
        saveSetState(currentSetId, wordStates);
        // Queue first draw card right after this definition
        sessionRuntime.queue.unshift({
            wordId: card.wordId,
            cardType: REVIEW_TYPES.DRAW,
            isFirstDraw: true
        });
    }
}

// ----------------------------------------------------
// DRAW REVIEW CARD (Canvas)
// ----------------------------------------------------
function renderDrawCard(entry, card) {
    promptText.textContent = "";
    promptText.classList.add("hidden");
    drawCharTop.textContent = entry.char;
    drawHanviTop.textContent = entry.hanvi || "";

    drawWrap.classList.remove("hidden");
    cardFooterGuide.classList.add("hidden");

    // Setup canvas after layout reflow
    setTimeout(() => {
        setupCanvas();
    }, 50);

    drawClearBtn.onclick = () => {
        clearCanvas();
    };

    drawNextBtn.onclick = () => {
        processReview(wordStates[card.wordId], REVIEW_TYPES.DRAW, true);
        saveSetState(currentSetId, wordStates);
        advanceToNextCard();
    };
}

function setupCanvas() {
    if (!drawCanvas) return;
    const box = drawCanvas.parentElement;
    const rect = box.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    drawCanvas.width = rect.width * dpr;
    drawCanvas.height = rect.height * dpr;
    drawCanvas.style.width = `${rect.width}px`;
    drawCanvas.style.height = `${rect.height}px`;

    drawCtx = drawCanvas.getContext("2d");
    drawCtx.scale(dpr, dpr);
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    drawCtx.lineWidth = 7;
    drawCtx.strokeStyle = "#0f172a";

    // Draw background guide grid (rice grid / 米字格)
    drawGridGuide(rect.width, rect.height);
}

function drawGridGuide(w, h) {
    if (!drawCtx) return;
    drawCtx.save();
    drawCtx.strokeStyle = "#e2e8f0";
    drawCtx.lineWidth = 1;
    drawCtx.setLineDash([4, 4]);

    // Cross lines
    drawCtx.beginPath();
    drawCtx.moveTo(w / 2, 0);
    drawCtx.lineTo(w / 2, h);
    drawCtx.moveTo(0, h / 2);
    drawCtx.lineTo(w, h / 2);
    drawCtx.stroke();

    drawCtx.restore();
}

function clearCanvas() {
    if (!drawCanvas || !drawCtx) return;
    const box = drawCanvas.parentElement;
    const rect = box.getBoundingClientRect();
    drawCtx.clearRect(0, 0, rect.width, rect.height);
    drawGridGuide(rect.width, rect.height);
}

// ----------------------------------------------------
// 1. Character -> Hán Việt (Choice)
// ----------------------------------------------------
function renderCharToHanviMcq(entry, card) {
    promptText.textContent = "Chọn âm Hán Việt:";
    wordText.textContent = entry.char;
    wordText.classList.remove("hidden");

    const correct = entry.hanvi;
    const distractors = getRandomDistractors(card.wordId, e => e.hanvi, 3);
    const options = shuffleArray([correct, ...distractors]);

    renderChoices(options, correct, card, REVIEW_TYPES.RT1_CHAR_TO_HANVI_MCQ);
}

// ----------------------------------------------------
// 2. Character -> Hán Việt (Typing)
// ----------------------------------------------------
function renderCharToHanviTyping(entry, card) {
    promptText.textContent = "Gõ âm Hán Việt:";
    wordText.textContent = entry.char;
    wordText.classList.remove("hidden");

    typingWrap.classList.remove("hidden");
    typingInput.disabled = false;
    typingInput.value = "";
    typingInput.className = "";
    typingInput.focus();

    const submit = () => {
        if (answered) return;
        const typed = typingInput.value.trim();
        if (!typed) return;

        answered = true;
        typingInput.disabled = true;

        const normalizedTyped = normalizeVietnamese(typed);
        const normalizedCorrect = normalizeVietnamese(entry.hanvi);
        const isCorrect = normalizedTyped === normalizedCorrect;

        if (isCorrect) {
            typingInput.classList.add("state-correct");
        } else {
            typingInput.classList.add("state-wrong");
        }

        handleAnswer(isCorrect, card, REVIEW_TYPES.RT2_CHAR_TO_HANVI_TYPING, entry.hanvi);
    };

    typingInput.onkeydown = (e) => {
        if (e.key === "Enter") submit();
    };
}

// ----------------------------------------------------
// 3. Character -> Meaning (Choice)
// ----------------------------------------------------
function renderCharToMeaningMcq(entry, card) {
    promptText.textContent = "Chọn nghĩa:";
    wordText.textContent = entry.char;
    wordText.classList.remove("hidden");

    const correct = (entry.meaning || []).join(", ") || entry.hanvi;
    const distractors = getRandomDistractors(card.wordId, e => (e.meaning || []).join(", ") || e.hanvi, 3);
    const options = shuffleArray([correct, ...distractors]);

    renderChoices(options, correct, card, REVIEW_TYPES.RT3_CHAR_TO_MEANING_MCQ);
}

// ----------------------------------------------------
// 4. Hán Việt -> Character (Choice)
// ----------------------------------------------------
function renderHanviToCharMcq(entry, card) {
    promptText.textContent = "Chọn chữ Hán:";
    meaningText.textContent = entry.hanvi;
    meaningText.classList.remove("hidden");

    const correct = entry.char;
    const distractors = getRandomDistractors(card.wordId, e => e.char, 3);
    const options = shuffleArray([correct, ...distractors]);

    renderChoices(options, correct, card, REVIEW_TYPES.RT4_HANVI_TO_CHAR_MCQ, true);
}

// ----------------------------------------------------
// 5. Meaning -> Character (Choice)
// ----------------------------------------------------
function renderMeaningToCharMcq(entry, card) {
    promptText.textContent = "Chọn chữ Hán có nghĩa:";
    meaningText.textContent = (entry.meaning || []).join(", ") || entry.hanvi;
    meaningText.classList.remove("hidden");

    const correct = entry.char;
    const distractors = getRandomDistractors(card.wordId, e => e.char, 3);
    const options = shuffleArray([correct, ...distractors]);

    renderChoices(options, correct, card, REVIEW_TYPES.RT5_MEANING_TO_CHAR_MCQ, true);
}

// ----------------------------------------------------
// Helper: Render Multiple Choices (No 1,2,3,4 labels)
// ----------------------------------------------------
function renderChoices(options, correctValue, card, reviewType, isHanziChar = false) {
    choicesWrap.classList.remove("hidden");
    choicesWrap.innerHTML = "";

    options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = `choice-btn ${isHanziChar ? "choice-hanzi-char" : ""}`;
        btn.type = "button";
        btn.innerHTML = `<span>${opt}</span>`;

        btn.onclick = () => {
            if (answered) return;
            answered = true;

            const isCorrect = opt === correctValue;
            if (isCorrect) {
                btn.classList.add("correct");
            } else {
                btn.classList.add("incorrect");
                const allButtons = choicesWrap.querySelectorAll(".choice-btn");
                allButtons.forEach(b => {
                    if (b.textContent.includes(correctValue)) {
                        b.classList.add("correct");
                    }
                });
            }

            handleAnswer(isCorrect, card, reviewType, correctValue);
        };

        choicesWrap.appendChild(btn);
    });
}

// ==========================================
// ANSWER HANDLING (NO AUTO TIMEOUT)
// ==========================================
function handleAnswer(isCorrect, card, reviewType, answerExplanation) {
    if (isCorrect) {
        if (correctAudio) correctAudio.play().catch(() => {});
        feedbackText.textContent = "Chính xác! ✓ (Vuốt hoặc Enter để tiếp tục)";
        feedbackText.className = "correct";
    } else {
        if (wrongAudio) wrongAudio.play().catch(() => {});
        feedbackText.textContent = `Chưa đúng! Đáp án: ${answerExplanation} (Vuốt hoặc Enter để tiếp tục)`;
        feedbackText.className = "incorrect";
    }

    const res = processReview(wordStates[card.wordId], reviewType, isCorrect);
    wordStates[card.wordId] = res.wordState;
    saveSetState(currentSetId, wordStates);

    if (res.shouldShowDefinitionImmediately) {
        // Queue recovery definition card (will appear once 2 intervening cards pass)
        sessionRuntime.queue.push({
            wordId: card.wordId,
            cardType: REVIEW_TYPES.DEFINITION
        });
    }

    // NO automatic timeout! User can stay on feedback and swipe or press Enter whenever ready.
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function normalizeVietnamese(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .trim();
}

function shuffleArray(arr) {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
}

function getRandomDistractors(excludeId, extractor, count = 3) {
    const results = [];
    const pool = currentDataSet.filter((_, idx) => idx !== excludeId);
    const shuffled = shuffleArray(pool);

    for (const item of shuffled) {
        const val = extractor(item);
        if (val && !results.includes(val)) {
            results.push(val);
            if (results.length >= count) break;
        }
    }
    return results;
}

// ==========================================
// LEARNED WORDS PANEL
// ==========================================
function switchStudyTab(tab) {
    activeTab = tab;
    if (tab === "session") {
        cardContainer.classList.remove("hidden");
        learnedWordsPanel.classList.add("hidden");
        learnedWordsTabBtn.classList.remove("active");
        if (currentMode === "learn") learnModeBtn.classList.add("active");
        else reviewModeBtn.classList.add("active");
    } else {
        cardContainer.classList.add("hidden");
        learnedWordsPanel.classList.remove("hidden");
        learnModeBtn.classList.remove("active");
        reviewModeBtn.classList.remove("active");
        learnedWordsTabBtn.classList.add("active");
        renderLearnedWordsList();
    }
}

function renderLearnedWordsList() {
    const introduced = wordStates.filter(s => isWordIntroduced(s));
    learnedCountSub.textContent = `Đã học ${introduced.length} / ${currentDataSet.length} chữ`;

    const progressPct = Math.round((introduced.length / currentDataSet.length) * 100);
    learnedProgressFill.style.width = `${progressPct}%`;

    const query = normalizeVietnamese(learnedSearchInput.value);
    learnedWordsList.innerHTML = "";

    const filtered = introduced.filter(s => {
        const entry = currentDataSet[s.id];
        if (!entry) return false;
        if (!query) return true;
        return (
            entry.char.includes(query) ||
            normalizeVietnamese(entry.hanvi).includes(query) ||
            (entry.meaning || []).some(m => normalizeVietnamese(m).includes(query))
        );
    });

    if (filtered.length === 0) {
        learnedWordsList.innerHTML = `<p style="color: #64748b; grid-column: 1/-1; text-align: center; padding: 30px;">Không tìm thấy chữ nào.</p>`;
        return;
    }

    filtered.forEach(s => {
        const entry = currentDataSet[s.id];
        const card = document.createElement("div");
        card.className = "learned-item-card";
        card.innerHTML = `
            <div class="learned-card-top">
                <span class="learned-char">${entry.char}</span>
                <span class="learned-hanvi">${entry.hanvi}</span>
            </div>
            <div class="learned-meanings">${(entry.meaning || []).join(", ") || "-"}</div>
            <div class="mastery-meter-bar" title="Độ thông thạo: ${Math.round(s.mastery_score || 0)}%">
                <div class="mastery-meter-fill" style="width: ${Math.round(s.mastery_score || 0)}%"></div>
            </div>
        `;
        learnedWordsList.appendChild(card);
    });
}

// ==========================================
// SWIPE GESTURE HANDLER
// ==========================================
function handleSwipeAction() {
    // 1. If definition card is active
    if (!definitionDetailBox.classList.contains("hidden")) {
        advanceToNextCard();
        return;
    }

    // 2. If draw review is active
    if (!drawWrap.classList.contains("hidden")) {
        if (currentCard && currentCard.cardType === REVIEW_TYPES.DRAW) {
            processReview(wordStates[currentCard.wordId], REVIEW_TYPES.DRAW, true);
            saveSetState(currentSetId, wordStates);
        }
        advanceToNextCard();
        return;
    }

    // 3. If typing card is active
    if (!typingWrap.classList.contains("hidden")) {
        if (answered) {
            advanceToNextCard();
        } else {
            const typed = typingInput.value.trim();
            if (typed) {
                const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
                typingInput.dispatchEvent(enterEvent);
            }
        }
        return;
    }

    // 4. If MCQ card is answered, advance immediately
    if (answered) {
        advanceToNextCard();
    }
}

// ==========================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================
function wireEvents() {
    // Set cards click
    document.querySelectorAll(".set-card").forEach(card => {
        card.onclick = () => {
            const setId = card.getAttribute("data-set-id");
            openSet(setId);
        };
    });

    // Back to home
    backToHomeBtn.onclick = returnToHome;

    // Study Header Tabs
    learnModeBtn.onclick = () => {
        switchStudyTab("session");
        startSession("learn");
    };

    reviewModeBtn.onclick = () => {
        switchStudyTab("session");
        startSession("review");
    };

    learnedWordsTabBtn.onclick = () => {
        switchStudyTab("learned");
    };

    // Learned search
    learnedSearchInput.oninput = renderLearnedWordsList;

    // Reset Progress
    resetProgressBtn.onclick = () => {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ tiến độ của bộ chữ này không?")) {
            clearSetState(currentSetId);
            wordStates = loadSetState(currentSetId, currentDataSet.length);
            renderLearnedWordsList();
            refreshHomeProgress();
            alert("Đã đặt lại tiến độ!");
        }
    };

    // Canvas Drawing Listeners
    if (drawCanvas) {
        const getCanvasPos = (clientX, clientY) => {
            const rect = drawCanvas.getBoundingClientRect();
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        // Mouse drawing
        drawCanvas.addEventListener("mousedown", (e) => {
            isDrawing = true;
            const pos = getCanvasPos(e.clientX, e.clientY);
            lastDrawX = pos.x;
            lastDrawY = pos.y;
            drawCtx.beginPath();
            drawCtx.arc(pos.x, pos.y, drawCtx.lineWidth / 2, 0, Math.PI * 2);
            drawCtx.fill();
        });

        drawCanvas.addEventListener("mousemove", (e) => {
            if (!isDrawing) return;
            const pos = getCanvasPos(e.clientX, e.clientY);
            drawCtx.beginPath();
            drawCtx.moveTo(lastDrawX, lastDrawY);
            drawCtx.lineTo(pos.x, pos.y);
            drawCtx.stroke();
            lastDrawX = pos.x;
            lastDrawY = pos.y;
        });

        window.addEventListener("mouseup", () => {
            isDrawing = false;
        });

        // Touch drawing (with preventDefault on canvas to avoid scrolling while drawing)
        drawCanvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            isDrawing = true;
            const touch = e.touches[0];
            const pos = getCanvasPos(touch.clientX, touch.clientY);
            lastDrawX = pos.x;
            lastDrawY = pos.y;
            drawCtx.beginPath();
            drawCtx.arc(pos.x, pos.y, drawCtx.lineWidth / 2, 0, Math.PI * 2);
            drawCtx.fill();
        }, { passive: false });

        drawCanvas.addEventListener("touchmove", (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            const touch = e.touches[0];
            const pos = getCanvasPos(touch.clientX, touch.clientY);
            drawCtx.beginPath();
            drawCtx.moveTo(lastDrawX, lastDrawY);
            drawCtx.lineTo(pos.x, pos.y);
            drawCtx.stroke();
            lastDrawX = pos.x;
            lastDrawY = pos.y;
        }, { passive: false });

        drawCanvas.addEventListener("touchend", () => {
            isDrawing = false;
        });
    }

    // Touch Swipe Detection on screen (outside active canvas drawing)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    document.addEventListener("touchstart", (e) => {
        if (studyView.classList.contains("hidden") || activeTab !== "session") return;
        if (e.target === drawCanvas) return; // Do not trigger swipe while drawing on canvas
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
        if (studyView.classList.contains("hidden") || activeTab !== "session") return;
        if (e.target === drawCanvas) return;
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const elapsed = Date.now() - touchStartTime;

        if (elapsed < 650 && (Math.abs(deltaX) > 35 || Math.abs(deltaY) > 35)) {
            handleSwipeAction();
        }
    }, { passive: true });

    // Global Keyboard Shortcuts (Enter / Space)
    document.addEventListener("keydown", (e) => {
        if (studyView.classList.contains("hidden") || activeTab !== "session") return;

        // Enter or Space key navigation
        if (e.key === "Enter" || e.key === " ") {
            if (!definitionDetailBox.classList.contains("hidden")) {
                e.preventDefault();
                advanceToNextCard();
                return;
            }

            if (!drawWrap.classList.contains("hidden")) {
                e.preventDefault();
                if (currentCard && currentCard.cardType === REVIEW_TYPES.DRAW) {
                    processReview(wordStates[currentCard.wordId], REVIEW_TYPES.DRAW, true);
                    saveSetState(currentSetId, wordStates);
                }
                advanceToNextCard();
                return;
            }

            if (answered) {
                e.preventDefault();
                advanceToNextCard();
                return;
            }
        }
    });
}

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    refreshHomeProgress();
    wireEvents();
});
