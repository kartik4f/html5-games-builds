# SEL Game Development Curriculum Path
### Target Demographics: Grades 3–8 (Ages 8–14)
### Engineering Standard: Phaser 3 | 1920x1080 | Fullscreen Fit Centered

---

## 🎮 Introduction & Paradigm Shift
Traditional Social-Emotional Learning (SEL) relies heavily on text-dense lectures, leading to disengagement in middle school demographics. This architecture translates psychological frameworks into modular game mechanics. By treating internal emotional states as game systems (e.g., resources, cooldowns, state machines), players experience immediate loop feedback on behavioral choices.

---

## 🛠️ Stage 1: The Core Foundation (Self-Awareness)
* **Psychological Objective:** Train players to decode physical bio-feedback cues before escalating to external behavior.
* **Game Analogy:** Managing a character's "Mana" or "Stamina" system.
* **Core Mechanics:**
  * **The Input Buffer (Labeling Engine):** A rapid time-attack interface mapping physical symptoms (sweating, rapid pulse, muscle tension) to their corresponding primary emotional states.
  * **The Bio-Heatmap Vector Parser:** A 2D structural avatar where players select node locations on a skeleton mesh to register personal physiological stress indicators, constructing an "Early Warning System" save profile.
* **Developer Deliverables:** 
  * Simple vector array mapping body zones to coordinate bounds.
  * Local storage serialization of the player's diagnostic baseline profile.

---

## ⏳ Stage 2: Input Controls (Self-Management)
* **Psychological Objective:** Insert an intentional delay between an external event trigger and player execution output.
* **Game Analogy:** Global Cooldowns (GCD), input lag simulation, and quick-time event (QTE) overrides.
* **Core Mechanics:**
  * **The Lag Switch Simulator:** An active dialogue scene where adversarial NPCs trigger immediate emotional spikes. The UI locks all interactive input choices behind a visible countdown timer.
  * **Sync-Pulse Breathing Engine:** A kinetic UI minigame requiring the player to hold/release inputs matching an expanding ring element, programmatically dropping a virtual tension bar down to baseline levels before letting choices execute.
* **Developer Deliverables:**
  * Phaser.Time.TimerEvent loops governing UI `disabled` DOM states.
  * Alpha/Scale tweens mapped cleanly to canvas rendering cycles.

---

## 👥 Stage 3: Multiplayer Sandbox (Social & Relationship Skills)
* **Psychological Objective:** Transition from individual mechanical survival to asynchronous collaboration and perspective management.
* **Game Analogy:** Asymmetrical local co-op mechanics and dual-viewpoint rendering pipelines.
* **Core Mechanics:**
  * **Asymmetrical Information Exchange:** A two-player game grid where Player A possesses situational data and Player B retains execution tools. Players must communicate using explicit structural syntax ("I-statements") to bypass traps.
  * **The Double-Render Perspective Engine:** A system running the identical level narrative twice, altering only the internal monologues and visual sprite filters of the respective characters to highlight distinct internal realities.
* **Developer Deliverables:**
  * Clean JSON schema separation for disparate viewpoint data.
  * Custom scene event dispatchers managing state across both players.

---

## 🌲 Stage 4: End-Game Choice Trees (Responsible Decision-Making)
* **Psychological Objective:** Systematically evaluate short-term vs. long-term compounding consequences.
* **Game Analogy:** Branching dialogue trees, persistent world states, and state-machine bugs.
* **Core Mechanics:**
  * **The Cascading Choice Matrix:** A decision engine where short-sighted options yield high instant rewards (e.g., immediate status gain) but permanently corrupt future world variables or completely disable optimal side quests down the road.
  * **The Relationship Bug Tracker:** A functional multi-tier repair engine requiring players to correct broken trust states using structural phases: identifying the error (harm), creating a patches solution (behavior change), and running validation checks (rebuilding consistency).
* **Developer Deliverables:**
  * Deeply nested conditional state trees tracking global game arrays.
  * Save-state flags influencing town/NPC layout parameters over time.

---

## 🚀 Technical Configuration Guide
Ensure your Phaser engine initialization script respects the following exact configuration structure to maintain proper DOM-to-canvas rendering alignment across all desktop browser types:

```javascript
const config = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    parent: 'game-container',
    dom: { createContainer: true },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [ BootScene, SELGameplayScene ]
};
```
