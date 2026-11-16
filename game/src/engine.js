// engine.js: renderer, scene, lighting, and the fixed-step simulation loop.
import * as THREE from 'three';

export const TICK = 1 / 60;

export function createEngine(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);
  scene.fog = new THREE.Fog(0x14161a, 40, 110);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

  const hemi = new THREE.HemisphereLight(0x9fb2cc, 0x3a3f46, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.1);
  sun.position.set(40, 60, 20);
  scene.add(sun);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const sim = { systems: [], accumulator: 0, last: performance.now(), tick: 0 };
  const view = { callbacks: [] };

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - sim.last) / 1000;
    sim.last = now;
    if (dt > 0.25) dt = 0.25; // clamp after tab switches
    sim.accumulator += dt;
    while (sim.accumulator >= TICK) {
      for (const s of sim.systems) s(TICK, sim.tick);
      sim.accumulator -= TICK;
      sim.tick++;
    }
    const alpha = sim.accumulator / TICK;
    for (const cb of view.callbacks) cb(alpha, dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return { renderer, scene, camera, sim, view };
}
