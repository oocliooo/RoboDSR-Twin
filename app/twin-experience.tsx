"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Layer = "node" | "zone" | "site";
type ViewMode = "split" | "physical" | "twin";
type CameraState = { yaw: number; pitch: number; distance: number; targetX: number; targetZ: number };
type Selectable = {
  id: string;
  name: string;
  kind: "room" | "robot" | "human" | "infrastructure" | "asset";
  layer: Layer;
  status: string;
  detail: string;
  capability: string;
};

const STAGES = ["Sense", "Interpret", "Decide", "Act", "Verify"];

const MISSIONS = [
  {
    id: 0,
    code: "M01",
    short: "Room readiness",
    title: "Empty is not ready",
    claim: "A camera sees an empty room. The living twin makes it ready—and proves it.",
    accent: "#ff9c4a",
    focus: "room-203",
    predicate: "RoomReady = Empty ∧ Supplied ∧ Clear ∧ Clean ∧ Safe",
    status: ["Patient departed", "Readiness rule failed", "Turnover plan created", "Fleet executing", "Room ready · verified"],
    metric: "42% faster turnover",
    evidence: "All five readiness conditions confirmed",
  },
  {
    id: 1,
    code: "M02",
    short: "Chain of custody",
    title: "Specimen chain of custody",
    claim: "A camera sees a box. The living twin certifies the complete specimen workflow.",
    accent: "#41d6b3",
    focus: "sample-amr",
    predicate: "ValidHandoff = ID ∧ Receiver ∧ Custody ∧ TimeWindow",
    status: ["Sample sealed", "Identity + custody linked", "Secure route reserved", "AMR in transit", "Handoff verified"],
    metric: "100% custody trace",
    evidence: "Receiver, identity, route and time window matched",
  },
  {
    id: 2,
    code: "M03",
    short: "Patient flow",
    title: "Patient-sensitive flow",
    claim: "One twin choreographs patient movement, urgent logistics, and site infrastructure.",
    accent: "#6ea8ff",
    focus: "wheelchair",
    predicate: "PatientSafety > UrgentSample > RoutineGuidance",
    status: ["Route overlap detected", "Priority policy applied", "Safe corridor reserved", "Logistics rerouted", "Both arrivals verified"],
    metric: "0 unsafe conflicts",
    evidence: "Patient route protected; sample SLA preserved",
  },
  {
    id: 3,
    code: "M04",
    short: "Active search",
    title: "Missing asset active search",
    claim: "When the twin is uncertain, the robotic ecosystem actively repairs it.",
    accent: "#a88cff",
    focus: "asset-wheelchair",
    predicate: "LocationConfidence(asset) < 0.65 → ActiveSearch",
    status: ["Location became stale", "Confidence fell to 41%", "Search plan ranked", "Inspection node scanning", "Asset found · twin corrected"],
    metric: "6m 18s recovered",
    evidence: "Identity confirmed and availability restored",
  },
  {
    id: 4,
    code: "M05",
    short: "Policy switch",
    title: "Dynamic policy switch",
    claim: "Change one site rule and the entire robotic ecosystem adapts.",
    accent: "#ff6f86",
    focus: "corridor-d",
    predicate: "Restricted(Corridor D) = true · Cleaning only",
    status: ["Restriction issued", "Permissions recompiled", "Routes recalculated", "Doors + signage updated", "Safe reopening verified"],
    metric: "1.2s propagation",
    evidence: "No policy violations across all active nodes",
  },
] as const;

const ENTITIES: Selectable[] = [
  { id: "room-203", name: "Consultation Room 203", kind: "room", layer: "zone", status: "Not ready", detail: "Patient has departed; supply and cleaning checks remain incomplete.", capability: "Occupancy · readiness · turnover" },
  { id: "room-205", name: "Consultation Room 205", kind: "room", layer: "zone", status: "Ready", detail: "Available as a fallback room while Room 203 completes turnover.", capability: "Occupancy · assignment · verification" },
  { id: "reception", name: "Reception", kind: "room", layer: "zone", status: "Normal", detail: "Patient arrival, guidance, and mobility-assistance dispatch point.", capability: "Arrival · guidance · queue state" },
  { id: "nurse-station", name: "Nurse Station", kind: "room", layer: "zone", status: "Staffed", detail: "Local oversight and human-approval point for clinical-center operations.", capability: "Oversight · exceptions · approval" },
  { id: "supply", name: "Supply Area", kind: "room", layer: "zone", status: "86% stocked", detail: "Smart cabinet and mobile manipulator coordinate replenishment.", capability: "Inventory · dispense · handoff" },
  { id: "concierge", name: "Concierge Robot", kind: "robot", layer: "node", status: "Guiding", detail: "Interacts with patients and visitors and explains route changes.", capability: "Dialogue · wayfinding · escalation" },
  { id: "sample-amr", name: "Secure Sample AMR", kind: "robot", layer: "node", status: "Assigned", detail: "Transports locked specimens with an auditable custody state.", capability: "Secure transport · ID · telemetry" },
  { id: "cleaner", name: "Cleaning Robot", kind: "robot", layer: "node", status: "Available", detail: "Executes a verified room-cleaning and disinfection cycle.", capability: "Clean · disinfect · completion proof" },
  { id: "manipulator", name: "Mobile Manipulator", kind: "robot", layer: "node", status: "Ready", detail: "Places supplies and removes leftover items during room turnover.", capability: "Navigate · grasp · place · inspect" },
  { id: "wheelchair", name: "Smart Wheelchair", kind: "robot", layer: "node", status: "Route reserved", detail: "Receives patient-safe routing and infrastructure priority.", capability: "Mobility · localization · safe stop" },
  { id: "asset-wheelchair", name: "Wheelchair A-17", kind: "asset", layer: "node", status: "Low confidence", detail: "Last observation is stale; active search threshold has been crossed.", capability: "Tag identity · availability · location" },
  { id: "smart-door", name: "Smart Door D", kind: "infrastructure", layer: "node", status: "Restricted", detail: "Enforces the temporary corridor access policy at the physical boundary.", capability: "Access · reservation · audit" },
  { id: "corridor-d", name: "Corridor D", kind: "room", layer: "zone", status: "Restricted", detail: "Temporary cleaning-only zone; all other routes are recalculated.", capability: "Capacity · routing · policy" },
];

const ENTITY_MAP = new Map(ENTITIES.map((entity) => [entity.id, entity]));

const ROOM_SPECS = [
  { id: "room-203", label: "ROOM 203", x: -5.7, z: -3.3, w: 5.2, d: 3.6, color: 0xf1e6d8 },
  { id: "room-205", label: "ROOM 205", x: 2.4, z: -3.3, w: 5.4, d: 3.6, color: 0xe7ecdf },
  { id: "nurse-station", label: "NURSE STATION", x: 5.7, z: 0.5, w: 2.8, d: 3.1, color: 0xe9ddca },
  { id: "reception", label: "RECEPTION", x: -5.9, z: 3.3, w: 4.8, d: 3.2, color: 0xe8ded3 },
  { id: "supply", label: "SUPPLY", x: 4.6, z: 3.6, w: 3.8, d: 2.8, color: 0xe3e2d5 },
];

const ROBOT_SPECS = [
  { id: "concierge", x: -3.6, z: 3.2, color: 0x5fa8ff, type: "tall" },
  { id: "sample-amr", x: 0.4, z: 1.1, color: 0x49d5b5, type: "amr" },
  { id: "cleaner", x: -4.7, z: -2.7, color: 0xff9c4a, type: "tall" },
  { id: "manipulator", x: 4.5, z: 3.6, color: 0xb29aff, type: "arm" },
  { id: "wheelchair", x: -1.9, z: 2.25, color: 0x6ea8ff, type: "chair" },
  { id: "asset-wheelchair", x: 6.2, z: -3.2, color: 0xffcf56, type: "chair" },
];

const ZONE_COLORS = [0x6ea8ff, 0xa88cff, 0x41d6b3, 0xff9c4a, 0xff6f86];

function labelSprite(text: string, color: string, scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(3, 12, 24, .82)";
  context.beginPath();
  context.roundRect(4, 4, 504, 104, 28);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = "#f4f9ff";
  context.font = "700 38px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 58);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.5 * scale, 0.77 * scale, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function assignSelectable(object: THREE.Object3D, id: string) {
  object.traverse((child) => {
    child.userData.selectableId = id;
  });
}

function addWall(scene: THREE.Scene, x: number, z: number, w: number, d: number, mode: "physical" | "twin") {
  const mat = new THREE.MeshStandardMaterial({
    color: mode === "physical" ? 0xe5ddd2 : 0x188ee8,
    transparent: true,
    opacity: mode === "physical" ? 0.96 : 0.34,
    emissive: mode === "twin" ? 0x063d68 : 0x000000,
    roughness: mode === "physical" ? 0.72 : 0.3,
    metalness: mode === "physical" ? 0.02 : 0.4,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1.25, d), mat);
  mesh.position.set(x, 0.65, z);
  mesh.castShadow = mode === "physical";
  mesh.receiveShadow = mode === "physical";
  scene.add(mesh);
  return mesh;
}

function addRoom(scene: THREE.Scene, spec: (typeof ROOM_SPECS)[number], mode: "physical" | "twin", layer: Layer, selectedId: string) {
  const group = new THREE.Group();
  const zoneActive = layer === "zone" || selectedId === spec.id;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w, mode === "twin" && zoneActive ? 0.14 : 0.08, spec.d),
    new THREE.MeshStandardMaterial({
      color: mode === "physical" ? spec.color : ZONE_COLORS[ROOM_SPECS.indexOf(spec)],
      transparent: mode === "twin",
      opacity: mode === "twin" ? (zoneActive ? 0.34 : 0.11) : 1,
      emissive: mode === "twin" ? ZONE_COLORS[ROOM_SPECS.indexOf(spec)] : 0,
      emissiveIntensity: mode === "twin" ? (zoneActive ? 0.28 : 0.04) : 0,
      roughness: 0.8,
    })
  );
  floor.position.y = 0.08;
  group.add(floor);
  const t = 0.1;
  const h = 1.5;
  const wallMat = new THREE.MeshStandardMaterial({
    color: mode === "physical" ? 0xf5f1eb : 0x39b8ff,
    transparent: true,
    opacity: mode === "physical" ? 0.98 : zoneActive ? 0.42 : 0.22,
    emissive: mode === "twin" ? 0x075b91 : 0,
    wireframe: mode === "twin" && layer !== "zone",
  });
  const walls = [
    [0, -spec.d / 2, spec.w, t],
    [-spec.w / 2, 0, t, spec.d],
    [spec.w / 2, 0, t, spec.d],
    [-spec.w * 0.31, spec.d / 2, spec.w * 0.38, t],
    [spec.w * 0.31, spec.d / 2, spec.w * 0.38, t],
  ];
  walls.forEach(([x, z, w, d]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, h / 2, z);
    wall.castShadow = mode === "physical";
    group.add(wall);
  });

  if (mode === "physical") {
    const furnitureMat = new THREE.MeshStandardMaterial({ color: spec.id === "nurse-station" ? 0xa87758 : 0xb58c69, roughness: 0.72 });
    if (spec.id.startsWith("room")) {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.72), furnitureMat);
      desk.position.set(-0.6, 0.28, -0.55);
      group.add(desk);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.32, 0.72), new THREE.MeshStandardMaterial({ color: 0xd7e4ec }));
      bed.position.set(0.8, 0.27, 0.58);
      group.add(bed);
    } else {
      const counter = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.2, spec.w * 0.62), 0.62, 0.62), furnitureMat);
      counter.position.set(0, 0.34, 0);
      group.add(counter);
    }
  }

  const label = labelSprite(spec.label, mode === "physical" ? "#5f85a8" : "#35b8ff", 0.75);
  label.position.set(0, 2.05, 0);
  group.add(label);
  group.position.set(spec.x, 0, spec.z);
  assignSelectable(group, spec.id);
  scene.add(group);
}

function addRobot(scene: THREE.Scene, spec: (typeof ROBOT_SPECS)[number], mode: "physical" | "twin", layer: Layer, mission: number, stage: number, selectedId: string) {
  const group = new THREE.Group();
  const active = selectedId === spec.id || MISSIONS[mission].focus === spec.id;
  const color = new THREE.Color(spec.color);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: mode === "physical" ? color.clone().lerp(new THREE.Color(0xffffff), 0.25) : color,
    metalness: mode === "physical" ? 0.38 : 0.72,
    roughness: 0.33,
    emissive: mode === "twin" ? color : 0,
    emissiveIntensity: mode === "twin" ? (layer === "node" || active ? 0.72 : 0.18) : 0,
    transparent: mode === "twin",
    opacity: mode === "twin" ? (layer === "node" || active ? 0.94 : 0.52) : 1,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x12283d, metalness: 0.55, roughness: 0.3 });

  if (spec.type === "tall") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 0.28, 16), darkMat);
    base.position.y = 0.18;
    group.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.78, 16), bodyMat);
    body.position.y = 0.7;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.28), darkMat);
    head.position.y = 1.23;
    group.add(head);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), new THREE.MeshBasicMaterial({ color: spec.color }));
    screen.position.set(0, 1.23, 0.145);
    group.add(screen);
  } else if (spec.type === "amr") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.38, 0.72), bodyMat);
    base.position.y = 0.28;
    group.add(base);
    const payload = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.42, 0.52), new THREE.MeshStandardMaterial({ color: 0xe5ecf1, metalness: 0.3 }));
    payload.position.y = 0.67;
    group.add(payload);
  } else if (spec.type === "chair") {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.6), bodyMat);
    seat.position.y = 0.53;
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.14), bodyMat);
    back.position.set(0, 0.82, -0.28);
    group.add(back);
    [-0.36, 0.36].forEach((x) => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.055, 8, 18), darkMat);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(x, 0.32, 0);
      group.add(wheel);
    });
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.34, 0.66), bodyMat);
    base.position.y = 0.24;
    group.add(base);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), darkMat);
    joint.position.y = 0.58;
    group.add(joint);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.66, 6, 12), bodyMat);
    arm.rotation.z = -0.65;
    arm.position.set(0.24, 0.94, 0);
    group.add(arm);
  }

  if (mode === "twin" || active) {
    const ringMat = new THREE.MeshBasicMaterial({ color: active ? MISSIONS[mission].accent : spec.color, transparent: true, opacity: active ? 0.95 : 0.44, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.63, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.035;
    ring.userData.pulse = true;
    group.add(ring);
  }
  const label = labelSprite(ENTITY_MAP.get(spec.id)?.name.toUpperCase() ?? spec.id, `#${color.getHexString()}`, 0.55);
  label.position.set(0, 1.8, 0);
  label.visible = active || layer === "node";
  group.add(label);
  group.position.set(spec.x, 0.12, spec.z);
  assignSelectable(group, spec.id);
  scene.add(group);
}

function addRoute(scene: THREE.Scene, points: Array<[number, number]>, color: number, mode: "physical" | "twin", highlighted = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, mode === "twin" ? 0.22 : 0.12, z)));
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: highlighted ? 0.96 : mode === "twin" ? 0.7 : 0.48 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(highlighted ? 0.13 : 0.09, 12, 8), new THREE.MeshBasicMaterial({ color }));
  pulse.userData.routeCurve = curve;
  pulse.userData.routeOffset = Math.random();
  scene.add(pulse);
}

function addSiteOverlay(scene: THREE.Scene, mode: "physical" | "twin", layer: Layer, mission: number) {
  if (mode !== "twin") return;
  if (layer === "site") {
    const siteMat = new THREE.MeshBasicMaterial({ color: 0x4fd4ff, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false });
    const sitePlane = new THREE.Mesh(new THREE.PlaneGeometry(17.2, 10.9, 12, 8), siteMat);
    sitePlane.rotation.x = -Math.PI / 2;
    sitePlane.position.y = 3.2;
    scene.add(sitePlane);
    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-8.6, 3.25, -5.45), new THREE.Vector3(8.6, 3.25, -5.45),
        new THREE.Vector3(8.6, 3.25, 5.45), new THREE.Vector3(-8.6, 3.25, 5.45),
      ]),
      new THREE.LineBasicMaterial({ color: 0x64dcff, transparent: true, opacity: 0.85 })
    );
    scene.add(border);
    ROOM_SPECS.forEach((room) => {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: MISSIONS[mission].accent }));
      node.position.set(room.x, 3.35, room.z);
      scene.add(node);
      const link = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([node.position, new THREE.Vector3(0, 3.35, 0)]),
        new THREE.LineBasicMaterial({ color: MISSIONS[mission].accent, transparent: true, opacity: 0.55 })
      );
      scene.add(link);
    });
    const label = labelSprite("SITE · GLOBAL INTELLIGENCE", "#64dcff", 0.92);
    label.position.set(0, 4.1, -3.8);
    scene.add(label);
  }
  if (layer === "zone") {
    const label = labelSprite("ZONE · LOCAL COORDINATION", "#a88cff", 0.86);
    label.position.set(0, 3, -4.8);
    scene.add(label);
  }
  if (layer === "node") {
    ROBOT_SPECS.forEach((a, index) => {
      const b = ROBOT_SPECS[(index + 1) % ROBOT_SPECS.length];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, 1.55, a.z), new THREE.Vector3(b.x, 1.55, b.z)]),
        new THREE.LineDashedMaterial({ color: 0xa88cff, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.42 })
      );
      line.computeLineDistances();
      scene.add(line);
    });
    const label = labelSprite("NODE · PERCEPTION + ACTION", "#a88cff", 0.86);
    label.position.set(0, 2.55, -4.8);
    scene.add(label);
  }
}

function ThreeSite({
  mode,
  layer,
  mission,
  stage,
  selectedId,
  cameraState,
  onCameraChange,
  onSelect,
}: {
  mode: "physical" | "twin";
  layer: Layer;
  mission: number;
  stage: number;
  selectedId: string;
  cameraState: CameraState;
  onCameraChange: (next: CameraState) => void;
  onSelect: (id: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(mode === "physical" ? 0xe7ebed : 0x03101d);
    scene.fog = new THREE.Fog(mode === "physical" ? 0xe7ebed : 0x03101d, 19, 32);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = mode === "physical";
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = mode === "physical" ? 1.05 : 1.25;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(34, mount.clientWidth / mount.clientHeight, 0.1, 100);
    cameraRef.current = camera;

    scene.add(new THREE.HemisphereLight(mode === "physical" ? 0xfff8ec : 0x52bfff, mode === "physical" ? 0x6b8290 : 0x00101d, mode === "physical" ? 2.15 : 1.15));
    const key = new THREE.DirectionalLight(mode === "physical" ? 0xffe4c3 : 0x71caff, mode === "physical" ? 3.4 : 2.2);
    key.position.set(-6, 11, 7);
    key.castShadow = mode === "physical";
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    scene.add(key);
    if (mode === "twin") {
      const cyan = new THREE.PointLight(0x23b9ff, 17, 18);
      cyan.position.set(0, 6, 0);
      scene.add(cyan);
    }

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.3, 11.8),
      new THREE.MeshStandardMaterial({ color: mode === "physical" ? 0xd1d8d7 : 0x042b48, metalness: mode === "twin" ? 0.65 : 0.08, roughness: 0.74 })
    );
    base.position.y = -0.15;
    base.receiveShadow = true;
    scene.add(base);

    if (mode === "twin") {
      const grid = new THREE.GridHelper(18, 36, 0x167fbd, 0x0b395a);
      grid.position.y = 0.015;
      scene.add(grid);
    }

    ROOM_SPECS.forEach((room) => addRoom(scene, room, mode, layer, selectedId));
    addWall(scene, -0.15, -5.65, 17.7, 0.12, mode);
    addWall(scene, -8.85, 0, 0.12, 11.4, mode);
    addWall(scene, 8.85, 0, 0.12, 11.4, mode);
    addWall(scene, -0.15, 5.65, 17.7, 0.12, mode);
    ROBOT_SPECS.forEach((robot) => addRobot(scene, robot, mode, layer, mission, stage, selectedId));

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.6, 1.65),
      new THREE.MeshStandardMaterial({ color: mission === 4 ? 0xff5e79 : mode === "physical" ? 0x7794a8 : 0x2cb8ff, emissive: mode === "twin" || mission === 4 ? 0x5c1121 : 0, emissiveIntensity: 0.7 })
    );
    door.position.set(1.45, 0.8, -0.62);
    assignSelectable(door, mission === 4 ? "corridor-d" : "smart-door");
    scene.add(door);

    const patientRoute: Array<[number, number]> = [[-7.3, 4.6], [-5.2, 3.4], [-2.7, 3], [-1.4, 1.6], [0.1, -0.2], [2.4, -2.4]];
    const logisticsRoute: Array<[number, number]> = [[5.4, 4.1], [3.3, 3.1], [1.5, 2.1], [0, 0.9], [-2.1, 0.6], [-4.6, -2.2]];
    const serviceRoute: Array<[number, number]> = [[-4.7, -2.7], [-3.1, -1.4], [-1.2, -0.5], [1.4, 0.35], [3.9, 1.6], [5.4, 3.7]];
    addRoute(scene, patientRoute, 0x58a8ff, mode, mission === 2);
    addRoute(scene, logisticsRoute, 0x45d6a6, mode, mission === 1 || mission === 2);
    addRoute(scene, serviceRoute, mission === 4 ? 0xff6f86 : 0xff9c4a, mode, mission === 0 || mission === 4);
    addSiteOverlay(scene, mode, layer, mission);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    let yaw = cameraState.yaw;
    let pitch = cameraState.pitch;
    let distance = cameraState.distance;
    let frame = 0;

    const updateCamera = () => {
      const cosPitch = Math.cos(pitch);
      camera.position.set(
        cameraState.targetX + distance * Math.sin(yaw) * cosPitch,
        distance * Math.sin(pitch),
        cameraState.targetZ + distance * Math.cos(yaw) * cosPitch
      );
      camera.lookAt(cameraState.targetX, 0.25, cameraState.targetZ);
    };
    updateCamera();

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      yaw -= dx * 0.007;
      pitch = Math.max(0.3, Math.min(1.18, pitch + dy * 0.005));
      lastX = event.clientX;
      lastY = event.clientY;
      const cosPitch = Math.cos(pitch);
      camera.position.set(cameraState.targetX + distance * Math.sin(yaw) * cosPitch, distance * Math.sin(pitch), cameraState.targetZ + distance * Math.cos(yaw) * cosPitch);
      camera.lookAt(cameraState.targetX, 0.25, cameraState.targetZ);
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      renderer.domElement.releasePointerCapture(event.pointerId);
      onCameraChange({ ...cameraState, yaw, pitch, distance });
      if (moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(scene.children, true).find((result) => result.object.userData.selectableId);
      if (hit?.object.userData.selectableId) onSelect(hit.object.userData.selectableId);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = Math.max(11, Math.min(28, distance + event.deltaY * 0.012));
      onCameraChange({ ...cameraState, yaw, pitch, distance });
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      scene.traverse((object) => {
        if (object.userData.routeCurve) {
          const t = (elapsed * 0.095 + object.userData.routeOffset) % 1;
          object.position.copy(object.userData.routeCurve.getPointAt(t));
        }
        if (object.userData.pulse && object instanceof THREE.Mesh) {
          const scale = 1 + Math.sin(elapsed * 3.2) * 0.12;
          object.scale.setScalar(scale);
        }
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const resize = new ResizeObserver(() => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(mount);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material instanceof THREE.SpriteMaterial && material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mode, layer, mission, selectedId, onCameraChange, onSelect]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const cosPitch = Math.cos(cameraState.pitch);
    camera.position.set(
      cameraState.targetX + cameraState.distance * Math.sin(cameraState.yaw) * cosPitch,
      cameraState.distance * Math.sin(cameraState.pitch),
      cameraState.targetZ + cameraState.distance * Math.cos(cameraState.yaw) * cosPitch
    );
    camera.lookAt(cameraState.targetX, 0.25, cameraState.targetZ);
  }, [cameraState]);

  return <div ref={mountRef} className="three-mount" aria-label={`${mode} interactive 3D healthcare site`} />;
}

function LayerStack({ layer, onChange }: { layer: Layer; onChange: (layer: Layer) => void }) {
  const layers: Array<{ id: Layer; index: string; title: string; subtitle: string }> = [
    { id: "site", index: "03", title: "Site", subtitle: "Policy · allocation" },
    { id: "zone", index: "02", title: "Zone", subtitle: "Routes · handoffs" },
    { id: "node", index: "01", title: "Node", subtitle: "Sense · interact · act" },
  ];
  return (
    <div className="layer-stack" aria-label="Digital twin operational layers">
      <div className="stack-kicker">OPERATIONAL STACK</div>
      {layers.map((item) => (
        <button key={item.id} className={layer === item.id ? "layer-card active" : "layer-card"} onClick={() => onChange(item.id)} aria-pressed={layer === item.id}>
          <span>{item.index}</span>
          <strong>{item.title}</strong>
          <small>{item.subtitle}</small>
        </button>
      ))}
      <div className="vertical-bridge"><span>DSR / AutoDSL</span></div>
    </div>
  );
}

function Inspector({ selected, mission, stage, onClose }: { selected: Selectable; mission: (typeof MISSIONS)[number]; stage: number; onClose: () => void }) {
  const stageTone = stage === 4 ? "verified" : stage === 1 ? "attention" : "active";
  return (
    <aside className="inspector" aria-label="Selected item details">
      <div className="inspector-top">
        <div>
          <span className="eyebrow">{selected.kind} · {selected.layer} layer</span>
          <h2>{selected.name}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close details">×</button>
      </div>
      <div className={`status-line ${stageTone}`}><span />{stage === 4 ? "VERIFIED STATE" : selected.status.toUpperCase()}</div>
      <p className="entity-detail">{selected.detail}</p>

      <div className="inspector-section">
        <span className="section-label">LIVE CAPABILITY</span>
        <p>{selected.capability}</p>
      </div>

      <div className="semantic-card">
        <div className="semantic-head"><span>SEMANTIC BRIDGE</span><b>HUMAN-VALIDATED</b></div>
        <code>{mission.predicate}</code>
        <div className="semantic-flow"><span>Physical evidence</span><i>→</i><span>Twin meaning</span></div>
      </div>

      <div className="mission-progress">
        <div className="section-label">CURRENT MISSION</div>
        <strong>{mission.code} · {mission.title}</strong>
        <p>{mission.status[stage]}</p>
        <div className="progress-track"><span style={{ width: `${(stage + 1) * 20}%`, background: mission.accent }} /></div>
      </div>

      <div className="metric-pair">
        <div><span>PROJECTED</span><strong>{mission.metric}</strong></div>
        <div><span>EVIDENCE</span><strong>{stage === 4 ? "Accepted" : `${stage + 1}/5 states`}</strong></div>
      </div>
      <div className="audit-note"><span>✓</span>{mission.evidence}</div>
    </aside>
  );
}

export function TwinExperience() {
  const [missionIndex, setMissionIndex] = useState(0);
  const [stage, setStage] = useState(2);
  const [layer, setLayer] = useState<Layer>("zone");
  const [view, setView] = useState<ViewMode>("split");
  const [playing, setPlaying] = useState(true);
  const [selectedId, setSelectedId] = useState("room-203");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [cameraState, setCameraState] = useState<CameraState>({ yaw: -0.72, pitch: 0.76, distance: 20.5, targetX: 0, targetZ: 0 });
  const mission = MISSIONS[missionIndex];
  const selected = ENTITY_MAP.get(selectedId) ?? ENTITY_MAP.get(mission.focus)!;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStage((current) => (current + 1) % STAGES.length), 1800);
    return () => window.clearInterval(timer);
  }, [playing]);

  const selectMission = (index: number) => {
    setMissionIndex(index);
    setStage(0);
    setSelectedId(MISSIONS[index].focus);
    setInspectorOpen(true);
  };
  const onSelect = useCallback((id: string) => {
    setSelectedId(id);
    setInspectorOpen(true);
  }, []);
  const onCameraChange = useCallback((next: CameraState) => setCameraState(next), []);
  const resetCamera = () => setCameraState({ yaw: -0.72, pitch: 0.76, distance: 20.5, targetX: 0, targetZ: 0 });
  const visibleScenes = useMemo(() => ({ physical: view !== "twin", twin: view !== "physical" }), [view]);

  return (
    <main className="app-shell" style={{ "--mission-accent": mission.accent } as React.CSSProperties}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><strong>RoboDSR <em>TWIN</em></strong><small>HEALTHCARE SPATIAL INTELLIGENCE</small></div>
        </div>
        <div className="top-synthesis">The healthcare center as one intelligent system</div>
        <div className="system-status"><span />LIVE SITE · 14:32:08 HKT</div>
      </header>

      <section className="workspace">
        <div className={`scene-grid view-${view}`}>
          {visibleScenes.physical && (
            <section className="scene-panel physical-panel">
              <div className="scene-head">
                <div><span className="scene-index">01</span><div><strong>Physical site</strong><small>EVIDENCE · BODIES · ACTION</small></div></div>
                <div className="scene-state"><span />LIVE FEED</div>
              </div>
              <ThreeSite mode="physical" layer={layer} mission={missionIndex} stage={stage} selectedId={selectedId} cameraState={cameraState} onCameraChange={onCameraChange} onSelect={onSelect} />
              <div className="scene-hint">DRAG TO ORBIT <span>·</span> SCROLL TO ZOOM <span>·</span> SELECT ANY NODE</div>
            </section>
          )}
          {visibleScenes.twin && (
            <section className="scene-panel twin-panel">
              <div className="scene-head">
                <div><span className="scene-index">02</span><div><strong>Living digital twin</strong><small>STATE · PLAN · PREDICTION</small></div></div>
                <div className="scene-state twin-state"><span />SYNCHRONIZED</div>
              </div>
              <ThreeSite mode="twin" layer={layer} mission={missionIndex} stage={stage} selectedId={selectedId} cameraState={cameraState} onCameraChange={onCameraChange} onSelect={onSelect} />
              <LayerStack layer={layer} onChange={setLayer} />
              <div className="twin-readout"><span>STATE FRESHNESS</span><strong>182 ms</strong><i>98.7%</i></div>
            </section>
          )}

          <div className="view-controls" aria-label="Scene view">
            {(["split", "physical", "twin"] as const).map((mode) => (
              <button key={mode} className={view === mode ? "active" : ""} onClick={() => setView(mode)} aria-pressed={view === mode}>{mode}</button>
            ))}
            <button className="reset-view" onClick={resetCamera} aria-label="Reset 3D camera">↺</button>
          </div>

          <div className="semantic-membrane" aria-hidden="true">
            <span>PHYSICAL EVIDENCE</span><i>↔</i><strong>DSR / AutoDSL</strong><i>↔</i><span>TWIN STATE</span>
          </div>
        </div>

        {inspectorOpen && <Inspector selected={selected} mission={mission} stage={stage} onClose={() => setInspectorOpen(false)} />}
        {!inspectorOpen && <button className="open-inspector" onClick={() => setInspectorOpen(true)}><span>＋</span> OPEN LIVE INSPECTOR</button>}
      </section>

      <section className="mission-console" aria-label="Mission controls">
        <div className="mission-narrative">
          <span>{mission.code} · LIVE DEMONSTRATION</span>
          <h1>{mission.title}</h1>
          <p>{mission.claim}</p>
        </div>
        <div className="closed-loop">
          <button className="play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause scenario" : "Play scenario"}>{playing ? "Ⅱ" : "▶"}</button>
          {STAGES.map((name, index) => (
            <button key={name} className={`${index === stage ? "active" : ""} ${index < stage ? "complete" : ""}`} onClick={() => { setStage(index); setPlaying(false); }}>
              <span>{index < stage ? "✓" : `0${index + 1}`}</span><strong>{name}</strong>
            </button>
          ))}
        </div>
        <div className="mission-tabs">
          {MISSIONS.map((item, index) => (
            <button key={item.code} className={missionIndex === index ? "active" : ""} onClick={() => selectMission(index)}>
              <span>{item.code}</span><strong>{item.short}</strong>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
