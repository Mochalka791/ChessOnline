# Architekturüberblick

- **Backend**: Feature-basierte Projekte unter `server/`, gemeinsame Abstraktionen in `Arcade.Core`.
- **Chess**: Enthält Domain, Engine (Stockfish-Integration), REST-Endpunkte und SignalR-Hub.
- **Weitere Spiele**: Jeweils schlanke Engines/Endpoints mit Dev-Hooks.
- **Web**: Minimal API hostet SPA unter `/` sowie REST- und Hub-Endpunkte.
- **Frontend**: Vanilla-JS-Shell mit Hash-Routing, globalen Komponenten und spiel-spezifischen Views.
- **Logging**: Nutzung des integrierten .NET-Loggings; Engine-Kommunikation loggt strukturierte Informationen.
