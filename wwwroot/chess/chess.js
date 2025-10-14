// =============================
//  ChessOnline - chess.js  (NEU)
//  Ort: wwwroot/chess/chess.js
// =============================

// 1) Loader sofort ausblenden (Seite ist direkt nutzbar)
(function hideLoaderNow() {
    ["loader", "loading", "wait", "overlay"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
})();

// 2) Konstanten & Helpers
const PIECES_DIR = "/chess/pieces";  // absoluter Pfad -> robust gegen 404
const fileToCol = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };

// URL-sicher encoden (Umlaute/Leerzeichen)
function enc(path) {
    return path.split("/").map(encodeURIComponent).join("/");
}

// 3) Board + Pieces-Layer
let piecesLayer = null;

function ensureBoardSquares(host) {
    if (!host) return;

    // 3.1 8x8 Grundraster nur einmal erzeugen
    if (!host._gridInitialized) {
        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(8, 1fr)";
        grid.style.gridTemplateRows = "repeat(8, 1fr)";
        grid.style.width = "100%";
        grid.style.height = "100%";

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = document.createElement("div");
                const dark = (r + c) % 2 === 1;
                sq.style.background = dark ? "#0f172a" : "#162036";
                sq.style.border = "1px solid rgba(255,255,255,.04)";
                sq.dataset.square = String.fromCharCode(97 + c) + (8 - r); // a8..h1
                sq.addEventListener("click", () => addMove(`Click ${sq.dataset.square}`));
                grid.appendChild(sq);
            }
        }
        host.appendChild(grid);
        host._gridInitialized = true;
    }

    // 3.2 Layer für Figuren (über dem Grid; Klicks gehen ans Grid)
    if (!piecesLayer) {
        piecesLayer = document.createElement("div");
        piecesLayer.style.position = "absolute";
        piecesLayer.style.inset = "0";
        piecesLayer.style.display = "grid";
        piecesLayer.style.gridTemplateColumns = "repeat(8, 1fr)";
        piecesLayer.style.gridTemplateRows = "repeat(8, 1fr)";
        piecesLayer.style.pointerEvents = "none";
        host.style.position = "relative";
        host.appendChild(piecesLayer);
    }
}

// "e4" -> (row, col) fürs Grid (row 1 = oben)
function toGridRC(square) {
    if (!square || square.length !== 2) return { row: 1, col: 1 };
    const file = square[0].toLowerCase();
    const rank = Number(square[1]);
    const col = fileToCol[file] ?? 1;
    const row = 9 - rank; // rank 8 oben
    return { row, col };
}

// Figur setzen (mit Fehler-Log, falls SVG nicht gefunden)
function putPiece(square, filename, alt = "") {
    if (!piecesLayer) return;
    const { row, col } = toGridRC(square);

    const img = document.createElement("img");
    const src = `${PIECES_DIR}/${enc(filename)}`; // -> /chess/pieces/<Name>.svg
    img.src = src;
    img.alt = alt || filename;
    img.style.width = "86%";
    img.style.height = "86%";
    img.style.objectFit = "contain";
    img.style.margin = "7% auto";
    img.style.gridColumn = String(col);
    img.style.gridRow = String(row);
    img.style.pointerEvents = "none";

    img.onerror = () => console.error("Figur nicht gefunden:", src);

    piecesLayer.appendChild(img);
    return img;
}

function clearPieces() {
    if (piecesLayer) piecesLayer.innerHTML = "";
}

// 4) Board-Resize: maximal groß ohne Scrollen
function resizeBoard() {
    const pageH = window.innerHeight - 56;           // abzüglich Header
    const pageW = Math.min(document.body.clientWidth, 1600);

    // Spaltenbreiten: links 320, rechts 360, Gaps 16*2 = 32, Page-Padding 16*2 = 32
    const leftW = 320, rightW = 360, gaps = 32, padding = 32;
    let centerW = pageW - (leftW + rightW + gaps + padding);
    if (centerW < 540) centerW = 540;

    // Vertikal: 2 kompakte Playerzeilen + etwas Puffer → ~120px
    const reservedV = 120;
    const maxBoardH = pageH - (reservedV + padding);

    const boardSize = Math.floor(Math.min(centerW - 16, maxBoardH - 16));
    const clamped = Math.max(480, Math.min(1000, boardSize)); // 480..1000 px

    const shell = document.getElementById("boardShell");
    if (shell) {
        shell.style.width = clamped + "px";
        shell.style.height = clamped + "px";
    }
}

// 5) Zugliste & Buttons
function addMove(text) {
    const ol = document.getElementById("moves");
    if (!ol) return;
    const li = document.createElement("li");
    li.textContent = text;
    ol.appendChild(li);
    ol.parentElement?.scrollTo({ top: ol.parentElement.scrollHeight });
}

function wireButtons() {
    document.getElementById("btn-undo")?.addEventListener("click", () => addMove("Undo"));
    document.getElementById("btn-resign")?.addEventListener("click", () => addMove("Resign"));
    document.getElementById("btn-hint")?.addEventListener("click", async () => {
        try {
            const data = await analyzeSafe("demo-room");
            addMove(data?.summary?.bestSan ? `Hint: ${data.summary.bestSan}` : "Hint: none");
        } catch { /* ignore */ }
    });
    document.getElementById("btn-options")?.addEventListener("click", () => addMove("Options"));

    document.getElementById("btn-test-start")?.addEventListener("click", () => {
        demoSetup();
        addMove("Test Start: König/Dame/Türme gesetzt");
    });
    document.getElementById("btn-test-move")?.addEventListener("click", () => addMove("Test: Random Move"));
    document.getElementById("btn-test-reset")?.addEventListener("click", () => {
        clearPieces();
        addMove("Test: Reset");
    });
}

// 6) Demo-Setup (Figuren automatisch setzen – Original-Dateinamen)
function demoSetup() {
    clearPieces();
    putPiece("e1", "Chess_König_White.svg", "Weißer König");
    putPiece("d8", "Chess_Queen_Black.svg", "Schwarze Dame");
    putPiece("a1", "Chess_Rook_White.svg", "Weißer Turm");
    putPiece("h8", "Chess_Rook_Black.svg", "Schwarzer Turm");
}

// 7) Optional: SignalR (niemals blockierend)
let connection = null;
async function startSignalR() {
    if (!window.signalR || !window.signalR.HubConnectionBuilder) return;
    try {
        connection = new signalR.HubConnectionBuilder()
            .withUrl("/hubs/chess") // Program.cs: app.MapHub<ChessHub>("/hubs/chess");
            .withAutomaticReconnect()
            .build();
        connection.on("OnMove", m => addMove(`Server: ${m}`));
        await connection.start();
        // await connection.invoke("JoinRoom", "demo-room");
    } catch (e) {
        console.warn("SignalR offline (UI läuft weiter):", e);
    }
}

// 8) Nicht-blockierende Local-Analyse (für „Hinweis“)
async function analyzeSafe(roomId) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), 4000);
    try {
        const res = await fetch(`/api/local/analyze?roomId=${encodeURIComponent(roomId)}&depth=14`, { signal: ctrl.signal });
        return await res.json().catch(() => ({}));
    } catch {
        return { ok: false };
    } finally {
        clearTimeout(t);
    }
}

// 9) Boot
window.addEventListener("resize", resizeBoard);
document.addEventListener("DOMContentLoaded", () => {
    ensureBoardSquares(document.getElementById("board")); // Grid + Figuren-Layer
    wireButtons();
    resizeBoard();
    demoSetup();      // Figuren direkt anzeigen (prüft auch Pfade)
    startSignalR();   // optional, blockiert nie
});
