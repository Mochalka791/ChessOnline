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
const promotionOverlay = document.getElementById('promotion-overlay');
const promotionChoices = promotionOverlay ? Array.from(promotionOverlay.querySelectorAll('.promotion-choice')) : [];
const promotionCancelBtn = document.getElementById('promotion-cancel');

const PROMOTION_NAMES = {
    queen: 'Dame',
    rook: 'Turm',
    bishop: 'Läufer',
    knight: 'Springer'
};

const PROMOTION_KEY_MAP = {
    q: 'queen', Q: 'queen', '1': 'queen',
    r: 'rook', R: 'rook', '2': 'rook',
    b: 'bishop', B: 'bishop', '3': 'bishop',
    n: 'knight', N: 'knight', '4': 'knight'
};

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
const localMode = !hasSignalR;

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
let promotionResolver = null;
let promotionRejecter = null;

const INITIAL_CLOCK_MS = 5 * 60 * 1000;
const CLOCK_INCREMENT_MS = 2000;
const PIECE_VALUES = {
    pawn: 100,
    knight: 320,
    bishop: 330,
    rook: 500,
    queen: 900,
    king: 20000
};

class LocalGame {
    constructor(initialise = true) {
        this.cells = Array.from({ length: 8 }, () => Array(8).fill(null));
        if (initialise) this.reset();
    }

    reset() {
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                this.cells[x][y] = null;
            }
        }

        const order = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let x = 0; x < 8; x++) {
            this.cells[x][0] = { type: order[x], color: 'black' };
            this.cells[x][1] = { type: 'pawn', color: 'black' };
            this.cells[x][6] = { type: 'pawn', color: 'white' };
            this.cells[x][7] = { type: order[x], color: 'white' };
        }

        this.turn = 'white';
        this.whiteCastleK = true;
        this.whiteCastleQ = true;
        this.blackCastleK = true;
        this.blackCastleQ = true;
        this.enPassant = null;
        this.history = [];
        this.lastMove = null;
        this.whiteMs = INITIAL_CLOCK_MS;
        this.blackMs = INITIAL_CLOCK_MS;
        this.turnStartedAt = Date.now();
        this.gameOverMessage = null;
        this.initialFen = this.toFen();
    }

    clone() {
        const copy = new LocalGame(false);
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const piece = this.cells[x][y];
                copy.cells[x][y] = piece ? { ...piece } : null;
            }
        }
        copy.turn = this.turn;
        copy.whiteCastleK = this.whiteCastleK;
        copy.whiteCastleQ = this.whiteCastleQ;
        copy.blackCastleK = this.blackCastleK;
        copy.blackCastleQ = this.blackCastleQ;
        copy.enPassant = this.enPassant ? { ...this.enPassant } : null;
        copy.whiteMs = this.whiteMs;
        copy.blackMs = this.blackMs;
        copy.turnStartedAt = this.turnStartedAt;
        copy.lastMove = this.lastMove ? { ...this.lastMove } : null;
        copy.history = this.history.map(item => ({ ...item }));
        copy.gameOverMessage = this.gameOverMessage;
        copy.initialFen = this.initialFen;
        return copy;
    }

    inBounds(x, y) {
        return x >= 0 && x < 8 && y >= 0 && y < 8;
    }

    pieceCode(piece) {
        return piece ? `${piece.color === 'white' ? 'w' : 'b'}_${piece.type}` : '.';
    }

    pseudoMovesFor(x, y, piece) {
        const res = [];
        if (!piece) return res;

        if (piece.type === 'pawn') {
            const dir = piece.color === 'white' ? -1 : 1;
            const start = piece.color === 'white' ? 6 : 1;

            let ny = y + dir;
            if (this.inBounds(x, ny) && !this.cells[x][ny]) res.push({ tx: x, ty: ny });
            if (y === start && this.inBounds(x, ny) && !this.cells[x][ny]) {
                const ny2 = y + dir * 2;
                if (this.inBounds(x, ny2) && !this.cells[x][ny2]) res.push({ tx: x, ty: ny2 });
            }

            for (const dx of [-1, 1]) {
                const nx = x + dx;
                ny = y + dir;
                if (!this.inBounds(nx, ny)) continue;
                const target = this.cells[nx][ny];
                if (target && target.color !== piece.color) res.push({ tx: nx, ty: ny });
                if (this.enPassant && this.enPassant.x === nx && this.enPassant.y === ny)
                    res.push({ tx: nx, ty: ny });
            }
        } else if (piece.type === 'knight') {
            const dx = [-2, -2, -1, -1, 1, 1, 2, 2];
            const dy = [-1, 1, -2, 2, -2, 2, -1, 1];
            for (let i = 0; i < 8; i++) {
                const nx = x + dx[i];
                const ny = y + dy[i];
                if (!this.inBounds(nx, ny)) continue;
                const target = this.cells[nx][ny];
                if (!target || target.color !== piece.color) res.push({ tx: nx, ty: ny });
            }
        } else if (piece.type === 'bishop' || piece.type === 'rook' || piece.type === 'queen') {
            const dirs = [];
            if (piece.type === 'bishop' || piece.type === 'queen')
                dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
            if (piece.type === 'rook' || piece.type === 'queen')
                dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);

            for (const [dx, dy] of dirs) {
                let nx = x + dx;
                let ny = y + dy;
                while (this.inBounds(nx, ny)) {
                    const target = this.cells[nx][ny];
                    if (!target) {
                        res.push({ tx: nx, ty: ny });
                        nx += dx;
                        ny += dy;
                    } else {
                        if (target.color !== piece.color) res.push({ tx: nx, ty: ny });
                        break;
                    }
                }
            }
        } else if (piece.type === 'king') {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (!this.inBounds(nx, ny)) continue;
                    const target = this.cells[nx][ny];
                    if (!target || target.color !== piece.color) res.push({ tx: nx, ty: ny });
                }
            }

            if (piece.color === 'white') {
                if (this.whiteCastleK && !this.cells[5][7] && !this.cells[6][7]) res.push({ tx: 6, ty: 7 });
                if (this.whiteCastleQ && !this.cells[3][7] && !this.cells[2][7] && !this.cells[1][7]) res.push({ tx: 2, ty: 7 });
            } else {
                if (this.blackCastleK && !this.cells[5][0] && !this.cells[6][0]) res.push({ tx: 6, ty: 0 });
                if (this.blackCastleQ && !this.cells[3][0] && !this.cells[2][0] && !this.cells[1][0]) res.push({ tx: 2, ty: 0 });
            }
        }

        return res;
    }

    isSquareAttacked(x, y, byColor) {
        const pawnDir = byColor === 'white' ? 1 : -1;
        for (const dx of [-1, 1]) {
            const nx = x + dx;
            const ny = y + pawnDir;
            if (!this.inBounds(nx, ny)) continue;
            const piece = this.cells[nx][ny];
            if (piece && piece.color === byColor && piece.type === 'pawn') return true;
        }

        const kdx = [-2, -2, -1, -1, 1, 1, 2, 2];
        const kdy = [-1, 1, -2, 2, -2, 2, -1, 1];
        for (let i = 0; i < 8; i++) {
            const nx = x + kdx[i];
            const ny = y + kdy[i];
            if (!this.inBounds(nx, ny)) continue;
            const piece = this.cells[nx][ny];
            if (piece && piece.color === byColor && piece.type === 'knight') return true;
        }

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (!this.inBounds(nx, ny)) continue;
                const piece = this.cells[nx][ny];
                if (piece && piece.color === byColor && piece.type === 'king') return true;
            }
        }

        const ray = (dx, dy, ...types) => {
            let nx = x + dx;
            let ny = y + dy;
            while (this.inBounds(nx, ny)) {
                const piece = this.cells[nx][ny];
                if (!piece) { nx += dx; ny += dy; continue; }
                if (piece.color === byColor && types.includes(piece.type)) return true;
                break;
            }
            return false;
        };

        if (ray(1, 0, 'rook', 'queen')) return true;
        if (ray(-1, 0, 'rook', 'queen')) return true;
        if (ray(0, 1, 'rook', 'queen')) return true;
        if (ray(0, -1, 'rook', 'queen')) return true;
        if (ray(1, 1, 'bishop', 'queen')) return true;
        if (ray(1, -1, 'bishop', 'queen')) return true;
        if (ray(-1, 1, 'bishop', 'queen')) return true;
        if (ray(-1, -1, 'bishop', 'queen')) return true;

        return false;
    }

    findKing(color) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const piece = this.cells[x][y];
                if (piece && piece.type === 'king' && piece.color === color)
                    return { x, y };
            }
        }
        return { x: -1, y: -1 };
    }

    isInCheck(color) {
        const { x, y } = this.findKing(color);
        if (x < 0) return true;
        const opp = color === 'white' ? 'black' : 'white';
        return this.isSquareAttacked(x, y, opp);
    }

    allLegalMoves(color) {
        const moves = [];
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const piece = this.cells[x][y];
                if (!piece || piece.color !== color) continue;
                const pseudo = this.pseudoMovesFor(x, y, piece);
                for (const mv of pseudo) {
                    if (this.tryMove(x, y, mv.tx, mv.ty, null, true).ok)
                        moves.push({ fx: x, fy: y, tx: mv.tx, ty: mv.ty });
                }
            }
        }
        return moves;
    }

    hasAnyLegalMoves(color) {
        return this.allLegalMoves(color).length > 0;
    }

    saveBasicState() {
        const cells = Array.from({ length: 8 }, (_, x) => Array.from({ length: 8 }, (_, y) => {
            const piece = this.cells[x][y];
            return piece ? { ...piece } : null;
        }));
        return {
            cells,
            turn: this.turn,
            whiteCastleK: this.whiteCastleK,
            whiteCastleQ: this.whiteCastleQ,
            blackCastleK: this.blackCastleK,
            blackCastleQ: this.blackCastleQ,
            enPassant: this.enPassant ? { ...this.enPassant } : null,
        };
    }

    restoreBasicState(snapshot) {
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const piece = snapshot.cells[x][y];
                this.cells[x][y] = piece ? { ...piece } : null;
            }
        }
        this.turn = snapshot.turn;
        this.whiteCastleK = snapshot.whiteCastleK;
        this.whiteCastleQ = snapshot.whiteCastleQ;
        this.blackCastleK = snapshot.blackCastleK;
        this.blackCastleQ = snapshot.blackCastleQ;
        this.enPassant = snapshot.enPassant ? { ...snapshot.enPassant } : null;
    }

    tryMove(fx, fy, tx, ty, promoteTo, simulate = false) {
        if (!this.inBounds(fx, fy) || !this.inBounds(tx, ty)) return { ok: false, error: 'Out of board' };
        const piece = this.cells[fx][fy];
        if (!piece) return { ok: false, error: 'No piece' };
        if (!simulate && piece.color !== this.turn) return { ok: false, error: 'Not your turn' };

        const target = this.cells[tx][ty];
        const isCastle = piece.type === 'king' && Math.abs(tx - fx) === 2;

        const pseudo = this.pseudoMovesFor(fx, fy, piece);
        if (!pseudo.some(mv => mv.tx === tx && mv.ty === ty))
            return { ok: false, error: 'Illegal move' };
        if (target && target.type === 'king')
            return { ok: false, error: 'King cannot be captured' };

        const snapshot = this.saveBasicState();

        if (piece.type === 'pawn' && tx !== fx && !target && this.enPassant && this.enPassant.x === tx && this.enPassant.y === ty) {
            const dy = piece.color === 'white' ? 1 : -1;
            this.cells[tx][ty + dy] = null;
        }

        if (isCastle) {
            if (piece.color === 'white') {
                if (fx === 4 && fy === 7 && tx === 6) {
                    if (!this.whiteCastleK || this.isInCheck('white') || this.isSquareAttacked(5, 7, 'black') || this.isSquareAttacked(6, 7, 'black')) {
                        this.restoreBasicState(snapshot);
                        return { ok: false, error: 'Castling not allowed' };
                    }
                    this.cells[5][7] = this.cells[7][7];
                    this.cells[7][7] = null;
                } else if (fx === 4 && fy === 7 && tx === 2) {
                    if (!this.whiteCastleQ || this.isInCheck('white') || this.isSquareAttacked(3, 7, 'black') || this.isSquareAttacked(2, 7, 'black')) {
                        this.restoreBasicState(snapshot);
                        return { ok: false, error: 'Castling not allowed' };
                    }
                    this.cells[3][7] = this.cells[0][7];
                    this.cells[0][7] = null;
                }
            } else {
                if (fx === 4 && fy === 0 && tx === 6) {
                    if (!this.blackCastleK || this.isInCheck('black') || this.isSquareAttacked(5, 0, 'white') || this.isSquareAttacked(6, 0, 'white')) {
                        this.restoreBasicState(snapshot);
                        return { ok: false, error: 'Castling not allowed' };
                    }
                    this.cells[5][0] = this.cells[7][0];
                    this.cells[7][0] = null;
                } else if (fx === 4 && fy === 0 && tx === 2) {
                    if (!this.blackCastleQ || this.isInCheck('black') || this.isSquareAttacked(3, 0, 'white') || this.isSquareAttacked(2, 0, 'white')) {
                        this.restoreBasicState(snapshot);
                        return { ok: false, error: 'Castling not allowed' };
                    }
                    this.cells[3][0] = this.cells[0][0];
                    this.cells[0][0] = null;
                }
            }
        }

        this.cells[tx][ty] = piece;
        this.cells[fx][fy] = null;

        if (piece.type === 'pawn' && (ty === 0 || ty === 7)) {
            const choice = (promoteTo || 'queen').toLowerCase();
            const type = choice === 'rook' ? 'rook'
                : choice === 'bishop' ? 'bishop'
                : choice === 'knight' ? 'knight'
                : 'queen';
            this.cells[tx][ty] = { type, color: piece.color };
        }

        if (piece.type === 'king') {
            if (piece.color === 'white') { this.whiteCastleK = false; this.whiteCastleQ = false; }
            else { this.blackCastleK = false; this.blackCastleQ = false; }
        }

        if (piece.type === 'rook') {
            if (piece.color === 'white') {
                if (fx === 7 && fy === 7) this.whiteCastleK = false;
                if (fx === 0 && fy === 7) this.whiteCastleQ = false;
            } else {
                if (fx === 7 && fy === 0) this.blackCastleK = false;
                if (fx === 0 && fy === 0) this.blackCastleQ = false;
            }
        }

        if (tx === 7 && ty === 7) this.whiteCastleK = false;
        if (tx === 0 && ty === 7) this.whiteCastleQ = false;
        if (tx === 7 && ty === 0) this.blackCastleK = false;
        if (tx === 0 && ty === 0) this.blackCastleQ = false;

        if (piece.type === 'pawn' && Math.abs(ty - fy) === 2) {
            const midY = (ty + fy) / 2;
            this.enPassant = { x: tx, y: midY };
        } else {
            this.enPassant = null;
        }

        if (this.isInCheck(piece.color)) {
            this.restoreBasicState(snapshot);
            return { ok: false, error: 'Move leaves king in check' };
        }

        if (simulate) {
            this.restoreBasicState(snapshot);
            return { ok: true };
        }

        this.turn = this.turn === 'white' ? 'black' : 'white';
        return { ok: true };
    }

    applyClockOnMove(color) {
        const now = Date.now();
        const spent = this.turnStartedAt ? now - this.turnStartedAt : 0;
        if (color === 'white') {
            this.whiteMs = Math.max(0, this.whiteMs - spent + CLOCK_INCREMENT_MS);
        } else {
            this.blackMs = Math.max(0, this.blackMs - spent + CLOCK_INCREMENT_MS);
        }
        this.turnStartedAt = now;
    }

    currentTimes() {
        const now = Date.now();
        let white = this.whiteMs;
        let black = this.blackMs;
        if (this.turn === 'white') white = Math.max(0, white - (now - this.turnStartedAt));
        else black = Math.max(0, black - (now - this.turnStartedAt));
        return { white, black };
    }

    squareName(x, y) {
        return `${String.fromCharCode('a'.charCodeAt(0) + x)}${8 - y}`;
    }

    notationFor(positionBefore, fx, fy, tx, ty, moved, finalPiece, isCapture, isMate, isCheck, promoteTo) {
        if (moved.type === 'king' && Math.abs(tx - fx) === 2) return tx > fx ? 'O-O' : 'O-O-O';

        const target = this.squareName(tx, ty);

        if (moved.type === 'pawn') {
            let san = isCapture ? `${String.fromCharCode('a'.charCodeAt(0) + fx)}x${target}` : target;
            if (ty === 0 || ty === 7) {
                const promoted = promoteTo || finalPiece.type;
                const letter = promoted === 'rook' ? 'R'
                    : promoted === 'bishop' ? 'B'
                    : promoted === 'knight' ? 'N'
                    : 'Q';
                san += `=${letter}`;
            }
            if (isMate) san += '#';
            else if (isCheck) san += '+';
            return san;
        }

        const pieceLetter = moved.type === 'knight' ? 'N'
            : moved.type === 'bishop' ? 'B'
            : moved.type === 'rook' ? 'R'
            : moved.type === 'queen' ? 'Q'
            : moved.type === 'king' ? 'K'
            : '';

        let disambiguation = '';
        const candidates = [];
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                if (x === fx && y === fy) continue;
                const candidate = positionBefore.cells[x][y];
                if (!candidate || candidate.type !== moved.type || candidate.color !== moved.color) continue;
                if (!positionBefore.tryMove(x, y, tx, ty, null, true).ok) continue;
                candidates.push({ x, y });
            }
        }

        if (candidates.length > 0) {
            const sameFile = candidates.some(c => c.x === fx);
            const sameRank = candidates.some(c => c.y === fy);
            if (!sameFile) disambiguation = String.fromCharCode('a'.charCodeAt(0) + fx);
            else if (!sameRank) disambiguation = String(8 - fy);
            else disambiguation = `${String.fromCharCode('a'.charCodeAt(0) + fx)}${8 - fy}`;
        }

        const capturePart = isCapture ? 'x' : '';
        let result = `${pieceLetter}${disambiguation}${capturePart}${target}`;
        if (isMate) result += '#';
        else if (isCheck) result += '+';
        return result;
    }

    score(pov) {
        let sum = 0;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const piece = this.cells[x][y];
                if (!piece) continue;
                const value = PIECE_VALUES[piece.type];
                sum += piece.color === pov ? value : -value;
            }
        }
        return sum;
    }

    buildUciMove(fx, fy, tx, ty, promoteTo, moved) {
        let uci = `${this.squareName(fx, fy)}${this.squareName(tx, ty)}`;
        const promo = (promoteTo || (moved.type === 'pawn' && (ty === 0 || ty === 7) ? 'queen' : null));
        if (promo) {
            const letter = promo === 'rook' ? 'r'
                : promo === 'bishop' ? 'b'
                : promo === 'knight' ? 'n'
                : 'q';
            uci += letter;
        }
        return uci;
    }

    makeMove(fx, fy, tx, ty, promoteTo) {
        if (this.gameOverMessage) return { ok: false, error: this.gameOverMessage };
        const piece = this.cells[fx]?.[fy];
        if (!piece) return { ok: false, error: 'No piece' };
        if (piece.color !== this.turn) return { ok: false, error: 'Not your turn' };

        const target = this.cells[tx]?.[ty] ?? null;
        const enPassantCapture = piece.type === 'pawn' && tx !== fx && !target && this.enPassant && this.enPassant.x === tx && this.enPassant.y === ty;
        const isCapture = !!target || enPassantCapture;

        const positionBefore = this.clone();
        const movedSnapshot = { ...piece };
        const result = this.tryMove(fx, fy, tx, ty, promoteTo);
        if (!result.ok) return result;

        this.applyClockOnMove(movedSnapshot.color);

        const finalPiece = this.cells[tx][ty];
        const opp = this.turn;
        const isCheck = this.isInCheck(opp);
        const isMate = isCheck && !this.hasAnyLegalMoves(opp);
        const san = this.notationFor(positionBefore, fx, fy, tx, ty, movedSnapshot, finalPiece, isCapture, isMate, isCheck, promoteTo);
        const uci = this.buildUciMove(fx, fy, tx, ty, promoteTo, movedSnapshot);
        const evalAfter = this.score(movedSnapshot.color);
        const fen = this.toFen();

        this.lastMove = { fx, fy, tx, ty };
        this.history.push({ fx, fy, tx, ty, san, uci, eval: evalAfter, fen });
        this.gameOverMessage = this.computeGameOverMessage();

        return { ok: true, san, isCheck, isMate };
    }

    computeGameOverMessage() {
        const toMove = this.turn;
        if (this.hasAnyLegalMoves(toMove)) return null;
        if (this.isInCheck(toMove))
            return toMove === 'white' ? 'Schachmatt – Schwarz gewinnt' : 'Schachmatt – Weiß gewinnt';
        return 'Patt – Remis';
    }

    getGameOverMessage() {
        return this.gameOverMessage;
    }

    toMatrix() {
        const matrix = Array.from({ length: 8 }, () => Array(8).fill('.'));
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                matrix[x][y] = this.pieceCode(this.cells[x][y]);
            }
        }
        return matrix;
    }

    exportState() {
        const matrix = this.toMatrix();
        const { white, black } = this.currentTimes();
        const wKing = this.findKing('white');
        const bKing = this.findKing('black');
        return {
            board: matrix,
            turn: this.turn,
            whiteMs: white,
            blackMs: black,
            lastMove: this.lastMove,
            check: {
                white: this.isInCheck('white'),
                black: this.isInCheck('black'),
                wKing,
                bKing
            },
            serverTimeMs: Date.now()
        };
    }

    exportHistory() {
        const list = [];
        list.push({
            ply: 0,
            moveNumber: 0,
            side: 'none',
            san: 'Startstellung',
            uci: '',
            eval: 0,
            fen: this.initialFen
        });

        for (let i = 0; i < this.history.length; i++) {
            const item = this.history[i];
            list.push({
                ply: i + 1,
                moveNumber: Math.floor(i / 2) + 1,
                side: i % 2 === 0 ? 'white' : 'black',
                san: item.san,
                uci: item.uci,
                eval: item.eval,
                fen: item.fen
            });
        }
        return list;
    }

    exportPlayers(name) {
        const base = name || 'Spieler';
        return { white: `${base} (Weiß)`, black: `${base} (Schwarz)` };
    }

    getLegalMoves(x, y) {
        if (!this.inBounds(x, y)) return [];
        const piece = this.cells[x][y];
        if (!piece || piece.color !== this.turn) return [];
        const moves = [];
        const pseudo = this.pseudoMovesFor(x, y, piece);
        for (const mv of pseudo) {
            const res = this.tryMove(x, y, mv.tx, mv.ty, null, true);
            if (!res.ok) continue;
            const target = this.cells[mv.tx][mv.ty];
            let isCapture = !!target;
            if (!isCapture && piece.type === 'pawn' && mv.tx !== x) {
                if (this.enPassant && this.enPassant.x === mv.tx && this.enPassant.y === mv.ty) isCapture = true;
            }
            const isPromotion = piece.type === 'pawn' && (mv.ty === 0 || mv.ty === 7);
            const isCastle = piece.type === 'king' && Math.abs(mv.tx - x) === 2;
            moves.push({ tx: mv.tx, ty: mv.ty, capture: isCapture, promotion: isPromotion, castle: isCastle });
        }
        return moves;
    }

    toFen() {
        let fen = '';
        for (let y = 0; y < 8; y++) {
            let empty = 0;
            for (let x = 0; x < 8; x++) {
                const piece = this.cells[x][y];
                if (!piece) {
                    empty++;
                    continue;
                }
                if (empty > 0) {
                    fen += empty;
                    empty = 0;
                }
                const letter = piece.type === 'pawn' ? 'p'
                    : piece.type === 'knight' ? 'n'
                    : piece.type === 'bishop' ? 'b'
                    : piece.type === 'rook' ? 'r'
                    : piece.type === 'queen' ? 'q'
                    : 'k';
                fen += piece.color === 'white' ? letter.toUpperCase() : letter;
            }
            if (empty > 0) fen += empty;
            if (y < 7) fen += '/';
        }

        const castle = [];
        if (this.whiteCastleK) castle.push('K');
        if (this.whiteCastleQ) castle.push('Q');
        if (this.blackCastleK) castle.push('k');
        if (this.blackCastleQ) castle.push('q');

        const ep = this.enPassant ? this.squareName(this.enPassant.x, this.enPassant.y) : '-';

        fen += ` ${this.turn === 'white' ? 'w' : 'b'} ${castle.length ? castle.join('') : '-'} ${ep} 0 1`;
        return fen;
    }

    getFen() {
        return this.toFen();
    }

    getPgn(eventName = 'Casual', site = 'Offline') {
        const lines = [];
        lines.push(`[Event "${eventName}"]`);
        lines.push(`[Site "${site}"]`);
        lines.push('[White "Spieler (Weiß)"]');
        lines.push('[Black "Spieler (Schwarz)"]');
        const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
        lines.push(`[Date "${dateTag}"]`);
        let body = '';
        for (let i = 0; i < this.history.length; i += 2) {
            const n = i / 2 + 1;
            body += `${n}. ${this.history[i].san} `;
            if (i + 1 < this.history.length) body += `${this.history[i + 1].san} `;
        }
        lines.push(body.trim() + ' *');
        return lines.join('\n');
    }

    exportUciMoveList(take = Number.MAX_SAFE_INTEGER) {
        return this.history.slice(0, take).map(item => item.uci).join(' ');
    }
}

let localGame = localMode ? new LocalGame() : null;

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

function closePromotionDialog() {
    if (!promotionOverlay) return;
    promotionOverlay.hidden = true;
    promotionOverlay.dataset.color = '';
}

function resolvePromotion(piece) {
    if (!promotionResolver) return;
    const resolver = promotionResolver;
    promotionResolver = null;
    promotionRejecter = null;
    closePromotionDialog();
    resolver(piece);
}

function cancelPromotionDialog() {
    if (!promotionOverlay || promotionOverlay.hidden) return;
    closePromotionDialog();
    if (promotionRejecter) {
        const rejecter = promotionRejecter;
        promotionResolver = null;
        promotionRejecter = null;
        rejecter(new Error('Promotion cancelled'));
    }
}

function promptPromotion(color) {
    if (!promotionOverlay) return Promise.resolve('queen');

    if (promotionResolver || promotionRejecter) {
        promotionResolver = null;
        promotionRejecter?.(new Error('Promotion interrupted'));
        promotionRejecter = null;
    }

    const prefix = color === 'black' ? 'b' : 'w';
    promotionOverlay.hidden = false;
    promotionOverlay.dataset.color = color;

    for (const choice of promotionChoices) {
        const piece = choice.dataset.piece;
        const img = choice.querySelector('img');
        if (!piece || !img) continue;
        const code = `${prefix}_${piece}`;
        const src = pieceSrc(code);
        if (src) img.src = src;
        img.alt = `${color === 'black' ? 'Schwarzer' : 'Weißer'} ${PROMOTION_NAMES[piece] ?? piece}`;
    }

    setTimeout(() => promotionChoices[0]?.focus(), 0);

    return new Promise((resolve, reject) => {
        promotionResolver = resolve;
        promotionRejecter = reject;
    });
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
    if (localMode) {
        return Promise.resolve();
    }
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

async function onCellDrop(evt, x, y) {
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
        const moved = await performMove(fx, fy, x, y, move);
        if (!moved) {
            const idx = fy * 8 + fx;
            boardCells[idx]?.classList.add('selected');
        }
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
    if (roomId === 'local' || mySeat === 'local') {
        if (state.turn === 'white') return isWhitePiece;
        return !isWhitePiece;
    }
    if (mySeat === 'spectator') return false;
    if (state.turn === 'white' && mySeat === 'white') return isWhitePiece;
    if (state.turn === 'black' && mySeat === 'black') return !isWhitePiece;
    return false;
}

async function onCellClick(x, y) {
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
            await performMove(selected.x, selected.y, x, y, target);
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
    const requestKey = `${x},${y}`;
    if (roomId === 'local' && localGame) {
        const moves = localGame.getLegalMoves(x, y);
        const currentKey = selected ? `${selected.x},${selected.y}` : null;
        if (currentKey && currentKey !== requestKey) return;
        legalMoves = Array.isArray(moves) ? moves : [];
        drawMoveHints(legalMoves);
        return;
    }
    if (!roomId) return;
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

function getLocalPlayerName() {
    const nameInput = document.getElementById('name');
    return nameInput?.value?.trim() || 'Spieler';
}

function syncLocalState(options = {}) {
    if (!localGame) return;
    const st = localGame.exportState();
    state = st;
    whiteBase = st.whiteMs;
    blackBase = st.blackMs;
    serverStamp = Date.now();
    preview = null;
    cancelPromotionDialog();
    if (boardBadge) {
        if (boardBadge.dataset.locked === 'true') {
            delete boardBadge.dataset.locked;
        }
        boardBadge.hidden = true;
    }
    renderLiveBoard();
    startClockTicking();
    renderHistory(localGame.exportHistory());
    renderPlayers(localGame.exportPlayers(getLocalPlayerName()));

    const message = localGame.getGameOverMessage();
    if (message) {
        if (boardBadge) {
            boardBadge.hidden = false;
            boardBadge.textContent = message;
            boardBadge.dataset.locked = 'true';
        }
        if (!options.silentGameOver) {
            showToast(message, 'info', 6000);
            logStatus(`Partie beendet: ${message}`);
        }
    }
}

function startLocalSession(options = {}) {
    if (!localGame) localGame = new LocalGame();
    if (options.reset !== false) localGame.reset();
    roomId = 'local';
    mySeat = 'local';
    lastJoinRequest = null;
    preview = null;
    legalMoves = [];
    drawMoveHints([]);
    if (boardBadge) {
        boardBadge.hidden = true;
        delete boardBadge.dataset.locked;
    }
    syncLocalState({ silentGameOver: true });
    resetAnalysis();
    setStatusBanner('status-ready', 'Offline-Modus');
    if (!options.silent) {
        showToast('Offline-Partie gestartet. Du spielst beide Seiten nacheinander.', 'success');
        logStatus('Lokale Partie gestartet.');
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

async function performMove(fx, fy, tx, ty, moveMeta) {
    let promotion = null;
    if (moveMeta?.promotion) {
        const code = boardMatrix[fx]?.[fy] ?? '.';
        const color = code.startsWith('b_') ? 'black' : 'white';
        try {
            promotion = await promptPromotion(color);
        } catch {
            drawMoveHints(legalMoves);
            return false;
        }
    }

    const ok = await makeMove(fx, fy, tx, ty, promotion);
    if (!ok) {
        drawMoveHints(legalMoves);
        return false;
    }

    clearSelection();
    return true;
}

async function makeMove(fx, fy, tx, ty, promotion = null) {
    if (roomId === 'local' && localGame) {
        const res = localGame.makeMove(fx, fy, tx, ty, promotion);
        if (!res.ok) {
            const idx = fy * 8 + fx;
            boardCells[idx]?.classList.add('invalid');
            setTimeout(() => boardCells[idx]?.classList.remove('invalid'), 500);
            if (res.error) showToast(`Zug nicht möglich: ${res.error}`, 'error');
            return false;
        }
        syncLocalState({ silentGameOver: false });
        return true;
    }
    if (!roomId) return false;
    try {
        await conn.invoke('MakeMove', roomId, fx, fy, tx, ty, promotion);
        return true;
    } catch (err) {
        const idx = fy * 8 + fx;
        boardCells[idx]?.classList.add('invalid');
        setTimeout(() => boardCells[idx]?.classList.remove('invalid'), 500);
        const message = err instanceof Error ? err.message : String(err);
        showToast(`Zug fehlgeschlagen: ${message}`, 'error');
        return false;
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

    if (localMode) {
        if (vsBot) {
            showToast('Offline-Bot noch nicht verfügbar – du spielst beide Seiten.', 'info');
        }
        startLocalSession({ silent: false, reset: true });
        return;
    }

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
    if (roomId === 'local') {
        showToast('Analyse im Offline-Modus ist noch nicht verfügbar.', 'info');
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
    cancelPromotionDialog();
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
    cancelPromotionDialog();
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

if (promotionOverlay) {
    promotionOverlay.addEventListener('click', (evt) => {
        if (evt.target === promotionOverlay) {
            evt.preventDefault();
            cancelPromotionDialog();
        }
    });
}

for (const choice of promotionChoices) {
    choice.addEventListener('click', (evt) => {
        evt.preventDefault();
        const piece = choice.dataset.piece ?? 'queen';
        resolvePromotion(piece);
    });
}

promotionCancelBtn?.addEventListener('click', (evt) => {
    evt.preventDefault();
    cancelPromotionDialog();
});

document.getElementById('join-bot')?.addEventListener('click', () => joinGame(true));
document.getElementById('join')?.addEventListener('click', () => joinGame(false));

document.getElementById('copy-pgn')?.addEventListener('click', () => {
    if (!roomId) {
        showToast('Bitte zuerst einem Raum beitreten.', 'info');
        return;
    }
    if (roomId === 'local' && localGame) {
        copyText(() => localGame.getPgn(), 'PGN');
        return;
    }
    copyText(() => conn.invoke('GetPgn', roomId), 'PGN');
});

document.getElementById('copy-fen')?.addEventListener('click', () => {
    if (!roomId) {
        showToast('Bitte zuerst einem Raum beitreten.', 'info');
        return;
    }
    if (roomId === 'local' && localGame) {
        copyText(() => localGame.getFen(), 'FEN');
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

if (localMode) {
    const nameField = document.getElementById('name');
    nameField?.addEventListener('input', () => {
        if (roomId === 'local' && localGame) {
            renderPlayers(localGame.exportPlayers(getLocalPlayerName()));
        }
    });

    const joinBtn = document.getElementById('join');
    if (joinBtn) joinBtn.textContent = 'Neue Partie (Offline)';
    const botBtn = document.getElementById('join-bot');
    if (botBtn) botBtn.textContent = 'Offline spielen (beide Seiten)';
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
    if (!evt) return;

    if (promotionOverlay && !promotionOverlay.hidden) {
        if (evt.key === 'Escape') {
            evt.preventDefault();
            cancelPromotionDialog();
            return;
        }
        const mapped = PROMOTION_KEY_MAP[evt.key];
        if (mapped) {
            evt.preventDefault();
            resolvePromotion(mapped);
        }
        return;
    }

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
        if (roomId === 'local' && localGame) {
            copyText(() => localGame.getPgn(), 'PGN');
        } else {
            copyText(() => conn.invoke('GetPgn', roomId), 'PGN');
        }
    } else if (evt.key === 'u' || evt.key === 'U') {
        evt.preventDefault();
        document.getElementById('request-undo')?.click();
    }
});

if (!hasSignalR) {
    logStatus('SignalR-Bibliothek konnte nicht geladen werden. Online-Modus deaktiviert.');
    showToast('Live-Verbindung nicht verfügbar – Online-Funktionen sind eingeschränkt.', 'warning');
    startLocalSession({ silent: true, reset: true });
} else {
    setStatusBanner('status-ready', 'Bereit');
    renderHistory([]);
    resetAnalysis();
    const previewGame = new LocalGame();
    const previewState = previewGame.exportState();
    state = previewState;
    whiteBase = previewState.whiteMs;
    blackBase = previewState.blackMs;
    serverStamp = Date.now();
    renderBoard(previewState.board, { preview: true });
    updateTurnLabel(previewState.turn);
    startClockTicking();
    renderPlayers({ white: 'Weiß', black: 'Schwarz' });
}
