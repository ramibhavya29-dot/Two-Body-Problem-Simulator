(() => {
  "use strict";

  const G = 6.67430e-11;
  const AU = 149597870700;
  const DAY = 86400;
  const YEAR = 365.25 * DAY;
  const EARTH_MASS = 5.9722e24;
  const SOLAR_MASS = 1.98847e30;
  const EARTH_DENSITY = 5514;
  const MAX_TRAIL_POINTS = 1500;
  const MAX_CHART_POINTS = 600;
  const MAX_PHYSICS_STEPS_PER_FRAME = 2000;
  const MAX_PHYSICS_BUDGET_MS = 8;
  const SPEED_LEVELS = [1, 10, 30, 100, 365, 1000, 3000, 10000];
  const SPEED_PRESETS = [
    { name: "Normal", speed: 10 },
    { name: "Fast", speed: 100 },
    { name: "Very Fast", speed: 365 },
    { name: "Extreme", speed: 1000 },
    { name: "Ultra", speed: 3000 },
    { name: "Maximum", speed: 10000 }
  ];
  const COLORS = ["#ffb56b", "#70a9ff"];
  const PRESET_DESCRIPTIONS = {
    "sun-earth": "A near-circular, barycentric Sun–Earth system.",
    "earth-moon": "Earth and Moon orbit their shared center of mass.",
    binary: "Two equal stars orbit a common center of mass.",
    "ideal-binary": "An ideal circular equal-mass binary with equal and opposite velocities.",
    elliptical: "An eccentric orbit, initialized at periapsis.",
    hyperbolic: "A fast flyby with enough energy to escape.",
    circular: "A circular two-body orbit, initialized near 1 AU."
  };

  const $ = (id) => document.getElementById(id);
  const ui = {
    canvas: $("simulation-canvas"),
    canvasWrap: $("canvas-wrap"),
    preset: $("preset-select"),
    description: $("preset-description"),
    playButton: $("play-button"),
    playIcon: $("play-icon"),
    playLabel: $("play-label"),
    timestep: $("timestep"),
    timestepValue: $("timestep-value"),
    speed: $("sim-speed"),
    speedValue: $("sim-speed-value"),
    speedPreset: $("speed-preset"),
    speedCustom: $("speed-custom"),
    cinematic: $("toggle-cinematic"),
    trailLength: $("trail-length"),
    trailLengthValue: $("trail-length-value"),
    separation: $("separation"),
    energyIndicator: $("energy-indicator"),
    collisionBanner: $("collision-banner"),
    zeroComVelocity: $("zero-com-velocity")
  };
  const ctx = ui.canvas.getContext("2d");
  const state = {
    bodies: [],
    prevPositions: [],
    trails: [[], []],
    elapsed: 0,
    initialEnergy: 0,
    initialAngularMomentum: 0,
    running: true,
    accumulator: 0,
    requestedSpeed: 100,
    actualSpeed: 0,
    speedWindowStartAt: 0,
    speedWindowStartElapsed: 0,
    orbitalPeriod: null,
    cinematicPreviousSpeed: null,
    chartSampleElapsed: 0,
    trailLastTime: 0,
    lastFrame: 0,
    lastUiUpdate: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    fitDistanceAU: 1,
    autoFit: true,
    canvasWidth: 0,
    canvasHeight: 0,
    dpr: 1,
    stars: [],
    collision: false,
    presetBodyInfo: [],
    charts: {},
    chartTime: [],
    chartData: { distance: [], energyK: [], energyP: [], energyT: [], speed1: [], speed2: [] }
  };
  const inputIds = ["mass1", "x1", "y1", "vx1", "vy1", "mass2", "x2", "y2", "vx2", "vy2"];

  function makeEqualMassBinaryPreset() {
    return makeOrbitPreset({
      name1: "Star A", name2: "Star B", mass1: SOLAR_MASS, mass2: SOLAR_MASS,
      radius1: 696340000, radius2: 696340000, separation: 1.2 * AU, eccentricity: 0, hyperbolicFactor: 0
    });
  }

  const presets = {
    "sun-earth": () => makeOrbitPreset({
      name1: "Sun", name2: "Earth", mass1: SOLAR_MASS, mass2: EARTH_MASS,
      radius1: 696340000, radius2: 6371000, separation: AU, eccentricity: 0.0167, hyperbolicFactor: 0
    }),
    "earth-moon": () => makeOrbitPreset({
      name1: "Earth", name2: "Moon", mass1: EARTH_MASS, mass2: 7.342e22,
      radius1: 6371000, radius2: 1737400, separation: 363300000, eccentricity: 0.0549, hyperbolicFactor: 0
    }),
    binary: makeEqualMassBinaryPreset,
    "ideal-binary": makeEqualMassBinaryPreset,
    elliptical: () => makeOrbitPreset({
      name1: "Sun", name2: "Probe", mass1: SOLAR_MASS, mass2: EARTH_MASS * 0.01,
      radius1: 696340000, radius2: 1000000, separation: 0.55 * AU, eccentricity: 0.65, hyperbolicFactor: 0
    }),
    hyperbolic: () => makeOrbitPreset({
      name1: "Sun", name2: "Visitor", mass1: SOLAR_MASS, mass2: EARTH_MASS * 0.01,
      radius1: 696340000, radius2: 1000000, separation: AU, eccentricity: 0, hyperbolicFactor: 1.25
    }),
    circular: () => makeOrbitPreset({
      name1: "Sun", name2: "Satellite", mass1: SOLAR_MASS, mass2: EARTH_MASS * 0.001,
      radius1: 696340000, radius2: 1000000, separation: AU, eccentricity: 0, hyperbolicFactor: 0
    })
  };

  function makeOrbitPreset(options) {
    const totalMass = options.mass1 + options.mass2;
    const gravitationalParameter = G * totalMass;
    const r = options.separation;
    let relativeSpeed;
    if (options.hyperbolicFactor > 0) {
      relativeSpeed = options.hyperbolicFactor * Math.sqrt(2 * gravitationalParameter / r);
    } else {
      relativeSpeed = Math.sqrt(gravitationalParameter * (1 + options.eccentricity) / r);
    }
    return [
      {
        name: options.name1, mass: options.mass1, radius: options.radius1, color: COLORS[0],
        x: -options.mass2 / totalMass * r, y: 0,
        vx: 0, vy: -options.mass2 / totalMass * relativeSpeed
      },
      {
        name: options.name2, mass: options.mass2, radius: options.radius2, color: COLORS[1],
        x: options.mass1 / totalMass * r, y: 0,
        vx: 0, vy: options.mass1 / totalMass * relativeSpeed
      }
    ];
  }

  function radiusFromMass(mass) {
    return Math.cbrt((3 * mass) / (4 * Math.PI * EARTH_DENSITY));
  }

  function clonePosition(body) {
    return { x: body.x, y: body.y };
  }

  function setPreset(presetKey) {
    const pair = presets[presetKey]();
    state.presetBodyInfo = pair;
    pair.forEach((body, index) => {
      const n = index + 1;
      $(`mass${n}`).value = formatInput(body.mass / EARTH_MASS);
      $(`x${n}`).value = formatInput(body.x / AU);
      $(`y${n}`).value = formatInput(body.y / AU);
      $(`vx${n}`).value = formatInput(body.vx / 1000);
      $(`vy${n}`).value = formatInput(body.vy / 1000);
      $(`body${n}-name`).textContent = body.name;
    });
    ui.separation.value = formatInput(Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y) / AU);
    $("scenario-title").textContent = scenarioName(presetKey);
    $("legend1").textContent = pair[0].name;
    $("legend2").textContent = pair[1].name;
    $("speed1-label").textContent = `${pair[0].name.toUpperCase()} SPEED`;
    $("speed2-label").textContent = `${pair[1].name.toUpperCase()} SPEED`;
    ui.description.textContent = PRESET_DESCRIPTIONS[presetKey];
    restartFromInputs();
  }

  function scenarioName(key) {
    return {
      "sun-earth": "Sun — Earth",
      "earth-moon": "Earth — Moon",
      binary: "Equal-mass binary",
      "ideal-binary": "Ideal circular binary",
      elliptical: "Elliptical orbit",
      hyperbolic: "Hyperbolic flyby",
      circular: "Near-circular orbit"
    }[key];
  }

  function formatInput(value) {
    if (Math.abs(value) >= 1e7 || (value !== 0 && Math.abs(value) < 1e-5)) return value.toExponential(6);
    return Number(value.toPrecision(9)).toString();
  }

  function readBodiesFromInputs() {
    const bodies = [];
    for (let index = 1; index <= 2; index += 1) {
      const massInEarths = Number($(`mass${index}`).value);
      const values = ["x", "y", "vx", "vy"].map((key) => Number($(`${key}${index}`).value));
      if (!Number.isFinite(massInEarths) || massInEarths <= 0 ||
          values.some((value) => !Number.isFinite(value))) {
        throw new Error("Enter finite positions and velocities, and a mass greater than zero.");
      }
      const mass = massInEarths * EARTH_MASS;
      if (!Number.isFinite(mass) || mass <= 0) throw new Error("Mass is outside the supported numeric range.");
      const presetBody = state.presetBodyInfo[index - 1];
      const isUnchangedPresetMass = presetBody &&
        Math.abs(mass - presetBody.mass) / presetBody.mass < 1e-9;
      bodies.push({
        name: $(`body${index}-name`).textContent || `Body ${index}`,
        mass, radius: isUnchangedPresetMass ? presetBody.radius : radiusFromMass(mass), color: COLORS[index - 1],
        x: values[0] * AU, y: values[1] * AU,
        vx: values[2] * 1000, vy: values[3] * 1000,
        ax: 0, ay: 0
      });
    }
    return bodies;
  }

  function accelerationFor(pair) {
    const dx = pair[1].x - pair[0].x;
    const dy = pair[1].y - pair[0].y;
    const r2 = dx * dx + dy * dy;
    if (!Number.isFinite(r2) || r2 <= 0) throw new Error("The bodies occupy the same position; adjust their initial conditions.");
    const inverseR3 = 1 / (r2 * Math.sqrt(r2));
    return [
      { x: G * pair[1].mass * dx * inverseR3, y: G * pair[1].mass * dy * inverseR3 },
      { x: -G * pair[0].mass * dx * inverseR3, y: -G * pair[0].mass * dy * inverseR3 }
    ];
  }

  function diagnostics() {
    const [a, b] = state.bodies;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    const distance = Math.hypot(dx, dy);
    const relativeSpeed = Math.hypot(dvx, dvy);
    const kinetic = 0.5 * a.mass * (a.vx * a.vx + a.vy * a.vy) +
      0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy);
    const potential = -G * a.mass * b.mass / distance;
    const totalEnergy = kinetic + potential;
    const reducedMass = (a.mass * b.mass) / (a.mass + b.mass);
    const hSpecific = dx * dvy - dy * dvx;
    const specificEnergy = 0.5 * relativeSpeed * relativeSpeed -
      G * (a.mass + b.mass) / distance;
    const eccentricity = Math.sqrt(Math.max(0,
      1 + (2 * specificEnergy * hSpecific * hSpecific) /
      Math.pow(G * (a.mass + b.mass), 2)));
    const com = {
      x: (a.mass * a.x + b.mass * b.x) / (a.mass + b.mass),
      y: (a.mass * a.y + b.mass * b.y) / (a.mass + b.mass)
    };
    const totalMass = a.mass + b.mass;
    const comVelocity = {
      x: (a.mass * a.vx + b.mass * b.vx) / totalMass,
      y: (a.mass * a.vy + b.mass * b.vy) / totalMass
    };
    const angularMomentumSigned = reducedMass * hSpecific;
    const angularMomentum = Math.abs(angularMomentumSigned);
    let period = null;
    if (specificEnergy < 0) {
      const semiMajorAxis = -G * (a.mass + b.mass) / (2 * specificEnergy);
      period = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / (G * (a.mass + b.mass)));
    }
    return {
      distance, relativeSpeed, kinetic, potential, totalEnergy, specificEnergy,
      eccentricity, com, comVelocity, angularMomentum, angularMomentumSigned, period
    };
  }

  function resetCharts() {
    state.chartTime = [];
    state.chartData = { distance: [], energyK: [], energyP: [], energyT: [], speed1: [], speed2: [] };
    const d = diagnostics();
    appendChartSample(d);
    Object.values(state.charts).forEach((chart) => {
      chart.data.labels = [...state.chartTime];
      chart.data.datasets.forEach((dataset) => { dataset.data = [...state.chartData[dataset.key]]; });
      chart.update("none");
    });
  }

  function appendChartSample(d) {
    const [a, b] = state.bodies;
    state.chartData.distance.push(d.distance / AU);
    state.chartData.energyK.push(d.kinetic);
    state.chartData.energyP.push(d.potential);
    state.chartData.energyT.push(d.totalEnergy);
    state.chartData.speed1.push(Math.hypot(a.vx, a.vy) / 1000);
    state.chartData.speed2.push(Math.hypot(b.vx, b.vy) / 1000);
    state.chartTime.push(state.elapsed / YEAR);
    if (state.chartData.distance.length > MAX_CHART_POINTS) {
      state.chartTime.shift();
      Object.values(state.chartData).forEach((series) => series.shift());
    }
  }

  function makeChart(canvasId, datasets, yTitle) {
    const chart = new Chart($(canvasId), {
      type: "line",
      data: {
        labels: [],
        datasets: datasets.map((dataset) => ({
          label: dataset.label,
          key: dataset.key,
          data: [],
          borderColor: dataset.color,
          backgroundColor: dataset.color,
          borderWidth: 1.6,
          pointRadius: 0,
          pointHitRadius: 6,
          tension: 0.18,
          fill: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: {
            display: datasets.length > 1,
            position: "top",
            labels: { color: "#8493a8", boxWidth: 7, boxHeight: 7, usePointStyle: true, pointStyle: "circle", padding: 6, font: { family: "DM Mono", size: 8 } }
          },
          tooltip: {
            backgroundColor: "#111b2b",
            borderColor: "rgba(159,183,220,.2)",
            borderWidth: 1,
            titleColor: "#dce7f4",
            bodyColor: "#a9b8cb",
            titleFont: { family: "DM Mono", size: 9 },
            bodyFont: { family: "DM Mono", size: 9 },
            callbacks: { title: (items) => `${Number(items[0].label).toFixed(3)} yr` }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(159,183,220,.065)", drawTicks: false },
            border: { display: false },
            ticks: {
              color: "#64748a", maxTicksLimit: 4, maxRotation: 0, minRotation: 0, padding: 3,
              font: { family: "DM Mono", size: 8 },
              callback(value) {
                const year = Number(this.getLabelForValue(value));
                return Number.isFinite(year) ? year.toPrecision(2) : "";
              }
            },
            title: { display: false }
          },
          y: {
            grid: { color: "rgba(159,183,220,.065)", drawTicks: false },
            border: { display: false },
            ticks: { color: "#64748a", maxTicksLimit: 4, font: { family: "DM Mono", size: 8 }, callback: compactTick },
            title: { display: false, text: yTitle }
          }
        }
      }
    });
    return chart;
  }

  function compactTick(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return value;
    if (Math.abs(number) >= 1e6 || (number !== 0 && Math.abs(number) < 1e-3)) return number.toExponential(1);
    return number.toPrecision(4);
  }

  function initializeCharts() {
    if (typeof Chart === "undefined") {
      document.querySelectorAll(".chart-area").forEach((area) => {
        area.innerHTML = '<p class="helper-text">Live graphs need a connection to load Chart.js.</p>';
      });
      return;
    }
    state.charts.distance = makeChart("distance-chart", [
      { label: "Distance", key: "distance", color: "#66d9d4" }
    ], "AU");
    state.charts.energy = makeChart("energy-chart", [
      { label: "Kinetic", key: "energyK", color: "#ffb56b" },
      { label: "Potential", key: "energyP", color: "#70a9ff" },
      { label: "Total", key: "energyT", color: "#a88aff" }
    ], "J");
    state.charts.speed = makeChart("speed-chart", [
      { label: "Body 1", key: "speed1", color: COLORS[0] },
      { label: "Body 2", key: "speed2", color: COLORS[1] }
    ], "km/s");
  }

  function restartFromInputs() {
    try {
      const bodies = readBodiesFromInputs();
      const separation = Math.hypot(bodies[1].x - bodies[0].x, bodies[1].y - bodies[0].y);
      const contactDistance = bodies[0].radius + bodies[1].radius;
      if (separation <= contactDistance) {
        throw new Error("Initial separation must be greater than the estimated body radii.");
      }
      if (ui.zeroComVelocity.checked) {
        const totalMass = bodies[0].mass + bodies[1].mass;
        const velocityX = (bodies[0].mass * bodies[0].vx + bodies[1].mass * bodies[1].vx) / totalMass;
        const velocityY = (bodies[0].mass * bodies[0].vy + bodies[1].mass * bodies[1].vy) / totalMass;
        // Removing a common boost zeros momentum without changing relative velocity.
        bodies.forEach((body) => {
          body.vx -= velocityX;
          body.vy -= velocityY;
        });
      }
      state.bodies = bodies;
      const acceleration = accelerationFor(bodies);
      bodies.forEach((body, index) => {
        body.ax = acceleration[index].x;
        body.ay = acceleration[index].y;
      });
      state.prevPositions = bodies.map(clonePosition);
      state.trails = [[], []];
      state.trails[0].push({ x: bodies[0].x, y: bodies[0].y, time: 0 });
      state.trails[1].push({ x: bodies[1].x, y: bodies[1].y, time: 0 });
      state.elapsed = 0;
      state.accumulator = 0;
      state.chartSampleElapsed = 0;
      state.trailLastTime = 0;
      state.collision = false;
      state.running = true;
      ui.collisionBanner.hidden = true;
      updatePlayButton();
      const data = diagnostics();
      state.orbitalPeriod = data.period;
      updateTrailLengthLabel();
      state.initialEnergy = data.totalEnergy;
      state.initialAngularMomentum = data.angularMomentumSigned;
      state.actualSpeed = 0;
      state.speedWindowStartAt = performance.now();
      state.speedWindowStartElapsed = state.elapsed;
      state.fitDistanceAU = Math.max(separation / AU, 0.12) * 1.3;
      ui.separation.value = formatInput(separation / AU);
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      state.autoFit = true;
      resetCharts();
      refreshTelemetry(data);
      drawScene();
      return true;
    } catch (error) {
      window.alert(error.message);
      return false;
    }
  }

  function integrationStep(dt) {
    const [a, b] = state.bodies;
    const separation = Math.hypot(b.x - a.x, b.y - a.y);
    if (separation <= a.radius + b.radius) {
      state.collision = true;
      state.running = false;
      ui.collisionBanner.hidden = false;
      updatePlayButton();
      return false;
    }
    const oldRelativeX = b.x - a.x;
    const oldRelativeY = b.y - a.y;
    const oldPositions = state.bodies.map(clonePosition);
    state.prevPositions = oldPositions;
    const halfDtSquared = 0.5 * dt * dt;
    for (const body of state.bodies) {
      body.x += body.vx * dt + body.ax * halfDtSquared;
      body.y += body.vy * dt + body.ay * halfDtSquared;
    }
    const relativeStepX = (b.x - a.x) - oldRelativeX;
    const relativeStepY = (b.y - a.y) - oldRelativeY;
    const stepLengthSquared = relativeStepX * relativeStepX + relativeStepY * relativeStepY;
    const contactRadius = a.radius + b.radius;
    const startDistance = Math.hypot(oldRelativeX, oldRelativeY);
    const stepDistance = Math.sqrt(stepLengthSquared);
    if (startDistance <= contactRadius + stepDistance) {
      const closestFraction = stepLengthSquared > 0
        ? Math.max(0, Math.min(1, -(oldRelativeX * relativeStepX + oldRelativeY * relativeStepY) / stepLengthSquared))
        : 0;
      const closestX = oldRelativeX + closestFraction * relativeStepX;
      const closestY = oldRelativeY + closestFraction * relativeStepY;
      if (Math.hypot(closestX, closestY) <= contactRadius) {
        const quadraticA = stepLengthSquared;
        const quadraticB = 2 * (oldRelativeX * relativeStepX + oldRelativeY * relativeStepY);
        const quadraticC = oldRelativeX * oldRelativeX + oldRelativeY * oldRelativeY - contactRadius * contactRadius;
        const discriminant = Math.max(0, quadraticB * quadraticB - 4 * quadraticA * quadraticC);
        const contactFraction = quadraticA > 0
          ? Math.max(0, Math.min(1, (-quadraticB - Math.sqrt(discriminant)) / (2 * quadraticA)))
          : closestFraction;
        state.bodies.forEach((body, index) => {
          body.x = oldPositions[index].x + (body.x - oldPositions[index].x) * contactFraction;
          body.y = oldPositions[index].y + (body.y - oldPositions[index].y) * contactFraction;
        });
        state.elapsed += dt * contactFraction;
        state.collision = true;
        state.running = false;
        ui.collisionBanner.hidden = false;
        updatePlayButton();
        return false;
      }
    }
    const nextAcceleration = accelerationFor(state.bodies);
    state.bodies.forEach((body, index) => {
      body.vx += 0.5 * (body.ax + nextAcceleration[index].x) * dt;
      body.vy += 0.5 * (body.ay + nextAcceleration[index].y) * dt;
      body.ax = nextAcceleration[index].x;
      body.ay = nextAcceleration[index].y;
    });
    state.elapsed += dt;
    return true;
  }

  function animate(timestamp) {
    if (!state.lastFrame) state.lastFrame = timestamp;
    const frameSeconds = Math.max(0, (timestamp - state.lastFrame) / 1000);
    state.lastFrame = timestamp;
    if (state.running) {
      const dt = Number(ui.timestep.value) * DAY;
      state.accumulator += frameSeconds * state.requestedSpeed * DAY;
      let steps = 0;
      const physicsStart = performance.now();
      while (state.accumulator >= dt && steps < MAX_PHYSICS_STEPS_PER_FRAME &&
          performance.now() - physicsStart < MAX_PHYSICS_BUDGET_MS && state.running) {
        if (!integrationStep(dt)) break;
        state.accumulator -= dt;
        steps += 1;
        state.chartSampleElapsed += dt;
        if (state.elapsed - state.trailLastTime >= trailSampleInterval()) addTrailPoint();
        const chartInterval = Math.max(DAY, state.requestedSpeed * DAY / 30);
        if (state.chartSampleElapsed >= chartInterval) {
          state.chartSampleElapsed %= chartInterval;
          appendChartSample(diagnostics());
        }
      }
    }
    drawScene();
    updateActualSpeed(timestamp);
    if (timestamp - state.lastUiUpdate > 150) {
      refreshTelemetry();
      updateCharts();
      state.lastUiUpdate = timestamp;
    }
    requestAnimationFrame(animate);
  }

  function addTrailPoint() {
    state.bodies.forEach((body, index) => {
      const trail = state.trails[index];
      trail.push({ x: body.x, y: body.y, time: state.elapsed });
      if (trail.length > MAX_TRAIL_POINTS) trail.splice(0, trail.length - MAX_TRAIL_POINTS);
    });
    state.trailLastTime = state.elapsed;
  }

  function trailSampleInterval() {
    const step = Number(ui.timestep.value) * DAY;
    const duration = (state.orbitalPeriod || YEAR) * Number(ui.trailLength.value);
    return Math.max(step * 4, duration / MAX_TRAIL_POINTS);
  }

  function trimTrails() {
    const duration = (state.orbitalPeriod || YEAR) * Number(ui.trailLength.value);
    state.trails.forEach((trail) => {
      while (trail.length > 1 && state.elapsed - trail[0].time > duration) trail.shift();
    });
  }

  function updateActualSpeed(timestamp) {
    if (!state.running) {
      state.actualSpeed = 0;
      state.speedWindowStartAt = timestamp;
      state.speedWindowStartElapsed = state.elapsed;
      return;
    }
    const windowSeconds = (timestamp - state.speedWindowStartAt) / 1000;
    if (windowSeconds >= 0.5) {
      state.actualSpeed = Math.max(0,
        (state.elapsed - state.speedWindowStartElapsed) / DAY / windowSeconds);
      state.speedWindowStartAt = timestamp;
      state.speedWindowStartElapsed = state.elapsed;
    }
  }

  function updateCharts() {
    Object.values(state.charts).forEach((chart) => {
      chart.data.labels = state.chartTime;
      chart.data.datasets.forEach((dataset) => {
        dataset.data = state.chartData[dataset.key];
      });
      chart.update("none");
    });
  }

  function refreshTelemetry(data = diagnostics()) {
    const [a, b] = state.bodies;
    const energyErrorPercent = state.initialEnergy !== 0
      ? Math.abs(data.totalEnergy - state.initialEnergy) / Math.abs(state.initialEnergy) * 100
      : null;
    const angularMomentumErrorPercent = state.initialAngularMomentum !== 0
      ? Math.abs(data.angularMomentumSigned - state.initialAngularMomentum) /
        Math.abs(state.initialAngularMomentum) * 100
      : null;
    $("distance-value").textContent = formatDistance(data.distance);
    $("distance-unit").textContent = data.distance / AU < 0.01 ? "km" : "AU";
    $("speed1-value").textContent = formatNumber(Math.hypot(a.vx, a.vy) / 1000, 3);
    $("speed2-value").textContent = formatNumber(Math.hypot(b.vx, b.vy) / 1000, 3);
    $("relative-speed").textContent = formatNumber(data.relativeSpeed / 1000, 3);
    $("kinetic-energy").textContent = formatScientific(data.kinetic);
    $("potential-energy").textContent = formatScientific(data.potential);
    $("total-energy").textContent = formatScientific(data.totalEnergy);
    $("angular-momentum").textContent = formatScientific(data.angularMomentum);
    $("eccentricity").textContent = Number.isFinite(data.eccentricity) ? data.eccentricity.toFixed(5) : "—";
    $("orbit-class").textContent = data.period ? "ELLIPTICAL · BOUND" :
      data.eccentricity > 1 + 1e-5 ? "HYPERBOLIC · ESCAPE" : "PARABOLIC";
    $("period-value").textContent = data.period ? formatTime(data.period) : "—";
    $("period-unit").textContent = data.period ? "orbital period" : "unbound trajectory";
    const elapsedDays = state.elapsed / DAY;
    $("elapsed-time").textContent = elapsedDays >= 365.25 ? (elapsedDays / 365.25).toFixed(3) : elapsedDays.toFixed(3);
    $("elapsed-unit").textContent = elapsedDays >= 365.25 ? "years" : "days";
    $("com-value").textContent = `${(data.com.x / AU).toFixed(4)}, ${(data.com.y / AU).toFixed(4)}`;
    $("com-velocity-value").textContent =
      `${formatComVelocity(data.comVelocity.x)}, ${formatComVelocity(data.comVelocity.y)}`;
    $("selected-speed").textContent = formatSpeed(state.requestedSpeed);
    $("actual-speed").textContent = formatSpeed(state.actualSpeed);
    $("actual-speed").title = state.actualSpeed + " simulated days per real second";
    $("actual-speed").closest(".metric-card").classList.toggle(
      "speed-limited",
      state.running && state.actualSpeed < state.requestedSpeed * 0.95
    );
    if (state.orbitalPeriod) {
      const completed = Math.floor(state.elapsed / state.orbitalPeriod);
      const progress = (state.elapsed / state.orbitalPeriod - completed) * 100;
      $("completed-revolutions").textContent = String(completed);
      $("revolution-progress").textContent = `${progress.toFixed(0)}% through next orbit`;
    } else {
      $("completed-revolutions").textContent = "0";
      $("revolution-progress").textContent = "unbound trajectory";
    }
    $("energy-error").textContent = energyErrorPercent === null || !Number.isFinite(energyErrorPercent)
      ? "N/A"
      : `${energyErrorPercent.toFixed(energyErrorPercent < 0.001 ? 4 : 3)}%`;
    $("angular-momentum-error").textContent =
      angularMomentumErrorPercent === null || !Number.isFinite(angularMomentumErrorPercent)
        ? "N/A"
        : `${angularMomentumErrorPercent.toFixed(angularMomentumErrorPercent < 0.001 ? 4 : 3)}%`;
    ui.energyIndicator.classList.toggle("warn", energyErrorPercent !== null && energyErrorPercent > 0.1);
    $("angular-momentum-indicator").classList.toggle(
      "warn",
      angularMomentumErrorPercent !== null && angularMomentumErrorPercent > 0.1
    );
    $("presentation-elapsed").textContent =
      `${Number($("elapsed-time").textContent).toFixed(3)} ${$("elapsed-unit").textContent}`;
    $("presentation-speed").textContent = `${formatSpeed(state.requestedSpeed)} days/s`;
    const unbound = data.specificEnergy >= 0;
    $("orbit-status").classList.toggle("unbound", unbound);
    $("orbit-status").querySelector("span").textContent = unbound ? "UNBOUND TRAJECTORY" : "BOUND ORBIT";
  }

  function formatDistance(distance) {
    return distance / AU < 0.01 ? formatNumber(distance / 1000, 2) : formatNumber(distance / AU, 5);
  }

  function formatNumber(value, decimals) {
    if (!Number.isFinite(value)) return "—";
    if (Math.abs(value) >= 1e5 || (value !== 0 && Math.abs(value) < 1e-3)) return value.toExponential(2);
    return value.toFixed(decimals);
  }

  function formatComVelocity(metersPerSecond) {
    const kilometersPerSecond = metersPerSecond / 1000;
    if (Math.abs(kilometersPerSecond) < 0.00005) return "0.0000";
    if (Math.abs(kilometersPerSecond) < 0.001) return kilometersPerSecond.toFixed(4);
    return formatNumber(kilometersPerSecond, 4);
  }

  function formatScientific(value) {
    if (!Number.isFinite(value)) return "—";
    return value.toExponential(3);
  }

  function formatSpeed(value) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 1000) return Math.round(value).toLocaleString("en-US");
    return String(Number(value.toPrecision(4)));
  }

  function nearestSpeedLevelIndex(speed) {
    return SPEED_LEVELS.reduce((closest, value, index) =>
      Math.abs(value - speed) < Math.abs(SPEED_LEVELS[closest] - speed) ? index : closest, 0);
  }

  function applyRequestedSpeed(speed, cinematicChange = false) {
    if (!Number.isFinite(speed) || speed < 1 || speed > 10000) {
      window.alert("Simulation speed must be between 1 and 10,000 days per second.");
      ui.speedCustom.value = String(state.requestedSpeed);
      return false;
    }
    state.requestedSpeed = speed;
    ui.speed.value = String(nearestSpeedLevelIndex(speed));
    ui.speedCustom.value = String(speed);
    ui.speedValue.textContent = `${formatSpeed(speed)} d/s`;
    $("selected-speed").textContent = formatSpeed(speed);
    const namedPreset = SPEED_PRESETS.find((preset) => preset.speed === speed);
    ui.speedPreset.value = namedPreset ? String(speed) : "custom";
    if (!cinematicChange) {
      ui.cinematic.checked = false;
      state.cinematicPreviousSpeed = null;
    }
    return true;
  }

  function updateTrailLengthLabel() {
    const isBound = Boolean(state.orbitalPeriod);
    const unit = isBound ? "orbits" : "year window";
    ui.trailLengthValue.textContent = `${Number(ui.trailLength.value).toFixed(2)} ${unit}`;
    $("trail-min-label").textContent = isBound ? "¼ orbit" : "¼ year";
    $("trail-max-label").textContent = isBound ? "2 orbits" : "2 years";
  }

  function formatTime(seconds) {
    const years = seconds / YEAR;
    if (years >= 1) return `${years.toFixed(3)} yr`;
    return `${(seconds / DAY).toFixed(2)} d`;
  }

  function updatePlayButton() {
    const playing = state.running;
    ui.playIcon.textContent = playing ? "Ⅱ" : "▶";
    ui.playLabel.textContent = playing ? "Pause" : "Play";
    ui.playButton.setAttribute("aria-label", playing ? "Pause simulation" : "Play simulation");
  }

  function resizeCanvas() {
    const rect = ui.canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.canvasWidth = rect.width;
    state.canvasHeight = rect.height;
    ui.canvas.width = Math.round(rect.width * state.dpr);
    ui.canvas.height = Math.round(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.stars = createStars(Math.ceil(rect.width * rect.height / 6000));
    drawScene();
  }

  function createStars(count) {
    let seed = 23891;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: Math.min(count, 240) }, () => ({
      x: random() * state.canvasWidth,
      y: random() * state.canvasHeight,
      r: 0.35 + random() * 0.9,
      alpha: 0.14 + random() * 0.42
    }));
  }

  function worldScale() {
    const width = state.canvasWidth;
    const height = state.canvasHeight;
    const currentDistanceAU = state.bodies.length === 2
      ? Math.hypot(state.bodies[1].x - state.bodies[0].x, state.bodies[1].y - state.bodies[0].y) / AU
      : 0;
    const fitDistance = state.autoFit
      ? Math.max(state.fitDistanceAU, currentDistanceAU * 1.3, 0.12)
      : state.fitDistanceAU;
    const fitScale = Math.min(width * 0.42, height * 0.39) / fitDistance;
    return fitScale * state.zoom;
  }

  function screenPoint(x, y, com, scale) {
    return {
      x: state.canvasWidth / 2 + state.panX + ((x - com.x) / AU) * scale,
      y: state.canvasHeight / 2 + state.panY - ((y - com.y) / AU) * scale
    };
  }

  function drawScene() {
    if (!ctx || !state.canvasWidth || state.bodies.length !== 2) return;
    const w = state.canvasWidth;
    const h = state.canvasHeight;
    ctx.clearRect(0, 0, w, h);
    const background = ctx.createRadialGradient(w * 0.52, h * 0.48, 0, w * 0.52, h * 0.48, Math.max(w, h) * 0.7);
    background.addColorStop(0, "#0c192b");
    background.addColorStop(0.58, "#091321");
    background.addColorStop(1, "#080e19");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    drawStars();
    const data = diagnostics();
    const scale = worldScale();
    if ($("toggle-grid").checked) drawGrid(data.com, scale);
    const presentationMode = document.body.classList.contains("presentation-mode");
    if ($("toggle-trails").checked || presentationMode) drawTrails(data.com, scale);
    if ($("toggle-com").checked || presentationMode) drawCenterOfMass(data.com);
    const positions = state.bodies.map((body, index) => {
      const previous = state.prevPositions[index] || body;
      const dt = Number(ui.timestep.value) * DAY;
      const alpha = state.running && dt > 0 ? Math.min(1, state.accumulator / dt) : 1;
      const x = previous.x + (body.x - previous.x) * alpha;
      const y = previous.y + (body.y - previous.y) * alpha;
      return screenPoint(x, y, data.com, scale);
    });
    if ($("toggle-velocity").checked) drawVectors("velocity", data.com, scale, positions);
    if ($("toggle-force").checked) drawVectors("force", data.com, scale, positions);
    state.bodies.forEach((body, index) => drawBody(body, positions[index], index));
  }

  function drawStars() {
    for (const star of state.stars) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(185, 210, 239, ${star.alpha})`;
      ctx.fill();
    }
  }

  function drawGrid(com, scale) {
    const visibleAU = Math.max(state.canvasWidth, state.canvasHeight) / scale;
    const step = visibleAU > 20 ? 5 : visibleAU > 8 ? 2 : visibleAU > 3 ? 1 : visibleAU > 1.2 ? 0.5 : 0.2;
    const centerX = state.canvasWidth / 2 + state.panX;
    const centerY = state.canvasHeight / 2 + state.panY;
    const halfX = state.canvasWidth / (2 * scale) + step;
    const halfY = state.canvasHeight / (2 * scale) + step;
    const startX = Math.floor(com.x / AU / step) * step;
    const startY = Math.floor(com.y / AU / step) * step;
    ctx.save();
    ctx.strokeStyle = "rgba(141, 174, 207, .08)";
    ctx.fillStyle = "rgba(141, 174, 207, .35)";
    ctx.lineWidth = 1;
    ctx.font = "8px 'DM Mono', monospace";
    ctx.setLineDash([2, 5]);
    for (let x = startX - halfX; x <= startX + halfX; x += step) {
      const sx = centerX + (x * AU - com.x) / AU * scale;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, state.canvasHeight); ctx.stroke();
      if (Math.abs(sx - centerX) < state.canvasWidth / 2 - 20) ctx.fillText(`${x.toFixed(step < 1 ? 1 : 0)} AU`, sx + 4, centerY + 13);
    }
    for (let y = startY - halfY; y <= startY + halfY; y += step) {
      const sy = centerY - (y * AU - com.y) / AU * scale;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(state.canvasWidth, sy); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTrails(com, scale) {
    state.trails.forEach((trail, index) => {
      if (trail.length < 2) return;
      ctx.save();
      ctx.beginPath();
      trail.forEach((point, pointIndex) => {
        const screen = screenPoint(point.x, point.y, com, scale);
        if (pointIndex === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.strokeStyle = index === 0 ? "rgba(255,181,107,.62)" : "rgba(112,169,255,.78)";
      ctx.lineWidth = 1.3;
      ctx.setLineDash(index === 0 ? [] : [5, 4]);
      ctx.shadowColor = index === 0 ? "rgba(255,181,107,.25)" : "rgba(112,169,255,.3)";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawCenterOfMass(com) {
    const x = state.canvasWidth / 2 + state.panX;
    const y = state.canvasHeight / 2 + state.panY;
    ctx.save();
    ctx.strokeStyle = "rgba(102,217,212,.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawVectors(type, com, scale, positions) {
    const maxSpeed = Math.max(...state.bodies.map((body) => Math.hypot(body.vx, body.vy)), 1);
    const maxForce = Math.max(...state.bodies.map((body) => body.mass * Math.hypot(body.ax, body.ay)), 1);
    state.bodies.forEach((body, index) => {
      let dx;
      let dy;
      if (type === "velocity") {
        const magnitude = Math.hypot(body.vx, body.vy);
        dx = body.vx / (magnitude || 1) * (18 + 34 * magnitude / maxSpeed);
        dy = -body.vy / (magnitude || 1) * (18 + 34 * magnitude / maxSpeed);
      } else {
        const magnitude = Math.hypot(body.ax, body.ay);
        const screenLength = 17 + 35 * (body.mass * magnitude) / maxForce;
        dx = body.ax / (magnitude || 1) * screenLength;
        dy = -body.ay / (magnitude || 1) * screenLength;
      }
      drawArrow(positions[index].x, positions[index].y, dx, dy,
        type === "velocity" ? "rgba(175,213,255,.92)" : "rgba(255,133,145,.92)");
    });
  }

  function drawArrow(x, y, dx, dy, color) {
    const endX = x + dx;
    const endY = y + dy;
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - 6 * Math.cos(angle - Math.PI / 6), endY - 6 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(endX - 6 * Math.cos(angle + Math.PI / 6), endY - 6 * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawBody(body, position, index) {
    const massEarths = body.mass / EARTH_MASS;
    let radius = Math.max(5, Math.min(15, 5.3 + Math.log10(Math.max(massEarths, 0.001)) * 1.25));
    if ($("toggle-size").checked && massEarths < 1000) radius = Math.max(radius, 8);
    ctx.save();
    const glow = ctx.createRadialGradient(position.x, position.y, radius * 0.3, position.x, position.y, radius * 3.8);
    glow.addColorStop(0, index === 0 ? "rgba(255,181,107,.45)" : "rgba(112,169,255,.42)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(position.x, position.y, radius * 3.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body.color;
    ctx.shadowColor = body.color;
    ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(position.x, position.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.76)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(position.x, position.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(231,239,250,.85)";
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.fillText(body.name, position.x + radius + 8, position.y - radius - 5);
    ctx.restore();
  }

  function changeZoom(factor) {
    captureCurrentFit();
    state.zoom = Math.max(0.2, Math.min(12, state.zoom * factor));
    $("zoom-readout").textContent = `${Math.round(state.zoom * 100)}%`;
    drawScene();
  }

  function captureCurrentFit() {
    if (state.bodies.length === 2) {
      const currentDistanceAU = Math.hypot(
        state.bodies[1].x - state.bodies[0].x,
        state.bodies[1].y - state.bodies[0].y
      ) / AU;
      state.fitDistanceAU = Math.max(state.fitDistanceAU, currentDistanceAU * 1.3);
    }
    state.autoFit = false;
  }

  function resetCamera() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    state.autoFit = true;
    $("zoom-readout").textContent = "100%";
    drawScene();
  }

  function setStepLabel() {
    const days = Number(ui.timestep.value);
    ui.timestepValue.textContent = `${days.toFixed(3)} d`;
    $("frame-step").textContent = `STEP ${days.toFixed(3)} D`;
  }

  function wireEvents() {
    ui.preset.addEventListener("change", () => setPreset(ui.preset.value));
    ui.separation.addEventListener("change", () => {
      try {
        const requestedDistance = Number(ui.separation.value) * AU;
        const mass1 = Number($("mass1").value) * EARTH_MASS;
        const mass2 = Number($("mass2").value) * EARTH_MASS;
        const x1 = Number($("x1").value) * AU;
        const y1 = Number($("y1").value) * AU;
        const x2 = Number($("x2").value) * AU;
        const y2 = Number($("y2").value) * AU;
        const currentDistance = Math.hypot(x2 - x1, y2 - y1);
        if (![requestedDistance, mass1, mass2, currentDistance].every(Number.isFinite) ||
            requestedDistance <= 0 || mass1 <= 0 || mass2 <= 0 || currentDistance <= 0) {
          throw new Error("Enter a positive separation and valid positive masses.");
        }
        const centerX = (mass1 * x1 + mass2 * x2) / (mass1 + mass2);
        const centerY = (mass1 * y1 + mass2 * y2) / (mass1 + mass2);
        const scale = requestedDistance / currentDistance;
        const relativeX = (x2 - x1) * scale;
        const relativeY = (y2 - y1) * scale;
        $("x1").value = formatInput((centerX - mass2 / (mass1 + mass2) * relativeX) / AU);
        $("y1").value = formatInput((centerY - mass2 / (mass1 + mass2) * relativeY) / AU);
        $("x2").value = formatInput((centerX + mass1 / (mass1 + mass2) * relativeX) / AU);
        $("y2").value = formatInput((centerY + mass1 / (mass1 + mass2) * relativeY) / AU);
        restartFromInputs();
      } catch (error) {
        window.alert(error.message);
      }
    });
    $("apply-button").addEventListener("click", restartFromInputs);
    $("restart-button").addEventListener("click", restartFromInputs);
    $("scene-restart").addEventListener("click", restartFromInputs);
    ui.zeroComVelocity.addEventListener("change", restartFromInputs);
    $("reset-button").addEventListener("click", () => setPreset(ui.preset.value));
    inputIds.forEach((id) => {
      $(id).addEventListener("change", restartFromInputs);
      $(id).addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          restartFromInputs();
        }
      });
    });
    ui.playButton.addEventListener("click", () => {
      if (state.collision) return;
      state.running = !state.running;
      state.lastFrame = 0;
      updatePlayButton();
    });
    ui.timestep.addEventListener("input", () => {
      setStepLabel();
    });
    ui.speedPreset.addEventListener("change", () => {
      if (ui.speedPreset.value !== "custom") {
        applyRequestedSpeed(Number(ui.speedPreset.value));
      } else {
        ui.speedCustom.focus();
      }
    });
    ui.speed.addEventListener("input", () => {
      applyRequestedSpeed(SPEED_LEVELS[Number(ui.speed.value)]);
    });
    ui.speedCustom.addEventListener("change", () => {
      applyRequestedSpeed(Number(ui.speedCustom.value));
    });
    ui.cinematic.addEventListener("change", () => {
      if (ui.cinematic.checked) {
        state.cinematicPreviousSpeed = state.requestedSpeed;
        applyRequestedSpeed(365, true);
      } else {
        const restoreSpeed = state.cinematicPreviousSpeed || 100;
        state.cinematicPreviousSpeed = null;
        applyRequestedSpeed(restoreSpeed);
      }
    });
    ui.trailLength.addEventListener("input", () => {
      updateTrailLengthLabel();
      trimTrails();
      drawScene();
    });
    $("presentation-button").addEventListener("click", (event) => {
      const enabled = document.body.classList.toggle("presentation-mode");
      event.currentTarget.setAttribute("aria-pressed", String(enabled));
      event.currentTarget.innerHTML = enabled ? '<span aria-hidden="true">⛶</span> Exit presentation' : '<span aria-hidden="true">⛶</span> Presentation mode';
      window.setTimeout(resizeCanvas, 50);
    });
    $("zoom-in").addEventListener("click", () => changeZoom(1.25));
    $("zoom-out").addEventListener("click", () => changeZoom(0.8));
    $("zoom-readout").addEventListener("click", resetCamera);
    $("camera-reset").addEventListener("click", resetCamera);
    ["toggle-trails", "toggle-velocity", "toggle-force", "toggle-grid", "toggle-com", "toggle-size"].forEach((id) => {
      $(id).addEventListener("change", () => {
        $("legend-com").style.opacity = $("toggle-com").checked ? "1" : ".35";
        $("visual-scale-note").hidden = !$("toggle-size").checked;
        drawScene();
      });
    });
    $("data-collapse").addEventListener("click", () => {
      const collapsed = $("data-panel").classList.toggle("collapsed");
      document.body.classList.toggle("data-collapsed", collapsed);
      $("data-collapse").setAttribute("aria-expanded", String(!collapsed));
      $("data-collapse").setAttribute("aria-label", collapsed ? "Expand live telemetry panel" : "Collapse live telemetry panel");
      $("data-collapse").title = collapsed ? "Expand telemetry" : "Collapse telemetry";
      window.setTimeout(resizeCanvas, 50);
    });
    ui.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    let pointer = null;
    ui.canvas.addEventListener("pointerdown", (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      ui.canvas.classList.add("dragging");
      ui.canvas.setPointerCapture(event.pointerId);
    });
    ui.canvas.addEventListener("pointermove", (event) => {
      if (!pointer) return;
      state.panX += event.clientX - pointer.x;
      state.panY += event.clientY - pointer.y;
      pointer = { x: event.clientX, y: event.clientY };
      captureCurrentFit();
      drawScene();
    });
    const endPan = () => { pointer = null; ui.canvas.classList.remove("dragging"); };
    ui.canvas.addEventListener("pointerup", endPan);
    ui.canvas.addEventListener("pointercancel", endPan);
    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("visibilitychange", () => {
      state.lastFrame = 0;
      state.speedWindowStartAt = performance.now();
      state.speedWindowStartElapsed = state.elapsed;
      if (document.hidden && state.running) {
        state.running = false;
        state.actualSpeed = 0;
        updatePlayButton();
        refreshTelemetry();
      }
    });
  }

  initializeCharts();
  wireEvents();
  setStepLabel();
  ui.preset.value = "binary";
  $("visual-scale-note").hidden = !$("toggle-size").checked;
  setPreset("binary");
  applyRequestedSpeed(Number(ui.speedCustom.value));
  updateTrailLengthLabel();
  resizeCanvas();
  requestAnimationFrame(animate);
})();
