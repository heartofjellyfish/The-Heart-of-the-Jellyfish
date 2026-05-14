'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, useGLTF, useAnimations } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useControls, folder } from 'leva';
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';

const CHRYSAORA_URL = '/models/chrysaora/model.glb';
useGLTF.preload(CHRYSAORA_URL);

// ---------- depth-aware fog + background ----------

const COL_SURFACE = new THREE.Color('#3d8aaa');
const COL_SHALLOW = new THREE.Color('#1d6388');
const COL_MID     = new THREE.Color('#0c3a55');
const COL_DEEP    = new THREE.Color('#04162a');
const COL_ABYSS   = new THREE.Color('#01060f');

function pickDepthColor(d: number, out: THREE.Color) {
  if (d < 0.18) out.lerpColors(COL_SURFACE, COL_SHALLOW, d / 0.18);
  else if (d < 0.42) out.lerpColors(COL_SHALLOW, COL_MID, (d - 0.18) / 0.24);
  else if (d < 0.72) out.lerpColors(COL_MID, COL_DEEP, (d - 0.42) / 0.30);
  else out.lerpColors(COL_DEEP, COL_ABYSS, (d - 0.72) / 0.28);
  return out;
}

function DepthEnvironment({ depthRef }: { depthRef: MutableRefObject<number> }) {
  const { scene } = useThree();
  const underwaterCol = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const d = depthRef.current;
    pickDepthColor(d, underwaterCol);                          // cool depth palette
    const underwater = THREE.MathUtils.smoothstep(d, 0.05, 0.18);

    if (!scene.fog) scene.fog = new THREE.FogExp2(0x000000, 0);
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(underwaterCol);
    // density: 0 above water (so water reflects sky cleanly, no horizon band),
    //          ramps up once we cross the surface
    fog.density = underwater * (0.018 + d * 0.045);

    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color();
    // background only matters underwater; above water the Sky dome covers everything
    (scene.background as THREE.Color).copy(underwaterCol);
  });
  return null;
}

// ---------- camera descent ----------

const SURFACE_Y = 14;          // camera position above water at scroll 0
const WATER_LEVEL = 0;
const ABYSS_Y = -55;
const JELLY_Y = -22;

// derive a sun direction (azimuth+elevation in degrees) into a normalized vector
function sunDirFrom(azimuthDeg: number, elevationDeg: number): THREE.Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    -Math.cos(el) * Math.cos(az)   // -z so the sun is in front of the default camera
  ).normalize();
}

function CameraRig({ depthRef }: { depthRef: MutableRefObject<number> }) {
  const target = useRef(new THREE.Vector3(0, JELLY_Y, 0));
  useFrame(({ camera, clock }) => {
    const d = depthRef.current;
    // piecewise: 0→above water(+14); 0.55→jellyfish(-22); 1→abyss(-55)
    let targetY: number;
    if (d < 0.55) targetY = THREE.MathUtils.lerp(SURFACE_Y, JELLY_Y, d / 0.55);
    else targetY = THREE.MathUtils.lerp(JELLY_Y, ABYSS_Y, (d - 0.55) / 0.45);
    camera.position.y += (targetY - camera.position.y) * 0.08;

    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.15) * 0.35;
    let zBase: number;
    if (d < 0.55) zBase = THREE.MathUtils.lerp(9.0, 4.0, d / 0.55);
    else zBase = THREE.MathUtils.lerp(4.0, 8.5, (d - 0.55) / 0.45);
    camera.position.z = zBase + Math.cos(t * 0.12) * 0.2;

    // at d=0 look slightly down to the horizon, then toward jellyfish, then downward in abyss
    let lookY: number;
    if (d < 0.05) lookY = THREE.MathUtils.lerp(SURFACE_Y - 4, WATER_LEVEL - 1, d / 0.05);
    else lookY = THREE.MathUtils.lerp(
      WATER_LEVEL - 1,
      JELLY_Y + 0.4,
      THREE.MathUtils.smoothstep(d, 0.05, 0.55)
    );
    if (d > 0.55) lookY = THREE.MathUtils.lerp(JELLY_Y + 0.4, camera.position.y - 6, (d - 0.55) / 0.45);
    target.current.set(0, lookY, 0);
    camera.lookAt(target.current);
  });
  return null;
}

// ---------- Tyndall light shafts (volumetric scatter through water) ----------
//
// Billboarded vertical planes with a soft gaussian core, 3D-noise volumetric
// modulation, and additive blending. Each shaft yaws to face the camera every
// frame so its silhouette never reads as a flat rectangle from the side.
// Visible only between roughly 1 m and 8 m below the surface — past that the
// real-world equivalent is gone too.

const shaftVS = /* glsl */`
  precision mediump float;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const shaftFS = /* glsl */`
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  uniform vec3  uColor;

  float hash3(vec3 p){
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }
  float noise3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i),                 hash3(i + vec3(1.0,0.0,0.0)), u.x),
          mix(hash3(i + vec3(0.0,1.0,0.0)), hash3(i + vec3(1.0,1.0,0.0)), u.x), u.y),
      mix(mix(hash3(i + vec3(0.0,0.0,1.0)), hash3(i + vec3(1.0,0.0,1.0)), u.x),
          mix(hash3(i + vec3(0.0,1.0,1.0)), hash3(i + vec3(1.0,1.0,1.0)), u.x), u.y),
      u.z
    );
  }
  float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise3(p); p *= 2.07; a *= 0.5; }
    return v;
  }

  void main(){
    // vUv.x: 0 (left) → 1 (right);  vUv.y: 0 (bottom of plane) → 1 (top, where light enters)
    float x = vUv.x * 2.0 - 1.0;
    float y = vUv.y;

    // soft gaussian along the shaft cross-section — no hard edges
    float core = exp(-x * x * 3.8);

    // bright at top, fade exponentially down (Beer-Lambert-ish)
    float vert = pow(y, 1.4) * (1.0 - smoothstep(0.94, 1.0, y));

    // volumetric noise: streams that drift down with time, broken across width
    vec3 np = vec3(x * 0.55 + uSeed * 7.13, y * 3.2 - uTime * 0.13, uSeed * 31.0);
    float n = fbm(np);
    // squash to make sharper "filaments"
    n = pow(n, 1.6);

    float a = core * vert * (0.35 + 0.65 * n) * uOpacity;
    // premultiplied additive — output color must be color * alpha
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function LightShafts({
  depthRef,
  sunDir,
}: {
  depthRef: MutableRefObject<number>;
  sunDir: THREE.Vector3;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const colorRef = useRef(new THREE.Color('#ffd09a'));

  // sun direction tells us roughly where light hits the surface; bias shafts toward it
  const shafts = useMemo(() => {
    return new Array(7).fill(0).map((_, i) => {
      const r = 5 + Math.random() * 3.5;
      const angle = ((i - 3) / 7) * 0.9 + (Math.random() - 0.5) * 0.2; // -0.45..0.45 rad
      // place shafts along an arc in the direction of the sun, with some scatter
      const sunFlatLen = Math.hypot(sunDir.x, sunDir.z) || 1;
      const sx = sunDir.x / sunFlatLen;
      const sz = sunDir.z / sunFlatLen;
      // perpendicular for spread
      const px = -sz;
      const pz = sx;
      const spread = (i - 3) * 1.6 + (Math.random() - 0.5) * 1.4;
      return {
        x: sx * r + px * spread,
        z: sz * r + pz * spread,
        width: 3.4 + Math.random() * 1.4,
        height: 18,
        seed: Math.random(),
        jitter: Math.random() * 6.28,
      };
    });
  }, [sunDir.x, sunDir.z]);

  useFrame(({ clock, camera }) => {
    if (!groupRef.current) return;
    const d = depthRef.current;
    // smooth ramp up just after we cross the surface, fade out well before the deep
    const mask =
      THREE.MathUtils.smoothstep(d, 0.06, 0.16) *
      (1 - THREE.MathUtils.smoothstep(d, 0.28, 0.45));
    groupRef.current.visible = mask > 0.001;
    if (mask <= 0.001) return;

    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((m, i) => {
      const sh = shafts[i];
      const mesh = m as THREE.Mesh;
      // billboard around world-Y so the plane always faces the camera
      const dx = camera.position.x - mesh.position.x;
      const dz = camera.position.z - mesh.position.z;
      mesh.rotation.y = Math.atan2(dx, dz);
      // update shader
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = t + sh.jitter;
      mat.uniforms.uOpacity.value = 0.55 * mask;
      mat.uniforms.uColor.value.copy(colorRef.current);
    });
  });

  return (
    <group ref={groupRef}>
      {shafts.map((sh, i) => (
        <mesh
          key={i}
          // plane vertex y is [-h/2, h/2]; we want the top at water (y=0) and
          // the bottom at y = -h, so place mesh at y = -h/2 inside a y=0 group
          position={[sh.x, -sh.height / 2, sh.z]}
        >
          <planeGeometry args={[sh.width, sh.height, 1, 1]} />
          <shaderMaterial
            vertexShader={shaftVS}
            fragmentShader={shaftFS}
            uniforms={{
              uTime:    { value: 0 },
              uSeed:    { value: sh.seed },
              uOpacity: { value: 0 },
              uColor:   { value: new THREE.Color('#ffd09a') },
            }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------- marine snow / plankton particles ----------

function MarineSnow({ count = 1800, depthRef }: { count?: number; depthRef?: MutableRefObject<number> }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const matRef = useRef<THREE.PointsMaterial>(null!);

  const { positions, baseY } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const baseY = new Float32Array(count);
    const halfRangeY = 50;
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * halfRangeY * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 2;
      baseY[i] = positions[i * 3 + 1];
    }
    return { positions, baseY };
  }, [count]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    // hide while above water
    const d = depthRef?.current ?? 1;
    const visible = d > 0.05;
    if (matRef.current) matRef.current.opacity = visible ? 0.6 * THREE.MathUtils.smoothstep(d, 0.05, 0.18) : 0;
    if (!visible) return;
    const arr = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const t = clock.getElapsedTime();
    const drift = (t * 0.18) % 100;
    for (let i = 0; i < count; i++) {
      const yIdx = i * 3 + 1;
      let y = baseY[i] - drift;
      y = ((y + 50) % 100) - 50;
      arr[yIdx] = y;
      arr[i * 3] += Math.sin(t * 0.4 + i) * 0.0008;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.055}
        color="#dff1f9"
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------- bioluminescent specks (only in deep) ----------

function Bioluminescence({ depthRef, count = 220 }: { depthRef: MutableRefObject<number>; count?: number }) {
  const ref = useRef<THREE.Points>(null!);
  const matRef = useRef<THREE.PointsMaterial>(null!);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = -10 + (Math.random() - 0.5) * 60;  // deeper bias
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;
    }
    return pos;
  }, [count]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const d = depthRef.current;
    const mask = THREE.MathUtils.smoothstep(d, 0.45, 0.85);
    const t = clock.getElapsedTime();
    matRef.current.opacity = (0.6 + 0.4 * Math.sin(t * 1.3)) * mask;
    matRef.current.size = 0.10 + 0.04 * Math.sin(t * 2.0);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.10}
        color="#8de9ff"
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------- jellyfish ----------

const tentacleVS = /* glsl */`
  precision mediump float;
  uniform float uTime;
  uniform float uSeed;
  varying float vAlong;
  varying vec3  vPos;
  void main() {
    vAlong = clamp(-position.y / 6.5, 0.0, 1.0);
    vec3 p = position;
    // sway grows with distance from top
    float s = vAlong;
    float w1 = sin(uTime * 1.1 + uSeed * 6.28 + s * 3.5) * 0.18 * s;
    float w2 = cos(uTime * 0.7 + uSeed * 3.14 + s * 2.0) * 0.14 * s;
    p.x += w1;
    p.z += w2;
    vPos = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const tentacleFS = /* glsl */`
  precision mediump float;
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uTime;
  uniform float uSeed;
  varying float vAlong;
  varying vec3 vPos;
  void main() {
    // fade alpha along the length (thicker top, ghostly bottom)
    float fade = mix(0.95, 0.15, vAlong);
    // pulse traveling down
    float pulse = 0.5 + 0.5 * sin(uTime * 1.5 - vAlong * 8.0 + uSeed * 6.28);
    pulse = pow(pulse, 3.0);
    vec3 col = uColor + uEmissive * (0.35 + 0.65 * pulse);
    gl_FragColor = vec4(col, fade);
  }
`;

function Jellyfish() {
  const groupRef    = useRef<THREE.Group>(null!);
  const bellRef     = useRef<THREE.Mesh>(null!);
  const innerRef    = useRef<THREE.Mesh>(null!);
  const haloRef     = useRef<THREE.Mesh>(null!);
  const coreLightRef = useRef<THREE.PointLight>(null!);
  const tentaclesRef = useRef<THREE.Group>(null!);
  const oralRef     = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const phase = Math.sin(t * 0.85);
    const beat  = 0.5 + 0.5 * Math.sin(t * 0.85);
    const beatHi = Math.pow(beat, 2.0);

    if (groupRef.current) {
      groupRef.current.position.y = JELLY_Y + Math.sin(t * 0.32) * 0.35;
      groupRef.current.rotation.y = Math.sin(t * 0.18) * 0.15;
    }
    if (bellRef.current) {
      const sy = 1 + 0.16 * phase;
      const sxz = 1 + 0.10 * -phase;
      bellRef.current.scale.set(sxz, sy, sxz);
    }
    if (innerRef.current) {
      const s = 0.42 + 0.13 * beatHi;
      innerRef.current.scale.setScalar(s);
      const mat = innerRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 + 0.45 * beatHi;
    }
    if (haloRef.current) {
      const s = 1.5 + 0.30 * beat;
      haloRef.current.scale.setScalar(s);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.10 + 0.22 * beatHi;
    }
    if (coreLightRef.current) {
      coreLightRef.current.intensity = 12 + 12 * beatHi;
    }
    // update tentacle shader uniforms
    if (tentaclesRef.current) {
      tentaclesRef.current.children.forEach((c) => {
        const mat = (c as THREE.Mesh).material as THREE.ShaderMaterial;
        if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = t;
      });
    }
    if (oralRef.current) {
      oralRef.current.children.forEach((c, i) => {
        c.rotation.z = Math.sin(t * 0.6 + i * 0.9) * 0.18;
        c.rotation.x = Math.cos(t * 0.5 + i * 1.1) * 0.14;
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, JELLY_Y, 0]} scale={1.35}>
      {/* outer halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[1.4, 32, 20]} />
        <meshBasicMaterial
          color="#7ce7ff"
          transparent
          opacity={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* bell — slightly stretched dome */}
      <mesh ref={bellRef} scale={[1, 1.05, 1]}>
        <sphereGeometry args={[1.15, 80, 56, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshPhysicalMaterial
          color="#c8efff"
          emissive="#3ab5e0"
          emissiveIntensity={0.75}
          transmission={0.92}
          thickness={0.8}
          roughness={0.12}
          ior={1.33}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          metalness={0}
          attenuationColor={new THREE.Color('#9be8ff')}
          attenuationDistance={1.2}
        />
      </mesh>

      {/* bright rim — thin torus at bell base for bioluminescent edge */}
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.025, 8, 96]} />
        <meshBasicMaterial color="#c9f5ff" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* inner glowing core — "the heart" */}
      <mesh ref={innerRef} position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.35, 32, 20]} />
        <meshBasicMaterial color="#ecfaff" transparent opacity={0.9} depthWrite={false} />
      </mesh>

      {/* point light inside the heart */}
      <pointLight ref={coreLightRef} position={[0, 0.32, 0]} intensity={14} color="#a8eaff" distance={10} decay={1.4} />

      {/* oral arms — frilly ribbons between bell and tentacles */}
      <group ref={oralRef} position={[0, -0.05, 0]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <OralArm key={i} index={i} total={6} />
        ))}
      </group>

      {/* long thin tentacles */}
      <group ref={tentaclesRef}>
        {Array.from({ length: 14 }).map((_, i) => (
          <Tentacle key={i} index={i} total={14} />
        ))}
      </group>
    </group>
  );
}

function Tentacle({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * Math.PI * 2 + (index % 2) * 0.1;
  const ringR = 0.78 + (index % 3) * 0.04;
  const x0 = Math.cos(angle) * ringR;
  const z0 = Math.sin(angle) * ringR;
  const seed = useMemo(() => Math.random(), []);

  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const len = 5.0 + (index % 5) * 0.7;
    const segs = 26;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const taper = 1 - t * 0.65;
      pts.push(new THREE.Vector3(x0 * taper, -t * len, z0 * taper));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    // radial thickness tapers along length via radialSegments material; use thin tube
    return new THREE.TubeGeometry(curve, 110, 0.015, 6, false);
  }, [index, x0, z0]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uColor: { value: new THREE.Color('#8bdcff') },
      uEmissive: { value: new THREE.Color('#46baff') },
    }),
    [seed]
  );

  return (
    <mesh geometry={geom}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={tentacleVS}
        fragmentShader={tentacleFS}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function OralArm({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * Math.PI * 2 + 0.2;
  const r = 0.45;
  const x0 = Math.cos(angle) * r;
  const z0 = Math.sin(angle) * r;
  const seed = useMemo(() => Math.random(), []);

  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const len = 1.8;
    const segs = 18;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const taper = 1 - t * 0.5;
      const ruffle = Math.sin(t * 9.0 + index) * 0.08 * t;
      pts.push(
        new THREE.Vector3(
          x0 * taper + ruffle,
          -t * len,
          z0 * taper + Math.cos(t * 8.0 + index) * 0.08 * t
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 70, 0.04, 6, false);
  }, [index, x0, z0]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uColor: { value: new THREE.Color('#bef0ff') },
      uEmissive: { value: new THREE.Color('#58c6f0') },
    }),
    [seed]
  );

  return (
    <mesh geometry={geom}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={tentacleVS}
        fragmentShader={tentacleFS}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ---------- chrysaora (GLTF hero model) ----------

function ChrysaoraHero() {
  const group = useRef<THREE.Group>(null!);
  const innerRef = useRef<THREE.Group>(null!);
  const coreLight = useRef<THREE.PointLight>(null!);
  const { scene, animations } = useGLTF(CHRYSAORA_URL);
  const { actions, names, mixer } = useAnimations(animations, group);

  // Upgrade bell material to MeshPhysicalMaterial (glossy blood-red look)
  useEffect(() => {
    if (!scene) return;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material | THREE.Material[];
      const mats = Array.isArray(mat) ? mat : [mat];
      mats.forEach((m) => {
        const name = (m?.name || '').toLowerCase();
        if (name.includes('outside') && !(m instanceof THREE.MeshPhysicalMaterial)) {
          const old = m as THREE.MeshStandardMaterial;
          const phys = new THREE.MeshPhysicalMaterial({
            map: old.map ?? null,
            normalMap: old.normalMap ?? null,
            roughnessMap: old.roughnessMap ?? null,
          });
          phys.name = old.name;
          phys.color.set('#ffaf6b');
          phys.transmission = 0.85;
          phys.thickness = 0.6;
          phys.roughness = 0.12;
          phys.ior = 1.33;
          phys.attenuationColor.set('#ff5848');
          phys.attenuationDistance = 0.8;
          phys.clearcoat = 1.0;
          phys.clearcoatRoughness = 0.1;
          // self-emitted blood red so the bell survives heavy fog + low exposure
          phys.emissive.set('#9a1a14');
          phys.emissiveIntensity = 1.6;
          phys.transparent = true;
          phys.side = THREE.DoubleSide;
          phys.fog = false;  // opt the hero out of scene fog so red doesn't get blue-shifted
          mesh.material = phys;
        }
      });
    });
  }, [scene]);

  // Auto-play the single baked animation, slowed for dreamy pacing
  useEffect(() => {
    if (!actions || names.length === 0) return;
    const a = actions[names[0]];
    if (a) {
      a.reset();
      a.setEffectiveTimeScale(0.5);
      a.setEffectiveWeight(1.0);
      a.play();
    }
  }, [actions, names]);

  useFrame((_, dt) => {
    mixer?.update(dt);
  });

  // Ambient float + slow yaw, plus pulsing inner light synced to bell beat
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.position.y = JELLY_Y + Math.sin(t * 0.32) * 0.35;
    group.current.rotation.y = Math.sin(t * 0.18) * 0.15;
    if (coreLight.current) {
      const beat = 0.5 + 0.5 * Math.sin(t * 0.85);
      coreLight.current.intensity = 6 + 8 * Math.pow(beat, 2);
    }
  });

  return (
    <group ref={group} position={[0, JELLY_Y - 1.5, 0]} scale={0.025}>
      <group ref={innerRef}>
        <primitive object={scene} />
      </group>
      {/* "the heart" — warm pulse inside the bell */}
      <pointLight
        ref={coreLight}
        position={[0, 0.6, 0]}
        color="#ffd07a"
        intensity={6}
        distance={4}
        decay={1.4}
      />
    </group>
  );
}

// ---------- caustic-tinted top light disk (sun) ----------

function SunDisk({ depthRef }: { depthRef: MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(({ clock }) => {
    if (!ref.current || !matRef.current) return;
    const d = depthRef.current;
    const mask = Math.max(0, 1 - d / 0.25);
    matRef.current.opacity = 0.6 * mask;
    ref.current.visible = mask > 0.001;
    const t = clock.getElapsedTime();
    ref.current.position.x = Math.sin(t * 0.3) * 0.4;
    ref.current.position.z = Math.cos(t * 0.25) * 0.3;
  });

  return (
    <mesh ref={ref} position={[0, 12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[2.2, 48]} />
      <meshBasicMaterial
        ref={matRef}
        color="#fff5e0"
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ---------- real water surface (three.js Water shader) ----------

function WaterSurface({
  depthRef,
  sunDir,
  sunColor,
  waterColor,
  distortionScale,
}: {
  depthRef: MutableRefObject<number>;
  sunDir: THREE.Vector3;
  sunColor: string;
  waterColor: string;
  distortionScale: number;
}) {
  const water = useMemo(() => {
    const geom = new THREE.PlaneGeometry(10000, 10000);
    const loader = new THREE.TextureLoader();
    const normals = loader.load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      }
    );
    const w = new Water(geom, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: sunDir.clone(),
      sunColor: new THREE.Color(sunColor).getHex(),
      waterColor: new THREE.Color(waterColor).getHex(),
      distortionScale,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    w.position.y = WATER_LEVEL;
    (w.material as THREE.ShaderMaterial).side = THREE.DoubleSide;
    return w;
    // intentionally only create once; live updates handled via useEffect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live-update water uniforms when controls change
  useEffect(() => {
    const u = (water.material as THREE.ShaderMaterial).uniforms;
    u.sunDirection.value.copy(sunDir);
    u.sunColor.value.set(sunColor);
    u.waterColor.value.set(waterColor);
    u.distortionScale.value = distortionScale;
  }, [water, sunDir, sunColor, waterColor, distortionScale]);

  useFrame((_, dt) => {
    const mat = water.material as THREE.ShaderMaterial;
    if (mat?.uniforms?.time) mat.uniforms.time.value += dt * 0.6;
  });

  return <primitive object={water} />;
}

// ---------- sky (drei) ----------

function SkyDome({
  depthRef, sunDir, turbidity, rayleigh, mieCoefficient, mieG,
}: {
  depthRef: MutableRefObject<number>;
  sunDir: THREE.Vector3;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieG: number;
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (ref.current) {
      const d = depthRef.current;
      ref.current.visible = d < 0.18;
    }
  });
  return (
    <group ref={ref}>
      <Sky
        sunPosition={[sunDir.x, sunDir.y, sunDir.z]}
        turbidity={turbidity}
        rayleigh={rayleigh}
        mieCoefficient={mieCoefficient}
        mieDirectionalG={mieG}
        distance={4500}
      />
    </group>
  );
}

// ---------- inner scene (consumes leva controls) ----------

function SunsetScene({ depthRef }: { depthRef: MutableRefObject<number> }) {
  const { gl } = useThree();

  const params = useControls('Sunset', {
    'Sun position': folder({
      sunAzimuth:   { value: 21,  min: 0, max: 360, step: 1 },
      sunElevation: { value: 1.1, min: -2, max: 30, step: 0.1 },
    }),
    'Sky atmosphere': folder({
      turbidity:      { value: 20.0,  min: 0,   max: 20,    step: 0.1 },
      rayleigh:       { value: 2.35,  min: 0,   max: 6,     step: 0.05 },
      mieG:           { value: 0.84,  min: 0.5, max: 0.999, step: 0.001 },
      mieCoefficient: { value: 0.0,   min: 0,   max: 0.02,  step: 0.0005 },
    }),
    'Water': folder({
      sunColor:        { value: '#ff6800' },
      waterColor:      { value: '#001b52' },
      distortionScale: { value: 3.7, min: 0, max: 8, step: 0.1 },
    }),
    'Lights': folder({
      ambientColor:     { value: '#6a7a90' },
      ambientIntensity: { value: 0.25, min: 0, max: 1, step: 0.01 },
      dirColor:         { value: '#ffe4c0' },
      dirIntensity:     { value: 1.10, min: 0, max: 4, step: 0.05 },
    }),
    'Tone': folder({
      exposure: { value: 0.38, min: 0.05, max: 1.2, step: 0.01 },
    }),
  });

  const sunDir = useMemo(
    () => sunDirFrom(params.sunAzimuth, params.sunElevation),
    [params.sunAzimuth, params.sunElevation]
  );

  useEffect(() => {
    gl.toneMappingExposure = params.exposure;
  }, [gl, params.exposure]);

  return (
    <>
      <color attach="background" args={['#bcd9e6']} />
      <DepthEnvironment depthRef={depthRef} />
      <CameraRig depthRef={depthRef} />

      <SkyDome
        depthRef={depthRef}
        sunDir={sunDir}
        turbidity={params.turbidity}
        rayleigh={params.rayleigh}
        mieCoefficient={params.mieCoefficient}
        mieG={params.mieG}
      />

      <ambientLight intensity={params.ambientIntensity} color={params.ambientColor} />
      <directionalLight
        position={[sunDir.x * 50, sunDir.y * 50 + 6, sunDir.z * 50]}
        intensity={params.dirIntensity}
        color={params.dirColor}
      />
      <pointLight position={[0, JELLY_Y + 0.2, 0]} intensity={14} color="#9aeaff" distance={20} decay={1.6} />

      <WaterSurface
        depthRef={depthRef}
        sunDir={sunDir}
        sunColor={params.sunColor}
        waterColor={params.waterColor}
        distortionScale={params.distortionScale}
      />
      <LightShafts depthRef={depthRef} sunDir={sunDir} />
      <MarineSnow depthRef={depthRef} />
      <Bioluminescence depthRef={depthRef} />
      <Suspense fallback={null}>
        <ChrysaoraHero />
      </Suspense>

      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom
          mipmapBlur
          intensity={0.9}
          luminanceThreshold={0.45}
          luminanceSmoothing={0.35}
          radius={0.85}
        />
      </EffectComposer>
    </>
  );
}

// ---------- entry ----------

export function OceanScene({
  depthRef,
}: {
  depthRef: MutableRefObject<number>;
}) {
  return (
    <>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.38,
        }}
        camera={{ position: [0, SURFACE_Y, 9], fov: 55, near: 0.1, far: 5000 }}
      >
        <SunsetScene depthRef={depthRef} />
      </Canvas>
    </>
  );
}
