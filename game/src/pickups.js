// pickups.js: ammo crates that respawn on a timer and refill the player's reserve.
import * as THREE from 'three';

const RESPAWN = 20;
const SITES = [[0, 0, -20], [0, 0, 20], [-30, 0, 0], [30, 0, 0]];

export function createPickups(scene) {
  const items = [];
  for (const [x, y, z] of SITES) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.7),
      new THREE.MeshLambertMaterial({ color: 0xd8a832 })
    );
    mesh.position.set(x, 0.3, z);
    scene.add(mesh);
    items.push({ mesh, pos: new THREE.Vector3(x, 0, z), taken: false, timer: 0 });
  }
  return items;
}

// grants reserve ammo on pickup; crates respawn after RESPAWN seconds
export function updatePickups(items, dt, player, weapon, onPickup) {
  for (const it of items) {
    if (it.taken) {
      it.timer -= dt;
      if (it.timer <= 0) { it.taken = false; it.mesh.visible = true; }
      continue;
    }
    const dx = player.pos.x - it.pos.x, dz = player.pos.z - it.pos.z;
    if (player.alive && dx * dx + dz * dz < 1.2) {
      it.taken = true;
      it.timer = RESPAWN;
      it.mesh.visible = false;
      const amount = weapon.type === 'sniper' ? 20 : 60;
      weapon.reserve += amount;
      onPickup && onPickup(amount);
    }
  }
}
