# Arcade

Arcade ist eine modulare Spielesammlung auf Basis von .NET 9 und einer Vanilla-JavaScript-Single-Page-Application. Das Projekt bündelt mehrere Spiele (Chess, Tetris, Snake, Blockwood, Sudoku, Minesweeper) unter einer gemeinsamen Shell mit Hash-Routing.

## Entwicklung

1. .NET SDK 9 installieren.
2. Stockfish UCI Engine bereitstellen (Pfad über `appsettings.json` konfigurierbar).
3. Server starten:
   ```bash
   dotnet run --project server/Arcade.Web
   ```
4. Browser öffnen: `http://localhost:5000/`.

## Tests

Unit-Tests liegen in `tests/`. Ausführen mit:

```bash
dotnet test Arcade.sln
```

## Struktur

- `server/`: Backend-Projekte nach Feature gegliedert.
- `server/Arcade.Web/wwwroot`: SPA mit globalen Styles/Komponenten und Spiel-spezifischen Assets.
- `tests/`: xUnit-Testprojekte.
- `ADRs/`: Architekturentscheidungen.
