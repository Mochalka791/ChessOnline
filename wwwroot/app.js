// ---- DOM refs ----
const lobbyView = document.getElementById('lobby-view');
const chessView = document.getElementById('chess-view');
const boardEl = document.getElementById('board');
const cellTpl = document.getElementById('cell-tpl');
const boardBadge = document.getElementById('board-badge');

const playersEl = document.getElementById('players');
const movesEl = document.getElementById('moves');
const movesPlaceholder = document.getElementById('moves-placeholder');
const analysisEl = document.getElementById('analysis');

const localAnalysisBtn = document.getElementById('local-analysis');
const depthInput = document.getElementById('depth');
const depthValue = document.getElementById('depth-value');
const eloInput = document.getElementById('elo');

const statusBanner = document.getElementById('status-banner');
const toastContainer = document.getElementById('toast-container');
const loadingOverlay = document.getElementById('loading-overlay');
const themeToggle = document.getElementById('theme-toggle');

// ---- State ----
let boardCells = [];
let boardMatrix = Array.from({ length: 8 }, () => Array(8).fill('.'));
let selected = null;
let legalMoves = [];
let history = [];
let roomId = null;
let mySeat = 'spectator';
let lastJoinRequest = null;
let analysisController = null;

const DEFAULT_SETTINGS = { depth: 14, elo: 1000, theme: 'light' };
let settings = (() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('arcade.settings.v1') || '{}') }; }
    catch { return { ...DEFAULT_SETTINGS }; }
})();
persistSettings();
document.body.dataset.theme = settings.theme;
themeToggle.textContent = settings.theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme';
eloInput.value = settings.elo;
depthInput.value = settings.depth;
depthValue.textContent = settings.depth;

// ---- SignalR ----
const hasSignalR = typeof window.signalR !== 'undefined';
const conn = hasSignalR
    ? new signalR.HubConnectionBuilder().withUrl('/chess').withAutomaticReconnect().build()
    : null;

// ---- Helpers ----
function persistSettings() { localStorage.setItem('arcade.settings.v1', JSON.stringify(settings)); }
function setView(name) {
    if (!lobbyView || !chessView) return;
    if (name === 'chess') { lobbyView.classList.add('hidden'); chessView.classList.remove('hidden'); }
    else { chessView.classList.add('hidden'); lobbyView.classList.remove('hidden'); }
}
function setStatusBanner(cls, text) {
    statusBanner.className = `status ${cls}`; statusBanner.textContent = text;
}
function showLoading(on) { loadingOverlay.hidden = !on; }
function showToast(msg, type = 'info', ttl = 4000) {
    const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
    toastContainer.appendChild(t); setTimeout(() => t.remove(), ttl);
}
function pieceSrc(code) { return (!code || code === '.') ? null : `/pieces/${code}.svg`; }
function describePiece(code) {
    if (!code || code === '.') return '';
    const [c, t] = code.split('_'); const cn = c === 'w' ? 'Weißer' : 'Schwarzer';
    const map = { pawn: 'Bauer', knight: 'Springer', bishop: 'Läufer', rook: 'Turm', queen: 'Dame', king: 'König' };
    return `${cn} ${map[t] ?? t}`;
}
function sqToIdx(x, y) { return y * 8 + x; }

// ---- Board init ----
function ensureBoard() {
    if (boardCells.length) return;
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const cell = cellTpl.content.firstElementChild.cloneNode(true);
            const img = cell.querySelector('.piece');
            cell.dataset.x = x; cell.dataset.y = y;
            cell.addEventListener('click', () => onCellClick(x, y));
            cell.addEventListener('dragover', e => onCellDragOver(e, x, y));
            cell.addEventListener('drop', e => onCellDrop(e, x, y));
            boardEl.appendChild(cell); boardCells.push(cell);

            img.addEventListener('dragstart', e => onDragStart(e, x, y));
            img.addEventListener('dragend', onDragEnd);
        }
    }
}
let dragSource = null, dragHoverIndex = null, dragPieceEl = null;
function onDragStart(evt, x, y) {
    if (!boardMatrix[x][y] || boardMatrix[x][y] === '.') return evt.preventDefault();
    dragSource = { x, y };
    dragPieceEl = evt.target; dragPieceEl.classList.add('dragging');
    const cell = boardCells[sqToIdx(x, y)]; cell.classList.add('dragging');
    evt.dataTransfer.effectAllowed = 'move';
}
function onDragEnd() {
    if (dragPieceEl) dragPieceEl.classList.remove('dragging');
    const idx = dragSource ? sqToIdx(dragSource.x, dragSource.y) : null;
    if (idx != null) boardCells[idx].classList.remove('dragging');
    dragSource = null; dragHoverIndex = null;
}
function onCellDragOver(evt, x, y) {
    if (!dragSource) return;
    evt.preventDefault();
    const idx = sqToIdx(x, y);
    if (dragHoverIndex !== idx) {
        if (dragHoverIndex != null) boardCells[dragHoverIndex].classList.remove('drag-over', 'capture');
        dragHoverIndex = idx;
    }
    const mv = legalMoves.find(m => m.tx === x && m.ty === y);
    const cell = boardCells[idx];
    if (mv) { cell.classList.add('drag-over'); cell.classList.toggle('capture', !!mv.capture); evt.dataTransfer.dropEffect = 'move'; }
    else { cell.classList.remove('drag-over', 'capture'); evt.dataTransfer.dropEffect = 'none'; }
}
function onCellDrop(evt, x, y) {
    if (!dragSource) return;
    evt.preventDefault();
    tryMove(dragSource.x, dragSource.y, x, y);
}

// ---- Selection & moves ----
function clearSelection() { selected = null; legalMoves = []; boardCells.forEach(c => c.classList.remove('selected', 'drag-over', 'capture')); renderMoveHints(); }
function onCellClick(x, y) {
    if (!roomId) return showToast('Bitte einem Raum beitreten.', 'info');
    if (selected && (x !== selected.x || y !== selected.y)) return tryMove(selected.x, selected.y, x, y);
    selected = { x, y }; requestLegalMoves(x, y);
    const idx = sqToIdx(x, y); boardCells[idx].classList.add('selected');
}
function renderMoveHints() {
    boardCells.forEach(c => c.classList.remove('drag-over', 'capture'));
    for (const mv of legalMoves) {
        const idx = sqToIdx(mv.tx, mv.ty);
        const cell = boardCells[idx]; if (!cell) continue;
        cell.classList.add('drag-over'); if (mv.capture) cell.classList.add('capture');
    }
}
async function requestLegalMoves(x, y) {
    try {
        legalMoves = await conn.invoke('GetLegalMoves', roomId, x, y);
        legalMoves = Array.isArray(legalMoves) ? legalMoves : [];
    } catch { legalMoves = []; }
    renderMoveHints();
}
async function tryMove(fx, fy, tx, ty) {
    clearSelection();
    const res = await conn.invoke('MakeMove', roomId, fx, fy, tx, ty, null).catch(() => null);
    if (!res) showToast('Zug fehlgeschlagen.', 'error');
}

// ---- Rendering ----
function renderBoard(matrix, lastMove, inCheck) {
    ensureBoard();
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const idx = sqToIdx(x, y);
            const cell = boardCells[idx];
            const img = cell.querySelector('.piece');
            const code = matrix[x]?.[y] ?? '.';
            const src = pieceSrc(code);
            if (src) {
                img.src = src; img.style.display = 'block'; img.dataset.piece = code; img.alt = describePiece(code); img.draggable = true;
            } else {
                img.removeAttribute('src'); img.style.display = 'none'; img.dataset.piece = ''; img.alt = ''; img.draggable = false;
            }
            cell.classList.toggle('last-from', !!lastMove && lastMove.fx === x && lastMove.fy === y);
            cell.classList.toggle('last-to', !!lastMove && lastMove.tx === x && lastMove.ty === y);
            const wK = inCheck?.wKing, bK = inCheck?.bKing;
            const wIn = inCheck?.white && wK?.x === x && wK?.y === y;
            const bIn = inCheck?.black && bK?.x === x && bK?.y === y;
            cell.classList.toggle('check', !!(wIn || bIn));
        }
    }
    boardMatrix = matrix;
}
function renderHistory(list) {
    history = Array.isArray(list) ? list : [];
    movesEl.innerHTML = ''; const entries = history.filter(h => h.ply > 0);
    movesPlaceholder.hidden = entries.length > 0;
    for (const item of entries) {
        const li = document.createElement('li');
        const prefix = item.side === 'white' ? `${item.moveNumber}.` : `${item.moveNumber}...`;
        li.textContent = `${prefix} ${item.san}`;
        movesEl.appendChild(li);
    }
}
function renderPlayers(players) {
    playersEl.textContent = `Weiß: ${players.white} • Schwarz: ${players.black}`;
}
function renderState(st) {
    const { board, lastMove, check } = st;
    renderBoard(board, lastMove, check);
    if (boardBadge) boardBadge.hidden = true;
}

// ---- Analysis ----
function resetAnalysis() {
    if (!analysisEl) return;
    analysisEl.innerHTML = '<div class="analysis-placeholder muted">Drücke „Lokale Analyse“ nach einem Zug.</div>';
}
function trimAnalysis(max = 5) {
    const cards = analysisEl.querySelectorAll('.analysis-card');
    for (let i = max; i < cards.length; i++) cards[i].remove();
}
function pushAnalysisResult({ ok, summary, error, depth }) {
    const card = document.createElement('div');
    card.className = 'analysis-card';
    const head = document.createElement('div'); head.className = 'analysis-head';
    const title = document.createElement('strong'); title.textContent = ok ? (summary?.judgement ?? 'Analyse') : 'Fehler';
    const badge = document.createElement('span'); badge.className = `judgement-badge ${summary?.severity ?? 'info'}`; badge.textContent = summary?.judgement ?? 'Analyse';
    head.append(title, badge);
    const body = document.createElement('div'); body.className = 'analysis-body';
    body.textContent = ok
        ? `${summary.mover === 'none' ? 'Startstellung' : 'Gesetzt: ' + summary.moveSan} • Bewertung: ${summary.evaluationBefore} → ${summary.evaluationAfter}`
        : (error ?? 'Unbekannter Fehler');
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `Tiefe ${summary?.depthUsed ?? depth ?? '-'} • ${new Date().toLocaleTimeString()}`;
    card.append(head, body, meta);
    const placeholder = analysisEl.querySelector('.analysis-placeholder'); if (placeholder) placeholder.remove();
    analysisEl.prepend(card); trimAnalysis();
}
async function runLocalAnalysis() {
    if (!roomId) return showToast('Bitte zuerst einem Raum beitreten.', 'info');
    const depth = Math.min(30, Math.max(5, parseInt(depthInput.value, 10) || settings.depth));
    depthInput.value = depth; depthValue.textContent = depth; settings.depth = depth; persistSettings();
    localAnalysisBtn.disabled = true; localAnalysisBtn.classList.add('loading');
    const controller = new AbortController(); analysisController = controller;
    try {
        const res = await fetch(`/api/local/analyze?roomId=${encodeURIComponent(roomId)}&depth=${depth}`, { signal: controller.signal });
        const payload = await res.json().catch(() => null);
        if (res.ok && payload?.ok) pushAnalysisResult({ ok: true, summary: payload.summary, depth: payload.depth });
        else pushAnalysisResult({ ok: false, error: payload?.error ?? `HTTP ${res.status}`, depth });
    } catch (e) {
        if (!controller.signal.aborted) pushAnalysisResult({ ok: false, error: e instanceof Error ? e.message : String(e), depth });
    } finally {
        if (analysisController === controller) analysisController = null;
        localAnalysisBtn.disabled = false; localAnalysisBtn.classList.remove('loading');
    }
}

// ---- Copy helpers ----
async function copyText(getter, label) {
    try { const text = await getter(); await navigator.clipboard.writeText(text); showToast(`${label} kopiert.`, 'success'); }
    catch (e) { showToast(`Konnte nicht kopieren: ${label}`, 'error'); }
}

// ---- Join / events ----
async function ensureConnected() {
    if (!hasSignalR) throw new Error('SignalR nicht geladen.');
    if (conn.state === 'Connected') return;
    await conn.start();
}
async function joinGame(vsBot) {
    const room = document.getElementById('room').value.trim() || 'testroom';
    const name = document.getElementById('name').value.trim() || 'Player';
    const side = document.getElementById('side').value || 'auto';
    const elo = parseInt(eloInput.value, 10) || settings.elo;
    settings.elo = elo; persistSettings();

    setStatusBanner('status-waiting', 'Verbinde …');
    showLoading(true);
    try {
        await ensureConnected();
        await conn.invoke('JoinRoom', room, name, vsBot, side, elo);
        roomId = room; lastJoinRequest = { vsBot, playAs: side, elo, name };
        setStatusBanner(vsBot ? 'status-bot' : 'status-online', vsBot ? `Stockfish Bot · ELO ${elo}` : 'Verbunden');
        setView('chess');
    } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), 'error');
        setStatusBanner('status-offline', 'Offline');
    } finally { showLoading(false); }
}

// SignalR handlers
if (conn) {
    conn.on('Init', (st, seat) => { mySeat = seat; renderState(st); renderHistory([]); resetAnalysis(); });
    conn.on('State', st => { renderState(st); });
    conn.on('History', list => { renderHistory(list); });
    conn.on('Players', p => { renderPlayers(p); });
    conn.on('MoveResult', (ok, err) => { if (!ok) showToast(err ?? 'Illegaler Zug', 'error'); });
    conn.on('GameOver', (msg, post) => {
        showToast(msg, 'success');
        pushAnalysisResult({ ok: true, summary: { judgement: 'Partieende', evaluationBefore: '—', evaluationAfter: '—', depthUsed: '—', mover: 'none', moveSan: msg }, depth: null });
        if (post) pushAnalysisResult({ ok: true, summary: { judgement: 'ACPL', evaluationBefore: `W:${post.white?.acpl}`, evaluationAfter: `B:${post.black?.acpl}`, depthUsed: '—', mover: 'none', moveSan: 'Post Game' } });
    });
    conn.onreconnected(() => setStatusBanner(lastJoinRequest?.vsBot ? 'status-bot' : 'status-online', lastJoinRequest?.vsBot ? `Stockfish Bot · ELO ${lastJoinRequest.elo}` : 'Verbunden'));
}

// ---- UI wiring ----
document.getElementById('open-chess')?.addEventListener('click', () => setView('chess'));
document.querySelectorAll('[data-game="chess"]').forEach(b => b.addEventListener('click', () => setView('chess')));
document.getElementById('back-to-lobby')?.addEventListener('click', () => setView('lobby'));
document.getElementById('join-bot')?.addEventListener('click', () => joinGame(true));
document.getElementById('join')?.addEventListener('click', () => joinGame(false));
document.getElementById('copy-pgn')?.addEventListener('click', () => copyText(() => conn.invoke('GetPgn', roomId), 'PGN'));
document.getElementById('copy-fen')?.addEventListener('click', () => copyText(() => conn.invoke('GetFen', roomId), 'FEN'));
localAnalysisBtn?.addEventListener('click', runLocalAnalysis);

depthInput?.addEventListener('change', () => {
    const d = Math.min(30, Math.max(5, parseInt(depthInput.value, 10) || settings.depth));
    settings.depth = d; depthInput.value = d; depthValue.textContent = d; persistSettings();
});
eloInput?.addEventListener('change', () => {
    const e = Math.min(3000, Math.max(50, parseInt(eloInput.value, 10) || settings.elo));
    settings.elo = e; eloInput.value = e; persistSettings();
});
themeToggle?.addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = settings.theme;
    themeToggle.textContent = settings.theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme';
    persistSettings();
});
// start
const hasLobby = !!document.getElementById('lobby-view');
const hasChess = !!document.getElementById('chess-view');

if (hasLobby && hasChess) {
    setView('lobby');
} else if (hasChess) {
    setView('chess');
}

if (!hasSignalR) {
    try { setStatusBanner('status-offline', 'Offline'); } catch { }
    try { showToast('SignalR nicht gefunden. Online-Features aus.', 'warning'); } catch { }
}
