# Educational Value — Everyday Puzzle Arcade

This document summarizes the cognitive and academic skills each mini-game
in the arcade is likely to build, aimed at children up through Class 8
(roughly ages 6–14). It's meant as a reference for parents, teachers, or
anyone evaluating the arcade for classroom or home use.

Each game is a different classic puzzle mechanic wrapped in an everyday
scenario (a dog finding its way home, a golf shot, a plumber's pipes, a
moving day) so the underlying logic stays approachable rather than
abstract.

---

## 🐕 Homeward Bound (road-tile rotation)

**Mechanic:** Tap road tiles to rotate them until they form one
continuous route from the dog to home.

**Core skill: spatial reasoning + basic network/graph logic**

- **Mental rotation** — visualizing how a tile's connections will look
  after it turns. This is one of the most-studied spatial skills in
  educational psychology and correlates strongly with later geometry and
  engineering aptitude.
- **Connectivity thinking** — grasping that a path only "counts" if every
  piece links to the next, with no dead ends. This is an intuitive first
  brush with graph theory (nodes and edges), long before the term is
  ever used in a classroom.
- **Sequential planning** — working out *which* tile to fix first so an
  earlier fix isn't undone by a later one.

**Best fit:** Class 3–5. The rule ("just connect the dots") is
immediately visual and forgiving, making it a good entry point for
younger players building foundational logic.

---

## ⛳ Backyard Golf (gravity-tilt sliding)

**Mechanic:** Tilt the green (arrow keys or on-screen pad); the ball
slides until it hits a rock or the edge. Reach the hole.

**Core skill: directional/cause-effect reasoning — an early precursor to
programming logic**

- The "tilt and slide until blocked" rule is exactly the logic behind
  simple **turtle/Logo-style programming**: a sequence of discrete
  directional commands, each with a fixed, predictable outcome. This
  makes it good pre-coding practice even though no code is ever written.
- **Multi-step look-ahead** — since the ball overshoots to the wall, kids
  have to simulate two or three moves ahead mentally rather than just
  reacting to what's directly in front of them.
- **Working memory** — tracking which routes are already blocked while
  retrying a level.

**Best fit:** Class 4–7. Higher levels genuinely require forward
planning, not just trial and error, as the grids get larger and rockier.

---

## 🚰 Pipeline (connect-the-pipes, no crossing/sharing)

**Mechanic:** Drag each colored pipe from its SOURCE to its matching
OUTLET. Every pipe needs its own cells — no two pipes may share or cross.

**Core skill: constraint-satisfaction / systematic logical deduction**

- This is the most advanced mechanic of the four — closest to real logic
  puzzles in the Sudoku family, where multiple constraints must all hold
  *simultaneously* rather than one at a time.
- **Backtracking as a strategy** — the built-in Undo isn't just a
  convenience here; it models a genuine problem-solving habit: try a
  route, notice it conflicts with something else, retract it, and try
  differently. That "try → detect conflict → retract → retry" loop is
  the same mental habit used in debugging code.
- **Planning under competing constraints** — routing one pipe without
  accidentally blocking a route another pipe will need later is a real
  step toward algorithmic thinking.

**Best fit:** Class 6–8, where abstract multi-condition reasoning starts
appearing in the math curriculum (simultaneous equations, basic logical
proofs).

---

## 📦 Moving Day (shape packing into a grid)

**Mechanic:** Select a box, rotate it, and load it into the truck bed.
Fit every box in without overlap.

**Core skill: geometry — area, tessellation, transformation**

- Reinforces **area/space conservation**: a shape's area doesn't change
  when it's rotated, only its orientation does.
- Piece rotation is literally the same mental operation used in geometry
  units on transformations (rotation, reflection, symmetry).
- **Sequencing/strategy** — realizing that large or oddly-shaped pieces
  usually need to go in *first*, before the remaining space gets
  fragmented into unusable slivers. This is an early, hands-on lesson in
  resource-allocation strategy.

**Best fit:** Class 4–8. The mechanic scales naturally as grids and piece
counts grow with level, so it stays relevant across a wide age range.

---

## Cross-cutting skills, by class band

| Class band | What's being built |
|---|---|
| **1–3** | Basic direction/orientation concepts, tap/drag coordination, simple cause-and-effect understanding |
| **4–6** | Spatial visualization tied to geometry, step-by-step planning, pattern recognition, patience through multi-try problems |
| **7–8** | Computational thinking (sequencing, decomposition, backtracking/debugging), multi-constraint logical reasoning, abstract forward-planning |

## Deliberate pedagogical design choices

A few things in the arcade's design are intentional, not incidental:

- **10-level difficulty ramp per game** — mirrors scaffolded learning
  (the "zone of proximal development" idea): each level asks for just a
  little more than mastery of the last one required.
- **Hint button** — gives a nudge in the right direction rather than the
  full answer, so a stuck player stays in productive struggle instead of
  giving up outright.
- **Undo/Redo, always available** — normalizes making a wrong move and
  retracting it as *part of* problem-solving, not a failure to be
  avoided. This matters especially for Pipeline, where backtracking is
  sometimes the only way forward.
- **A distinct visual theme per game** (color, icon, everyday scenario)
  — keeps four different underlying algorithms from feeling like "four
  abstract logic tests," which helps sustain engagement for younger
  players in particular.
