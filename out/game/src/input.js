// input.js: pointer-lock mouse look and keyboard movement intents.
export const keys = {};
export const mouse = { dx: 0, dy: 0, fire: false, locked: false };

export function initInput(canvas) {
  const down = (e) => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); };
  const up = (e) => { keys[e.code] = false; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  document.addEventListener('mousemove', (e) => {
    if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  document.addEventListener('mousedown', (e) => { if (mouse.locked && e.button === 0) mouse.fire = true; });
  document.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.fire = false; });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('click', () => { if (!mouse.locked) canvas.requestPointerLock(); });
}

export function consumeLook() {
  const dx = mouse.dx, dy = mouse.dy;
  mouse.dx = 0; mouse.dy = 0;
  return [dx, dy];
}
