const keysDown = new Set();
let justPressed = new Set();

const PREVENT_DEFAULT_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

window.addEventListener("keydown", (e) => {
  if (!keysDown.has(e.code)) justPressed.add(e.code);
  keysDown.add(e.code);
  if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  keysDown.delete(e.code);
});

export const Input = {
  isDown(code) {
    return keysDown.has(code);
  },
  wasPressed(code) {
    return justPressed.has(code);
  },
  endFrame() {
    justPressed = new Set();
  },
};
