'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, useAnimations } from '@react-three/drei';
import { Leva, useControls, folder } from 'leva';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const MODEL_URL = '/models/chrysaora/model.glb';

useGLTF.preload(MODEL_URL);

function Chrysaora() {
  const group = useRef<THREE.Group>(null!);
  const innerRef = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions, names, mixer } = useAnimations(animations, group);

  // The model's rest-pose bbox is ~177 units but animated extent is much smaller.
  // Empirical base scale; user can fine-tune via leva.
  const BASE_SCALE = 1.0;

  const animNames = useMemo(() => names.length ? names : ['(none)'], [names]);

  const ctrl = useControls('Chrysaora', {
    Animation: folder({
      animation: { options: animNames, value: animNames[0] },
      timeScale: { value: 0.5, min: 0.05, max: 2.0, step: 0.05 },
      weight:    { value: 1.0, min: 0.0, max: 1.0, step: 0.05 },
    }),
    Transform: folder({
      scale:    { value: 0.25, min: 0.01, max: 2.0, step: 0.01 },
      offsetY:  { value: 0, min: -20, max: 20, step: 0.1 },
      rotateY:  { value: 0, min: -180, max: 180, step: 1 },
    }),
    'Bell material': folder({
      overrideBell:        { value: false },
      bellColor:           { value: '#ffaf6b' },
      transmission:        { value: 0.85, min: 0, max: 1, step: 0.01 },
      thickness:           { value: 0.6, min: 0, max: 3, step: 0.05 },
      roughness:           { value: 0.12, min: 0, max: 1, step: 0.01 },
      ior:                 { value: 1.33, min: 1, max: 2.5, step: 0.01 },
      attenuationColor:    { value: '#ff9560' },
      attenuationDistance: { value: 1.2, min: 0.1, max: 5, step: 0.05 },
      clearcoat:           { value: 1.0, min: 0, max: 1, step: 0.05 },
      emissive:            { value: '#3a1500' },
      emissiveIntensity:   { value: 0.4, min: 0, max: 3, step: 0.05 },
    }),
    'Inner light': folder({
      lightOn:        { value: true },
      lightColor:     { value: '#ffd07a' },
      lightIntensity: { value: 8, min: 0, max: 40, step: 0.5 },
      lightDistance:  { value: 8, min: 1, max: 30, step: 0.5 },
    }),
  });

  // Switch animation
  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach(a => a?.stop());
    const a = actions[ctrl.animation];
    if (a) {
      a.reset();
      a.setEffectiveTimeScale(ctrl.timeScale);
      a.setEffectiveWeight(ctrl.weight);
      a.play();
    }
  }, [actions, ctrl.animation]);

  useEffect(() => {
    const a = actions?.[ctrl.animation];
    if (a) {
      a.setEffectiveTimeScale(ctrl.timeScale);
      a.setEffectiveWeight(ctrl.weight);
    }
  }, [actions, ctrl.animation, ctrl.timeScale, ctrl.weight]);

  // Override bell material with MeshPhysicalMaterial
  useEffect(() => {
    if (!scene) return;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material | THREE.Material[];
      const mats = Array.isArray(mat) ? mat : [mat];
      mats.forEach((m) => {
        const name = (m?.name || '').toLowerCase();
        // NestaEric Pacific Sea Nettle materials: jellyfish_outside (bell), jellyfish_tentacles, jellyfish_inside_1, jellyfish_inside_2
        const isBell = name.includes('outside') || name.includes('bell') || name.includes('dome');
        // We tag the original so we can restore if needed
        if (ctrl.overrideBell && isBell) {
          // upgrade to MeshPhysicalMaterial preserving maps
          if (!(m instanceof THREE.MeshPhysicalMaterial)) {
            const old = m as THREE.MeshStandardMaterial;
            const phys = new THREE.MeshPhysicalMaterial({
              map: old.map ?? null,
              normalMap: old.normalMap ?? null,
              roughnessMap: old.roughnessMap ?? null,
            });
            phys.name = old.name;
            mesh.material = phys;
          }
          const phys = mesh.material as THREE.MeshPhysicalMaterial;
          phys.color.set(ctrl.bellColor);
          phys.transmission = ctrl.transmission;
          phys.thickness = ctrl.thickness;
          phys.roughness = ctrl.roughness;
          phys.ior = ctrl.ior;
          phys.attenuationColor.set(ctrl.attenuationColor);
          phys.attenuationDistance = ctrl.attenuationDistance;
          phys.clearcoat = ctrl.clearcoat;
          phys.emissive.set(ctrl.emissive);
          phys.emissiveIntensity = ctrl.emissiveIntensity;
          phys.transparent = true;
          phys.side = THREE.DoubleSide;
          phys.needsUpdate = true;
        }
      });
    });
  }, [scene, ctrl]);

  // Log mesh structure once for debugging
  useEffect(() => {
    if (!scene) return;
    const summary: { name: string; tris: number; mat: string }[] = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const idx = mesh.geometry.index;
      const tris = idx ? idx.count / 3 : (mesh.geometry.attributes.position?.count ?? 0) / 3;
      const mat = mesh.material as THREE.Material;
      const matName = Array.isArray(mat) ? mat.map(m => m.name).join('|') : (mat?.name || '?');
      summary.push({ name: mesh.name || '(unnamed)', tris: Math.round(tris), mat: matName });
    });
    console.table(summary);
    console.log('Animations:', names);
  }, [scene, names]);

  useFrame((_, dt) => mixer?.update(dt));

  return (
    <group
      ref={group}
      scale={ctrl.scale * BASE_SCALE}
      position={[0, ctrl.offsetY, 0]}
      rotation={[0, (ctrl.rotateY * Math.PI) / 180, 0]}
    >
      <group ref={innerRef}>
        <primitive object={scene} />
      </group>
      {ctrl.lightOn && (
        <pointLight
          position={[0, 1.5, 0]}
          color={ctrl.lightColor}
          intensity={ctrl.lightIntensity}
          distance={ctrl.lightDistance}
          decay={1.4}
        />
      )}
    </group>
  );
}

function StageLights() {
  const ctrl = useControls('Stage', {
    bg:               { value: '#0c1a2e' },
    ambientIntensity: { value: 0.7, min: 0, max: 2, step: 0.05 },
    ambientColor:     { value: '#b86846' },
    keyIntensity:     { value: 2.8, min: 0, max: 6, step: 0.05 },
    keyColor:         { value: '#ffa66a' },
    keyAzimuth:       { value: 220, min: 0, max: 360, step: 1 },
    keyElevation:     { value: 35, min: -30, max: 90, step: 1 },
    fillIntensity:    { value: 0.6, min: 0, max: 3, step: 0.05 },
    fillColor:        { value: '#3aa3d8' },
    rimIntensity:     { value: 1.6, min: 0, max: 5, step: 0.05 },
    rimColor:         { value: '#ffd4a0' },
    exposure:         { value: 1.05, min: 0.1, max: 2, step: 0.02 },
  });

  const { scene, gl } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(ctrl.bg);
    gl.toneMappingExposure = ctrl.exposure;
  }, [scene, gl, ctrl.bg, ctrl.exposure]);

  const dir = useMemo(() => {
    const az = (ctrl.keyAzimuth * Math.PI) / 180;
    const el = (ctrl.keyElevation * Math.PI) / 180;
    return new THREE.Vector3(
      Math.cos(el) * Math.sin(az) * 20,
      Math.sin(el) * 20,
      -Math.cos(el) * Math.cos(az) * 20
    );
  }, [ctrl.keyAzimuth, ctrl.keyElevation]);

  return (
    <>
      <ambientLight intensity={ctrl.ambientIntensity} color={ctrl.ambientColor} />
      <directionalLight position={dir.toArray()} intensity={ctrl.keyIntensity} color={ctrl.keyColor} />
      <directionalLight position={[-dir.x, dir.y * 0.5, -dir.z]} intensity={ctrl.fillIntensity} color={ctrl.fillColor} />
      <directionalLight position={[0, -15, 5]} intensity={ctrl.rimIntensity} color={ctrl.rimColor} />
    </>
  );
}

export function JellyPreview() {
  return (
    <>
      <Leva collapsed={true} oneLineLabels />
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.85,
        }}
        camera={{ position: [0, 0, 25], fov: 45, near: 0.1, far: 500 }}
      >
        <Suspense fallback={null}>
          <StageLights />
          <Chrysaora />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 0, 0]} />
        </Suspense>
      </Canvas>
    </>
  );
}
