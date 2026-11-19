# Interactive Two-Body Problem Simulator

> An interactive browser simulation of Newtonian two-body motion, with barycentric visualization and live physical analysis.

| | |
|---|---|
| **Course** | ME206 |
| **Assignment** | Assignment 4 |
| **Repository** | [Two-Body-Problem-Simulator](https://github.com/ramibhavya29-dot/Two-Body-Problem-Simulator) |

> **Live Simulator:** [Open the Interactive Two-Body Problem Simulator](https://ramibhavya29-dot.github.io/Two-Body-Problem-Simulator/)

## Contents

- [Project Overview](#project-overview)
- [Physical Model](#physical-model)
  - [Newton's Law of Universal Gravitation](#newtons-law-of-universal-gravitation)
  - [Equations of Motion](#equations-of-motion)
  - [Center of Mass](#center-of-mass)
- [Numerical Method](#numerical-method)
- [Mechanical Quantities](#mechanical-quantities)
- [Main Features](#main-features)
- [Interactive Controls](#interactive-controls)
- [Orbital Presets](#orbital-presets)
- [Technologies and Dependencies](#technologies-and-dependencies)
- [Project File Structure](#project-file-structure)
- [Software Requirements](#software-requirements)
- [Installation and Execution](#installation-and-execution)
- [How to Use the Simulator](#how-to-use-the-simulator)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [GitHub Repository](#github-repository)
- [Live Simulator](#live-simulator)

---

## Project Overview

This project is a browser-based interactive simulation of Newtonian motion for two mutually gravitating bodies. It visualizes both masses moving around their common center of mass, while displaying live orbital quantities, conservation indicators, and bounded real-time graphs.

The primary educational objectives are to demonstrate:

- Newton's universal law of gravitation.
- Independent motion of both interacting bodies.
- Circular, elliptical, and hyperbolic relative trajectories.
- Center-of-mass motion and barycentric reference frames.
- Velocity Verlet integration.
- Conservation of total mechanical energy and angular momentum.
- The relationship among eccentricity, orbital period, position, velocity, and trajectory classification.

The application uses SI units for calculations and presents astronomical distances in astronomical units (AU), velocities in km/s, times in days or years, energy in joules, and angular momentum in kg·m²/s.

## Physical Model

### Newton's Law of Universal Gravitation

For masses `m₁` and `m₂`, let `r⃗₁` and `r⃗₂` be their position vectors. The separation vector from body 1 to body 2 is:

```text
r⃗ = r⃗₂ − r⃗₁
```

The gravitational force magnitude is:

```text
F = G m₁ m₂ / |r⃗|²
```

where `G = 6.67430 × 10⁻¹¹ m³ kg⁻¹ s⁻²`.

### Equations of Motion

The implementation uses the following pairwise accelerations:

```text
a⃗₁ = G m₂ (r⃗₂ − r⃗₁) / |r⃗₂ − r⃗₁|³
```

```text
a⃗₂ = G m₁ (r⃗₁ − r⃗₂) / |r⃗₁ − r⃗₂|³
```

These expressions produce equal and opposite forces while allowing both bodies to move. There is no artificial position constraint on either body.

### Center of Mass

The center-of-mass position is:

```text
R⃗COM = (m₁ r⃗₁ + m₂ r⃗₂) / (m₁ + m₂)
```

Its velocity is:

```text
V⃗COM = (m₁ v⃗₁ + m₂ v⃗₂) / (m₁ + m₂)
```

If the initial total momentum is nonzero, the center of mass can drift at constant velocity. The **Zero center-of-mass velocity** option subtracts the mass-weighted average velocity from both bodies. This changes neither the relative position nor the relative velocity and preserves the relative orbit.

## Numerical Method

The simulator uses a fixed-step velocity Verlet integrator:

```text
r⃗ᵢ(t + Δt) = r⃗ᵢ(t) + v⃗ᵢ(t) Δt + ½ a⃗ᵢ(t) Δt²
```

```text
v⃗ᵢ(t + Δt) = v⃗ᵢ(t) + ½ [a⃗ᵢ(t) + a⃗ᵢ(t + Δt)] Δt
```

The physics time step is independent of the requested simulated-time rate. The default step is 0.1 simulated day and is adjustable from 0.005 to 1 day. Display animation uses `requestAnimationFrame`, while an accumulator supplies fixed-size physics substeps.

At high simulation speeds, physics work is bounded per animation frame. If the requested wall-clock speed cannot be maintained, the interface reports the **Actual achieved speed** and retains unprocessed simulated time rather than silently discarding it.

## Mechanical Quantities

For body masses `m₁` and `m₂`, velocities `v⃗₁` and `v⃗₂`, and separation `r`, the displayed total mechanical energy is:

```text
E = ½ m₁ |v⃗₁|² + ½ m₂ |v⃗₂|² − G m₁ m₂ / r
```

The relative angular momentum magnitude is:

```text
Lrel = μ |r⃗ × v⃗rel|
```

where the reduced mass `μ` is:

```text
μ = m₁ m₂ / (m₁ + m₂)
```

The live relative energy error is:

```text
Energy error = |E − E₀| / |E₀| × 100%
```

The relative angular momentum error uses the same convention with `Lrel` and its initial value `Lrel₀`.

For the two-body relative orbit, eccentricity is derived from the specific orbital energy:

```text
εrel = ½ |v⃗rel|² − G (m₁ + m₂) / r
```

and the specific relative angular momentum `h`:

```text
h = rₓ vᵧ,rel − rᵧ vₓ,rel
e = √(1 + 2 εrel h² / [G (m₁ + m₂)]²)
```

For bound trajectories, `εrel < 0`. The orbital period is calculated from the relative semimajor axis:

```text
a = −G (m₁ + m₂) / (2 εrel)
T = 2π √[a³ / G (m₁ + m₂)]
```

## Main Features

- Newtonian, position-based two-body orbital animation on an HTML5 canvas.
- Both bodies accelerate and move; neither is artificially fixed.
- Separate glowing body colors and persistent orbital trails.
- Center-of-mass marker and mass-weighted COM velocity readout.
- Adjustable body masses, positions, velocities, and initial separation.
- Fixed-step velocity Verlet integration independent from display and simulation speed.
- One-way bounded per-frame physics computation.
- Selected and achieved simulated speed indicators.
- Elapsed simulated days or years and completed orbital revolutions.
- Relative energy and angular momentum conservation indicators.
- Live separation, body-speed, relative-speed, energy, angular-momentum, eccentricity, period, and COM displays.
- Three bounded live Chart.js graphs:
  - separation versus time,
  - kinetic, potential, and total energy versus time,
  - body speeds versus time.
- Zoom, pan, reset camera, and reset/restart controls.
- Orbit trails, velocity vectors, force vectors, reference grid, COM marker, and size-exaggeration display options.
- Presentation mode with enlarged simulation area and a compact elapsed-time/speed overlay.
- Collision detection at estimated body contact radii. Collision stops the simulation before continuing into singular separation; no inverse-square force softening is used.

## Interactive Controls

### Body Parameters

Enter mass in Earth-mass units, position in AU, and velocity in km/s. The initial-separation field adjusts positions while preserving the current center of mass.

### Simulation Controls

| Control | Effect |
|---|---|
| **Play/Pause** | Starts or pauses the simulation. |
| **Restart** | Restarts using the current parameter fields. |
| **Reset** | Restores the currently selected preset. |
| **Reset camera** | Clears pan and zoom and restores automatic framing. |
| **Time step** | Sets the fixed physics substep from 0.005 to 1 simulated day. |
| **Speed controls** | Select or enter a rate from 1 to 10,000 simulated days per real second. |
| **Cinematic orbit** | Sets a 365-day-per-second presentation rate and restores the prior speed when disabled. |
| **Trail length** | Adjusts the retained bound-orbit fraction or unbound time window. |

### Display Controls

Use the toggles to show or hide:

- orbit trails,
- velocity vectors,
- gravitational-force vectors,
- the reference grid,
- the center-of-mass marker,
- and visual-only body-size enlargement.

The body-size option is explicitly labeled **not to scale**.

## Orbital Presets

| Preset | Initial conditions |
|---|---|
| Equal-mass binary stars | Default 1.2-AU equal-solar-mass system with opposite barycentric velocities. |
| Ideal circular equal-mass binary | Mathematically circular equal-mass binary configuration. |
| Sun–Earth | Near-circular Sun–Earth initial conditions. |
| Earth–Moon | Earth–Moon barycentric initial conditions. |
| Elliptical orbit | Eccentric bound orbit initialized at periapsis. |
| Near-circular orbit | Near-circular bound two-body orbit. |
| Escape trajectory | Hyperbolic flyby with positive relative orbital energy. |

## Technologies and Dependencies

### Core Software

- HTML5
- CSS
- JavaScript
- HTML5 Canvas
- `requestAnimationFrame`
- Velocity Verlet numerical integration

### External Dependencies

| Dependency | Version or source | Purpose |
|---|---|---|
| **Chart.js** | 4.4.4 · [jsDelivr CDN](https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js) | Live time-series graphs. |
| **Google Fonts** | [Google Fonts CSS](https://fonts.googleapis.com/) | Optional DM Sans, DM Mono, and Space Grotesk typefaces. |

The project has no backend, build step, package manifest, package installation requirement, or local asset dependency. Chart.js is required for live graphs; without network access to jsDelivr, the simulator displays a fallback graph-message area and the rest of the application remains usable. Google Fonts are optional visual enhancements.

## Project File Structure

```text
Two-Body-Problem-Simulator/
├── index.html
├── style.css
├── script.js
├── README.md
├── SUBMISSION.md
└── .gitignore
```

## Software Requirements

- A modern desktop or mobile browser, preferably Chrome, Edge, Firefox, or Safari.
- Internet access for Chart.js and Google Fonts if not already available through browser cache.
- VS Code with the **Live Server** extension by Ritwick Dey for the recommended local execution method.

No Node.js, Python, database, or backend server is required.

## Installation and Execution

### Option 1: VS Code Live Server

1. Download or clone the repository.
2. Open the repository folder in VS Code.
3. Install the **Live Server** extension if it is not already installed.
4. Open `index.html`.
5. Right-click inside `index.html` and select **Open with Live Server**, or use the Live Server status-bar option.
6. Allow Live Server to open `http://127.0.0.1:5500/index.html` or the equivalent local address shown in VS Code.
7. Keep the Live Server browser tab open while using the simulator.

### Option 2: Direct Browser Opening

Open `index.html` directly in a modern browser. Live Server is recommended because it provides consistent static-file behavior and easy refresh.

### Optional Static Server from a Terminal

From the repository directory, any static server may be used, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

This Python command is optional; Python is not required for the simulator itself.

## How to Use the Simulator

1. Start in the equal-mass binary preset or choose another preset.
2. Inspect the two bodies and their separate trails around the center-of-mass marker.
3. Modify masses, positions, velocities, or separation and select **Apply parameters**.
4. Enable **Zero center-of-mass velocity** to remove an initial common translational velocity.
5. Select a named speed preset or enter a custom speed from 1 to 10,000 days/s.
6. Adjust the fixed physics time step if additional numerical precision is desired.
7. Use **Play/Pause**, **Restart**, or **Reset** to control and reset the run.
8. Drag the canvas to pan and use the mouse wheel or camera buttons to zoom.
9. Use **Reset camera** to restore the standard view.
10. Enable presentation mode for a recording-oriented full-canvas view.
11. Compare the live energy and angular momentum errors while changing the time step or speed.

For a quick circular-binary demonstration, select **Ideal circular equal-mass binary**, set a moderate speed, and retain the 0.005-day or 0.100-day fixed step.

## Known Limitations

- The model is two-dimensional and Newtonian; relativistic effects are not included.
- Bodies are modeled as point masses for acceleration, with estimated radii used only for collision detection.
- Visual body-size enlargement is optional and is not to scale.
- Collision handling pauses the integration at estimated contact; it does not simulate impact deformation or post-collision dynamics.
- Chart history is bounded to 600 samples, and trail storage is bounded to 1500 points.
- At very high requested speeds, CPU limits can reduce the achieved speed. The selected speed and actual achieved speed are displayed separately.
- Chart.js and Google Fonts require network access unless they are cached or otherwise available.

## Troubleshooting

### The page is blank or the controls do not respond

- Verify that `index.html`, `style.css`, and `script.js` are all in the same directory.
- Reload the page using Live Server.
- Open the browser developer console and confirm that `script.js` loads without syntax errors.
- Confirm that JavaScript is enabled.

### Chart.js does not appear

- Check internet access to `https://cdn.jsdelivr.net`.
- Confirm that the Chart.js CDN URL in `index.html` is accessible.
- Reload the page after network access is restored.

### Fonts look like system fonts

Google Fonts require network access. The simulator layout remains usable if fonts cannot be downloaded.

### The browser reports a collision

The selected initial separation or a later close approach may place the estimated body radii within contact distance. Increase separation or modify masses and restart.

### The achieved speed is much lower than the selected speed

This is expected if the bounded 8-ms physics budget or 2000-physics-step frame limit is reached. Reduce the requested speed or increase the fixed time step only when its numerical accuracy is acceptable. The physics loop does not discard unprocessed time.

## GitHub Repository

The public repository is available at [github.com/ramibhavya29-dot/Two-Body-Problem-Simulator](https://github.com/ramibhavya29-dot/Two-Body-Problem-Simulator).

To obtain a local copy:

```bash
git clone https://github.com/ramibhavya29-dot/Two-Body-Problem-Simulator.git
cd Two-Body-Problem-Simulator
```

The cloned repository is ready to run using the VS Code Live Server instructions above.

## Live Simulator

The public GitHub Pages deployment is available at [https://ramibhavya29-dot.github.io/Two-Body-Problem-Simulator/](https://ramibhavya29-dot.github.io/Two-Body-Problem-Simulator/).
