// main.js: wires the game together - boot, loop, shooting, rounds.
import * as THREE from 'three';
import { createEngine, TICK } from './engine.js';
import { initInput, consumeLook, mouse, keys } from './input.js';
import { buildWorld, spawns, TEAM_BLUE, TEAM_ORANGE } from './world.js';
import { createPlayer, updatePlayer, eyePos, damage } from './player.js';
import { createWeapon, updateWeapon, tryFire, startReload, switchWeapon, WEAPONS, addTracer, updateTracers } from './weapon.js';
import { createBots, updateBot } from './bots.js';
import { createRounds, startRound, updateRounds, KILL_REWARD } from './rounds.js';
import { createHud, updateHud, addFeed, toggleBuyMenu, handleBuyClick } from './hud.js';

const container = document.getElementById('game');
const engine = createEngine(container);
const { scene, camera, view, sim } = engine;

buildWorld(scene);
initInput(rendererCanvas());

function rendererCanvas() { return engine.renderer.domElement; }

// players: human on blue, 5 bots orange, 4 bot teammates blue
const player = createPlayer(TEAM_BLUE);
player.pos.set(...spawns[TEAM_BLUE][0]);
const botsBlue = createBots(scene, TEAM_BLUE, 4);
const botsOrange = createBots(scene, TEAM_ORANGE, 5);
botsBlue.forEach((b, i) => { b.pos.set(...spawns[TEAM_BLUE][i + 1]); });
botsOrange.forEach((b, i) => { b.pos.set(...spawns[TEAM_ORANGE][i]); });
const everyone = [player, ...botsBlue, ...botsOrange];

const weapon = createWeapon();
const rounds = createRounds();
const hud = createHud();
let kills = 0;

const _eye = new THREE.Vector3(), _dir = new THREE.Vector3(), _ray = new THREE.Raycaster();

function shoot() {
  const spec = WEAPONS[weapon.type];
  eyePos(player, _eye);
  camera.getWorldDirection(_dir);
  // spread
  const s = weapon.currentSpread || spec.spread;
  _dir.x += (Math.random() - 0.5) * s * 2;
  _dir.y += (Math.random() - 0.5) * s * 2;
  _dir.z += (Math.random() - 0.5) * s * 2;
  _dir.normalize();
  _ray.set(_eye, _dir);
  _ray.far = 120;

  let best = null, bestDist = Infinity, headshot = false;
  for (const other of everyone) {
    if (other === player || !other.alive || other.team === player.team) continue;
    const bodyBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(other.pos.x, other.pos.y + 0.9, other.pos.z), new THREE.Vector3(0.7, 1.1, 0.5));
    const headBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(other.pos.x, other.pos.y + 1.72, other.pos.z), new THREE.Vector3(0.45, 0.45, 0.45));
    const hitBody = _ray.ray.intersectBox(bodyBox, new THREE.Vector3());
    const hitHead = _ray.ray.intersectBox(headBox, new THREE.Vector3());
    const hit = hitHead || hitBody;
    if (hit) {
      const d = hit.distanceTo(_eye);
      if (d < bestDist) { bestDist = d; best = { other, point: hit, head: !!hitHead }; }
    }
  }
  // world hit for tracer endpoint
  const wallHit = _ray.intersectObjects(scene.children, true).filter((h) => !h.object.parent || !h.object.parent.isGroup)[0];
  const end = best ? best.point : (wallHit ? wallHit.point : _eye.clone().add(_dir.multiplyScalar(120)));
  addTracer(scene, _eye, end);
  if (best) {
    const falloff = Math.max(0.55, 1 - bestDist / 90);
    const killed = damage(best.other, spec.dmg * falloff, best.head);
    showHitmarker();
    if (killed) {
      player.money = Math.min(16000, player.money + KILL_REWARD);
      player.kills++;
      addFeed(hud, `<b>You</b> killed <span class="${best.other.team === TEAM_ORANGE ? 'orange' : 'blue'}">${best.other.team === TEAM_ORANGE ? 'Orange' : 'Blue'}</span>${best.head ? ' HEADSHOT' : ''}`);
      checkRoundEnd();
    }
  }
}

function botShoot(bot, target, dmg) {
  eyePos(bot, _eye);
  if (target) {
    eyePos(target, tmpV);
    addTracer(scene, _eye, tmpV.clone().add(new THREE.Vector3((Math.random()-0.5)*0.3, 0, (Math.random()-0.5)*0.3)));
    const killed = damage(target, dmg, false);
    if (killed) {
      if (target === player) respawnPlayer();
      checkRoundEnd();
    }
  }
}
const tmpV = new THREE.Vector3();

function showHitmarker() {
  const hm = document.getElementById('hitmarker');
  if (!hm) return;
  hm.classList.add('on');
  clearTimeout(hm._t);
  hm._t = setTimeout(() => hm.classList.remove('on'), 110);
}

function respawnPlayer() {
  player.alive = false;
  setTimeout(() => {
    const s = spawns[TEAM_BLUE][(kills + 1) % spawns[TEAM_BLUE].length];
    player.pos.set(s[0], 0.1, s[2]);
    player.vel.set(0, 0, 0);
    player.alive = true;
    player.health = 100;
  }, 2500);
}

function checkRoundEnd() {
  const blueAlive = everyone.filter((p) => p.team === TEAM_BLUE && p.alive).length;
  const orangeAlive = everyone.filter((p) => p.team === TEAM_ORANGE && p.alive).length;
  if (rounds.phase === 'live' && (blueAlive === 0 || orangeAlive === 0)) updateRounds(rounds, 0.001, everyone);
}

// overlay + start
const overlay = document.getElementById('overlay');
function begin() {
  overlay.hidden = true;
  startRound(rounds, everyone);
}
document.getElementById('play').addEventListener('click', () => {
  overlay.hidden = true;
  rendererCanvas().requestPointerLock();
  startRound(rounds, everyone);
});
// screenshot/automation hook: ?shot=... starts the game headlessly without pointer lock,
// ?shot=play&yaw=<rad>&pitch=<rad>&pos=x,z aims the camera for a reproducible capture
if (new URLSearchParams(location.search).has('shot')) {
  const q = new URLSearchParams(location.search);
  const yaw = parseFloat(q.get('yaw')); if (!Number.isNaN(yaw)) player.yaw = yaw;
  const pitch = parseFloat(q.get('pitch')); if (!Number.isNaN(pitch)) player.pitch = pitch;
  const pos = q.get('pos');
  if (pos) { const [x, z] = pos.split(',').map(Number); if (!Number.isNaN(x) && !Number.isNaN(z)) { player.pos.x = x; player.pos.z = z; } }
  begin();
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') startReload(weapon);
  if (e.code === 'KeyB' && rounds.phase === 'buy') toggleBuyMenu(hud, player);
  if (e.code === 'Digit1') switchWeapon(weapon, 'rifle');
  if (e.code === 'Digit2') switchWeapon(weapon, 'smg');
  if (e.code === 'Digit3') switchWeapon(weapon, 'sniper');
});
handleBuyClick(hud, player, (key) => { switchWeapon(weapon, key); });

// camera update per frame
view.callbacks.push((alpha, dt) => {
  eyePos(player, _eye);
  camera.position.copy(_eye);
  camera.rotation.set(player.pitch - weapon.recoilPitch, player.yaw, 0, 'YXZ');
});

// fixed-step systems
let framesAlive = 0;
sim.systems.push((dt, tick) => {
  const look = consumeLook();
  const moving = Math.hypot(player.vel.x, player.vel.z) > 1;
  updatePlayer(player, dt, look);
  updateWeapon(weapon, dt, moving, !player.onGround);

  if (mouse.fire && player.alive && rounds.phase === 'live' && tryFire(weapon, true)) shoot();
  updateTracers(dt);

  const enemies = player.team === TEAM_BLUE ? botsOrange : botsBlue;
  const mates = botsBlue;
  for (const bot of botsOrange) updateBot(bot, dt, player.alive ? player : mates.find((m) => m.alive) || null, everyone, botShoot);
  for (const bot of botsBlue) {
    const t = botsOrange.find((m) => m.alive) || null;
    updateBot(bot, dt, t, everyone, botShoot);
  }

  updateRounds(rounds, dt, everyone, (winner) => {
    addFeed(hud, `<b>${winner === TEAM_BLUE ? 'BLUE' : 'ORANGE'} wins the round</b>`);
  });
  if (rounds.phase === 'over' && rounds.timer <= 0) startRound(rounds, everyone);
});

// HUD per frame
const hudState = { player, weapon, rounds };
view.callbacks.push(() => {
  updateHud(hud, hudState);
  const copy = document.getElementById('overlay-copy');
  if (copy && rounds.phase === 'over') copy.textContent = rounds.matchOver
    ? `Match over - ${rounds.score[0]} : ${rounds.score[1]} - reload to play again`
    : `Round ${rounds.round} over - ${rounds.score[0]} : ${rounds.score[1]}`;
});
