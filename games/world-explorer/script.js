// Standalone: do not import from /shared/ or other game folders.
// Three.js is vendored locally in ./vendor/three/, earcut in ./vendor/earcut.js
// - no CDN, no build step.

import * as THREE from "./vendor/three/three.module.min.js";
import { OrbitControls } from "./vendor/three/OrbitControls.js";
import earcut from "./vendor/earcut.js";

const STORAGE_KEY = "ls-world-explorer-v1";

const SPHERE_RADIUS = 100;
const GLOBE_CAMERA_DIST_DESKTOP = SPHERE_RADIUS * 2.6;
const GLOBE_CAMERA_DIST_MOBILE = SPHERE_RADIUS * 3.6;
const CLICK_DRAG_THRESHOLD = 6; // px

const isMobile = window.innerWidth <= 800;

const state = {
  showOceans: true,
  quizMode: false,
  cameraQuat: null,
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.showOceans === "boolean") state.showOceans = saved.showOceans;
    if (saved.cameraQuat && Array.isArray(saved.cameraQuat)) state.cameraQuat = saved.cameraQuat;
  } catch (e) {
    // ignore corrupt/unavailable storage, start fresh
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showOceans: state.showOceans,
        cameraQuat: camera.quaternion.toArray(),
      })
    );
  } catch (e) {
    // storage unavailable, play continues without persistence
  }
}

const els = {
  canvas: document.getElementById("globe-canvas"),
  hint: document.getElementById("hint"),
  placeInfo: document.getElementById("place-info"),
  feedback: document.getElementById("feedback"),
  modeBtn: document.getElementById("mode-btn"),
  oceansBtn: document.getElementById("oceans-btn"),
  listWrap: document.getElementById("place-list-wrap"),
  listToggleBtn: document.getElementById("list-toggle-btn"),
  list: document.getElementById("place-list"),
  quizBanner: document.getElementById("quiz-banner"),
  quizTarget: document.getElementById("quiz-target"),
  quizSkipBtn: document.getElementById("quiz-skip-btn"),
};

// ---------- Coordinate projection ----------

function lonLatToVector3(lon, lat, radius) {
  const lonR = (lon * Math.PI) / 180;
  const latR = (lat * Math.PI) / 180;
  const x = radius * Math.cos(latR) * Math.cos(lonR);
  const y = radius * Math.sin(latR);
  const z = -radius * Math.cos(latR) * Math.sin(lonR);
  return new THREE.Vector3(x, y, z);
}

// ---------- Scene setup ----------

const scene = new THREE.Scene();
// near/far kept tight around the actual usable range (camera never gets closer
// than minDistance below or further than maxDistance) - a wide near:far ratio
// starves depth-buffer precision at this radius and caused z-fighting between
// the country meshes and the ocean sphere underneath (large chunks of
// triangulated countries intermittently failing their depth test and showing
// the ocean color through "holes" that weren't actually gaps in the mesh).
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, SPHERE_RADIUS * 0.5, SPHERE_RADIUS * 8);
const initialDist = isMobile ? GLOBE_CAMERA_DIST_MOBILE : GLOBE_CAMERA_DIST_DESKTOP;
camera.position.set(0, 0, initialDist);

const renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070c, 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.enableZoom = true;
controls.zoomSpeed = 0.5;
controls.rotateSpeed = 0.5;
controls.minDistance = SPHERE_RADIUS * 1.3;
controls.maxDistance = SPHERE_RADIUS * 6;
controls.target.set(0, 0, 0);

if (state.cameraQuat) {
  camera.quaternion.fromArray(state.cameraQuat);
  camera.position.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion).multiplyScalar(initialDist));
}

scene.add(new THREE.AmbientLight(0xffffff, 1));

// Base ocean sphere, sits just under the country meshes.
const oceanSphere = new THREE.Mesh(
  new THREE.SphereGeometry(SPHERE_RADIUS * 0.997, 64, 48),
  new THREE.MeshBasicMaterial({ color: 0x0d3b52 })
);
scene.add(oceanSphere);

// Faint lon/lat grid for visual reference (matches constellation-sky's
// subtle-guide aesthetic rather than a plain flat sphere).
function buildGraticule() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });
  const radius = SPHERE_RADIUS * 1.001;
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 4) pts.push(lonLatToVector3(lon, lat, radius));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 4) pts.push(lonLatToVector3(lon, lat, radius));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
  }
  scene.add(group);
}
buildGraticule();

// ---------- Country meshes ----------

let WORLD = { countries: [], oceans: [] };
const countryMeshes = []; // { mesh, name, centroid: THREE.Vector3 }
const oceanLabels = []; // { name, centroid: THREE.Vector3, el }
const countryGroup = new THREE.Group();
scene.add(countryGroup);

const DEFAULT_COLOR = new THREE.Color(0x3c7a52);
const HOVER_COLOR = new THREE.Color(0x5aa06e);
const SELECTED_COLOR = new THREE.Color(0x7bd3c0);
const WRONG_FLASH_COLOR = new THREE.Color(0xd98a5f);

// Earcut triangulates in flat lon/lat space, then each triangle is lifted
// onto the sphere per-vertex - fine for small triangles, but ear-clipping
// routinely connects an interior diagonal between two ring vertices that
// are close together on the *boundary* but far apart in index order (e.g.
// a near-straight run of the US/Canada border), producing a triangle whose
// vertices span tens of degrees even though every ring edge is short.
// Projected onto the sphere, a triangle that large curves noticeably away
// from the flat chord earcut assumed, which flips some of those triangles'
// effective winding/normal direction - large chunks of e.g. the northern
// US border rendered as gaps (the ocean sphere showing through) instead of
// solid land. Fix: after triangulating, recursively bisect any triangle
// whose longest edge exceeds MAX_SPAN_DEG, splitting only across that one
// long edge (not a uniform 4-way quad split) until every triangle is small
// enough that flat-to-sphere distortion is negligible. Longest-edge
// bisection converges in O(span/MAX_SPAN_DEG) cuts for this problem's
// actual shape - one long ear-clipping diagonal plus two normal-length
// edges - where a uniform quad split would waste a full extra level
// subdividing the two edges that were already short (quad-splitting
// blew up thin/degenerate triangles - e.g. Fiji's antimeridian slivers -
// into tens of thousands of redundant triangles hitting the recursion cap
// for no visual benefit).
const MAX_SPAN_DEG = 1.5;
function edgeLen(p, q) {
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
}
function subdivideTriangle(pa, pb, pc, depth, out) {
  const ab = edgeLen(pa, pb);
  const bc = edgeLen(pb, pc);
  const ca = edgeLen(pc, pa);
  const longest = Math.max(ab, bc, ca);
  if (longest <= MAX_SPAN_DEG || depth > 12) {
    out.push(pa, pb, pc);
    return;
  }
  let p, q, r; // p-q is the longest edge, r is the opposite vertex
  if (longest === ab) {
    p = pa; q = pb; r = pc;
  } else if (longest === bc) {
    p = pb; q = pc; r = pa;
  } else {
    p = pc; q = pa; r = pb;
  }
  const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  subdivideTriangle(p, mid, r, depth + 1, out);
  subdivideTriangle(mid, q, r, depth + 1, out);
}

// Splits a ring that crosses the +/-180 antimeridian into separate pieces
// so earcut's local-plane triangulation doesn't wrap a huge box around
// the whole globe. Simple threshold split (not geometrically perfect at
// the seam) - fine at this zoom level, no country in this dataset both
// spans >180 degrees of longitude and needs pixel-perfect seam accuracy.
function splitAtAntimeridian(ring) {
  const segments = [];
  let current = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const prev = ring[i - 1];
    const pt = ring[i];
    if (Math.abs(pt[0] - prev[0]) > 180) {
      segments.push(current);
      current = [];
    }
    current.push(pt);
  }
  segments.push(current);
  return segments.filter((s) => s.length >= 3);
}

function buildCountryMesh(country) {
  const positions = [];

  for (const ring of country.rings) {
    for (const piece of splitAtAntimeridian(ring)) {
      const flat = [];
      for (const [lon, lat] of piece) flat.push(lon, lat);
      let tris;
      try {
        tris = earcut(flat);
      } catch (e) {
        continue;
      }
      if (!tris || tris.length === 0) continue;

      const subdivided = [];
      for (let i = 0; i < tris.length; i += 3) {
        subdivideTriangle(piece[tris[i]], piece[tris[i + 1]], piece[tris[i + 2]], 0, subdivided);
      }
      for (const [lon, lat] of subdivided) {
        const p = lonLatToVector3(lon, lat, SPHERE_RADIUS);
        positions.push(p.x, p.y, p.z);
      }
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();

  // DoubleSide as a safety net: subdividing removes the large-triangle
  // winding-flip case above, but costs nothing to keep as a backstop.
  const material = new THREE.MeshBasicMaterial({ color: DEFAULT_COLOR.getHex(), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.name = country.name;
  return mesh;
}

function buildBorderLines(country) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x0d2318, transparent: true, opacity: 0.55 });
  for (const ring of country.rings) {
    const pts = ring.map(([lon, lat]) => lonLatToVector3(lon, lat, SPHERE_RADIUS * 1.002));
    pts.push(pts[0]);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
  }
  return group;
}

function buildCountries() {
  for (const country of WORLD.countries) {
    const mesh = buildCountryMesh(country);
    if (!mesh) continue;
    countryGroup.add(mesh);
    countryGroup.add(buildBorderLines(country));
    const centroid = lonLatToVector3(country.centroid[0], country.centroid[1], SPHERE_RADIUS * 1.01);
    countryMeshes.push({ mesh, name: country.name, centroid, found: false });
  }
}

// ---------- Ocean labels (HTML overlay, billboarded via projection) ----------

function buildOceanLabels() {
  for (const ocean of WORLD.oceans) {
    const centroid = lonLatToVector3(ocean.centroid[0], ocean.centroid[1], SPHERE_RADIUS * 1.03);
    const el = document.createElement("div");
    el.className = "ocean-label";
    el.textContent = ocean.name;
    document.body.appendChild(el);
    oceanLabels.push({ name: ocean.name, centroid, el, found: false });
  }
  updateOceanLabelVisibility();
}

function updateOceanLabelVisibility() {
  for (const o of oceanLabels) o.el.style.display = state.showOceans ? "" : "none";
}

function updateOceanLabelPositions() {
  if (!state.showOceans) return;
  const camDir = camera.position.clone().normalize();
  for (const o of oceanLabels) {
    const facing = o.centroid.clone().normalize().dot(camDir);
    if (facing < 0.15) {
      o.el.style.opacity = "0";
      continue;
    }
    const projected = o.centroid.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    o.el.style.opacity = "1";
    o.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  }
}

// ---------- Highlighting ----------

let hoveredEntry = null;
let selectedEntry = null;

function setMeshColor(entry, color) {
  entry.mesh.material.color.set(color);
}

function refreshCountryColor(entry) {
  if (entry.found) {
    setMeshColor(entry, SELECTED_COLOR);
  } else if (entry === selectedEntry) {
    setMeshColor(entry, SELECTED_COLOR);
  } else if (entry === hoveredEntry) {
    setMeshColor(entry, HOVER_COLOR);
  } else {
    setMeshColor(entry, DEFAULT_COLOR);
  }
}

function setHovered(entry) {
  if (hoveredEntry === entry) return;
  const prev = hoveredEntry;
  hoveredEntry = entry;
  if (prev) refreshCountryColor(prev);
  if (hoveredEntry) refreshCountryColor(hoveredEntry);
}

function flashWrong(entry) {
  const original = entry.found ? SELECTED_COLOR : DEFAULT_COLOR;
  setMeshColor(entry, WRONG_FLASH_COLOR);
  setTimeout(() => refreshCountryColor(entry), 450);
}

// ---------- Hint ----------

let hintDismissed = false;
function dismissHint() {
  if (hintDismissed) return;
  hintDismissed = true;
  els.hint.classList.add("hint-hidden");
}

// ---------- Feedback banner ----------

let feedbackTimer = null;
function showFeedback(text, kind) {
  clearTimeout(feedbackTimer);
  els.feedback.textContent = text;
  els.feedback.className = `show ${kind}`;
  feedbackTimer = setTimeout(() => {
    els.feedback.classList.remove("show");
  }, 1400);
}

// ---------- Quiz mode ----------

let quizPool = [];
let quizTarget = null;

function buildQuizPool() {
  quizPool = countryMeshes.map((e) => e.name);
  if (state.showOceans) quizPool.push(...oceanLabels.map((o) => o.name));
}

function pickQuizTarget() {
  if (quizPool.length === 0) return;
  const name = quizPool[Math.floor(Math.random() * quizPool.length)];
  quizTarget = name;
  els.quizTarget.textContent = name;
}

function findEntryByName(name) {
  return countryMeshes.find((e) => e.name === name) || oceanLabels.find((o) => o.name === name);
}

function isOceanEntry(entry) {
  return oceanLabels.includes(entry);
}

function handleQuizGuess(entry) {
  if (entry.name === quizTarget) {
    entry.found = true;
    if (!isOceanEntry(entry)) refreshCountryColor(entry);
    showFeedback("That's right!", "correct");
    setTimeout(() => {
      pickQuizTarget();
    }, 700);
  } else {
    if (!isOceanEntry(entry)) flashWrong(entry);
    showFeedback("Try again", "try-again");
  }
}

function setQuizMode(on) {
  state.quizMode = on;
  els.modeBtn.classList.toggle("active", on);
  els.modeBtn.dataset.tooltip = on ? "Play explore" : "Play find-it";
  els.quizBanner.hidden = !on;
  els.hint.textContent = on
    ? "Drag to spin the globe. Tap the place named above."
    : "Drag to spin the globe. Tap a country or ocean to learn its name.";
  if (on) {
    for (const e of countryMeshes) {
      e.found = false;
      refreshCountryColor(e);
    }
    for (const o of oceanLabels) o.found = false;
    buildQuizPool();
    pickQuizTarget();
    setSelected(null);
  } else {
    els.feedback.classList.remove("show");
  }
}

// ---------- Selection / info ----------

function setSelected(entry) {
  const prev = selectedEntry;
  selectedEntry = entry;
  if (prev && !isOceanEntry(prev)) refreshCountryColor(prev);
  if (entry && !isOceanEntry(entry)) refreshCountryColor(entry);
}

function showPlaceInfo(name, clientX, clientY) {
  els.placeInfo.textContent = name;
  els.placeInfo.style.left = `${clientX}px`;
  els.placeInfo.style.top = `${clientY}px`;
  els.placeInfo.classList.add("visible");
}

function hidePlaceInfo() {
  els.placeInfo.classList.remove("visible");
}

// ---------- Pointer interaction ----------

const raycaster = new THREE.Raycaster();
let pointerDownPos = null;
let pointerMoved = false;

function screenToNDC(clientX, clientY) {
  return new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
}

function pickCountryAtScreen(clientX, clientY) {
  const ndc = screenToNDC(clientX, clientY);
  raycaster.setFromCamera(ndc, camera);
  const meshes = countryMeshes.map((e) => e.mesh);
  const hits = raycaster.intersectObjects(meshes);
  if (hits.length === 0) return null;
  return countryMeshes.find((e) => e.mesh === hits[0].object) || null;
}

function pickOceanLabelAtScreen(clientX, clientY) {
  if (!state.showOceans) return null;
  const OCEAN_HIT_RADIUS = 40;
  let best = null;
  let bestDist = Infinity;
  for (const o of oceanLabels) {
    if (o.el.style.display === "none" || o.el.style.opacity === "0") continue;
    const rect = o.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(clientX - cx, clientY - cy);
    if (dist < OCEAN_HIT_RADIUS && dist < bestDist) {
      best = o;
      bestDist = dist;
    }
  }
  return best;
}

function onPointerDown(e) {
  pointerDownPos = { x: e.clientX, y: e.clientY };
  pointerMoved = false;
}

function onPointerMove(e) {
  if (pointerDownPos) {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > CLICK_DRAG_THRESHOLD) pointerMoved = true;
  }

  if (e.target.closest("#controls") || e.target.closest("#place-list-wrap") || e.target.closest("#quiz-banner")) {
    setHovered(null);
    hidePlaceInfo();
    return;
  }

  const oceanHit = pickOceanLabelAtScreen(e.clientX, e.clientY);
  const countryHit = oceanHit ? null : pickCountryAtScreen(e.clientX, e.clientY);

  setHovered(countryHit);

  if (!state.quizMode) {
    if (oceanHit) showPlaceInfo(oceanHit.name, e.clientX, e.clientY);
    else if (countryHit) showPlaceInfo(countryHit.name, e.clientX, e.clientY);
    else hidePlaceInfo();
  }
}

function onPointerUp(e) {
  const wasClick = pointerDownPos && !pointerMoved;
  pointerDownPos = null;
  if (!wasClick) return;
  if (e.target.closest("#controls") || e.target.closest("#place-list-wrap") || e.target.closest("#quiz-banner")) return;

  dismissHint();

  const oceanHit = pickOceanLabelAtScreen(e.clientX, e.clientY);
  const hit = oceanHit || pickCountryAtScreen(e.clientX, e.clientY);

  if (!hit) {
    setSelected(null);
    return;
  }

  if (state.quizMode) {
    handleQuizGuess(hit);
  } else {
    setSelected(hit === selectedEntry ? null : hit);
    showPlaceInfo(hit.name, e.clientX, e.clientY);
  }
}

// ---------- Locate from list ----------

let cameraTween = null;

function animateCameraTo(targetDir) {
  const dist = camera.position.length();
  cameraTween = {
    startPos: camera.position.clone(),
    endPos: targetDir.clone().normalize().multiplyScalar(dist),
    start: performance.now(),
    duration: 900,
  };
}

function locatePlace(entry) {
  animateCameraTo(entry.centroid);
}

// ---------- Sidebar list ----------

function buildPlaceList() {
  els.list.innerHTML = "";
  const names = [...WORLD.oceans.map((o) => o.name), ...WORLD.countries.map((c) => c.name)];
  for (const name of names) {
    const item = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "place-item";
    btn.textContent = name;
    btn.addEventListener("click", () => {
      const entry = findEntryByName(name);
      if (entry) {
        locatePlace(entry);
        if (!state.quizMode) {
          setSelected(isOceanEntry(entry) ? null : entry);
        }
      }
    });
    item.appendChild(btn);
    els.list.appendChild(item);
  }
}

// ---------- Init ----------

function init() {
  loadSaved();
  buildCountries();
  buildOceanLabels();
  buildPlaceList();
  updateOceanLabelVisibility();

  els.oceansBtn.classList.toggle("active", state.showOceans);

  els.listToggleBtn.addEventListener("click", () => {
    const collapsed = els.listWrap.classList.toggle("collapsed");
    els.listToggleBtn.setAttribute("aria-expanded", String(!collapsed));
    els.listToggleBtn.classList.toggle("active", !collapsed);
  });

  els.oceansBtn.addEventListener("click", () => {
    state.showOceans = !state.showOceans;
    els.oceansBtn.classList.toggle("active", state.showOceans);
    updateOceanLabelVisibility();
    if (state.quizMode) buildQuizPool();
    save();
  });

  els.modeBtn.addEventListener("click", () => setQuizMode(!state.quizMode));
  els.quizSkipBtn.addEventListener("click", () => pickQuizTarget());

  els.canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("resize", onResize);

  setTimeout(dismissHint, 8000);

  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(now) {
  if (cameraTween) {
    const t = Math.min(1, (now - cameraTween.start) / cameraTween.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(cameraTween.startPos, cameraTween.endPos, eased);
    if (t >= 1) cameraTween = null;
  }

  controls.update();
  updateOceanLabelPositions();
  renderer.render(scene, camera);

  if (now % 3000 < 20) save();

  requestAnimationFrame(animate);
}

fetch("world-data.json")
  .then((r) => r.json())
  .then((data) => {
    WORLD = data;
    init();
  });
