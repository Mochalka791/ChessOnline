const COLS = 10;
const ROWS = 20;
const PREVIEW_SIZE = 4;
const SCORE_TABLE = [0, 100, 300, 500, 800];
const COLORS = {
    I: 'var(--tetris-cyan)',
    J: 'var(--tetris-blue)',
    L: 'var(--tetris-orange)',
    O: 'var(--tetris-yellow)',
    S: 'var(--tetris-green)',
    T: 'var(--tetris-purple)',
    Z: 'var(--tetris-red)'
};

const PIECES = {
    I: [
        [[0, 1], [1, 1], [2, 1], [3, 1]],
        [[2, 0], [2, 1], [2, 2], [2, 3]],
        [[0, 2], [1, 2], [2, 2], [3, 2]],
        [[1, 0], [1, 1], [1, 2], [1, 3]]
    ],
    J: [
        [[0, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [2, 2]],
        [[1, 0], [1, 1], [0, 2], [1, 2]]
    ],
    L: [
        [[2, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [1, 2], [2, 2]],
        [[0, 1], [1, 1], [2, 1], [0, 2]],
        [[0, 0], [1, 0], [1, 1], [1, 2]]
    ],
    O: [
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]]
    ],
    S: [
        [[1, 0], [2, 0], [0, 1], [1, 1]],
        [[1, 0], [1, 1], [2, 1], [2, 2]],
        [[1, 1], [2, 1], [0, 2], [1, 2]],
        [[0, 0], [0, 1], [1, 1], [1, 2]]
    ],
    T: [
        [[1, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [1, 2]],
        [[1, 0], [0, 1], [1, 1], [1, 2]]
    ],
    Z: [
        [[0, 0], [1, 0], [1, 1], [2, 1]],
        [[2, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [1, 2], [2, 2]],
        [[1, 0], [0, 1], [1, 1], [0, 2]]
    ]
};

const KICK_TESTS = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 2, y: 0 },
    { x: -2, y: 0 }
];

function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

class Bag {
    constructor() {
        this.queue = [];
    }

    next() {
        if (this.queue.length < 7) {
            const bag = shuffle(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
            this.queue.push(...bag);
        }
        return this.queue.shift();
    }

    peek(count = 3) {
        while (this.queue.length < count) {
            const bag = shuffle(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
            this.queue.push(...bag);
        }
        return this.queue.slice(0, count);
    }
}

class Tetris {
    constructor() {
        this.board = createBoard();
        this.bag = new Bag();
        this.active = null;
        this.level = 1;
        this.score = 0;
        this.lines = 0;
        this.dropCounter = 0;
        this.lastTime = 0;
        this.softDrop = false;
        this.running = false;
        this.paused = false;
        this.gameOver = false;
    }

    reset() {
        this.board = createBoard();
        this.bag = new Bag();
        this.active = null;
        this.level = 1;
        this.score = 0;
        this.lines = 0;
        this.dropCounter = 0;
        this.lastTime = 0;
        this.softDrop = false;
        this.running = true;
        this.paused = false;
        this.gameOver = false;
        this.spawnPiece();
    }

    spawnPiece() {
        const type = this.bag.next();
        const rotations = PIECES[type];
        this.active = {
            type,
            rotation: 0,
            x: 3,
            y: -2,
            rotations,
            color: COLORS[type]
        };
        if (!this.isValidPosition(this.active.x, this.active.y, this.active.rotation)) {
            this.gameOver = true;
            this.running = false;
            this.softDrop = false;
        }
    }

    speed() {
        const base = Math.max(1100 - (this.level - 1) * 90, 140);
        return this.softDrop ? 60 : base;
    }

    update(time) {
        if (!this.running) {
            return;
        }
        if (this.lastTime === 0) {
            this.lastTime = time;
        }
        const delta = time - this.lastTime;
        this.lastTime = time;

        if (!this.paused && !this.gameOver) {
            this.dropCounter += delta;
            const interval = this.speed();
            if (this.dropCounter >= interval) {
                this.dropCounter = 0;
                this.stepDown();
            }
        }
    }

    hardDrop() {
        if (!this.active || this.paused || this.gameOver) {
            return;
        }
        let distance = 0;
        while (this.move(0, 1)) {
            distance += 1;
        }
        this.score += distance * 2;
        this.lockPiece();
    }

    stepDown() {
        if (!this.move(0, 1)) {
            this.lockPiece();
        }
    }

    move(dx, dy) {
        if (!this.active || this.paused || this.gameOver) {
            return false;
        }
        const { x, y, rotation } = this.active;
        if (this.isValidPosition(x + dx, y + dy, rotation)) {
            this.active.x += dx;
            this.active.y += dy;
            return true;
        }
        return false;
    }

    rotate(dir) {
        if (!this.active || this.paused || this.gameOver) {
            return;
        }
        const nextRotation = (this.active.rotation + dir + this.active.rotations.length) % this.active.rotations.length;
        for (const kick of KICK_TESTS) {
            const nx = this.active.x + kick.x * Math.sign(dir || 1);
            const ny = this.active.y + kick.y;
            if (this.isValidPosition(nx, ny, nextRotation)) {
                this.active.x = nx;
                this.active.y = ny;
                this.active.rotation = nextRotation;
                return;
            }
        }
    }

    isValidPosition(x, y, rotation) {
        const cells = this.active.rotations[rotation];
        for (const [cx, cy] of cells) {
            const px = x + cx;
            const py = y + cy;
            if (px < 0 || px >= COLS || py >= ROWS) {
                return false;
            }
            if (py >= 0 && this.board[py][px]) {
                return false;
            }
        }
        return true;
    }

    lockPiece() {
        if (!this.active) {
            return;
        }
        for (const [cx, cy] of this.active.rotations[this.active.rotation]) {
            const px = this.active.x + cx;
            const py = this.active.y + cy;
            if (py >= 0 && px >= 0 && px < COLS && py < ROWS) {
                this.board[py][px] = {
                    type: this.active.type,
                    color: this.active.color
                };
            }
        }
        this.clearLines();
        this.dropCounter = 0;
        this.spawnPiece();
    }

    clearLines() {
        let cleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(COLS).fill(null));
                cleared += 1;
                y += 1;
            }
        }
        if (cleared > 0) {
            this.lines += cleared;
            const gained = SCORE_TABLE[cleared] * this.level;
            this.score += gained;
            const nextLevel = Math.floor(this.lines / 10) + 1;
            if (nextLevel > this.level) {
                this.level = nextLevel;
            }
        }
    }

    togglePause() {
        if (!this.running) {
            return;
        }
        if (this.gameOver) {
            return;
        }
        this.paused = !this.paused;
        if (this.paused) {
            this.softDrop = false;
        }
    }

    stop() {
        this.running = false;
        this.paused = false;
        this.gameOver = true;
    }
}

const game = new Tetris();
const boardEl = document.getElementById('board');
const queueEl = document.getElementById('queue');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const statusEl = document.getElementById('status');
const pauseBtn = document.getElementById('pause');
const restartBtn = document.getElementById('restart');
const overlayEl = document.getElementById('message');

const boardCells = [];

function initBoard() {
    boardEl.innerHTML = '';
    boardCells.length = 0;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('aria-label', `Zeile ${row + 1}, Spalte ${col + 1}`);
            boardEl.appendChild(cell);
            boardCells.push(cell);
        }
    }
}

function renderBoard() {
    boardCells.forEach((cell, index) => {
        const x = index % COLS;
        const y = Math.floor(index / COLS);
        const block = game.board[y][x];
        cell.removeAttribute('data-fill');
        cell.style.removeProperty('--cell-color');
        cell.removeAttribute('data-ghost');
        if (block) {
            cell.setAttribute('data-fill', block.type);
            cell.style.setProperty('--cell-color', block.color);
        }
    });

    if (!game.active) {
        return;
    }

    const ghostY = getGhostY();
    for (const [cx, cy] of game.active.rotations[game.active.rotation]) {
        const gx = game.active.x + cx;
        const gy = ghostY + cy;
        if (gy >= 0) {
            const index = gy * COLS + gx;
            if (boardCells[index]) {
                boardCells[index].setAttribute('data-ghost', 'true');
            }
        }
    }

    for (const [cx, cy] of game.active.rotations[game.active.rotation]) {
        const px = game.active.x + cx;
        const py = game.active.y + cy;
        if (py >= 0) {
            const index = py * COLS + px;
            if (boardCells[index]) {
                boardCells[index].setAttribute('data-fill', game.active.type);
                boardCells[index].style.setProperty('--cell-color', game.active.color);
            }
        }
    }
}

function renderQueue() {
    queueEl.innerHTML = '';
    const upcoming = game.bag.peek(3);
    for (const type of upcoming) {
        const preview = document.createElement('div');
        preview.className = 'preview';
        const cells = [];
        for (let i = 0; i < PREVIEW_SIZE * PREVIEW_SIZE; i++) {
            const cell = document.createElement('div');
            cell.className = 'mini-cell';
            preview.appendChild(cell);
            cells.push(cell);
        }
        const shape = PIECES[type][0];
        const offsetX = Math.min(...shape.map(([x]) => x));
        const offsetY = Math.min(...shape.map(([, y]) => y));
        const width = Math.max(...shape.map(([x]) => x)) - offsetX + 1;
        const height = Math.max(...shape.map(([, y]) => y)) - offsetY + 1;
        const startX = Math.floor((PREVIEW_SIZE - width) / 2);
        const startY = Math.floor((PREVIEW_SIZE - height) / 2);
        for (const [cx, cy] of shape) {
            const px = startX + (cx - offsetX);
            const py = startY + (cy - offsetY);
            const index = py * PREVIEW_SIZE + px;
            const cell = cells[index];
            if (cell) {
                cell.setAttribute('data-fill', type);
                cell.style.setProperty('--cell-color', COLORS[type]);
            }
        }
        queueEl.appendChild(preview);
    }
}

function updateHud() {
    scoreEl.textContent = game.score.toString();
    levelEl.textContent = game.level.toString();
    linesEl.textContent = game.lines.toString();
    if (game.gameOver) {
        statusEl.textContent = 'Spiel vorbei';
        pauseBtn.textContent = 'Pause';
        pauseBtn.disabled = true;
        overlayEl.hidden = false;
        overlayEl.textContent = 'Spiel vorbei';
    } else if (game.paused) {
        statusEl.textContent = 'Pausiert';
        pauseBtn.textContent = 'Fortsetzen';
        pauseBtn.disabled = false;
        overlayEl.hidden = false;
        overlayEl.textContent = 'Pause';
    } else if (game.running) {
        statusEl.textContent = 'Spiel läuft';
        pauseBtn.textContent = 'Pause';
        pauseBtn.disabled = false;
        overlayEl.hidden = true;
    } else {
        statusEl.textContent = 'Bereit';
        pauseBtn.textContent = 'Start';
        pauseBtn.disabled = false;
        overlayEl.hidden = false;
        overlayEl.textContent = 'Bereit';
    }
}

function gameLoop(time) {
    game.update(time);
    renderBoard();
    renderQueue();
    updateHud();
    requestAnimationFrame(gameLoop);
}

function getGhostY() {
    if (!game.active) {
        return 0;
    }
    let ghostY = game.active.y;
    while (canPlaceAt(game.active.x, ghostY + 1, game.active.rotation)) {
        ghostY += 1;
    }
    return ghostY;
}

function canPlaceAt(x, y, rotation) {
    const shape = game.active.rotations[rotation];
    for (const [cx, cy] of shape) {
        const px = x + cx;
        const py = y + cy;
        if (px < 0 || px >= COLS || py >= ROWS) {
            return false;
        }
        if (py >= 0 && game.board[py][px]) {
            return false;
        }
    }
    return true;
}

function handleKeyDown(event) {
    if (event.repeat) {
        if (event.code === 'ArrowDown') {
            game.softDrop = true;
        }
        return;
    }
    switch (event.code) {
        case 'ArrowLeft':
            event.preventDefault();
            game.move(-1, 0);
            break;
        case 'ArrowRight':
            event.preventDefault();
            game.move(1, 0);
            break;
        case 'ArrowDown':
            event.preventDefault();
            game.softDrop = true;
            game.stepDown();
            break;
        case 'ArrowUp':
            event.preventDefault();
            game.rotate(1);
            break;
        case 'KeyQ':
            event.preventDefault();
            game.rotate(-1);
            break;
        case 'KeyE':
            event.preventDefault();
            game.rotate(1);
            break;
        case 'Space':
            event.preventDefault();
            game.hardDrop();
            break;
        case 'KeyP':
            event.preventDefault();
            game.togglePause();
            break;
        case 'KeyR':
            event.preventDefault();
            startGame();
            break;
    }
}

function handleKeyUp(event) {
    if (event.code === 'ArrowDown') {
        game.softDrop = false;
    }
}

function startGame() {
    game.reset();
    pauseBtn.textContent = 'Pause';
    pauseBtn.disabled = false;
    renderBoard();
    renderQueue();
    updateHud();
}

pauseBtn.addEventListener('click', () => {
    if (!game.running) {
        startGame();
    } else {
        game.togglePause();
    }
});

restartBtn.addEventListener('click', () => {
    startGame();
});

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

initBoard();
startGame();
requestAnimationFrame(gameLoop);
