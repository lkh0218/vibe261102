import { Game } from "./game.js";
import { Input } from "./input.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const game = new Game();

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  game.update(dt, Input);
  game.draw(ctx);

  Input.endFrame();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
