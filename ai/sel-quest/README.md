# SEL Quest — Daily SEL Product Prototype

Phaser 3 landscape product at 1920×1080 with FIT + CENTER_BOTH.

Core loop:
Daily experience → visual story → social decision → consequence → reflection → skill progression.

Architecture includes:
Application shell, Phaser scenes, SEL SDK, data-driven story packages, scenario validation, consequence engine, character state, five SEL competencies, rewards, adaptive difficulty boundary, and local persistence.

The daily story package is intentionally separated from the scenario question so future content can support:
- fully authored visual stories
- generated scenario questions
- branching story variants
- AI-assisted variations behind deterministic validation rules

Run:
python3 -m http.server 8080
Then open http://localhost:8080
