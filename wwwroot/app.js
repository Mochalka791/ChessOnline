const boardEl = document.getElementById('board');
const cellTpl = document.getElementById('cell-tpl');
const turnEl = document.getElementById('turn');
const playersEl = document.getElementById('players');
const clocksEl = document.getElementById('clocks');
const movesEl = document.getElementById('moves');
const analysisEl = document.getElementById('analysis');
const depthInput = document.getElementById('depth');
const localAnalysisBtn = document.getElementById('local-analysis');
const overlayEl = document.getElementById('over');
const overlayBody = document.getElementById('over-body');
const overlayTitle = document.getElementById('over-title');
const overlayAiBtn = document.getElementById('over-ai');
const overlayRematchBtn = document.getElementById('over-rematch');
const overlayCloseBtn = document.getElementById('over-close');

const conn = new signalR.HubConnectionBuilder()
    .withUrl("/chess")
    .withAutomaticReconnect()
    .build();

let state = null, prev = null, mySeat = "spectator", roomId = null, lastAttempt = null;
let clockTimer = null; let whiteBase = 0, blackBase = 0, serverStamp = 0;

const resetAnalysis = () => {
    if (!analysisEl) return;
    analysisEl.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'analysis-placeholder';
    placeholder.textContent = 'Run Stockfish to get a quick evaluation of the current position.';
    analysisEl.appendChild(placeholder);
};

const removeAnalysisPlaceholder = () => {
    if (!analysisEl) return;
    const placeholder = analysisEl.querySelector('.analysis-placeholder');
    if (placeholder) placeholder.remove();
};

const trimAnalysisCards = (max = 4) => {
    if (!analysisEl) return;
    const cards = analysisEl.querySelectorAll('.analysis-card');
    if (cards.length > max) {
        for (let i = max; i < cards.length; i++) {
            cards[i].remove();
        }
    }
};

const showAnalysisLoading = (depth) => {
    if (!analysisEl) return null;
    removeAnalysisPlaceholder();
    const card = document.createElement('div');
    card.className = 'analysis-card loading';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const content = document.createElement('div');
    content.className = 'content';
    content.innerHTML = `<strong>Stockfish is thinking…</strong><div class="meta">Depth ${depth}</div>`;
    card.append(spinner, content);
    analysisEl.prepend(card);
    trimAnalysisCards();
    return card;
};

const pushAnalysisResult = ({ ok, summary, error, depth }) => {
    if (!analysisEl) return;
    removeAnalysisPlaceholder();
    const card = document.createElement('div');
    card.className = 'analysis-card';

    if (!ok) {
        card.classList.add('error');
        const header = document.createElement('div');
        header.className = 'analysis-headline';
        const badge = document.createElement('span');
        badge.className = 'judgement-badge error';
        badge.textContent = 'Error';
        header.append(badge);

        const body = document.createElement('div');
        body.className = 'analysis-body';
        body.textContent = error ?? 'Unable to analyze the position.';

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = new Date().toLocaleTimeString();

        card.append(header, body, meta);
    } else if (summary) {
        if (summary.severity) card.classList.add(`is-${summary.severity}`);
        const header = document.createElement('div');
        header.className = 'analysis-headline';

        const mover = document.createElement('span');
        mover.className = `mover-badge ${String(summary.mover ?? 'info').toLowerCase()}`;
        mover.textContent = summary.mover === 'none' ? 'Overview' : summary.mover;

        const badge = document.createElement('span');
        badge.className = `judgement-badge ${summary.severity ?? 'info'}`;
        badge.textContent = summary.judgement ?? 'Analysis';
        header.append(mover, badge);

        const body = document.createElement('div');
        body.className = 'analysis-body';

        const played = document.createElement('div');
        played.className = 'analysis-line primary';
        played.textContent = summary.mover === 'none' ? 'Current position' : `Played: ${summary.moveSan}`;
        body.appendChild(played);

        const evalLine = document.createElement('div');
        evalLine.className = 'analysis-line eval';
        evalLine.textContent = `Eval: ${summary.evaluationBefore} → ${summary.evaluationAfter}`;
        body.appendChild(evalLine);

        if (typeof summary.swing === 'number') {
            const swingLine = document.createElement('div');
            swingLine.className = 'analysis-line swing';
            const swingVal = summary.swing;
            const swingText = `${swingVal >= 0 ? '+' : ''}${swingVal} cp`;
            swingLine.textContent = `Swing: ${swingText}`;
            body.appendChild(swingLine);
        }

        if (summary.comment) {
            const comment = document.createElement('div');
            comment.className = 'analysis-comment';
            comment.textContent = summary.comment;
            body.appendChild(comment);
        }

        if (summary.bestSan) {
            const best = document.createElement('div');
            best.className = 'analysis-line recommendation';
            best.textContent = `Better move: ${summary.bestSan}`;
            body.appendChild(best);
        }

        if (Array.isArray(summary.pvSan) && summary.pvSan.length > 0) {
            const pv = document.createElement('div');
            pv.className = 'analysis-line pv';
            pv.textContent = `Line: ${summary.pvSan.join(' ')}`;
            body.appendChild(pv);
        }

        const meta = document.createElement('div');
        meta.className = 'meta';
        const depthText = summary.depthUsed ?? depth;
        meta.textContent = `Depth ${depthText} • ${new Date().toLocaleTimeString()}`;

        card.append(header, body, meta);
    }

    analysisEl.prepend(card);
    trimAnalysisCards();
};

const clampDepth = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return 14;
    return Math.min(30, Math.max(4, parsed));
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const closeOverlay = () => {
    if (!overlayEl) return;
    overlayEl.classList.remove('show');
    overlayEl.setAttribute('aria-hidden', 'true');
};

const openOverlay = () => {
    if (!overlayEl) return;
    overlayEl.classList.add('show');
    overlayEl.setAttribute('aria-hidden', 'false');
};

resetAnalysis();

const pieceSrc = c => (!c || c === ".") ? null : `/pieces/${c}.svg`;

const ensureConnected = async () => { if (conn.state === "Disconnected") await conn.start(); };

const indexOf = (x, y) => y * 8 + x;
const shake = (x, y) => {
    const cell = boardEl.children[indexOf(x, y)];
    if (!cell) return; cell.classList.add('shake'); setTimeout(() => cell.classList.remove('shake'), 300);
};

const canDrag = (code) => {
    if (!code || code === ".") return false;
    const isWhite = code.startsWith("w_");
    if (state.turn === "white" && mySeat === "white" && isWhite) return true;
    if (state.turn === "black" && mySeat === "black" && !isWhite) return true;
    return false;
};

function drawClocks() {
    if (!state) return;
    const now = Date.now();
    let w = whiteBase, b = blackBase;
    if (state.turn === "white") w = Math.max(0, whiteBase - (now - serverStamp));
    else b = Math.max(0, blackBase - (now - serverStamp));
    const fmt = ms => {
        const s = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
        return `${m}:${ss}`;
    };
    clocksEl.textContent = `White ${fmt(w)}  |  Black ${fmt(b)}`;
}

function drawBoard(withAnim = true) {
    boardEl.innerHTML = "";
    if (!state) return;

    const last = state.lastMove;

    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const cell = cellTpl.content.firstElementChild.cloneNode(true);
            cell.classList.add(((x + y) % 2 === 0) ? 'light' : 'dark');

            const code = state.board[x][y];
            const img = cell.querySelector('.piece');

            const src = pieceSrc(code);
            if (src) {
                if (img.dataset.piece !== code) {
                    img.src = src;
                    img.dataset.piece = code;
                }
                img.style.display = 'block';
                img.alt = code?.replace('_', ' ') ?? '';
            } else {
                img.removeAttribute('src');
                img.removeAttribute('data-piece');
                img.style.display = 'none';
                img.alt = '';
            }

            if (last) {
                if (last.fx === x && last.fy === y) cell.classList.add('last-from');
                if (last.tx === x && last.ty === y) cell.classList.add('last-to');
            }

            if (state.check?.white && x === state.check.wKing.x && y === state.check.wKing.y) cell.classList.add('check');
            if (state.check?.black && x === state.check.bKing.x && y === state.check.bKing.y) cell.classList.add('check');

            const can = canDrag(code);
            img.draggable = can;
            const onDragStart = e => e.dataTransfer.setData("text/plain", JSON.stringify({ fx: x, fy: y }));
            img.addEventListener('dragstart', onDragStart);

            cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
            cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
            cell.addEventListener('drop', e => {
                e.preventDefault(); cell.classList.remove('drag-over');
                try { const { fx, fy } = JSON.parse(e.dataTransfer.getData("text/plain")); lastAttempt = { fx, fy }; makeMove(fx, fy, x, y); } catch { }
            });

            boardEl.appendChild(cell);
        }
    }

    if (withAnim && prev && state.lastMove) {
        const { fx, fy, tx, ty } = state.lastMove;
        const from = boardEl.children[indexOf(fx, fy)];
        const to = boardEl.children[indexOf(tx, ty)];
        if (from && to) {
            const code = prev.board[fx][fy];
            const ghost = document.createElement('img');
            ghost.className = 'move-ghost';
            const src = pieceSrc(code);
            if (src) {
                ghost.src = src; from.appendChild(ghost);
                const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
                requestAnimationFrame(() => { ghost.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px)`; });
                setTimeout(() => ghost.remove(), 200);
            }
        }
    }

    turnEl.textContent = `Turn: ${state.turn}`;
    turnEl.dataset.side = state.turn;
    whiteBase = state.whiteMs; blackBase = state.blackMs; serverStamp = Date.now();
    if (clockTimer) clearInterval(clockTimer);
    drawClocks(); clockTimer = setInterval(drawClocks, 250);
}

// Hub callbacks
conn.on("Init", (st, seat) => {
    prev = null;
    state = st;
    mySeat = seat;
    resetAnalysis();
    drawBoard(false);
});
conn.on("State", (st) => { prev = state; state = st; drawBoard(true); });
conn.on("History", (items) => { movesEl.innerHTML = ""; for (const it of items) { const li = document.createElement('li'); li.textContent = it; movesEl.appendChild(li); } });
conn.on("Players", (p) => { playersEl.textContent = `White: ${p.white} | Black: ${p.black}`; });
conn.on("MoveResult", (ok, err) => { if (!ok && lastAttempt) { shake(lastAttempt.fx, lastAttempt.fy); } });
conn.on("GameOver", (msg, analysis) => {
    if (!overlayEl || !overlayBody || !overlayTitle) return;
    overlayTitle.textContent = msg;
    overlayBody.innerHTML = analysis ? `
        <div class="overlay-summary">
            <div><strong>Moves:</strong> ${escapeHtml(analysis.moves)}</div>
            <div><strong>White:</strong> ACPL ${escapeHtml(analysis.white.acpl)} → ELO ${escapeHtml(analysis.white.estElo)}</div>
            <div><strong>Black:</strong> ACPL ${escapeHtml(analysis.black.acpl)} → ELO ${escapeHtml(analysis.black.estElo)}</div>
        </div>
    ` : '<div class="overlay-placeholder">Play a game to generate a post-match summary.</div>';
    openOverlay();
});

overlayCloseBtn?.addEventListener('click', () => closeOverlay());
overlayRematchBtn?.addEventListener('click', async () => {
    closeOverlay();
    await join(true);
});

overlayEl?.addEventListener('click', (evt) => {
    if (evt.target === overlayEl) closeOverlay();
});

overlayAiBtn?.addEventListener('click', async () => {
    if (!roomId || !overlayBody) return;
    overlayAiBtn.disabled = true;
    let container = overlayBody.querySelector('.overlay-ai');
    if (!container) {
        container = document.createElement('div');
        container.className = 'overlay-ai';
        overlayBody.appendChild(container);
    }
    container.classList.remove('error');
    container.innerHTML = '<div class="overlay-ai-loading">Requesting cloud analysis…</div>';
    try {
        const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, model: 'gpt-4o-mini' })
        });
        let payload = null;
        try { payload = await res.json(); } catch { /* ignore */ }
        if (res.ok && payload?.ok) {
            container.innerHTML = `<pre>${escapeHtml(payload.text)}</pre>`;
        } else {
            const message = payload?.error ?? `HTTP ${res.status}`;
            container.classList.add('error');
            container.innerHTML = `<div>AI error: ${escapeHtml(message)}</div>`;
        }
    } catch (err) {
        container.classList.add('error');
        const message = err instanceof Error ? err.message : String(err);
        container.innerHTML = `<div>AI error: ${escapeHtml(message)}</div>`;
    } finally {
        overlayAiBtn.disabled = false;
    }
});

const runLocalAnalysis = async () => {
    if (!localAnalysisBtn) return;
    const depth = clampDepth(depthInput?.value ?? 14);
    if (depthInput) depthInput.value = depth;
    if (!roomId) {
        pushAnalysisResult({ ok: false, error: 'Join a room first to analyze the current position.', depth });
        return;
    }

    localAnalysisBtn.disabled = true;
    const loadingCard = showAnalysisLoading(depth);
    let outcome = null;
    try {
        const res = await fetch(`/api/local/analyze?roomId=${encodeURIComponent(roomId)}&depth=${depth}`);
        let payload = null;
        try { payload = await res.json(); } catch { /* ignore */ }
        if (res.ok && payload?.ok) {
            outcome = { ok: true, summary: payload.summary ?? null, depth: payload.depth ?? depth };
        } else {
            const message = payload?.error ?? `HTTP ${res.status}`;
            outcome = { ok: false, error: message };
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outcome = { ok: false, error: message };
    } finally {
        if (loadingCard?.parentElement) loadingCard.remove();
        localAnalysisBtn.disabled = false;
    }

    if (outcome) {
        const effectiveDepth = outcome.depth ?? depth;
        pushAnalysisResult({ ...outcome, depth: effectiveDepth });
    }
};

depthInput?.addEventListener('change', () => {
    depthInput.value = clampDepth(depthInput.value);
});

depthInput?.addEventListener('blur', () => {
    depthInput.value = clampDepth(depthInput.value);
});

depthInput?.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') {
        evt.preventDefault();
        runLocalAnalysis();
    }
});

localAnalysisBtn?.addEventListener('click', () => runLocalAnalysis());

async function makeMove(fx, fy, tx, ty) { try { await conn.invoke("MakeMove", roomId, fx, fy, tx, ty, null); } catch (e) { shake(fx, fy); } }
async function join(vsBot) {
    roomId = document.getElementById('room').value || "testroom";
    const name = document.getElementById('name').value || "Player";
    const playAs = document.getElementById('side').value || "auto";
    const elo = parseInt(document.getElementById('elo').value || "1000", 10);
    if (conn.state === "Disconnected") await conn.start();
    await conn.invoke("JoinRoom", roomId, name, vsBot, playAs, elo);
}

document.getElementById('join').addEventListener('click', () => join(false));
document.getElementById('join-bot').addEventListener('click', () => join(true));

document.getElementById('save-pgn').addEventListener('click', async () => {
    if (!roomId) { alert("Join a room first"); return; }
    const pgn = await conn.invoke("GetPgn", roomId);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([pgn], { type: 'text/plain' }));
    a.download = `game_${roomId}.pgn`;
    a.click();
});
