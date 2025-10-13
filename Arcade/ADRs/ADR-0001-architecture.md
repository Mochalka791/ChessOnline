# ADR 0001 – Projektaufteilung

- **Entscheidung**: Das Projekt wird feature-basiert strukturiert (Arcade.Core, Arcade.Games.*, Arcade.Web).
- **Status**: Akzeptiert.
- **Kontext**: Mehrere Spiele teilen sich gemeinsame Infrastruktur (Logging, Options, DI). Eine modulare Aufteilung erleichtert spätere Erweiterungen.
- **Konsequenzen**: Jedes Spiel erhält eigene DI-Extensions, Endpunkte und Tests. Änderungen lassen sich isoliert entwickeln.
