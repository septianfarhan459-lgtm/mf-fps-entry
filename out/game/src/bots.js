// bots.js: enemy team - waypoint patrol, line of sight, engage and fire.
import * as THREE from 'three';
import { colliders, waypoints, waypointLinks } from './world.js';
import { createPlayer, updatePlayer, eyePos, damage } from './player.js';
import { WEAPONS } from './weapon.js';

const BOT_SPEED = 4.6, SIGHT = 55, FIRE_CD = 0.42;

function boxMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.45), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0xf0e6d2 }));
  head.position.y = 1.72;
  head.name = 'head';
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.4), new THREE.MeshLambertMaterial({ color: 0x2b3038 }));
  legs.position.y = 0.15;
  g.add(body, head, legs);
  return g;
}

export function createBots(scene, team, count) {
  const bots = [];
  for (let i = 0; i < count; i++) {
    const p = createPlayer(team);
    p.isBot = true;
    p.mesh = boxMesh(team === 0 ? 0x3f7ac2 : 0xc25038);
    p.mesh.visible = false;
    scene.add(p.mesh);
    p.wp = 0; p.state = 'patrol'; p.fireCd = 0; p.strafe = Math.random() < 0.5 ? 1 : -1;
    p.reaction = 0.25 + Math.random() * 0.35;
    p.aimError = 0.05 + Math.random() * 0.1; // tuned: tighter base inaccuracy
    p.path = [];
    p.lastSeen = null;
    bots.push(p);
  }
  return bots;
}

function neighbours(i) {
  const out = [];
  for (const [a, b] of waypointLinks) { if (a === i) out.push(b); else if (b === i) out.push(a); }
  return out;
}

function blocked(a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const dist = dir.length();
  dir.normalize();
  for (let t = 0; t < dist; t += 1.2) {
    const x = a.x + dir.x * t, z = a.z + dir.z * t, y = a.y + 1.0;
    for (const c of colliders) {
      if (x > c[0] && x < c[3] && z > c[2] && z < c[5] && y > c[1] && y < c[4]) return true;
    }
  }
  return false;
}

export function lineOfSight(from, to) {
  const d = new THREE.Vector3().subVectors(to, from);
  const dist = d.length();
  if (dist > SIGHT) return false;
  d.normalize();
  for (let t = 1; t < dist; t += 1.0) {
    const x = from.x + d.x * t, y = from.y + d.y * t, z = from.z + d.z * t;
    for (const c of colliders) {
      if (x > c[0] && x < c[3] && y > c[1] && y < c[4] && z > c[2] && z < c[5]) return false;
    }
  }
  return true;
}

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

export function updateBot(bot, dt, target, others, onShot) {
  if (!bot.alive) return;
  bot.fireCd = Math.max(0, bot.fireCd - dt);

  if (target && target.alive) {
    eyePos(bot, tmpA); eyePos(target, tmpB);
    const sees = lineOfSight(tmpA, tmpB);
    if (sees) { bot.state = 'engage'; bot.lastSeen = tmpB.clone(); bot.reaction -= dt; }
    else if (bot.state === 'engage') bot.state = 'seek';
  } else bot.state = 'patrol';

  if (bot.state === 'patrol') {
    const goal = new THREE.Vector3(...waypoints[bot.wp]);
    const dir = goal.sub(bot.pos);
    dir.y = 0;
    if (dir.length() < 1.5) {
      const nb = neighbours(bot.wp);
      bot.wp = nb.length ? nb[(Math.random() * nb.length) | 0] : 0;
    } else {
      dir.normalize();
      bot.pos.x += dir.x * BOT_SPEED * dt;
      bot.pos.z += dir.z * BOT_SPEED * dt;
      bot.yaw = Math.atan2(-dir.x, -dir.z);
    }
  } else if (bot.state === 'seek' && bot.lastSeen) {
    const dir = bot.lastSeen.clone().sub(bot.pos); dir.y = 0;
    if (dir.length() < 2) { bot.state = 'patrol'; bot.lastSeen = null; }
    else { dir.normalize(); bot.pos.x += dir.x * BOT_SPEED * dt; bot.pos.z += dir.z * BOT_SPEED * dt; }
  } else if (bot.state === 'engage' && target) {
    // strafe + face target + fire
    const toT = new THREE.Vector3().subVectors(target.pos, bot.pos); toT.y = 0;
    const dist = toT.length();
    toT.normalize();
    bot.yaw = Math.atan2(-toT.x, -toT.z);
    bot.strafeT = (bot.strafeT || 0) - dt;
    if (bot.strafeT <= 0) { bot.strafe = -bot.strafe; bot.strafeT = 0.7 + Math.random() * 0.9; }
    bot.pos.x += (-toT.z) * bot.strafe * BOT_SPEED * 0.55 * dt;
    bot.pos.z += (toT.x) * bot.strafe * BOT_SPEED * 0.55 * dt;
    if (bot.reaction <= 0 && bot.fireCd <= 0 && dist < 50) {
      bot.fireCd = FIRE_CD * (0.85 + Math.random() * 0.4);
      // lead: moving targets are slightly harder to hit but bots compensate a little
      const tSpeed = Math.hypot(target.vel ? target.vel.x : 0, target.vel ? target.vel.z : 0);
      const leadBonus = Math.min(0.15, tSpeed * 0.012);
      const hitChance = Math.min(0.75, (Math.max(0.12, 0.85 - dist / 70) + leadBonus) * (1 - bot.aimError));
      if (Math.random() < hitChance) {
        const head = Math.random() < 0.12;
        onShot(bot, target, head ? WEAPONS.rifle.dmg * 3 : WEAPONS.rifle.dmg * 0.8);
      } else onShot(bot, null, 0);
    }
  }
  // keep bots inside map bounds
  bot.pos.x = Math.max(-56, Math.min(56, bot.pos.x));
  bot.pos.z = Math.max(-56, Math.min(56, bot.pos.z));
  bot.mesh.position.copy(bot.pos);
  bot.mesh.rotation.y = bot.yaw;
  bot.mesh.visible = true;
}
