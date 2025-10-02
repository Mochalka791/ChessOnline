const boardEl = document.getElementById('board');
const cellTpl = document.getElementById('cell-tpl');
const turnEl = document.getElementById('turn');
const playersEl = document.getElementById('players');
const clocksEl = document.getElementById('clocks');
const movesEl = document.getElementById('moves');
const analysisEl = document.getElementById('analysis');

const conn = new signalR.HubConnectionBuilder()
    .withUrl("/chess")
    .withAutomaticReconnect()
    .build();

let state = null, prev = null, mySeat = "spectator", roomId = null, lastAttempt = null;
let clockTimer = null; let whiteBase = 0, blackBase = 0, serverStamp = 0;

const UNI = {
    "w_pawn": "♙", "w_rook": "♖", "w_knight": "♘", "w_bishop": "♗", "w_queen": "♕", "w_king": "♔",
    "b_pawn": "♟", "b_rook": "♜", "b_knight": "♞", "b_bishop": "♝", "b_queen": "♛", "b_king": "♚",
};
const chessChar = c => UNI[c] || "";
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
            const label = cell.querySelector('.label');

            const src = pieceSrc(code);
            if (src) {
                img.src = src; img.style.display = 'block'; label.textContent = '';
                img.onerror = () => { img.style.display = 'none'; label.textContent = chessChar(code); };
            } else { img.style.display = 'none'; label.textContent = chessChar(code); }

            if (last) {
                if (last.fx === x && last.fy === y) cell.classList.add('last-from');
                if (last.tx === x && last.ty === y) cell.classList.add('last-to');
            }

            if (state.check?.white && x === state.check.wKing.x && y === state.check.wKing.y) cell.classList.add('check');
            if (state.check?.black && x === state.check.bKing.x && y === state.check.bKing.y) cell.classList.add('check');

            const can = canDrag(code);
            img.draggable = can; label.draggable = can;
            const onDragStart = e => e.dataTransfer.setData("text/plain", JSON.stringify({ fx: x, fy: y }));
            img.addEventListener('dragstart', onDragStart);
            label.addEventListener('dragstart', onDragStart);

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
    whiteBase = state.whiteMs; blackBase = state.blackMs; serverStamp = Date.now();
    if (clockTimer) clearInterval(clockTimer);
    drawClocks(); clockTimer = setInterval(drawClocks, 250);
}

// Hub callbacks
conn.on("Init", (st, seat) => { prev = null; state = st; mySeat = seat; drawBoard(false); });
conn.on("State", (st) => { prev = state; state = st; drawBoard(true); });
conn.on("History", (items) => { movesEl.innerHTML = ""; for (const it of items) { const li = document.createElement('li'); li.textContent = it; movesEl.appendChild(li); } });
conn.on("Players", (p) => { playersEl.textContent = `White: ${p.white} | Black: ${p.black}`; });
conn.on("MoveResult", (ok, err) => { if (!ok && lastAttempt) { shake(lastAttempt.fx, lastAttempt.fy); } });
conn.on("GameOver", (msg, analysis) => {
    const over = document.getElementById('over');
    document.getElementById('over-title').textContent = msg;
    document.getElementById('over-body').innerHTML = analysis ? `
    <div><b>Moves:</b> ${analysis.moves}</div>
    <div><b>White:</b> ACPL ${analysis.white.acpl} → ELO ${analysis.white.estElo}</div>
    <div><b>Black:</b> ACPL ${analysis.black.acpl} → ELO ${analysis.black.estElo}</div>
  ` : '';
    over.style.display = 'flex';
});

document.getElementById('over-close').onclick = () => (document.getElementById('over').style.display = 'none');
document.getElementById('over-rematch').onclick = async () => {
    document.getElementById('over').style.display = 'none';
    await join(true);
};

// === ИСПРАВЛЕНО: запрос к бэку и вывод ошибок ===
document.getElementById('over-ai').onclick = async () => {
    if (!roomId) return;
    let html = "";
    try {
        const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, model: 'gpt-4o-mini' })
        });
        const j = await res.json();
        if (j.ok) {
            html = `<pre style="white-space:pre-wrap;margin-top:.5rem">${j.text}</pre>`;
        } else {
            html = `<div style="color:#f99;margin-top:.5rem">AI error: ${j.error ?? 'Unknown error'}</div>`;
        }
    } catch (e) {
        html = `<div style="color:#f99;margin-top:.5rem">AI error: ${e.message}</div>`;
    }
    document.getElementById('over-body').insertAdjacentHTML('beforeend', html);
};

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
