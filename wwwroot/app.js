// Views
const lobbyView = document.getElementById('lobby-view');
const chessView = document.getElementById('chess-view');
const backBtn = document.getElementById('back-to-lobby');

// Chess UI
const boardEl = document.getElementById('board');
const cellTpl = document.getElementById('cell-tpl');
const depthInput = document.getElementById('depth');
const depthValue = document.getElementById('depth-value');
const analysisEl = document.getElementById('analysis');
const localBtn = document.getElementById('local-analysis');
const badge = document.getElementById('board-badge');
const movesEl = document.getElementById('moves');
const movesPlaceholder = document.getElementById('moves-placeholder');

// ---- Navigation / Views ----
function renderEmptyBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const node = cellTpl.content.firstElementChild.cloneNode(true);
            node.dataset.r = r; node.dataset.c = c;
            node.classList.toggle('dark', (r + c) % 2 === 1);
            boardEl.appendChild(node);
        }
    }
}

function setView(view) {
    if (view === 'chess') {
        lobbyView.classList.remove('active');
        chessView.classList.add('active');
        renderEmptyBoard();
    } else {
        chessView.classList.remove('active');
        lobbyView.classList.add('active');
    }
}

// Delegation: jeder Klick auf data-game="chess" öffnet Chess (Header-CTA + Card)
document.addEventListener('click', (e) => {
    const trg = e.target.closest('[data-game="chess"]');
    if (trg) { e.preventDefault(); setView('chess'); }
});

backBtn.addEventListener('click', (e) => { e.preventDefault(); setView('lobby'); });

// ---- UI: Depth ----
depthInput.addEventListener('input', () => {
    depthValue.textContent = depthInput.value;
});

// ---- Lokale Analyse ----
async function runLocalAnalysis() {
    const roomId = 'lobby'; // TODO: ersetzen durch aktuelle Room-ID, sobald SignalR aktiv
    const depth = Number(depthInput.value);
    localBtn.disabled = true;
    analysisEl.textContent = 'Analysiere…';
    try {
        const res = await fetch(`/api/local/analyze?roomId=${encodeURIComponent(roomId)}&depth=${depth}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Analyse fehlgeschlagen.');
        const s = data.summary;
        analysisEl.textContent =
            `Vorher: ${s.evaluationBefore}\nNachher: ${s.evaluationAfter}\n` +
            `Swing: ${s.swing} cp\nUrteil: ${s.judgement} (${s.severity})\n` +
            (s.bestSan ? `Bester Zug: ${s.bestSan}\n` : '') +
            (s.pvSan && s.pvSan.length ? `PV: ${s.pvSan.join(' ')}\n` : '');
    } catch (e) {
        analysisEl.textContent = `Fehler: ${e.message}`;
    } finally {
        localBtn.disabled = false;
    }
}
localBtn.addEventListener('click', runLocalAnalysis);

// ---- (Optional) später: SignalR aktivieren ----
// const connection = new signalR.HubConnectionBuilder().withUrl('/chess').build();
// connection.start().then(() => badge.textContent = 'Online').catch(() => badge.textContent = 'Offline');

setView('lobby');

// Fallback: schützt vor unsichtbaren Vollflächen mit pointer-events:none
window.addEventListener('load', () => {
    document.querySelectorAll('*').forEach(el => {
        const pe = getComputedStyle(el).pointerEvents;
        if (pe === 'none' && (el.id === 'app' || el.classList.contains('view'))) {
            el.style.pointerEvents = 'auto';
        }
    });
});
