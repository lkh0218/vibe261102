import { CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_SCROLL_SPEED } from "./constants.js";
import { Player } from "./player.js";
import { StageManager, STAGE_COUNT } from "./stage.js";
import { aabbOverlap, circleOverlap } from "./collision.js";
import {
  drawHUD,
  drawTitleScreen,
  drawGameOverScreen,
  drawPausedOverlay,
  drawStageClear,
  drawCenteredText,
} from "./ui.js";

const HIGH_SCORE_KEY = "skyStriker.highScore";

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 140;
    this.vy = (Math.random() - 0.5) * 140;
    this.life = 0.4 + Math.random() * 0.3;
    this.age = 0;
    this.color = color;
  }

  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  get alive() {
    return this.age < this.life;
  }

  draw(ctx) {
    const p = Math.max(1 - this.age / this.life, 0);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = p;
    ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}

const POWERUP_STYLE = {
  dual: { color: "#5ff", label: "SHOT" },
  bombup: { color: "#f95", label: "BOMB" },
  life: { color: "#f5a", label: "LIFE" },
  score: { color: "#ff5", label: "+500" },
};

class Item {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.w = 18;
    this.h = 18;
    this.kind = kind;
    this.alive = true;
    this.age = 0;
  }

  update(dt) {
    this.age += dt;
    this.y += WORLD_SCROLL_SPEED * dt;
    if (this.y > CANVAS_HEIGHT + 20) this.alive = false;
  }

  draw(ctx) {
    const style = POWERUP_STYLE[this.kind];
    const pulse = 1 + Math.sin(this.age * 6) * 0.12;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = style.color;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;

    if (this.kind === "life") {
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.bezierCurveTo(-9, -3, -6, -9, 0, -3);
      ctx.bezierCurveTo(6, -9, 9, -3, 0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.kind === "score") {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? 8 : 3.5;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = "#08202a";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.kind === "dual" ? "S" : "B", 0, 1);
    }
    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.age = 0;
    this.life = 0.9;
  }

  update(dt) {
    this.age += dt;
    this.y -= 32 * dt;
  }

  get alive() {
    return this.age < this.life;
  }

  draw(ctx) {
    const p = Math.max(1 - this.age / this.life, 0);
    ctx.globalAlpha = p;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

function rollPowerupKind() {
  const roll = Math.random();
  if (roll < 0.35) return "dual";
  if (roll < 0.7) return "bombup";
  if (roll < 0.9) return "score";
  return "life";
}

export class Game {
  constructor() {
    this.state = "TITLE";
    this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    this.scrollY = 0;
    this.score = 0;
    this.stageIndex = 0;
    this.newHighScore = false;
    this.stageClearTimer = 0;
    this.allClearTimer = 0;
  }

  resetRun() {
    this.score = 0;
    this.stageIndex = 0;
    this.player = new Player();
    this.enemies = [];
    this.zapBullets = [];
    this.bombs = [];
    this.enemyBullets = [];
    this.items = [];
    this.particles = [];
    this.floatingTexts = [];
    this.stageManager = new StageManager(this.stageIndex);
    this.newHighScore = false;
    this.state = "PLAYING";
  }

  startNextStage() {
    this.stageIndex += 1;
    this.enemies = [];
    this.zapBullets = [];
    this.bombs = [];
    this.enemyBullets = [];
    this.stageManager = new StageManager(this.stageIndex);
    this.state = "PLAYING";
  }

  spawnExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
  }

  update(dt, input) {
    this.scrollY += WORLD_SCROLL_SPEED * dt;

    if (this.state === "TITLE") {
      if (input.wasPressed("Enter")) this.resetRun();
      return;
    }
    if (this.state === "GAMEOVER") {
      if (input.wasPressed("Enter")) this.state = "TITLE";
      return;
    }
    if (this.state === "PLAYING") {
      if (input.wasPressed("KeyP")) {
        this.state = "PAUSED";
        return;
      }
      this.updatePlaying(dt, input);
      return;
    }
    if (this.state === "PAUSED") {
      if (input.wasPressed("KeyP")) this.state = "PLAYING";
      return;
    }
    if (this.state === "STAGE_CLEAR") {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        if (this.stageIndex + 1 >= STAGE_COUNT) {
          this.state = "ALL_CLEAR";
          this.allClearTimer = 3;
        } else {
          this.startNextStage();
        }
      }
      return;
    }
    if (this.state === "ALL_CLEAR") {
      this.allClearTimer -= dt;
      if (this.allClearTimer <= 0) this.state = "TITLE";
    }
  }

  updatePlaying(dt, input) {
    const player = this.player;
    player.update(dt, input);

    for (const b of player.tryZap(input)) this.zapBullets.push(b);
    const bomb = player.tryBomb(input);
    if (bomb) this.bombs.push(bomb);

    for (const b of this.zapBullets) b.update(dt);
    for (const b of this.bombs) b.update(dt);
    for (const b of this.enemyBullets) b.update(dt, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    for (const p of this.particles) p.update(dt);
    for (const it of this.items) it.update(dt);
    for (const ft of this.floatingTexts) ft.update(dt);

    const spawnCtx = { player, enemyBullets: this.enemyBullets };
    for (const e of this.enemies) e.update(dt, spawnCtx);

    this.stageManager.update(dt, (newEnemies) => this.enemies.push(...newEnemies));

    this.resolveCollisions();

    this.zapBullets = this.zapBullets.filter((b) => b.alive);
    this.bombs = this.bombs.filter((b) => b.alive);
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);
    this.enemies = this.enemies.filter((e) => e.alive);
    this.particles = this.particles.filter((p) => p.alive);
    this.items = this.items.filter((it) => it.alive);
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.alive);

    if (player.lives <= 0) {
      this.state = "GAMEOVER";
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.newHighScore = true;
        localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      }
      return;
    }

    if (this.stageManager.isFinished) {
      this.state = "STAGE_CLEAR";
      this.stageClearTimer = 2;
    }
  }

  resolveCollisions() {
    const player = this.player;

    for (const bullet of this.zapBullets) {
      if (!bullet.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive || enemy.kind !== "air") continue;
        if (aabbOverlap(bullet, enemy)) {
          bullet.alive = false;
          if (enemy.takeHit(1)) this.onEnemyDestroyed(enemy);
          break;
        }
      }
    }

    for (const bomb of this.bombs) {
      if (!bomb.exploded || bomb._resolved) continue;
      bomb._resolved = true;
      for (const enemy of this.enemies) {
        if (!enemy.alive || enemy.kind !== "ground") continue;
        if (circleOverlap(bomb.x, bomb.y, bomb.radius, enemy)) {
          if (enemy.takeHit(2)) this.onEnemyDestroyed(enemy);
        }
      }
    }

    if (player.invincibleTimer <= 0) {
      for (const bullet of this.enemyBullets) {
        if (!bullet.alive) continue;
        if (aabbOverlap(bullet, player.hitbox)) {
          bullet.alive = false;
          if (player.hit()) this.spawnExplosion(player.x, player.y, "#7fd2ff", 10);
          break;
        }
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (aabbOverlap(enemy, player.hitbox)) {
          if (player.hit()) this.spawnExplosion(player.x, player.y, "#7fd2ff", 10);
          if (!enemy.isBoss && enemy.kind === "air") {
            enemy.alive = false;
            this.spawnExplosion(enemy.x, enemy.y, "#ffb347", 10);
          }
          break;
        }
      }
    }

    for (const item of this.items) {
      if (!item.alive) continue;
      if (aabbOverlap(item, player.hitbox)) {
        item.alive = false;
        this.applyPowerup(item.kind, item.x, item.y);
      }
    }
  }

  onEnemyDestroyed(enemy) {
    this.score += enemy.score;
    this.spawnExplosion(enemy.x, enemy.y, enemy.explosionColor, enemy.isBoss ? 40 : 14);
    if (enemy.dropsPowerup) {
      this.items.push(new Item(enemy.x, enemy.y, rollPowerupKind()));
    }
  }

  applyPowerup(kind, x, y) {
    const style = POWERUP_STYLE[kind];
    let label = style.label;
    if (kind === "dual") {
      this.player.shotLevel = Math.min(this.player.shotLevel + 1, 2);
      label = this.player.shotLevel >= 2 ? "TRIPLE SHOT!" : "DUAL SHOT!";
    } else if (kind === "bombup") {
      this.player.bombRadiusBonus = Math.min(this.player.bombRadiusBonus + 12, 40);
      label = "BOMB UP!";
    } else if (kind === "life") {
      this.player.lives = Math.min(this.player.lives + 1, 5);
      label = "1UP!";
    } else if (kind === "score") {
      this.score += 500;
      label = "+500";
    }
    this.floatingTexts.push(new FloatingText(x, y, label, style.color));
    this.spawnExplosion(x, y, style.color, 10);
  }

  drawBackground(ctx) {
    ctx.fillStyle = "#0c1a12";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = "rgba(127,210,255,0.08)";
    ctx.lineWidth = 1;
    const tile = 48;
    const offset = this.scrollY % tile;
    for (let y = -tile; y < CANVAS_HEIGHT + tile; y += tile) {
      ctx.beginPath();
      ctx.moveTo(0, y + offset);
      ctx.lineTo(CANVAS_WIDTH, y + offset);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(90,140,110,0.25)";
    const riverOffset = this.scrollY % (CANVAS_HEIGHT * 2);
    ctx.fillRect(CANVAS_WIDTH * 0.35, -riverOffset, CANVAS_WIDTH * 0.18, CANVAS_HEIGHT * 2);
  }

  draw(ctx) {
    this.drawBackground(ctx);

    if (this.state === "TITLE") {
      drawTitleScreen(ctx, this);
      return;
    }

    if (this.player) {
      for (const it of this.items) it.draw(ctx);
      for (const e of this.enemies) e.draw(ctx);
      for (const b of this.enemyBullets) b.draw(ctx);
      for (const b of this.zapBullets) b.draw(ctx);
      for (const b of this.bombs) b.draw(ctx);
      this.player.draw(ctx);
      for (const p of this.particles) p.draw(ctx);
      for (const ft of this.floatingTexts) ft.draw(ctx);
      drawHUD(ctx, this);
    }

    if (this.state === "PAUSED") drawPausedOverlay(ctx);
    if (this.state === "STAGE_CLEAR") drawStageClear(ctx, this.stageIndex);
    if (this.state === "ALL_CLEAR") {
      drawCenteredText(ctx, "ALL STAGE CLEAR!", CANVAS_HEIGHT / 2, 28, "#5f5");
    }
    if (this.state === "GAMEOVER") drawGameOverScreen(ctx, this);
  }
}
