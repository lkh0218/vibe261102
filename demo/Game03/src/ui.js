import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants.js";

export function drawHUD(ctx, game) {
  ctx.textBaseline = "top";
  ctx.font = "16px monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE ${String(game.score).padStart(6, "0")}`, 10, 8);
  ctx.textAlign = "right";
  ctx.fillText(`HI ${String(game.highScore).padStart(6, "0")}`, CANVAS_WIDTH - 10, 8);

  ctx.textAlign = "left";
  ctx.font = "14px monospace";
  ctx.fillText(`STAGE ${game.stageIndex + 1}`, 10, CANVAS_HEIGHT - 24);

  const bombLevel = Math.round((game.player.bombRadiusBonus / 40) * 3);
  drawPowerBar(ctx, "SHOT", game.player.shotLevel, 2, 10, CANVAS_HEIGHT - 66);
  drawPowerBar(ctx, "BOMB", bombLevel, 3, 10, CANVAS_HEIGHT - 48);

  for (let i = 0; i < game.player.lives; i++) {
    drawLifeIcon(ctx, CANVAS_WIDTH - 24 - i * 22, CANVAS_HEIGHT - 26);
  }
}

function drawPowerBar(ctx, label, level, max, x, y) {
  ctx.textBaseline = "middle";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "#9fe8d8";
  ctx.fillText(label, x, y + 5);
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < level ? "#5ff" : "rgba(255,255,255,0.15)";
    ctx.fillRect(x + 42 + i * 12, y, 9, 9);
  }
}

function drawLifeIcon(ctx, x, y) {
  ctx.fillStyle = "#7fd2ff";
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x + 7, y + 8);
  ctx.lineTo(x - 7, y + 8);
  ctx.closePath();
  ctx.fill();
}

export function drawCenteredText(ctx, text, y, size = 28, color = "#fff") {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size}px monospace`;
  ctx.fillStyle = color;
  ctx.fillText(text, CANVAS_WIDTH / 2, y);
}

export function drawTitleScreen(ctx, game) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawCenteredText(ctx, "SKY STRIKER", CANVAS_HEIGHT / 2 - 60, 34, "#7fd2ff");
  drawCenteredText(ctx, "PRESS ENTER TO START", CANVAS_HEIGHT / 2 + 10, 16, "#fff");
  drawCenteredText(
    ctx,
    `HIGH SCORE ${String(game.highScore).padStart(6, "0")}`,
    CANVAS_HEIGHT / 2 + 46,
    14,
    "#ff5"
  );
  drawCenteredText(
    ctx,
    "ARROWS/WASD MOVE  Z/SPACE ZAP  X/SHIFT BOMB",
    CANVAS_HEIGHT / 2 + 90,
    12,
    "#aaa"
  );
}

export function drawGameOverScreen(ctx, game) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawCenteredText(ctx, "GAME OVER", CANVAS_HEIGHT / 2 - 40, 32, "#f55");
  drawCenteredText(ctx, `SCORE ${String(game.score).padStart(6, "0")}`, CANVAS_HEIGHT / 2 + 4, 18, "#fff");
  if (game.newHighScore) {
    drawCenteredText(ctx, "NEW HIGH SCORE!", CANVAS_HEIGHT / 2 + 32, 16, "#ff5");
  }
  drawCenteredText(ctx, "PRESS ENTER TO RESTART", CANVAS_HEIGHT / 2 + 66, 14, "#aaa");
}

export function drawPausedOverlay(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawCenteredText(ctx, "PAUSED", CANVAS_HEIGHT / 2, 28, "#fff");
}

export function drawStageClear(ctx, stageIndex) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawCenteredText(ctx, `STAGE ${stageIndex + 1} CLEAR`, CANVAS_HEIGHT / 2, 26, "#5f5");
}
