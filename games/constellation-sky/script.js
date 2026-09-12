// Standalone: do not import from /shared/ or other game folders.
// Three.js is vendored locally in ./vendor/three/ - no CDN, no build step.

import * as THREE from "./vendor/three/three.module.min.js";
import { OrbitControls } from "./vendor/three/OrbitControls.js";
import { Line2 } from "./vendor/three/Line2.js";
import { LineGeometry } from "./vendor/three/LineGeometry.js";
import { LineMaterial } from "./vendor/three/LineMaterial.js";

const STORAGE_KEY = "ls-constellation-sky-v2";

const SPHERE_RADIUS = 100;
const SKY_CAMERA_DIST = SPHERE_RADIUS * 0.01;
const GLOBE_CAMERA_DIST_DESKTOP = SPHERE_RADIUS * 2.5;
const GLOBE_CAMERA_DIST_MOBILE = SPHERE_RADIUS * 3.5;
const CLICK_DRAG_THRESHOLD = 6; // px

const isMobile = window.innerWidth <= 800;

const state = {
  outsideView: true,
  showGuides: true,
  connections: [], // [starIndexA, starIndexB]
  cameraQuat: null, // saved orientation, restored on load
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.showGuides === "boolean") state.showGuides = saved.showGuides;
    if (Array.isArray(saved.connections)) state.connections = saved.connections;
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
        showGuides: state.showGuides,
        connections: state.connections,
        cameraQuat: camera.quaternion.toArray(),
      })
    );
  } catch (e) {
    // storage unavailable, play continues without persistence
  }
}

const els = {
  canvas: document.getElementById("sky-canvas"),
  coords: document.getElementById("coords"),
  hint: document.getElementById("hint"),
  starInfo: document.getElementById("star-info"),
  guideBtn: document.getElementById("guide-btn"),
  globeBtn: document.getElementById("globe-btn"),
  clearBtn: document.getElementById("clear-btn"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmCancel: document.getElementById("confirm-cancel"),
  confirmClear: document.getElementById("confirm-clear"),
  listWrap: document.getElementById("constellation-list-wrap"),
  listToggleBtn: document.getElementById("list-toggle-btn"),
  list: document.getElementById("constellation-list"),
};

// ---------- Coordinate formatting ----------

function formatRA(hours) {
  const h = Math.floor(hours);
  const mFloat = (hours - h) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function formatDec(deg) {
  const sign = deg < 0 ? "−" : "+";
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.round(mFloat);
  return `${sign}${String(d).padStart(2, "0")}° ${String(m).padStart(2, "0")}′`;
}

// RA/Dec (RA in hours) -> point on sphere. Matches the standard
// equatorial-to-Cartesian convention: RA measured eastward, so it is
// negated here to match a right-handed view from inside the sphere.
function raDecToVector3(raHours, decDeg, radius) {
  const ra = (-raHours / 24) * 2 * Math.PI;
  const dec = (decDeg / 180) * Math.PI;
  const x = radius * Math.cos(dec) * Math.cos(ra);
  const y = radius * Math.sin(dec);
  const z = radius * Math.cos(dec) * Math.sin(ra);
  return new THREE.Vector3(x, y, z);
}

function vector3ToRaDec(v) {
  const radius = v.length();
  const dec = Math.asin(v.y / radius) * (180 / Math.PI);
  let ra = -Math.atan2(v.z, v.x) * (12 / Math.PI); // back to hours
  ra = ((ra % 24) + 24) % 24;
  return { ra, dec };
}

// Real magnitude-to-visual-size curve (flux-based, not linear) so
// bright named stars stand out clearly from the faint background.
function starPointSize(mag) {
  const relFlux = Math.pow(10, -0.4 * mag);
  return Math.max(0.9, 3.4 * Math.pow(relFlux, 0.4) * 1.6);
}

// ---------- Scene setup ----------

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, SPHERE_RADIUS * 10);
const initialGlobeDist = isMobile ? GLOBE_CAMERA_DIST_MOBILE : GLOBE_CAMERA_DIST_DESKTOP;
camera.position.set(0, 0, initialGlobeDist);
camera.fov = 55;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);

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
}

// ---------- Star field ----------

let SKY = { stars: [], constellations: [] };
let starPositions = []; // THREE.Vector3 per star index
let starPointsObject = null;
let pickRaycaster = new THREE.Raycaster();
pickRaycaster.params.Points.threshold = 1.6;

function buildStarField() {
  const count = SKY.stars.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const star = SKY.stars[i];
    const p = raDecToVector3(star.ra, star.dec, SPHERE_RADIUS);
    starPositions[i] = p;
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    const isNamed = !!star.name;
    const r = isNamed ? 0.85 : 1;
    const g = isNamed ? 0.75 : 1;
    const b = isNamed ? 1 : 1;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    sizes[i] = starPointSize(star.mag);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv) * 2.0;
        float glow = exp(-4.0 * d * d);
        float core = exp(-40.0 * d * d);
        float alpha = glow * 0.6 + core;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(vColor * (0.7 + core * 0.3), alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });

  starPointsObject = new THREE.Points(geometry, material);
  scene.add(starPointsObject);
}

// ---------- Connection lines ----------

const ACCENT_COLOR = new THREE.Color(0xceabff);
const GUIDE_COLOR = new THREE.Color(0xffffff);

const playerLineGroup = new THREE.Group();
const guideLineGroup = new THREE.Group();
scene.add(playerLineGroup);
scene.add(guideLineGroup);

function connKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function makeLine(idxA, idxB, color, opacity) {
  const pa = starPositions[idxA];
  const pb = starPositions[idxB];
  const geometry = new LineGeometry();
  geometry.setPositions([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z]);
  const material = new LineMaterial({
    color: color.getHex(),
    linewidth: 2,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  });
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  line.userData.idxA = idxA;
  line.userData.idxB = idxB;
  return line;
}

function rebuildPlayerLines() {
  while (playerLineGroup.children.length) playerLineGroup.remove(playerLineGroup.children[0]);
  for (const [a, b] of state.connections) {
    playerLineGroup.add(makeLine(a, b, ACCENT_COLOR, 0.9));
  }
}

let highlightedConstellation = null;

function rebuildGuideLines() {
  while (guideLineGroup.children.length) guideLineGroup.remove(guideLineGroup.children[0]);
  const idByHr = new Map(SKY.stars.map((s, i) => [s.id, i]));
  for (const c of SKY.constellations) {
    const isHighlighted = c === highlightedConstellation;
    if (!state.showGuides && !isHighlighted) continue;
    const color = isHighlighted ? ACCENT_COLOR : GUIDE_COLOR;
    const opacity = isHighlighted ? 0.9 : 0.25;
    for (const [hrA, hrB] of c.lines) {
      const idxA = idByHr.get(hrA);
      const idxB = idByHr.get(hrB);
      if (idxA === undefined || idxB === undefined) continue;
      guideLineGroup.add(makeLine(idxA, idxB, color, opacity));
    }
  }
}

function toggleConnection(idxA, idxB) {
  if (idxA === idxB) return;
  const key = connKey(idxA, idxB);
  const i = state.connections.findIndex(([a, b]) => connKey(a, b) === key);
  if (i >= 0) state.connections.splice(i, 1);
  else state.connections.push([idxA, idxB]);
  rebuildPlayerLines();
  save();
}

function removeConnectionByLine(line) {
  const key = connKey(line.userData.idxA, line.userData.idxB);
  const i = state.connections.findIndex(([a, b]) => connKey(a, b) === key);
  if (i >= 0) state.connections.splice(i, 1);
  rebuildPlayerLines();
  save();
}

// ---------- Selection + hover ----------

let selectedIdx = null;
let hoverMarker = null;

function makeHoverMarker() {
  const geo = new THREE.SphereGeometry(1.2, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ color: ACCENT_COLOR, transparent: true, opacity: 0.9, depthTest: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

function setSelected(idx) {
  selectedIdx = idx;
  if (idx === null) {
    hoverMarker.visible = false;
  } else {
    hoverMarker.visible = true;
    hoverMarker.position.copy(starPositions[idx]);
  }
}

// ---------- Hint ----------

let hintDismissed = false;
function dismissHint() {
  if (hintDismissed) return;
  hintDismissed = true;
  els.hint.classList.add("hint-hidden");
}

// ---------- View toggle (camera distance tween) ----------

let cameraTween = null;

function animateCamera(targetDistance, targetFov, onDone) {
  const dir = camera.position.clone().normalize();
  if (dir.lengthSq() < 0.0001) dir.set(0, 0, 1);
  cameraTween = {
    startPos: camera.position.clone(),
    endPos: dir.multiplyScalar(targetDistance),
    startFov: camera.fov,
    endFov: targetFov,
    start: performance.now(),
    duration: 900,
    onDone,
  };
}

function averagePosition(indices) {
  const sum = new THREE.Vector3();
  for (const i of indices) sum.add(starPositions[i]);
  sum.divideScalar(indices.length);
  return sum;
}

// OrbitControls derives its internal spherical angles from the camera's
// actual position relative to `target` on every update() call, so moving
// the camera to a new position at the same radius (and letting the tween
// run before the next controls.update()) is enough to "turn to face" a
// point - no separate quaternion/lookAt tween needed, and it stays in
// sync with drag-to-look/orbit afterwards.
function locateConstellation(constellation) {
  const idByHr = new Map(SKY.stars.map((s, i) => [s.id, i]));
  const indices = constellation.stars.map((hr) => idByHr.get(hr)).filter((i) => i !== undefined);
  if (indices.length === 0) return;
  const center = averagePosition(indices);
  const dir = center.clone().normalize();
  const dist = camera.position.length();

  // OrbitControls always points the camera at the origin (lookAt(target)).
  // From outside the sphere (globe view), sitting on the SAME side as the
  // star and looking back at the origin faces the star. From inside
  // (sky view, camera near the origin), the camera must sit on the
  // OPPOSITE side so that looking at the origin faces outward toward it.
  const endPos = state.outsideView ? dir.multiplyScalar(dist) : dir.multiplyScalar(-dist);

  cameraTween = {
    startPos: camera.position.clone(),
    endPos,
    startFov: camera.fov,
    endFov: camera.fov,
    start: performance.now(),
    duration: 900,
  };
}

function setOutsideView(outside) {
  state.outsideView = outside;
  els.globeBtn.classList.toggle("active", outside);
  els.coords.style.display = outside ? "none" : "";

  if (outside) {
    const dist = isMobile ? GLOBE_CAMERA_DIST_MOBILE : GLOBE_CAMERA_DIST_DESKTOP;
    animateCamera(dist, 55, () => {
      controls.enableZoom = true;
      controls.zoomSpeed = 0.5;
      controls.rotateSpeed = 0.5;
      controls.minDistance = SPHERE_RADIUS * 1.3;
      controls.maxDistance = SPHERE_RADIUS * 6;
    });
  } else {
    controls.enableZoom = false;
    controls.rotateSpeed = isMobile ? -0.35 : 0.5;
    controls.minDistance = 0;
    controls.maxDistance = 0.1;
    animateCamera(SKY_CAMERA_DIST, 60);
  }
  save();
}

// ---------- Pointer interaction ----------

let pointerDownPos = null;
let pointerMoved = false;

function screenToNDC(clientX, clientY) {
  return new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
}

function pickAtScreen(clientX, clientY) {
  const ndc = screenToNDC(clientX, clientY);
  pickRaycaster.setFromCamera(ndc, camera);

  if (starPointsObject) {
    const starHits = pickRaycaster.intersectObject(starPointsObject);
    if (starHits.length > 0) {
      starHits.sort((a, b) => a.distanceToRay - b.distanceToRay);
      return { type: "star", index: starHits[0].index };
    }
  }
  const lineHits = pickRaycaster.intersectObjects(playerLineGroup.children);
  if (lineHits.length > 0) {
    return { type: "line", object: lineHits[0].object };
  }
  return null;
}

function updateHoverInfo(clientX, clientY) {
  const ndc = screenToNDC(clientX, clientY);
  pickRaycaster.setFromCamera(ndc, camera);
  if (!starPointsObject) return;
  const hits = pickRaycaster.intersectObject(starPointsObject);
  if (hits.length > 0) {
    const star = SKY.stars[hits[0].index];
    els.starInfo.textContent = star.name || "";
    if (star.name) {
      els.starInfo.style.left = `${clientX}px`;
      els.starInfo.style.top = `${clientY}px`;
      els.starInfo.classList.add("visible");
    } else {
      els.starInfo.classList.remove("visible");
    }
  } else {
    els.starInfo.classList.remove("visible");
  }
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
  if (!state.outsideView) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const { ra, dec } = vector3ToRaDec(dir);
    els.coords.textContent = `RA ${formatRA(ra)}  Dec ${formatDec(dec)}`;
  }
  updateHoverInfo(e.clientX, e.clientY);
}

function onPointerUp(e) {
  const wasClick = pointerDownPos && !pointerMoved;
  pointerDownPos = null;
  if (!wasClick) return;
  if (e.target.closest("#controls") || e.target.closest(".modal-backdrop") || e.target.closest("#constellation-list-wrap")) return;

  const hit = pickAtScreen(e.clientX, e.clientY);
  if (!hit) {
    if (selectedIdx !== null) {
      setSelected(null);
      save();
    }
    return;
  }

  dismissHint();

  if (hit.type === "line") {
    removeConnectionByLine(hit.object);
    return;
  }

  if (hit.type === "star") {
    if (selectedIdx === null) {
      setSelected(hit.index);
    } else if (selectedIdx === hit.index) {
      setSelected(null);
    } else {
      toggleConnection(selectedIdx, hit.index);
      setSelected(null);
    }
    save();
  }
}

// ---------- Controls wiring ----------

function openClearConfirm() {
  els.confirmModal.hidden = false;
}
function closeClearConfirm() {
  els.confirmModal.hidden = true;
}

// ---------- Constellation sidebar list ----------

function buildConstellationList() {
  els.list.innerHTML = "";
  for (const c of SKY.constellations) {
    const item = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "constellation-item";
    btn.dataset.name = c.name;

    const name = document.createElement("span");
    name.className = "constellation-item-name";
    name.textContent = c.name;
    btn.appendChild(name);

    if (c.desc) {
      const desc = document.createElement("span");
      desc.className = "constellation-item-desc";
      desc.textContent = c.desc;
      btn.appendChild(desc);
    }

    btn.addEventListener("click", () => selectConstellation(c, btn));
    item.appendChild(btn);
    els.list.appendChild(item);
  }
}

function selectConstellation(constellation, btnEl) {
  highlightedConstellation = highlightedConstellation === constellation ? null : constellation;
  for (const btn of els.list.querySelectorAll(".constellation-item")) {
    btn.classList.toggle("active", btn === btnEl && highlightedConstellation === constellation);
  }
  rebuildGuideLines();
  if (highlightedConstellation) locateConstellation(constellation);
}

function init() {
  loadSaved();

  buildStarField();
  rebuildPlayerLines();
  rebuildGuideLines();
  buildConstellationList();
  hoverMarker = makeHoverMarker();

  els.listToggleBtn.addEventListener("click", () => {
    const collapsed = els.listWrap.classList.toggle("collapsed");
    els.listToggleBtn.setAttribute("aria-expanded", String(!collapsed));
    els.listToggleBtn.classList.toggle("active", !collapsed);
  });

  els.guideBtn.classList.toggle("active", state.showGuides);
  els.globeBtn.classList.toggle("active", state.outsideView);
  els.coords.style.display = state.outsideView ? "none" : "";

  els.canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  els.guideBtn.addEventListener("click", () => {
    state.showGuides = !state.showGuides;
    els.guideBtn.classList.toggle("active", state.showGuides);
    rebuildGuideLines();
    save();
  });

  els.globeBtn.addEventListener("click", () => setOutsideView(!state.outsideView));

  els.clearBtn.addEventListener("click", openClearConfirm);
  els.confirmCancel.addEventListener("click", closeClearConfirm);
  els.confirmClear.addEventListener("click", () => {
    state.connections = [];
    rebuildPlayerLines();
    save();
    closeClearConfirm();
  });

  window.addEventListener("resize", onResize);

  setTimeout(dismissHint, 8000);

  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const res = new THREE.Vector2(window.innerWidth, window.innerHeight);
  for (const group of [playerLineGroup, guideLineGroup]) {
    for (const line of group.children) line.material.resolution.copy(res);
  }
}

function animate(now) {
  if (cameraTween) {
    const t = Math.min(1, (now - cameraTween.start) / cameraTween.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(cameraTween.startPos, cameraTween.endPos, eased);
    camera.fov = cameraTween.startFov + (cameraTween.endFov - cameraTween.startFov) * eased;
    camera.updateProjectionMatrix();
    if (t >= 1) {
      const done = cameraTween.onDone;
      cameraTween = null;
      if (done) done();
    }
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

fetch("sky-data.json")
  .then((r) => r.json())
  .then((data) => {
    SKY = data;
    init();
  });
