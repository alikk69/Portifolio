// ---- Intro: plays once per session, then wipes diagonally into the hero ----
(function () {
  const overlay = document.getElementById("introOverlay");
  const heroInner = document.querySelector(".hero-inner");
  const introChip = document.getElementById("introChip");
  const introCycle = document.getElementById("introCycle");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alreadyPlayed = sessionStorage.getItem("introPlayed") === "true";
  const html = document.documentElement;

  function revealHero() {
    if (heroInner) heroInner.classList.add("is-revealed");
  }

  function unlockScroll() {
    html.style.overflow = "";
    document.body.style.overflow = "";
  }

  if (!overlay) {
    revealHero();
    return;
  }

  if (reducedMotion || alreadyPlayed) {
    overlay.classList.add("is-leaving", "is-hidden");
    revealHero();
    return;
  }

  // A quick terminal-style readout, more informative than a static name
  const cyclePhrases = ["Banking & Finance", "Business Development", "Fintech Research", "Bahrain · GCC"];
  let cycleIndex = 0;
  if (introCycle) {
    const cycleTimer = setInterval(() => {
      cycleIndex = (cycleIndex + 1) % cyclePhrases.length;
      introCycle.textContent = cyclePhrases[cycleIndex];
    }, 380);
    setTimeout(() => clearInterval(cycleTimer), 2000);
  }

  // A light parallax on the chip, so the curtain isn't just static
  if (introChip) {
    overlay.addEventListener("mousemove", (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      introChip.style.transform = `translate(${x * 14}px, ${y * 10}px)`;
    });
  }

  sessionStorage.setItem("introPlayed", "true");
  html.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    overlay.classList.add("is-leaving");
    revealHero();
    unlockScroll();
    overlay.addEventListener("animationend", () => overlay.classList.add("is-hidden"), { once: true });
  }, 2000);
})();

// ---- GSAP: register once, guard every use so a blocked/slow CDN never
// breaks the page — everything else here already works without it ----
const gsapReady = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
if (gsapReady) {
  gsap.registerPlugin(ScrollTrigger);
}
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Top ticker: the CSS loop (translateX(0) -> translateX(-50%) over an
// exactly-doubled track) only reads as seamless if one lap of content is
// at least as wide as the viewport — otherwise the second half runs out
// before covering the visible bar, leaving empty ticker background on
// the right for part of every cycle (looks like the text "doesn't reach
// the far right," and like the loop stutters/resets instead of flowing).
// A single static duplication was only ~900px, well short of any normal
// desktop width, so this rebuilds it with however many laps are actually
// needed for the current viewport, then doubles that for the loop.
(function () {
  const track = document.getElementById("topTickerTrack");
  if (!track) return;
  const oneLap = track.innerHTML;
  const baseDuration = 32;

  function resizeTicker() {
    let reps = 1;
    let html = oneLap;
    track.innerHTML = html;
    while (track.scrollWidth < window.innerWidth && reps < 20) {
      reps++;
      html += oneLap;
      track.innerHTML = html;
    }
    track.innerHTML = html + html;
    track.style.animationDuration = `${baseDuration * reps}s`;
  }

  resizeTicker();
  let tickerResizeRaf = null;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(tickerResizeRaf);
    tickerResizeRaf = requestAnimationFrame(resizeTicker);
  });
})();

// ---- Global backdrop: a real 3D financial skyline (Three.js/WebGL) —
// each tower is an actual candlestick (open/close body + high/low wick)
// across seven parallel price-series "streets," an actual OHLC chart
// standing up as a district, not a decorative box grid. Camera flies
// through as the page scrolls, plus a subtle mouse-driven drift on
// desktop. A field of warm motes drifts up through the towers and the
// vermillion "signal" candles breathe gently, so the scene never sits
// still even at a fixed scroll position. Desktop + WebGL only; bails out
// cleanly to the plain gradient backdrop (see CSS) on mobile, reduced
// motion, or if WebGL/Three.js aren't available — never a blank canvas.
//
// Tower geometry/lanes based on a design handoff (design_handoff_
// candlestick_skyline); particles + accent pulsing added on top ----
(function () {
  const canvas = document.getElementById("skylineCanvas");
  if (!canvas) return;
  if (prefersReducedMotion || window.innerWidth < 900 || typeof THREE === "undefined") return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    return;
  }
  if (!renderer) return;

  const PAPER = 0xfbf9f4;
  const PAPER_PANEL = 0xf1ebdd;
  const GOLD = 0xc13a20; // vermillion — "up"/signal candles

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PAPER, 0.0055);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(0, 13, 62);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Bright, soft, shadow-free lighting — this stays a light scene, never a dark one.
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xfff2df, 0.9);
  sun.position.set(40, 90, 40);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdbe6ff, 0.4);
  fill.position.set(-50, 30, -10);
  scene.add(fill);
  const rim = new THREE.PointLight(GOLD, 0.6, 220);
  rim.position.set(0, 40, -120);
  scene.add(rim);

  // Ground: a faint ruled plane, like graph paper, reinforcing the chart metaphor.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 700),
    new THREE.MeshStandardMaterial({ color: PAPER_PANEL, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  const gridHelper = new THREE.GridHelper(600, 60, 0xd8cfb8, 0xe7e0d0);
  scene.add(gridHelper);

  // ---- Candlestick towers: seven parallel "streets," each a continuous
  // random-walk price series. Body = open/close range, wick = full
  // high/low range — an actual OHLC chart standing up as a skyline.
  const LANES = 7;
  const STEPS = 46;
  const STEP_SPACING = 7.2;
  const JOURNEY_DEPTH = STEPS * STEP_SPACING;
  const LANE_SPACING = 20;
  const HEIGHT_SCALE = 2.1;

  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const wickGeo = new THREE.BoxGeometry(1, 1, 1);

  function makeBodyMaterial(color, isAccent) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.25,
      metalness: 0.15,
      transparent: true,
      opacity: isAccent ? 0.96 : 0.88,
      emissive: isAccent ? color : 0x000000,
      emissiveIntensity: isAccent ? 0.85 : 0,
    });
  }

  const glassWick = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55,
  });

  // Every candle is tracked so tick() can give the whole skyline a gentle,
  // continuous sway — independent of scroll/mouse, so the district never
  // sits fully frozen even if the visitor never touches either.
  const towers = [];
  // Accent candle bodies are tracked separately so tick() can also make
  // them breathe — a slow emissive pulse layered on top of the sway.
  const accentBodies = [];

  for (let lane = 0; lane < LANES; lane++) {
    const laneX = (lane - (LANES - 1) / 2) * LANE_SPACING + (Math.random() - 0.5) * 4;
    let price = 20 + Math.random() * 10;
    const footprint = 2.6 + Math.random() * 1.4;

    for (let s = 0; s < STEPS; s++) {
      const open = price;
      const drift = (Math.random() - 0.48) * 6;
      const close = Math.max(4, open + drift);
      const high = Math.max(open, close) + Math.random() * 3.5;
      const low = Math.max(1, Math.min(open, close) - Math.random() * 3);
      price = close;

      const isUp = close >= open;
      const bodyLow = Math.min(open, close);
      const bodyHigh = Math.max(open, close);
      const bodyHeight = Math.max(1.2, (bodyHigh - bodyLow) * HEIGHT_SCALE);
      const wickHeight = Math.max(bodyHeight + 1, (high - low) * HEIGHT_SCALE);

      const z = -s * STEP_SPACING;
      const jitterX = (Math.random() - 0.5) * 1.2;

      // ~20% of candles are the vermillion "signal" towers; the rest sit
      // as quiet glass mass (white/paper), whichever direction they moved.
      const isAccent = Math.random() < 0.2;
      const bodyColor = isAccent ? GOLD : isUp ? PAPER : PAPER_PANEL;
      const body = new THREE.Mesh(bodyGeo, makeBodyMaterial(bodyColor, isAccent));
      body.scale.set(footprint, bodyHeight, footprint);
      const baseBodyY = bodyLow * HEIGHT_SCALE + bodyHeight / 2;
      body.position.set(laneX + jitterX, baseBodyY, z);
      scene.add(body);
      if (isAccent) accentBodies.push({ mesh: body, phase: Math.random() * Math.PI * 2 });

      const wick = new THREE.Mesh(wickGeo, glassWick);
      wick.scale.set(footprint * 0.22, wickHeight, footprint * 0.22);
      const baseWickY = low * HEIGHT_SCALE + wickHeight / 2;
      wick.position.set(laneX + jitterX, baseWickY, z);
      scene.add(wick);

      towers.push({
        body,
        wick,
        baseBodyY,
        baseWickY,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.35,
      });
    }
  }

  // ---- Floating motes: warm particles drifting slowly upward through the
  // district, wrapping back to street level once they clear the towers —
  // "constant motion" that reads even when scroll and mouse are both idle.
  const MOTE_COUNT = 260;
  const moteGeo = new THREE.BufferGeometry();
  const motePositions = new Float32Array(MOTE_COUNT * 3);
  const moteSpeeds = new Float32Array(MOTE_COUNT);
  for (let i = 0; i < MOTE_COUNT; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 170;
    motePositions[i * 3 + 1] = Math.random() * 55;
    motePositions[i * 3 + 2] = -Math.random() * JOURNEY_DEPTH;
    moteSpeeds[i] = 0.04 + Math.random() * 0.08;
  }
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  const moteMaterial = new THREE.PointsMaterial({
    color: GOLD,
    size: 0.55,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const motes = new THREE.Points(moteGeo, moteMaterial);
  scene.add(motes);

  // ---- Floor objects: a handful of random 3D primitives scattered at
  // street level in the gaps between lanes — interactive via raycasting.
  // Hover highlights and lifts them; click gives a quick pop/spin, tweened
  // directly with GSAP (it animates any object property, not just DOM) ----
  const FLOOR_SHAPES = [
    () => new THREE.IcosahedronGeometry(1, 0),
    () => new THREE.OctahedronGeometry(1, 0),
    () => new THREE.TorusGeometry(0.8, 0.3, 12, 24),
    () => new THREE.TetrahedronGeometry(1, 0),
    () => new THREE.DodecahedronGeometry(1, 0),
    () => new THREE.SphereGeometry(1, 20, 16),
  ];
  const floorObjects = [];
  const FLOOR_OBJECT_COUNT = 22;
  const laneEdges = LANES - 1;
  for (let i = 0; i < FLOOR_OBJECT_COUNT; i++) {
    const geo = FLOOR_SHAPES[Math.floor(Math.random() * FLOOR_SHAPES.length)]();
    const isAccent = Math.random() < 0.4;
    const baseEmissive = isAccent ? 0.3 : 0;
    const material = new THREE.MeshStandardMaterial({
      color: isAccent ? GOLD : Math.random() < 0.5 ? PAPER : PAPER_PANEL,
      roughness: 0.25,
      metalness: 0.2,
      transparent: true,
      opacity: 0.94,
      emissive: isAccent ? GOLD : 0x000000,
      emissiveIntensity: baseEmissive,
    });
    const mesh = new THREE.Mesh(geo, material);

    const scale = 1.2 + Math.random() * 1.7;
    mesh.scale.setScalar(scale);

    // Sit in a gap between two lanes, not inside one, so they read as
    // street-level objects rather than clipping through candle bodies.
    const gapIndex = Math.floor(Math.random() * laneEdges) - (laneEdges - 1) / 2;
    const x = gapIndex * LANE_SPACING + (Math.random() - 0.5) * 6;
    const z = -Math.random() * JOURNEY_DEPTH;
    mesh.position.set(x, scale, z);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    mesh.userData.baseScale = scale;
    mesh.userData.baseEmissive = baseEmissive;
    mesh.userData.rotSpeedX = (Math.random() - 0.5) * 0.011;
    mesh.userData.rotSpeedY = 0.007 + Math.random() * 0.014;
    mesh.userData.baseY = scale;
    mesh.userData.bobPhase = Math.random() * Math.PI * 2;
    mesh.userData.bobSpeed = 0.5 + Math.random() * 0.5;

    scene.add(mesh);
    floorObjects.push(mesh);
  }

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2(-10, -10);
  let hoveredObject = null;

  function setHover(mesh, isHover) {
    const targetScale = isHover ? mesh.userData.baseScale * 1.28 : mesh.userData.baseScale;
    const targetEmissive = isHover ? 0.7 : mesh.userData.baseEmissive;
    if (gsapReady) {
      gsap.to(mesh.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.35, ease: "power2.out" });
      gsap.to(mesh.material, { emissiveIntensity: targetEmissive, duration: 0.35 });
    } else {
      mesh.scale.setScalar(targetScale);
      mesh.material.emissiveIntensity = targetEmissive;
    }
  }

  function updateFloorHover() {
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(floorObjects, false);
    const next = hits.length ? hits[0].object : null;
    if (next !== hoveredObject) {
      if (hoveredObject) setHover(hoveredObject, false);
      if (next) setHover(next, true);
      hoveredObject = next;
      document.body.style.cursor = next ? "pointer" : "";
    }
  }

  window.addEventListener("click", () => {
    if (!hoveredObject || !gsapReady) return;
    const mesh = hoveredObject;
    gsap.to(mesh.rotation, { y: mesh.rotation.y + Math.PI * 2, duration: 0.9, ease: "power2.out" });
    const s = mesh.userData.baseScale;
    gsap.fromTo(
      mesh.scale,
      { x: s * 1.5, y: s * 1.5, z: s * 1.5 },
      { x: s * 1.28, y: s * 1.28, z: s * 1.28, duration: 0.7, ease: "elastic.out(1, 0.45)" }
    );
  });

  // ---- Orbiting rings: a handful of large, thin torus rings hanging
  // higher above the district, slowly tumbling — a second, higher layer
  // of motion so the scene has real depth (ground-level tumble + floor
  // hover/click + high-altitude drift), not just one plane of activity.
  const RING_COUNT = 5;
  const rings = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const radius = 6 + Math.random() * 5;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.18, 10, 40),
      new THREE.MeshStandardMaterial({
        color: Math.random() < 0.5 ? GOLD : PAPER,
        roughness: 0.3,
        metalness: 0.25,
        transparent: true,
        opacity: 0.5,
        emissive: GOLD,
        emissiveIntensity: 0.12,
      })
    );
    ring.position.set((Math.random() - 0.5) * 130, 34 + Math.random() * 22, -Math.random() * JOURNEY_DEPTH);
    ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    ring.userData.spinX = (Math.random() - 0.5) * 0.006;
    ring.userData.spinZ = (Math.random() - 0.5) * 0.006;
    ring.userData.baseY = ring.position.y;
    ring.userData.bobPhase = Math.random() * Math.PI * 2;
    ring.userData.bobSpeed = 0.2 + Math.random() * 0.2;
    scene.add(ring);
    rings.push(ring);
  }

  // Mouse-driven camera drift, desktop only, smoothed.
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;
  window.addEventListener("mousemove", (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // Scroll-driven journey — same document-scroll ScrollTrigger pattern as
  // the rest of this file's backgrounds.
  let scrollProgress = 0;
  if (gsapReady) {
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5,
      onUpdate: (self) => {
        scrollProgress = self.progress;
      },
    });
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  let announced = false;
  let elapsed = 0;
  function tick() {
    elapsed += 0.016;
    mouseX += (targetMouseX - mouseX) * 0.04;
    mouseY += (targetMouseY - mouseY) * 0.04;

    // A small continuous drift, layered under the scroll/mouse-driven
    // journey, so the camera itself is never fully still either — the
    // whole scene should feel alive even with no scroll and no mouse input.
    const idleSwayX = Math.sin(elapsed * 0.3) * 1.2;
    const idleSwayY = Math.sin(elapsed * 0.23 + 1.7) * 0.6;

    const z = 62 - scrollProgress * (JOURNEY_DEPTH + 40);
    camera.position.x = mouseX * 6 + idleSwayX;
    camera.position.y = 13 - scrollProgress * 6 - mouseY * 2.5 + idleSwayY;
    camera.position.z = z;
    camera.lookAt(mouseX * 10 + idleSwayX * 0.6, 12 - scrollProgress * 3 + idleSwayY * 0.3, z - 55);
    rim.position.z = z - 100;

    // The whole skyline sways gently in place — small, slow, and staggered
    // per tower so it never reads as one robotic pulse — so the candle
    // "cubes" are always visibly moving, not just glowing.
    towers.forEach((t) => {
      const bob = Math.sin(elapsed * t.speed + t.phase) * 0.35;
      t.body.position.y = t.baseBodyY + bob;
      t.wick.position.y = t.baseWickY + bob;
    });

    // Motes drift upward and loop back to street level once they clear the skyline.
    const posAttr = motes.geometry.attributes.position;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const yi = i * 3 + 1;
      posAttr.array[yi] += moteSpeeds[i];
      if (posAttr.array[yi] > 55) posAttr.array[yi] = 0;
    }
    posAttr.needsUpdate = true;

    // Accent candles breathe — a slow, gentle emissive pulse.
    accentBodies.forEach((a) => {
      a.mesh.material.emissiveIntensity = 0.6 + Math.sin(elapsed * 1.4 + a.phase) * 0.35;
    });

    // Floor objects tumble slowly on their own, always — hover/click on
    // top of this via GSAP tweens layered independently above.
    floorObjects.forEach((mesh) => {
      mesh.rotation.x += mesh.userData.rotSpeedX;
      mesh.rotation.y += mesh.userData.rotSpeedY;
      mesh.position.y = mesh.userData.baseY + Math.sin(elapsed * mesh.userData.bobSpeed + mesh.userData.bobPhase) * 0.3;
    });
    updateFloorHover();

    // Rings tumble slowly at high altitude — a second, independent layer of motion.
    rings.forEach((ring) => {
      ring.rotation.x += ring.userData.spinX;
      ring.rotation.z += ring.userData.spinZ;
      ring.position.y = ring.userData.baseY + Math.sin(elapsed * ring.userData.bobSpeed + ring.userData.bobPhase) * 1.2;
    });

    renderer.render(scene, camera);

    if (!announced) {
      announced = true;
      canvas.classList.add("is-ready");
      // Tells the stylesheet the 3D scene is genuinely painting, so the
      // readability scrim over it (see .has-skyline .page::before) is only
      // applied where there's actually a moving background to read
      // against — mobile and no-WebGL keep the plain gradient untouched.
      document.documentElement.classList.add("has-skyline");
    }

    requestAnimationFrame(tick);
  }

  resize();
  let resizeRaf = null;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resize);
  });

  requestAnimationFrame(tick);
})();

// ---- Hero: "Configure the Analyst" — Focus/Sector settings wire
// into one live OUTPUT card. Every value shown is real (pulled from the
// same facts as the Experience/Skills sections), so picking a setting
// actually changes what's displayed, not just decoration ----
(function () {
  const root = document.getElementById("heroConfig");
  if (!root) return;

  const FOCUS_DATA = [{ label: "Business Dev" }, { label: "Fintech Research" }, { label: "Partnerships" }];

  const SECTOR_DATA = {
    technical: { label: "Technical", chips: ["Excel", "Zoho Books", "Monday.com CRM"] },
    business: { label: "Business & Ops", chips: ["Business Development", "Partnership Mgmt", "Project Mgmt"] },
    analytical: { label: "Analytical", chips: ["KPI Monitoring", "Data Accuracy", "Business Analysis"] },
  };

  // Every Focus × Sector combination gets its own blurb — not the same 3
  // sentences reshuffled — so no two picks read as near-duplicates. All
  // still pulled from real facts (Nadher Media, Bahrain Fintech Bay, the
  // Saudi budget/prospect list), just told from a different angle each time.
  const BLURBS = {
    "0-technical":
      "Two CRMs, one migration project, and 20+ partnerships to keep straight, moving Nadher Media's records from Wafeq to Zoho Books without losing a beat.",
    "0-business":
      "Nearly two years driving expansion across Bahrain and Saudi Arabia: 20+ real estate partnerships and 40+ deals coordinated.",
    "0-analytical":
      "The partnerships got the attention, but the research underneath found 200+ prospective clients.",
    "1-technical":
      "A lot of the Bahrain Fintech Bay work happened in spreadsheets and structured notes, turning interview transcripts into something a report could actually use.",
    "1-business":
      "Research Intern at Bahrain Fintech Bay, interviewing industry leaders for a forthcoming report on Bahrain's fintech landscape.",
    "1-analytical":
      "Pattern-finding across a stack of industry interviews, the raw material for a fintech sector report still in progress.",
    "2-technical": "Built the Saudi market's 12-month budget from a blank spreadsheet.",
    "2-business":
      "Coordinating 20+ real estate partnerships from first contact to onboarding: malls, hotels, residential sites, one relationship at a time.",
    "2-analytical":
      "Research and relationships, turned into results: 200+ prospective clients.",
  };

  const state = { focus: 0, sector: "technical" };

  const headlineEl = document.getElementById("configHeadline");
  const blurbEl = document.getElementById("configBlurb");
  const chipsEl = document.getElementById("configChips");

  function render() {
    const f = FOCUS_DATA[state.focus];
    const s = SECTOR_DATA[state.sector];
    if (headlineEl) headlineEl.textContent = `${f.label} · ${s.label}`;
    if (blurbEl) blurbEl.textContent = BLURBS[`${state.focus}-${state.sector}`];
    if (chipsEl) {
      chipsEl.innerHTML = "";
      s.chips.forEach((chip) => {
        const span = document.createElement("span");
        span.className = "config-chip";
        span.textContent = chip;
        chipsEl.appendChild(span);
      });
    }
  }

  root.querySelectorAll(".config-node").forEach((node) => {
    const key = node.dataset.node;
    const options = Array.from(node.querySelectorAll(".config-option"));

    // Roving tabindex. A role="radiogroup" is announced as ONE control, so
    // only the checked radio should be a tab stop — previously all three
    // were, which meant six separate stops to pass two settings, and the
    // arrow keys a screen-reader user is told to use did nothing at all.
    function syncTabStops() {
      options.forEach((b) => {
        b.tabIndex = b.classList.contains("is-active") ? 0 : -1;
      });
    }
    syncTabStops();

    node.addEventListener("keydown", (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      const current = options.indexOf(document.activeElement);
      if (current === -1) return;

      let next = null;
      if (dir) next = (current + dir + options.length) % options.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = options.length - 1;
      else return;

      e.preventDefault();
      // Radio semantics: moving the focus selects, it doesn't just
      // highlight — so the OUTPUT card follows the arrow keys live.
      options[next].focus();
      options[next].click();
    });

    options.forEach((btn) => {
      btn.addEventListener("click", () => {
        node.querySelectorAll(".config-option").forEach((b) => {
          b.classList.remove("is-active");
          b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-checked", "true");
        syncTabStops();
        state[key] = key === "focus" ? parseInt(btn.dataset.value, 10) : btn.dataset.value;
        render();
        if (window.updateConfigWires) window.updateConfigWires();

        // The just-picked option's indicator dot gets a quick "light
        // switching on" pulse (see .is-flashing in style.css); the one
        // that turned off already fades smoothly via its own CSS
        // transition, so together it reads as the light moving between
        // them rather than an instant, silent swap.
        btn.classList.remove("is-flashing");
        void btn.offsetWidth;
        btn.classList.add("is-flashing");
        btn.addEventListener("animationend", () => btn.classList.remove("is-flashing"), { once: true });
      });
    });
  });

  render();

  // Desktop only: draw dashed wires from each setting node into the
  // output card's top edge (mirrors the same "flow wire" language already
  // used in Experience/Achievements), each carrying a small traveling
  // light (SVG animateMotion, re-synced to the path whenever it moves —
  // same technique as the Experience section's edge dot). Skipped below
  // 900px, where the panel is a plain vertical stack instead.
  if (window.matchMedia("(min-width: 901px)").matches) {
    function updateConfigWires() {
      const svg = root.querySelector(".config-wires");
      const output = root.querySelector(".config-output");
      if (!svg || !output) return;
      const rootRect = root.getBoundingClientRect();
      svg.setAttribute("width", rootRect.width);
      svg.setAttribute("height", rootRect.height);
      const outRect = output.getBoundingClientRect();
      const endX = outRect.left - rootRect.left + 24;
      const endY = outRect.top - rootRect.top;
      root.querySelectorAll(".flow-node").forEach((node, i) => {
        const nRect = node.getBoundingClientRect();
        const startX = nRect.left - rootRect.left + nRect.width / 2;
        const startY = nRect.bottom - rootRect.top;
        const path = svg.querySelector(`.config-wire[data-wire="${i}"]`);
        if (!path) return;
        const midY = (startY + endY) / 2;
        const d = `M ${startX},${startY} C ${startX},${midY} ${endX},${midY} ${endX},${endY}`;
        path.setAttribute("d", d);

        const dot = svg.querySelector(`.config-wire-dot[data-wire="${i}"]`);
        const motion = dot && dot.querySelector("animateMotion");
        if (motion) {
          motion.setAttribute("path", d);
          try {
            motion.beginElement();
          } catch (err) {
            // SMIL restart isn't supported everywhere; the dot just stays put.
          }
        }
      });
    }
    window.updateConfigWires = updateConfigWires;
    updateConfigWires();
    window.addEventListener("load", updateConfigWires);
    let configWireRaf = null;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(configWireRaf);
      configWireRaf = requestAnimationFrame(updateConfigWires);
    });
  }
})();

// While Achievements is pinned full-screen (see the big matchMedia block
// near the bottom of this file), the education rail fill's own internal
// scroll-position-based progress gets driven from the pin's scrub
// progress instead — this lock stops the older rect-based scroll handler
// from fighting over the same state while that's active.
let educationScrollProgressLock = false;

// ---- Section headings: split into letters, cascade in as each section
// scrolls into view (adapted from wodniack.dev's per-character title reveal) ----
if (gsapReady && !prefersReducedMotion) {
  function letterReveal(heading, scrollTriggered, delay) {
    const text = heading.textContent;
    heading.setAttribute("aria-label", text);
    heading.textContent = "";
    heading.style.perspective = "500px";

    const chars = [];
    text.split(" ").forEach((word, wIdx, words) => {
      const wordWrap = document.createElement("span");
      wordWrap.style.display = "inline-block";
      wordWrap.style.whiteSpace = "nowrap";
      word.split("").forEach((ch) => {
        const span = document.createElement("span");
        span.className = "letter-char";
        span.setAttribute("aria-hidden", "true");
        span.textContent = ch;
        wordWrap.appendChild(span);
        chars.push(span);
      });
      heading.appendChild(wordWrap);
      if (wIdx < words.length - 1) heading.appendChild(document.createTextNode(" "));
    });

    gsap.set(chars, { opacity: 0, y: 26, rotateX: -70, transformOrigin: "50% 100%" });
    const tweenVars = {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration: 0.55,
      delay: delay || 0,
      ease: "power3.out",
      stagger: 0.028,
    };
    if (scrollTriggered) {
      tweenVars.scrollTrigger = { trigger: heading, start: "top 88%", toggleActions: "play none none none" };
    }
    gsap.to(chars, tweenVars);
  }

  document.querySelectorAll(".section-inner > h2").forEach((heading) => letterReveal(heading, true));

  const heroH1 = document.querySelector(".hero-heading h1");
  if (heroH1) letterReveal(heroH1, false, 1.7);
}

// ---- "About" nav link: since the hero's one-time entrance (letter
// cascade + photo frame) only plays on first load, clicking "About"
// again later — after scrolling away — landed on an already-settled
// section with no feedback. Replay both on every click so selecting it
// always feels like something happened ----
if (gsapReady && !prefersReducedMotion) {
  const aboutNavLink = document.querySelector('#primaryNav a[href="#about"]');
  const heroPhotoWrap = document.querySelector(".photo-wrap");
  const heroHeadingChars = document.querySelectorAll(".hero-heading h1 .letter-char");
  if (aboutNavLink && (heroPhotoWrap || heroHeadingChars.length)) {
    aboutNavLink.addEventListener("click", () => {
      if (heroHeadingChars.length) {
        gsap.fromTo(
          heroHeadingChars,
          { opacity: 0, y: 22, rotateX: -60 },
          { opacity: 1, y: 0, rotateX: 0, duration: 0.5, ease: "power3.out", stagger: 0.022, overwrite: true }
        );
      }
      if (heroPhotoWrap) {
        heroPhotoWrap.classList.remove("is-pulsing");
        void heroPhotoWrap.offsetWidth;
        heroPhotoWrap.classList.add("is-pulsing");
      }
    });
  }
}

// ---- Photos for each job ----
// To add photos later: drop image files into the images/jobs/ folder,
// then list their filenames here against the matching job id
// (the ids are the data-job values used in index.html, e.g. "nm").
const jobImages = {
  "injaz-youth": [],
  bfb: [],
  nm: [],
  poly: [],
  afs: [],
  "injaz-company": [],
};

document.querySelectorAll(".job-gallery").forEach((gallery) => {
  const jobId = gallery.dataset.jobGallery;
  const images = jobImages[jobId] || [];
  images.forEach((filename) => {
    const img = document.createElement("img");
    img.src = `images/jobs/${filename}`;
    img.alt = "";
    gallery.appendChild(img);
  });
});

// ---- Experience explorer: a real mini flow canvas ----
// Role nodes live on a fixed-size "world" (.career-nav) that can be panned
// (native scroll), zoomed (CSS transform: scale), and dragged node-by-node.
// Every offset/rect read below is in *world* units; screen position is
// world-units * zoom, minus how far the canvas has scrolled.
const careerNavItems = Array.from(document.querySelectorAll(".career-node"));
const careerPanelItems = document.querySelectorAll(".career-panel-item");
const careerPanelLoadbar = document.querySelector(".career-panel-loadbar");
const careerPanelProgress = document.querySelector(".career-panel-progress-fill");
const careerCanvasEl = document.querySelector(".career-canvas");
const careerCanvasScrollEl = document.getElementById("careerCanvasScroll");
const careerNavEl = document.getElementById("careerNav");
const careerPanelEl = document.querySelector(".career-panel");
const careerPanelHandle = document.querySelector(".career-panel-handle");
const careerEdgePath = document.querySelector(".career-edge-path");
const careerEdgeDot = document.querySelector(".career-edge-dot");
const careerEdgeDotMotion = careerEdgeDot && careerEdgeDot.querySelector("animateMotion");
const careerNodeToolbar = document.getElementById("careerNodeToolbar");
const careerNodeToolbarTitle = careerNodeToolbar && careerNodeToolbar.querySelector(".career-node-toolbar-title");
const careerNodeToolbarMeta = careerNodeToolbar && careerNodeToolbar.querySelector(".career-node-toolbar-meta");
const CAREER_ROTATE_MS = 8000;
let CAREER_WORLD_W = 880;
const CAREER_WORLD_H = 170;
const CAREER_ZOOM_MIN = 0.6;
const CAREER_ZOOM_MAX = 1.6;
const CAREER_ZOOM_STEP = 0.15;
let careerRotateTimer = null;
let careerZoom = 1;

// Converts a node's world-space box into on-screen coordinates relative to
// .career-explorer (what the edge SVG is drawn in), accounting for the
// canvas's current zoom and scroll.
function careerScreenPoint(worldX, worldY) {
  return {
    x: careerCanvasEl.offsetLeft + careerNavEl.offsetLeft + worldX * careerZoom - careerCanvasScrollEl.scrollLeft,
    y: careerCanvasEl.offsetTop + careerNavEl.offsetTop + worldY * careerZoom - careerCanvasScrollEl.scrollTop,
  };
}

function careerNodeCenter(node) {
  return careerScreenPoint(node.offsetLeft + node.offsetWidth / 2, node.offsetTop + node.offsetHeight / 2);
}

function careerNodeBottom(node) {
  return careerScreenPoint(node.offsetLeft + node.offsetWidth / 2, node.offsetTop + node.offsetHeight);
}

// The five static links tracing the chain in chronological order: center to
// center, so they still make sense even after a node's been dragged around.
function updateCareerChain() {
  const svg = careerEdgePath && careerEdgePath.closest("svg");
  if (!svg || !careerCanvasEl || !careerNavEl) return;

  for (let i = 0; i < careerNavItems.length - 1; i++) {
    const p1 = careerNodeCenter(careerNavItems[i]);
    const p2 = careerNodeCenter(careerNavItems[i + 1]);
    const path = svg.querySelector(`.career-chain-edge[data-chain="${i}"]`);
    if (path) path.setAttribute("d", `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
  }
}

// The one animated, colored wire: drops from whichever role is active down
// into the output panel's handle.
function updateCareerEdge() {
  const activeNav = careerNavItems.find((item) => item.classList.contains("is-active"));
  if (!careerEdgePath || !careerCanvasEl || !careerNavEl || !careerPanelEl || !careerPanelHandle || !activeNav) return;

  const svg = careerEdgePath.closest("svg");
  const explorer = svg.parentElement;
  svg.setAttribute("width", explorer.offsetWidth);
  svg.setAttribute("height", explorer.offsetHeight);

  const start = careerNodeBottom(activeNav);
  const endX = careerPanelEl.offsetLeft + careerPanelHandle.offsetLeft + careerPanelHandle.offsetWidth / 2;
  const endY = careerPanelEl.offsetTop + careerPanelHandle.offsetTop + careerPanelHandle.offsetHeight / 2;
  const midY = (start.y + endY) / 2;

  const d = `M ${start.x} ${start.y} C ${start.x} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  careerEdgePath.setAttribute("d", d);

  const accent = getComputedStyle(activeNav).getPropertyValue("--accent").trim();
  if (accent) {
    careerEdgePath.style.stroke = accent;
    careerPanelHandle.style.background = accent;
    careerPanelHandle.style.boxShadow = `0 0 8px ${accent}`;
    if (careerEdgeDot) careerEdgeDot.style.fill = accent;
  }

  // Restart the SMIL motion on the new path so the dot keeps riding the wire
  // even after it's been rerouted by a drag, a click, or the auto-rotate.
  if (careerEdgeDotMotion) {
    careerEdgeDotMotion.setAttribute("path", d);
    try {
      careerEdgeDotMotion.beginElement();
    } catch (err) {
      // SMIL restart isn't supported everywhere; the dot just stays put there.
    }
  }
}

// The floating card above the active node, showing what the panel below is
// currently displaying in full — like React Flow's NodeToolbar example.
function updateCareerToolbar() {
  const activeNav = careerNavItems.find((item) => item.classList.contains("is-active"));
  if (!careerNodeToolbar || !activeNav) return;

  const activePanel = document.querySelector(`.career-panel-item[data-panel="${activeNav.dataset.target}"]`);
  const title = activePanel && activePanel.querySelector("h3");
  const meta = activePanel && activePanel.querySelector(".career-panel-meta");
  if (careerNodeToolbarTitle) careerNodeToolbarTitle.textContent = title ? title.textContent : "";
  if (careerNodeToolbarMeta) careerNodeToolbarMeta.textContent = meta ? meta.textContent : "";

  const top = careerScreenPoint(activeNav.offsetLeft + activeNav.offsetWidth / 2, activeNav.offsetTop);
  careerNodeToolbar.style.left = `${top.x}px`;
  careerNodeToolbar.style.top = `${top.y}px`;

  const accent = getComputedStyle(activeNav).getPropertyValue("--accent").trim();
  if (accent) careerNodeToolbar.style.setProperty("--accent", accent);

  careerNodeToolbar.classList.add("is-visible");
}

function refreshCareerLayout() {
  updateCareerChain();
  updateCareerEdge();
  updateCareerToolbar();
}

function setCareerZoom(z) {
  careerZoom = Math.min(CAREER_ZOOM_MAX, Math.max(CAREER_ZOOM_MIN, Math.round(z * 100) / 100));
  if (careerNavEl) careerNavEl.style.setProperty("--career-zoom", careerZoom);
  refreshCareerLayout();
}

function fitCareerView() {
  setCareerZoom(1);
  if (careerCanvasScrollEl) careerCanvasScrollEl.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  setTimeout(refreshCareerLayout, 260);
}

// Drag a role node around the canvas; a real drag suppresses the click
// that would otherwise select it the instant you let go.
function makeCareerNodeDraggable(node) {
  node.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startLeft = node.offsetLeft;
    const startTop = node.offsetTop;
    let dragged = false;
    node.classList.add("is-dragging");
    node.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const dx = (ev.clientX - startClientX) / careerZoom;
      const dy = (ev.clientY - startClientY) / careerZoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
      const nextLeft = Math.max(0, Math.min(CAREER_WORLD_W - node.offsetWidth, startLeft + dx));
      const nextTop = Math.max(0, Math.min(CAREER_WORLD_H - node.offsetHeight, startTop + dy));
      node.style.left = `${nextLeft}px`;
      node.style.top = `${nextTop}px`;
      refreshCareerLayout();
    }
    function onUp(ev) {
      node.releasePointerCapture(ev.pointerId);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.classList.remove("is-dragging");
      if (dragged) node.dataset.dragged = "true";
    }
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
  });
}

function showCareerPanel(targetId) {
  careerNavItems.forEach((item) => {
    const active = item.dataset.target === targetId;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", active ? "true" : "false");
    // Roving tabindex (ARIA tabs pattern): six role="tab" nodes were six
    // separate tab stops, so a keyboard user had to step through every
    // role to get past this section. Now it's one stop, and the arrow
    // keys below move within it.
    item.tabIndex = active ? 0 : -1;
  });

  // Keeps the mobile dot pagination in sync with whatever selected the
  // panel — a chip tap, an arrow key, or the auto-rotate — instead of
  // only updating on swipe.
  const activeIndex = careerNavItems.findIndex((item) => item.dataset.target === targetId);
  // Queried here rather than closing over the module-level `careerDots`
  // const, which is declared further down this file — this function is
  // hoisted above it, so referencing it would sit in the temporal dead
  // zone for any caller that ran before that line.
  document.querySelectorAll(".career-dot").forEach((dot, i) => {
    const on = i === activeIndex;
    dot.classList.toggle("is-active", on);
    if (on) dot.setAttribute("aria-current", "true");
    else dot.removeAttribute("aria-current");
  });

  const activeNav = careerNavItems.find((item) => item.dataset.target === targetId);
  const accent = activeNav ? getComputedStyle(activeNav).getPropertyValue("--accent").trim() : "";

  if (accent && careerPanelEl) careerPanelEl.style.setProperty("--accent", accent);

  if (careerPanelLoadbar) {
    if (accent) careerPanelLoadbar.style.background = accent;
    careerPanelLoadbar.classList.remove("is-loading");
    void careerPanelLoadbar.offsetWidth;
    careerPanelLoadbar.classList.add("is-loading");
  }

  if (careerPanelProgress) {
    if (accent) careerPanelProgress.style.background = accent;
    careerPanelProgress.classList.remove("is-filling");
    void careerPanelProgress.offsetWidth;
    careerPanelProgress.classList.add("is-filling");
  }

  let activePanelEl = null;
  careerPanelItems.forEach((panel) => {
    const active = panel.dataset.panel === targetId;
    panel.classList.toggle("is-active", active);
    if (active) activePanelEl = panel;
  });

  if (activePanelEl) {
    // .career-panel-item's own nth-child accent is unreliable (the tag/handle/
    // loadbar/progress elements ahead of it in the DOM shift the count), so
    // it's overridden here with the accent already correctly computed for
    // the matching nav node above.
    if (accent) activePanelEl.style.setProperty("--accent", accent);
    activePanelEl.querySelectorAll(".career-stat-value").forEach((el) => animateKpi(el, 900));
  }

  updateCareerEdge();
  updateCareerToolbar();
}

// The rotation runs in the background: clicking a role jumps to it and the
// 8s countdown restarts from there. It is suspended, though, whenever the
// visitor is actually engaging with the section — see careerRotatePaused.
let careerRotatePaused = false;

function scheduleCareerRotate() {
  clearTimeout(careerRotateTimer);
  // On mobile the cards are swiped manually — an auto-rotate timer would
  // fight the user's own scroll position, so it only runs on desktop.
  if (window.innerWidth <= 820) return;
  // WCAG 2.2.2: content that updates itself every 8s is "moving,
  // blinking, scrolling or auto-updating information". Someone who asked
  // the OS for reduced motion gets a static panel they drive themselves.
  if (prefersReducedMotion) return;
  if (careerRotatePaused) return;
  careerRotateTimer = setTimeout(() => {
    const activeIndex = careerNavItems.findIndex((item) => item.classList.contains("is-active"));
    const nextItem = careerNavItems[(activeIndex + 1) % careerNavItems.length];
    goToCareerRole(nextItem.dataset.target);
  }, CAREER_ROTATE_MS);
}

// Pointing at the section, or tabbing into it, is the clearest possible
// signal that someone is reading it — and having the panel swap itself out
// mid-sentence is the single most irritating thing this section did. Also
// the WCAG 2.2.2 "pause" mechanism: hovering or focusing halts it, leaving
// restores it.
const careerExplorerEl = document.querySelector(".career-explorer");
if (careerExplorerEl) {
  const pauseCareerRotate = () => {
    careerRotatePaused = true;
    clearTimeout(careerRotateTimer);
  };
  const resumeCareerRotate = () => {
    careerRotatePaused = false;
    scheduleCareerRotate();
  };
  careerExplorerEl.addEventListener("mouseenter", pauseCareerRotate);
  careerExplorerEl.addEventListener("mouseleave", resumeCareerRotate);
  careerExplorerEl.addEventListener("focusin", pauseCareerRotate);
  careerExplorerEl.addEventListener("focusout", (e) => {
    // focusout fires when moving between two children too; only resume
    // once focus has genuinely left the explorer.
    if (!careerExplorerEl.contains(e.relatedTarget)) resumeCareerRotate();
  });
  // A backgrounded tab shouldn't burn through all six roles unseen and
  // leave the section on a different one than the visitor left it.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseCareerRotate();
    else resumeCareerRotate();
  });
}

function goToCareerRole(targetId) {
  showCareerPanel(targetId);
  scheduleCareerRotate();
}

careerNavItems.forEach((item) => {
  makeCareerNodeDraggable(item);
  item.addEventListener("click", () => {
    if (item.dataset.dragged === "true") {
      item.dataset.dragged = "";
      return;
    }
    // On mobile the panel's own scroll position is what decides which
    // card is showing (see the .career-panel scroll listener above) — a
    // role chip has to scroll the panel there, the same way the dots do,
    // rather than just flip an .is-active class the mobile flex-scroll
    // layout doesn't look at. Without this, tapping a chip lit the chip
    // up but left the card underneath unchanged.
    if (careerPanelEl && window.innerWidth <= 820) {
      const index = Array.from(careerPanelItems).findIndex((p) => p.dataset.panel === item.dataset.target);
      if (index > -1) {
        careerPanelEl.scrollTo({ left: careerPanelEl.clientWidth * index, behavior: "smooth" });
        return;
      }
    }
    goToCareerRole(item.dataset.target);
  });
});

// Arrow-key movement inside the role tablist, to match the roving
// tabindex set in showCareerPanel(). Without it, focus entered the list
// and had no way to move between roles — the keys the "tab, 1 of 6"
// announcement promises simply did nothing.
if (careerNavEl && careerNavItems.length) {
  careerNavEl.addEventListener("keydown", (e) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const current = careerNavItems.indexOf(document.activeElement);
    if (current === -1) return;

    let next = null;
    if (dir) next = (current + dir + careerNavItems.length) % careerNavItems.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = careerNavItems.length - 1;
    else return;

    e.preventDefault();
    careerNavItems[next].focus();
    careerNavItems[next].click();
  });
}

const careerZoomInBtn = document.getElementById("careerZoomIn");
const careerZoomOutBtn = document.getElementById("careerZoomOut");
const careerFitViewBtn = document.getElementById("careerFitView");
if (careerZoomInBtn) careerZoomInBtn.addEventListener("click", () => setCareerZoom(careerZoom + CAREER_ZOOM_STEP));
if (careerZoomOutBtn) careerZoomOutBtn.addEventListener("click", () => setCareerZoom(careerZoom - CAREER_ZOOM_STEP));
if (careerFitViewBtn) careerFitViewBtn.addEventListener("click", fitCareerView);

if (careerCanvasScrollEl) {
  let careerScrollRaf = null;
  careerCanvasScrollEl.addEventListener("scroll", () => {
    cancelAnimationFrame(careerScrollRaf);
    careerScrollRaf = requestAnimationFrame(refreshCareerLayout);
  });
}

// Mobile: the role row scrolls sideways, and nothing about a row that
// runs off the screen edge says so on its own. A small scroll indicator
// under the logos shows both position and how much is left — unlike the
// floating arrow it replaced, it points both ways implicitly and doesn't
// sit on top of whichever logo is at the edge.
const careerNavScrollThumb = document.getElementById("careerNavScrollThumb");
if (careerNavScrollThumb && careerNavEl) {
  function updateCareerNavScroll() {
    const scrollable = careerNavEl.scrollWidth - careerNavEl.clientWidth;
    const track = careerNavScrollThumb.parentElement;
    if (!track) return;
    // Nothing to scroll (wide screen / few roles) — hide rather than show
    // a full-width thumb that looks like a stray underline.
    track.style.visibility = scrollable > 4 ? "visible" : "hidden";
    if (scrollable <= 4) return;
    const ratio = careerNavEl.clientWidth / careerNavEl.scrollWidth;
    const thumbPct = Math.max(22, ratio * 100);
    careerNavScrollThumb.style.width = `${thumbPct}%`;
    const progress = careerNavEl.scrollLeft / scrollable;
    const travelPct = 100 - thumbPct;
    // Percent of the thumb's own width, so it lands flush at each end.
    careerNavScrollThumb.style.transform = `translateX(${(progress * travelPct * 100) / thumbPct}%)`;
  }
  careerNavEl.addEventListener("scroll", updateCareerNavScroll, { passive: true });
  window.addEventListener("resize", updateCareerNavScroll);
  updateCareerNavScroll();
}

// Mobile: the panel itself is the swipeable card row (see CSS), so its own
// scroll position — not a clicked node — decides which role is "active"
// (accent color, stat re-count), keeping everything in sync with the swipe.
if (careerPanelEl) {
  let careerPanelScrollRaf = null;
  careerPanelEl.addEventListener(
    "scroll",
    () => {
      if (window.innerWidth > 820) return;
      cancelAnimationFrame(careerPanelScrollRaf);
      careerPanelScrollRaf = requestAnimationFrame(() => {
        const cellWidth = careerPanelEl.clientWidth;
        if (!cellWidth) return;
        const index = Math.round(careerPanelEl.scrollLeft / cellWidth);
        const target = careerPanelItems[index];
        if (target) showCareerPanel(target.dataset.panel);
        careerDots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
        updateCareerSwipeCue();
      });
    },
    { passive: true }
  );
}

const careerDots = document.querySelectorAll(".career-dot");
const careerSwipeCue = document.getElementById("careerSwipeCue");
careerDots.forEach((dot, i) => {
  dot.addEventListener("click", () => {
    if (!careerPanelEl) return;
    careerPanelEl.scrollTo({ left: careerPanelEl.clientWidth * i, behavior: "smooth" });
  });
});

// The written cue stays put until the last role is actually reached — one
// that vanishes on first touch is no use to someone who swiped by
// accident and wants to know whether there's more.
function updateCareerSwipeCue() {
  if (!careerPanelEl || !careerSwipeCue) return;
  const atEnd =
    careerPanelEl.scrollLeft >= careerPanelEl.scrollWidth - careerPanelEl.clientWidth - 4;
  careerSwipeCue.classList.toggle("is-hidden", atEnd);
}
window.addEventListener("resize", updateCareerSwipeCue);
updateCareerSwipeCue();

const initialActiveNav = careerNavItems.find((item) => item.classList.contains("is-active"));
// Establish the roving tabindex up front — showCareerPanel() maintains it
// afterwards, but it only runs once something has been selected, so
// without this all six role tabs are separate tab stops on first load.
careerNavItems.forEach((item) => {
  item.tabIndex = item === initialActiveNav ? 0 : -1;
});
if (initialActiveNav) {
  const accent = getComputedStyle(initialActiveNav).getPropertyValue("--accent").trim();
  if (careerPanelLoadbar && accent) careerPanelLoadbar.style.background = accent;
  if (careerPanelProgress && accent) careerPanelProgress.style.background = accent;
  if (careerPanelEl && accent) careerPanelEl.style.setProperty("--accent", accent);
  const initialPanelEl = document.querySelector(".career-panel-item.is-active");
  if (initialPanelEl && accent) initialPanelEl.style.setProperty("--accent", accent);
}
if (careerPanelProgress) careerPanelProgress.classList.add("is-filling");
scheduleCareerRotate();

// The 6 role nodes used to sit at fixed pixel positions baked into HTML,
// sized for an 880px world — on any screen wider than that, the canvas
// itself renders wider than the world, leaving a dead strip on the right
// that's visually part of the canvas but outside the draggable/reachable
// area. This measures the actual scroll container and spreads the nodes
// evenly across whatever width is really available, so the whole visible
// canvas is reachable. Desktop only — mobile uses a different flex-wrap
// layout (see CSS), so inline styles are cleared there instead.
function layoutCareerNodes() {
  if (!careerNavEl || !careerCanvasScrollEl || !careerNavItems.length) return;
  if (window.innerWidth <= 820) {
    careerNavEl.style.width = "";
    careerNavItems.forEach((node) => {
      node.style.left = "";
    });
    return;
  }
  const available = careerCanvasScrollEl.clientWidth;
  if (!available) return;
  CAREER_WORLD_W = Math.max(680, Math.round(available));
  careerNavEl.style.width = `${CAREER_WORLD_W}px`;
  const nodeWidth = careerNavItems[0].offsetWidth || 128;
  const usable = Math.max(0, CAREER_WORLD_W - nodeWidth);
  const count = careerNavItems.length;
  careerNavItems.forEach((node, i) => {
    const left = count > 1 ? (usable * i) / (count - 1) : 0;
    node.style.left = `${Math.round(left)}px`;
  });
}

layoutCareerNodes();
refreshCareerLayout();
window.addEventListener("load", () => {
  layoutCareerNodes();
  refreshCareerLayout();
});
let careerEdgeResizeRaf = null;
window.addEventListener("resize", () => {
  cancelAnimationFrame(careerEdgeResizeRaf);
  careerEdgeResizeRaf = requestAnimationFrame(() => {
    layoutCareerNodes();
    refreshCareerLayout();
  });
});

// ---- Skills watchlist: tabs filter which sector's rows are visible ----
const tradeTabs = document.querySelectorAll(".trade-tab");
const tradeRows = document.querySelectorAll(".trade-row");
const tradeTabList = Array.from(tradeTabs);
const tradeTable = document.getElementById("tradeTable");

function showSector(cat) {
  tradeTabs.forEach((tab) => {
    const active = tab.dataset.cat === cat;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    // Roving tabindex: a tablist is one stop in the tab order, and Tab
    // from it should move on to the panel rather than through the other
    // two tabs (ARIA Authoring Practices, tabs pattern).
    tab.tabIndex = active ? 0 : -1;
    // Names the panel after whichever tab is selected, so the filtered
    // list is announced as "Technical" rather than a generic label.
    if (active && tradeTable) tradeTable.setAttribute("aria-labelledby", tab.id);
  });
  tradeRows.forEach((row) => row.classList.toggle("is-visible", row.dataset.cat === cat));
}

tradeTabs.forEach((tab) => {
  tab.addEventListener("click", () => showSector(tab.dataset.cat));
});

// Left/Right (plus Home/End) move between tabs — the interaction a screen
// reader announces the moment it says "tab, 1 of 3", and which previously
// did nothing here.
const tradeTabsWrap = document.querySelector(".trade-tabs");
if (tradeTabsWrap && tradeTabList.length) {
  tradeTabsWrap.addEventListener("keydown", (e) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const current = tradeTabList.indexOf(document.activeElement);
    if (current === -1) return;

    let next = null;
    if (dir) next = (current + dir + tradeTabList.length) % tradeTabList.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tradeTabList.length - 1;
    else return;

    e.preventDefault();
    tradeTabList[next].focus();
    tradeTabList[next].click();
  });
  // Establish the initial roving state from whichever tab starts active.
  const startTab = tradeTabList.find((t) => t.classList.contains("is-active")) || tradeTabList[0];
  showSector(startTab.dataset.cat);
}

// ---- Achievements: fanned card stack, click a card to pop up its story ----
const achievementMemories = [
  {
    year: "2018",
    title: "Torrance Award for Creativity",
    meta: "2nd Place · National Level, Bahrain",
    detail: "Awarded by the former Minister of Education for outstanding creative achievement at a national level.",
    color: "gold",
  },
  {
    year: "2023",
    title: "Ramadan Night Team Rally",
    meta: "2nd Place · University & School Track",
    detail: "Placed second in a competitive team rally event across the university and school track.",
    color: "teal",
  },
  {
    year: "2026",
    title: "Bahrain Fintech Ecosystem Report",
    meta: "Research Lead · Bahrain Polytechnic University with Bahrain Fintech Bay",
    detail: "Led research, drafting, and analytical writing for a forthcoming sector report on Bahrain's fintech landscape, translating data into publication-ready content.",
    color: "rose",
  },
];

const achOverlay = document.getElementById("achModalOverlay");
if (achOverlay) {
  const achModal = achOverlay.querySelector(".ach-modal");
  const yearEl = achOverlay.querySelector(".ach-modal-year");
  const titleEl = achOverlay.querySelector(".ach-modal-title");
  const metaEl = achOverlay.querySelector(".ach-modal-meta");
  const detailEl = achOverlay.querySelector(".ach-modal-detail");
  const closeBtn = achOverlay.querySelector(".ach-modal-close");
  // The clickable control is now the stretched button inside each card's
  // <h3>, not the card element itself (the card was a <button> wrapping
  // block content, which is invalid HTML — see index.html).
  const cardButtons = document.querySelectorAll(".ach-card-btn");

  let achReturnFocusEl = null;

  function openAchModal(index, triggerEl) {
    const entry = achievementMemories[index];
    if (!entry) return;
    yearEl.textContent = entry.year;
    titleEl.textContent = entry.title;
    metaEl.textContent = entry.meta;
    detailEl.textContent = entry.detail;
    achModal.style.setProperty("--accent", `var(--${entry.color})`);
    achOverlay.classList.add("is-open");
    // Stops the page behind the dialog scrolling away under the overlay
    // when you use the wheel or a trackpad — the dialog is modal, so the
    // background should be inert, not just visually dimmed.
    document.body.style.overflow = "hidden";
    achReturnFocusEl = triggerEl || document.activeElement;
    // Move focus into the dialog so keyboard/screen-reader users land on
    // its content instead of it opening silently behind their cursor.
    closeBtn.focus();
  }

  function closeAchModal() {
    achOverlay.classList.remove("is-open");
    document.body.style.overflow = "";
    if (achReturnFocusEl) {
      achReturnFocusEl.focus();
      achReturnFocusEl = null;
    }
  }

  cardButtons.forEach((btn) => {
    btn.addEventListener("click", () => openAchModal(parseInt(btn.dataset.index, 10), btn));
  });

  closeBtn.addEventListener("click", closeAchModal);
  achOverlay.addEventListener("click", (e) => {
    if (e.target === achOverlay) closeAchModal();
  });
  document.addEventListener("keydown", (e) => {
    if (!achOverlay.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      closeAchModal();
      return;
    }
    // The close button is the only focusable element in the dialog, so
    // trapping focus just means Tab/Shift+Tab always land back on it —
    // otherwise it would leak to the page underneath the overlay.
    if (e.key === "Tab") {
      e.preventDefault();
      closeBtn.focus();
    }
  });
}

// ---- Achievements: an always-flowing wire linking the three nodes above
// the cards, plus a mousemove 3D tilt on each card (only while hovered —
// no idle wobble, that version was tried and dropped earlier) ----
function updateAchFlow() {
  const flow = document.getElementById("achFlow");
  const svg = flow && flow.querySelector(".ach-flow-svg");
  const nodes = flow && flow.querySelectorAll(".ach-flow-node");
  if (!flow || !svg || !nodes || !nodes.length) return;

  svg.setAttribute("width", flow.offsetWidth);
  svg.setAttribute("height", flow.offsetHeight);

  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const ax = a.offsetLeft + a.offsetWidth / 2;
    const ay = a.offsetTop + a.offsetHeight / 2;
    const bx = b.offsetLeft + b.offsetWidth / 2;
    const by = b.offsetTop + b.offsetHeight / 2;
    const path = svg.querySelector(`.ach-flow-edge[data-edge="${i}"]`);
    if (path) path.setAttribute("d", `M ${ax} ${ay} L ${bx} ${by}`);
  }
}

window.addEventListener("load", updateAchFlow);
window.addEventListener("resize", () => requestAnimationFrame(updateAchFlow));
updateAchFlow();

const achGridEl = document.querySelector(".ach-grid");
document.querySelectorAll(".ach-card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    // Once the scroll-jacked journey (below) owns each card's transform,
    // a hover tilt here would fight it every frame — skip while active.
    if (achGridEl && achGridEl.classList.contains("ach-journey-active")) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(600px) rotateX(${y * -6}deg) rotateY(${x * 8}deg) translateY(-5px)`;
  });
  card.addEventListener("mouseleave", () => {
    if (achGridEl && achGridEl.classList.contains("ach-journey-active")) return;
    card.style.transform = "";
  });
});

// Achievements' pinned "journey" (adapted from wodniack.dev's pinned WORK
// section) is wired up alongside every other section's pin, further down
// in this file, in one shared matchMedia block — creating pins across
// several calls left GSAP with a stale start/end for whichever ones were
// registered first, since each call only accounts for the document height
// that exists at that instant; one shared block computes them all off the
// same, final, fully-laid-out page.

// ---- Education: a timeline rail that fills as you scroll past it ----
const educationList = document.getElementById("educationList");
const educationRailFill = document.getElementById("educationRailFill");
const educationItems = document.querySelectorAll(".education-item");

function applyEducationProgress(progress) {
  if (!educationRailFill) return;
  educationRailFill.style.height = `${progress * 100}%`;
  educationItems.forEach((item) => {
    const threshold = educationList.offsetHeight ? item.offsetTop / educationList.offsetHeight : 0;
    item.classList.toggle("is-reached", progress >= threshold + 0.08);
  });
}

function updateEducationTimeline() {
  if (!educationList || !educationRailFill || educationScrollProgressLock) return;
  const rect = educationList.getBoundingClientRect();
  const startLine = window.innerHeight * 0.85;
  const endLine = window.innerHeight * 0.35;
  const raw = (startLine - rect.top) / (startLine - endLine + rect.height);
  applyEducationProgress(Math.max(0, Math.min(1, raw)));
}

if (educationList) {
  let educationRaf = null;
  window.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(educationRaf);
      educationRaf = requestAnimationFrame(updateEducationTimeline);
    },
    { passive: true }
  );
  window.addEventListener("resize", () => requestAnimationFrame(updateEducationTimeline));
  updateEducationTimeline();
}

// ---- Fade sections in as they scroll into view ----
const revealTargets = document.querySelectorAll(".reveal, .kpi-strip");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach((el) => {
  const rect = el.getBoundingClientRect();
  const alreadyVisible = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
  if (alreadyVisible) {
    el.classList.add("in-view");
  } else {
    revealObserver.observe(el);
  }
});

// ---- KPI count-up, with a progress bar filling in sync ----
// Runs for a full 8.5 seconds on the big strip so the count is clearly
// visible, not instant; career-panel stat chips reuse this at a much
// snappier pace since they appear alongside a whole panel switch.
function animateKpi(el, duration = 8500) {
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || "";
  const useCommas = el.dataset.format === "comma";
  const bar = el.parentElement.querySelector(".kpi-bar-fill");
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 2);
    const value = Math.round(target * eased);
    el.textContent = (useCommas ? value.toLocaleString() : value) + suffix;
    if (bar) bar.style.width = `${eased * 100}%`;
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// On desktop all five stats sit side by side and count together, so a
// long 8.5s run reads as a live board ticking over. In the mobile
// carousel only one cell is on screen at a time and it auto-advances
// (see KPI_ROTATE_MS below), so the same 8.5s would mean every number
// slid away while still mid-count — nobody would ever see a final
// figure. Shorter than the dwell time, so each stat lands before it
// moves on and the .kpi-bar reads as "time left on this card".
function kpiCountDuration() {
  const board = document.getElementById("tickerBoard");
  const isCarousel = board && board.scrollWidth > board.clientWidth + 4;
  return isCarousel ? 3400 : 8500;
}

// IntersectionObserver fires as soon as an element is observed if it's
// already on screen, so there's no need to hand-check visibility first.
// In the carousel the off-screen cells are clipped by the scroll
// container, which IO accounts for — so each stat starts counting as it
// slides in, not all five at once behind the scenes.
const kpiObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateKpi(entry.target, kpiCountDuration());
        kpiObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.4 }
);

document.querySelectorAll(".kpi-number").forEach((el) => kpiObserver.observe(el));

// ---- Mobile KPI carousel: dots track which stat is scrolled into view,
// and are themselves clickable to jump straight to a stat ----
const tickerBoard = document.getElementById("tickerBoard");
const tickerDots = document.querySelectorAll(".ticker-dot");
if (tickerBoard && tickerDots.length) {
  function updateActiveTickerDot() {
    const cellWidth = tickerBoard.clientWidth;
    if (!cellWidth) return;
    const index = Math.round(tickerBoard.scrollLeft / cellWidth);
    tickerDots.forEach((dot, i) => {
      const on = i === index;
      dot.classList.toggle("is-active", on);
      // The dots are real buttons now, so "which one am I on" has to be
      // exposed, not just painted.
      if (on) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  }
  updateActiveTickerDot();

  // ---- Auto-advance, mobile carousel only -----------------------------
  // On desktop the board is a five-column grid: every stat is already
  // visible and nothing needs to rotate. Below 680px it collapses to one
  // scroll-snapped cell at a time, and the other four sat behind a swipe
  // with only a row of dots hinting at them — so most visitors saw one
  // number out of five. Advancing on its own surfaces the whole set.
  const KPI_ROTATE_MS = 4600;
  let kpiRotateTimer = null;
  let kpiRotateStopped = false;
  let kpiInView = false;
  // Marks scrolls this code caused, so the user-swipe detector below can
  // tell them apart from a real finger. Smooth scrolling emits events for
  // a while after the call, hence a time window rather than a flag flip.
  let kpiAutoScrollAt = 0;

  function kpiCarouselActive() {
    return tickerBoard.scrollWidth > tickerBoard.clientWidth + 4;
  }

  // The position is tracked here rather than re-derived from scrollLeft on
  // every tick. Reading scrollLeft mid-flight (a smooth scroll is still
  // settling when the next timer fires) yields an intermediate index and
  // the carousel starts computing each step from the wrong place.
  let kpiIndex = 0;
  let kpiDirection = 1;

  function scheduleKpiRotate() {
    clearTimeout(kpiRotateTimer);
    if (kpiRotateStopped || !kpiInView || document.hidden || !kpiCarouselActive()) return;
    // Someone who asked the OS for reduced motion should not have content
    // moving itself under them (WCAG 2.2.2) — they keep the swipe.
    if (prefersReducedMotion) return;
    kpiRotateTimer = setTimeout(() => {
      const cellWidth = tickerBoard.clientWidth;
      if (!cellWidth) return;
      // Sweeps back and forth rather than looping 5 → 1. Wrapping meant
      // one step in five was a smooth scroll across four cell widths,
      // visibly racing backwards past every stat for well over a second
      // while the other four steps were single quiet hops. Reversing
      // keeps every transition the same one-cell move.
      if (kpiIndex + kpiDirection >= tickerDots.length || kpiIndex + kpiDirection < 0) {
        kpiDirection *= -1;
      }
      kpiIndex += kpiDirection;
      kpiAutoScrollAt = Date.now();
      tickerBoard.scrollTo({ left: cellWidth * kpiIndex, behavior: "smooth" });
      scheduleKpiRotate();
    }, KPI_ROTATE_MS);
  }

  // Taking control ends the rotation for good rather than pausing it.
  // There's no hover on a touchscreen to resume from, and having the
  // board start moving again a few seconds after someone deliberately
  // swiped to a stat is exactly the behaviour that makes auto-rotating
  // carousels infuriating. The rotation exists to reveal that there are
  // five stats; once you've swiped, you know.
  function stopKpiRotate() {
    kpiRotateStopped = true;
    clearTimeout(kpiRotateTimer);
  }

  let tickerScrollRaf = null;
  tickerBoard.addEventListener(
    "scroll",
    () => {
      // A scroll that didn't come from scheduleKpiRotate is a real swipe.
      // While one of ours is still settling, keep pushing the window
      // forward: the wrap from the fifth stat back to the first travels
      // four cell widths and can easily emit events for longer than a
      // fixed window, which would read as a swipe and kill the rotation
      // after exactly one lap.
      if (Date.now() - kpiAutoScrollAt <= 1200) kpiAutoScrollAt = Date.now();
      else stopKpiRotate();
      cancelAnimationFrame(tickerScrollRaf);
      tickerScrollRaf = requestAnimationFrame(updateActiveTickerDot);
    },
    { passive: true }
  );

  tickerDots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      stopKpiRotate();
      tickerBoard.scrollTo({ left: tickerBoard.clientWidth * i, behavior: "smooth" });
    });
  });

  // Only rotate while the strip is actually on screen: otherwise it
  // cycles through all five unseen and the visitor scrolls down to
  // whichever one it happened to land on, with the count-ups long
  // finished. Also stops a background tab burning timers.
  const kpiStrip = document.querySelector(".kpi-strip");
  if (kpiStrip && "IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        // Strictly "is it on screen" — tab visibility is checked inside
        // scheduleKpiRotate() instead. Folding the two together here was
        // a real bug: this callback only re-runs when the intersection
        // itself changes, so a page opened in a background tab latched
        // kpiInView to false and never rotated once brought to the front,
        // because visibilitychange had nothing to un-latch.
        kpiInView = entries[0].isIntersecting;
        if (kpiInView) {
          // Re-sync to wherever the board actually sits before arming, so
          // the first hop continues from the visible stat rather than
          // snapping back to a stale tracked index.
          const w = tickerBoard.clientWidth;
          if (w) kpiIndex = Math.round(tickerBoard.scrollLeft / w);
          scheduleKpiRotate();
        } else {
          clearTimeout(kpiRotateTimer);
        }
      },
      { threshold: 0.35 }
    ).observe(kpiStrip);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(kpiRotateTimer);
    else scheduleKpiRotate();
  });

  // Crossing the 680px breakpoint turns the carousel on or off entirely,
  // so re-evaluate rather than leaving a timer running against a grid.
  let kpiResizeRaf = null;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(kpiResizeRaf);
    kpiResizeRaf = requestAnimationFrame(scheduleKpiRotate);
  });
}

// ---- Rotating tagline in the hero ----
const taglinePhrases = [
  "Business Development Analyst",
  "Fintech Research & Insights",
  "Partnership & Growth Strategy",
];

function typeText(el, text, done) {
  let i = 0;
  const timer = setInterval(() => {
    i++;
    el.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(timer);
      done();
    }
  }, 45);
}

function eraseText(el, done) {
  const timer = setInterval(() => {
    const text = el.textContent.slice(0, -1);
    el.textContent = text;
    if (text.length === 0) {
      clearInterval(timer);
      done();
    }
  }, 25);
}

const taglineEl = document.querySelector(".tagline-rotate");
if (taglineEl) {
  let phraseIndex = 0;
  taglineEl.textContent = "";
  function loopTagline() {
    typeText(taglineEl, taglinePhrases[phraseIndex], () => {
      setTimeout(() => {
        eraseText(taglineEl, () => {
          phraseIndex = (phraseIndex + 1) % taglinePhrases.length;
          loopTagline();
        });
      }, 1700);
    });
  }
  loopTagline();
}

// ---- Credit card: rises out of its wallet as you scroll through the
// sticky section, and tilts toward the cursor independently of that.
//
// The reveal is a pure function of scroll position, recomputed every
// frame — no one-shot trigger, no animation state to latch. That's what
// makes it play going down and reverse going up, every time. The heading
// can't be covered either: the card only moves while .cc-sticky is
// pinned, by which point the heading has scrolled off on its own.
// Native scroll throughout; nothing is hijacked or pinned by JS ----
const creditCard = document.querySelector(".credit-card");
const ccScrollEl = document.getElementById("ccScroll");
if (creditCard && ccScrollEl) {
  const ccShine = creditCard.querySelector(".cc-shine");
  // The spec's hiddenY of 22 leaves the card's bottom edge poking out
  // below the pocket here: the -4deg rest tilt drops the lower corner
  // ~13px further than the flat edge, more than the card's 18px bottom
  // offset absorbs. 6 keeps the whole card inside the pocket at rest.
  const CARD_TUCK_Y = 6;
  const CARD_REVEAL_Y = -172;

  let cardTiltRX = 0;
  let cardTiltRY = 0;
  let cardProgress = 0;

  // Two-phase curve: linear pull-out for the first three quarters, then a
  // decelerating settle. A single ease across the whole range makes the
  // card arrive at full extension abruptly.
  function cardMech(p) {
    if (p < 0.75) return (p / 0.75) * 0.82;
    const t = (p - 0.75) / 0.25;
    return 0.82 + (1 - Math.pow(1 - t, 2)) * 0.18;
  }

  function applyCardTransform() {
    const p = cardProgress;
    const mech = cardMech(p);
    const y = CARD_TUCK_Y + (CARD_REVEAL_Y - CARD_TUCK_Y) * mech;
    const rotate = -4 + 4 * mech;
    const scale = 0.97 + 0.03 * mech;
    // translateX(-50%) first — the card is positioned with left:50%, so
    // that is what centres it; everything else layers on top.
    creditCard.style.transform =
      `translateX(-50%) translateY(${y}px) perspective(900px) ` +
      `rotateX(${cardTiltRX}deg) rotateY(${cardTiltRY}deg) ` +
      `rotate(${rotate}deg) scale(${scale})`;
    creditCard.style.opacity = p < 0.02 ? String(p / 0.02) : "1";
    creditCard.style.boxShadow =
      `inset 0 0 0 1px rgba(255, 255, 255, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.12), ` +
      `0 ${18 + 34 * mech}px ${36 + 54 * mech}px rgba(8, 9, 12, ${0.12 + 0.38 * mech})`;
    // Not clickable until clear of the pocket, so clicks can't land on
    // the links through the leather.
    creditCard.style.pointerEvents = p > 0.5 ? "auto" : "none";
    if (ccShine) {
      const ease = 1 - Math.pow(1 - p, 3);
      ccShine.style.opacity = String(0.12 + 0.4 * ease);
    }
  }

  function updateCardProgress() {
    const rect = ccScrollEl.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    const raw = scrollable > 0 ? -rect.top / scrollable : 0;
    cardProgress = Math.max(0, Math.min(1, raw));
    applyCardTransform();
  }

  if (prefersReducedMotion) {
    cardProgress = 1;
    applyCardTransform();
  } else {
    creditCard.addEventListener("mousemove", (e) => {
      const rect = creditCard.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cardTiltRX = y * -14;
      cardTiltRY = x * 14;
      applyCardTransform();
    });
    creditCard.addEventListener("mouseleave", () => {
      cardTiltRX = 0;
      cardTiltRY = 0;
      applyCardTransform();
    });

    let cardRaf = null;
    window.addEventListener(
      "scroll",
      () => {
        cancelAnimationFrame(cardRaf);
        cardRaf = requestAnimationFrame(updateCardProgress);
      },
      { passive: true }
    );
    window.addEventListener("resize", () => requestAnimationFrame(updateCardProgress));
    updateCardProgress();
  }
}

// ---- Subtle mouse parallax on the hero chart lines ----
const heroEl = document.querySelector(".hero");
const heroCharts = document.querySelectorAll(".hero-chart");
if (heroEl && heroCharts.length) {
  heroEl.addEventListener("mousemove", (e) => {
    const rect = heroEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    heroCharts.forEach((el, idx) => {
      const depth = (idx + 1) * 8;
      el.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
    });
  });
}

// ---- Hero ID badge: used to snap-tilt hard toward the cursor on every
// mousemove, which read as constant left-right jitter rather than motion
// design — replaced with a slow autonomous sway (always running, not
// cursor-chasing) plus a scroll-linked parallax drift as the hero scrolls
// away, giving About "scroll possibilities" instead of just a hover trick ----
const heroIdBadge = document.getElementById("heroIdBadge");
if (heroIdBadge && gsapReady) {
  if (!prefersReducedMotion) {
    gsap.to(heroIdBadge, {
      rotate: 2.2,
      duration: 3.4,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      transformOrigin: "50% 100%",
    });

    // Depth sheets: each layer drifts, shrinks, and fades at its own rate
    // as the hero scrolls away — reads as the layout physically separating
    // into depth, not just sliding, continuing the loader's "parting" idea.
    const heroSection = document.querySelector(".hero");
    if (heroSection) {
      const heroScrollTrigger = { trigger: heroSection, start: "top top", end: "bottom top", scrub: true };
      gsap.to(heroIdBadge, { y: -70, scale: 0.94, opacity: 0.75, ease: "none", scrollTrigger: heroScrollTrigger });
      gsap.to(".hero-heading", { y: -34, opacity: 0.8, ease: "none", scrollTrigger: heroScrollTrigger });
      gsap.to(".hero-flow", { y: -16, opacity: 0.85, ease: "none", scrollTrigger: heroScrollTrigger });

      // The echo chip's lid keeps lifting, continuing the loader's motion
      // into the page instead of leaving it behind as a one-off intro.
      const echoLid = document.querySelector(".hero-echo-lid");
      if (echoLid) {
        gsap.to(echoLid, {
          y: -78,
          rotateX: -34,
          ease: "none",
          scrollTrigger: heroScrollTrigger,
        });
        gsap.to(".hero-echo-chip", {
          y: -40,
          opacity: 0.2,
          ease: "none",
          scrollTrigger: heroScrollTrigger,
        });
      }
    }

    const configItems = gsap.utils.toArray(".flow-node, .config-output");
    if (configItems.length) {
      gsap.set(configItems, { opacity: 0, x: -16 });
      gsap.to(configItems, { opacity: 1, x: 0, duration: 0.5, stagger: 0.1, delay: 0.3, ease: "power2.out" });
    }

    // Magnetic hero buttons: drift toward the cursor within a small radius,
    // same language as the Contact badge, so the landing area has its own
    // "things going on" rather than sitting there waiting to be scrolled.
    document.querySelectorAll(".flow-actions .btn").forEach((btn) => {
      const pullX = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3" });
      const pullY = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3" });
      btn.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        pullX((e.clientX - rect.left - rect.width / 2) * 0.25);
        pullY((e.clientY - rect.top - rect.height / 2) * 0.35);
      });
      btn.addEventListener("mouseleave", () => {
        pullX(0);
        pullY(0);
      });
    });
  }
}

// ---- Custom scrollbar: a slim gold thumb tracking overall page scroll
// progress, standing in for the native scrollbar (hidden via CSS) ----
const scrollbarThumb = document.getElementById("siteScrollbarThumb");
if (scrollbarThumb) {
  function updateScrollbarThumb() {
    const trackHeight = window.innerHeight;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    const viewportRatio = Math.min(1, window.innerHeight / document.documentElement.scrollHeight);
    const thumbHeight = Math.max(28, viewportRatio * trackHeight);
    scrollbarThumb.style.height = `${thumbHeight}px`;
    scrollbarThumb.style.transform = `translateY(${progress * (trackHeight - thumbHeight)}px)`;
  }

  let scrollbarRaf = null;
  window.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(scrollbarRaf);
      scrollbarRaf = requestAnimationFrame(updateScrollbarThumb);
    },
    { passive: true }
  );
  window.addEventListener("resize", () => requestAnimationFrame(updateScrollbarThumb));
  updateScrollbarThumb();
}

// ---- Achievements: pinned scroll-jacked "journey" through the three
// milestones (adapted from wodniack.dev's pinned WORK section) — the one
// section that stays pinned; every other section below scrolls normally
// with its own richer, non-hijacking reveal. Desktop and tall-enough
// viewports only (pinning is unreliable with mobile browser-chrome resize
// and would clip content on short screens); mobile/reduced-motion keep
// the plain grid with the standard per-section fade-in ----
if (gsapReady && !prefersReducedMotion) {
  ScrollTrigger.matchMedia({
    "(min-width: 821px) and (min-height: 700px)": function () {
      const cards = gsap.utils.toArray(".ach-card");
      const flowNodes = gsap.utils.toArray(".ach-flow-node");
      if (!achGridEl || cards.length < 3) return;

      const achSection = document.getElementById("achievements");
      achSection.style.transition = "none";
      achSection.classList.add("in-view");
      void achSection.offsetHeight;
      gsap.set(achSection, { clearProps: "transform,opacity" });
      achSection.style.transition = "";
      achGridEl.classList.add("ach-journey-active");
      gsap.set(cards, { clearProps: "all" });

      function setStage(stage) {
        cards.forEach((card, i) => {
          const isCurrent = i === stage;
          gsap.to(card, {
            scale: isCurrent ? 1.12 : 0.82,
            opacity: isCurrent ? 1 : 0.4,
            y: isCurrent ? -10 : 0,
            duration: 0.4,
            ease: "power2.out",
            overwrite: "auto",
          });
        });
        flowNodes.forEach((node, i) => node.classList.toggle("is-journey-current", i === stage));
      }

      setStage(0);

      const achTrigger = ScrollTrigger.create({
        trigger: "#achievements",
        start: "top top",
        end: "+=200%",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const stage = Math.min(2, Math.floor(self.progress * 3));
          setStage(stage);
        },
      });

      return () => {
        achTrigger.kill();
        achGridEl.classList.remove("ach-journey-active");
        gsap.set(cards, { clearProps: "all" });
        flowNodes.forEach((node) => node.classList.remove("is-journey-current"));
      };
    },
  });
}

// ---- Everything else: normal scrolling, no hijacking — each section's
// inner elements stagger/tilt/slide in as they cross into view, using
// ScrollTrigger purely as a "play once" trigger (toggleActions, no pin,
// no scrub) so the user's scroll is never taken over. Runs at every
// breakpoint (nothing here pins, so there's no mobile-chrome risk) ----
if (gsapReady && !prefersReducedMotion) {
  function scrollReveal(targets, vars = {}) {
    const els = gsap.utils.toArray(targets);
    if (!els.length) return;
    gsap.set(els, { opacity: 0, y: 50, ...vars.from });
    els.forEach((el, i) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        delay: (vars.stagger || 0) * i,
        ease: "power3.out",
        ...vars.to,
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    });
  }

  scrollReveal(".ticker-cell", { stagger: 0.08, from: { y: 40, rotateX: -35, transformOrigin: "50% 100%" }, to: { rotateX: 0 } });
  scrollReveal(".career-canvas, .career-panel", { stagger: 0.12, from: { y: 60, scale: 0.96 }, to: { scale: 1 } });
  // .trade-row deliberately isn't in this list — it already has its own
  // entrance animation (`panel-fade-in`, triggered by the `.is-visible`
  // class toggle) that plays both on first load and every time the Skills
  // category tab switches. Adding a second, scroll-triggered GSAP tween on
  // top of that broke category-switching: rows for a category not visible
  // at page load start life with `display:none`, so their ScrollTrigger
  // (which needs a real layout position to fire) never actually ran and
  // left them stuck at `opacity:0`. Switching to that category then showed
  // the CSS fade-in play for 0.4s before snapping back to that leftover
  // invisible state — the "glitch" this comment is here to prevent someone
  // from reintroducing.
  scrollReveal(".education-item", { stagger: 0.1, from: { x: -40, y: 0 }, to: { x: 0 } });
  // .cc-wrap is deliberately excluded: it holds the card and wallet, whose
  // reveal is driven directly from scroll position. A second tween moving
  // their container shifts the geometry that reveal is calibrated against.
  scrollReveal(".contact-intro", {});

  // Kinetic type: each split section heading skews slightly in the
  // direction of scroll travel and eases back to neutral when scrolling
  // slows — a small, constant "everything reacts to scroll" touch that
  // doesn't require pinning anything.
  const skewHeadings = gsap.utils.toArray(".section-inner > h2");
  if (skewHeadings.length) {
    const skewSetters = skewHeadings.map((h) => gsap.quickTo(h, "skewX", { duration: 0.5, ease: "power3" }));
    let lastY = window.scrollY;
    window.addEventListener(
      "scroll",
      () => {
        const dy = window.scrollY - lastY;
        lastY = window.scrollY;
        const skew = Math.max(-8, Math.min(8, dy * -0.6));
        skewSetters.forEach((set) => set(skew));
      },
      { passive: true }
    );
  }
}

// ---- Experience output panel: a persistent 3D tilt makes it read as a
// floating tilted screen rather than a flat card ("coming out of" the
// interface); mousemove adds a small interactive tilt on top of that
// resting pose. Desktop-only (matchMedia, reacts to resize/rotation) — on
// a narrow column the same tilt just reads as crooked, hard-to-read text ----
if (careerPanelEl && gsapReady) {
  ScrollTrigger.matchMedia({
    "(min-width: 821px)": function () {
      const panelBaseTiltY = -8;
      const panelBaseTiltX = 3.5;
      gsap.set(careerPanelEl, {
        transformPerspective: 1100,
        rotateY: panelBaseTiltY,
        rotateX: panelBaseTiltX,
        transformOrigin: "50% 50%",
      });

      let setPanelTiltY, setPanelTiltX, setPanelScale, onPanelMove, onPanelLeave;
      if (!prefersReducedMotion) {
        setPanelTiltY = gsap.quickTo(careerPanelEl, "rotateY", { duration: 0.4, ease: "power3" });
        setPanelTiltX = gsap.quickTo(careerPanelEl, "rotateX", { duration: 0.4, ease: "power3" });
        setPanelScale = gsap.quickTo(careerPanelEl, "scale", { duration: 0.4, ease: "power3" });
        onPanelMove = (e) => {
          const rect = careerPanelEl.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          setPanelTiltY(panelBaseTiltY + x * 14);
          setPanelTiltX(panelBaseTiltX - y * 11);
          setPanelScale(1.015);
        };
        onPanelLeave = () => {
          setPanelTiltY(panelBaseTiltY);
          setPanelTiltX(panelBaseTiltX);
          setPanelScale(1);
        };
        careerPanelEl.addEventListener("mousemove", onPanelMove);
        careerPanelEl.addEventListener("mouseleave", onPanelLeave);
      }

      return () => {
        gsap.set(careerPanelEl, { clearProps: "transform,transformPerspective,transformOrigin" });
        if (onPanelMove) careerPanelEl.removeEventListener("mousemove", onPanelMove);
        if (onPanelLeave) careerPanelEl.removeEventListener("mouseleave", onPanelLeave);
      };
    },
  });
}

// ---- Mobile nav: hamburger toggle for the collapsed <860px menu ----
const navToggle = document.getElementById("navToggle");
const primaryNav = document.getElementById("primaryNav");
if (navToggle && primaryNav) {
  function closeNav() {
    primaryNav.classList.remove("is-open");
    navToggle.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  navToggle.addEventListener("click", () => {
    const isOpen = primaryNav.classList.toggle("is-open");
    navToggle.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  primaryNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  document.addEventListener("click", (e) => {
    if (!primaryNav.classList.contains("is-open")) return;
    if (!primaryNav.contains(e.target) && !navToggle.contains(e.target)) closeNav();
  });
}

// ---- Back to top: appears once you've scrolled roughly a screen's
// worth down, mobile only (see the >860px display:none in style.css) ----
const backToTopBtn = document.getElementById("backToTop");
if (backToTopBtn) {
  let backToTopRaf = null;
  function updateBackToTop() {
    backToTopBtn.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.6);
  }
  window.addEventListener("scroll", () => {
    cancelAnimationFrame(backToTopRaf);
    backToTopRaf = requestAnimationFrame(updateBackToTop);
  }, { passive: true });
  updateBackToTop();

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });
}

// ---- Re-sync ScrollTrigger once the page has actually finished settling
// ----
// Every trigger position above (including the pinned Achievements
// section) was calculated the moment each script block ran — before web
// fonts swap in and before every image finishes loading, both of which
// can change the page's total height afterward. A pin whose cached start
// position is now stale doesn't just animate slightly wrong; scrolling
// past where it THINKS its range is can leave it stuck pinned over
// whatever's now sitting there, which is what makes the pinned section
// visually strand itself on top of an earlier one instead of releasing
// cleanly. Refreshing after both "everything has loaded" and "fonts have
// swapped in" recalculates every trigger against the final, true layout.
if (gsapReady) {
  const refreshScrollTrigger = () => ScrollTrigger.refresh();
  if (document.readyState === "complete") {
    refreshScrollTrigger();
  } else {
    window.addEventListener("load", refreshScrollTrigger);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refreshScrollTrigger);
  }
}
