// grenade.js: throwable frag grenade (G key) with fuse, physics bounce,
// radial damage to everyone (bots + player) and a simple flash mesh.
import * as THREE from 'three';
import { colliders } from './world.js';
import { playExplosion } from './sfx.js';

export const GRENADE_COUNT = 2, FUSE = 2.2, RADIUS = 7, MAX_DMG = 95, THROW_SPEED = 16;

export function createGrenades() {
  return { held: GRENADE_COUNT, active: [] };
}

export function throwGrenade(g, scene, origin, dir) {
  if (g.held <= 0) return false;
  g.held--;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x3d4a2f })
  );
  mesh.position.copy(origin);
  const vel = dir.clone().normalize().multiplyScalar(THROW_SPEED);
  vel.y += 3.5;
  g.active.push({ mesh, vel, fuse: FUSE });
  scene.add(mesh);
  return true;
}


function hitWorld(p) {
  for (const c of colliders) {
    if (p.x > c[0] && p.x < c[3] && p.y > c[1] && p.y < c[4] && p.z > c[2] && p.z < c[5]) return true;
  }
  return false;
}

// damage everyone in radius, falls off linearly; onKill(victim) per death
function explode(g, scene, everyone, onKill) {
  playExplosion();
  for (const gr of g.active) {
    scene.remove(gr.mesh);
    gr.mesh.geometry.dispose();
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 })
    );
    flash.position.copy(gr.mesh.position);
    scene.add(flash);
    setTimeout(() => { scene.remove(flash); flash.geometry.dispose(); }, 160);
    const center = gr.mesh.position;
    for (const p of everyone) {
      if (!p.alive) continue;
      const d = Math.sqrt(
        (p.pos.x - center.x) ** 2 + (p.pos.y + 0.9 - center.y) ** 2 + (p.pos.z - center.z) ** 2
      );
      if (d > RADIUS) continue;
      const dmg = MAX_DMG * (1 - d / RADIUS);
      p.health -= dmg;
      if (p.health <= 0 && p.alive) {
        p.health = 0; p.alive = false; p.deaths++;
        onKill && onKill(p);
      }
    }
  }
  g.active.length = 0;
}

// returns true if any grenade exploded this tick (caller handles round end)
export function updateGrenades(g, scene, dt, everyone, onKill) {
  let exploded = false;
  for (let i = g.active.length - 1; i >= 0; i--) {
    const gr = g.active[i];
    gr.fuse -= dt;
    gr.vel.y -= 18 * dt;
    const step = gr.vel.clone().multiplyScalar(dt);
    const next = gr.mesh.position.clone().add(step);
    if (hitWorld(next)) {
      if (Math.abs(step.x) > Math.abs(step.y) && Math.abs(step.x) > Math.abs(step.z)) gr.vel.x *= -0.45;
      else if (Math.abs(step.y) >= Math.abs(step.z)) gr.vel.y *= -0.45;
      else gr.vel.z *= -0.45;
      gr.vel.multiplyScalar(0.7);
    } else {
      gr.mesh.position.copy(next);
    }
    if (gr.fuse <= 0) { exploded = true; break; }
  }
  if (exploded) explode(g, scene, everyone, onKill);
  return exploded;
}
