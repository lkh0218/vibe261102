import { CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_SCROLL_SPEED } from "./constants.js";
import { EnemyBullet } from "./bullet.js";

let idCounter = 0;

export class Enemy {
  constructor(opts) {
    this.id = idCounter++;
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w;
    this.h = opts.h;
    this.kind = opts.kind;
    this.hp = opts.hp;
    this.maxHp = opts.hp;
    this.score = opts.score;
    this.isBoss = opts.isBoss ?? false;
    this.alive = true;
    this.age = 0;
    this.shootCooldown = opts.shootCooldown ?? null;
    this.shootTimer = this.shootCooldown ? this.shootCooldown * Math.random() : 0;
    this.dropsPowerup = opts.dropsPowerup ?? false;
    this.behavior = opts.behavior;
    this.color = opts.color;
    this.fruit = opts.fruit ?? null;
    this.explosionColor = opts.explosionColor ?? (opts.kind === "air" ? "#ffb347" : "#ffe066");
  }

  update(dt, ctx) {
    this.age += dt;
    if (this.behavior) this.behavior(this, dt);

    if (this.shootCooldown != null && ctx.player) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = this.shootCooldown;
        const dx = ctx.player.x - this.x;
        const dy = ctx.player.y - this.y;
        ctx.enemyBullets.push(new EnemyBullet(this.x, this.y, dx, dy));
      }
    }

    if (
      this.y > CANVAS_HEIGHT + 60 ||
      this.y < -80 ||
      this.x < -80 ||
      this.x > CANVAS_WIDTH + 80
    ) {
      if (!this.isBoss) this.alive = false;
    }
  }

  takeHit(damage) {
    this.hp -= damage;
    if (this.hp <= 0) this.alive = false;
    return !this.alive;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.kind === "air") {
      ctx.rotate(Math.sin(this.age * 2) * 0.15);
      drawFruit(ctx, this.fruit, this.w, this.h, this.isBoss);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);
    }
    ctx.restore();

    if (this.maxHp > 1) {
      const barW = this.w;
      const p = Math.max(this.hp, 0) / this.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(this.x - barW / 2, this.y - this.h / 2 - 8, barW, 4);
      ctx.fillStyle = "#5f5";
      ctx.fillRect(this.x - barW / 2, this.y - this.h / 2 - 8, barW * p, 4);
    }
  }
}

function drawBerry(ctx, x, y, r, midColor, edgeColor) {
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.15, x, y, r);
  grad.addColorStop(0, "#ff9fb4");
  grad.addColorStop(0.45, midColor);
  grad.addColorStop(1, edgeColor);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawFruit(ctx, kind, w, h, isBoss) {
  const r = Math.min(w, h) / 2;

  if (kind === "orange") {
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#ffcf6b");
    grad.addColorStop(1, "#f2860f");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(160,80,0,0.5)";
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.fillStyle = "#4fa83f";
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.05, r * 0.3, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (kind === "watermelon") {
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
    grad.addColorStop(0, "#6fd15a");
    grad.addColorStop(1, "#1f7a2e");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "#0f4a1a";
    ctx.lineWidth = Math.max(r * 0.12, 2);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.32, -r * 1.1);
      ctx.quadraticCurveTo(i * r * 0.32 + r * 0.18, 0, i * r * 0.32, r * 1.1);
      ctx.stroke();
    }
    ctx.restore();

    if (isBoss) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.14, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // cherry (default)
  ctx.strokeStyle = "#3a7d33";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.85);
  ctx.quadraticCurveTo(-r * 0.1, -r * 1.6, r * 0.35, -r * 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.25, -r * 0.85);
  ctx.quadraticCurveTo(r * 0.5, -r * 1.5, r * 0.9, -r * 1.3);
  ctx.stroke();
  ctx.fillStyle = "#4fa83f";
  ctx.beginPath();
  ctx.ellipse(r * 0.55, -r * 1.5, r * 0.35, r * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();

  drawBerry(ctx, -r * 0.4, r * 0.15, r * 0.6, "#d81e3f", "#8f0f26");
  drawBerry(ctx, r * 0.4, r * 0.35, r * 0.6, "#e8355a", "#8f0f26");
}

function driftDown(speedMul = 1) {
  return (enemy, dt) => {
    enemy.y += WORLD_SCROLL_SPEED * speedMul * dt;
  };
}

function sineDrift(amplitude = 60, freq = 1.4, speedMul = 1) {
  return (enemy, dt) => {
    if (enemy._baseX == null) enemy._baseX = enemy.x;
    enemy.y += WORLD_SCROLL_SPEED * speedMul * dt;
    enemy.x = enemy._baseX + Math.sin(enemy.age * freq) * amplitude;
  };
}

function patrolGround(range = 50, speed = 40) {
  return (enemy, dt) => {
    if (enemy._baseX == null) {
      enemy._baseX = enemy.x;
      enemy._dir = 1;
    }
    enemy.x += enemy._dir * speed * dt;
    if (Math.abs(enemy.x - enemy._baseX) > range) enemy._dir *= -1;
    enemy.y += WORLD_SCROLL_SPEED * dt;
  };
}

function bossHover() {
  return (enemy, dt) => {
    if (enemy.y < 140) {
      enemy.y += WORLD_SCROLL_SPEED * dt;
    } else {
      enemy.x = CANVAS_WIDTH / 2 + Math.sin(enemy.age * 0.8) * 120;
    }
  };
}

export function createAirDrone(x, y) {
  return new Enemy({
    x,
    y,
    w: 26,
    h: 26,
    kind: "air",
    hp: 1,
    score: 100,
    fruit: "cherry",
    explosionColor: "#e8355a",
    behavior: sineDrift(50, 1.6, 1),
  });
}

export function createAirGunner(x, y) {
  return new Enemy({
    x,
    y,
    w: 28,
    h: 28,
    kind: "air",
    hp: 2,
    score: 200,
    fruit: "orange",
    explosionColor: "#ff9d2e",
    behavior: sineDrift(30, 1.0, 0.8),
    shootCooldown: 1.4,
  });
}

export function createGroundTurret(x, y) {
  return new Enemy({
    x,
    y,
    w: 30,
    h: 24,
    kind: "ground",
    hp: 2,
    score: 150,
    color: "#7a7a4a",
    behavior: driftDown(1),
    shootCooldown: 1.8,
  });
}

export function createGroundMover(x, y) {
  return new Enemy({
    x,
    y,
    w: 24,
    h: 20,
    kind: "ground",
    hp: 1,
    score: 150,
    color: "#8a6a3a",
    behavior: patrolGround(40, 50),
  });
}

export function createGroundBase(x, y) {
  return new Enemy({
    x,
    y,
    w: 56,
    h: 44,
    kind: "ground",
    hp: 8,
    score: 1000,
    color: "#555",
    behavior: driftDown(1),
    dropsPowerup: true,
  });
}

export function createAirBoss(x, y, hpMultiplier = 1) {
  return new Enemy({
    x,
    y,
    w: 96,
    h: 96,
    kind: "air",
    hp: Math.round(40 * hpMultiplier),
    score: 5000,
    fruit: "watermelon",
    explosionColor: "#6fd15a",
    behavior: bossHover(),
    shootCooldown: 0.5,
    isBoss: true,
  });
}
