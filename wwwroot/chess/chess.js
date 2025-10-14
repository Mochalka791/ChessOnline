const boardEl = document.getElementById('board');
const cellTpl = document.getElementById('cell-tpl');
const moveHintsEl = document.getElementById('move-hints');
const boardBadge = document.getElementById('board-badge');
const playersEl = document.getElementById('players');
const clocksEl = document.getElementById('clocks');
const turnEl = document.getElementById('turn');
const movesEl = document.getElementById('moves');
const movesPlaceholder = document.getElementById('moves-placeholder');
const analysisEl = document.getElementById('analysis');
const localAnalysisBtn = document.getElementById('local-analysis');
const depthInput = document.getElementById('depth');
const depthValue = document.getElementById('depth-value');
const eloInput = document.getElementById('elo');
const eloValue = document.getElementById('elo-value');
const statusBanner = document.getElementById('status-banner');
const statusLog = document.getElementById('status-log');
const toastContainer = document.getElementById('toast-container');
const loadingOverlay = document.getElementById('loading-overlay');
const themeToggle = document.getElementById('theme-toggle');

const STORAGE_KEY = 'arcade.settings.v1';
const DEFAULT_SETTINGS = { depth: 14, elo: 1000, theme: 'light' };
const CONNECTION_TIMEOUT_MS = 8000;

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

const settings = loadSettings();

function persistSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
}

document.body.dataset.theme = settings.theme ?? 'light';
if (themeToggle) {
    themeToggle.textContent = settings.theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme';
}

if (eloInput) {
    eloInput.value = settings.elo;
    if (eloValue) eloValue.textContent = settings.elo;
}
if (depthInput) {
    depthInput.value = settings.depth;
    if (depthValue) depthValue.textContent = settings.depth;
}

const hasSignalR = typeof window !== 'undefined' && typeof window.signalR !== 'undefined';
const HubConnectionState = hasSignalR && window.signalR?.HubConnectionState
    ? window.signalR.HubConnectionState
    : { Disconnected: 'Disconnected', Connected: 'Connected' };

const conn = hasSignalR
    ? new signalR.HubConnectionBuilder()
        .withUrl('/hubs/chess')
        .withAutomaticReconnect()
        .build()
    : {
        state: HubConnectionState.Disconnected,
        async start() {
            throw new Error('SignalR-Bibliothek nicht geladen.');
        },
        async invoke() {
            throw new Error('SignalR-Bibliothek nicht geladen.');
        },
        on() { /* noop */ },
        onclose() { /* noop */ },
        onreconnecting() { /* noop */ },
        onreconnected() { /* noop */ },
    };

let roomId = null;
let mySeat = 'spectator';
let state = null;
let history = [];
let preview = null;
let selected = null;
let legalMoves = [];
let boardMatrix = Array.from({ length: 8 }, () => Array(8).fill('.'));
let clockTimer = null;
let whiteBase = 0, blackBase = 0, serverStamp = 0;
let lastJoinRequest = null;
let analysisController = null;
let dragSource = null;
let dragPieceEl = null;
let dragHoverIndex = null;

const boardCells = [];
if (boardEl && cellTpl) {
    const tpl = cellTpl.content.firstElementChild;
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const cell = tpl.cloneNode(true);
            cell.classList.add(((x + y) % 2 === 0) ? 'light' : 'dark');
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.addEventListener('click', () => onCellClick(x, y));
            cell.addEventListener('dragover', (evt) => onCellDragOver(evt, x, y));
            cell.addEventListener('dragleave', () => onCellDragLeave(cell));
            cell.addEventListener('drop', (evt) => onCellDrop(evt, x, y));
            const piece = cell.querySelector('.piece');
            if (piece) {
                piece.draggable = false;
                piece.addEventListener('dragstart', (evt) => onPieceDragStart(evt, x, y));
                piece.addEventListener('dragend', onPieceDragEnd);
            }
            boardEl.appendChild(cell);
            boardCells.push(cell);
        }
    }
}

function pieceSrc(code) {
    return (!code || code === '.') ? null : `/pieces/${code}.svg`;
}

function describePiece(code) {
    if (!code || code === '.') return '';
    const [color, type] = code.split('_');
    const colorName = color === 'w' ? 'Weißer' : 'Schwarzer';
    const map = {
        pawn: 'Bauer',
        knight: 'Springer',
        bishop: 'Läufer',
        rook: 'Turm',
        queen: 'Dame',
        king: 'König'
    };
    return `${colorName} ${map[type] ?? type}`;
}

function showToast(message, type = 'info', duration = 4000) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

function logStatus(message) {
    if (!statusLog) return;
    const entry = document.createElement('p');
    entry.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
    statusLog.prepend(entry);
    while (statusLog.children.length > 6)
        statusLog.removeChild(statusLog.lastChild);
}

function setStatusBanner(mode, text) {
    if (!statusBanner) return;
    statusBanner.className = `status-pill ${mode}`;
    statusBanner.textContent = text;
}

function showLoading(flag) {
    if (!loadingOverlay) return;
    loadingOverlay.hidden = !flag;
}

function resetAnalysis() {
    if (!analysisEl) return;
    analysisEl.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'analysis-placeholder';
    placeholder.textContent = 'Starte Stockfish, um Feedback zu deinem letzten Zug zu erhalten.';
    analysisEl.appendChild(placeholder);
}

function removeAnalysisPlaceholder() {
    if (!analysisEl) return;
    const placeholder = analysisEl.querySelector('.analysis-placeholder');
    if (placeholder) placeholder.remove();
}

function trimAnalysisCards(max = 4) {
    if (!analysisEl) return;
    const cards = analysisEl.querySelectorAll('.analysis-card');
    if (cards.length <= max) return;
    for (let i = max; i < cards.length; i++) cards[i].remove();
}

function showAnalysisLoading(depth) {
    if (!analysisEl) return null;
    removeAnalysisPlaceholder();
    const card = document.createElement('div');
    card.className = 'analysis-card loading';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const content = document.createElement('div');
    content.className = 'content';
    content.innerHTML = `<strong>Stockfish rechnet …</strong><div class="meta">Tiefe ${depth}</div>`;
    card.append(spinner, content);
    analysisEl.prepend(card);
    trimAnalysisCards();
    return card;
}

function pushAnalysisResult({ ok, summary, error, depth }) {
    if (!analysisEl) return;
    removeAnalysisPlaceholder();
    const card = document.createElement('div');
    card.className = 'analysis-card';

    if (!ok) {
        card.classList.add('error');
        const head = document.createElement('div');
        head.className = 'analysis-headline';
        head.textContent = 'Analyse fehlgeschlagen';
        const body = document.createElement('div');
        body.textContent = error ?? 'Unbekannter Fehler.';
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = new Date().toLocaleTimeString();
        card.append(head, body, meta);
    } else if (summary) {
        if (summary.severity) card.classList.add(`is-${summary.severity}`);
        const head = document.createElement('div');
        head.className = 'analysis-headline';

        const mover = document.createElement('span');
        mover.className = `mover-badge ${summary.mover === 'Weiß' ? 'white' : summary.mover === 'Schwarz' ? 'black' : 'none'}`;
        mover.textContent = summary.mover === 'none' ? 'Übersicht' : `${summary.mover} zog`;
        head.appendChild(mover);

        const badge = document.createElement('span');
        badge.className = `judgement-badge ${summary.severity ?? 'info'}`;
        badge.textContent = summary.judgement ?? 'Analyse';
        head.appendChild(badge);

        const body = document.createElement('div');
        body.className = 'analysis-body';

        const played = document.createElement('div');
        played.className = 'analysis-line primary';
        played.textContent = summary.mover === 'none' ? 'Aktuelle Stellung' : `Gesetzt wurde: ${summary.moveSan}`;
        body.appendChild(played);

        const verdict = document.createElement('div');
        verdict.className = 'analysis-comment';
        const swing = typeof summary.swing === 'number' ? ` (${summary.swing >= 0 ? '+' : ''}${summary.swing} Punkte)` : '';
        verdict.textContent = summary.comment ? `${summary.judgement}${swing}: ${summary.comment}` : summary.judgement;
        body.appendChild(verdict);

        const evalLine = document.createElement('div');
        evalLine.className = 'analysis-line';
        evalLine.textContent = `Bewertung: ${summary.evaluationBefore} → ${summary.evaluationAfter}`;
        body.appendChild(evalLine);

        if (summary.bestSan) {
            const best = document.createElement('div');
            best.className = 'analysis-line';
            best.textContent = `Engine-Empfehlung: ${summary.bestSan}`;
            body.appendChild(best);
        }

        if (summary.pvSan?.length) {
            const pv = document.createElement('div');
            pv.className = 'analysis-line';
            pv.textContent = `Variante: ${summary.pvSan.join(' ')}`;
            body.appendChild(pv);
        }

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `Tiefe ${summary.depthUsed ?? depth} • ${new Date().toLocaleTimeString()}`;

        card.append(head, body, meta);
    }

    analysisEl.prepend(card);
    trimAnalysisCards();
}

function pushPostGameSummary(summary) {
    if (!analysisEl || !summary) return;
    removeAnalysisPlaceholder();

    const card = document.createElement('div');
    card.className = 'analysis-card final';

    const head = document.createElement('div');
    head.className = 'analysis-headline';
    head.textContent = 'Partie-Auswertung';

    const body = document.createElement('div');
    body.className = 'analysis-body';

    const movesLine = document.createElement('div');
    movesLine.className = 'analysis-line primary';
    movesLine.textContent = `Züge insgesamt: ${summary.moves}`;
    body.appendChild(movesLine);

    if (summary.white) {
        const whiteLine = document.createElement('div');
        whiteLine.className = 'analysis-line';
        whiteLine.textContent = `Weiß ACPL: ${summary.white.acpl} (≈ Elo ${summary.white.estElo})`;
        body.appendChild(whiteLine);
    }

    if (summary.black) {
        const blackLine = document.createElement('div');
        blackLine.className = 'analysis-line';
        blackLine.textContent = `Schwarz ACPL: ${summary.black.acpl} (≈ Elo ${summary.black.estElo})`;
        body.appendChild(blackLine);
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = new Date().toLocaleTimeString();

    card.append(head, body, meta);
    analysisEl.prepend(card);
    trimAnalysisCards(5);
}

function ensureConnected(timeout = CONNECTION_TIMEOUT_MS) {
    if (!hasSignalR) {
        return Promise.reject(new Error('Echtzeit-Verbindung nicht verfügbar.'));
    }
    if (conn.state === HubConnectionState.Disconnected) {
        const startPromise = conn.start();
        if (!Number.isFinite(timeout) || timeout <= 0) {
            return startPromise;
        }
        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                if (conn.state !== HubConnectionState.Connected) {
                    conn.stop().catch(() => {});
                }
                reject(new Error('Verbindung konnte nicht aufgebaut werden. Bitte versuche es später erneut.'));
            }, timeout);

            startPromise
                .then((value) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(value);
                })
                .catch((err) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }
    return Promise.resolve();
}

function updateClockElements() {
    if (!clocksEl || !state) return;
    const whiteTimeEl = clocksEl.querySelector('.time[data-side="white"]');
    const blackTimeEl = clocksEl.querySelector('.time[data-side="black"]');
    const whiteClock = clocksEl.querySelector('.clock-white');
    const blackClock = clocksEl.querySelector('.clock-black');
    if (!whiteTimeEl || !blackTimeEl || !whiteClock || !blackClock) return;

    const now = Date.now();
    let white = whiteBase;
    let black = blackBase;
    if (state.turn === 'white') white = Math.max(0, whiteBase - (now - serverStamp));
    else black = Math.max(0, blackBase - (now - serverStamp));

    const fmt = ms => {
        const total = Math.max(0, Math.floor(ms / 1000));
        const mins = Math.floor(total / 60);
        const secs = String(total % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    };

    whiteTimeEl.textContent = fmt(white);
    blackTimeEl.textContent = fmt(black);

    whiteClock.classList.toggle('active', state.turn === 'white');
    blackClock.classList.toggle('active', state.turn === 'black');
}

function startClockTicking() {
    if (clockTimer) clearInterval(clockTimer);
    updateClockElements();
    clockTimer = setInterval(updateClockElements, 250);
}

function drawMoveHints(moves) {
    if (!moveHintsEl) return;
    moveHintsEl.innerHTML = '';
    for (const mv of moves) {
        const hint = document.createElement('div');
        hint.className = 'hint';
        if (mv.capture) hint.classList.add('capture');
        hint.style.left = `${mv.tx * 12.5}%`;
        hint.style.top = `${mv.ty * 12.5}%`;
        moveHintsEl.appendChild(hint);
    }
}

function clearDragState() {
    if (dragPieceEl) {
        dragPieceEl.classList.remove('dragging');
        dragPieceEl = null;
    }
    if (dragSource) {
        const idx = dragSource.y * 8 + dragSource.x;
        boardCells[idx]?.classList.remove('dragging');
    }
    if (dragHoverIndex != null) {
        boardCells[dragHoverIndex]?.classList.remove('drag-over', 'capture');
        dragHoverIndex = null;
    }
    for (const cell of boardCells) {
        cell.classList.remove('drag-over', 'capture');
    }
    dragSource = null;
}

function clearSelection(options = {}) {
    if (selected) {
        const idx = selected.y * 8 + selected.x;
        boardCells[idx]?.classList.remove('selected');
    }
    selected = null;
    if (!options.keepHints) {
        legalMoves = [];
        if (moveHintsEl) moveHintsEl.innerHTML = '';
    }
    if (!options.keepDrag) clearDragState();
}

function onPieceDragStart(evt, x, y) {
    const code = boardMatrix[x]?.[y] ?? '.';
    if (!canControlPiece(code)) {
        evt.preventDefault();
        return;
    }

    const idx = y * 8 + x;
    const sameSquare = selected && selected.x === x && selected.y === y;
    if (!sameSquare) {
        clearSelection();
        selected = { x, y };
        boardCells[idx]?.classList.add('selected');
    }

    dragSource = { x, y };
    dragPieceEl = evt.target;
    boardCells[idx]?.classList.add('dragging');
    dragPieceEl?.classList.add('dragging');
    requestLegalMoves(x, y);

    if (evt.dataTransfer) {
        evt.dataTransfer.effectAllowed = 'move';
        evt.dataTransfer.setData('text/plain', `${x},${y}`);
        const rect = dragPieceEl?.getBoundingClientRect();
        if (rect && evt.dataTransfer.setDragImage) {
            evt.dataTransfer.setDragImage(dragPieceEl, rect.width / 2, rect.height / 2);
        }
    }
}

function onPieceDragEnd() {
    if (dragSource) {
        clearDragState();
        drawMoveHints(legalMoves);
    }
}

function onCellDragOver(evt, x, y) {
    if (!dragSource) return;
    evt.preventDefault();
    const idx = y * 8 + x;
    if (dragHoverIndex !== idx) {
        if (dragHoverIndex != null) {
            boardCells[dragHoverIndex]?.classList.remove('drag-over', 'capture');
        }
        dragHoverIndex = idx;
    }

    const move = legalMoves.find(m => m.tx === x && m.ty === y);
    const cell = boardCells[idx];
    if (!cell) return;

    if (move) {
        cell.classList.add('drag-over');
        cell.classList.toggle('capture', !!move.capture);
        if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
    } else {
        cell.classList.remove('drag-over', 'capture');
        if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'none';
    }
}

function onCellDragLeave(cell) {
    cell.classList.remove('drag-over', 'capture');
    dragHoverIndex = null;
}

function onCellDrop(evt, x, y) {
    if (!dragSource) return;
    evt.preventDefault();

    const { x: fx, y: fy } = dragSource;
    clearDragState();

    if (fx === x && fy === y) {
        drawMoveHints(legalMoves);
        return;
    }

    const move = legalMoves.find(m => m.tx === x && m.ty === y);
    if (move) {
        makeMove(fx, fy, x, y);
        clearSelection();
    } else {
        const idx = fy * 8 + fx;
        boardCells[idx]?.classList.add('invalid');
        setTimeout(() => boardCells[idx]?.classList.remove('invalid'), 500);
        drawMoveHints(legalMoves);
    }
}

function canControlPiece(code) {
    if (!code || code === '.' || !state) return false;
    const isWhitePiece = code.startsWith('w_');
    if (mySeat === 'spectator') return false;
    if (state.turn === 'white' && mySeat === 'white') return isWhitePiece;
    if (state.turn === 'black' && mySeat === 'black') return !isWhitePiece;
    return false;
}

function onCellClick(x, y) {
    if (preview) {
        preview = null;
        renderLiveBoard();
        return;
    }

    const code = boardMatrix[x]?.[y] ?? '.';
    if (selected && selected.x === x && selected.y === y) {
        clearSelection();
        return;
    }

    if (selected) {
        const target = legalMoves.find(m => m.tx === x && m.ty === y);
        if (target) {
            makeMove(selected.x, selected.y, x, y);
            clearSelection();
            return;
        }
    }

    if (canControlPiece(code)) {
        clearSelection();
        selected = { x, y };
        const idx = y * 8 + x;
        const cell = boardCells[idx];
        if (cell) cell.classList.add('selected');
        requestLegalMoves(x, y);
    } else {
        clearSelection();
    }
}

async function requestLegalMoves(x, y) {
    if (!roomId) return;
    const requestKey = `${x},${y}`;
    try {
        const moves = await conn.invoke('GetLegalMoves', roomId, x, y);
        const currentKey = selected ? `${selected.x},${selected.y}` : null;
        if (currentKey && currentKey !== requestKey) return;
        legalMoves = Array.isArray(moves) ? moves : [];
        drawMoveHints(legalMoves);
    } catch (err) {
        const currentKey = selected ? `${selected.x},${selected.y}` : null;
        if (currentKey && currentKey !== requestKey) return;
        legalMoves = [];
        drawMoveHints(legalMoves);
        const message = err instanceof Error ? err.message : String(err);
        logStatus(`Legale Züge konnten nicht geladen werden: ${message}`);
    }
}

function fenToMatrix(fen) {
    const parts = fen.split(' ');
    if (parts.length < 2) return { board: boardMatrix, turn: 'white' };
    const rows = parts[0].split('/');
    const turn = parts[1] === 'b' ? 'black' : 'white';
    const matrix = Array.from({ length: 8 }, () => Array(8).fill('.'));
    for (let y = 0; y < 8; y++) {
        const row = rows[y] ?? '';
        let x = 0;
        for (const char of row) {
            if (/[0-9]/.test(char)) {
                x += parseInt(char, 10);
                continue;
            }
            const isWhite = char === char.toUpperCase();
            const lower = char.toLowerCase();
            const type = lower === 'p' ? 'pawn'
                : lower === 'n' ? 'knight'
                : lower === 'b' ? 'bishop'
                : lower === 'r' ? 'rook'
                : lower === 'q' ? 'queen'
                : 'king';
            if (x < 8) matrix[x][y] = `${isWhite ? 'w' : 'b'}_${type}`;
            x++;
        }
    }
    return { board: matrix, turn };
}

function renderBoard(matrix, options = {}) {
    if (!boardCells.length) return;
    const lastMove = options.lastMove;
    const inCheck = options.check;
    const previewMode = options.preview ?? false;

    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const idx = y * 8 + x;
            const cell = boardCells[idx];
            const img = cell.querySelector('.piece');
            const code = matrix[x]?.[y] ?? '.';
            if (img.dataset.piece !== code) {
                const src = pieceSrc(code);
                if (src) {
                    img.src = src;
                    img.style.display = 'block';
                    img.dataset.piece = code;
                    img.alt = describePiece(code);
                    img.draggable = true;
                } else {
                    img.removeAttribute('src');
                    img.dataset.piece = '';
                    img.style.display = 'none';
                    img.alt = '';
                    img.draggable = false;
                }
            }

            cell.classList.toggle('last-from', !!lastMove && lastMove.fx === x && lastMove.fy === y);
            cell.classList.toggle('last-to', !!lastMove && lastMove.tx === x && lastMove.ty === y);
            cell.classList.toggle('check', (!!inCheck?.white && inCheck.white.x === x && inCheck.white.y === y) || (!!inCheck?.black && inCheck.black.x === x && inCheck.black.y === y));
        }
    }

    boardMatrix = matrix;

    if (boardBadge) {
        if (boardBadge.dataset.locked === 'true') {
            // keep current message (z.B. Schachmatt)
        } else if (previewMode) {
            boardBadge.hidden = true;
        } else if (state?.check?.white || state?.check?.black) {
            boardBadge.hidden = false;
            const side = state.check.white ? 'Weiß' : 'Schwarz';
            boardBadge.textContent = `${side} steht im Schach!`;
        } else {
            boardBadge.hidden = true;
        }
    }
}

function renderLiveBoard() {
    if (!state) return;
    renderBoard(state.board, { lastMove: state.lastMove, check: extractCheckSquares(state.check), preview: false });
    updateTurnLabel(state.turn);
    drawMoveHints([]);
    clearSelection();
    movesEl?.querySelectorAll('li').forEach(node => node.classList.remove('active'));
}

function extractCheckSquares(check) {
    if (!check) return null;
    const res = { white: null, black: null };
    if (check.white) res.white = { x: check.wKing.x, y: check.wKing.y };
    if (check.black) res.black = { x: check.bKing.x, y: check.bKing.y };
    return res;
}

function updateTurnLabel(turn) {
    if (!turnEl) return;
    const label = turn === 'white' ? 'Weiß' : 'Schwarz';
    turnEl.textContent = `Am Zug: ${label}`;
    turnEl.dataset.side = turn;
}

function renderPlayers(players) {
    if (!playersEl) return;
    playersEl.textContent = `Weiß: ${players.white} • Schwarz: ${players.black}`;
}

function renderHistory(list) {
    history = Array.isArray(list) ? list : [];
    if (!movesEl) return;
    movesEl.innerHTML = '';
    const entries = history.filter(item => item.ply > 0);
    if (movesPlaceholder) movesPlaceholder.hidden = entries.length > 0;

    for (const item of entries) {
        const li = document.createElement('li');
        const prefix = item.side === 'white' ? `${item.moveNumber}.` : `${item.moveNumber}...`;
        li.textContent = `${prefix} ${item.san}`;
        li.dataset.fen = item.fen;
        li.dataset.ply = item.ply;
        li.addEventListener('click', () => togglePreview(item, li));
        movesEl.appendChild(li);
    }
}

function togglePreview(item, li) {
    if (preview && preview.ply === item.ply) {
        preview = null;
        renderLiveBoard();
        movesEl.querySelectorAll('li').forEach(node => node.classList.remove('active'));
        if (boardBadge?.dataset.locked === 'true') boardBadge.hidden = false;
        return;
    }

    const { board, turn } = fenToMatrix(item.fen);
    preview = { ply: item.ply, turn };
    clearSelection();
    drawMoveHints([]);
    renderBoard(board, { preview: true });
    updateTurnLabel(turn);
    movesEl.querySelectorAll('li').forEach(node => node.classList.toggle('active', node === li));
    if (boardBadge) boardBadge.hidden = true;
}

async function makeMove(fx, fy, tx, ty) {
    if (!roomId) return;
    try {
        await conn.invoke('MakeMove', roomId, fx, fy, tx, ty, null);
    } catch (err) {
        const idx = fy * 8 + fx;
        boardCells[idx]?.classList.add('invalid');
        setTimeout(() => boardCells[idx]?.classList.remove('invalid'), 500);
        const message = err instanceof Error ? err.message : String(err);
        showToast(`Zug fehlgeschlagen: ${message}`, 'error');
    }
}

async function joinGame(vsBot) {
    const room = document.getElementById('room');
    const name = document.getElementById('name');
    const side = document.getElementById('side');
    const roomValue = room?.value?.trim() || 'testroom';
    const nameValue = name?.value?.trim() || 'Spieler';
    const playAs = side?.value ?? 'auto';
    const elo = parseInt(eloInput?.value ?? settings.elo, 10) || settings.elo;

    setStatusBanner('status-waiting', 'Verbinde …');
    await ensureConnected();

    showLoading(true);
    try {
        await conn.invoke('JoinRoom', roomValue, nameValue, vsBot, playAs, elo);
        roomId = roomValue;
        lastJoinRequest = { vsBot, playAs, elo, name: nameValue };
        logStatus(`Raum ${roomId} beigetreten (${vsBot ? 'Bot' : 'Online'})`);
        const bannerClass = vsBot ? 'status-bot' : 'status-online';
        const bannerText = vsBot ? `Stockfish Bot · ELO ${elo}` : 'Verbunden';
        setStatusBanner(bannerClass, bannerText);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showToast(`Beitritt fehlgeschlagen: ${message}`, 'error');
        logStatus(`Fehler beim Beitritt: ${message}`);
        setStatusBanner('status-offline', 'Getrennt');
    } finally {
        showLoading(false);
    }
}

async function copyText(getter, label) {
    try {
        const text = await getter();
        await navigator.clipboard.writeText(text);
        showToast(`${label} kopiert`, 'success');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showToast(`${label} konnte nicht kopiert werden: ${message}`, 'error');
    }
}

async function runLocalAnalysis() {
    if (!localAnalysisBtn) return;
    if (!roomId) {
        showToast('Bitte zuerst einem Raum beitreten.', 'info');
        return;
    }

    const depth = Math.min(30, Math.max(4, parseInt(depthInput?.value ?? settings.depth, 10) || 14));
    if (depthInput) {
        depthInput.value = depth;
        depthValue.textContent = depth;
        settings.depth = depth;
        persistSettings();
    }

    if (analysisController) analysisController.abort();
    const controller = new AbortController();
    analysisController = controller;

    localAnalysisBtn.disabled = true;
    localAnalysisBtn.classList.add('loading');
    const loadingCard = showAnalysisLoading(depth);

    try {
        const res = await fetch(`/api/local/analyze?roomId=${encodeURIComponent(roomId)}&depth=${depth}`, { signal: controller.signal });
        const payload = await res.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (res.ok && payload?.ok) {
            pushAnalysisResult({ ok: true, summary: payload.summary, depth: payload.depth ?? depth });
        } else {
            const message = payload?.error ?? `HTTP ${res.status}`;
            pushAnalysisResult({ ok: false, error: message, depth });
            showToast(`Analyse fehlgeschlagen: ${message}`, 'error');
        }
    } catch (err) {
        if (!controller.signal.aborted) {
            const message = err instanceof Error ? err.message : String(err);
            pushAnalysisResult({ ok: false, error: message, depth });
            showToast(`Analyse fehlgeschlagen: ${message}`, 'error');
        }
    } finally {
        if (loadingCard?.parentElement) loadingCard.remove();
        if (analysisController === controller) analysisController = null;
        localAnalysisBtn.disabled = false;
        localAnalysisBtn.classList.remove('loading');
    }
}

conn.on('Init', (st, seat) => {
    state = st;
    mySeat = seat;
    preview = null;
    if (boardBadge) {
        boardBadge.hidden = true;
        delete boardBadge.dataset.locked;
    }
    whiteBase = st.whiteMs;
    blackBase = st.blackMs;
    serverStamp = Date.now();
    renderLiveBoard();
    startClockTicking();
    resetAnalysis();
    logStatus('Spielzustand initialisiert.');
});

conn.on('State', (st) => {
    state = st;
    if (!preview) renderLiveBoard();
    whiteBase = st.whiteMs;
    blackBase = st.blackMs;
    serverStamp = Date.now();
    startClockTicking();
});

conn.on('History', (items) => {
    renderHistory(items);
});

conn.on('Players', (players) => {
    renderPlayers(players);
});

conn.on('MoveResult', (ok, err) => {
    if (!ok && err) showToast(err, 'error');
});

conn.on('GameOver', (message, summary) => {
    showToast(message, 'info', 6000);
    logStatus(`Partie beendet: ${message}`);
    if (boardBadge) {
        boardBadge.hidden = false;
        boardBadge.textContent = message;
        boardBadge.dataset.locked = 'true';
    }
    pushPostGameSummary(summary);
});

conn.onclose(() => {
    setStatusBanner('status-offline', 'Getrennt');
    logStatus('Verbindung getrennt.');
});

conn.onreconnecting(() => {
    setStatusBanner('status-waiting', 'Verbindung wird wiederhergestellt …');
    logStatus('Verbindung verloren, versuche erneut …');
});

conn.onreconnected(async () => {
    const bannerClass = lastJoinRequest?.vsBot ? 'status-bot' : 'status-online';
    const bannerText = lastJoinRequest?.vsBot ? `Stockfish Bot · ELO ${lastJoinRequest.elo}` : 'Verbunden';
    setStatusBanner(bannerClass, bannerText);
    logStatus('Wieder verbunden.');
    if (roomId && lastJoinRequest) {
        try {
            await conn.invoke('JoinRoom', roomId, lastJoinRequest.name, lastJoinRequest.vsBot, lastJoinRequest.playAs, lastJoinRequest.elo);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logStatus(`Wiederbeitritt fehlgeschlagen: ${message}`);
        }
    }
});

document.getElementById('join-bot')?.addEventListener('click', () => joinGame(true));
document.getElementById('join')?.addEventListener('click', () => joinGame(false));

document.getElementById('copy-pgn')?.addEventListener('click', () => {
    if (!roomId) {
        showToast('Bitte zuerst einem Raum beitreten.', 'info');
        return;
    }
    copyText(() => conn.invoke('GetPgn', roomId), 'PGN');
});

document.getElementById('copy-fen')?.addEventListener('click', () => {
    if (!roomId) {
        showToast('Bitte zuerst einem Raum beitreten.', 'info');
        return;
    }
    copyText(() => conn.invoke('GetFen', roomId), 'FEN');
});

document.getElementById('offer-draw')?.addEventListener('click', () => {
    showToast('Remis-Angebote sind in Arbeit.', 'info');
    logStatus('Remis-Angebot gesendet (Simulation).');
});

document.getElementById('resign')?.addEventListener('click', () => {
    showToast('Aufgeben ist bald verfügbar.', 'info');
    logStatus('Aufgeben (Simulation).');
});

document.getElementById('request-undo')?.addEventListener('click', () => {
    showToast('Rücknahme folgt demnächst.', 'info');
    logStatus('Rücknahme angefragt (Simulation).');
});

if (localAnalysisBtn) localAnalysisBtn.addEventListener('click', () => runLocalAnalysis());

if (depthInput) {
    depthInput.addEventListener('input', () => {
        const depth = Math.min(30, Math.max(4, parseInt(depthInput.value, 10) || settings.depth));
        depthValue.textContent = depth;
    });
    depthInput.addEventListener('change', () => {
        const depth = Math.min(30, Math.max(4, parseInt(depthInput.value, 10) || settings.depth));
        depthInput.value = depth;
        depthValue.textContent = depth;
        settings.depth = depth;
        persistSettings();
    });
}

if (eloInput) {
    eloInput.addEventListener('input', () => {
        const elo = parseInt(eloInput.value, 10) || settings.elo;
        eloValue.textContent = elo;
    });
    eloInput.addEventListener('change', () => {
        const elo = parseInt(eloInput.value, 10) || settings.elo;
        settings.elo = elo;
        eloValue.textContent = elo;
        persistSettings();
    });
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
        document.body.dataset.theme = settings.theme;
        themeToggle.textContent = settings.theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme';
        persistSettings();
    });
}

window.addEventListener('keydown', (evt) => {
    if (evt.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(evt.target.tagName)) return;
    if (evt.key === 'a' || evt.key === 'A') {
        evt.preventDefault();
        runLocalAnalysis();
    } else if (evt.key === 'p' || evt.key === 'P') {
        evt.preventDefault();
        if (!roomId) {
            showToast('Bitte zuerst einem Raum beitreten.', 'info');
            return;
        }
        copyText(() => conn.invoke('GetPgn', roomId), 'PGN');
    } else if (evt.key === 'u' || evt.key === 'U') {
        evt.preventDefault();
        document.getElementById('request-undo')?.click();
    }
});

if (!hasSignalR) {
    logStatus('SignalR-Bibliothek konnte nicht geladen werden. Online-Modus deaktiviert.');
    showToast('Live-Verbindung nicht verfügbar – Online-Funktionen sind eingeschränkt.', 'warning');
}
setStatusBanner('status-ready', 'Bereit');
renderHistory([]);
resetAnalysis();
updateTurnLabel('white');
renderPlayers({ white: 'Weiß', black: 'Schwarz' });
