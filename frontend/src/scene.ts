/**
 * TheSphere – three.js scene graph for the Coherence Engine.
 *
 * Three concentric translucent geodesic spheres:
 *   L₀ (Ground / Body)      r=4.6  amber wireframe
 *   L₁ (Modulation / LLM)   r=5.0  cyber-lime wireframe
 *   L₂ (Faszien / Coupling) r=5.4  white fine wireframe (subtle)
 *
 * Each layer carries 8 vector beams + tip spheres + ghost dashes (layer 0 only).
 *
 * Per-frame:
 *   - sphere deformation: perlin (cold/hot) + standing wave (warm/singing)
 *   - vectors update from physics state (24 nodes)
 *   - layer-0 sphere colour: lime → amber as sing_index ↑
 *   - layer-1 lights pulse with recent LLM impressions
 *   - layer-2 visibility ramps with sing_index (only seen when system "sings")
 *   - camera breathes toward most-stressed vector
 */

import * as THREE from 'three';
import { COLORS, HOUSES, NULLSTELLE_ENERGY } from './design';
import { perlin3 } from './perlin';
import { N_HOUSES, N_LAYERS, N_NODES, idx, type SphereState, isImpressionFresh } from './physics';

const LAYER_RADII = [4.6, 5.0, 5.4] as const;
const LAYER_COLORS_BASE = [COLORS.amber, COLORS.lime, '#FFFFFF'] as const;
const LAYER_OPACITIES = [0.22, 0.16, 0.10] as const;
const LAYER_SUBDIV = [4, 3, 2] as const;

export type SceneRefs = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer | null;

  // 3 concentric sphere meshes (deformable layer-0 only; 1/2 are static wireframes)
  layerSpheres: [THREE.Mesh, THREE.Mesh, THREE.Mesh];
  layerBaseGeoms: [THREE.IcosahedronGeometry, THREE.IcosahedronGeometry, THREE.IcosahedronGeometry];

  // 24 vector beams + tips + ghost dashes (layer 0 only)
  vectorLines: THREE.Line[];   // length 24
  vectorTips: THREE.Mesh[];    // length 24
  ghostLines: THREE.Line[];    // length 8 (layer 0 only)

  core: THREE.Mesh;
  coreHalo: THREE.Mesh;

  // trine indicator — three small phasor arrows above scene origin in screen space
  trinePhasors: THREE.Group;
  trineLines: [THREE.Line, THREE.Line, THREE.Line];

  autoRotateY: number;
  dragRotX: number;
  dragRotY: number;
  cameraTarget: THREE.Vector3;
};

function lerpColor(a: string, b: string, t: number): THREE.Color {
  return new THREE.Color(a).clone().lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));
}

export function createScene(width: number, height: number): SceneRefs {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');
  scene.fog = new THREE.FogExp2('#000000', 0.045);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 18);

  // ── 3 concentric spheres ─────────────────────────────────
  const layerSpheres = [] as unknown as SceneRefs['layerSpheres'];
  const layerBaseGeoms = [] as unknown as SceneRefs['layerBaseGeoms'];
  for (let l = 0; l < N_LAYERS; l++) {
    const geom = new THREE.IcosahedronGeometry(LAYER_RADII[l], LAYER_SUBDIV[l]);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(LAYER_COLORS_BASE[l]),
      wireframe: true,
      transparent: true,
      opacity: LAYER_OPACITIES[l],
    });
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);
    (layerSpheres as THREE.Mesh[]).push(mesh);
    (layerBaseGeoms as THREE.IcosahedronGeometry[]).push(geom.clone());
  }

  // inner solid for depth (very dark)
  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(LAYER_RADII[0] * 0.992, 2),
    new THREE.MeshBasicMaterial({ color: 0x05070a, transparent: true, opacity: 0.42, side: THREE.BackSide }),
  );
  scene.add(inner);

  // ── 24 vector beams + tips + 8 ghost lines ──────────────
  const vectorLines: THREE.Line[] = [];
  const vectorTips: THREE.Mesh[] = [];
  const ghostLines: THREE.Line[] = [];

  for (let l = 0; l < N_LAYERS; l++) {
    for (let h = 0; h < N_HOUSES; h++) {
      const v = HOUSES[h].vector;
      const r = LAYER_RADII[l] / 5; // scale endpoints to layer radius
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(v[0] * r, v[1] * r, v[2] * r)];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(LAYER_COLORS_BASE[l]),
        transparent: true,
        opacity: l === 0 ? 0.9 : l === 1 ? 0.55 : 0.25,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      scene.add(line);
      vectorLines.push(line);

      const tipR = l === 0 ? 0.18 : l === 1 ? 0.13 : 0.09;
      const tipGeom = new THREE.SphereGeometry(tipR, 16, 12);
      const tipMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(LAYER_COLORS_BASE[l]),
        transparent: true,
        opacity: 0.95,
      });
      const tip = new THREE.Mesh(tipGeom, tipMat);
      tip.position.set(v[0] * r, v[1] * r, v[2] * r);
      scene.add(tip);
      vectorTips.push(tip);
    }
  }

  // ghost lines — 8 (layer 0 only)
  for (let h = 0; h < N_HOUSES; h++) {
    const v = HOUSES[h].vector;
    const gGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(v[0] * 0.92, v[1] * 0.92, v[2] * 0.92),
    ]);
    const gMat = new THREE.LineDashedMaterial({
      color: new THREE.Color(COLORS.limeSoft),
      dashSize: 0.3,
      gapSize: 0.25,
      transparent: true,
      opacity: 0.30,
    });
    const gl = new THREE.Line(gGeom, gMat);
    gl.computeLineDistances();
    scene.add(gl);
    ghostLines.push(gl);
  }

  // ── core ─────────────────────────────────────────────────
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 18),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.amber), transparent: true, opacity: 0.85 }),
  );
  scene.add(core);

  const coreHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 24, 18),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.amberSoft), transparent: true, opacity: 0.12 }),
  );
  scene.add(coreHalo);

  // ── trine indicator (three phasor arrows in scene-space, near camera) ──
  const trinePhasors = new THREE.Group();
  const trineLines: THREE.Line[] = [];
  for (let l = 0; l < 3; l++) {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.6, 0),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(LAYER_COLORS_BASE[l]),
      transparent: true,
      opacity: 0.7,
      linewidth: 2,
    });
    const line = new THREE.Line(geom, mat);
    trinePhasors.add(line);
    trineLines.push(line);
  }
  trinePhasors.position.set(0, 5.8, 0);
  trinePhasors.scale.set(0.7, 0.7, 0.7);
  scene.add(trinePhasors);

  return {
    scene, camera, renderer: null,
    layerSpheres, layerBaseGeoms,
    vectorLines, vectorTips, ghostLines,
    core, coreHalo,
    trinePhasors,
    trineLines: trineLines as SceneRefs['trineLines'],
    autoRotateY: 0,
    dragRotX: 0.32, dragRotY: 0.55,
    cameraTarget: new THREE.Vector3(0, 0, 0),
  };
}

// ─────────────────────────────────────────────────────────────
// Per-frame update
// ─────────────────────────────────────────────────────────────
export function updateScene(refs: SceneRefs, s: SphereState, dt: number): void {
  const { layerSpheres, layerBaseGeoms, vectorLines, vectorTips, ghostLines, core, coreHalo, camera, scene, trinePhasors, trineLines } = refs;

  const isHot = s.state === 'hot';
  const isWarm = s.state === 'warm' || s.state === 'singing' || s.state === 'nullstelle';
  const isSinging = s.state === 'singing' || s.state === 'nullstelle';
  const isNull = s.state === 'nullstelle';

  // ── Layer 0 sphere deformation ──
  {
    const baseGeom = layerBaseGeoms[0];
    const liveGeom = layerSpheres[0].geometry as THREE.IcosahedronGeometry;
    const basePos = baseGeom.attributes.position;
    const livePos = liveGeom.attributes.position as THREE.BufferAttribute;
    const noiseAmp = isNull ? 0 : isHot ? 0.28 + Math.min(0.3, (s.energy - NULLSTELLE_ENERGY) * 0.015) : isWarm ? 0.015 : 0.10;
    const waveAmp = isWarm ? 0.18 : 0.03;
    const jitter = isHot ? 0.12 : 0;

    for (let i = 0; i < basePos.count; i++) {
      const bx = basePos.getX(i), by = basePos.getY(i), bz = basePos.getZ(i);
      const n = perlin3(bx * 0.4 + s.t * 0.2, by * 0.4, bz * 0.4 + s.t * 0.2) * noiseAmp;
      const theta = Math.atan2(by, bx);
      const w = Math.sin(theta * 3 + s.t * 2) * Math.cos(bz * 0.5 + s.t) * waveAmp;
      const j = jitter * (Math.random() - 0.5);
      const len = Math.hypot(bx, by, bz) || 1;
      const disp = n + w + j;
      livePos.setXYZ(i, bx + bx / len * disp, by + by / len * disp, bz + bz / len * disp);
    }
    livePos.needsUpdate = true;

    const coherenceT = Math.max(0, Math.min(1, s.sing_index));
    const m0 = layerSpheres[0].material as THREE.MeshBasicMaterial;
    m0.color.copy(lerpColor(COLORS.lime, COLORS.amber, coherenceT));
    m0.opacity = isNull ? 0.55 : 0.18 + coherenceT * 0.22;
  }

  // Layer 1 — pulse with sing_index, rotate slowly
  {
    layerSpheres[1].rotation.y += dt * 0.04;
    const m1 = layerSpheres[1].material as THREE.MeshBasicMaterial;
    m1.opacity = 0.10 + 0.18 * Math.max(s.R_layer[1], 0) + (isSinging ? 0.12 : 0);
  }
  // Layer 2 — visible only when sing_index high (faszien only become "tangible" in coherence)
  {
    layerSpheres[2].rotation.y -= dt * 0.025;
    layerSpheres[2].rotation.x += dt * 0.018;
    const m2 = layerSpheres[2].material as THREE.MeshBasicMaterial;
    const visibility = Math.max(0, s.sing_index - 0.4);  // ramp from 0.4 → 1
    m2.opacity = 0.04 + visibility * 0.28;
  }

  // ── 24 vector beams + tips ──
  for (let l = 0; l < N_LAYERS; l++) {
    const layerR = LAYER_RADII[l] / 5;
    for (let h = 0; h < N_HOUSES; h++) {
      const k = idx(h, l);
      const node = h * N_LAYERS + l; // visual index — matches the order we pushed
      // Actually we pushed [layer outer loop, house inner] so visualIdx = l*8 + h
      const visualIdx = l * N_HOUSES + h;
      const line = vectorLines[visualIdx];
      const tip = vectorTips[visualIdx];

      const v = HOUSES[h].vector;
      const scale = Math.sin(s.q[k]) * (s.A[k] / 1.77) * layerR;
      const ex = v[0] * scale, ey = v[1] * scale, ez = v[2] * scale;
      const lg = line.geometry as THREE.BufferGeometry;
      const lp = lg.attributes.position as THREE.BufferAttribute;
      lp.setXYZ(0, 0, 0, 0);
      lp.setXYZ(1, ex, ey, ez);
      lp.needsUpdate = true;
      tip.position.set(ex, ey, ez);

      const tipScale = (l === 0 ? 0.6 : l === 1 ? 0.5 : 0.4) + 0.7 * Math.abs(scale);
      tip.scale.setScalar(tipScale);

      // Layer 1 highlight — recent LLM impression makes the tip pulse
      if (l === 1) {
        const imp = s.impressions[h];
        const fresh = isImpressionFresh(imp, s.t);
        const tipMat = tip.material as THREE.MeshBasicMaterial;
        if (fresh && imp) {
          const age = s.t - imp.ts;
          const pulse = Math.exp(-age / 2) * (0.5 + 0.5 * Math.sin(s.t * 6));
          tipMat.color.copy(lerpColor(COLORS.lime, COLORS.amber, imp.score));
          tipMat.opacity = 0.95;
          tip.scale.setScalar(tipScale * (1 + pulse * 0.8));
        } else {
          tipMat.color.copy(new THREE.Color(LAYER_COLORS_BASE[1]));
          tipMat.opacity = 0.6;
        }
        const lineMat = line.material as THREE.LineBasicMaterial;
        lineMat.opacity = (fresh ? 0.85 : 0.4);
      }

      if (l === 0) {
        const mat = line.material as THREE.LineBasicMaterial;
        mat.color.copy(lerpColor(COLORS.lime, COLORS.amber, s.R_layer[0]));
        (tip.material as THREE.MeshBasicMaterial).color.copy(mat.color);
      }
    }
  }

  // ── ghost lines (layer 0) ──
  for (let h = 0; h < N_HOUSES; h++) {
    const g = ghostLines[h];
    const gp = (g.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
    const gv = s.ghostVectors[idx(h, 0)];
    gp.setXYZ(0, 0, 0, 0);
    gp.setXYZ(1, gv[0] * 5, gv[1] * 5, gv[2] * 5);
    gp.needsUpdate = true;
    g.computeLineDistances();
    (g.material as THREE.LineDashedMaterial).opacity = 0.18 + (isWarm ? 0.18 : 0);
  }

  // ── core ──
  const pulse = 1 + 0.18 * Math.sin(s.t * 3);
  core.scale.setScalar(isNull ? pulse * 1.8 : isSinging ? pulse * 1.4 : pulse);
  coreHalo.scale.setScalar(isNull ? 2.4 * pulse : 1 + 0.25 * Math.sin(s.t * 2));
  const coreMat = core.material as THREE.MeshBasicMaterial;
  coreMat.color.copy(lerpColor(COLORS.lime, COLORS.amber, s.sing_index));
  coreMat.opacity = isNull ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(s.t * 2));
  (coreHalo.material as THREE.MeshBasicMaterial).opacity = isNull ? 0.4 : 0.08 + 0.12 * s.sing_index;

  // ── trine phasor indicator: three small arrows aligned at 2π/3 when locked ──
  for (let l = 0; l < 3; l++) {
    const arg = s.argZ_layer[l];
    const line = trineLines[l];
    line.rotation.z = -arg; // rotate around Z so 0 → up
    const mat = line.material as THREE.LineBasicMaterial;
    mat.opacity = 0.4 + 0.5 * s.R_layer[l];
  }
  trinePhasors.rotation.x = 0.0;
  // Hide phasor cluster when sing_index is very low (cleaner default view)
  trinePhasors.visible = s.sing_index > 0.15;

  // ── rotation ──
  refs.autoRotateY += dt * 0.08;
  scene.rotation.y = refs.dragRotY + refs.autoRotateY;
  scene.rotation.x = refs.dragRotX;

  // ── camera breathing ──
  let maxDev = 0;
  const target = new THREE.Vector3(0, 0, 0);
  for (let h = 0; h < N_HOUSES; h++) {
    const k = idx(h, 0);
    const val = Math.abs(s.A[k] * Math.sin(s.q[k]));
    if (val > maxDev) {
      maxDev = val;
      const v = HOUSES[h].vector;
      target.set(v[0], v[1], v[2]).normalize();
    }
  }
  refs.cameraTarget.lerp(target.multiplyScalar(0.6), 0.02);
  const breath = Math.sin(s.t * 1.2) * 0.15;
  const zBase = 18 - (isSinging ? 1.5 : 0);
  camera.position.set(refs.cameraTarget.x * 1.2, refs.cameraTarget.y * 1.2, zBase + breath);
  camera.lookAt(0, 0, 0);
}
